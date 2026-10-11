export const CAR_UNLOCKS=Object.freeze([{tier:'C',minutes:0},{tier:'C',minutes:0},{tier:'A',minutes:60},{tier:'B',minutes:30},{tier:'S',minutes:120},{tier:'B',minutes:15}]);
export const WEEKLY_TASKS=Object.freeze([
 {id:'warmup',title:'本周热身',metric:'week_seconds',target:600,points:20,reward:'ember',name:'熔金流线'},
 {id:'finisher',title:'完赛车手',metric:'week_races',target:3,points:30,reward:'circuit',name:'赛道格纹'},
 {id:'cruiser',title:'疾速巡航',metric:'week_seconds',target:1800,points:40,reward:'aurora',name:'极光脉冲'},
 {id:'champion',title:'每周挑战',metric:'week_seconds',target:3600,points:60,reward:'champion',name:'冠军之翼'}
]);
export function weekKey(now=Date.now()){const d=new Date(now+8*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function normalizeProgress(raw={},now=Date.now()){
 const number=x=>Math.max(0,Math.min(1e9,Math.floor(Number(x)||0)));const week=weekKey(now),same=raw.week===week;
 return {week,activity_points:number(raw.activity_points),total_seconds:number(raw.total_seconds),week_seconds:same?number(raw.week_seconds):0,week_races:same?number(raw.week_races):0,claimed:same&&Array.isArray(raw.claimed)?raw.claimed.filter(x=>WEEKLY_TASKS.some(t=>t.id===x)):[],liveries:Array.isArray(raw.liveries)?[...new Set(['solid','stripes',...raw.liveries.filter(x=>['solid','stripes','circuit','ember','aurora','champion'].includes(x))])]:['solid','stripes'],garage:raw.garage&&typeof raw.garage==='object'?raw.garage:{cars:{}}};
}
export function carUnlocked(state,index){return !!CAR_UNLOCKS[index]&&state.total_seconds>=CAR_UNLOCKS[index].minutes*60;}
export function taskReady(state,task){return !state.claimed.includes(task.id)&&state[task.metric]>=task.target;}

export function driverTitle(points){return points>=600?'传奇车手':points>=300?'精英车手':points>=100?'俱乐部车手':'新秀车手';}
