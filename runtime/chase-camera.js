import * as THREE from '../vendor/three/build/three.module.min.js';

// Presentation only: neither route selection nor vehicle steering is changed.
export function createChaseCamera(){
 const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0);
 let boom=1,elapsed=0,limit=1,ready=false;
 const colliders=new WeakMap();
 function meshes(root){
  if(!colliders.has(root)||colliders.get(root).count!==root.children.length){const list=[];root.traverse(o=>{if(o.isMesh&&!o.userData.cosmeticDecal)list.push(o);});colliders.set(root,{count:root.children.length,list});}
  return colliders.get(root).list.filter(o=>{
   for(let p=o;p;p=p.parent)if(!p.visible)return false;
   const materials=Array.isArray(o.material)?o.material:[o.material];
   return materials.some(m=>m&&!m.transparent&&m.opacity!==0);
  });
 }
 return {
  reset(){ready=false;boom=limit=1;elapsed=0;up.set(0,1,0);},
  solve({position,forward,normal,speed=0,dt,roots=[]}){
   if(!ready){up.copy(normal);roots.filter(Boolean).forEach(r=>r.updateWorldMatrix(true,true));}else up.lerp(normal,1-Math.exp(-6*dt)).normalize();
   const direction=forward.clone().addScaledVector(up,-forward.dot(up)).normalize();
   const anchor=position.clone().addScaledVector(up,5);
   const desired=position.clone().addScaledVector(direction,-61-speed*7).addScaledVector(up,27+speed*2);
   const offset=desired.clone().sub(anchor),length=offset.length();
   elapsed+=dt;
   if(!ready||elapsed>=1/20){
    elapsed=0;ray.set(anchor,offset.clone().normalize());ray.near=.5;ray.far=length+3;
    const candidates=roots.filter(r=>r?.visible).flatMap(meshes);
    const hit=ray.intersectObjects(candidates,false)[0];
    limit=hit?Math.max(0,Math.min(1,(hit.distance-4)/length)):1;
   }
   // Retract immediately before clipping; extend gradually after a junction.
   boom=limit<boom?limit:THREE.MathUtils.lerp(boom,limit,1-Math.exp(-3*dt));
   ready=true;
   return {position:anchor.addScaledVector(offset,boom),up:up.clone(),forward:direction,boom};
  }
 };
}
