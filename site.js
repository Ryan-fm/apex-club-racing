import {getLanguage,setLanguage} from './localization.js';
import {onlineClub} from './online-club.js';
import {craftDefs} from './kart-catalog.js';

const page=document.body.dataset.page;
const local=(zh,en)=>getLanguage()==='zh'?zh:en;
const sceneNames={bay:['晴湾赛道','Bay Circuit'],citadel:['玉城古道','Jade Citadel'],harbor:['霓虹港湾','Neon Harbor']};
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
  let assisted=query.get('assisted')==='true';
  let records=[],requestId=0;
  const rows=document.querySelector('#globalRows'),empty=document.querySelector('#boardEmpty'),status=document.querySelector('#boardStatus');
  function renderBoard(){
    document.querySelectorAll('[data-scene]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===scene)));
    document.querySelectorAll('[data-assisted]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.assisted==='true')===assisted)));
    document.querySelector('#boardContext').textContent=`${sceneNames[scene][getLanguage()==='zh'?0:1]} / ${assisted?local('新手辅助','Assisted'):local('标准','Standard')}`;
    rows.replaceChildren();
    for(const [index,record] of records.entries()){
      const tr=document.createElement('tr');
      const minutes=Math.floor(record.time_ms/60000),seconds=((record.time_ms%60000)/1000).toFixed(2).padStart(5,'0');
      for(const value of [String(index+1).padStart(2,'0'),record.player_name,`${String(minutes).padStart(2,'0')}:${seconds}`,craftDefs[record.craft]?.name||`#${record.craft+1}`]){
        const cell=document.createElement('td');cell.textContent=value;tr.append(cell);
      }
      rows.append(tr);
    }
    empty.hidden=records.length>0;
  }
  async function load(){
    const id=++requestId;records=[];empty.hidden=true;rows.replaceChildren();status.textContent=local('正在读取全球成绩…','Loading global records…');
    try{const data=await onlineClub.leaderboard(scene,assisted);if(id!==requestId)return;records=data;status.textContent=data.length?local(`共 ${data.length} 条完赛成绩`,`Showing ${data.length} completed races`):'';renderBoard();}
    catch(error){if(id!==requestId)return;status.textContent=error.message;empty.hidden=false;}
  }
  function select(nextScene,nextAssisted){scene=nextScene;assisted=nextAssisted;history.replaceState(null,'',`?scene=${scene}&assisted=${assisted}`);renderBoard();load();}
  document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.scene,assisted)));
  document.querySelectorAll('[data-assisted]').forEach(button=>button.addEventListener('click',()=>select(scene,button.dataset.assisted==='true')));
  document.querySelector('#boardRefresh').addEventListener('click',load);
  renderPage=renderBoard;load();
}
if(page==='account'){
  const signedOut=document.querySelector('#accountSignedOut'),signedIn=document.querySelector('#accountSignedIn');
  const form=document.querySelector('#accountForm'),name=document.querySelector('#clubPlayerName'),password=document.querySelector('#clubPassword');
  const status=document.querySelector('#accountStatus'),submit=document.querySelector('#accountSubmit');
  let mode='login';
  const target=new URLSearchParams(location.search).get('return');
  const returnTo=['index.html','leaderboard.html','race.html','garage.html'].includes(target)?`./${target}`:'./leaderboard.html';
  function renderMode(){
    document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.mode===mode)));
    const heading=document.querySelector('#authHeading'),description=document.querySelector('#authDescription'),label=submit.querySelector('[data-zh]');
    heading.dataset.zh=mode==='login'?'欢迎回来':'加入 APEX CLUB';heading.dataset.en=mode==='login'?'Welcome back':'Join APEX CLUB';
    description.dataset.zh=mode==='login'?'登录后继续你的竞速纪录。':'注册一个独一无二的车手名。';description.dataset.en=mode==='login'?'Sign in to continue your racing record.':'Claim a unique name for your records.';
    label.dataset.zh=mode==='login'?'登录':'创建车手账户';label.dataset.en=mode==='login'?'Sign in':'Create driver account';
    for(const node of [heading,description,label])node.textContent=node.dataset[getLanguage()];
    password.autocomplete=mode==='login'?'current-password':'new-password';
  }
  function showProfile(profile){signedOut.hidden=!!profile;signedIn.hidden=!profile;if(profile)document.querySelector('#signedInName').textContent=profile.player_name;}
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;status.textContent='';renderMode();}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;status.textContent=local('正在连接车手账户…','Connecting your account…');
    try{await onlineClub[mode](name.value.trim(),password.value);password.value='';location.assign(returnTo);}
    catch(error){const messages={'Player name is already taken':['这个车手名已被使用。','This driver name is taken.'],'Invalid player name or password':['车手名或密码不正确。','Invalid name or password.'],'Too many attempts. Try again in 15 minutes.':['尝试次数过多，请 15 分钟后再试。','Too many attempts. Try again in 15 minutes.']};status.textContent=messages[error.message]?.[getLanguage()==='zh'?0:1]||error.message;submit.disabled=false;}
  });
  document.querySelector('#clubLogout').addEventListener('click',async()=>{try{await onlineClub.logout();showProfile(null);status.textContent=local('已退出登录。','Signed out.');}catch(error){status.textContent=error.message;}});
  renderPage=renderMode;
  if(onlineClub.signedIn())onlineClub.current().then(showProfile).catch(error=>{status.textContent=error.message;showProfile(null);});
}
renderLanguage();loadNavAccount();
