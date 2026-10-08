import * as THREE from 'three';
import {createArmoredKart} from './armored-kart.js';
import {vehicleMaterials,bevelGeometry,sportWheel} from './vehicle-finish.js';
export function makeCraft(color=0xffb24c,scale=1){
  const g=new THREE.Group(),model=new THREE.Group();g.add(model);
  const surfaces=vehicleMaterials(color),{paint,rubber,metal,dark,seat,glass,lens}=surfaces;
  function box(w,h,d,x,y,z,mat=paint){const m=new THREE.Mesh(bevelGeometry(w,h,d,Math.min(.18,h*.22)),mat);m.position.set(x,y,z);model.add(m);return m;}
  function round(w,h,d,x,y,z,mat=paint){const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),mat);m.scale.set(w,h,d);m.position.set(x,y,z);model.add(m);return m;}
  box(8.6,1.3,12,0,-1.8,0,dark);
  // Sculpted nose and side pods leave a real cockpit opening instead of a solid oval body.
  function shell(outline,y,depth,mat=paint){const shape=new THREE.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,bevelSize:.28,bevelThickness:.22,steps:1});geo.rotateX(-Math.PI/2);const m=new THREE.Mesh(geo,mat);m.position.y=y;model.add(m);return m;}
  shell([[-3.1,7.8],[-4.4,5.6],[-3.6,2.1],[3.6,2.1],[4.4,5.6],[3.1,7.8]],-.9,1.35);
  shell([[-3.4,7.95],[-4.6,5.7],[-4,2],[4,2],[4.6,5.7],[3.4,7.95]],-1.28,.23,dark);
  for(const side of [-1,1]){
   box(1.7,1.25,6.6,side*3.85,-.35,-1.1);box(.2,.7,4.8,side*4.72,-.3,-1.4,dark);
   for(let i=0;i<5;i++)box(.25,.08,.38,side*4.86,-.12,-2.8+i*.68,metal);
   box(.14,.11,3.8,side*2.5,.71,4.7,metal);box(.6,.18,1.8,side*3.6,.75,3.3,dark);
   box(.8,.18,.26,side*3.2,-.72,7.95,metal);
  }
  box(3,.22,2,0,.68,2.9,dark);for(let i=0;i<5;i++)box(2.6,.06,.12,0,.83,2.15+i*.36,metal);
  box(.6,.15,6.5,0,.77,4.7,metal);
  box(9.6,.7,1.0,0,-1.35,7.9,dark);
  const wheels=[],fins=[],engines=[],spoilers=[];
  for(const side of [-1,1]){
    for(const z of [-4.4,4.6]){
      const hub=new THREE.Group();hub.position.set(side*5.5,-1.4,z);model.add(hub);
      const tire=sportWheel(surfaces,side);hub.add(tire,tire.userData.caliper);
      wheels.push({hub,tire,front:z>0});
    }
    box(1.1,.24,4.4,side*4,.41,-1.2);
    spoilers.push(box(.28,3.8,.4,side*3.5,1.25,-5.8,dark));
    const end=box(.3,1.2,2.2,side*5.2,3,-5.8);fins.push(end);spoilers.push(end);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.48,12,8),lens);lamp.scale.set(1.8,.55,.6);lamp.position.set(side*3,.1,7);model.add(lamp);
    box(1.5,.38,.3,side*3.4,-.25,-6.7,new THREE.MeshBasicMaterial({color:0xff6755}));
    const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.6,.72,1.7,12),metal);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*2.1,-1.4,-7);model.add(exhaust);
    const flameMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{tint:{value:new THREE.Color(0x57bfff)},time:{value:0},power:{value:.4}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float time;uniform float power;void main(){float a=pow(1.-vUv.y,1.8)*(.85+.15*sin(vUv.y*30.-time*35.));gl_FragColor=vec4(mix(tint,vec3(.9,1.,1.),pow(1.-vUv.y,5.))*1.6,a*.8);}`});
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.6,1,14,6,true),flameMat);flame.rotation.x=-Math.PI/2;flame.position.set(side*2.1,-1.4,-8);model.add(flame);engines.push(flame);
  }
  spoilers.push(box(10.5,.5,2.4,0,2.6,-5.8));
  spoilers.push(box(6.5,.12,1.5,0,2.9,-5.8,metal));
  // Driver, seat, helmet and dark visor make the kart scale immediately legible.
  box(3.5,1,3.7,0,-.2,-1.7,seat);
  box(3.25,3,.55,0,1,-3.15,seat);
  for(const side of [-1,1]){box(.38,2.1,2.9,side*1.65,.3,-1.9,seat);box(.26,2.1,.1,side*.72,1.35,-2.82,paint);}
  for(let i=0;i<6;i++)box(2.2,.035,.035,0,.5,-2.8+i*.42,dark);
  const beforeDriver=new Set(model.children);
  round(1.5,1.7,1.2,0,2,-1.2,seat);
  round(1.85,1.8,1.8,0,4.3,-.8,new THREE.MeshPhysicalMaterial({color:0xf3f0e3,roughness:.24,clearcoat:1}));
  for(const side of [-1,1]){round(.4,.45,.28,side*1.65,4.3,-.3,metal);box(.18,1.6,.15,side*.65,2.1,.03,metal);round(.5,.45,.5,side*1.2,2,1.8,paint);}
  round(1.6,.65,.8,0,4.4,.5,glass);
  // Helmet band and rear vents remain readable from the chase camera.
  for(const side of [-1,1]){box(.12,.44,1.2,side*.58,5.75,-.7,dark);box(.12,.25,.5,side*.55,4.5,-2.55,dark);}
  const helmetBand=new THREE.Mesh(new THREE.TorusGeometry(1.68,.06,6,40),metal);helmetBand.rotation.x=Math.PI/2;helmetBand.position.set(0,3.83,-.8);model.add(helmetBand);
  const steering=new THREE.Mesh(new THREE.TorusGeometry(1.15,.16,8,16),dark);steering.rotation.x=-.65;steering.position.set(0,1.8,1.6);model.add(steering);
  for(const side of [-1,1])round(.48,.48,1.3,side*1.2,1.9,.7,dark);
  const occupant=new THREE.Group();occupant.name='Race driver';for(const part of [...model.children])if(!beforeDriver.has(part)&&part!==steering)occupant.add(part);model.add(occupant);
  // Reusable body kits can be switched without rebuilding or leaking GPU resources.
  const kits={drift:new THREE.Group(),rally:new THREE.Group(),retro:new THREE.Group()};
  for(const kit of Object.values(kits)){model.add(kit);kit.visible=false;}
  kits.drift.add(box(11.4,.3,2.8,0,-1.4,7.2,dark));
  kits.drift.add(box(11.7,.38,2.5,0,4,-5.8,paint));
  for(const side of [-1,1]){
    kits.drift.add(box(.35,2,2.8,side*5.7,3.2,-5.8,dark));
    kits.drift.add(box(1.5,.55,8,side*4.8,-1.1,.2,paint));
    kits.drift.add(box(.18,.12,6.5,side*4.9,-.77,.2,metal));
    kits.rally.add(box(.4,6.5,.4,side*3.1,2,-2.8,dark));
    kits.rally.add(box(.4,5,.4,side*3.1,1,1.5,dark));
    kits.rally.add(box(.4,.4,4.6,side*3.1,5.1,-.7,dark));
    kits.rally.add(round(.9,.9,.55,side*2.3,5.4,1.55,metal));
    kits.rally.add(round(.65,.65,.2,side*2.3,5.4,2,new THREE.MeshBasicMaterial({color:0xffe9a3})));
    kits.rally.add(box(1.6,1,7,side*4.9,-.65,.5,paint));
    kits.retro.add(round(.85,.85,.55,side*3.5,.6,7.45,metal));
    kits.retro.add(round(.64,.64,.2,side*3.5,.6,7.9,new THREE.MeshBasicMaterial({color:0xfff3d1})));
    kits.retro.add(box(.18,.2,10,side*4.4,.2,.3,metal));
  }
  kits.rally.add(box(6.5,.4,.4,0,5.1,-2.8,dark));
  kits.rally.add(box(6.5,.4,.4,0,5.1,1.5,dark));
  kits.rally.add(box(10,.65,1.4,0,-.7,8.3,metal));
  kits.retro.add(round(2.5,1.25,1,0,.1,7.7,dark));
  for(let n=-3;n<=3;n++)kits.retro.add(box(.14,1.6,.2,n*.6,.1,8.6,metal));
  kits.retro.add(box(9.7,.48,.7,0,-1.1,8.8,metal));
  kits.retro.add(round(4.2,.65,1.8,0,.2,-5.5,paint));
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(18,23),new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.015,.04,.05,(1.-smoothstep(.3,1.,d))*.55);}`}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-3.4;g.add(shadow);
  g.userData={model,engines,fins,shadow,wheels,kits,spoilers,legacy:{model,engines,wheels}};g.scale.setScalar(scale);return g;
}
export function configureKart(kart,definition){
  const data=kart.userData;
  if(definition.style==='rally'){
    if(!data.armored){data.armored=createArmoredKart();kart.add(data.armored);}
    data.legacy.model.visible=false;data.armored.visible=true;
    data.model=data.armored;data.engines=data.armored.userData.engines;data.wheels=data.armored.userData.wheels;data.fx=data.armored.userData.fx;
    data.shadow.scale.set(1.15,1.12,1);return;
  }
  if(data.armored)data.armored.visible=false;
  Object.assign(data,data.legacy);data.model.visible=true;data.fx=null;data.shadow.scale.set(1,1,1);
  kart.userData.model.scale.set(...definition.scale);
  Object.entries(kart.userData.kits).forEach(([style,kit])=>{kit.visible=style===definition.style;});
  kart.userData.spoilers.forEach(part=>{part.visible=definition.style!=='retro';});
  kart.userData.wheels.forEach(w=>{
    w.hub.scale.setScalar(definition.style==='rally'?1.13:1);
    w.hub.position.y=definition.style==='rally'?-1.12:-1.4;
  });
}
