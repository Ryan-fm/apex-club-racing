import * as THREE from './vendor/three/build/three.module.min.js';
import {projectTrack,progressDelta} from './driving-model.js';
import {roadHalfWidth} from './track-layout.js';

// Shared authored roads: no branch crosses the finish line or supplies steering.
const layout={
 bay:{cuts:[[.075,.225],[.41,.56]],express:[[.01,.065,-75],[.76,.815,-80]]},
 citadel:{cuts:[[.08,.145],[.16,.225]],express:[[.01,.065,-72],[.85,.93,72]]},
 harbor:{cuts:[[.08,.145],[.24,.305]],express:[[.005,.06,-72],[.69,.745,-75]]}
};
const up=new THREE.Vector3(0,1,0);
export function createTrackRoutes(scene,curve){
 const spec=layout[scene];
 const mainSamples=Array.from({length:1601},(_,i)=>{const p=curve.getPointAt(i/1600);return {x:p.x,z:p.z};});
 return [...spec.cuts.map(([start,end],i)=>({id:`cut-${i}`,kind:'shortcut',start,end})),...spec.express.map(([start,end,offset],i)=>({id:`express-${i}`,kind:'express',start,end,offset}))].map(route=>{
  const {start,end}=route,a=curve.getPointAt(start),b=curve.getPointAt(end),distance=a.distanceTo(b);
  const cut=new THREE.CubicBezierCurve3(a,a.clone().addScaledVector(curve.getTangentAt(start),distance*.18),b.clone().addScaledVector(curve.getTangentAt(end),-distance*.18),b);
  const samples=Array.from({length:121},(_,i)=>{
   const u=i/120,t=start+(end-start)*u,main=curve.getPointAt(t);
   const p=route.kind==='shortcut'?cut.getPointAt(u):main.clone().addScaledVector(new THREE.Vector3().crossVectors(curve.getTangentAt(t),up).normalize(),route.offset*Math.sin(Math.PI*u)**2);
   // Match the main deck height throughout the overlapping merge, then
   // ease into the branch elevation so the junction has no step or take-off.
   const edge=Math.min(u,1-u),blend=Math.max(0,Math.min(1,(edge-.2)/.1));
   const eased=blend*blend*(3-2*blend);
   const nearest=projectTrack(p.x,p.z,mainSamples,Math.floor(t*1600));
   const mergeHeight=curve.getPointAt(nearest.t).y;
   return {x:p.x,y:route.kind==='shortcut'?mergeHeight:mergeHeight+(main.y-mergeHeight)*eased,z:p.z,t};
  });
  if(route.kind==='shortcut'){
   const a=samples[24].y,b=samples[96].y,da=(a-samples[23].y)*72,db=(samples[97].y-b)*72;
   for(let i=25;i<96;i++){
    const u=(i-24)/72;
    samples[i].y=(2*u**3-3*u**2+1)*a+(u**3-2*u**2+u)*da+(-2*u**3+3*u**2)*b+(u**3-u**2)*db;
   }
  }
  const length=samples.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-samples[i].x,p.y-samples[i].y,p.z-samples[i].z),0);
  return {...route,samples,length,halfWidth:route.kind==='shortcut'?22:25};
 });
}
export function routeWidth(route,u,scene){
 const blend=Math.min(1,Math.min(u,1-u)*10);
 return roadHalfWidth(scene,route.start+(route.end-route.start)*u)*(1-blend)+route.halfWidth*blend;
}
export function projectRoad(state,track){
 const main=projectTrack(state.x,state.z,track.samples,state.roadIndex);
 let best={...main,routeId:null,halfWidth:track.halfWidth(main.t),ground:track.ground(main.t),surfaceBoost:false};
 for(const route of track.routes||[]){
  if(state.t<route.start-.012||state.t>route.end+.012)continue;
  const road=projectTrack(state.x,state.z,route.samples);
  const u=road.t,t=route.start+(route.end-route.start)*u;
  const width=routeWidth(route,u,track.scene);
  const inside=Math.abs(road.lane)<=width-6,bestInside=Math.abs(best.lane)<=best.halfWidth-6;
  // Junctions are the union of both roads: never hit a branch wall while
  // still inside the main road, or clamp a kart that is already on the branch.
  if(bestInside&&!inside)continue;
  if(inside===bestInside&&road.d2+(state.routeId===route.id?-4:4)>=best.d2)continue;
  if(Math.abs(progressDelta(state.t,t))>.018)continue;
  const i=Math.min(route.samples.length-2,road.index),fraction=u*(route.samples.length-1)-i;
  best={...road,t,index:Math.floor(t*(track.samples.length-1)),routeId:route.id,routeKind:route.kind,routeU:u,halfWidth:width,ground:route.samples[i].y+(route.samples[i+1].y-route.samples[i].y)*fraction,surfaceBoost:route.kind==='express'&&u>=.15&&u<=.85};
 }
 return best;
}
// Open the existing scenery rails wherever a branch joins or diverges.
export function routeOpening(routes,t,side,frame){
 const edge=frame.p.clone().addScaledVector(frame.side,side*42);
 return routes.some(route=>route.samples.some(p=>Math.abs(p.t-t)<.02&&Math.hypot(p.x-edge.x,p.z-edge.z)<route.halfWidth+22));
}

export function branchFrame(routes,id,t){
 const route=routes.find(r=>r.id===id);if(!route)return null;
 const u=Math.max(0,Math.min(1,(t-route.start)/(route.end-route.start))),n=u*120,i=Math.min(119,Math.floor(n)),fraction=n-i,a=route.samples[i],b=route.samples[i+1];
 const p=new THREE.Vector3(a.x+(b.x-a.x)*fraction,a.y+(b.y-a.y)*fraction,a.z+(b.z-a.z)*fraction),tan=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize(),side=new THREE.Vector3().crossVectors(tan,up).normalize(),normal=new THREE.Vector3().crossVectors(side,tan).normalize();
 return {p,tan,side,normal};
}
