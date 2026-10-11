import {normalizeProgress,WEEKLY_TASKS,taskReady} from './progression-rules.js';
import {sanitizeCustomization} from './garage-config.js';
// Official contract: https://www.bilibili.com/toy/publish/sdk
export const TOY_BOARDS=Object.freeze({bay:1,citadel:2,harbor:3,canyon:4});
export function raceScore({scene,assisted,time,laps}){
 if(!TOY_BOARDS[scene])throw Error('Unknown circuit.');
 if(assisted)throw Error('新手辅助仅保存本地成绩，不参与 Toy 标准榜。');
 const ms=Math.round(time*1000);
 if(!Number.isFinite(time)||ms<=0||ms>16777216||laps?.length!==3||laps.some(lap=>!lap.valid))throw Error('Only valid completed three-lap races can be submitted.');
 return {board:TOY_BOARDS[scene],score:-ms};
}
let loading;
export function loadToySDK(){
 if(globalThis.window?.toy)return Promise.resolve(window.toy);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';script.async=true;
  const timer=setTimeout(()=>{script.remove();reject(Error('Toy SDK 加载超时，请稍后重试。'));},10000);
  script.onload=()=>{clearTimeout(timer);window.toy?resolve(window.toy):reject(Error('Toy SDK unavailable.'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Toy SDK 加载失败，请在 B站 Toy 中打开。'));};document.head.append(script);
 }).catch(error=>{loading=null;throw error;});return loading;
}
export function createToyClub(getSDK=loadToySDK){
 const cache=new Map(),pending=new Map(),submissions=new Map();let profile=null,storageQueue=Promise.resolve();
 async function sdkFor(ability){const sdk=await getSDK();if(!await sdk.isSupport(ability))throw Error('请在 B站 Toy 中使用排行榜。');return sdk;}
 async function call(ability,args){try{return await (await sdkFor(ability))[ability](args);}catch(error){if(error.code===307044)throw Error('请求过于频繁，请稍后手动重试。');throw error;}}
 const storageKey='apex.progress.v1',optInKey='apex-toy-cloud-opt-in';
 const hasCloudAccess=()=>{if(profile)return true;try{return localStorage.getItem(optInKey)==='1';}catch{return false;}};
 function updateProgress(mutate){const task=storageQueue.then(async()=>{
  if(!hasCloudAccess())throw Error('请先连接 B站车手身份。');
  const values=await call('getCloudStorage',[storageKey]);let raw={};
  if(values[storageKey]){try{raw=typeof values[storageKey]==='string'?JSON.parse(values[storageKey]):values[storageKey];if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();}catch{throw Error('云端存档格式异常，未覆盖原存档。');}}
  const state=normalizeProgress(raw),receipts=Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-128):[];
  if(mutate){mutate(state,receipts);await call('setCloudStorage',{[storageKey]:JSON.stringify({...state,receipts:receipts.slice(-128)})});}
  return state;
 });storageQueue=task.catch(()=>{});return task;}
 return {
  async progress({seconds=0,batch=null}={}){if(!Number.isInteger(seconds)||seconds<0||seconds>60)throw Error('Invalid driving time.');return updateProgress(seconds?(state,receipts)=>{if(!batch)throw Error('Missing progress receipt.');if(receipts.includes(batch))return;state.total_seconds+=seconds;state.week_seconds+=seconds;receipts.push(batch);}:null);},
  async claimReward(id){return updateProgress(state=>{const task=WEEKLY_TASKS.find(t=>t.id===id);if(!task)throw Error('Unknown activity.');if(state.claimed.includes(id))return;if(!taskReady(state,task))throw Error('任务尚未完成。');state.claimed.push(id);state.activity_points+=task.points;state.liveries=[...new Set([...state.liveries,task.reward])];});},
  async saveGarage(garage){return updateProgress(state=>{const cars={};for(const [index,value]of Object.entries(garage?.cars||{})){if(!/^[0-5]$/.test(index))continue;const config=sanitizeCustomization(value);if(!state.liveries.includes(config.livery))throw Error('涂装尚未解锁。');cars[index]=config;}state.garage={cars};});},
  async recordProgressRace(id=globalThis.crypto.randomUUID()){return updateProgress((state,receipts)=>{const key='race:'+id;if(receipts.includes(key))return;state.week_races++;receipts.push(key);});},
  configured:true,provider:'toy',signedIn:hasCloudAccess,current:async()=>profile,
  // Must be invoked by a user's click; never request profile on page load.
  async connect(){const data=await call('getUserProfile');profile={player_name:data.nickname,avatar:data.avatar};try{localStorage.setItem(optInKey,'1');}catch{}globalThis.window?.dispatchEvent(new CustomEvent('apex-club-profile',{detail:profile}));return profile;},
  async logout(){profile=null;try{localStorage.removeItem(optInKey);}catch{}},
  async leaderboard(scene,assisted,{refresh=false,period='all'}={}){
   if(assisted)throw Error('新手辅助仅保存本地成绩，不参与 Toy 标准榜。');
   const board=TOY_BOARDS[scene];if(!board)throw Error('Unknown circuit.');
   if(!['all','month','week','day'].includes(period))throw Error('Invalid period.');
   const key=`${board}:${period}`;if(pending.has(key))return pending.get(key);if(!refresh&&cache.has(key))return cache.get(key);
   const task=call('getRankList',{board,period,limit:50}).then(items=>{const records=items.filter(r=>Number.isInteger(r.score)&&r.score<0&&r.score>=-16777216).map(r=>({rank:r.rank,player_name:r.nickname,time_ms:-r.score,avatar:r.avatar}));cache.set(key,records);return records;}).finally(()=>pending.delete(key));pending.set(key,task);return task;
  },
  async myRank(scene,period='all'){const mine=await call('getMyRank',{board:TOY_BOARDS[scene],period});return mine.ranked?{rank:mine.rank,time_ms:-mine.score}:null;},
  async submit(race){
   const request=raceScore(race),key=`${request.board}:${request.score}`;
   if(submissions.has(key))return submissions.get(key);
   const task=call('submitScore',request).then(()=>{cache.clear();return true;}).catch(error=>{submissions.delete(key);throw error;});submissions.set(key,task);return task;
  }
 };
}
