import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiplayerTrack,spawnPlayer,stepRoomPlayer,idleInput,recoverRoomPlayer} from '../multiplayer/simulation.js';
import {projectRoad} from '../track-routes.js';
import {projectTrack} from '../driving-model.js';

for(const scene of ['bay','citadel','harbor']){
 test(`${scene}: two shorter cuts and two express roads connect without crossing unrelated roads`,()=>{
  const track=multiplayerTrack(scene);
  assert.equal(track.routes.filter(r=>r.kind==='shortcut').length,2);
  assert.equal(track.routes.filter(r=>r.kind==='express').length,2);
  for(const r of track.routes){
   assert(r.start>0&&r.end<1);
   for(const [sample,t]of [[r.samples[0],r.start],[r.samples.at(-1),r.end]]){
    const p=track.curve.getPointAt(t);assert(Math.hypot(sample.x-p.x,sample.z-p.z)<.001);
   }
   if(r.kind==='shortcut')assert(r.length<track.curve.getLength()*(r.end-r.start));
   for(let i=1;i<120;i++){
    const p=r.samples[i],a=r.samples[i-1],b=r.samples[i+1];
    assert(Math.abs(b.y-p.y)/Math.hypot(b.x-p.x,b.z-p.z)<.25);
    const h1=Math.atan2(p.x-a.x,p.z-a.z),h2=Math.atan2(b.x-p.x,b.z-p.z),turn=Math.abs(Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1)));
    assert(Math.hypot(b.x-p.x,b.z-p.z)/Math.max(turn,1e-6)>25);
    const main=projectTrack(p.x,p.z,track.samples);
    if(Math.abs(main.t-p.t)>.03)assert(Math.sqrt(main.d2)>90);
   }
  }
 });
 test(`${scene}: server physics can drive all four branches and merge with continuous lap progress`,()=>{
  const track=multiplayerTrack(scene);
  for(const route of track.routes){
   const player={...spawnPlayer(scene,0),craft:1},a=route.samples[0],b=route.samples[1];
   Object.assign(player.state,{x:a.x,z:a.z,t:route.start,heading:Math.atan2(b.x-a.x,b.z-a.z),roadIndex:null,speed:140});player.racer.progress=route.start;
   const race={elapsed:0,firstFinish:null};let walls=0,steps=0,sawBranch=false,sawBoost=false;
   // Test-only driving controller: production never steers toward road geometry.
   for(;steps<2400;steps++){
    const s=player.state,u=projectTrack(s.x,s.z,route.samples).t;
    const p=u>.985?track.curve.getPointAt(route.end+.004):route.samples[Math.min(120,Math.floor(u*120)+5)];
    const aim=Math.atan2(p.x-s.x,p.z-s.z),error=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading));
    race.elapsed+=1/60;
    const result=stepRoomPlayer(player,{...idleInput(),rawSteer:Math.max(-1,Math.min(1,-error*2.5)),throttle:true,brake:Math.abs(error)>.45&&s.speed>150},race,track);
    assert(!result.events.some(e=>e.kind==='takeoff'),'ground roads must not invent a jump');
    walls+=Number(result.wallHit);sawBranch||=s.routeId===route.id;sawBoost||=s.surfaceBoost;
    assert(result.delta>-.001&&result.delta<.004,'branch must not jump or reverse lap progress');
    if(s.t>route.end+.001)break;
   }
   assert(steps<2400,`${route.id} did not merge back`);
   assert(sawBranch,`${route.id} never became drivable`);
   assert(walls<20&&walls/(steps+1)<.06,`${route.id} trapped at a wall`);
   assert.equal(sawBoost,route.kind==='express');
   assert(Math.abs(player.racer.progress-player.state.t)<.001);
  }
 });
}
test('express strips accelerate without consuming nitro, brake still overrides and recovery clears branch state',()=>{
 const track=multiplayerTrack('bay'),r=track.routes.find(r=>r.kind==='express'),p=r.samples[60],n=r.samples[61],heading=Math.atan2(n.x-p.x,n.z-p.z);
 const create=()=>{const player={...spawnPlayer('bay',0),craft:1};Object.assign(player.state,{x:p.x,z:p.z,t:p.t,heading,speed:200,roadIndex:null});player.racer.progress=p.t;return player;};
 const boosted=create(),normal=create(),braking=create(),plain={...track,routes:[]};
 // Compare handling at the same real express-road point without changing geometry.
 const noStrip={...track,routes:track.routes.map(route=>({...route,kind:'shortcut'}))};
 for(let i=0;i<12;i++){
  stepRoomPlayer(boosted,{...idleInput(),throttle:true},{elapsed:i/60,firstFinish:null},track);
  stepRoomPlayer(normal,{...idleInput(),throttle:true},{elapsed:i/60,firstFinish:null},noStrip);
  stepRoomPlayer(braking,{...idleInput(),throttle:true,brake:true},{elapsed:i/60,firstFinish:null},track);
 }
 assert(boosted.state.speed>normal.state.speed+10);assert(braking.state.speed<150);
 assert.equal(boosted.state.boost,1/3);assert.equal(boosted.state.nitro,0);
 assert.equal(projectRoad(boosted.state,track).surfaceBoost,true);
 recoverRoomPlayer(boosted,track);assert.equal(boosted.state.routeId,null);assert.equal(boosted.state.surfaceBoost,false);
 assert.equal(projectRoad(boosted.state,plain).routeId,null);
});

test('prediction reconciles an express-road state with server physics',async()=>{
 const {RoomPrediction}=await import('../multiplayer/prediction.js');
 const track=multiplayerTrack('citadel'),r=track.routes.find(r=>r.kind==='express'),p=r.samples[45],n=r.samples[46];
 const server={...spawnPlayer('citadel',0),craft:1};Object.assign(server.state,{x:p.x,z:p.z,t:p.t,heading:Math.atan2(n.x-p.x,n.z-p.z),speed:180,roadIndex:null});server.racer.progress=p.t;
 const client=structuredClone(server),prediction=new RoomPrediction(client,track),race={elapsed:0,firstFinish:null};
 const input={...idleInput(),throttle:true,rawSteer:.02};
 let snapshot;
 for(let i=0;i<8;i++){
  race.elapsed+=1/60;prediction.predict(input,{...race});stepRoomPlayer(server,input,{...race},track);
  if(i===3)snapshot=structuredClone({...server,ack:4});
 }
 prediction.reconcile(snapshot,{phase:'racing',elapsed:4/60,firstFinish:null});
 for(const key of ['x','z','speed','t'])assert(Math.abs(client.state[key]-server.state[key])<1e-8);
 assert.equal(client.state.routeId,server.state.routeId);assert.equal(client.state.surfaceBoost,server.state.surfaceBoost);
});
