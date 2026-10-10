import * as THREE from './vendor/three/build/three.module.min.js';
import {projectTrack} from './driving-model.js';

// Static desert scenery: shared geometries and material batches keep mobile draw calls low.
export function createCanyon(trackFrame,trackLength,routes=[],opening=()=>false){
 const root=new THREE.Group();root.name='Redrock Canyon';
 const sandstone=new THREE.MeshStandardMaterial({color:0xa95c3c,roughness:.98});
 const pale=new THREE.MeshStandardMaterial({color:0xd39a67,roughness:1});
 const dark=new THREE.MeshStandardMaterial({color:0x633f33,roughness:.9});
 const steel=new THREE.MeshStandardMaterial({color:0x473a35,metalness:.3,roughness:.65});
 const reflect=new THREE.MeshBasicMaterial({color:0xffd68d});
 const cactus=new THREE.MeshStandardMaterial({color:0x657c52,roughness:.94});
 const cube=new THREE.BoxGeometry(1,1,1),rock=new THREE.DodecahedronGeometry(1,1),stem=new THREE.CylinderGeometry(1,1,1,6),pose=new THREE.Object3D(),batches=new Map();
 const add=(geometry,material,position,scale,q=null)=>{
  pose.position.copy(position);pose.scale.set(...scale);q?pose.quaternion.copy(q):pose.quaternion.identity();pose.updateMatrix();
  if(!batches.has(material))batches.set(material,new Map());const group=batches.get(material);if(!group.has(geometry))group.set(geometry,[]);group.get(geometry).push(pose.matrix.clone());
 };
 const local=(f,mat,x,y,z,sx,sy,sz)=>add(cube,mat,f.p.clone().addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z),[sx,sy,sz],new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan)));
 const main=Array.from({length:801},(_,i)=>{const p=trackFrame(i/800).p;return {x:p.x,z:p.z};});
 const roads=[main,...routes.map(r=>r.samples)];
 const clear=(p,radius)=>roads.every(samples=>projectTrack(p.x,p.z,samples).d2>(radius+48)**2);
 for(let i=0;i<360;i++){
  const t=i/360,f=trackFrame(t),len=trackLength/360+2;
  local(f,sandstone,0,-43,0,98,82,len);
  for(const side of [-1,1]){
   if(opening(t,side,f))continue;
   local(f,steel,side*41,3,0,3,6,len);
   if(i%3===0){local(f,pale,side*44,2,0,5,7,3);local(f,reflect,side*39.2,4,0,.5,1.2,4);}
  }
 }
 // Broken rock corridors and sediment bands never occupy either the main or branch roads.
 for(let i=0;i<84;i++){
  const f=trackFrame((i+.3)/84),side=i%2?1:-1,radius=55+(i%4)*12,height=65+(i%6)*18;
  const p=f.p.clone().addScaledVector(f.side,side*(230+(i%3)*55));p.y=height*.55;
  if(!clear(p,radius))continue;
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),i*1.7);
  add(rock,i%3?sandstone:pale,p,[radius,height,radius*.8],q);
  for(let layer=0;layer<3;layer++)add(cube,layer%2?pale:dark,new THREE.Vector3(p.x,30+layer*height*.4,p.z),[radius*1.65,4,radius*1.3],q);
 }
 // Distant mesas form a warm horizon rather than a sea backdrop.
 for(let i=0;i<18;i++){
  const a=i/18*Math.PI*2,r=2300+(i%3)*180;
  add(rock,i%2?sandstone:pale,new THREE.Vector3(Math.sin(a)*r,130+30*(i%4),Math.cos(a)*r),[240+(i%4)*70,190+(i%3)*90,220]);
 }
 for(let i=0;i<60;i++){
  const f=trackFrame((i+.5)/60),p=f.p.clone().addScaledVector(f.side,(i%2?1:-1)*(105+(i%3)*22));p.y=f.p.y-15;
  if(!clear(p,12))continue;
  add(stem,cactus,p,[3,26+(i%3)*6,3]);
  for(const side of [-1,1]){add(cube,cactus,new THREE.Vector3(p.x+side*7,p.y+3,p.z),[12,3,3]);add(stem,cactus,new THREE.Vector3(p.x+side*12,p.y+9,p.z),[2,13,2]);}
 }
 for(const t of [.02,.33,.63]){
  const f=trackFrame(t);
  for(const side of [-1,1]){local(f,sandstone,side*60,22,0,18,50,24);local(f,pale,side*60,40,0,22,6,28);}
  local(f,pale,0,50,0,145,16,27);local(f,dark,0,61,0,130,6,23);
 }
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(15000,15000),new THREE.MeshStandardMaterial({color:0xc18b58,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;ground.receiveShadow=true;root.add(ground);
 for(const [material,geometries]of batches)for(const [geometry,matrices]of geometries){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);}
 return root;
}
