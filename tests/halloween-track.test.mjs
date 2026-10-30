import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {halloweenCircuitPoints,HALLOWEEN_HALF_WIDTH,HALLOWEEN_TENSION} from '../halloween-layout.js';
import {multiplayerTrack,spawnPlayer,stepRoomPlayer,idleInput} from '../multiplayer/simulation.js';
import {projectTrack} from '../driving-model.js';
import {RoomService} from '../server/rooms.js';

test('Lantern Hollow is closed, gently graded, readable and separated in XZ',()=>{
 const curve=new THREE.CatmullRomCurve3(halloweenCircuitPoints().map(p=>new THREE.Vector3(...p)),true,'catmullrom',HALLOWEEN_TENSION);curve.arcLengthDivisions=3200;
 const n=1600,points=Array.from({length:n},(_,i)=>curve.getPointAt(i/n));
 let minRadius=Infinity,minGap=Infinity,maxGrade=0;
 for(let i=0;i<n;i++){
  const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],u=b.clone().sub(a),v=c.clone().sub(b);
  minRadius=Math.min(minRadius,u.length()/Math.max(u.angleTo(v),1e-8));
  maxGrade=Math.max(maxGrade,Math.abs(v.y)/Math.hypot(v.x,v.z));
  for(let j=i+1;j<n;j++){
   if(Math.min(j-i,n-j+i)*curve.getLength()/n<220)continue;
   minGap=Math.min(minGap,Math.hypot(b.x-points[j].x,b.z-points[j].z));
  }
 }
 assert(minRadius>75,`night bend is too tight: ${minRadius}`);
 assert(minGap>175,`nonadjacent road sections overlap: ${minGap}`);
 assert(maxGrade<.10,`night grade is too abrupt: ${maxGrade}`);
 assert(curve.getPointAt(0).distanceTo(curve.getPointAt(1))<1e-8);
 assert(curve.getTangentAt(0).angleTo(curve.getTangentAt(1))<.001);
 assert.equal(HALLOWEEN_HALF_WIDTH,42);
 // A fresh caller must not be able to mutate future course construction.
 const pointsCopy=halloweenCircuitPoints();pointsCopy[0][0]=0;
 assert.equal(halloweenCircuitPoints()[0][0],1120);
});

test('a scripted driver completes the new main loop and rejoins every branch',()=>{
 const original=multiplayerTrack('halloween');
 for(const route of [null,...original.routes]){
  const track=route?original:{...original,routes:[]},player={...spawnPlayer('halloween',0),craft:1};
  const a=route?.samples[0]??track.curve.getPointAt(0),b=route?.samples[1]??track.curve.getPointAt(.001),start=route?.start??0;
  Object.assign(player.state,{x:a.x,z:a.z,t:start,heading:Math.atan2(b.x-a.x,b.z-a.z),roadIndex:null,lane:0,speed:140});player.racer.progress=start;
  const race={elapsed:0,firstFinish:null};let steps=0,hits=0,sawBranch=false,sawBoost=false;
  for(;steps<18000;steps++){
   const s=player.state,u=route?projectTrack(s.x,s.z,route.samples).t:0;
   const p=route?(u>.985?track.curve.getPointAt(route.end+.004):route.samples[Math.min(120,Math.floor(u*120)+5)]):track.curve.getPointAt((s.t+.006)%1);
   const aim=Math.atan2(p.x-s.x,p.z-s.z),error=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading));
   race.elapsed+=1/60;
   const result=stepRoomPlayer(player,{...idleInput(),throttle:true,rawSteer:Math.max(-1,Math.min(1,-error*2.5)),brake:Math.abs(error)>.45&&s.speed>160},race,track);
   assert(!player.stunts.airborne,'lantern roads must not invent a jump');
   assert(Math.abs(result.delta)<.004,'a branch must not teleport race progress');
   hits+=Number(result.wallHit);sawBranch||=s.routeId===route?.id;sawBoost||=s.surfaceBoost;
   if(route?s.t>route.end+.001:player.racer.progress>=1)break;
  }
  assert(steps<18000,`${route?.id??'main'} could not complete`);
  assert(hits/(steps+1)<.06,`${route?.id??'main'} has persistent wall contact`);
  if(route){assert(sawBranch,`${route.id} never became drivable`);assert.equal(sawBoost,route.kind==='express');}
 }
});

