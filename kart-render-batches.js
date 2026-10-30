import * as THREE from './vendor/three/build/three.module.min.js';

// Presentation-only batching for configured AI karts. Keep the hierarchy: a
// spinning wheel, hidden driver or switched body kit still owns its own meshes.
// Call restoreKartMeshes before reconfiguring a kart or replacing its parts.
const batches=new WeakMap();
const supported=new Set(['position','normal','uv','uv1','color','tangent']);

function signature(mesh,protectedParts){
 const geometry=mesh.geometry,material=mesh.material;
 if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||!mesh.visible||mesh.children.length||protectedParts.has(mesh))return null;
 if(!geometry?.isBufferGeometry||Array.isArray(material)||!material||material.transparent||material.opacity!==1||material.isShaderMaterial)return null;
 if(mesh.userData.cosmeticDecal||mesh.userData.noBatch||geometry.morphAttributes&&Object.keys(geometry.morphAttributes).length)return null;
 const count=geometry.index?.count??geometry.attributes.position?.count;
 if(!count||count%3||geometry.drawRange.start!==0||geometry.drawRange.count<count)return null;
 const names=Object.keys(geometry.attributes).sort();
 if(names.some(name=>!supported.has(name)||geometry.attributes[name].isInterleavedBufferAttribute))return null;
 if(mesh.matrixAutoUpdate)mesh.updateMatrix();
 // Mirrored geometry needs its own front-face winding; leave it untouched.
 if(mesh.matrix.determinant()<=0)return null;
 return `${names.map(name=>{const a=geometry.attributes[name];return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).join('|')}/${mesh.castShadow}/${mesh.receiveShadow}/${mesh.layers.mask}/${mesh.renderOrder}/${mesh.frustumCulled}`;
}

function mergedGeometry(meshes){
 const names=Object.keys(meshes[0].geometry.attributes),chunks=[];
 try{
  for(const mesh of meshes){
   const geometry=mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrix);chunks.push(geometry);
  }
  const geometry=new THREE.BufferGeometry();
  for(const name of names){
   const sample=chunks[0].attributes[name],length=chunks.reduce((n,g)=>n+g.attributes[name].array.length,0);
   const values=new sample.array.constructor(length);let offset=0;
   for(const part of chunks){values.set(part.attributes[name].array,offset);offset+=part.attributes[name].array.length;}
   geometry.setAttribute(name,new THREE.BufferAttribute(values,sample.itemSize,sample.normalized));
  }
  // Keep indexed wheel/sphere buffers compact; flattening each indexed mesh
  // would duplicate vertices and repeat normal transforms during preparation.
  const vertices=chunks.reduce((n,g)=>n+g.attributes.position.count,0);
  const count=chunks.reduce((n,g)=>n+(g.index?.count??g.attributes.position.count),0);
  const indices=vertices>65535?new Uint32Array(count):new Uint16Array(count);
  let vertexOffset=0,indexOffset=0;
  for(const part of chunks){
   const length=part.index?.count??part.attributes.position.count;
   for(let i=0;i<length;i++)indices[indexOffset++]=vertexOffset+(part.index?part.index.getX(i):i);
   vertexOffset+=part.attributes.position.count;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
 }finally{chunks.forEach(g=>g.dispose());}
}

function visibleMeshes(kart){let count=0;kart.traverseVisible(node=>{if(node.isMesh)count++;});return count;}

export function batchKartMeshes(kart){
 const existing=batches.get(kart);if(existing)return {...existing.stats};
 const protectedParts=new Set([...(kart.userData.engines||[]),...(kart.userData.fins||[]),...(kart.userData.spoilers||[])]);
 const records=[],before=visibleMeshes(kart),parents=[];
 kart.traverse(node=>{if(node.children.length)parents.push(node);});
 for(const parent of parents){
  const groups=new Map();
  for(const mesh of parent.children){
   const key=signature(mesh,protectedParts);if(key===null)continue;
   if(!groups.has(mesh.material))groups.set(mesh.material,new Map());
   const bySignature=groups.get(mesh.material);if(!bySignature.has(key))bySignature.set(key,[]);
   bySignature.get(key).push(mesh);
  }
  for(const [material,bySignature]of groups)for(const originals of bySignature.values()){
   if(originals.length<2)continue;
   const first=originals[0],merged=new THREE.Mesh(mergedGeometry(originals),material);
   merged.name='Static kart material batch';merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;
   merged.layers.mask=first.layers.mask;merged.renderOrder=first.renderOrder;merged.frustumCulled=first.frustumCulled;
   merged.userData.staticKartBatch=true;
   parent.add(merged);originals.forEach(mesh=>{mesh.visible=false;});records.push({merged,originals});
  }
 }
 const stats={before,after:visibleMeshes(kart),batches:records.length,sourceMeshes:records.reduce((n,r)=>n+r.originals.length,0)};
 batches.set(kart,{records,stats});return {...stats};
}

export function restoreKartMeshes(kart){
 const data=batches.get(kart);if(!data)return false;
 for(const {merged,originals}of data.records){
  merged.removeFromParent();merged.geometry.dispose();originals.forEach(mesh=>{mesh.visible=true;});
 }
 batches.delete(kart);return true;
}
