// Local driving challenges never change vehicle handling or online race scores.
export const CHALLENGES=[
 {id:'flow',name:['漂移节奏','DRIFT FLOW'],description:['6 次蓄力漂移 · 4 次小喷 · 连段达到 3','6 charged drifts · 4 mini boosts · Chain 3']},
 {id:'explorer',name:['路线探索','ROUTE EXPLORER'],description:['进入 2 条不同近道、2 条不同快速路 · 3 次氮气','Find 2 different cuts and 2 express lanes · 3 nitros']},
 {id:'precision',name:['精准冲线','CLEAN PODIUM'],description:['碰撞不超过 2 次，完赛进入前三','Finish in the top 3 with at most 2 collisions']},
];
export const CAREER_TIERS=[{xp:0,name:['俱乐部新秀','CLUB ROOKIE']},{xp:150,name:['弯道猎手','CORNER HUNTER']},{xp:450,name:['赛道专家','CIRCUIT ACE']},{xp:1000,name:['巅峰车手','APEX LEGEND']}];
export function careerProfile(value){
 const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
 return {xp:integer(value?.xp,10000000),finishes:integer(value?.finishes,100000),contracts:integer(value?.contracts,100000),bestChain:integer(value?.bestChain,6)};
}
export function careerTier(profile){return CAREER_TIERS.findLast(t=>profile.xp>=t.xp)||CAREER_TIERS[0];}
export function createChallenge(id='flow'){return {id:CHALLENGES.some(c=>c.id===id)?id:'flow',drifts:0,minis:0,nitros:0,cuts:new Set(),express:new Set(),chain:0,bestChain:0,chainTime:0,lastKind:null,collisions:0,settled:false};}
export function stepChallenge(s,{events=[],routeId=null,collisions=0},dt){
 if(s.settled)return;
 s.chainTime=Math.max(0,s.chainTime-Math.max(0,dt));
 if(s.chainTime===0){s.chain=0;s.lastKind=null;}
 const hit=events.some(e=>e.kind==='collision');
 for(const e of events){
  if(e.kind==='route-enter'&&routeId&&['shortcut','express'].includes(e.route))(e.route==='shortcut'?s.cuts:s.express).add(routeId);
  if(e.kind==='drift-release')s.drifts++;
  if(e.kind==='mini')s.minis++;
  if(e.kind==='nitro')s.nitros++;
  if(!hit&&['drift-release','mini','nitro'].includes(e.kind)){
   // Alternating real actions build a chain; repeating one action cannot farm it.
   if(e.kind!==s.lastKind){s.chain=Math.min(6,s.chain+1);s.bestChain=Math.max(s.bestChain,s.chain);}
   s.lastKind=e.kind;s.chainTime=6;
  }
 }
 if(hit||collisions>s.collisions){s.chain=0;s.chainTime=0;s.lastKind=null;}
 s.collisions=collisions;
}
export function challengeGoals(s,{collisions=0,rank=8}={}){
 if(s.id==='explorer')return [[s.cuts.size,2],[s.express.size,2],[s.nitros,3]];
 if(s.id==='precision')return [[Math.max(0,2-collisions),2],[rank,3]];
 return [[s.drifts,6],[s.minis,4],[s.bestChain,3]];
}
export function challengeComplete(s,{collisions=0,rank=8}={}){
 return s.id==='precision'?collisions<=2&&rank<=3:challengeGoals(s).every(([n,target])=>n>=target);
}
export function settleChallenge(s,profile,{finished=false,valid=false,collisions=0,rank=8}={}){
 if(s.settled)return null;s.settled=true;
 const previous=careerProfile(profile);
 if(!finished||!valid)return {profile:previous,xp:0,completed:false,promoted:false};
 const completed=challengeComplete(s,{collisions,rank});
 const xp=40+(completed?60:0)+(rank<=3?20:0)+Math.min(30,s.bestChain*5);
 const next={xp:Math.min(10000000,previous.xp+xp),finishes:previous.finishes+1,contracts:previous.contracts+Number(completed),bestChain:Math.max(previous.bestChain,s.bestChain)};
 return {profile:next,xp,completed,promoted:careerTier(previous)!==careerTier(next)};
}
