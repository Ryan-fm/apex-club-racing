import {setupLanguage,tr} from './localization.js';
setupLanguage();
import * as THREE from 'three';
import {makeCraft,configureKart} from './kart-model.js';
import {craftDefs} from './kart-catalog.js';
import {applyCustomization,animateExhaust} from './kart-customization.js';
import {readGarage,saveCar,DEFAULT_CUSTOMIZATION} from './garage-config.js';
import {createVehicleEnvironment} from './vehicle-finish.js';
try{
const canvas=document.querySelector('#view'),host=canvas.parentElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x08121e);scene.fog=new THREE.Fog(0x08121e,60,135);
const camera=new THREE.PerspectiveCamera(37,1,.1,200);scene.add(new THREE.HemisphereLight(0xe0faff,0x30383d,.9));
for(const [color,intensity,position] of [[0xffe4c5,2.7,[20,35,25]],[0x96c6d6,1.5,[-22,15,-20]],[0xffffff,1.4,[-15,18,25]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);if(color===0xffe4c5){light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:90});light.shadow.normalBias=.025;}}
const environment=createVehicleEnvironment(renderer);scene.environment=environment.texture;
const car=makeCraft();scene.add(car);car.userData.shadow.visible=false;
const query=new URLSearchParams(location.search);let selected=/^[0-5]$/.test(query.get('craft')||'')?Number(query.get('craft')):4,config,boostPreview=false,switchAt=-1000,switchDirection=1;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fields={paint:'#bodyColor',finish:'#paintFinish',livery:'#paintLivery',accent:'#accentColor',exhaust:'#exhaustStyle',flame:'#flameColor'};
const status=document.querySelector('#customStatus');
function updateLinks(){const sceneName=['bay','citadel','harbor','canyon'].includes(query.get('scene'))?query.get('scene'):'bay';document.querySelectorAll('a[data-race-link]').forEach(a=>a.href=`./race.html?craft=${selected}&scene=${sceneName}`);}
function refreshCar(){
 const d=craftDefs[selected];applyCustomization(car,config,d.style==='rally'?0x1497a0:d.color);
 car.traverse(o=>{if(o.isMesh){o.castShadow=!o.material?.isShaderMaterial&&!o.userData.cosmeticDecal;o.receiveShadow=!o.userData.cosmeticDecal;if(o.material&&!o.material.isShaderMaterial)o.material.wireframe=document.querySelector('#wireframe').checked;}});
 car.userData.model.getObjectByName('Race driver').visible=document.querySelector('#driver').checked;
 for(const [key,selector]of Object.entries(fields))document.querySelector(selector).value=config[key]||(d.style==='rally'?'#1497a0':'#'+d.color.toString(16).padStart(6,'0'));
 document.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===config[b.dataset.choice])));
 document.querySelector('#accentField').hidden=config.livery==='solid';document.querySelector('#flameColor').disabled=config.exhaust==='off';document.querySelector('#previewBoost').disabled=config.exhaust==='off';
 document.querySelectorAll('[data-flame]').forEach(b=>{const on=b.dataset.flame===config.flame;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.disabled=config.exhaust==='off';});
 document.querySelectorAll('[data-color]').forEach(b=>{const on=b.dataset.color===document.querySelector('#bodyColor').value;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
function persist(){const saved=saveCar(undefined,selected,config);refreshCar();status.textContent=tr(saved?'Saved on this device · Ready to race':'Preview only · Browser could not save changes');}
function selectCar(index,direction=1){switchDirection=direction;switchAt=performance.now();selected=(index+craftDefs.length)%craftDefs.length;index=selected;configureKart(car,craftDefs[index]);config={...DEFAULT_CUSTOMIZATION,...readGarage().cars[index]};refreshCar();
 document.querySelector('#garageName').textContent=craftDefs[index].name;document.querySelector('#garageType').textContent=tr(craftDefs[index].title);canvas.setAttribute('aria-label',craftDefs[index].name+' 3D vehicle. Drag to rotate.');document.querySelector('#previousCar').setAttribute('aria-label',tr('Previous car · '+craftDefs[(index+5)%6].name));document.querySelector('#nextCar').setAttribute('aria-label',tr('Next car · '+craftDefs[(index+1)%6].name));
 document.querySelectorAll('[data-garage-car]').forEach(b=>{const on=Number(b.dataset.garageCar)===index;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelector('#carNumber').textContent=String(index+1).padStart(2,'0');
 document.querySelector('#previousName').textContent=craftDefs[(index+5)%6].name;document.querySelector('#nextName').textContent=craftDefs[(index+1)%6].name;
 document.querySelector('#carStats').innerHTML=[['Speed',craftDefs[index].max/650],['Handling',craftDefs[index].turn/1.5],['Drift',craftDefs[index].drift/1.5]].map(([name,value])=>`<div><span>${tr(name)}</span><i><b style="width:${Math.round(value*100)}%"></b></i></div>`).join('');
 const intro=document.querySelector('.intro');intro.classList.remove('switching');void intro.offsetWidth;intro.classList.add('switching');
 const url=new URL(location.href);url.searchParams.set('craft',index);history.replaceState(null,'',url);updateLinks();status.textContent=tr('Saved on this device · Ready to race');
}
const fleet=document.querySelector('#garageFleet');
craftDefs.forEach((d,i)=>{const b=document.createElement('button');b.dataset.garageCar=i;b.style.setProperty('--car-color','#'+d.color.toString(16).padStart(6,'0'));b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',d.name);b.title=d.name;b.addEventListener('click',()=>selectCar(i,i<selected?-1:1));fleet.append(b);});
// Visible sample cards replace native select menus while retaining one config path.
for(const key of ['finish','livery','exhaust']){
 const select=document.querySelector(fields[key]),label=select.parentElement,group=document.createElement('div');group.className='option-grid';group.setAttribute('role','group');group.setAttribute('aria-label',tr(key==='finish'?'Paint finish':key==='livery'?'Livery':'Tail flame'));
 for(const option of select.options){const b=document.createElement('button');b.type='button';b.className='option-card';b.dataset.choice=key;b.dataset.value=option.value;b.innerHTML='<span class="material-sample" aria-hidden="true"></span><span>'+option.textContent+'</span>';b.addEventListener('click',()=>{config[key]=option.value;persist();});group.append(b);}
 select.hidden=true;label.after(group);label.removeChild(select);group.after(select);
}
document.querySelector('#previousCar').addEventListener('click',()=>selectCar(selected-1,-1));document.querySelector('#nextCar').addEventListener('click',()=>selectCar(selected+1,1));
fleet.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const direction=e.key==='ArrowLeft'?-1:1;selectCar(e.key==='Home'?0:e.key==='End'?5:selected+direction,direction);fleet.querySelector(`[data-garage-car="${selected}"]`).focus();});
let swipeX=null;const selector=document.querySelector('.carousel');selector.addEventListener('pointerdown',e=>{swipeX=e.clientX;});selector.addEventListener('pointermove',e=>{if(swipeX!==null&&Math.abs(e.clientX-swipeX)>15)selector.setPointerCapture(e.pointerId);});selector.addEventListener('pointerup',e=>{if(swipeX!==null&&Math.abs(e.clientX-swipeX)>45)selectCar(selected+(e.clientX<swipeX?1:-1),e.clientX<swipeX?1:-1);swipeX=null;});selector.addEventListener('pointercancel',()=>{swipeX=null;});
const tabs=[...document.querySelectorAll('[data-panel]')];function openPanel(tab){tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.querySelector('#panel-'+b.dataset.panel).hidden=!active;});}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>openPanel(tab));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=tabs[e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3];openPanel(next);next.focus();});});
for(const [key,selector]of Object.entries(fields))document.querySelector(selector).addEventListener('input',e=>{config[key]=e.target.value;persist();});
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{config.paint=b.dataset.color;persist();}));
document.querySelectorAll('[data-flame]').forEach(b=>b.addEventListener('click',()=>{config.flame=b.dataset.flame;persist();}));
document.querySelector('#resetCustom').addEventListener('click',()=>{config={...DEFAULT_CUSTOMIZATION};persist();});
document.querySelector('#previewBoost').addEventListener('click',e=>{boostPreview=!boostPreview;e.currentTarget.setAttribute('aria-pressed',String(boostPreview));e.currentTarget.textContent=tr(boostPreview?'Stop boost preview':'Test boost');if(boostPreview){yaw=Math.PI-.5;pitch=.3;rotate.checked=false;}});
selectCar(selected);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x0c1825,roughness:.7,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.85;floor.receiveShadow=true;scene.add(floor);
const podium=new THREE.Mesh(new THREE.CylinderGeometry(15,15.3,.35,96),new THREE.MeshStandardMaterial({color:0x142636,metalness:.35,roughness:.5}));podium.position.y=-3.67;podium.receiveShadow=true;scene.add(podium);
// Rings and radial markers anchor the vehicle in a physical studio stage.
const ringMaterial=new THREE.MeshBasicMaterial({color:0x57cfc7,transparent:true,opacity:.6});
for(const radius of [14.8,15.8]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.028,5,128),ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=-3.46;scene.add(ring);}
const markerMaterial=new THREE.MeshStandardMaterial({color:0x7893a5,metalness:.5,roughness:.4});
for(let i=0;i<48;i++){const angle=i/48*Math.PI*2,marker=new THREE.Mesh(new THREE.BoxGeometry(.06,.012,i%4===0?.55:.2),markerMaterial);marker.position.set(Math.sin(angle)*14.35,-3.48,Math.cos(angle)*14.35);marker.rotation.y=angle;scene.add(marker);}
for(const x of [-21,21]){const lightBar=new THREE.Mesh(new THREE.BoxGeometry(.12,19,.12),new THREE.MeshBasicMaterial({color:x<0?0x79dbdf:0xe9b879}));lightBar.position.set(x,6,-22);scene.add(lightBar);}
let yaw=.65,pitch=.36,distance=43,dragging=false,px=0,py=0,last=performance.now();const target=new THREE.Vector3(0,1.8,0);
const rotate=document.querySelector('#rotate');if(matchMedia('(prefers-reduced-motion: reduce)').matches)rotate.checked=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(rotate.checked&&!dragging)yaw+=dt*.16;
 const progress=Math.min(1,(now-switchAt)/450),slide=reducedMotion?0:Math.pow(1-progress,3);car.position.x=switchDirection*slide*5;
 animateExhaust(car,now/1000,.65,boostPreview);
 camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance).add(target);camera.lookAt(target);renderer.render(scene,camera);}
