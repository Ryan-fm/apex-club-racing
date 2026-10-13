import * as THREE from './vendor/three/build/three.module.min.js';
import {projectTrack} from './driving-model.js';
import {applyCitySurface,cityTexturesReady} from './city-materials.js';
import {RGBELoader} from './vendor/three/examples/jsm/loaders/RGBELoader.js';

// Original scene geometry/materials, authored against the PC replay reference.
 // No original game files or extracted meshes are used. Surface photography is CC0.
export function createElevenCity(frame,length,routes=[]){
 const root=new THREE.Group();root.name='Eleven City / PC reconstruction';
 const boxGeo=new THREE.BoxGeometry(1,1,1),ballGeo=new THREE.IcosahedronGeometry(1,2),poleGeo=new THREE.CylinderGeometry(1,1,1,10),leafGeo=new THREE.PlaneGeometry(1,1),trunkGeo=new THREE.CylinderGeometry(.55,1,1,10);
 const pose=new THREE.Object3D(),batches=new Map(),up=new THREE.Vector3(0,1,0);
 const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const marble=mat(0xe2e9e7),band=mat(0xaebec6),pale=mat(0xf4efe0),blue=mat(0x416a93,.55,.2),steel=mat(0x334b56,.48,.65),cream=mat(0xe1cea0),orange=mat(0xb85d3d),wood=mat(0x88634b),grass=mat(0x65a942),trunk=mat(0x796148),pink=mat(0xfca8c9),white=mat(0xf8f1ce),yellow=mat(0xffd979);
 const cyan=new THREE.MeshStandardMaterial({color:0x88dbff,emissive:0x39baff,emissiveIntensity:.28,roughness:.35});
 const leaves=[mat(0x439334),mat(0x5ca83b),mat(0x78b349)];
 applyCitySurface(marble,'concrete_floor_02',.038);applyCitySurface(pale,'concrete_floor_02',.038);applyCitySurface(band,'concrete_floor_02',.038);applyCitySurface(trunk,'bark_brown_02',.07);
 const plazaMat=applyCitySurface(mat(0xd9d5c9,.92),'pavement_03',.045),gardenSoil=mat(0x584932);
 function add(geo,material,position,scale,rotation=null,cosmetic=false){
  pose.position.copy(position);pose.scale.set(...scale);rotation?pose.quaternion.copy(rotation):pose.quaternion.identity();pose.updateMatrix();
  if(!batches.has(material))batches.set(material,new Map());const geometries=batches.get(material),key=geo.uuid+String(cosmetic);
  if(!geometries.has(key))geometries.set(key,{geo,matrices:[],cosmetic});geometries.get(key).matrices.push(pose.matrix.clone());
 }
 const worldBox=(m,x,y,z,sx,sy,sz,q=null)=>add(boxGeo,m,new THREE.Vector3(x,y,z),[sx,sy,sz],q);
 function local(f,m,x,y,z,sx,sy,sz){const p=f.p.clone().addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));add(boxGeo,m,p,[sx,sy,sz],q);}
 const samples=Array.from({length:1601},(_,i)=>{const p=frame(i/1600).p;return {x:p.x,z:p.z};}),roads=[samples,...routes.map(r=>r.samples)];
 const clear=(x,z,radius)=>roads.every(s=>projectTrack(x,z,s).d2>(44+radius+9)**2);
 function open(t,side,f){const p=f.p.clone().addScaledVector(f.side,side*57);return routes.some(r=>r.samples.some(a=>Math.abs(a.t-t)<.025&&Math.hypot(a.x-p.x,a.z-p.z)<r.halfWidth+18));}
 function canvasTexture(width,height,paint){const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;}
 function textureSign(title,subtitle,bg='#24466d',fg='#ecf8ff'){
  return canvasTexture(1024,256,(ctx,w,h)=>{ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle=fg;ctx.lineWidth=10;ctx.strokeRect(8,8,w-16,h-16);ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='italic bold 100px Arial';ctx.fillText(title,w/2,130);ctx.font='bold 30px Arial';ctx.fillText(subtitle,w/2,204);});
 }
 function panel(texture,position,width,height,forward){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.copy(position);mesh.lookAt(position.clone().add(forward));mesh.userData.cosmeticDecal=true;root.add(mesh);return mesh;}

 // Continuous ground under the entire district, with stepped pavement beside the road.
 const turf=applyCitySurface(mat(0xdce6bb),'grass_ground',.045);turf.normalScale.set(.23,.23);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),turf);ground.rotation.x=-Math.PI/2;ground.position.y=9.4;ground.receiveShadow=true;root.add(ground);
 const contactMap=canvasTexture(128,128,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,7,w/2,h/2,w/2);g.addColorStop(0,'rgba(18,29,18,.65)');g.addColorStop(.55,'rgba(18,29,18,.3)');g.addColorStop(1,'rgba(18,29,18,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}),contactMat=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,opacity:.55}),flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 // Swept profiles meet vertex for vertex, keeping the inside of hairpins smooth.
 // These low curbs sit below the chase camera anchor and do not occlude its boom.
 const curbProfile=[[44,-.6],[44,1.8],[54,1.8],[54,5.8],[64,5.8],[90,5.8],[90,-.6]],curbMaterials=[marble,marble,band,pale,plazaMat,marble],curbBatches=new Map();
 const pavementCount=Math.ceil(length/7),pavementFrames=Array.from({length:pavementCount+1},(_,i)=>frame(i/pavementCount));
 function curbVertex(f,side,v){return f.p.clone().addScaledVector(f.side,side*v[0]).addScaledVector(f.normal,v[1]);}
 for(let i=0;i<pavementCount;i++)for(const side of [-1,1]){
  const a=pavementFrames[i],b=pavementFrames[i+1];if(open((i+.5)/pavementCount,side,frame((i+.5)/pavementCount)))continue;
  for(let j=0;j<curbProfile.length-1;j++){
   const material=curbMaterials[j];if(!curbBatches.has(material))curbBatches.set(material,{p:[],idx:[]});const batch=curbBatches.get(material),n=batch.p.length/3;
   for(const point of [curbVertex(a,side,curbProfile[j]),curbVertex(b,side,curbProfile[j]),curbVertex(a,side,curbProfile[j+1]),curbVertex(b,side,curbProfile[j+1])])batch.p.push(point.x,point.y,point.z);
   batch.idx.push(n,n+1,n+2,n+2,n+1,n+3);
  }
 }
 for(const [material,{p,idx}]of curbBatches){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;mesh.userData.cameraIgnore=true;root.add(mesh);}
 const furnitureCount=Math.ceil(length/15);
 for(let i=0;i<furnitureCount;i++){
  const t=i/furnitureCount,f=frame(t),len=length/furnitureCount+1;
  for(const side of [-1,1]){
   if(open(t,side,f))continue;
   if(t<.045||t>.976){local(f,blue,side*49,4,0,3.4,8,len);if(i%3===0)local(f,cyan,side*47.1,4,0,.35,1.1,2.4);}
  }
 }
 // Connected chord rails follow bends, with regularly spaced posts and pickets.
 const fenceCount=Math.ceil(length/27);
 for(let i=0;i<fenceCount;i++)for(const side of [-1,1]){
  const t=(i+.5)/fenceCount,f=frame(t);if(t<.045||t>.976||open(t,side,f))continue;
  const a=frame(i/fenceCount),b=frame((i+1)/fenceCount),pa=a.p.clone().addScaledVector(a.side,side*62),pb=b.p.clone().addScaledVector(b.side,side*62),direction=pb.clone().sub(pa),mid=pa.clone().add(pb).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction.clone().normalize());
  for(const y of [8,14.5])add(boxGeo,steel,mid.clone().addScaledVector(up,y),[.7,.7,direction.length()+.1],q);
  add(boxGeo,steel,pa.clone().addScaledVector(up,11),[1.2,10,1.2]);
  for(let j=1;j<5;j++)add(boxGeo,steel,pa.clone().lerp(pb,j/5).addScaledVector(up,11.25),[.5,6.5,.5]);
 }
 // Yellow medians and white arrows read like a city street rather than a neon strip.
 const count=Math.floor(length/60);
 for(let i=0;i<count;i++){
  const f=frame(i/count);local(f,yellow,0,.08,0,.7,.08,14);
  if(i%4===0)for(const side of [-1,1]){local(f,white,side*24,.1,0,1.3,.1,13);local(f,white,side*24,.1,6,5,.1,1.1);}
 }

 // Dedicated building facades: glazing, inset windows, mullions and sandstone bands.
 const facadeTextures=[];
 for(let style=0;style<4;style++)facadeTextures.push(canvasTexture(512,1024,(ctx,w,h)=>{
  ctx.fillStyle=['#b8d4d9','#9bc5d3','#decba3','#c0c4bd'][style];ctx.fillRect(0,0,w,h);
  for(let row=0;row<16;row++)for(let col=0;col<6;col++){
   const x=col*w/6+6,y=row*h/16+6,ww=w/6-12,hh=h/16-12;
   ctx.fillStyle='#527887';ctx.fillRect(x-2,y-2,ww+4,hh+4);const gradient=ctx.createLinearGradient(x,y,x+ww,y+hh);
   gradient.addColorStop(0,['#c2edf5','#d2f1f2','#fff1b1','#d1e6de'][style]);gradient.addColorStop(.45,['#479daf','#3487a3','#b1a152','#539aa3'][style]);gradient.addColorStop(1,style===2?'#877343':'#426b83');ctx.fillStyle=gradient;ctx.fillRect(x,y,ww,hh);
   ctx.fillStyle='#bad5db';ctx.fillRect(x+ww*.5-1,y,2,hh);ctx.fillRect(x,y+hh*.65,ww,2);
   if((row+col*3)%7===0){ctx.fillStyle='#d8e9e0';ctx.fillRect(x+3,y+3,ww-6,hh*.35);}
  }
 }));
 const facadeMats=facadeTextures.map(map=>new THREE.MeshPhysicalMaterial({map,color:0xb5cad0,roughness:.23,metalness:.48,envMapIntensity:.9,clearcoat:.7,clearcoatRoughness:.17}));
 const entranceGlass=new THREE.MeshPhysicalMaterial({color:0x295363,metalness:.5,roughness:.16,clearcoat:1,envMapIntensity:1.1});
 const leafMap=canvasTexture(512,512,(ctx,w,h)=>{
  ctx.clearRect(0,0,w,h);let seed=937;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let branch=0;branch<16;branch++){
   const a=random()*Math.PI*2,len=90+random()*125,cx=w/2+(random()-.5)*95,cy=h/2+(random()-.5)*95,dx=Math.cos(a),dy=Math.sin(a);
   ctx.strokeStyle='#667344';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+dx*len,cy+dy*len);ctx.stroke();
   for(let j=0;j<10;j++)for(const side of [-1,1]){
    const u=(j+.5)/10,x=cx+dx*len*u-dy*side*12,y=cy+dy*len*u+dx*side*12,size=10+random()*8;
    ctx.save();ctx.translate(x,y);ctx.rotate(a+side*.65);const g=ctx.createLinearGradient(-size,0,size,0);g.addColorStop(0,['#446633','#50713b','#628a43'][branch%3]);g.addColorStop(.5,['#8ba85b','#a1b96d','#7f9e52'][branch%3]);g.addColorStop(1,'#527237');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,size,size*.4,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#718a47';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size,0);ctx.stroke();ctx.restore();
   }
  }
 });
 leaves.forEach(m=>{m.color.set(0xffffff);m.map=leafMap;m.alphaTest=.5;m.side=THREE.DoubleSide;m.roughness=.92;m.envMapIntensity=.25;});
 const shopTextures=[textureSign('CITY GALLERY','ELEVEN / DOWNTOWN DISTRICT','#3d6d85'),textureSign('ELEVEN ARCADE','CAFES / SHOPS / CITY LIFE','#536b65'),textureSign('GRAND AVENUE','CITY OFFICES / EST. 2011','#7c694d'),textureSign('CENTRAL PLAZA','DOWNTOWN / CULTURE / DESIGN','#52687d')];
 const roundGeo=new THREE.CylinderGeometry(.5,.5,1,32),roundMap=facadeTextures[3].clone();roundMap.wrapS=THREE.RepeatWrapping;roundMap.repeat.x=3;roundMap.needsUpdate=true;
 const roundFacade=facadeMats[3].clone();roundFacade.map=roundMap;
 function building(x,z,w,d,h,style=0,angle=0){
  const q=new THREE.Quaternion().setFromAxisAngle(up,angle);
  worldBox(plazaMat,x,13,z,w+28,5,d+28,q);add(leafGeo,contactMat,new THREE.Vector3(x,9.48,z),[(w+20)*1.45,(d+20)*1.45,1],flat,true);
  worldBox(marble,x,10,z,w+10,18,d+10,q);worldBox(band,x,20,z,w+12,2,d+12,q);
  if(style===3)add(roundGeo,roundFacade,new THREE.Vector3(x,22+h/2,z),[w,h,d],q);else worldBox(facadeMats[style%4],x,22+h/2,z,w,h,d,q);
  if(style!==3)for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2]){const p=new THREE.Vector3(dx,0,dz).applyQuaternion(q);worldBox(style%2?cream:marble,x+p.x,24+h/2,z+p.z,3.5,h+8,3.5,q);}
  for(let y=35;y<h+20;y+=28){if(style===3)add(roundGeo,marble,new THREE.Vector3(x,y,z),[w+2,.9,d+2],q);else{worldBox(marble,x,y,z,w+2,.85,d+2,q);worldBox(band,x,y-2,z,w+1,.55,d+1,q);}}
  if(style===3){add(roundGeo,pale,new THREE.Vector3(x,h+24,z),[w+9,5,d+9],q);add(roundGeo,band,new THREE.Vector3(x,h+28,z),[w+4,3,d+4],q);}else{worldBox(pale,x,h+24,z,w+9,5,d+9,q);worldBox(band,x,h+28,z,w+4,3,d+4,q);}
  worldBox(style%2?cream:marble,x,h+39,z,w*.78,20,d*.78,q);worldBox(blue,x,h+50,z,w*.7,2,d*.7,q);
  // Architectural setbacks and rooftop plant avoid a single cuboid silhouette.
  worldBox(facadeMats[(style+1)%4],x,h+70,z,w*.48,37,d*.52,q);worldBox(pale,x,h+91,z,w*.55,5,d*.59,q);
  for(const sign of [-1,1])worldBox(steel,x+sign*w*.18,h+100,z,4,16,4,q);
  if(style===2)for(const dx of [-w*.28,w*.28])for(const side of [-1,1]){const p=new THREE.Vector3(dx,0,side*(d/2+1.5)).applyQuaternion(q);worldBox(cream,x+p.x,22+h/2,z+p.z,3.5,h,3.5,q);}
  // Street-level doorways, glazed retail and canopies anchor the facade to a usable plaza.
  for(const direction of [-1,1]){
   const entrance=new THREE.Vector3(0,0,direction*(d/2+1)).applyQuaternion(q);
   worldBox(entranceGlass,x+entrance.x,29,z+entrance.z,w*.72,17,2,q);
   for(const dx of [-w*.26,0,w*.26]){const p=new THREE.Vector3(dx,0,direction*(d/2+2.2)).applyQuaternion(q);worldBox(steel,x+p.x,29,z+p.z,1.3,18,1.3,q);}
   const canopy=new THREE.Vector3(0,0,direction*(d/2+5)).applyQuaternion(q);worldBox(band,x+canopy.x,40,z+canopy.z,w*.86,2,11,q);
   for(let step=0;step<3;step++){const p=new THREE.Vector3(0,0,direction*(d/2+8+step*3)).applyQuaternion(q);worldBox(marble,x+p.x,17.5-step,z+p.z,w*.55,2,6,q);}
  }
  const front=new THREE.Vector3(0,0,d/2+.3).applyQuaternion(q).add(new THREE.Vector3(x,36,z));panel(shopTextures[style%4],front,w*.8,10,new THREE.Vector3(0,0,1).applyQuaternion(q));
 }
 const lots=[
 [1240,-500,100,92,210,0],[1240,-80,110,88,290,1],[1230,360,100,92,190,2],
 [900,150,82,94,170,1],[900,560,78,90,270,0],[620,180,82,90,220,2],[620,560,80,90,160,1],
 [340,120,80,90,195,0],[340,510,78,92,265,3],[60,100,80,90,170,1],
 [-220,280,80,88,220,0],[-520,-10,102,90,165,2],[-870,-20,92,90,220,1],
 [-1220,260,100,100,190,0],[-1220,-250,110,90,285,3],[-1220,-710,100,90,180,2],
 [720,-780,106,92,190,1],[290,-760,104,90,255,0],[-110,-730,100,90,180,2],
 [1150,-1290,120,110,240,0],[-180,-1260,118,106,225,2],[-800,-1210,120,105,250,1]
 ];
 for(const [x,z,w,d,h,style]of lots)if(clear(x,z,Math.hypot(w,d)/2+6))building(x,z,w,d,h,style);

 // The rounded civic pavilion and glazed dome echo the original city skyline.
 function pavilion(x,z){
  const radius=66;if(!clear(x,z,radius+8))return;
  for(const [r,y,h,m]of [[82,10,16,marble],[73,23,10,band],[67,48,45,facadeMats[1]],[75,73,4,pale],[63,93,35,facadeMats[0]],[68,112,5,marble]])add(new THREE.CylinderGeometry(r,r,h,48),m,new THREE.Vector3(x,y,z),[1,1,1]);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(63,48,24,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:0x83c5d4,metalness:.35,roughness:.28,clearcoat:.8}));dome.position.set(x,114,z);dome.scale.y=.5;dome.castShadow=true;root.add(dome);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;worldBox(marble,x+Math.cos(a)*67,69,z+Math.sin(a)*67,3,85,3);}
  const crown=new THREE.Mesh(new THREE.TorusGeometry(65,2,8,64),pale);crown.rotation.x=Math.PI/2;crown.position.set(x,115,z);root.add(crown);
 }
 pavilion(1310,810);pavilion(-900,-1090);

 // Stepped garden islands occupy the space between fingers of the course.
 const flowerBeds=[];
 function garden(x,z,w,d){
  if(![-.5,0,.5].every(dx=>[-.5,0,.5].every(dz=>clear(x+dx*w,z+dz*d,0))))return;
  for(const [y,s]of [[8,1],[11,.92],[14,.83]])worldBox(marble,x,y,z,w*s,3,d*s);
  worldBox(grass,x,16,z,w*.8,1,d*.8);
  for(const side of [-1,1])for(let i=0;i<5;i++)flowerBeds.push([x+side*w*.32,z+(i-2)*d*.14]);
  // Faceted white garden braces, similar to the diagonal inlays on PC flower walls.
  for(const side of [-1,1]){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),side*.48);worldBox(pale,x+side*w*.45,12,z,3,12,d*.82,q);}
 }
 for(const [x,z,w,d]of [[900,360,120,160],[620,360,125,170],[340,305,120,175],[60,410,118,155],[-220,100,120,170],[-520,235,138,150],[-870,240,145,140],[320,-760,120,90],[-110,-730,115,100]])garden(x,z,w,d);
 for(let i=0;i<flowerBeds.length;i++){
  const [x,z]=flowerBeds[i];for(let n=0;n<10;n++){
   const px=x+(n%5-2)*2.2,pz=z+(Math.floor(n/5)-.5)*3;
   add(poleGeo,grass,new THREE.Vector3(px,18.4,pz),[.12,2.8,.12],null,true);
   add(ballGeo,i%3===0?white:i%3===1?pink:yellow,new THREE.Vector3(px,20,pz),[1.15,.7,1.15],null,true);
  }
 }
 function tree(x,z,scale=1){
  if(!clear(x,z,26*scale))return;
  add(leafGeo,contactMat,new THREE.Vector3(x,9.49,z),[52*scale,52*scale,1],flat,true);worldBox(gardenSoil,x,9.65,z,7*scale,.3,7*scale);
  add(trunkGeo,trunk,new THREE.Vector3(x,25*scale+5,z),[1.9*scale,34*scale,1.9*scale]);
  let seed=(Math.floor(x*31+z*73)>>>0)+1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<7;i++){
   const a=i*2.4,start=new THREE.Vector3(x,31*scale+5,z),end=new THREE.Vector3(x+Math.sin(a)*13*scale,47*scale+(i%3)*5*scale,z+Math.cos(a)*13*scale),delta=end.clone().sub(start),q=new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize());
   add(trunkGeo,trunk,start.clone().add(end).multiplyScalar(.5),[.9*scale,delta.length(),.9*scale],q);
  }
  for(let i=0;i<48;i++){
   const a=random()*Math.PI*2,r=Math.sqrt(random())*20*scale,h=45*scale+random()*21*scale,p=new THREE.Vector3(x+Math.sin(a)*r,h,z+Math.cos(a)*r),q=new THREE.Quaternion().setFromEuler(new THREE.Euler((random()-.5)*1.8,random()*Math.PI*2,random()*.8-.4));
   add(leafGeo,leaves[i%3],p,[23*scale,22*scale,1],q);
  }
 }
 for(let i=0;i<80;i++){const t=(i+.5)/80,f=frame(t);for(const side of [-1,1]){const p=f.p.clone().addScaledVector(f.side,side*(104+(i%3)*8));tree(p.x,p.z,.8+(i%4)*.08);}}
 // Distant buildings and tree belts close the horizon; nothing floats in open space.
 let block=0;
 function cityBlock(x,z){const i=block++,w=100+i%3*24,d=94+i%4*12,h=75+(i*37%140);building(x,z,w,d,h,i%4);if(i%3===0)building(x+105,z+115,62,62,55+i%4*17,(i+1)%4);tree(x-82,z-77,.82);}
 for(const x of [-1800,-1500,1490,1790])for(let z=-1350;z<1300;z+=300)cityBlock(x,z);
 for(const z of [-1640,-1940,1210,1510])for(let x=-1180;x<1320;x+=300)cityBlock(x,z);
 // Wood benches, flower pots, banners and twin streetlights supply human scale.
 const bannerTex=textureSign('11','CITY GRAND PRIX','#bc4667');
 for(let i=0;i<52;i++){
  const t=(i+.35)/52,f=frame(t),side=i%2?1:-1;
  if(open(t,side,f))continue;
  const p=f.p.clone().addScaledVector(f.side,side*77);
  if(!clear(p.x,p.z,5))continue;
  local(f,steel,side*77,23,0,1.2,46,1.2);
  local(f,steel,side*69,45,0,17,1.2,1.2);local(f,marble,side*68,44,0,8,1.2,4);local(f,cyan,side*68,43.6,0,7,.2,3);
  if(i%3===0)panel(bannerTex,f.p.clone().addScaledVector(f.side,side*78).addScaledVector(f.normal,29),10,22,f.tan.clone().negate());
  if(i%4===0){
   for(const y of [3,8])for(const dx of [-7,7])local(f,steel,side*86,y,dx,1,6,1);
   for(const z of [-3,-1,1,3])local(f,wood,side*86,7,z,20,.8,1.4);
   local(f,wood,side*90,12,0,1.2,7,20);
  }
 }

 // Amber U-turn disks and large icy-blue arrows, photographed in the PC reference.
 const uTurnTex=canvasTexture(256,256,(ctx,w,h)=>{ctx.fillStyle='#edaf34';ctx.beginPath();ctx.arc(w/2,h/2,119,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5b3d1a';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#413f32';ctx.lineWidth=25;ctx.beginPath();ctx.moveTo(74,185);ctx.lineTo(74,110);ctx.arc(128,110,54,Math.PI,0);ctx.lineTo(182,185);ctx.stroke();ctx.fillStyle='#413f32';ctx.beginPath();ctx.moveTo(160,158);ctx.lineTo(203,158);ctx.lineTo(182,200);ctx.fill();});
 const arrowTex=canvasTexture(256,128,(ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.shadowColor='#39b9ff';ctx.shadowBlur=15;ctx.fillStyle='#68cfff';for(const x of [12,94,176]){ctx.beginPath();ctx.moveTo(x,13);ctx.lineTo(x+52,64);ctx.lineTo(x,115);ctx.lineTo(x+20,115);ctx.lineTo(x+73,64);ctx.lineTo(x+20,13);ctx.fill();}});
 const arrowMat=new THREE.MeshBasicMaterial({map:arrowTex,transparent:true,alphaTest:.2,side:THREE.DoubleSide});
 let lastTurn=-1;
 for(let i=0;i<520;i++){
  const t=i/520,f=frame(t),ahead=frame(t+.0025),bend=f.tan.clone().cross(ahead.tan).y;
  if(Math.abs(bend)<.09||t-lastTurn<.028)continue;lastTurn=t;
  const side=bend>0?1:-1;
  if(open(t,side,f))continue;
  const position=f.p.clone().addScaledVector(f.side,side*74).addScaledVector(f.normal,26);
  const disk=new THREE.Mesh(new THREE.CircleGeometry(9,36),new THREE.MeshBasicMaterial({map:uTurnTex,side:THREE.DoubleSide,transparent:true,alphaTest:.3}));disk.position.copy(position);disk.lookAt(position.clone().add(f.tan.clone().negate()));disk.userData.cosmeticDecal=true;root.add(disk);
  local(f,steel,side*74,12,0,1.2,24,1.2);
  for(let k=0;k<3;k++){
   const a=frame(t+k*.0016),p=a.p.clone().addScaledVector(a.side,side*48).addScaledVector(a.normal,9);
   const arrow=new THREE.Mesh(new THREE.PlaneGeometry(20,10),arrowMat);arrow.position.copy(p);arrow.lookAt(p.clone().add(a.tan.clone().negate()));arrow.scale.x=side;arrow.userData.cosmeticDecal=true;root.add(arrow);
  }
 }

 // Monumental start gallery: terracotta piers, silver frame, checkerboard "11" emblem.
 const gateOffset=120,start=frame(gateOffset/length),gate=new THREE.Group();gate.name='Eleven City start gallery';gate.position.copy(start.p);gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(start.side.clone().negate(),start.normal,start.tan));root.add(gate);
 function gateBox(m,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(boxGeo,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;gate.add(mesh);return mesh;}
 for(const side of [-1,1]){
  gateBox(orange,side*67,44,0,22,88,24);gateBox(marble,side*65,10,0,31,20,32);
  gateBox(band,side*55,40,-9,4,77,6);gateBox(pale,side*50,38,-11,2,73,3);
  for(let i=0;i<7;i++)gateBox(blue,side*(51+i*1.3),31,-8+i*3,1.3,57,1.3);
  gateBox(cream,side*67,89,0,25,4,28);
 }
 gateBox(marble,0,79,0,138,13,24);gateBox(band,0,71,-12,110,3,3);gateBox(pale,0,87,0,149,3,28);
 const emblem=canvasTexture(1024,256,(ctx,w,h)=>{ctx.fillStyle='#204979';ctx.fillRect(0,0,w,h);for(let x=0;x<16;x++)for(let y=0;y<4;y++)if((x+y)%2===0){ctx.fillStyle='#e6f5f8';ctx.fillRect(x*64,y*64,64,64);}ctx.fillStyle='#234f8b';ctx.beginPath();ctx.moveTo(250,0);ctx.lineTo(800,0);ctx.lineTo(720,256);ctx.lineTo(180,256);ctx.fill();ctx.fillStyle='#ffd138';ctx.font='italic bold 260px Arial';ctx.textAlign='center';ctx.fillText('11',500,230);ctx.fillStyle='#ffffff';ctx.font='bold 28px Arial';ctx.fillText('ELEVEN CITY',880,142);});
 for(const sign of [-1,1]){const banner=new THREE.Mesh(new THREE.PlaneGeometry(124,28),new THREE.MeshBasicMaterial({map:emblem,side:THREE.DoubleSide}));banner.position.set(0,83,sign*12.1);if(sign<0)banner.rotation.y=Math.PI;gate.add(banner);}
 for(let x=0;x<16;x++)for(let z=0;z<2;z++)gateBox((x+z)%2?white:steel,(x-7.5)*5.4,.08,z*3-2-gateOffset,5.4,.1,3);
 for(let row=0;row<4;row++)for(const side of [-1,1]){const f=frame((1-(row+1)*28/length)%1);local(f,white,side*15,.08,0,14,.1,1);local(f,white,side*22,.08,-3,1,.1,6);}

 // Bright cyan sky, cloud wisps and distant balloons are part of the original visual language.
 const sky=new THREE.Mesh(new THREE.SphereGeometry(4600,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 pSky;void main(){pSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 pSky;void main(){vec3 d=normalize(pSky);float h=smoothstep(-.08,.75,d.y);vec3 c=mix(vec3(.10,.66,.9),vec3(.015,.35,.78),h);float sun=pow(max(0.,dot(d,normalize(vec3(-.5,.65,.3)))),75.);c+=sun*vec3(.5,.37,.18);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));sky.userData.cameraIgnore=true;root.add(sky);
 let skyComplete;const skyReady=new Promise(resolve=>skyComplete=resolve);
 new RGBELoader().load(new URL('./assets/city/daylight-sky.hdr',import.meta.url).href,texture=>{sky.material.dispose();sky.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,depthWrite:false,fog:false,color:0xdddddd});sky.rotation.y=.4;skyComplete();},undefined,()=>skyComplete());
 for(const [x,y,z]of [[-1500,500,1100],[1650,570,400],[-200,630,1600]]){add(ballGeo,orange,new THREE.Vector3(x,y,z),[18,26,18],null,true);worldBox(wood,x,y-37,z,8,7,8);for(const side of [-1,1])worldBox(cream,x+side*6,y-27,z,1,20,1);}
 for(const [material,geometries]of batches)for(const {geo,matrices,cosmetic}of geometries.values()){
  const mesh=new THREE.InstancedMesh(geo,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.castShadow=!cosmetic;mesh.receiveShadow=!cosmetic;mesh.userData.cosmeticDecal=cosmetic;root.add(mesh);
 }
 root.userData.texturesReady=Promise.all([cityTexturesReady(),skyReady]);let captured=false,capturing=false;
 root.userData.captureEnvironment=async(renderer,scene)=>{
  if(captured||capturing)return;capturing=true;await root.userData.texturesReady;
  if(!root.visible){capturing=false;return;}
  const cubeTarget=new THREE.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter}),probe=new THREE.CubeCamera(1,6000,cubeTarget);probe.position.set(-150,85,-200);probe.update(renderer,scene);
  const generator=new THREE.PMREMGenerator(renderer),reflection=generator.fromCubemap(cubeTarget.texture);generator.dispose();cubeTarget.dispose();
  for(const m of [...facadeMats,roundFacade,entranceGlass]){m.envMap=reflection.texture;m.needsUpdate=true;}
  root.userData.reflectionTarget=reflection;captured=true;capturing=false;
 };
 root.userData.reference='https://www.bilibili.com/video/BV1Qc41187Fw/';return root;
}