test('Halloween branches have continuous grades and cannot intersect an unrelated main-road section',()=>{
 const track=multiplayerTrack('halloween');
 for(const route of track.routes){
  if(route.kind==='shortcut')assert(route.savedDistance>100);
  for(let i=1;i<route.samples.length-1;i++){
   const a=route.samples[i-1],b=route.samples[i],c=route.samples[i+1];
   const u=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),v=new THREE.Vector3(c.x-b.x,c.y-b.y,c.z-b.z);
   assert(Math.abs(v.y)/Math.hypot(v.x,v.z)<.10);
   assert(v.length()/Math.max(u.angleTo(v),1e-8)>30);
   for(let j=0;j<track.samples.length;j++){
    const t=j/(track.samples.length-1),p=track.samples[j];
    // The branch and main road intentionally share their entry/exit fan.
    if([t-1,t,t+1].some(progress=>progress>=route.start-.025&&progress<=route.end+.025))continue;
    assert(Math.hypot(b.x-p.x,b.z-p.z)>90,`${route.id} crosses unrelated main road at ${t}`);
   }
  }
 }
});

test('the Halloween room uses shared geometry and still rejects a fifth player',()=>{
 const rooms=new RoomService({now:()=>0}),connections=[];let code;
 for(let i=0;i<4;i++){
  const connection={send(){}};connections.push(connection);rooms.attach(connection);
  const result=rooms.handle(connection,{type:i?'join':'create',code,name:`Lantern${i}`,craft:1,scene:'halloween'});code=result.room.code;
  rooms.handle(connection,{type:'ready',ready:true});
 }
 const extra={send(){}};rooms.attach(extra);
 assert.throws(()=>rooms.handle(extra,{type:'join',code,name:'Fifth',craft:1,scene:'halloween'}),/最多 4/);
 rooms.handle(connections[0],{type:'start'});
 assert.equal(rooms.rooms.get(code).scene,'halloween');
 assert.equal(rooms.rooms.get(code).players.size,4);
 assert.equal(multiplayerTrack('halloween').halfWidth(0),42);
});

test('the Halloween kit batches its static props and creates no dynamic lights',async()=>{
 // Browser import maps resolve "three"; Node uses the exact same vendored module.
 let source=await readFile(new URL('../halloween-scene.js',import.meta.url),'utf8');
 for(const [specifier,path]of [['three','../vendor/three/build/three.module.min.js'],['./driving-model.js','../driving-model.js'],['./halloween-layout.js','../halloween-layout.js']])source=source.replace(`'${specifier}'`,JSON.stringify(new URL(path,import.meta.url).href));
 const {createHalloween}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const track=multiplayerTrack('halloween'),up=new THREE.Vector3(0,1,0),frame=t=>{
  const p=track.curve.getPointAt((t%1+1)%1),tan=track.curve.getTangentAt((t%1+1)%1).normalize(),side=new THREE.Vector3().crossVectors(tan,up).normalize(),normal=new THREE.Vector3().crossVectors(side,tan).normalize();return {p,tan,side,normal};
 };
 const scene=createHalloween(frame,track.curve.getLength(),track.routes);
 let meshes=0,lights=0,instances=0;scene.traverse(node=>{if(node.isMesh)meshes++;if(node.isLight)lights++;if(node.isInstancedMesh)instances+=node.count;});
 assert.equal(lights,0);assert(meshes<35,`prop kit has ${meshes} draw batches`);
 assert(instances>2000,'road guides and scenery must be present');
 assert(scene.getObjectByName('Harvest moon'));assert(scene.getObjectByName('Halloween twilight sky'));
 assert(scene.userData.diagnostics.static);assert.equal(scene.userData.diagnostics.dynamicLights,0);
 const shadowCasters=[];scene.traverse(node=>{if(node.isMesh){assert.equal(node.userData.authoredShadows,true);if(node.castShadow)shadowCasters.push(node);}});
 assert(shadowCasters.length>0&&shadowCasters.length<4,'only authored landmark batches should cast shadows');
});
