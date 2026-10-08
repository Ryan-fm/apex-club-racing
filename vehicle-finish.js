import * as THREE from 'three';

// Shared surface definitions keep showroom, race and exported geometry consistent.
export function vehicleMaterials(color){
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:.48,roughness:.26,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.15});paint.userData.craftColor=true;paint.userData.bodyPaint=true;
 return {paint,
 metal:new THREE.MeshStandardMaterial({color:0x9aaab5,metalness:.94,roughness:.24,envMapIntensity:1.3}),
 dark:new THREE.MeshStandardMaterial({color:0x16212b,metalness:.42,roughness:.43}),
 rubber:new THREE.MeshStandardMaterial({color:0x111619,metalness:0,roughness:.93}),
 seat:new THREE.MeshStandardMaterial({color:0x232e36,metalness:0,roughness:.96}),
 glass:new THREE.MeshPhysicalMaterial({color:0x122734,metalness:.62,roughness:.13,clearcoat:1,clearcoatRoughness:.06}),
 lens:new THREE.MeshPhysicalMaterial({color:0xc2e9f1,metalness:.2,roughness:.12,clearcoat:1,emissive:0x68b7d0,emissiveIntensity:.18})};
}
export function bevelGeometry(w,h,d,r=.12){
 r=Math.min(r,w*.22,h*.22,d*.22);const shape=new THREE.Shape(),x=w/2-r,y=h/2-r;
 shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:r>0,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:1});geo.translate(0,0,-(d-2*r)/2);return geo;
}
export function tireGeometry(radius,width){
 const profile=[[.61,-.37],[.73,-.49],[.89,-.48],[.975,-.37],[1,-.23],[1,0],[1,.23],[.975,.37],[.89,.48],[.73,.49],[.61,.37],[.61,-.37]].map(([r,y])=>new THREE.Vector2(r*radius,y*width));
 const geo=new THREE.LatheGeometry(profile,40);geo.rotateZ(Math.PI/2);return geo;
}
export function sportWheel(materials,side){
 const spin=new THREE.Group(),{rubber,metal,dark,paint}=materials;
 const add=(geo,mat,x=0)=>{const m=new THREE.Mesh(geo,mat);m.position.x=x;m.castShadow=true;m.receiveShadow=true;spin.add(m);return m;};
 const disc=(r,depth,mat,x)=>{const geo=new THREE.CylinderGeometry(r,r,depth,32);geo.rotateZ(Math.PI/2);return add(geo,mat,x);};
 const ring=(r,t,mat,x)=>{const geo=new THREE.TorusGeometry(r,t,8,40);geo.rotateY(Math.PI/2);return add(geo,mat,x);};
 add(tireGeometry(2.15,1.8),rubber);
 // Recessed brake rotor, caliper, rim lip and spokes at distinct depths.
 disc(1.32,.11,metal,side*.48);disc(.64,.14,dark,side*.62);
 const caliper=add(bevelGeometry(.23,.86,.45,.07),paint,side*.64);caliper.position.z=.9;spin.userData.caliper=caliper;
 ring(1.5,.12,metal,side*.9);ring(1.31,.055,dark,side*.92);ring(1.84,.028,rubber,side*.88);
 const spokes=new THREE.InstancedMesh(bevelGeometry(.16,.91,.17,.06),metal,6);
 const boltGeo=new THREE.CylinderGeometry(.085,.085,.09,8);boltGeo.rotateZ(Math.PI/2);
 const bolts=new THREE.InstancedMesh(boltGeo,metal,6),hardwarePose=new THREE.Object3D();
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;hardwarePose.position.set(side*.89,Math.cos(a)*.88,Math.sin(a)*.88);hardwarePose.rotation.set(a,0,0);hardwarePose.updateMatrix();spokes.setMatrixAt(i,hardwarePose.matrix);
  hardwarePose.position.set(side*1.02,Math.cos(a)*.31,Math.sin(a)*.31);hardwarePose.rotation.set(0,0,0);hardwarePose.updateMatrix();bolts.setMatrixAt(i,hardwarePose.matrix);
 }
 spokes.castShadow=true;spin.add(spokes,bolts);
 disc(.37,.18,dark,side*.95);disc(.19,.2,paint,side*.98);
 const grooves=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.032,.29),dark,72),pose=new THREE.Object3D();
 for(let i=0;i<36;i++)for(let j=0;j<2;j++){const a=i*Math.PI/18;pose.position.set((j?1:-1)*.49,Math.cos(a)*2.152,Math.sin(a)*2.152);pose.rotation.set(a,0,j?.45:-.45);pose.updateMatrix();grooves.setMatrixAt(i*2+j,pose.matrix);}spin.add(grooves);
 return spin;
}
export function createVehicleEnvironment(renderer){
 const room=new THREE.Scene();room.background=new THREE.Color(0x293640);
 const add=(color,intensity,x,y,z,w,h)=>{const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});material.color.multiplyScalar(intensity);const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);panel.position.set(x,y,z);panel.lookAt(0,0,0);room.add(panel);};
 add(0xeaf3ff,2.5,-14,13,9,5,21);add(0xffecd2,3.2,7,19,8,17,4);add(0x97cae2,1.7,17,5,-12,4,20);add(0xffffff,1.2,-8,5,-18,13,3);
 const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(room,.045);generator.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target;
}
