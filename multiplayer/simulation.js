import * as THREE from '../vendor/three/build/three.module.min.js';
import {circuitPoints,roadHalfWidth} from '../track-layout.js';
import {createTrackRoutes} from '../track-routes.js';
import {craftDefs} from '../kart-catalog.js';
import {createStunts} from '../stunt-model.js';
import {stepPlayerSimulation} from '../runtime/player-simulation.js';
import {advanceRacer} from '../race-rules.js';
export const ROOM_LIMIT=4,PHYSICS_DT=1/60;
export const SCENES=['bay','citadel','harbor'];
export const idleInput=()=>({rawSteer:0,driftSteer:0,throttle:false,brake:false,driftHeld:false,commands:{}});
export function sanitizeInput(value){
 if(!value||typeof value!=='object'||!Number.isFinite(value.rawSteer)||Math.abs(value.rawSteer)>1)throw Error('Invalid input.');
 return {rawSteer:value.rawSteer,driftSteer:value.rawSteer,throttle:value.throttle===true,brake:value.brake===true,driftHeld:value.driftHeld===true,commands:{mini:value.commands?.mini===true,nitro:value.commands?.nitro===true}};
}
const tracks=new Map();
export function multiplayerTrack(scene){
 if(!SCENES.includes(scene))throw Error('Unknown circuit.');
 if(tracks.has(scene))return tracks.get(scene);
 const curve=new THREE.CatmullRomCurve3(circuitPoints(scene).map(p=>new THREE.Vector3(...p)),true,'catmullrom',scene==='harbor'?.65:.35);
 if(scene==='harbor')curve.arcLengthDivisions=2400;
 const track={scene,routes:createTrackRoutes(scene,curve),curve,samples:Array.from({length:1601},(_,i)=>{const p=curve.getPointAt(i/1600);return {x:p.x,y:p.y,z:p.z};}),halfWidth:t=>roadHalfWidth(scene,t),ground:t=>curve.getPointAt(t).y};tracks.set(scene,track);return track;
}
export function spawnPlayer(scene,index){
 const track=multiplayerTrack(scene),progress=-.004-Math.floor(index/2)*.005,t=(progress+1)%1,p=track.curve.getPointAt(t),tan=track.curve.getTangentAt(t),side=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,1,0)).normalize(),lane=index%2===0?-13:13;
 return {state:{x:p.x+side.x*lane,z:p.z+side.z*lane,heading:Math.atan2(tan.x,tan.z),t,vx:0,vz:0,speed:0,lane,laneVel:0,roadIndex:null,routeId:null,roadHalfWidth:null,surfaceBoost:false,hit:0,hop:0,bank:0,yaw:0,reverseHold:0,wallContact:0,boost:1/3,shield:1,weapon:0,lap:1,rank:1,nitro:0,miniTurbo:0,drift:{active:false,charge:0,direction:0}},stunts:createStunts(),racer:{sortOrder:index,progress,finishTime:null,lane,speed:0}};
}
export function stepRoomPlayer(player,input,race,track,dt=PHYSICS_DT){
 if(player.racer.finishTime!==null)return;
 const result=stepPlayerSimulation(player.state,player.stunts,input,craftDefs[player.craft],track,dt);
 advanceRacer(race,player.racer,result.delta,dt);player.racer.lane=player.state.lane;player.racer.speed=player.state.speed;
 player.state.lap=Math.min(3,Math.max(1,Math.floor(Math.max(0,player.racer.progress))+1));
 if(player.racer.finishTime!==null)player.state.speed=0;
 return result;
}
export function recoverRoomPlayer(player,track){
 const t=(player.state.t+1)%1,p=track.curve.getPointAt(t),tan=track.curve.getTangentAt(t);
 Object.assign(player.state,{x:p.x,z:p.z,heading:Math.atan2(tan.x,tan.z),speed:0,vx:0,vz:0,lane:0,laneVel:0,routeId:null,roadHalfWidth:null,surfaceBoost:false,nitro:0,miniTurbo:0,wallContact:0,reverseHold:0,drift:{active:false,charge:0,direction:0}});player.stunts=createStunts();
}
