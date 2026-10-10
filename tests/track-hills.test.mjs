import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiplayerTrack,spawnPlayer,idleInput} from '../multiplayer/simulation.js';
import {circuitPoints} from '../track-layout.js';
import {stepPlayerSimulation} from '../runtime/player-simulation.js';
import {craftDefs} from '../kart-catalog.js';

for(const scene of ['bay','citadel','harbor','canyon'])test(`${scene}: hills have continuous ground, usable climbs and descents, and a bounded grade`,()=>{
 assert.notDeepEqual(circuitPoints(scene),circuitPoints(scene,{classic:true}));
 const track=multiplayerTrack(scene),curve=track.curve;
 assert(curve.getPointAt(0).distanceTo(curve.getPointAt(1))<1e-6);
 assert(curve.getTangentAt(0).distanceTo(curve.getTangentAt(1))<.01);
 let climb=0,descent=0;
 for(let i=0;i<1600;i++){
  const a=curve.getPointAt(i/1600),b=curve.getPointAt((i+1)/1600),grade=(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z);
  assert(Math.abs(grade)<.25,`unsafe grade ${grade}`);
  if(grade>.04)climb++;if(grade<-.04)descent++;
  const {state,stunts}=spawnPlayer(scene,0);Object.assign(state,{x:a.x,z:a.z,t:i/1600,roadIndex:i,heading:Math.atan2(b.x-a.x,b.z-a.z),speed:150});
  const result=stepPlayerSimulation(state,stunts,{...idleInput(),throttle:true},craftDefs[1],track,1/60);
  assert(!stunts.airborne&&!result.events.some(e=>['takeoff','land'].includes(e.kind)));
  assert(Number.isFinite(stunts.y));
 }
 assert(climb>200&&descent>200,'each course needs substantial climb and descent sections');
});
test('hill handling changes speed without steering or preventing braking',()=>{
 const simulate=(grade,brake=false)=>{
  const samples=Array.from({length:2001},(_,i)=>({x:0,y:100+i*grade,z:i}));
  const track={samples,halfWidth:()=>38,ground:t=>100+t*2000*grade};
  const {state,stunts}=spawnPlayer('bay',0);Object.assign(state,{x:0,z:1000,t:.5,roadIndex:1000,heading:0,speed:craftDefs[1].max,vx:0,vz:craftDefs[1].max*.52,lane:0});
  for(let i=0;i<60;i++)stepPlayerSimulation(state,stunts,{...idleInput(),throttle:true,brake},craftDefs[1],track,1/60);
  assert.equal(state.heading,0);assert(!stunts.airborne);assert.equal(state.nitro,0);
  return state.speed;
 };
 const flat=simulate(0),up=simulate(.15),down=simulate(-.15);
 assert(up<flat-15);assert(down>flat+15);
 assert(simulate(-.15,true)<flat*.15,'brake must override downhill acceleration');
});
