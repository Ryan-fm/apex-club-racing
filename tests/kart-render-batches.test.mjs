import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {craftDefs} from '../kart-catalog.js';
import {batchKartMeshes,restoreKartMeshes} from '../kart-render-batches.js';

const runtime=new URL('../vendor/three/build/three.module.min.js',import.meta.url).href,urls={};
for(const name of ['vehicle-finish','armored-kart','garage-config','kart-model','kart-customization']){
 let source=(await readFile(new URL(`../${name}.js`,import.meta.url),'utf8')).replaceAll("'three'",JSON.stringify(runtime));
 for(const [dependency,url]of Object.entries(urls))source=source.replaceAll(`'./${dependency}.js'`,JSON.stringify(url));
 urls[name]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const {makeCraft,configureKart}=await import(urls['kart-model']);
const {animateExhaust}=await import(urls['kart-customization']);

function snapshot(kart){
 kart.updateWorldMatrix(true,true);
 const byMaterial=new Map(),box=new THREE.Box3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();let meshes=0;
 kart.traverseVisible(node=>{
  if(!node.isMesh)return;meshes++;
  const geometry=node.geometry,position=geometry.attributes.position,index=geometry.index;
  const item=byMaterial.get(node.material)||{triangles:0,sum:[0,0,0]};
  const n=index?.count??position.count,instances=node.isInstancedMesh?node.count:1;
  for(let instance=0;instance<instances;instance++){
   if(node.isInstancedMesh){node.getMatrixAt(instance,matrix);matrix.premultiply(node.matrixWorld);}else matrix.copy(node.matrixWorld);
   item.triangles+=n/3;
   for(let j=0;j<n;j++){
    point.fromBufferAttribute(position,index?index.getX(j):j).applyMatrix4(matrix);box.expandByPoint(point);
    for(let axis=0;axis<3;axis++)item.sum[axis]+=point.getComponent(axis);
   }
  }
  byMaterial.set(node.material,item);
 });
 return {byMaterial,box,meshes};
}
function assertSameGeometry(before,after){
 assert.equal(after.byMaterial.size,before.byMaterial.size);
 for(const [material,a]of before.byMaterial){
  const b=after.byMaterial.get(material);assert(b,'exact original material must remain attached');assert.equal(b.triangles,a.triangles);
  a.sum.forEach((value,axis)=>assert(Math.abs(value-b.sum[axis])<.03,`geometry vertex sum moved on axis ${axis}`));
 }
 assert(before.box.min.distanceTo(after.box.min)<1e-5);assert(before.box.max.distanceTo(after.box.max)<1e-5);
}

test('all six karts reduce visible submissions without changing geometry or material identity',()=>{
 for(const definition of craftDefs){
  const kart=makeCraft(definition.color,.9);configureKart(kart,definition);
  kart.position.set(9,3,-12);kart.rotation.y=.48;const before=snapshot(kart),stats=batchKartMeshes(kart),after=snapshot(kart);
  assertSameGeometry(before,after);
  assert(stats.after<stats.before*.75,`${definition.name}: insufficient batching ${JSON.stringify(stats)}`);
  assert.equal(stats.before,before.meshes);assert.equal(stats.after,after.meshes);
  assert.deepEqual(batchKartMeshes(kart),stats,'repeat batching should not create more buffers');
  restoreKartMeshes(kart);assertSameGeometry(before,snapshot(kart));assert.equal(snapshot(kart).meshes,before.meshes);
 }
});

test('wheel animation, exhaust, team repaint and driver visibility remain independent',()=>{
 for(const definition of [craftDefs[1],craftDefs[4]]){
  const plain=makeCraft(),batched=makeCraft();configureKart(plain,definition);configureKart(batched,definition);batchKartMeshes(batched);
  // Both copies use independent materials, so compare geometry using each copy's
  // own material graph before/after its animated parent transforms.
  const driver=batched.userData.model.getObjectByName('Race driver');assert(driver);
  for(const kart of [plain,batched]){
   kart.userData.wheels.forEach(w=>{w.hub.rotation.y=w.front?-.2:0;w.tire.rotation.x=1.7;});
   animateExhaust(kart,.7,.85,true);
  }
  const animated=snapshot(batched);restoreKartMeshes(batched);assertSameGeometry(animated,snapshot(batched));batchKartMeshes(batched);
  const before=snapshot(batched);driver.visible=false;const hidden=snapshot(batched);assert(hidden.meshes<before.meshes);
  driver.visible=true;
  const paint=[];batched.traverse(node=>{if(node.material?.userData.craftColor){node.material.color.setHex(0xcc3355);paint.push(node.material);}});
  assert(paint.length>0);assert(paint.every(material=>material.color.getHex()===0xcc3355));
  assert(batched.userData.engines.every(flame=>flame.visible&&flame.scale.y>1));
 }
});

test('restoring disposes only generated buffers and supports repeated variant changes',()=>{
 const kart=makeCraft();let originalDisposals=0,materialDisposals=0,mergedDisposals=0,expected=0;
 kart.traverse(node=>{node.geometry?.addEventListener('dispose',()=>originalDisposals++);node.material?.addEventListener('dispose',()=>materialDisposals++);});
 for(let cycle=0;cycle<2;cycle++)for(const definition of craftDefs){
  configureKart(kart,definition);const before=snapshot(kart),stats=batchKartMeshes(kart);expected+=stats.batches;
  kart.traverse(node=>{if(node.userData.staticKartBatch)node.geometry.addEventListener('dispose',()=>mergedDisposals++);});
  assert.equal(restoreKartMeshes(kart),true);assert.equal(restoreKartMeshes(kart),false);assertSameGeometry(before,snapshot(kart));
  assert.equal(snapshot(kart).meshes,before.meshes);
 }
 assert.equal(originalDisposals,0);assert.equal(materialDisposals,0);assert.equal(mergedDisposals,expected);
});

test('individual moving parts, negative scale, instances and partial buffers are not frozen into a batch',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(1,1,1);
 const add=()=>{const mesh=new THREE.Mesh(geometry,material);root.add(mesh);return mesh;};
 const a=add(),b=add(),spoiler=add(),mirror=add();mirror.scale.x=-1;
 const partial=add();partial.geometry=geometry.clone();partial.geometry.setDrawRange(3,6);
 const instance=new THREE.InstancedMesh(geometry,material,2);root.add(instance);root.userData.spoilers=[spoiler];
 const stats=batchKartMeshes(root);assert.equal(stats.sourceMeshes,2);assert.equal(a.visible,false);assert.equal(b.visible,false);
 for(const node of [spoiler,mirror,partial,instance])assert.equal(node.visible,true);
 restoreKartMeshes(root);assert(root.children.every(node=>node.visible));
});
