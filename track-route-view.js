import * as THREE from './vendor/three/build/three.module.min.js';
import {applyRoadFinish} from './track-finish.js';
import {routeWidth} from './track-routes.js';
import {projectTrack} from './driving-model.js';

export function createRouteView(routes,scene,mainSamples,mainWidth,mainFrame=null){
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
  function label(point,tan,side,normal,title,subtitle,color=0x8be6a8,width=36,height=11,elevation=17,supportSide=1,supportOffset=17){
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=192;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#102831';ctx.fillRect(0,0,640,192);ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=9;ctx.strokeRect(5,5,630,182);
   ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.fillText(title,320,79);ctx.fillStyle='#e8f6ee';ctx.font='30px sans-serif';ctx.fillText(subtitle,320,142);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.copy(point);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,normal,tan.clone().negate()));group.add(mesh);
   const poleHeight=elevation-height/2;
   const pole=new THREE.Mesh(cube,dark);pole.position.copy(point).addScaledVector(side,-supportSide*supportOffset).addScaledVector(normal,-(elevation+height/2)/2);pole.quaternion.setFromUnitVectors(up,normal);pole.scale.set(1.2,poleHeight,1.2);group.add(pole);
   const bracket=new THREE.Mesh(cube,dark);bracket.position.copy(point).addScaledVector(side,-supportSide*supportOffset/2).addScaledVector(normal,-height/2);bracket.quaternion.copy(mesh.quaternion);bracket.scale.set(supportOffset,.8,1.2);group.add(bracket);
   return mesh;
  }
  if(route.kind==='shortcut'){
   // A readable fork ahead of the braking point; the main road remains available.
   const split=frame(26),w=routeWidth(route,26/120,scene);
   for(const side of [-1,1]){
    railMatrices.push(matrix(split,side*(w+3),5,0,2,10,2));
    markMatrices.push(matrix(split,side*(w+3),9,0,3,2,3));
   }
   if(mainFrame){
    const mainLength=mainSamples.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-mainSamples[i].x,p.z-mainSamples[i].z),0);
    const before=mainFrame(route.start-110/mainLength),at=mainFrame(route.start+(route.end-route.start)*26/120);
    const forkSide=Math.sign(split.point.clone().sub(at.p).dot(at.side))||1;
    const arrow=forkSide>0?'右侧近道':'左侧近道';
    label(before.p.clone().addScaledVector(before.side,forkSide*(mainWidth(route.start)+13)).addScaledVector(before.normal,17),before.tan,before.side,before.normal,`${arrow} / ${route.name}`,route.technical?'提前入线 · 窄路切弯':'保持入线 · 顺弯通过',color,34,10,17,forkSide,11);
    // Short approach marks identify the useful entry lane before it splits.
    for(const distance of [52,36,20]){
     const f=mainFrame(route.start-distance/mainLength),w=mainWidth(route.start);
     const af={point:f.p.clone().addScaledVector(f.normal,.13),tan:f.tan,side:f.side,normal:f.normal};
     for(const side of [-1,1])markMatrices.push(matrix(af,forkSide*w*.42+side*3,.04,0,.9,.1,8,side*.65));
    }
   }
   const saved=Math.floor(route.savedDistance/route.mainLength*100),apex=frame(52);
   label(apex.point.clone().addScaledVector(apex.side,route.halfWidth+20).addScaledVector(apex.normal,15),apex.tan,apex.side,apex.normal,route.name,`${route.technical?'精准切弯':'顺弯内线'} · 路程少绕 ${saved}%`,color,30,9,15);
  }
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
  const f=frame(12);
  label(f.point.clone().addScaledVector(f.side,route.halfWidth+20).addScaledVector(f.normal,20),f.tan,f.side,f.normal,route.kind==='shortcut'?route.name:'快速路 / EXPRESS',route.kind==='shortcut'?(route.technical?'窄路切弯 · 顺势回流':'顺弯内线 · 保持方向'):'蓝色加速带 · 沿箭头出弯',color,26,9,20);
  const end=frame(110);
  label(end.point.clone().addScaledVector(end.side,route.halfWidth+20).addScaledVector(end.normal,17),end.tan,end.side,end.normal,'回流主路 / MERGE','出口放宽 · 顺势出弯',color,28,9);

 }
 return group;
}
export function updateRouteMap(routes,node){
 node.innerHTML=routes.map(r=>`<polyline fill="none" stroke="${r.kind==='shortcut'?'#8be6a8':'#52dced'}" stroke-width="2" points="${r.samples.filter((_,i)=>i%4===0).map(p=>`${(p.x/1350*63+90).toFixed(1)},${(p.z/1350*63+70).toFixed(1)}`).join(' ')}"/>`).join('');
}
