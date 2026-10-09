import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {circuitPoints,roadHalfWidth} from '../track-layout.js';
import {craftDefs} from '../kart-catalog.js';
import {createStunts,boostOpportunity} from '../stunt-model.js';
import {stepPlayerSimulation} from '../runtime/player-simulation.js';
import {GATE_SPRINT,createSprint,updateSprint,sprintRecordKey,saveSprint} from '../runtime/gate-sprint.js';
import {createLapRecord,recordLap} from '../race-experience.js';
import {chaseHeading,createSuspension,stepSuspension} from '../runtime/race-presenter.js';
import {replay} from '../diagnostics/gate-replay.js';
const curve=new THREE.CatmullRomCurve3(circuitPoints('citadel').map(p=>new THREE.Vector3(...p)),true,'catmullrom',.35);
const track={samples:Array.from({length:1601},(_,i)=>{const p=curve.getPointAt(i/1600);return {x:p.x,z:p.z};}),halfWidth:t=>roadHalfWidth('citadel',t),ground:t=>curve.getPointAt(t).y};
function initial(t=.245){const p=curve.getPointAt(t),tan=curve.getTangentAt(t);return {x:p.x,z:p.z,heading:Math.atan2(tan.x,tan.z),t,speed:0,vx:0,vz:0,lane:0,laneVel:0,roadIndex:null,hit:0,hop:0,nitro:0,miniTurbo:0,boost:1/3,drift:{active:false,charge:0,direction:0}};}
function play(hz){
 const state=initial(),stunts=createStunts(),sprint=createSprint();let ticks=0,acc=0,events=[];
 for(let f=0;ticks<replay.frames.length;f++){
  acc+=1/hz;while(acc+1e-9>=replay.dt&&ticks<replay.frames.length){
   const v=replay.frames[ticks++];const r=stepPlayerSimulation(state,stunts,{rawSteer:v[0],driftSteer:v[0],throttle:true,brake:!!v[1],driftHeld:!!v[2],commands:{mini:!!v[3],nitro:!!v[4]}},craftDefs[4],track,replay.dt);
   acc-=replay.dt;events.push(...r.events);updateSprint(sprint,state.t,ticks*replay.dt,r.events);
  }
 }
 return {state,sprint,events};
}
test('recorded three-turn inputs retain drift boosts without takeoff at 30/60/120 display Hz',()=>{
 const runs=[30,60,120].map(play);
 for(const {state,sprint,events} of runs){assert(state.t>.42);assert.equal(sprint.collisions,0);assert.equal(sprint.drifts,3);assert.equal(sprint.boosts,3);assert.equal(sprint.air,0);assert.equal(sprint.land,0);assert(sprint.cut>=1);assert.equal(sprint.maxCombo,1);assert(events.some(e=>e.kind==='mini'&&e.type==='EXIT BOOST'));assert(!events.some(e=>e.kind==='takeoff'||e.kind==='land'));
  assert(sprint.finished);assert(state.t>=GATE_SPRINT.finish);}

 assert.equal(runs[0].state.x,runs[2].state.x);assert.equal(runs[0].state.z,runs[1].state.z);
});
test('four consecutive replays produce twelve successful drifts with no stale windows',()=>{
 let drifts=0;for(let i=0;i<4;i++){const r=play(60);drifts+=r.sprint.drifts;assert.equal(r.sprint.air,0);assert.equal(r.sprint.land,0);assert.equal(r.sprint.collisions,0);}assert.equal(drifts,12);
});
test('incomplete first lap is invalid and challenge writes never touch race or medal keys',()=>{
 const lap=createLapRecord(),pose={x:0,y:0,z:0,heading:0};recordLap(lap,.245,0,pose);assert.equal(recordLap(lap,1,20,pose).valid,false);
 const store=new Map([['apex-best-v2-citadel-4-standard','original'],['apex-medal','3']]);const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const key=sprintRecordKey(4);assert(key.startsWith('apex-challenge-'));assert(saveSprint(storage,key,{finished:true,elapsed:30}));saveSprint(storage,key,{finished:true,elapsed:40});assert.equal(JSON.parse(store.get(key)).elapsed,30);
 assert.equal(store.get('apex-best-v2-citadel-4-standard'),'original');assert.equal(store.get('apex-medal'),'3');assert.equal(saveSprint(storage,key,{finished:false,elapsed:1}),false);
});
const straight={samples:[{x:0,z:-10000},{x:0,z:10000}],halfWidth:()=>38,ground:()=>0};
test('boost presses cannot repeat across physics substeps, and a real landing accepts 100ms anticipation',()=>{
 const state={...initial(),x:0,z:0,heading:0,speed:250,t:.5,vx:0,vz:130},stunts=createStunts();
 const input={rawSteer:0,throttle:true,brake:false,driftHeld:false,commands:{nitro:true}};
 let r=stepPlayerSimulation(state,stunts,input,craftDefs[4],straight,1/120);assert.equal(r.events.filter(e=>e.kind==='nitro').length,1);assert(state.boost<.001);
 input.commands={};r=stepPlayerSimulation(state,stunts,input,craftDefs[4],straight,1/120);assert.equal(r.events.length,0);
 Object.assign(stunts,{airborne:true,y:.02,vy:-10,airWindow:0,lastRamp:0});input.commands={mini:true};r=stepPlayerSimulation(state,stunts,input,craftDefs[4],straight,1/120);
 assert.equal(r.events.filter(e=>e.kind==='mini'&&e.type==='LAND BOOST').length,1);input.commands={};r=stepPlayerSimulation(state,stunts,input,craftDefs[4],straight,1/120);assert.equal(r.events.filter(e=>e.kind==='mini').length,0);
});
test('collision cancels pending sprays; holding brake reverses and throttle steering escapes',()=>{
 for(const hz of [30,60,120]){
  const state={...initial(),x:33,z:0,heading:Math.PI/2,speed:100,vx:52,vz:0,t:.5},stunts=createStunts();
  Object.assign(stunts,{driftWindow:.5,driftPower:1.5,kind:'CUT BOOST'});state.drift={active:true,charge:.8,direction:1};
  stepPlayerSimulation(state,stunts,{rawSteer:0,throttle:true,driftHeld:true,commands:{}},craftDefs[4],straight,1/hz);assert.equal(boostOpportunity(stunts),'');assert.equal(state.drift.charge,0);
  for(let i=0;i<hz;i++)stepPlayerSimulation(state,stunts,{rawSteer:0,throttle:true,brake:true,driftHeld:false,commands:{}},craftDefs[4],straight,1/hz);
  assert(state.speed<0);assert(state.x<25);
  Object.assign(state,{x:32,speed:0,vx:0,vz:0,heading:Math.PI/2,wallContact:.2});
  for(let i=0;i<hz*4;i++)stepPlayerSimulation(state,stunts,{rawSteer:Math.sin(state.heading)>-.15?1:0,throttle:true,brake:false,driftHeld:false,commands:{}},craftDefs[4],straight,1/hz);
  assert(state.x<25);assert(state.speed>100);
 }
});
test('camera smooths across angle wrap with bounded lag and reduced-motion suspension stays still',()=>{
 const h=chaseHeading(3.1,-3.1,1/60);assert(Math.abs(Math.atan2(Math.sin(h+3.1),Math.cos(h+3.1)))<=.1);
 assert.equal(chaseHeading(0,2,.01,true),2);
 const s=createSuspension();stepSuspension(s,true,.016);assert(stepSuspension(s,false,.016)<0);for(let i=0;i<240;i++)stepSuspension(s,false,1/120);assert(Math.abs(s.offset)<.001);assert.equal(stepSuspension(s,true,.1,true),0);
});

test('former ramp sections keep the player grounded without air or landing rewards',()=>{
 for(const start of [.08,.40,.70]){
  const state=initial(start),stunts=createStunts();state.speed=300;
  for(let i=0;i<180;i++){
   const ahead=curve.getPointAt(state.t+.008),angle=Math.atan2(ahead.x-state.x,ahead.z-state.z),error=Math.atan2(Math.sin(angle-state.heading),Math.cos(angle-state.heading));
   const r=stepPlayerSimulation(state,stunts,{rawSteer:Math.max(-1,Math.min(1,-error*2.6)),throttle:true,brake:state.speed>300,driftHeld:false,commands:{mini:true}},craftDefs[4],track,1/120);
   assert(!stunts.airborne);assert(Math.abs(stunts.y-track.ground(state.t))<1e-9);assert(!r.events.some(e=>['takeoff','land','mini'].includes(e.kind)));
  }
  assert(state.t>start+.007);
 }
});
