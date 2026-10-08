import * as THREE from 'three';
import {sanitizeCustomization} from './garage-config.js';

function removeLivery(model){const old=model.getObjectByName('Custom livery');if(!old)return;const materials=new Set();old.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());old.removeFromParent();}
export function applyCustomization(kart,value,factoryColor){
 const config=sanitizeCustomization(value),model=kart.userData.model;
 // Every selection reapplies the complete finish, including factory reset.
 model.traverse(o=>{const m=o.material;if(!m?.userData.bodyPaint)return;
  m.color.set(config.paint||factoryColor);m.metalness=config.finish==='chrome'?.94:config.finish==='satin'?.26:.48;m.roughness=config.finish==='chrome'?.16:config.finish==='satin'?.6:.26;m.clearcoat=config.finish==='satin'?.18:1;m.clearcoatRoughness=config.finish==='satin'?.4:.12;
 });
 removeLivery(model);
 if(config.livery!=='solid'){
  const decals=new THREE.Group();decals.name='Custom livery';model.add(decals);
  const mat=new THREE.MeshStandardMaterial({color:config.accent,metalness:.3,roughness:.4,polygonOffset:true,polygonOffsetFactor:-2});
  const patch=(x,y,z,w,d)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);p.rotation.x=-Math.PI/2;p.position.set(x,y,z);p.userData.cosmeticDecal=true;decals.add(p);};
  const titan=!!kart.userData.fx,drift=kart.userData.kits?.drift.visible,retro=kart.userData.kits?.retro.visible;
  const frontY=titan?3.97:.75,rearY=titan?3.91:drift?4.22:2.92;
  if(config.livery==='stripes'){
   for(const side of [-1,1]){patch(side*.69,frontY,titan?6.95:5.55,.42,titan?1.65:3.4);if(!retro)patch(side*(titan?5.95:4.1),rearY,-5.8,.4,titan?2.9:1.6);}
  }else{
   for(let i=0;i<5;i++)for(let j=0;j<2;j++)if((i+j)%2===0)patch((i-2)*.54,frontY,(titan?6.6:5.8)+j*.5,.48,.45);
   if(!retro)for(const side of [-1,1])patch(side*(titan?5.95:4.1),rearY,-5.8,.7,.44);
  }
 }
 kart.userData.customization=config;
}
const exhaustFragment=`varying vec2 vUv;uniform vec3 tint;uniform float time;uniform float power;void main(){float along=clamp(vUv.y,0.,1.);float ripple=.85+.15*sin(along*27.-time*24.);float alpha=pow(1.-along,1.35)*.64*ripple;vec3 color=mix(tint,vec3(1.),pow(1.-along,9.)*.55);gl_FragColor=vec4(color,alpha);}`;
export function animateExhaust(kart,time,power=0,boosting=false,mini=false){
 const config=kart.userData.customization;
 kart.userData.engines.forEach((flame,i)=>{
  if(!flame.material.userData.customExhaust){flame.material.fragmentShader=exhaustFragment;flame.material.userData.customExhaust=true;flame.material.needsUpdate=true;}
  flame.visible=config?.exhaust!=='off';
  const pulse=config?.exhaust==='pulse'?.72+.28*Math.sin(time*15+i):1;
  const length=(boosting?24:1+power*1.4)*(1+Math.sin(time*39+i)*.07)*pulse;
  flame.scale.set((boosting?1.5:1)*pulse,length,(boosting?1.5:1)*pulse);flame.position.z=(flame.userData.nozzleZ??-7.8)-length*.5;
  flame.material.uniforms.tint.value.set(mini&&(!config||config.flame==='#43cfff')?'#ffad42':config?.flame||'#43cfff');flame.material.uniforms.time.value=time;flame.material.uniforms.power.value=power;
 });
}
