import * as THREE from 'three';
import {makeCraft,configureKart} from './kart-model.js';
import {craftDefs} from './kart-catalog.js';
import {CAR_UNLOCKS} from './progression-rules.js';
import {applyCustomization,animateExhaust} from './kart-customization.js';
import {createVehicleEnvironment} from './vehicle-finish.js';
export function createLeaderboardShowcase(host){
 const stage=document.createElement('section');stage.className='leader-car-stage';stage.hidden=true;const canvas=document.createElement('canvas'),caption=document.createElement('p');canvas.setAttribute('aria-label','车手整车展示');stage.append(canvas,caption);host.prepend(stage);
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch{return ()=>{};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1927);const camera=new THREE.PerspectiveCamera(38,1,.1,200),car=makeCraft();scene.add(car,new THREE.HemisphereLight(0xd0faff,0x303746,2));
 for(const [color,pos] of [[0xffe1ad,[15,25,22]],[0x88dcec,[-20,10,-15]]]){const light=new THREE.DirectionalLight(color,3);light.position.set(...pos);scene.add(light);}
 const environment=createVehicleEnvironment(renderer);scene.environment=environment.texture;
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(16,16,.2,64),new THREE.MeshStandardMaterial({color:0x15313a,metalness:.5,roughness:.4}));floor.position.y=-3.8;scene.add(floor);
 let visible=false;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function frame(now){requestAnimationFrame(frame);if(!visible||document.hidden)return;const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();const distance=Math.max(34,18/Math.sin(Math.atan(Math.tan(38*Math.PI/360)*camera.aspect)));const angle=reduce?.7:.7+now*.0001;camera.position.set(Math.sin(angle)*distance,distance*.35,Math.cos(angle)*distance);camera.lookAt(0,1,0);animateExhaust(car,now/1000,.4);renderer.render(scene,camera);}
 requestAnimationFrame(frame);
 return record=>{if(!record||!Number.isInteger(record.craft)||!craftDefs[record.craft]){visible=false;stage.hidden=true;return;}const d=craftDefs[record.craft];configureKart(car,d);applyCustomization(car,record.customization,d.style==='rally'?0x1497a0:d.color);caption.textContent=`${record.player_name} / ${CAR_UNLOCKS[record.craft].tier}级 ${d.name} · 点击榜单车手查看整车`;stage.hidden=false;visible=true;};
}
