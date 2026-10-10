import {CHALLENGES,CAREER_TIERS,careerProfile,careerTier,createChallenge,stepChallenge,challengeGoals,settleChallenge} from './race-challenges.js';
import {getLanguage,onLanguageChange} from './localization.js';
export function createChallengeUI({enabled=true}={}){
 const local=a=>a[getLanguage()==='zh'?0:1];
 let profile=careerProfile(),selected='flow',run=null;
 try{profile=careerProfile(JSON.parse(localStorage.getItem('apex-career-v1')));selected=localStorage.getItem('apex-challenge')||'flow';}catch{}
 selected=createChallenge(selected).id;
 const button=document.createElement('button');button.id='challengeSelect';button.type='button';button.hidden=!enabled;document.querySelector('.launch-dock').before(button);
 const dialog=document.createElement('dialog');dialog.id='challengeDialog';dialog.dataset.noTranslate='';dialog.setAttribute('aria-labelledby','challengeTitle');
 dialog.innerHTML='<header><div><small>APEX / DRIVER CAREER</small><h2 id="challengeTitle"></h2></div><button type="button" class="challenge-close"></button></header><section class="career-summary"><b></b><span></span><progress></progress><small></small></section><div class="challenge-options"></div><p class="challenge-rules"></p>';
 document.body.append(dialog);
 const hud=document.createElement('aside');hud.id='challengeHUD';hud.hidden=true;hud.dataset.noTranslate='';hud.innerHTML='<div class="challenge-live"><b></b><span></span></div><div class="chain-live"><strong></strong><span></span><progress max="6"></progress></div>';document.querySelector('.race-ui').append(hud);
 const result=document.createElement('div');result.id='careerResult';result.dataset.noTranslate='';document.querySelector('#challengeResult').after(result);
 const write=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
 let metrics={collisions:0,rank:8},lastReward=null,lastDraw=-Infinity;
 function render(){
  if(profile.xp>0)document.querySelector('#profileMedal').textContent=local(careerTier(profile).name);
  const definition=CHALLENGES.find(c=>c.id===selected),tier=careerTier(profile),next=CAREER_TIERS.find(t=>t.xp>profile.xp);
  button.textContent=local(['挑战：','Challenge: '])+local(definition.name);
  dialog.querySelector('h2').textContent=local(['选择本场挑战','Choose your challenge']);dialog.querySelector('.challenge-close').textContent=local(['完成','Done']);
  const summary=dialog.querySelector('.career-summary');summary.querySelector('b').textContent=local(tier.name);summary.querySelector('span').textContent=`${profile.xp} XP · ${profile.finishes} ${local(['次完赛','finishes'])}`;
  const bar=summary.querySelector('progress');bar.max=next?next.xp-tier.xp:1;bar.value=next?profile.xp-tier.xp:1;
  summary.querySelector('small').textContent=next?`${local(['下个称号','Next title'])} · ${local(next.name)} · ${next.xp-profile.xp} XP`:local(['已解锁所有称号','All titles unlocked']);
  const options=dialog.querySelector('.challenge-options');options.replaceChildren();
  for(const c of CHALLENGES){const item=document.createElement('button');item.type='button';item.setAttribute('aria-pressed',String(c.id===selected));item.innerHTML='<small></small><strong></strong><span></span><b>+60 XP</b>';item.querySelector('small').textContent=`0${CHALLENGES.indexOf(c)+1} / CONTRACT`;item.querySelector('strong').textContent=local(c.name);item.querySelector('span').textContent=local(c.description);item.onclick=()=>{selected=c.id;try{localStorage.setItem('apex-challenge',selected);}catch{}render();};options.append(item);}
  dialog.querySelector('.challenge-rules').textContent=local(['本机生涯 · 普通 AI 比赛有效完赛自动结算。教学、练习和好友房不计入。完赛 +40 XP，挑战 +60 XP，前三 +20 XP，连段最高 +30 XP。','Local career · Automatically settled after valid AI races. Lessons, practice and friend rooms are excluded. Finish +40 XP, contract +60 XP, podium +20 XP, chain up to +30 XP.']);
  draw(true);renderReward();
 }
 function draw(force=false){
  if(!run||hud.hidden)return;
  const now=performance.now();if(!force&&now-lastDraw<100)return;lastDraw=now;
  write(hud.querySelector('.challenge-live b'),local(CHALLENGES.find(c=>c.id===run.id).name));
  const goals=challengeGoals(run,metrics);
  const labels=run.id==='flow'?local([['漂移','小喷','连段'],['Drift','Mini','Chain']]):local([['近道','快速路','氮气'],['Cuts','Express','Nitro']]);
  write(hud.querySelector('.challenge-live span'),run.id==='precision'?`${local(['碰撞','Hits'])} ${metrics.collisions}/2 · P${metrics.rank} / TOP 3`:goals.map(([n,target],i)=>`${labels[i]} ${Math.min(n,target)}/${target}`).join(' · '));
  write(hud.querySelector('.chain-live strong'),run.chain?`CHAIN ×${run.chain}`:local(['连段待命','CHAIN READY']));write(hud.querySelector('.chain-live span'),run.chain?`${run.chainTime.toFixed(1)}s · ${local(['切换漂移 / 小喷 / 氮气续接','Alternate drift / mini / nitro'])}`:local(['漂移 → 小喷 → 氮气','Drift → Mini → Nitro']));
  const bar=hud.querySelector('.chain-live progress');if(bar.value!==run.chainTime)bar.value=run.chainTime;
 }
 function renderReward(){
  if(!lastReward){result.hidden=true;return;}result.hidden=false;
  result.textContent=lastReward.xp?`${local(['生涯','CAREER'])} +${lastReward.xp} XP · ${local(lastReward.completed?['挑战完成','CONTRACT COMPLETE']:['完赛奖励','FINISH REWARD'])} · ${local(careerTier(profile).name)}${lastReward.promoted?' · '+local(['新称号解锁','NEW TITLE']):''}`:local(['本场未获得生涯奖励：需要有效完成普通三圈比赛。','No career reward: complete a valid standard three-lap AI race.']);
 }
 button.onclick=()=>{render();dialog.showModal();};dialog.querySelector('.challenge-close').onclick=()=>dialog.close();
 onLanguageChange(render);render();
 return {title:()=>profile.xp?local(careerTier(profile).name):null,reset(){run=createChallenge(selected);metrics={collisions:0,rank:8};lastReward=null;result.hidden=true;hud.hidden=true;},step({events,routeId,collisions,rank,dt}){if(!run)return;hud.hidden=false;metrics={collisions,rank};stepChallenge(run,{events,routeId,collisions},dt);draw();},finish(options){if(!run)return;lastReward=settleChallenge(run,profile,options);if(lastReward){profile=lastReward.profile;try{localStorage.setItem('apex-career-v1',JSON.stringify(profile));}catch{}renderReward();}hud.hidden=true;},hide(){hud.hidden=true;result.hidden=true;}};
}
