import {getLanguage,setLanguage} from './localization.js';
import {onlineClub} from './online-club.js';

const page=document.body.dataset.page;
const local=(zh,en)=>getLanguage()==='zh'?zh:en;
const sceneNames={bay:['晴湾赛道','Bay Circuit'],citadel:['玉城古道','Jade Citadel'],harbor:['霓虹港湾','Neon Harbor'],canyon:['赤岩峡谷','Redrock Canyon']};
let renderPage=()=>{};
let renderHeroToggle=()=>{};
function renderLanguage(){
  document.documentElement.lang=getLanguage()==='zh'?'zh-CN':'en';
  document.querySelectorAll('[data-zh][data-en]').forEach(node=>{node.textContent=node.dataset[getLanguage()];});
  document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===getLanguage())));
  renderPage();
  renderHeroToggle();
}
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{setLanguage(button.dataset.language);renderLanguage();}));
addEventListener('storage',event=>{if(event.key==='apex-language'||event.key===null){setLanguage(event.newValue,{persist:false});renderLanguage();}});

async function loadNavAccount(){
  const nav=document.querySelector('#accountNav');if(!nav||!onlineClub.signedIn())return;
  try{const profile=await onlineClub.current();if(profile){nav.textContent=profile.player_name;nav.removeAttribute('data-zh');nav.removeAttribute('data-en');}}catch{}
}

if(page==='home'){
  const video=document.querySelector('#homePromo');
  const toggle=document.querySelector('#heroMotionToggle');
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let ready=false;
  renderHeroToggle=()=>{
    const playing=ready&&!video.paused;
    const label=toggle.querySelector('[data-zh]');
    label.dataset.zh=playing?'暂停动效':'播放动效';
    label.dataset.en=playing?'Pause motion':'Play motion';
    label.textContent=local(label.dataset.zh,label.dataset.en);
    toggle.querySelector('[aria-hidden]').className=playing?'motion-icon is-paused':'motion-icon is-playing';
    toggle.querySelector('[aria-hidden]').textContent='';
  };
  const stop=()=>{video.pause();video.hidden=true;toggle.hidden=true;};
  const portraitPromo=matchMedia('(max-width: 600px) and (orientation: portrait)');
  const loadPromo=()=>{if(!video.src){video.src=portraitPromo.matches?'./assets/home-promo-vertical.mp4':'./assets/home-promo.mp4';video.preload='metadata';}};
  portraitPromo.addEventListener('change',()=>{if(reduceMotion.matches||navigator.connection?.saveData)return;ready=false;video.hidden=true;video.removeAttribute('src');loadPromo();});
  video.addEventListener('loadeddata',()=>{ready=true;if(reduceMotion.matches||navigator.connection?.saveData)return;video.hidden=false;toggle.hidden=false;video.play().catch(stop);});
  video.addEventListener('play',renderHeroToggle);
  video.addEventListener('pause',renderHeroToggle);
  video.addEventListener('error',stop);
  if(!reduceMotion.matches&&!navigator.connection?.saveData)loadPromo();
  toggle.addEventListener('click',()=>{if(video.paused)video.play().catch(stop);else video.pause();});
  reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches)stop();else if(!navigator.connection?.saveData){if(ready){video.hidden=false;toggle.hidden=false;video.play().catch(stop);}else loadPromo();}});
}

if(page==='leaderboard'){
  const query=new URLSearchParams(location.search);
  let scene=sceneNames[query.get('scene')]?query.get('scene'):'harbor';
  let assisted=false;
  let records=[],requestId=0;
  let period='all';
  const rows=document.querySelector('#globalRows'),empty=document.querySelector('#boardEmpty'),status=document.querySelector('#boardStatus');
  function renderBoard(){
    document.querySelectorAll('[data-scene]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===scene)));
    document.querySelectorAll('[data-assisted]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.assisted==='true')===assisted)));
    document.querySelector('#boardContext').textContent=`${sceneNames[scene][getLanguage()==='zh'?0:1]} / ${assisted?local('新手辅助','Assisted'):local('标准','Standard')} / ${period}`;
    rows.replaceChildren();
    for(const [index,record] of records.entries()){
      const tr=document.createElement('tr');
      const minutes=Math.floor(record.time_ms/60000),seconds=((record.time_ms%60000)/1000).toFixed(2).padStart(5,'0');
      for(const value of [String(record.rank??index+1).padStart(2,'0'),record.player_name,`${String(minutes).padStart(2,'0')}:${seconds}`,local('标准三圈','Standard / 3 laps')]){
        const cell=document.createElement('td');cell.textContent=value;tr.append(cell);
      }
      rows.append(tr);
    }
    empty.hidden=records.length>0;
  }
  async function load(refresh=false){
    const id=++requestId;records=[];empty.hidden=true;rows.replaceChildren();status.textContent=local('正在读取全球成绩…','Loading global records…');
    try{const data=await onlineClub.leaderboard(scene,assisted,{refresh,period});if(id!==requestId)return;records=data;status.textContent=data.length?local(`共 ${data.length} 条完赛成绩`,`Showing ${data.length} completed races`):'';renderBoard();}
    catch(error){if(id!==requestId)return;status.textContent=error.message;empty.hidden=true;}
  }
  function select(nextScene,nextAssisted){scene=nextScene;assisted=nextAssisted;history.replaceState(null,'',`?scene=${scene}&assisted=${assisted}`);renderBoard();load();}
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.scene,assisted)));
  document.querySelectorAll('[data-assisted]').forEach(button=>button.addEventListener('click',()=>select(scene,button.dataset.assisted==='true')));
  document.querySelector('#boardRefresh').addEventListener('click',()=>load(true));
  document.querySelector('#boardMine').addEventListener('click',async event=>{const id=requestId;event.currentTarget.disabled=true;try{const mine=await onlineClub.myRank(scene,period);if(id===requestId)status.textContent=mine?local(`我的排名：第 ${mine.rank} 名 · ${(mine.time_ms/1000).toFixed(3)} 秒`,`My rank: ${mine.rank} · ${(mine.time_ms/1000).toFixed(3)} s`):local('当前榜单暂无你的成绩。','You have no result on this board.');}catch(error){if(id===requestId)status.textContent=error.message;}finally{document.querySelector('#boardMine').disabled=false;}});
  document.querySelector('#boardPeriod').addEventListener('change',event=>{period=event.target.value;renderBoard();load();});
  renderPage=renderBoard;load();
}
if(page==='account'){
 const button=document.querySelector('#toyConnect'),status=document.querySelector('#accountStatus');
 button.addEventListener('click',async()=>{button.disabled=true;try{const profile=await onlineClub.connect();status.textContent=local(`已连接：${profile.player_name}。完赛后点击提交成绩参与排名。`,`Connected: ${profile.player_name}. Submit your score after finishing.`);}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
}
renderLanguage();loadNavAccount();
