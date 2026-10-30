import * as THREE from 'three';
import {projectTrack} from './driving-model.js';
import {HALLOWEEN_HALF_WIDTH} from './halloween-layout.js';

// Lantern Hollow is a static, deterministic prop kit. Repeated forms are
// instanced by geometry/material; pumpkins are emissive, never point lights.
export function createHalloween(trackFrame,trackLength,routes=[],opening=()=>false){
 const root=new THREE.Group();root.name='Lantern Hollow';
 const materials={
  soil:new THREE.MeshStandardMaterial({color:0x302f35,roughness:1}),
  shoulder:new THREE.MeshStandardMaterial({color:0x4b4545,roughness:.96}),
  stone:new THREE.MeshStandardMaterial({color:0x697279,roughness:.9}),
  slate:new THREE.MeshStandardMaterial({color:0x2a303c,roughness:.84}),
  bark:new THREE.MeshStandardMaterial({color:0x4b3840,roughness:1}),
  iron:new THREE.MeshStandardMaterial({color:0x303744,metalness:.55,roughness:.58}),
  plaster:new THREE.MeshStandardMaterial({color:0x838087,roughness:.92}),
  pumpkin:new THREE.MeshStandardMaterial({color:0xeb7026,emissive:0x702407,emissiveIntensity:.18,roughness:.7}),
  amber:new THREE.MeshBasicMaterial({color:0xffba69}),
  pale:new THREE.MeshBasicMaterial({color:0xdce9eb}),
  dark:new THREE.MeshBasicMaterial({color:0x151a24}),
  moss:new THREE.MeshStandardMaterial({color:0x43504b,roughness:1})
 };
 const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(.65,1,1,6),cone=new THREE.ConeGeometry(1,1,8),rock=new THREE.DodecahedronGeometry(1,0);
 const pumpkin=new THREE.SphereGeometry(1,20,12),positions=pumpkin.attributes.position;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=1+.085*Math.cos(Math.atan2(z,x)*9);
  positions.setXYZ(i,x*r,y*.79,z*r);
 }
 pumpkin.computeVertexNormals();
 const eyeShape=new THREE.Shape();eyeShape.moveTo(-.5,-.35);eyeShape.lineTo(.5,-.35);eyeShape.lineTo(.1,.6);eyeShape.closePath();
 const eye=new THREE.ShapeGeometry(eyeShape);
 const mouthShape=new THREE.Shape();mouthShape.moveTo(-1,.2);mouthShape.lineTo(-.5,-.42);mouthShape.lineTo(0,-.55);mouthShape.lineTo(.5,-.42);mouthShape.lineTo(1,.2);mouthShape.lineTo(.45,-.05);mouthShape.lineTo(.25,.18);mouthShape.lineTo(0,-.08);mouthShape.lineTo(-.25,.18);mouthShape.lineTo(-.45,-.05);mouthShape.closePath();
 const mouth=new THREE.ShapeGeometry(mouthShape);materials.amber.side=THREE.DoubleSide;
 const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute([
  -.5,0,-.5,.5,0,-.5,0,1,-.5, -.5,0,.5,0,1,.5,.5,0,.5,
  -.5,0,-.5,0,1,-.5,0,1,.5, -.5,0,-.5,0,1,.5,-.5,0,.5,
  .5,0,-.5,.5,0,.5,0,1,.5, .5,0,-.5,0,1,.5,0,1,-.5
 ],3));roof.computeVertexNormals();
 const batches=new Map(),pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 const add=(geometry,material,p,scale,q=null)=>{
  pose.position.copy(p);pose.scale.set(...scale);q?pose.quaternion.copy(q):pose.quaternion.identity();pose.updateMatrix();
  if(!batches.has(material))batches.set(material,new Map());const group=batches.get(material);
  if(!group.has(geometry))group.set(geometry,[]);group.get(geometry).push(pose.matrix.clone());
 };
 const orientation=f=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));
 const point=(f,x,y,z=0)=>f.p.clone().addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z);
 const local=(f,material,x,y,z,sx,sy,sz,geometry=cube)=>add(geometry,material,point(f,x,y,z),[sx,sy,sz],orientation(f));
 function beam(material,a,b,radius,geometry=cylinder){const delta=b.clone().sub(a);add(geometry,material,a.clone().add(b).multiplyScalar(.5),[radius,delta.length(),radius],new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));}
 const main=Array.from({length:801},(_,i)=>trackFrame(i/800).p),roads=[main,...routes.map(r=>r.samples)];
 const clear=(p,radius=0)=>roads.every(samples=>projectTrack(p.x,p.z,samples).d2>(radius+55)**2);
 const W=HALLOWEEN_HALF_WIDTH;

 // Broad banks ground the elevated road. Amber guides preserve the driving
 // line; amber never replaces the green/cyan branch-route visual language.
 for(let i=0;i<480;i++){
  const t=i/480,f=trackFrame(t),len=trackLength/480+2;
  local(f,materials.soil,0,-20,0,160,35,len);
  local(f,materials.shoulder,0,-4.5,0,W*2+14,8,len);
  for(const side of [-1,1]){
   if(opening(t,side,f))continue;
   local(f,materials.iron,side*(W+2),3,0,2.4,5.8,len);
   local(f,materials.amber,side*(W+1),6.1,0,.6,.48,len-.6);
   if(i%3===0){local(f,materials.stone,side*(W+3),2.5,0,3.8,7.5,3.8);local(f,materials.pale,side*(W+.5),3.6,0,.25,1.1,2.1);}
  }
 }
 // Pumpkin sentinels: modeled lobes, stems and cut faces, not glowing orbs.
 function lantern(f,x,y,z,r=5){
  local(f,materials.pumpkin,x,y,z,r,r,r,pumpkin);
  local(f,materials.bark,x,y+r*.86,z,1.1,r*.45,1.1,cylinder);
  for(const sign of [-1,1])local(f,materials.amber,x+sign*r*.34,y+r*.14,z-r*.9,r*.5,r*.48,.1,eye);
  local(f,materials.amber,x,y-r*.22,z-r*.97,r*.65,r*.4,.1,mouth);
 }
 for(let i=0;i<96;i++){
  const t=(i+.25)/96,f=trackFrame(t);
  for(const side of [-1,1]){
   const x=side*(66+(i%3)*4),p=point(f,x,0);
   if(!clear(p,6)||opening(t,side,f))continue;
   local(f,materials.stone,x,-1,0,14,5,14);lantern(f,x,5,0,5.4+(i%3)*.4);
  }
 }
 // Low roadside lamps give the route scale without adding real light passes.
 for(let i=0;i<42;i++){
  const t=(i+.5)/42,f=trackFrame(t),side=i%2?1:-1,x=side*64;
  if(!clear(point(f,x,0),5)||opening(t,side,f))continue;
  local(f,materials.iron,x,20,0,1.5,42,1.5);local(f,materials.iron,x-side*6,40,0,13,1.3,1.3);
  local(f,materials.amber,x-side*11,38.5,0,4,2.5,4);
 }
 // Bent and forked silhouettes form a forest, with no geometry in the track
 // or shortcuts. Tree branches stay within the clearance radius checked here.
 for(let i=0;i<146;i++){
  const f=trackFrame((i+.2)/146),side=i%2?1:-1,x=side*(135+(i%4)*58),p=point(f,x,-12,(i%3-1)*22),h=66+(i*17%55);
  if(!clear(p,50))continue;
  const a=p.clone(),b=p.clone().add(new THREE.Vector3(side*6,h*.48,4)),c=p.clone().add(new THREE.Vector3(-side*6,h*.83,-5)),d=p.clone().add(new THREE.Vector3(side*12,h,-9));
  beam(materials.bark,a,b,5.2);beam(materials.bark,b,c,3.8);beam(materials.bark,c,d,2.1);
  for(const sign of [-1,1]){
   const start=p.clone().lerp(c,.55),elbow=start.clone().add(new THREE.Vector3(sign*21,h*.12,sign*7)),end=elbow.clone().add(new THREE.Vector3(sign*9,h*.18,-sign*8));
   beam(materials.bark,start,elbow,2.4);beam(materials.bark,elbow,end,1.3);
   beam(materials.bark,elbow,elbow.clone().add(new THREE.Vector3(-sign*7,15,11)),1.05);
   beam(materials.bark,p,p.clone().add(new THREE.Vector3(sign*11,1,sign*7)),2.9);
  }
 }
 // Cemetery columns, crooked headstones and iron finials identify the S bend.
 for(let row=0;row<4;row++)for(let col=0;col<8;col++){
  const f=trackFrame(.29+col*.006),side=-1,x=side*(103+row*30),p=point(f,x,0);
  if(!clear(p,14))continue;
  local(f,materials.moss,x,-3,0,23,4,16);local(f,materials.stone,x,8,0,12,20,5);
  local(f,materials.stone,x,18,0,6.5,6.5,3.1,rock);
  local(f,materials.slate,x,10,-2.6,1.3,8,.3);local(f,materials.slate,x,12,-2.6,6.3,1.3,.3);
  if((row+col)%4===0)lantern(f,x+8,3,-7,3.3);
 }
 for(let i=0;i<34;i++){
  const f=trackFrame(.275+i*.0023),x=-85;
  if(!clear(point(f,x,0),10))continue;
  local(f,materials.iron,x,9,0,1.1,22,1.1);local(f,materials.iron,x,22,0,1.9,4.5,1.9,cone);
  for(const y of [5,15])local(f,materials.iron,x,y,0,1.1,.8,trackLength*.0024);
 }

 // Manor on the outer sweep: asymmetrical wings, gables, witch-hat turrets,
 // inset windows and portico form a recognizable landmark at racing speed.
 const manorFrame=trackFrame(.17),manorX=-310,manorCenter=point(manorFrame,manorX,0);
 if(clear(manorCenter,148)){
  local(manorFrame,materials.moss,manorX,-15,0,220,36,150,rock);
  local(manorFrame,materials.stone,manorX,2,0,164,9,95);
  local(manorFrame,materials.plaster,manorX,57,0,112,110,74);
  local(manorFrame,materials.slate,manorX,112,0,124,55,89,roof);
  for(const sign of [-1,1]){
   local(manorFrame,materials.plaster,manorX+sign*76,43,4,44,82,64);
   local(manorFrame,materials.slate,manorX+sign*76,84,4,52,33,75,roof);
   local(manorFrame,materials.stone,manorX+sign*60,66,-29,16,132,16,cylinder);
   local(manorFrame,materials.slate,manorX+sign*60,152,-29,26,53,26,cone);
   local(manorFrame,materials.iron,manorX+sign*60,186,-29,1.7,23,1.7);
   for(let floor=0;floor<3;floor++)for(let col=0;col<2;col++){
    const x=manorX+sign*(21+col*25),y=28+floor*30;
    local(manorFrame,materials.slate,x,y,-37.7,12,20,.8);local(manorFrame,materials.amber,x,y,-38.2,7.5,15,.4);
    local(manorFrame,materials.iron,x,y,-38.6,.8,16,.3);local(manorFrame,materials.iron,x,y,-38.6,8,.8,.3);
   }
  }
  local(manorFrame,materials.slate,manorX,24,-38.2,20,42,.6);
  for(const dx of [-17,17])local(manorFrame,materials.stone,manorX+dx,17,-49,3.5,35,3.5);
  local(manorFrame,materials.slate,manorX,34,-47,48,20,31,roof);
  for(let i=0;i<5;i++)local(manorFrame,materials.stone,manorX,2+i*1.3,-70+i*3,42,2.6,14);
  lantern(manorFrame,manorX-30,5,-61,8);lantern(manorFrame,manorX+30,5,-61,8);
 }
 // Distant, layered rock/forest silhouettes keep the horizon authored yet cheap.
 for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,r=2050+(i%3)*150,p=new THREE.Vector3(Math.sin(a)*r,155,Math.cos(a)*r),h=150+(i*29%160);
  add(rock,materials.slate,p,[200+(i%4)*35,h,180]);
  add(cone,materials.bark,p.clone().add(new THREE.Vector3(0,h*.65,0)),[45,135,45]);
 }

 // Read actual curvature: bright outside chevrons telegraph braking corners.
 for(let i=0;i<160;i++){
  const t=i/160,f=trackFrame(t),after=trackFrame(t+.007),bend=f.tan.clone().cross(after.tan).y;
  if(Math.abs(bend)<.19)continue;
  const side=bend>0?1:-1,x=side*57;
  if(opening(t,side,f))continue;
  local(f,materials.dark,x,12,0,1.3,16,28);
  for(const dz of [-8,0,8]){
   const a=point(f,x-side*.9,17,dz-3),b=point(f,x-side*.9,12,dz+3),c=point(f,x-side*.9,7,dz-3);
   beam(materials.amber,a,b,.8);beam(materials.amber,b,c,.8);
  }
 }
 const start=trackFrame(0);
 for(const side of [-1,1]){
  local(start,materials.stone,side*60,24,0,12,49,18);
  local(start,materials.iron,side*60,52,0,18,9,24);
  lantern(start,side*60,62,0,10);
 }
 local(start,materials.iron,0,51,0,116,7,6);local(start,materials.amber,0,47.2,-3.2,113,.8,.4);
 // The finish line is flush and non-collidable. No decoration crosses driving space.
 for(let row=0;row<2;row++)for(let col=0;col<14;col++)local(start,(row+col)%2?materials.dark:materials.pale,-39+col*6,.11,row*5,6,.11,5);
 const signCanvas=typeof document!=='undefined'?document.createElement('canvas'):null;
 if(signCanvas){
  signCanvas.width=1024;signCanvas.height=192;const c=signCanvas.getContext('2d');
  c.fillStyle='#141925';c.fillRect(0,0,1024,192);c.strokeStyle='#f4ad62';c.lineWidth=8;c.strokeRect(8,8,1008,176);
  c.textAlign='center';c.fillStyle='#ffe7be';c.font='bold 76px sans-serif';c.fillText('LANTERN HOLLOW',512,96);
  c.fillStyle='#f4ad62';c.font='30px sans-serif';c.fillText('START / FINISH',512,151);
  const texture=new THREE.CanvasTexture(signCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(105,19.7),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  sign.position.copy(point(start,0,53,-3.3));sign.quaternion.copy(orientation(start));sign.rotateY(Math.PI);root.add(sign);
 }
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(14000,14000),materials.soil);ground.rotation.x=-Math.PI/2;ground.position.y=123;ground.receiveShadow=true;root.add(ground);
 const sky=new THREE.Mesh(new THREE.SphereGeometry(4400,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vSky;void main(){vec3 d=normalize(vSky);float h=smoothstep(-.08,.65,d.y);vec3 c=mix(vec3(.105,.075,.16),vec3(.018,.025,.065),h);float band=pow(max(0.,1.-abs(d.y-.10)*4.),4.);c+=vec3(.055,.027,.018)*band;gl_FragColor=vec4(c,1.);}'
 }));sky.name='Halloween twilight sky';root.add(sky);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(136,24,16),new THREE.MeshBasicMaterial({color:0xf5dcb5,fog:false}));moon.name='Harvest moon';moon.position.set(-1500,900,2900);root.add(moon);
 // Bats are a single static silhouette batch near the moon, with no animation work.
 const batShape=new THREE.Shape();batShape.moveTo(-1,0);batShape.lineTo(-.72,.38);batShape.lineTo(-.5,.16);batShape.lineTo(-.2,.3);batShape.lineTo(0,.13);batShape.lineTo(.2,.3);batShape.lineTo(.5,.16);batShape.lineTo(.72,.38);batShape.lineTo(1,0);batShape.lineTo(.45,-.05);batShape.lineTo(.15,-.22);batShape.lineTo(0,-.1);batShape.lineTo(-.15,-.22);batShape.lineTo(-.45,-.05);batShape.closePath();
 const batGeometry=new THREE.ShapeGeometry(batShape),batMaterial=new THREE.MeshBasicMaterial({color:0x101424,side:THREE.DoubleSide,fog:false});
 for(let i=0;i<18;i++)add(batGeometry,batMaterial,new THREE.Vector3(-1740+(i*137%520),700+(i*67%220),2700+(i%3)*65),[15+(i%3)*5,15+(i%3)*5,1]);
 let instances=0;
 for(const [material,geometries]of batches)for(const [geometry,matrices]of geometries){
  const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);mesh.name=`Halloween ${Object.keys(materials).find(k=>materials[k]===material)||'silhouette'} batch`;
  matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.receiveShadow=material.isMeshStandardMaterial;
  // Only the manor stonework and larger trees need shadow participation.
  mesh.castShadow=material===materials.plaster;
  root.add(mesh);instances+=matrices.length;
 }
 root.userData.diagnostics={static:true,instances,batches:root.children.filter(n=>n.isInstancedMesh).length,dynamicLights:0,roadHalfWidth:W};
 root.traverse(node=>{if(node.isMesh)node.userData.authoredShadows=true;});
 return root;
}
