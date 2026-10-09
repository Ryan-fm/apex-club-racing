import {createToyClub,loadToySDK} from './toy-platform.js';
import {tr} from './localization.js';
// Load the bridge before gestures without requesting identity or making ranking calls.
loadToySDK().catch(()=>{});
export const onlineClub=createToyClub();
export function mountOnlineClub({onProfile}){
 let current=null;const notice=document.querySelector('#onlineNotice');
 const message=value=>{if(notice)notice.textContent=tr(value||'');};
 return {profile:()=>current,message,async connect(){current=await onlineClub.connect();onProfile(current);return current;}};
}
