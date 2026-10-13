import * as THREE from './vendor/three/build/three.module.min.js';

let roadNormal;
function roadNormalTexture(){
 if(roadNormal)return roadNormal;
 const size=128,heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);let seed=317;
 for(let i=0;i<heights.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;heights[i]=(seed>>>24)/255;}
 const height=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const normal=new THREE.Vector3((height(x-1,y)-height(x+1,y))*.65,(height(x,y-1)-height(x,y+1))*.65,1).normalize();
  data.set([Math.round((normal.x*.5+.5)*255),Math.round((normal.y*.5+.5)*255),Math.round((normal.z*.5+.5)*255),255],(y*size+x)*4);
 }
 roadNormal=new THREE.DataTexture(data,size,size);roadNormal.wrapS=roadNormal.wrapT=THREE.RepeatWrapping;
 roadNormal.repeat.set(8,2);roadNormal.magFilter=THREE.LinearFilter;roadNormal.minFilter=THREE.LinearMipmapLinearFilter;roadNormal.generateMipmaps=true;roadNormal.anisotropy=4;roadNormal.needsUpdate=true;
 return roadNormal;
}

// Shared road finish across main and optional roads, without texture downloads.
export function applyRoadFinish(material){
 material.normalMap=roadNormalTexture();material.normalScale.set(.24,.24);
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  previous?.call(material,shader);
  shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;');
  shader.fragmentShader='varying vec3 vFinishPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float aggregate=fract(sin(dot(floor(vFinishPosition.xz*3.),vec2(12.9898,78.233)))*43758.5453);
   float detail=1.-smoothstep(.4,1.4,max(fwidth(vFinishPosition.x*3.),fwidth(vFinishPosition.z*3.)));
   aggregate=mix(.5,aggregate,detail);
   float wear=.5+.5*sin(vFinishPosition.x*.035+vFinishPosition.z*.013);
   diffuseColor.rgb*=.92+aggregate*.12+wear*.035;
   roughnessFactor=clamp(roughnessFactor+(aggregate-.5)*.1*detail,.22,1.);
  `);
 };
 return material;
}

export function createTrackFinish(frame,length,width,opening,theme){
 const root=new THREE.Group();root.name='Circuit detailing';
 const steel=new THREE.MeshStandardMaterial({color:theme==='canyon'?0x695346:0x465560,roughness:.55,metalness:.55});
 const concrete=new THREE.MeshStandardMaterial({color:theme==='canyon'?0xb4a08b:0x8b999b,roughness:.92});
 const paint=new THREE.MeshStandardMaterial({color:0xf0e5c3,roughness:.8});
 const cube=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D(),batches=new Map();
 function box(f,mat,x,y,sx,sy,sz){
  pose.position.copy(f.p).addScaledVector(f.side,x).addScaledVector(f.normal,y);
  pose.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));pose.scale.set(sx,sy,sz);pose.updateMatrix();
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(pose.matrix.clone());
 }
 const count=Math.ceil(length/17);
 for(let i=0;i<count;i++){
  const t=i/count,f=frame(t),w=width(t),len=length/count+1;
  for(const side of [-1,1]){
   if(opening(t,side,f))continue;
   box(f,concrete,side*(w+2.2),-.65,4.5,1.3,len);
   box(f,steel,side*(w+.7),.08,.6,.18,len);
   if(i%3===0)box(f,paint,side*(w-2.7),.13,.65,.13,4);
   if(i%6===0)box(f,steel,side*(w+4.5),2.3,1.1,5,1.3);
  }
 }
 // Repeated outside-turn panels can be read before reaching the apex.
 const atlas=document.createElement('canvas');atlas.width=256;atlas.height=128;const ctx=atlas.getContext('2d');
 ctx.fillStyle='#142932';ctx.fillRect(0,0,256,128);ctx.strokeStyle='#f4d491';ctx.lineWidth=8;ctx.strokeRect(4,4,248,120);
 ctx.fillStyle='#f4d491';for(const x of [45,110,175]){ctx.beginPath();ctx.moveTo(x,23);ctx.lineTo(x+35,64);ctx.lineTo(x,105);ctx.lineTo(x+18,105);ctx.lineTo(x+53,64);ctx.lineTo(x+18,23);ctx.fill();}
 const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;
 const signMat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
 for(let i=0;i<120;i++){
  const t=i/120,f=frame(t),next=frame(t+.006),turn=f.tan.x*next.tan.z-f.tan.z*next.tan.x;
  if(Math.abs(turn)<.035||i%3!==0)continue;
  const side=turn>0?-1:1;if(opening(t,side,f))continue;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(21,10),signMat);
  panel.position.copy(f.p).addScaledVector(f.side,side*(width(t)+10)).addScaledVector(f.normal,10);
  // Face approaching traffic; flip the graphic for left turns.
  panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side,f.normal,f.tan.clone().negate()));panel.scale.x=turn>0?1:-1;
  panel.userData.cosmeticDecal=true;root.add(panel);
  box(f,steel,side*(width(t)+10),4.5,1,9,1);
 }
 for(const [material,matrices]of batches){const mesh=new THREE.InstancedMesh(cube,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;root.add(mesh);}
 return root;
}
