import * as THREE from './vendor/three/build/three.module.min.js';
import {applyRoadFinish} from './track-finish.js';
import {routeWidth} from './track-routes.js';
import {projectTrack} from './driving-model.js';

export function createRouteView(routes,scene,mainSamples,mainWidth){
 const group=new THREE.Group();group.name='Optional roads';
 const roadMat=new THREE.MeshStandardMaterial({color:scene==='citadel'?0x555a50:scene==='canyon'?0x3d3530:0x152b35,roughness:scene==='harbor'?.42:.85,side:THREE.DoubleSide});
 applyRoadFinish(roadMat);
 const cube=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 for(const route of routes){
  const color=route.kind==='shortcut'?0x8be6a8:0x52dced,ink=new THREE.MeshBasicMaterial({color}),dark=new THREE.MeshStandardMaterial({color:0x263f47,metalness:.55,roughness:.5});
  const p=[],indices=[],railMatrices=[],markMatrices=[],edgeMatrices=[],uv=[];
  const frame=i=>{
   const a=route.samples[Math.max(0,i-1)],b=route.samples[Math.min(120,i+1)],point=route.samples[i];
   const tan=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize(),side=new THREE.Vector3().crossVectors(tan,up).normalize(),normal=new THREE.Vector3().crossVectors(side,tan).normalize();
   return {point:new THREE.Vector3(point.x,point.y+.08,point.z),tan,side,normal};
  };
  const matrix=(f,x,y,z,sx,sy,sz,yaw=0)=>{
   pose.position.copy(f.point).addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z);
   pose.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));
   if(yaw)pose.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up,yaw));
   pose.scale.set(sx,sy,sz);pose.updateMatrix();return pose.matrix.clone();
  };
  for(let i=0;i<=120;i++){
   const f=frame(i),u=i/120,w=routeWidth(route,u,scene);
   for(const side of [-1,1]){const v=f.point.clone().addScaledVector(f.side,side*w);p.push(v.x,v.y,v.z);uv.push(side<0?0:1,u*route.length/24);}
   if(i<120){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
   if(i<120&&i%2===0){
    const main=projectTrack(f.point.x,f.point.z,mainSamples);
    if(Math.sqrt(main.d2)>mainWidth(main.t)+w+4)for(const side of [-1,1]){
     railMatrices.push(matrix(f,side*(w+2),2.8,0,1.8,4.5,route.length/60+1));
     edgeMatrices.push(matrix(f,side*(w+1),-.6,0,3,1.2,route.length/60+1));
     if(i%6===0)railMatrices.push(matrix(f,side*(w+2),1.4,0,1.2,3,1.4));
     markMatrices.push(matrix(f,side*(w-1),.18,0,.9,.15,route.length/60+1));
    }
   }
   if(i>=6&&i<=114&&i%6===0){
    const fast=route.kind==='express'&&u>=.15&&u<=.85;
    // Wide paired chevrons communicate the direction and the acceleration surface.
    for(const side of [-1,1])markMatrices.push(matrix(f,side*5,.2,0,fast?1.8:1,.15,11,side*.65));
    if(fast)for(const side of [-1,1])markMatrices.push(matrix(f,side*17,.19,0,4,.12,12));
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,roadMat);mesh.receiveShadow=true;mesh.name=route.id;group.add(mesh);
  // A solid deck skirt removes the floating-paper appearance of branch roads.
  const skirt=[],skirtIndices=[];
  for(let i=0;i<=120;i++)for(const side of [0,1]){
   const k=i*6+side*3;skirt.push(p[k],p[k+1],p[k+2],p[k],p[k+1]-3,p[k+2]);
   if(i<120){const a=i*4+side*2,b=a+4;skirtIndices.push(a,b,a+1,a+1,b,b+1);}
  }
  const sk=new THREE.BufferGeometry();sk.setAttribute('position',new THREE.Float32BufferAttribute(skirt,3));sk.setIndex(skirtIndices);sk.computeVertexNormals();group.add(new THREE.Mesh(sk,dark));
  for(const [mat,matrices] of [[dark,railMatrices],[ink,markMatrices],[new THREE.MeshStandardMaterial({color:scene==='canyon'?0xb0987a:0x899899,roughness:.95}),edgeMatrices]])if(matrices.length){const batch=new THREE.InstancedMesh(cube,mat,matrices.length);matrices.forEach((m,i)=>batch.setMatrixAt(i,m));group.add(batch);}
  const f=frame(12),canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#102831';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=8;ctx.strokeRect(4,4,504,152);ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.font='bold 46px sans-serif';ctx.fillText(route.kind==='shortcut'?'近道 / SHORTCUT':'快速路 / EXPRESS',256,67);ctx.fillStyle='#e8f6ee';ctx.font='26px sans-serif';ctx.fillText(route.kind==='shortcut'?'入口收窄 · 沿绿线回流':'蓝色加速带 · 沿箭头出弯',256,117);
  const texture=new THREE.CanvasTexture(canvas),sign=new THREE.Mesh(new THREE.PlaneGeometry(32,10),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  sign.position.copy(f.point).addScaledVector(f.side,route.halfWidth+8).addScaledVector(f.normal,20);sign.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side,f.normal,f.tan.clone().negate()));group.add(sign);
  const end=frame(110),exitCanvas=document.createElement('canvas');exitCanvas.width=512;exitCanvas.height=128;const ex=exitCanvas.getContext('2d');
  ex.fillStyle='#102831';ex.fillRect(0,0,512,128);ex.fillStyle='#'+color.toString(16).padStart(6,'0');ex.font='bold 40px sans-serif';ex.textAlign='center';ex.fillText('回流主路 / MERGE',256,77);
  const exitTexture=new THREE.CanvasTexture(exitCanvas);exitTexture.colorSpace=THREE.SRGBColorSpace;texture.colorSpace=THREE.SRGBColorSpace;
  const exit=new THREE.Mesh(new THREE.PlaneGeometry(28,7),new THREE.MeshBasicMaterial({map:exitTexture,side:THREE.DoubleSide}));exit.position.copy(end.point).addScaledVector(end.side,route.halfWidth+8).addScaledVector(end.normal,17);exit.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(end.side,end.normal,end.tan.clone().negate()));group.add(exit);
 }
 return group;
}
export function updateRouteMap(routes,node){
 node.innerHTML=routes.map(r=>`<polyline fill="none" stroke="${r.kind==='shortcut'?'#8be6a8':'#52dced'}" stroke-width="2" points="${r.samples.filter((_,i)=>i%4===0).map(p=>`${(p.x/1350*63+90).toFixed(1)},${(p.z/1350*63+70).toFixed(1)}`).join(' ')}"/>`).join('');
}
