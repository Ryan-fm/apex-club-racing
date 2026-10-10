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
