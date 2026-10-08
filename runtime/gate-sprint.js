export const GATE_SPRINT=Object.freeze({id:'citadel-gates-v1',start:.245,finish:.428,targetSeconds:30,
  turns:[.282,.329,.375],ramp:.40});
export function createSprint(){return {finished:false,elapsed:0,turns:0,collisions:0,drifts:0,boosts:0,cut:0,air:0,land:0,maxCombo:0};}
export function updateSprint(s,progress,time,events=[]){
 if(s.finished)return false;
 s.elapsed=time;s.turns=GATE_SPRINT.turns.filter(t=>progress>=t).length;
 for(const e of events){if(e.kind==='collision')s.collisions++;if(e.kind==='drift-release')s.drifts++;if(e.kind==='mini'){s.boosts++;s.maxCombo=Math.max(s.maxCombo,e.combo);if(e.type==='CUT BOOST')s.cut++;if(e.type==='AIR BOOST')s.air++;if(e.type==='LAND BOOST')s.land++;}}
 s.finished=progress>=GATE_SPRINT.finish;return s.finished;
}
export function sprintRecordKey(craft,assisted=false){return `apex-challenge-${GATE_SPRINT.id}-${craft}-${assisted?'assisted':'standard'}`;}
export function saveSprint(storage,key,s){
 if(!s.finished)return false;
 try{const old=JSON.parse(storage.getItem(key)||'null');if(!Number.isFinite(old?.elapsed)||s.elapsed<old.elapsed)storage.setItem(key,JSON.stringify({...s}));return true;}catch{return false;}
}
export function sprintInstruction(progress){
 if(progress<.267)return 'BUILD SPEED · SPACE + STEER TO DRIFT';
 if(progress<.288)return 'TURN 1 · COUNTERSTEER, RELEASE, THEN E';
 if(progress<.332)return 'TURN 2 · CHARGE A DRIFT';
 if(progress<.378)return 'TURN 3 · RELEASE, THEN E';
 if(progress<.407)return 'GOLD RAMP · PRESS E AFTER TAKE-OFF';
 return 'LAND · PRESS E, THEN FINISH';
}
