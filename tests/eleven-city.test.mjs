import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiplayerTrack,spawnPlayer,stepRoomPlayer,idleInput} from '../multiplayer/simulation.js';
import {RoomService} from '../server/rooms.js';
import {projectTrack,progressDelta} from '../driving-model.js';

test('Eleven City stays grounded, closes smoothly and separates adjacent finger streets',()=>{
 const track=multiplayerTrack('eleven'),n=1600;
 assert.equal(track.routes.length,4);assert(track.routes.every(r=>r.kind==='shortcut'&&r.savedDistance>35));
 assert(track.curve.getPointAt(0).distanceTo(track.curve.getPointAt(1))<1e-8);
 let minGap=Infinity,minRadius=Infinity;
 const points=Array.from({length:n},(_,i)=>track.curve.getPointAt(i/n));
 for(let i=0;i<n;i++){
  const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],u=b.clone().sub(a),v=c.clone().sub(b);assert.equal(b.y,10);
  minRadius=Math.min(minRadius,u.length()/Math.max(u.angleTo(v),1e-8));
  for(let j=i+1;j<n;j++){if(Math.min(j-i,n-j+i)*track.curve.getLength()/n<250)continue;minGap=Math.min(minGap,b.distanceTo(points[j]));}
 }
 assert(minRadius>65,`unsafe inner radius ${minRadius}`);assert(minGap>175,`overlapping city streets ${minGap}`);
});

test('the shared city simulation can drive one complete lap and every street-corner cut',()=>{
 const track=multiplayerTrack('eleven');
 for(const route of [null,...track.routes]){
  const player={...spawnPlayer('eleven',0),craft:1},start=route?.start??0,a=route?.samples[0]??track.curve.getPointAt(0),b=route?.samples[1]??track.curve.getPointAt(.001);
  Object.assign(player.state,{x:a.x,z:a.z,t:start,heading:Math.atan2(b.x-a.x,b.z-a.z),roadIndex:null,lane:0,speed:140});player.racer.progress=start;
  const race={elapsed:0,firstFinish:null};let steps=0,walls=0,branch=false;
  for(;steps<12000;steps++){
   const s=player.state,u=route?projectTrack(s.x,s.z,route.samples).t:0;
   const p=route?(u>.985?track.curve.getPointAt(route.end+.004):route.samples[Math.min(120,Math.floor(u*120)+5)]):track.curve.getPointAt((s.t+.005)%1);
   const aim=Math.atan2(p.x-s.x,p.z-s.z),error=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading));
   race.elapsed+=1/60;const result=stepRoomPlayer(player,{...idleInput(),rawSteer:Math.max(-1,Math.min(1,-error*2.5)),throttle:true,brake:(Math.abs(error)>.42&&s.speed>155)||(!route&&s.speed>350)},race,track);
   assert(!player.stunts.airborne);assert(!s.surfaceBoost);assert(Math.abs(result.delta)<.004);walls+=Number(result.wallHit);branch||=!!s.routeId;
   if(route?s.t>route.end+.001:player.racer.progress>=1)break;
  }
  assert(steps<12000,`${route?.id??'main'} did not finish`);assert(walls/(steps+1)<.08,`${route?.id??'main'} has persistent wall contact`);if(route)assert(branch);
 }
});

test('four-player city rooms enforce the same server seat limit and shared route state',()=>{
 const rooms=new RoomService({now:()=>0}),connections=[];let code;
 for(let i=0;i<4;i++){
  const c={send(){}};rooms.attach(c);connections.push(c);
  const result=rooms.handle(c,{type:i?'join':'create',code,name:`City${i}`,craft:1,scene:'eleven'});code=result.room.code;
  rooms.handle(c,{type:'ready',ready:true});
 }
 const extra={send(){}};rooms.attach(extra);assert.throws(()=>rooms.handle(extra,{type:'join',code,name:'Fifth',craft:1,scene:'eleven'}),/最多 4/);
 rooms.handle(connections[0],{type:'start'});const room=rooms.rooms.get(code);assert.equal(room.scene,'eleven');assert.equal(room.players.size,4);
 assert([...room.players.values()].every(p=>p.state.t>.98&&p.state.routeId===null));
});
