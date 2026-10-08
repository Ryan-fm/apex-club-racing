// Test-only controller records a finite input tape; ordinary races never import it.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {circuitPoints,roadHalfWidth} from '../track-layout.js';
import {craftDefs} from '../kart-catalog.js';
import {createStunts,boostOpportunity} from '../stunt-model.js';
import {stepPlayerSimulation} from '../runtime/player-simulation.js';
const curve=new THREE.CatmullRomCurve3(circuitPoints('citadel').map(p=>new THREE.Vector3(...p)),true,'catmullrom',.35);
const samples=Array.from({length:1601},(_,i)=>{const p=curve.getPointAt(i/1600);return {x:p.x,z:p.z};});
const p=curve.getPointAt(.245),tan=curve.getTangentAt(.245);
let s={x:p.x,z:p.z,heading:Math.atan2(tan.x,tan.z),speed:0,vx:0,vz:0,t:.245,lane:0,laneVel:0,roadIndex:null,hit:0,hop:0,nitro:0,miniTurbo:0,boost:1/3,drift:{active:false,charge:0,direction:0}},st=createStunts();
const track={samples,halfWidth:t=>roadHalfWidth('citadel',t),ground:t=>curve.getPointAt(t).y};
let events=[],trace=[],prevzone=-1,lastmini='',nitro=false;
for(let tick=0;tick<120*60 && s.t<.428;tick++){
 const ahead=curve.getPointAt((s.t+.008)%1),angle=Math.atan2(ahead.x-s.x,ahead.z-s.z),error=Math.atan2(Math.sin(angle-s.heading),Math.cos(angle-s.heading));
 let steer=Math.max(-1,Math.min(1,-error*3.4));
 const zones=[[.259,.286],[.300,.331],[.346,.377]];
 const zone=zones.findIndex(([a,b])=>s.t>=a&&s.t<b);
 const release=zone<0&&prevzone>=0;
 if(release&&prevzone===1)steer=-s.drift.direction*.3;
 const opp=boostOpportunity(st),mini=release||!!opp&&opp!==lastmini;
 const input={rawSteer:steer,driftSteer:steer,throttle:true,brake:s.speed>260||Math.abs(error)>.75,driftHeld:zone>=0,commands:{mini,nitro:false}};
 const r=stepPlayerSimulation(s,st,input,craftDefs[4],track,1/120);
 for(const e of r.events)events.push({...e,tick,t:s.t,speed:s.speed});
 trace.push([input.rawSteer,Number(input.brake),Number(input.driftHeld),Number(input.commands.mini),Number(input.commands.nitro)]);prevzone=zone;lastmini=opp;
}
const inputHash=createHash('sha256').update(JSON.stringify(trace)).digest('hex').slice(0,16);
await writeFile('diagnostics/gate-replay.js', '// Recorded test inputs only. Imported exclusively by ?slice=gate&perf=1&replay=gate.\nexport const replay='+JSON.stringify({dt:1/120,start:.245,finish:.428,craft:4,scene:'citadel',inputHash,frames:trace,events})+';\n');
console.log(JSON.stringify({progress:s.t,seconds:trace.length/120,inputHash,collisions:events.filter(e=>e.kind==='collision').length,boosts:events.filter(e=>e.kind==='mini').map(e=>e.type)},null,2));
