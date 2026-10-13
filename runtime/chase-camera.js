import * as THREE from '../vendor/three/build/three.module.min.js';

// Presentation only: neither route selection nor vehicle steering is changed.
export function createChaseCamera(){
 const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0);
 let boom=1,ready=false;
 const colliders=new WeakMap();
 const cellSize=96,key=(x,z)=>`${x},${z}`;
 function solid(o){
  for(let p=o;p;p=p.parent)if(!p.visible||p.userData.cosmeticDecal||p.userData.cameraIgnore)return false;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  return materials.some(m=>m&&!m.transparent&&m.opacity!==0);
 }
 function index(root){
  let cache=colliders.get(root);
  if(cache?.count===root.children.length)return cache;
  root.updateWorldMatrix(true,true);
  cache={count:root.children.length,cells:new Map(),large:[]};
  const matrix=new THREE.Matrix4();
  root.traverse(source=>{
   if(!source.isMesh||source.userData.cosmeticDecal||source.userData.cameraIgnore)return;
   source.geometry.computeBoundingBox();
   // Raycaster scans every instance in an InstancedMesh. Index individual static
   // instances so per-frame near-plane probes only touch nearby scenery.
   for(let i=0;i<(source.isInstancedMesh?source.count:1);i++){
    let mesh=source;
    if(source.isInstancedMesh){
     source.getMatrixAt(i,matrix);matrix.premultiply(source.matrixWorld);
     mesh=new THREE.Mesh(source.geometry,source.material);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(matrix);
    }
    const box=source.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),entry={source,mesh,box};
    const x0=Math.floor(box.min.x/cellSize),x1=Math.floor(box.max.x/cellSize),z0=Math.floor(box.min.z/cellSize),z1=Math.floor(box.max.z/cellSize);
    if((x1-x0+1)*(z1-z0+1)>64){cache.large.push(entry);continue;}
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
     const k=key(x,z);if(!cache.cells.has(k))cache.cells.set(k,[]);cache.cells.get(k).push(entry);
    }
   }
  });
  colliders.set(root,cache);return cache;
 }
 function nearby(roots,box){
  const entries=new Set();
  for(const root of roots){
   if(!root?.visible)continue;const cache=index(root);
   cache.large.forEach(e=>entries.add(e));
   for(let x=Math.floor(box.min.x/cellSize);x<=Math.floor(box.max.x/cellSize);x++)for(let z=Math.floor(box.min.z/cellSize);z<=Math.floor(box.max.z/cellSize);z++){
    cache.cells.get(key(x,z))?.forEach(e=>entries.add(e));
   }
  }
  return [...entries].filter(e=>solid(e.source)&&e.box.intersectsBox(box)).map(e=>e.mesh);
 }
 return {
  reset(){ready=false;boom=1;up.set(0,1,0);},
  solve({position,forward,normal,speed=0,distance=61,height=27,dt,roots=[]}){
   if(!ready)up.copy(normal);else up.lerp(normal,1-Math.exp(-6*dt)).normalize();
   const direction=forward.clone().addScaledVector(up,-forward.dot(up)).normalize();
   const anchor=position.clone().addScaledVector(up,5);
   const desired=position.clone().addScaledVector(direction,-distance-speed*7).addScaledVector(up,height+speed*2);
   const offset=desired.clone().sub(anchor),length=offset.length();
   const box=new THREE.Box3().setFromPoints([anchor,desired]).expandByScalar(4),candidates=nearby(roots,box);
   const side=new THREE.Vector3().crossVectors(direction,up).normalize(),rayDirection=offset.clone().normalize();
   let limit=1;
   // Check both sides of the camera near plane, every display frame. A centre
   // ray alone misses pillars at the screen edge and tunnels between samples.
   for(const lateral of [0,-2,2]){
    ray.set(anchor.clone().addScaledVector(side,lateral),rayDirection);ray.near=.5;ray.far=length+4;
    const hit=ray.intersectObjects(candidates,false)[0];
    if(hit)limit=Math.min(limit,Math.max(0,(hit.distance-4)/length));
   }
   // Retract immediately before clipping; extend gradually after a junction.
   boom=limit<boom?limit:THREE.MathUtils.lerp(boom,limit,1-Math.exp(-3*dt));
   ready=true;
   return {position:anchor.addScaledVector(offset,boom),up:up.clone(),forward:direction,boom};
  }
 };
}
