import {ONLINE_CONFIG} from './online-config.js';
import {tr} from './localization.js';

const configured=!!(ONLINE_CONFIG.url&&ONLINE_CONFIG.publishableKey);
const root=ONLINE_CONFIG.url.replace(/\/$/,'');
const sessionKey='apex-club-token-v2';
const namePattern=/^[A-Za-z0-9_-]{3,16}$/;
let token=null;
try{token=localStorage.getItem(sessionKey);}catch{}

function save(value){token=value;try{if(value)localStorage.setItem(sessionKey,value);else localStorage.removeItem(sessionKey);}catch{}}
async function request(path,{method='GET',body}={}){
  if(!configured)throw Error('Online club is not configured yet.');
  const response=await fetch(root+path,{method,headers:{apikey:ONLINE_CONFIG.publishableKey,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.message||data?.error||`Request failed (${response.status})`);
  if(data?.error)throw Error(data.error);
  return data;
}
const rpc=(name,body)=>request(`/rest/v1/rpc/${name}`,{method:'POST',body});
export const onlineClub={
  configured,
  signedIn(){return !!token;},
  async current(){if(!token)return null;const profile=await rpc('club_me',{p_token:token});if(!profile)save(null);return profile;},
  async register(name,password){
    if(!namePattern.test(name))throw Error('Player name: 3–16 English letters, numbers, _ or -.');
    if(password.length<8||new TextEncoder().encode(password).length>72)throw Error('Password must be at least 8 characters and at most 72 bytes.');
    const data=await rpc('club_register',{p_name:name,p_password:password});save(data.token);return {player_name:data.player_name};
  },
  async login(name,password){
    const data=await rpc('club_login',{p_name:name,p_password:password});save(data.token);return {player_name:data.player_name};
  },
  async logout(){try{if(token)await rpc('club_logout',{p_token:token});}finally{save(null);}},
  async leaderboard(scene,assisted){
    return request(`/rest/v1/club_leaderboard?select=player_name,time_ms,craft,achieved_at&scene=eq.${scene}&assisted=eq.${assisted}&rules_version=eq.${ONLINE_CONFIG.rulesVersion}&order=time_ms.asc,achieved_at.asc&limit=50`);
  },
  async submit({scene,assisted,craft,lap}){
    if(!token)throw Error('Sign in to submit a lap.');
    return rpc('submit_best_lap',{p_token:token,p_scene:scene,p_assisted:assisted,p_craft:craft,p_rules_version:ONLINE_CONFIG.rulesVersion,p_time_ms:Math.round(lap.time*1000),p_splits_ms:lap.splits.map(v=>Math.round(v*1000)),p_samples:lap.samples});
  },
};

export function mountOnlineClub({scene,assisted,onProfile}){
  const dialog=document.querySelector('#clubDialog'),status=document.querySelector('#clubStatus'),rows=document.querySelector('#globalRows');
  const name=document.querySelector('#clubPlayerName'),password=document.querySelector('#clubPassword');
  const authPane=document.querySelector('#clubAuth'),accountPane=document.querySelector('#clubAccount');
  let current=null;
  const message=value=>{status.textContent=tr(value||'');};
  const renderProfile=value=>{current=value;document.querySelector('#clubAccountName').textContent=value?.player_name||'';authPane.hidden=!!value;accountPane.hidden=!value;onProfile(value);};
  const format=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${((ms%60000)/1000).toFixed(2).padStart(5,'0')}`;
  async function load(){
    if(!configured){message('Online club needs Supabase configuration.');return;}
    message('Loading global best laps…');rows.replaceChildren();
    try{const data=await onlineClub.leaderboard(scene(),assisted());for(const [i,row] of data.entries()){const tr=document.createElement('tr');for(const value of [i+1,row.player_name,format(row.time_ms),row.craft+1]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}rows.append(tr);}message(data.length?'Top 50 · Best lap per player':'No laps yet. Set the first time!');}
    catch(error){message(error.message);}
  }
  document.querySelector('#openClub').addEventListener('click',()=>{dialog.showModal();load();});
  document.querySelector('#closeClub').addEventListener('click',()=>dialog.close());
  document.querySelector('#clubRefresh').addEventListener('click',load);
  document.querySelector('#clubLogin').addEventListener('click',async()=>{message('Signing in…');try{renderProfile(await onlineClub.login(name.value.trim(),password.value));password.value='';message('Signed in.');load();}catch(error){message(error.message);}});
  document.querySelector('#clubRegister').addEventListener('click',async()=>{message('Creating account…');try{renderProfile(await onlineClub.register(name.value.trim(),password.value));password.value='';message('Account ready.');load();}catch(error){message(error.message);}});
  document.querySelector('#clubLogout').addEventListener('click',async()=>{try{await onlineClub.logout();message('Signed out.');}catch(error){message(error.message);}finally{renderProfile(null);}});
  if(configured)onlineClub.current().then(renderProfile).catch(error=>message(error.message));
  return {refresh:load,profile:()=>current,message};
}
