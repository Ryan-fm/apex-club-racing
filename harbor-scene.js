import * as THREE from 'three';

// Static harbor scenery is batched by material; no per-building lights or animation.
export function createHarbor(trackFrame,trackLength,halfWidth=()=>38){
 const root=new THREE.Group();root.name='Neon Harbor';
 const cube=new THREE.BoxGeometry(1,1,1),pose=new THREE.Object3D(),batches=new Map();
 const steel=new THREE.MeshStandardMaterial({color:0x354f69,metalness:.65,roughness:.36});
 const concrete=new THREE.MeshStandardMaterial({color:0x63748c,roughness:.7});
 const glass=new THREE.MeshStandardMaterial({color:0x152c48,metalness:.8,roughness:.22});
 const cyan=new THREE.MeshBasicMaterial({color:0x57ddd9}),pink=new THREE.MeshBasicMaterial({color:0xe978a2}),warm=new THREE.MeshBasicMaterial({color:0xe9bb75});
 const containers=[0x345c6c,0x804c60,0x9a643d].map(color=>new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.4}));
 function box(mat,x,y,z,sx,sy,sz,q=null){pose.position.set(x,y,z);pose.scale.set(sx,sy,sz);q?pose.quaternion.copy(q):pose.quaternion.identity();pose.updateMatrix();if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(pose.matrix.clone());}
 function local(f,mat,x,y,z,sx,sy,sz){const p=f.p.clone().addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z);const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));box(mat,p.x,p.y,p.z,sx,sy,sz,q);}
 function beam(mat,a,b,width){const delta=b.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),p=a.clone().add(b).multiplyScalar(.5);box(mat,p.x,p.y,p.z,width,delta.length(),width,q);}
 // Continuous cool guardrails, amber braking markers and raised dock foundations.
 for(let i=0;i<480;i++){
  const f=trackFrame(i/480),w=halfWidth(i/480),len=trackLength/480+2;
  local(f,concrete,0,-7,0,w*2+15,12,len);
  for(const side of [-1,1]){local(f,steel,side*(w+2),3,0,3,6,len);local(f,i%12<2?warm:cyan,side*(w+1),6.2,0,.7,.45,len-1);}
  if(i%16===0)for(const side of [-1,1]){local(f,steel,side*(w+11),22,0,1.6,44,1.6);local(f,steel,side*(w+5),43,0,14,1.5,2);local(f,warm,side*(w+4),42,0,12,.45,2);}
 }

 // A luminous launch gallery frames the first climb. All ribs share the box batches.
 const point=(f,x,y,z=0)=>f.p.clone().addScaledVector(f.side,x).addScaledVector(f.normal,y).addScaledVector(f.tan,z);
 function arch(t,index){
  const f=trackFrame(t),w=halfWidth(t)+9,color=index%3?cyan:pink;
  const vertices=[[-w,0],[-w,34],[-w+17,56],[w-17,56],[w,34],[w,0]];
  for(let j=0;j<vertices.length-1;j++){
   const a=point(f,...vertices[j]),b=point(f,...vertices[j+1]);beam(steel,a,b,3.8);
   beam(color,a.clone().addScaledVector(f.tan,-2),b.clone().addScaledVector(f.tan,-2),.75);
  }
 }
 for(let i=0;i<12;i++)arch(.007+i*.0034,i);
 // Covered dock slalom: spaced ribs preserve visibility of upcoming turns.
 for(let i=0;i<10;i++)arch(.46+i*.003,i+1);
 // Light wells and piles make the raised road read as a structure, not a floating ribbon.
 for(let i=0;i<72;i++){
  const f=trackFrame(i/72),height=Math.max(12,f.p.y-76),w=halfWidth(i/72);
  for(const side of [-1,1]){const p=point(f,side*(w-5),-height/2-7);box(steel,p.x,p.y,p.z,7,height,7);local(f,cyan,side*(w+3),-5,0,.5,1.2,trackLength/72*.65);}
 }
 // Readable braking chevrons on the outside of genuinely sharp bends.
 for(let i=0;i<100;i++){
  const t=i/100,f=trackFrame(t),after=trackFrame(t+.008),bend=f.tan.clone().cross(after.tan).y;
  if(Math.abs(bend)<.25)continue;
  const side=bend>0?1:-1,w=halfWidth(t)+7;
  local(f,steel,side*w,15,0,2,19,36);
  for(let k=-1;k<=1;k++){
   const a=point(f,side*(w-1.2),19,k*10-3),b=point(f,side*(w-1.2),14,k*10+3),c=point(f,side*(w-1.2),9,k*10-3);
   beam(warm,a,b,1.3);beam(warm,b,c,1.3);
  }
 }
 // A central orbital turbine is visible from both the upper and lower route.
 const core=new THREE.Group();core.position.set(0,285,0);root.add(core);
 for(let i=0;i<3;i++){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(100+i*18,2.2,8,96),i===1?pink:cyan);
  ring.rotation.set(Math.PI*.32+i*.35,.4+i*.7,.2);core.add(ring);
 }
 const hub=new THREE.Mesh(new THREE.IcosahedronGeometry(30,1),new THREE.MeshStandardMaterial({color:0x3acddd,emissive:0x167984,emissiveIntensity:.65,metalness:.7,roughness:.25}));core.add(hub);
 for(const x of [-45,45]){box(steel,x,167,0,10,184,14);box(pink,x+6,172,0,1,164,2);}
 // Gradient night sky and a large moon create separation behind the dark structures.
 const sky=new THREE.Mesh(new THREE.SphereGeometry(4400,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
 vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec3 vSky;void main(){vec3 d=normalize(vSky);float h=smoothstep(-.08,.65,d.y);vec3 c=mix(vec3(.13,.12,.27),vec3(.012,.035,.09),h);float band=pow(max(0.,1.-abs(d.y-.12)*3.),4.);c+=vec3(.02,.025,.05)*band;gl_FragColor=vec4(c,1.);}' }));root.add(sky);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(115,24,16),new THREE.MeshBasicMaterial({color:0xb7d7ef,fog:false}));moon.position.set(-1750,1750,2700);root.add(moon);
 // Warehouses and container stacks flank the route; corrugated ribs catch the light.
 for(let i=0;i<36;i++){
  const f=trackFrame((i+.3)/36),side=i%2?1:-1,offset=side*(100+(i%3)*20);
  local(f,concrete,offset,-10,0,95,18,95);
  if(i%3===0){local(f,steel,offset,26,0,82,55,70);local(f,concrete,offset,56,0,90,4,78);local(f,warm,offset-side*42,35,0,.7,3,54);}
  else for(let level=0;level<2+(i%2);level++)for(let stack=0;stack<2;stack++){
   const x=offset+side*stack*25,y=level*15+8;const mat=containers[(i+level)%3];local(f,mat,x,y,0,22,14,55);
   for(let rib=0;rib<9;rib++)local(f,steel,x-side*11.2,y,-24+rib*6,.45,12,.6);
   local(f,concrete,x,y+7.3,0,22,.5,55);
  }
 }
 // Two crane silhouettes and suspension bridge pylons provide turn landmarks.
 for(const t of [.18,.66]){const f=trackFrame(t);for(const x of [-95,95])local(f,containers[2],x,70,0,8,140,9);local(f,containers[2],0,140,0,230,9,12);local(f,warm,0,134,0,220,1,2);local(f,steel,34,112,0,1,50,1);local(f,steel,34,87,0,14,3,10);}
 for(const t of [.04,.085]){const f=trackFrame(t);for(const side of [-1,1]){local(f,concrete,side*53,61,0,10,122,12);local(f,pink,side*48,68,0,.8,95,1);for(const z of [-140,-110,-80,-50,50,80,110,140]){const a=f.p.clone().addScaledVector(f.side,side*53).addScaledVector(f.normal,119),b=f.p.clone().addScaledVector(f.side,side*43).addScaledVector(f.tan,z).addScaledVector(f.normal,8);beam(steel,a,b,.9);}}local(f,steel,0,120,0,116,5,12);}
 // Gantry bracing, warning stripes and lit cabins give the cranes mechanical scale.
 for(const t of [.18,.66]){const f=trackFrame(t);
  for(const side of [-1,1])for(let y=10;y<125;y+=25){beam(steel,point(f,side*99,y,-6),point(f,side*91,y+25,6),2);local(f,warm,side*95,y,0,8.3,2,9.3);}
  for(let x=-100;x<100;x+=20){beam(steel,point(f,x,145,-5),point(f,x+20,160,-5),1.7);beam(steel,point(f,x,160,-5),point(f,x+20,145,-5),1.7);}
  local(f,steel,0,162,0,235,3,14);local(f,glass,35,128,-8,17,12,14);local(f,cyan,35,128,-15.2,13,7,.4);
 }
 // A distant skyline uses a shared window batch rather than hundreds of lights.
 for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,r=1950+(i%3)*140,x=Math.cos(a)*r,z=Math.sin(a)*r,h=100+(i*47%240);
  box(glass,x,60+h/2,z,70+(i%4)*18,h,85);
  box(i%3?cyan:pink,x,62+h,z,75,.9,88);
  for(let floor=0;floor<h/18;floor++)for(let col=0;col<4;col++)if((floor+col+i)%4!==0)box(i%4?warm:cyan,x-26+col*17,75+floor*18,z-43,7,3,.4);
 }
 const water=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),new THREE.MeshStandardMaterial({color:0x102f43,metalness:.75,roughness:.25}));water.rotation.x=-Math.PI/2;water.position.y=75;root.add(water);
 for(let i=0;i<70;i++)box(i%3?cyan:pink,-1700+(i*137%3400),75.1,-1600+(i*211%3200),2+(i%4),.1,12+(i%7)*8);
 for(const [mat,matrices]of batches){const mesh=new THREE.InstancedMesh(cube,mat,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.castShadow=mat===steel||mat===concrete;mesh.receiveShadow=true;root.add(mesh);}
 return root;
}
