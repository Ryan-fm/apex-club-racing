import * as THREE from './vendor/three/build/three.module.min.js';
import {routeWidth} from './track-routes.js';
import {projectTrack} from './driving-model.js';

export function createRouteView(routes,scene,mainSamples,mainWidth){
 const group=new THREE.Group();group.name='Optional roads';
 const roadMat=new THREE.MeshStandardMaterial({color:scene==='citadel'?0x555a50:0x152b35,roughness:scene==='harbor'?.42:.85,side:THREE.DoubleSide});
 const cube=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 for(const route of routes){
  const color=route.kind==='shortcut'?0x8be6a8:0x52dced,ink=new THREE.MeshBasicMaterial({color}),dark=new THREE.MeshStandardMaterial({color:0x263f47,metalness:.55,roughness:.5});
  const p=[],indices=[],railMatrices=[],markMatrices=[];
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
   for(const side of [-1,1]){const v=f.point.clone().addScaledVector(f.side,side*w);p.push(v.x,v.y,v.z);}
   if(i<120){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
   if(i<120&&i%2===0){
    const main=projectTrack(f.point.x,f.point.z,mainSamples);
    if(Math.sqrt(main.d2)>mainWidth(main.t)+w+4)for(const side of [-1,1]){
     railMatrices.push(matrix(f,side*(w+1),2.2,0,2,4,route.length/60+1));
     markMatrices.push(matrix(f,side*(w-1),.18,0,.9,.15,route.length/60+1));
    }
   }
   if(i>=18&&i<=100&&i%12===0){
    const fast=route.kind==='express'&&u>=.15&&u<=.85;
    // Wide paired chevrons communicate the direction and the acceleration surface.
    for(const side of [-1,1])markMatrices.push(matrix(f,side*5,.2,0,fast?1.8:1,.15,11,side*.65));
    if(fast)for(const side of [-1,1])markMatrices.push(matrix(f,side*17,.19,0,4,.12,12));
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,roadMat);mesh.receiveShadow=true;mesh.name=route.id;group.add(mesh);
  for(const [mat,matrices] of [[dark,railMatrices],[ink,markMatrices]])if(matrices.length){const batch=new THREE.InstancedMesh(cube,mat,matrices.length);matrices.forEach((m,i)=>batch.setMatrixAt(i,m));group.add(batch);}
  const f=frame(5),canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#102831';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=8;ctx.strokeRect(4,4,504,152);ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.font='bold 46px sans-serif';ctx.fillText(route.kind==='shortcut'?'近道 / SHORTCUT':'快速路 / EXPRESS',256,67);ctx.fillStyle='#e8f6ee';ctx.font='26px sans-serif';ctx.fillText(route.kind==='shortcut'?'窄路切弯 · 注意回流':'加速带 · 保持方向',256,117);
  const texture=new THREE.CanvasTexture(canvas),sign=new THREE.Mesh(new THREE.PlaneGeometry(42,13),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  sign.position.copy(f.point).addScaledVector(f.normal,23);sign.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));group.add(sign);
 }
 return group;
}
export function updateRouteMap(routes,node){
 node.innerHTML=routes.map(r=>`<polyline fill="none" stroke="${r.kind==='shortcut'?'#8be6a8':'#52dced'}" stroke-width="2" points="${r.samples.filter((_,i)=>i%4===0).map(p=>`${(p.x/1350*63+90).toFixed(1)},${(p.z/1350*63+70).toFixed(1)}`).join(' ')}"/>`).join('');
}