canvas.addEventListener('pointerdown',e=>{dragging=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);rotate.checked=false;});canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw-=(e.clientX-px)*.008;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-py)*.005,-.06,1.45);px=e.clientX;py=e.clientY;});for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>dragging=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.035,24,70);},{passive:false});canvas.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();rotate.checked=false;if(e.key==='ArrowLeft')yaw-=.15;if(e.key==='ArrowRight')yaw+=.15;if(e.key==='ArrowUp')pitch=Math.min(1.45,pitch+.12);if(e.key==='ArrowDown')pitch=Math.max(-.06,pitch-.12);});
const views={hero:[.65,.36],front:[0,.18],rear:[Math.PI,.25],side:[Math.PI/2,.18],top:[0,1.45]};document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{[yaw,pitch]=views[b.dataset.view];rotate.checked=false;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));}));
document.querySelector('#driver').addEventListener('change',e=>car.userData.model.getObjectByName('Race driver').visible=e.target.checked);document.querySelector('#wireframe').addEventListener('change',e=>car.traverse(o=>{if(o.isMesh&&o.material)o.material.wireframe=e.target.checked;}));

function resize(){const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();distance=Math.max(43,13/Math.sin(Math.atan(Math.tan(37*Math.PI/360)*camera.aspect)));}new ResizeObserver(resize).observe(host);resize();requestAnimationFrame(frame);
}catch(error){document.querySelector('#error').hidden=false;console.error(error);}
