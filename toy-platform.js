// Official contract: https://www.bilibili.com/toy/publish/sdk
export const TOY_BOARDS=Object.freeze({bay:1,citadel:2,harbor:3});
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
 const cache=new Map(),pending=new Map(),submissions=new Map();let profile=null;
 async function sdkFor(ability){const sdk=await getSDK();if(!await sdk.isSupport(ability))throw Error('请在 B站 Toy 中使用排行榜。');return sdk;}
 async function call(ability,args){try{return await (await sdkFor(ability))[ability](args);}catch(error){if(error.code===307044)throw Error('请求过于频繁，请稍后手动重试。');throw error;}}
 return {
  configured:true,provider:'toy',signedIn:()=>!!profile,current:async()=>profile,
  // Must be invoked by a user's click; never request profile on page load.
  async connect(){const data=await call('getUserProfile');profile={player_name:data.nickname,avatar:data.avatar};return profile;},
  async logout(){profile=null;},
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
