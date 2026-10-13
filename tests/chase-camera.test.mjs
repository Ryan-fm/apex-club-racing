import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {createChaseCamera} from '../runtime/chase-camera.js';

const params={position:new THREE.Vector3(0,4,0),forward:new THREE.Vector3(0,0,1),normal:new THREE.Vector3(0,1,0),speed:.5,dt:1/60};
test('chase camera retracts before scenery and recovers smoothly after the shortcut exit',()=>{
 const rig=createChaseCamera(),root=new THREE.Group();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(100,100,3),new THREE.MeshStandardMaterial());wall.position.z=-30;root.add(wall);
 const near=rig.solve({...params,roots:[root]});assert(near.position.z>-28.5);assert(near.boom<.5);
 root.visible=false;let out;
 for(let i=0;i<4;i++)out=rig.solve({...params,roots:[root]});assert(out.boom>near.boom);assert(out.boom<1);
 for(let i=0;i<150;i++)out=rig.solve({...params,roots:[root]});assert(out.boom>.99);
});
test('main to branch slope switches preserve a stable up vector without modifying the kart',()=>{
 const rig=createChaseCamera(),p=params.position.clone();rig.solve(params);
 const steep=new THREE.Vector3(.15,.96,.24).normalize(),view=rig.solve({...params,normal:steep});
 assert(view.up.angleTo(params.normal)<.05);assert(view.up.angleTo(steep)>.1);
 assert(params.position.equals(p));assert(view.position.toArray().every(Number.isFinite));
});
test('newly cached routes are included and invisible old maps do not obstruct the chase view',()=>{
 const rig=createChaseCamera(),root=new THREE.Group();assert.equal(rig.solve({...params,roots:[root]}).boom,1);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(100,100,4),new THREE.MeshStandardMaterial());wall.position.z=-25;root.add(wall);root.updateWorldMatrix(true,true);
 let view;for(let i=0;i<4;i++)view=rig.solve({...params,roots:[root]});assert(view.boom<.5);
 wall.visible=false;rig.reset();assert.equal(rig.solve({...params,roots:[root]}).boom,1);
});

test('a thin pillar reached between old 20Hz probes is detected on the next display frame',()=>{
 const rig=createChaseCamera(),root=new THREE.Group();
 const pillar=new THREE.Mesh(new THREE.BoxGeometry(.8,80,1),new THREE.MeshStandardMaterial());pillar.position.set(12,10,-25);root.add(pillar);
 assert.equal(rig.solve({...params,roots:[root]}).boom,1);
 const view=rig.solve({...params,position:new THREE.Vector3(12,4,0),roots:[root]});
 assert(view.position.z>-24,'camera must not wait three frames before finding the pillar');
});
test('near-plane side probes catch an off-centre post while cosmetic markings stay clear',()=>{
 const rig=createChaseCamera(),root=new THREE.Group();
 const post=new THREE.Mesh(new THREE.BoxGeometry(.7,80,1),new THREE.MeshStandardMaterial());post.position.set(2,10,-25);root.add(post);
 assert(rig.solve({...params,roots:[root]}).boom<.5);
 post.userData.cosmeticDecal=true;rig.reset();assert.equal(rig.solve({...params,roots:[root]}).boom,1);
});
test('static instance indexing preserves world transforms and avoids scanning the full scenery batch',()=>{
 const rig=createChaseCamera(),root=new THREE.Group();root.position.x=10;
 const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(100,100,3),new THREE.MeshStandardMaterial(),800),matrix=new THREE.Matrix4();
 for(let i=0;i<800;i++)batch.setMatrixAt(i,matrix.makeTranslation(i?1000+i*150:-10,0,-30));root.add(batch);
 batch.raycast=()=>{throw Error('full instance batch must not be raycast each display frame');};
 const view=rig.solve({...params,roots:[root]});assert(view.boom<.5);assert(view.position.z>-28.5);
 batch.visible=false;rig.reset();assert.equal(rig.solve({...params,roots:[root]}).boom,1);
 assert.equal(root.position.x,10);
});
