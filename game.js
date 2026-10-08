import {createHarbor} from './harbor-scene.js';
import {createVehicleEnvironment} from './vehicle-finish.js';
import {makeCraft,configureKart} from './kart-model.js';
import {applyCustomization,animateExhaust} from './kart-customization.js';
import {readGarage,GARAGE_KEY} from './garage-config.js';
import {loadBindings,createKeyboardState,formatKeys} from './keyboard-controls.js';
import {mountKeyboardSettings} from './keyboard-settings.js';
import {setupLanguage,tr,getLanguage,onLanguageChange,rememberTranslation} from './localization.js';
import {circuitPoints,roadHalfWidth} from './track-layout.js';
import {createLesson,stepLesson,createLapRecord,recordLap,ghostPose,medals,empTargets,assistedInput} from './race-experience.js';
import {createPickupFactory} from './pickup-design.js';
import {JUMP_RAMPS,RAMP_LENGTH,rampHeight,createStunts,boostOpportunity} from './stunt-model.js';
import {createShowroom,createCitadel} from './scene-design.js';
import {createMobileControls,isHandheldDevice} from './mobile-controls.js';
import {DISTANCE_SCALE, DISPLAY_SPEED} from './driving-model.js';
import {createRaceEffects} from './race-effects.js';
import {createRaceAudio} from './race-audio.js';
import {mountDriverStudio} from './driver-studio.js';
import {craftDefs} from './kart-catalog.js';
import {createRace, standings, advanceRacer, teamScores, shouldFinish, SCORE_TABLE, TEAM_COLORS} from './race-rules.js';
import {stepPlayerSimulation} from './runtime/player-simulation.js';
import {GATE_SPRINT,createSprint,updateSprint,sprintRecordKey,saveSprint,sprintInstruction} from './runtime/gate-sprint.js';
import {chaseHeading,createSuspension,stepSuspension} from './runtime/race-presenter.js';
import {createInputFrame} from './runtime/input-frame.js';
import {createPerformanceProbe,frameTiming} from './runtime/performance.js';
import {cacheRaceNodes,createDomWriter} from './runtime/race-ui.js';
import {onlineClub,mountOnlineClub} from './online-club.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const searchParams = new URLSearchParams(location.search);
const diagnosticsEnabled = ['1','true'].includes(searchParams.get('perf') || searchParams.get('diagnostics') || '');
const replayData=diagnosticsEnabled&&searchParams.get('replay')==='gate'?(await import('./diagnostics/gate-replay.js')).replay:null;
let replayTick=0,replayAccumulator=0;
const gateSlice = searchParams.get('slice') === 'gate'||!!replayData;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x83bed8);
scene.fog = new THREE.FogExp2(0x9bcadb, 0.00030);

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.1, 9000);
const mobileDevice=isHandheldDevice();
const renderer = new THREE.WebGLRenderer({antialias:!mobileDevice,powerPreference:mobileDevice?'default':'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, mobileDevice?1:1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled=!mobileDevice;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

let composer=null,bloom=null;
function ensureComposer(){
 if(composer)return;
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.38,.35,.85);composer.addPass(bloom);composer.addPass(new OutputPass());
}
const world = new THREE.Group(); scene.add(world);
const up = new THREE.Vector3(0,1,0);
const clock = new THREE.Clock();
let bindings=loadBindings(null);try{bindings=loadBindings(localStorage.getItem('apex-keybindings'));}catch{}
const keyboard=createKeyboardState(()=>bindings);
const keys=keyboard.keys;
const keyText=text=>rememberTranslation(formatKeys(text,bindings),formatKeys(text,bindings,tr));
const actions=new Set();
let driftLatched=false,lastSteer=0;
let uiWritesThisFrame=0;
const raceNodes=cacheRaceNodes(document);
const ui=createDomWriter({onWrite:()=>{uiWritesThisFrame++;}});
const audio=createRaceAudio();
let reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let helpOpen=false,simulationTime=0,race=null,selectedMode='team',selectedTeam='blue';
const mobile=createMobileControls({active:()=>race?.phase==='racing'&&!helpOpen,action:name=>actions.add(name==='nitro'?'ShiftLeft':name==='mini'?'KeyE':'KeyQ'),pause:()=>toggleControls(true)});
function toggleControls(open=!helpOpen){
  if(!race || race.phase==='finished')return;
  helpOpen=open;keyboard.clear();actions.clear();mobile.clear();driftLatched=false;document.querySelector('#controlsPanel').hidden=!open;
  document.querySelector('#controlsToggle').setAttribute('aria-expanded',String(open));
  if(open)document.querySelector('#startDriving').focus();else renderer.domElement.focus();
}
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('data-no-translate','');
function updateKeyboardDescription(){renderer.domElement.setAttribute('aria-label',keyText('W / ↑ to accelerate, S / ↓ to brake / reverse, A / D or ← / → to steer.')+' '+keyText('Press H at any time to pause or resume.'));}
updateKeyboardDescription();onLanguageChange(updateKeyboardDescription);
document.querySelector('#controlsToggle').addEventListener('click',()=>toggleControls());
document.querySelector('#startDriving').addEventListener('click',()=>toggleControls(false));
document.querySelector('#recoverCar').addEventListener('click',()=>{
  if(!race||race.racers[0].finishTime!==null)return;
  lapRecord.invalid=true;runStats.collisions++;
  Object.assign(stunts,createStunts());
  const f=trackFrame(state.t);Object.assign(state,{x:f.p.x,z:f.p.z,heading:Math.atan2(f.tan.x,f.tan.z),vx:0,vz:0,speed:0,reverseHold:0,wallContact:0,lane:0,laneVel:0,nitro:0,miniTurbo:0});
  state.drift={active:false,charge:0,direction:0};race.racers[0].lane=0;cameraReady=false;
  toggleControls(false);ping('CAR RECOVERED / NO PROGRESS GAIN','#ffd38b');
});
addEventListener('keydown', e => {
  if(document.querySelector('#settingsDialog').open||document.querySelector('#clubDialog').open)return;
  if(e.code==='Tab'&&(helpOpen||race?.phase==='finished')){
    const dialog=document.querySelector(helpOpen?'#controlsPanel':'#results');
    const buttons=[...dialog.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);
    e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();return;
  }
  if(e.metaKey||e.altKey)return;
  if(e.code==='Escape'&&!e.repeat){toggleControls();return;}
  if(!race||race.phase==='finished')return;
  const input=keyboard.press(e);if(!input)return;
  const {code,fresh}=input;
  if(code==='KeyH'){e.preventDefault();if(fresh)toggleControls();return;}
  if(helpOpen){keyboard.clear();return;}
  e.preventDefault();
  if(race.phase!=='racing')return;
  if(code==='KeyA')lastSteer=-1;
  if(code==='KeyD')lastSteer=1;
  if(code==='Space'&&fresh&&document.querySelector('#toggleDrift').checked)driftLatched=!driftLatched;
  if(fresh&&['KeyE','KeyQ','KeyR','ShiftLeft'].includes(code))actions.add(code);
});
addEventListener('keyup',e=>keyboard.release(e.code));
addEventListener('blur',()=>{keyboard.clear();actions.clear();mobile.clear();if(race?.phase==='racing')toggleControls(true);});

// Bay Circuit: a closed coastal course with gentle elevation changes.
const GATE_SLICE_START=GATE_SPRINT.start;
let requestedScene=gateSlice?'citadel':(['bay','citadel','harbor'].includes(new URLSearchParams(location.search).get('scene'))?new URLSearchParams(location.search).get('scene'):'bay');
let curve,trackLength,roadSamples;
function setRouteGeometry(name){
 requestedScene=name;
 curve=new THREE.CatmullRomCurve3(circuitPoints(name).map(p=>new THREE.Vector3(...p)),true,'catmullrom',name==='harbor'?.65:.35);
 if(name==='harbor')curve.arcLengthDivisions=2400;
 trackLength=curve.getLength();
 roadSamples=Array.from({length:1601},(_,i)=>{const p=curve.getPointAt(i/1600);return {x:p.x,z:p.z};});
}
setRouteGeometry(requestedScene);

function trackFrame(t){
  const p=curve.getPointAt((t%1+1)%1);
  const tan=curve.getTangentAt((t%1+1)%1).normalize();
  let side=new THREE.Vector3().crossVectors(tan,up).normalize();
  if(side.lengthSq()<0.01) side.set(1,0,0);
  const normal=new THREE.Vector3().crossVectors(side,tan).normalize();
  return {p,tan,side,normal};
}

function createTrack(){
  const seg=900;
  const pos=[], uv=[], idx=[];
  for(let i=0;i<=seg;i++){
    const t=i/seg, f=trackFrame(t),half=roadHalfWidth(requestedScene,t);
    for(const s of [-1,1]){
      const v=f.p.clone().addScaledVector(f.side,half*s);
      pos.push(v.x,v.y,v.z); uv.push(s<0?0:1,t*90);
    }
  }
  for(let i=0;i<seg;i++){ const a=i*2,b=a+1,c=a+2,d=a+3; idx.push(a,c,b,b,c,d); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86,side:THREE.DoubleSide});
  m.uniforms={time:{value:0},speed:{value:0},citadel:{value:0},harbor:{value:0}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,m.uniforms);
    shader.vertexShader='varying vec2 vRoadUv; varying vec3 vPos;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadUv=uv;vPos=position;');
    shader.fragmentShader='varying vec2 vRoadUv;varying vec3 vPos;uniform float citadel;uniform float harbor;float line(float x,float w){return 1.-smoothstep(0.,w,abs(fract(x)-.5));}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float edge=1.-smoothstep(.009,.022,min(vRoadUv.x,1.-vRoadUv.x));
        float lane=(1.-smoothstep(.002,.006,abs(vRoadUv.x-.333)))+(1.-smoothstep(.002,.006,abs(vRoadUv.x-.667)));
        float dash=step(.45,fract(vRoadUv.y*.55));
        float seam=line(vRoadUv.y*2.,.025);
        float shoulder=(1.-smoothstep(.035,.07,min(vRoadUv.x,1.-vRoadUv.x)))*(1.-edge);
        float grain=fract(sin(dot(floor(vPos.xz*9.),vec2(12.9898,78.233)))*43758.5453);
        vec3 base=vec3(.075,.105,.13)+seam*.024+grain*.015;
        base+=lane*dash*vec3(.09,.16,.20);
        base=mix(base,mix(vec3(.92,.92,.79),vec3(.95,.20,.16),step(.5,fract(vRoadUv.y*2.))),shoulder*.8);
        base+=edge*vec3(.1,.32,.38)*.45;
        float marker=line(vRoadUv.y*.33,.09)*step(.93,abs(vRoadUv.x-.5)*2.);
        base+=marker*vec3(.95,.28,.08);
        vec2 brick=vec2(vRoadUv.x*12.+mod(floor(vRoadUv.y*3.),2.)*.5,vRoadUv.y*3.);
        float mortar=step(.94,fract(brick.x))+step(.93,fract(brick.y));
        vec3 paving=vec3(.32,.34,.31)+grain*.04-mortar*.06;
        paving=mix(paving,vec3(.58,.48,.30),edge*.7);base=mix(base,paving,citadel);
        vec3 wet=vec3(.055,.085,.12)+grain*.01;
        wet+=lane*dash*vec3(.35,.45,.46);
        wet+=edge*vec3(.1,.8,.75);
        float sheen=pow(max(0.,sin(vRoadUv.y*.6+vRoadUv.x*8.)),18.)*.08;
        wet+=sheen*mix(vec3(.15,.65,.8),vec3(.8,.22,.38),step(.5,vRoadUv.x));
        base=mix(base,wet,harbor);diffuseColor.rgb=base;
    `);
  };
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true; world.add(mesh); return m;
}
let trackMat,bayTrackObjects,structureMat;
function buildRoad(){
trackMat=createTrack();
for(const start of JUMP_RAMPS){
 const positions=[],indices=[];
 for(let i=0;i<=20;i++){const t=start+RAMP_LENGTH*i/20,f=trackFrame(t);for(const side of [-1,1]){const p=f.p.clone().addScaledVector(f.side,side*(roadHalfWidth(requestedScene,t)-1));p.y+=7*i/20+.08;positions.push(p.x,p.y,p.z);}}
 for(let i=0;i<20;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xc39853,metalness:.2,roughness:.7,side:THREE.DoubleSide}));world.add(mesh);
 for(const u of [.15,.55,.90]){const f=trackFrame(start+RAMP_LENGTH*u),mark=new THREE.Mesh(new THREE.BoxGeometry(54,.12,1.5),new THREE.MeshBasicMaterial({color:0xffe3a2}));mark.position.copy(f.p);mark.position.y+=7*u+.25;mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),f.tan);world.add(mark);}
}

bayTrackObjects=[];
const beforeBayTrack=new Set(world.children);
// Edge rails + cathedral ribs.
const railMat=new THREE.MeshBasicMaterial({color:0xc3f3f1});
const magMat=new THREE.MeshBasicMaterial({color:0xffa33e});
structureMat=new THREE.MeshStandardMaterial({color:0xd8e6e6,metalness:.6,roughness:.48});
const railGeometry=new THREE.BoxGeometry(2.4,4.5,26);
const rails=new THREE.InstancedMesh(railGeometry,railMat,420),accentRails=new THREE.InstancedMesh(railGeometry,magMat,60);
world.add(rails,accentRails);let railIndex=0,accentIndex=0;const railPose=new THREE.Object3D();
for(let i=0;i<240;i++){
  const t=i/240, f=trackFrame(t);
  for(const s of [-1,1]){
    railPose.position.copy(f.p).addScaledVector(f.side,s*42).addScaledVector(f.normal,4);
    railPose.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),f.tan);railPose.updateMatrix();
    if(i%8===0)accentRails.setMatrixAt(accentIndex++,railPose.matrix);else rails.setMatrixAt(railIndex++,railPose.matrix);
  }
  if(i%24===0){
    const rib=new THREE.Group();
    const pillarGeo=new THREE.BoxGeometry(4,53,4);
    for(const s of [-1,1]){const p=new THREE.Mesh(pillarGeo,structureMat);p.position.x=s*64;p.position.y=24;rib.add(p)}
    const top=new THREE.Mesh(new THREE.BoxGeometry(132,5,5),structureMat);top.position.y=49;rib.add(top);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(100,.65,1),railMat);strip.position.y=46;rib.add(strip);
    rib.position.copy(f.p); rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),f.tan); world.add(rib);
  }
}

bayTrackObjects.push(...world.children.filter(o=>!beforeBayTrack.has(o)));
}
buildRoad();
// Strange world below: luminous storm-ocean + impossible monoliths.
const sea=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000,180,180),new THREE.ShaderMaterial({
  side:THREE.DoubleSide,transparent:true,
  uniforms:{time:{value:0}},
  vertexShader:`uniform float time; varying float h; void main(){vec3 p=position; float w=sin(p.x*.005+time)*22.+sin(p.y*.004-time*.8)*18.; p.z+=w; h=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`varying float h; void main(){float q=.35+.65*abs(sin(h*.06)); vec3 c=mix(vec3(.06,.27,.38),vec3(.12,.43,.52),q); c+=vec3(.10,.12,.10)*pow(q,32.); gl_FragColor=vec4(c,.93);}`
}));
sea.rotation.x=-Math.PI/2; sea.position.y=-180; scene.add(sea);

// Star motes / speed particles
const starGeo=new THREE.BufferGeometry();
const stars=240, arr=new Float32Array(stars*3);
for(let i=0;i<stars;i++){ const r=500+Math.random()*5200,a=Math.random()*Math.PI*2;arr[i*3]=Math.cos(a)*r;arr[i*3+1]=-400+Math.random()*2200;arr[i*3+2]=Math.sin(a)*r; }
starGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));
scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.5,color:0x7dfcff,transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false})));

let craftIndex=4;
function animateCraft(craft,time,power,boosting=false,drifting=false,steer=0){
  animateExhaust(craft,time,power,boosting,craft===player&&state.miniTurbo>0&&state.nitro<=0);
  craft.userData.wheels.forEach(w=>{w.hub.rotation.y=w.front?-steer*.35:0;w.tire.rotation.x=time*power*-8;});
}
const player=makeCraft(craftDefs[craftIndex].color,1); scene.add(player);

const stunts=createStunts();
const suspension=createSuspension();let cameraHeading=null,sprint=createSprint();
const state={yaw:0,hop:0,t:0,lane:0,laneVel:0,speed:0,reverseHold:0,wallContact:0,boost:1/3,shield:1,weapon:1,lap:1,rank:1,hit:0,bank:0,miniTurbo:0,nitro:0,drift:{active:false,charge:0,direction:0}};

const raceEffects=createRaceEffects(scene);
const ai=[];
for(let i=0;i<7;i++){
  const def=craftDefs[i%craftDefs.length]; const mesh=makeCraft(def.color,.9);configureKart(mesh,def);scene.add(mesh);
  ai.push({mesh,t:(.012+i*.018)%1,lane:(Math.random()-.5)*42,speed:360+Math.random()*170,target:380+Math.random()*210,stun:0,aggression:.4+Math.random()*.6});
}

// pickups
const pickups=[];
const makePickup=createPickupFactory();
for(let i=0;i<30;i++){
  const type=['boost','shield','weapon'][i%3], t=(i/30+.025)%1, f=trackFrame(t), lane=(i%2?1:-1)*(10+Math.random()*20);
  const m=makePickup(type);
  m.position.copy(f.p).addScaledVector(f.side,lane).addScaledVector(f.normal,7); scene.add(m); pickups.push({m,type,t,lane,active:true,respawn:0});
}

const ambientLight=new THREE.HemisphereLight(0xdbefff,0x525443,1.35);scene.add(ambientLight);
const dir=new THREE.DirectionalLight(0xffe6c3,2.7);dir.position.set(500,900,-400);scene.add(dir);scene.add(dir.target);dir.castShadow=true;dir.shadow.mapSize.set(1024,1024);Object.assign(dir.shadow.camera,{left:-150,right:150,top:150,bottom:-150,near:1,far:650});dir.shadow.bias=-.0003;dir.shadow.normalBias=.3;
const envTarget=createVehicleEnvironment(renderer);scene.environment=envTarget.texture;


const chaseLight=new THREE.DirectionalLight(0xb9dbff,.8);scene.add(chaseLight);scene.add(chaseLight.target);
const streakCount=48,streakPositions=new Float32Array(streakCount*6);
const streakGeo=new THREE.BufferGeometry();streakGeo.setAttribute('position',new THREE.BufferAttribute(streakPositions,3));
const streaks=new THREE.LineSegments(streakGeo,new THREE.LineBasicMaterial({color:0x9edef0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
scene.add(streaks);
function updateSpeedFX(time,meta){
  const power=clamp((state.speed-340)/520,0,1);
  streaks.position.copy(camera.position);streaks.quaternion.copy(camera.quaternion);
  streaks.material.opacity=reducedMotion?0:power*(meta.boosting?.6:.06);
  for(let i=0;i<streakCount;i++){
    const a=i*2.39996,r=13+(i%7)*3,z=-10-((i*7.13-time*(38+power*130))%140+140)%140;
    streakPositions.set([Math.cos(a)*r,Math.sin(a)*r,z,Math.cos(a)*r,Math.sin(a)*r,z+2+power*12],i*6);
  }
  streakGeo.attributes.position.needsUpdate=true;
}
// Streak vertices change every frame; their initial zero-sized bounds are not useful.
streaks.frustumCulled=false;
const msg=document.querySelector('#centerMsg'), flash=document.querySelector('#flash');
function ping(text,color='#fff'){msg.textContent=text;msg.style.color=color;msg.style.opacity=1;setTimeout(()=>msg.style.opacity=0,520)}
function colorKart(kart,color){if(kart===player&&selectedMode==='solo'&&document.querySelector('#liverySetting').value==='reward'){try{if(Number(localStorage.getItem('apex-medal'))>=1)color=0xdab16b;}catch{}}kart.traverse(o=>{if(o.material?.userData.craftColor)o.material.color.setHex(color);});if(kart===player)applyCustomization(kart,readGarage().cars[craftIndex],craftDefs[craftIndex].style==='rally'?0x1497a0:color);}
function setCraft(i){
  if(race&&race.phase!=='finished')return;
  if(!Number.isInteger(i)||!craftDefs[i]||(replayData&&i!==replayData.craft))return;
  craftIndex=i;document.querySelector('.lobby-tools a').href=`./garage.html?craft=${i}&scene=${requestedScene}`;const d=craftDefs[i];configureKart(player,d);showroom.select();
  document.querySelector('#heroKartName').textContent=d.name;document.querySelector('#heroKartType').textContent=d.title;updateLobbyRecord();
  colorKart(player,selectedMode==='team'?TEAM_COLORS[selectedTeam]:d.color);
  document.querySelectorAll('[data-craft]').forEach(el=>{const active=Number(el.dataset.craft)===i;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  document.querySelector('#craftName').textContent=d.name;
  document.querySelector('#kartTitle').textContent=`${d.name} / ${d.title}`;
  document.querySelector('#kartDescription').textContent=d.description;
  const stats=[['Speed',d.max,650,`${Math.round(d.max*DISPLAY_SPEED)} KM/H`],['Accel.',d.accel,300,`${Math.round(d.accel/210*100)}%`],['Handling',d.turn,1.5,`${Math.round(d.turn*100)}%`],['Drift',d.drift,1.5,`${Math.round(d.drift*100)}%`]];
  document.querySelector('#kartStats').innerHTML=stats.map(([label,value,max,text])=>`<div class="kart-stat"><span>${label}</span><i><b style="width:${Math.min(100,value/max*100)}%"></b></i><strong>${text}</strong></div>`).join('');
}
function reset(){
 resetExperience();replayTick=0;replayAccumulator=0;sprint=createSprint();Object.assign(suspension,createSuspension());cameraHeading=null;
  Object.assign(stunts,createStunts());
  scene.add(player);
  audio.start();raceEffects.reset();driftLatched=false;lastSteer=0;keyboard.clear();actions.clear();mobile.clear();helpOpen=false;simulationTime=0;cameraReady=false;qWas=false;
  race=createRace(selectedMode,selectedTeam);
  if(gateSlice){
    race.racers[0].progress=GATE_SLICE_START;
    race.racers[0].lane=0;
    race.racers.slice(1).forEach((r,i)=>{r.progress=GATE_SLICE_START-.006*(i+1);r.lane=(i%2?1:-1)*(14+(i%3)*7);});
  }
  msg.textContent='';msg.style.opacity=0;
  Object.assign(state,{yaw:0,hop:0,t:(race.racers[0].progress+1)%1,lane:race.racers[0].lane,laneVel:0,speed:0,reverseHold:0,wallContact:0,boost:1/3,shield:1,weapon:1,lap:1,rank:1,hit:0,bank:0,miniTurbo:0,nitro:0,drift:{active:false,charge:0,direction:0}});
  const spawn=trackFrame(state.t);Object.assign(state,{x:spawn.p.x+spawn.side.x*state.lane,z:spawn.p.z+spawn.side.z*state.lane,heading:Math.atan2(spawn.tan.x,spawn.tan.z),vx:0,vz:0,roadIndex:null});
  ai.forEach((a,i)=>{const r=race.racers[i+1];a.t=(r.progress+1)%1;a.lane=r.lane;a.speed=0;a.stun=0;a.target=525+i*10;colorKart(a.mesh,selectedMode==='team'?TEAM_COLORS[r.team]:craftDefs[i%craftDefs.length].color);});
  colorKart(player,selectedMode==='team'?TEAM_COLORS[selectedTeam]:craftDefs[craftIndex].color);
  pickups.forEach(p=>{p.active=true;p.m.visible=true;p.respawn=0;});
  document.querySelector('#results table').hidden=false;
  document.querySelector('#lobby').hidden=true;document.querySelector('#results').hidden=true;document.querySelector('#controlsPanel').hidden=true;
  document.querySelector('#controlsToggle').setAttribute('aria-expanded','false');
  document.body.classList.add('in-race');document.querySelector('#countdown').hidden=false;
  document.querySelector('#modeLabel').textContent=gateSlice?'GATE SPRINT / SOLO PRACTICE':selectedMode==='team'?'4V4 AI TEAM RACE':'SOLO / 7 AI RIVALS';
  document.querySelector('#teamScore').hidden=selectedMode!=='team';
  renderer.domElement.focus();perf.startRun();
}
let playerMeta={steer:0,boosting:false};
function updatePlayer(dt,time){
  const original=craftDefs[craftIndex],assisted=!replayData&&document.querySelector('#beginnerSetting').checked;
  const d=lesson?{...original,max:lesson.step<2?170:280,accel:170}:assisted?{...original,max:original.max*.72,accel:original.accel*.82}:original,r=race?.racers[0];
  const racing=race?.phase==='racing'&&r.finishTime===null;
  const toggleDrift=document.querySelector('#toggleDrift').checked;
  const input=createInputFrame({racing,lesson,keys,mobile,actions,autoThrottle:document.querySelector('#autoThrottle').checked,toggleDrift,driftLatched,lastSteer,dt});
  if(replayData&&racing){const v=replayData.frames[Math.min(replayTick++,replayData.frames.length-1)];Object.assign(input,{rawSteer:v[0],throttle:true,brake:!!v[1],driftHeld:!!v[2],commands:{mini:!!v[3],nitro:!!v[4]}});}
  input.rawSteer=assistedInput(input.rawSteer,state.speed,assisted,dt,smoothedSteer);smoothedSteer=input.rawSteer;
  input.driftSteer=input.rawSteer||(!state.drift.active&&toggleDrift?lastSteer:0);
  let result={events:[],steer:input.rawSteer,boosting:false};
  if(racing){
    const oldLap=state.lap;
    result=stepPlayerSimulation(state,stunts,input,d,{samples:roadSamples,halfWidth:t=>roadHalfWidth(requestedScene,t),ground:t=>trackFrame(t).p.y},dt);
    advanceRacer(race,r,result.delta,dt);
    state.lap=clamp(Math.floor(Math.max(0,r.progress))+1,1,3);r.lane=state.lane;r.speed=state.speed;
    for(const e of result.events){
      if(e.kind==='nitro'){ping('NITRO ENGAGED','#69cfff');audio.cue('nitro');}
      if(e.kind==='drift-release')runStats.drifts++;
      if(e.kind==='mini'){runStats.boosts++;lessonFired=true;audio.cue(e.type==='AIR BOOST'?'air':e.type==='LAND BOOST'?'land':e.type==='CUT BOOST'?'cut':'mini');ping(`${e.type}${e.combo>1?' / CHAIN '+e.combo:''}`,'#ffce73');}
      if(e.kind==='collision'){runStats.collisions++;runStats.recoveryStart=race.elapsed;}
    }
    if(gateSlice&&!lesson)updateSprint(sprint,r.progress,race.elapsed,result.events);
    if(runStats.recoveryStart!==null&&!result.wallHit&&state.speed>120){runStats.recoveries.push(race.elapsed-runStats.recoveryStart);runStats.recoveryStart=null;}
    if(state.lap>oldLap)ping(state.lap===3?'FINAL LAP':'LAP 2','#fff0b3');
    if(r.finishTime!==null){state.speed=0;ping('FINISH / WAITING FOR RACERS','#fff0b3');}
  }
  if(lesson&&racing){updateLesson(dt,{steer:input.rawSteer,brake:input.brake,speed:state.speed,charge:state.drift.charge,fired:lessonFired});if(!lesson.done&&(Math.abs(state.lane)>roadHalfWidth(requestedScene,state.t)-9||state.t>.04)){if(lesson.step===3)lesson.step=2;placeLesson();}}
  if(r?.finishTime!==null&&r?.finishTime!==undefined){state.speed=0;state.vx=0;state.vz=0;}
  state.bank=lerp(state.bank,-input.rawSteer*.07,1-Math.exp(-8*dt));
  playerMeta={steer:input.rawSteer,boosting:result.boosting,max:d.max};
}
const poseForward=new THREE.Vector3(),poseSide=new THREE.Vector3(),poseMatrix=new THREE.Matrix4(),poseQ=new THREE.Quaternion(),bankQ=new THREE.Quaternion(),bankEuler=new THREE.Euler();
function presentPlayer(dt,time){
  const frame=trackFrame(state.t),{steer,boosting,max}=playerMeta;
  const compression=stepSuspension(suspension,stunts.airborne,dt,reducedMotion);
  player.position.set(state.x,(stunts.y??frame.p.y)+frame.side.y*state.lane+3.7+compression+(stunts.airborne?0:Math.sin(state.hop/.24*Math.PI)*1.4),state.z);
  poseForward.set(Math.sin(state.heading),0,Math.cos(state.heading)).addScaledVector(frame.normal,-poseForward.dot(frame.normal)).normalize();
  poseSide.crossVectors(poseForward,frame.normal).normalize();
  state.yaw=Math.atan2(frame.tan.clone().cross(poseForward).dot(frame.normal),frame.tan.dot(poseForward));
  poseMatrix.makeBasis(poseSide.clone().negate(),frame.normal,poseForward);poseQ.setFromRotationMatrix(poseMatrix);
  bankQ.setFromEuler(bankEuler.set(0,0,state.bank));poseQ.multiply(bankQ);
  if(!cameraReady)player.quaternion.copy(poseQ);else player.quaternion.slerp(poseQ,1-Math.exp(-18*dt));
  animateCraft(player,time,state.speed/(max||craftDefs[craftIndex].max),boosting,state.drift.active,steer);
  return {f:{...frame,tan:poseForward,side:poseSide},boosting,air:state.drift.active,steer};
}

function updateAI(dt,time){
  for(let i=0;i<ai.length;i++){
    if(lesson||gateSlice)continue;
    const a=ai[i],r=race?.racers[i+1];
    if(race?.phase==='racing'&&r.finishTime===null){
      a.stun=Math.max(0,a.stun-dt);
      const gap=race.racers[0].progress-r.progress;
      const target=(a.target+clamp(gap*80,-30,35)+Math.sin(time*.5+i)*22)*(document.querySelector('#beginnerSetting').checked?.72:1);
      a.speed=lerp(a.speed,a.stun?190:target,1-Math.exp(-.8*dt));
      advanceRacer(race,r,a.speed*DISTANCE_SCALE/trackLength*dt,dt);a.t=((r.progress%1)+1)%1;
      a.lane=lerp(a.lane,Math.sin(time*.55+i*2.1)*24,dt*1.5);r.lane=a.lane;r.speed=a.speed;
      const near=Math.abs(r.progress-race.racers[0].progress)<.0025;
      if(near&&Math.abs(a.lane-state.lane)<10&&state.hit===0&&race.racers[0].finishTime===null){
        const impulse=Math.sign(state.lane-a.lane||1)*12/density();const roadSide=trackFrame(state.t).side;state.vx+=roadSide.x*impulse;state.vz+=roadSide.z*impulse;state.speed*=state.shield>0?.94:.86;state.shield=Math.max(0,state.shield-.10);state.hit=.3;
      }
    }
    if(r?.finishTime!==null&&r?.finishTime!==undefined){a.t=((race.elapsed-r.finishTime)*220/trackLength)%1;a.speed=220;}
  }
}
function presentAI(time){
  for(const [i,a] of ai.entries()){
    a.mesh.visible=!lesson&&!gateSlice;if(!a.mesh.visible)continue;
    animateCraft(a.mesh,time,a.speed/560,a.stun<=0&&Math.sin(time+i)>.96);
    const f=trackFrame(a.t);a.mesh.position.copy(f.p).addScaledVector(f.side,a.lane).addScaledVector(f.normal,3.7+rampHeight(a.t));
    a.mesh.quaternion.setFromRotationMatrix(poseMatrix.makeBasis(f.side.clone().negate(),f.normal,f.tan));
  }
  if(race)state.rank=standings(race).findIndex(r=>r.id===0)+1;
}
function density(){return craftDefs[craftIndex].mass;}

let qWas=false;
function updateCombat(dt){
  if(lesson||gateSlice){empRing.visible=false;return;}
  empCooldown=Math.max(0,empCooldown-dt);empPulse=Math.max(0,empPulse-dt);
  const targets=empTargets(state,ai.map((a,i)=>({x:a.mesh.position.x,z:a.mesh.position.z,team:race.mode==='team'?race.racers[i+1].team:'opponent',a})),race.mode==='team'?race.team:'player');
  const q=keys.has('KeyQ')||actions.has('KeyQ');
  if(q&&!qWas&&state.weapon>=.34&&empCooldown===0){
    state.weapon-=.34;empCooldown=5;empPulse=.55;targets.forEach(({a})=>a.stun=1.1);audio.cue('hit');ping(targets.length?`EMP HIT: ${targets.length}`:'NO TARGETS','#ff8caf');
  }
  qWas=q;state.weapon=Math.min(1,state.weapon+.018*dt);
  ui.text(raceNodes.empStatus,empCooldown>0?`COOLDOWN ${empCooldown.toFixed(1)}s`:keyText(`EMP: ${targets.length} TARGETS · Q`));
  ui.attr(raceNodes.empButton,'aria-disabled',String(empCooldown>0||state.weapon<.34));
  empRing.visible=empPulse>0||(targets.length>0&&empCooldown===0&&state.weapon>=.34);empRing.position.set(state.x,trackFrame(state.t).p.y+.7,state.z);empRing.scale.setScalar(1+(1-empPulse/.55)*.1);empRing.material.opacity=empPulse>0?empPulse/.55*.55:.12;
}

function updatePickups(dt,time){
  if(lesson)return;
  for(const p of pickups){
    if(!p.active){p.respawn-=dt;if(p.respawn<=0){p.active=true;p.m.visible=true}continue;}
    p.m.userData.animate(time+p.t*30,reducedMotion);
    let td=Math.abs(p.t-state.t);td=Math.min(td,1-td);
    if(td<.0028&&Math.abs(p.lane-state.lane)<9){
      p.active=false;p.m.visible=false;p.respawn=7;
      if(p.type==='boost'){state.boost=Math.min(1,state.boost+1/3); ping('BOOST OVERCHARGE','#21fff3')}
      if(p.type==='shield'){state.shield=1; ping('PHASE SHIELD','#8c6bff')}
      if(p.type==='weapon'){state.weapon=1; ping('EMP ARMED','#ff3d81')}
    }
  }
}

let cameraReady=false;
function updateCamera(dt,meta){
  const f={...meta.f,tan:meta.f.tan.clone()};
  cameraHeading=chaseHeading(cameraHeading,state.heading,dt,!cameraReady);
  f.tan.set(Math.sin(cameraHeading),0,Math.cos(cameraHeading)).addScaledVector(f.normal,-f.tan.dot(f.normal)).normalize();
  const speedN=clamp(state.speed/650,0,1);
  const desired=player.position.clone().addScaledVector(f.tan,-61-speedN*7).addScaledVector(f.normal,27+speedN*2);
  const shake=reducedMotion?0:state.hit?.45:0;
  desired.x+=(Math.random()-.5)*shake*speedN; desired.y+=(Math.random()-.5)*shake*speedN; desired.z+=(Math.random()-.5)*shake*speedN;
  if(!cameraReady){camera.position.copy(desired);cameraReady=true;}
  // Chase the actual vehicle heading, not the circuit tangent.
  camera.position.copy(desired);
  const look=player.position.clone().addScaledVector(f.tan,23+speedN*14).addScaledVector(f.side,state.laneVel*.07);
  camera.up.copy(f.normal).applyAxisAngle(f.tan,state.bank*.1).normalize();
  camera.lookAt(look);
  dir.position.copy(player.position).add(new THREE.Vector3(-110,220,90));dir.target.position.copy(player.position);
  chaseLight.position.copy(camera.position).addScaledVector(f.normal,20);chaseLight.target.position.copy(player.position);
  camera.fov=lerp(camera.fov,60+(reducedMotion?0:speedN*4+(state.nitro>0?6:state.miniTurbo>0?3:0)),1-Math.pow(.002,dt));camera.updateProjectionMatrix();
  if(bloom)bloom.strength=.22+(meta.boosting?.08:0);
  document.body.classList.toggle('boosting',meta.boosting);
}

function updateHUD(){
  ui.html(raceNodes.speed,`${String(Math.round(Math.abs(state.speed)*DISPLAY_SPEED)).padStart(3,'0')} <small>${state.speed<-.5?'REV':'KM/H'}</small>`);
  ui.text(raceNodes.sector,`${String(race?.phase==='countdown'?1:Math.floor(state.t*6)+1).padStart(2,'0')} / 06`);
  ui.text(raceNodes.lap,gateSlice?'SPRINT':`${state.lap} / 3`);
  ui.html(raceNodes.rank,`${state.rank}<span> / 8</span>`);
  ui.style(raceNodes.boostFill,'transform',`scaleX(${state.boost})`);
  ui.style(raceNodes.shieldFill,'transform',`scaleX(${state.shield})`);
  ui.style(raceNodes.weaponFill,'transform',`scaleX(${state.weapon})`);
  ui.text(raceNodes.shieldValue,String(Math.round(state.shield*100)).padStart(2,'0')+'%');
  ui.text(raceNodes.weaponValue,String(Math.round(state.weapon*100)).padStart(2,'0')+'%');
  ui.style(raceNodes.courseProgress,'width',`${state.t*100}%`);
  const p=curve.getPointAt(state.t);ui.attr(raceNodes.mapPlayer,'cx',p.x/1350*63+90);ui.attr(raceNodes.mapPlayer,'cy',p.z/1350*63+70);
  ui.text(raceNodes.raceTime,new Date(simulationTime*1000).toISOString().slice(14,22));

}

// Course map uses the same spline as the playable circuit.
const mapPoints=Array.from({length:161},(_,i)=>{const p=curve.getPointAt(i/160);return `${(p.x/1350*63+90).toFixed(1)},${(p.z/1350*63+70).toFixed(1)}`}).join(' ');
document.querySelector('#mapPath').setAttribute('points',mapPoints);
document.querySelector('.kart-options').innerHTML=craftDefs.map((d,i)=>`<button data-craft="${i}" aria-pressed="false" style="--kart-color:#${d.color.toString(16).padStart(6,'0')}"><span>${String(i+1).padStart(2,'0')}<i class="kart-swatch"></i></span><img alt="" width="216" height="124"><strong>${d.name}</strong><small>${d.tag}</small></button>`).join('');
document.querySelectorAll('[data-craft]').forEach(el=>el.addEventListener('click',()=>setCraft(Number(el.dataset.craft))));
function signTexture(title,subtitle,color='#214554'){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
  ctx.fillStyle=color;ctx.fillRect(0,0,1024,256);ctx.fillStyle='#ffdb98';ctx.fillRect(0,0,16,256);
  ctx.textAlign='center';ctx.fillStyle='#fff6df';ctx.font='bold 90px Arial';ctx.fillText(title,512,128);
  ctx.fillStyle='#c0dce2';ctx.font='24px Arial';ctx.fillText(subtitle,512,188);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
let bayDecor;
function buildDecor(){
const beforeBayDecor=new Set(scene.children);
// A soft sky gradient, sculpted islands and trackside props give the course a readable scale.
const sky=new THREE.Mesh(new THREE.SphereGeometry(6500,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vP;void main(){float h=normalize(vP).y;vec3 c=mix(vec3(.48,.73,.89),vec3(.08,.32,.62),smoothstep(-.05,.8,h));gl_FragColor=vec4(c,1.);}`}));scene.add(sky);
const grass=new THREE.MeshStandardMaterial({color:0x7fa98b,roughness:.95});
const cliff=new THREE.MeshStandardMaterial({color:0x849593,roughness:.85,flatShading:false});
const leaves=new THREE.MeshStandardMaterial({color:0x398468,roughness:.72});
const trunk=new THREE.MeshStandardMaterial({color:0x806c55,roughness:.9});
for(let i=0;i<26;i++){
  const f=trackFrame(i/26),island=new THREE.Group();
  island.position.copy(f.p).addScaledVector(f.side,(i%2?1:-1)*(150+(i%3)*40)).addScaledVector(f.normal,-95);
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),cliff);rock.scale.set(125,78,115);island.add(rock);
  const lawn=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),grass);lawn.scale.set(121,25,110);lawn.position.y=50;island.add(lawn);
  for(let n=0;n<4;n++){
    const x=Math.sin(n*4+i)*75,z=Math.cos(n*4+i)*60;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(2,3,30,6),trunk);stem.position.set(x,77,z);island.add(stem);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(17+(n%2)*7,14,10),leaves);leaf.scale.y=1.4;leaf.position.set(x,101,z);island.add(leaf);
    for(const sign of [-1,1]){const crown=new THREE.Mesh(new THREE.SphereGeometry(12,12,8),leaves);crown.position.set(x+sign*12,96,z+sign*5);crown.scale.y=1.15;island.add(crown);}
  }scene.add(island);
}
const lighthouse=new THREE.Group(),lf=trackFrame(.18);lighthouse.position.copy(lf.p).addScaledVector(lf.side,-155).addScaledVector(lf.normal,-35);
const lighthouseBody=new THREE.Mesh(new THREE.CylinderGeometry(10,16,100,20),new THREE.MeshStandardMaterial({color:0xf1e5c8,roughness:.7}));lighthouseBody.position.y=35;lighthouse.add(lighthouseBody);
for(const y of [15,55]){const band=new THREE.Mesh(new THREE.CylinderGeometry(14,14,9,20),new THREE.MeshStandardMaterial({color:0xc65840,roughness:.6}));band.position.y=y;lighthouse.add(band);}
const beacon=new THREE.Mesh(new THREE.CylinderGeometry(10,10,12,16),new THREE.MeshStandardMaterial({color:0xffd98e,emissive:0xffca6c,emissiveIntensity:.5,roughness:.22}));beacon.position.y=91;lighthouse.add(beacon);const roofBeacon=new THREE.Mesh(new THREE.ConeGeometry(16,9,20),new THREE.MeshStandardMaterial({color:0x344b58,roughness:.5}));roofBeacon.position.y=103;lighthouse.add(roofBeacon);scene.add(lighthouse);
const cloudMat=new THREE.MeshStandardMaterial({color:0xf3f5e9,roughness:1});
for(let i=0;i<22;i++){
  const a=i/22*Math.PI*2;
  const cloud=new THREE.Group();cloud.position.set(Math.cos(a)*2800,550+(i%4)*100,Math.sin(a)*2800);
  for(let n=0;n<3;n++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),cloudMat);m.scale.set(150+n*30,50+n*9,80);m.position.x=n*100;cloud.add(m);}scene.add(cloud);
}
const startFrame=trackFrame(0),startGate=new THREE.Group();startGate.position.copy(startFrame.p);
startGate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(startFrame.side.clone().negate(),startFrame.normal,startFrame.tan));
const startHeight=requestedScene==='harbor'?65:35;
for(const x of [-44,44]){const post=new THREE.Mesh(new THREE.BoxGeometry(3,startHeight,3),structureMat);post.position.set(x,startHeight/2,0);startGate.add(post);}
const banner=new THREE.Mesh(new THREE.BoxGeometry(90,19,2),new THREE.MeshStandardMaterial({map:signTexture('APEX CLUB',requestedScene==='harbor'?'NEON HARBOR / START — FINISH':requestedScene==='citadel'?'JADE CITADEL / START — FINISH':'BAY CIRCUIT / START — FINISH'),roughness:.6}));banner.position.y=startHeight;startGate.add(banner);
const gridWhite=new THREE.MeshStandardMaterial({color:0xfff5d8}),gridDark=new THREE.MeshStandardMaterial({color:0x213841});
for(let x=0;x<12;x++)for(let z=0;z<2;z++){const tile=new THREE.Mesh(new THREE.BoxGeometry(6.3,.12,3),((x+z)%2)?gridWhite:gridDark);tile.position.set((x-5.5)*6.3,.1,z*3);startGate.add(tile);}startGate.userData.sharedTrack=true;scene.add(startGate);
for(let i=0;i<34;i++){
  const f=trackFrame((i+.5)/34),next=trackFrame((i+.5)/34+.015),turn=f.tan.clone().cross(next.tan).dot(f.normal);
  if(Math.abs(turn)<.035)continue;
  const board=new THREE.Mesh(new THREE.BoxGeometry(19,10,1.5),new THREE.MeshStandardMaterial({map:signTexture(turn>0?'‹ ‹ ‹':'› › ›','DRIFT ZONE','#da8650'),roughness:.8}));
  board.position.copy(f.p).addScaledVector(f.side,turn>0?49:-49).addScaledVector(f.normal,11);
  board.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.side.clone().negate(),f.normal,f.tan));board.userData.sharedTrack=true;scene.add(board);
}
bayDecor=scene.children.filter(o=>!beforeBayDecor.has(o)&&!o.userData.sharedTrack);
}
buildDecor();
let citadel=null,harbor=null,selectedScene='bay';const showroom=createShowroom();let lobbyTime=0;
if(diagnosticsEnabled)renderer.info.autoReset=false;
const perf=createPerformanceProbe({
 enabled:diagnosticsEnabled,
 renderer,
 getContext:()=>({
  backend:'webgl2',
  width:renderer.domElement.width,
  height:renderer.domElement.height,
  dpr:renderer.getPixelRatio(),
  scene:selectedScene,
  craft:craftDefs[craftIndex]?.name || 'unknown',
  quality:document.querySelector('#qualitySetting')?.value || 'quality',
  uiWrites:uiWritesThisFrame,
  effects:raceEffects.stats?.(),language:getLanguage(),build:new URL(import.meta.url).searchParams.get('v')||'source',scenario:replayData?'gate-replay':gateSlice?'gate-sprint':'race',seed:null,randomness:'unseeded cosmetic effects and pickup placement',inputHash:replayData?.inputHash||null
 })
});
const sceneCache=new Map(),scenePreviews=new Set();
let routeObjects=[...world.children],decorObjects=scene.children.filter(o=>bayDecor.includes(o)||o.userData.sharedTrack);
function cacheRoute(){sceneCache.set(requestedScene,{curve,trackLength,roadSamples,trackMat,bayTrackObjects,structureMat,bayDecor,citadel,harbor,routeObjects,decorObjects});}
function activateRoute(name){
 cacheRoute();
 routeObjects.forEach(o=>o.visible=false);decorObjects.forEach(o=>o.visible=false);if(citadel)citadel.visible=false;if(harbor)harbor.visible=false;
 const cached=sceneCache.get(name);
 if(cached){
  requestedScene=name;({curve,trackLength,roadSamples,trackMat,bayTrackObjects,structureMat,bayDecor,citadel,harbor,routeObjects,decorObjects}=cached);
  routeObjects.forEach(o=>o.visible=true);decorObjects.forEach(o=>o.visible=true);
 }else{
  setRouteGeometry(name);const oldRoad=new Set(world.children),oldDecor=new Set(scene.children);
  buildRoad();buildDecor();citadel=null;harbor=null;
  routeObjects=world.children.filter(o=>!oldRoad.has(o));decorObjects=scene.children.filter(o=>!oldDecor.has(o));
 }
 for(const pickup of pickups){const f=trackFrame(pickup.t);pickup.m.position.copy(f.p).addScaledVector(f.side,pickup.lane).addScaledVector(f.normal,7);}
 document.querySelector('#mapPath').setAttribute('points',Array.from({length:161},(_,i)=>{const p=curve.getPointAt(i/160);return `${(p.x/1350*63+90).toFixed(1)},${(p.z/1350*63+70).toFixed(1)}`;}).join(' '));
 keyboard.clear();actions.clear();mobile.clear();cameraReady=false;
}
function selectScene(name,{historyMode='push'}={}){
 name=['bay','citadel','harbor'].includes(name)?name:'bay';
 if(race||launchElapsed!==null)return;
 const changed=name!==requestedScene;
 if(changed)activateRoute(name);
 selectedScene=name;const ancient=name==='citadel',night=name==='harbor';const title=night?'Neon Harbor':ancient?'Jade Citadel':'Bay Circuit';
 if(ancient&&!citadel){citadel=createCitadel(trackFrame,trackLength,t=>roadHalfWidth(requestedScene,t));scene.add(citadel);}
 if(citadel)citadel.visible=ancient;
 if(night&&!harbor){harbor=createHarbor(trackFrame,trackLength,t=>roadHalfWidth(requestedScene,t));scene.add(harbor);}if(harbor)harbor.visible=night;
 [...bayTrackObjects,...bayDecor,sea].forEach(o=>o.visible=!ancient&&!night);
 scene.background.set(night?0x111c34:ancient?0xc9baa0:0x83bed8);scene.fog.color.set(night?0x14263d:ancient?0x9cabb7:0xa8d3e5);scene.fog.density=night?.00025:ancient?.00036:.00022;
 dir.color.set(night?0xa8c9f4:ancient?0xffd49b:0xffedc9);ambientLight.color.set(night?0x759dc2:ancient?0xa7bfd9:0xdbefff);
 scene.traverse(o=>{if(o.userData.cosmeticDecal){o.castShadow=false;o.receiveShadow=false;}else if(o.isMesh&&o.material?.isMeshStandardMaterial&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});ghost.traverse(o=>o.castShadow=false);
 trackMat.uniforms.citadel.value=ancient?1:0;trackMat.uniforms.harbor.value=night?1:0;trackMat.roughness=night?.28:.86;trackMat.metalness=night?.25:0;
 document.body.dataset.scene=selectedScene;
 document.querySelectorAll('button[data-scene]').forEach(b=>{const on=b.dataset.scene===selectedScene;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelector('.track-title').textContent=title;
 document.querySelector('#sceneCaption').textContent=night?'NEON HARBOR / MIDNIGHT RUN':ancient?'JADE CITADEL / ANCIENT WALL RUN':'BAY CIRCUIT / COASTAL GRAND PRIX';
 document.querySelector('.navigation .label').textContent=night?'NEON HARBOR / LIVE MAP':ancient?'JADE CITADEL / LIVE MAP':'BAY CIRCUIT / LIVE MAP';
 cacheRoute();
 if(changed){
  try{sessionStorage.setItem('apex-lobby-choice',JSON.stringify({craft:craftIndex,mode:selectedMode,team:selectedTeam}));}catch{}
  const url=new URL(location.href);url.searchParams.set('scene',name);
  if(historyMode==='push')history.pushState(null,'',url);
  document.querySelector('.lobby-tools a').href=`./garage.html?craft=${craftIndex}&scene=${requestedScene}`;
  updateScenePreview();updateLobbyRecord();
 }

}
document.querySelectorAll('button[data-scene]').forEach(b=>b.addEventListener('click',()=>selectScene(b.dataset.scene)));
addEventListener('popstate',()=>{
 if(launchElapsed!==null){launchElapsed=null;launchAction=null;document.body.classList.remove('is-launching','launch-cut');document.querySelector('#raceStart').disabled=false;}
 if(race)returnLobby();
 selectScene(new URL(location.href).searchParams.get('scene'),{historyMode:'none'});
});
const rivalLabels=document.createElement('div');rivalLabels.id='rivalLabels';document.querySelector('.race-ui').append(rivalLabels);
const nameTags=ai.map(()=>{const el=document.createElement('div');el.className='rival-tag';rivalLabels.append(el);return el;});
const mapDots=ai.map(()=>{const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('r','2.7');document.querySelector('#mapRivals').append(circle);return circle;});
let lastRaceUI=-1;
function updateRaceHUD(){
  if(!race)return;
  mobile.update({...state,empCooldown});
  const opportunity=boostOpportunity(stunts),miniButton=raceNodes.miniButton;
  ui.attr(miniButton,'aria-disabled',String(!opportunity));ui.classToggle(miniButton,'ready',!!opportunity);
  ui.text(raceNodes.miniState,opportunity||'WAIT FOR WINDOW');
  if(opportunity&&!lastOpportunity)audio.cue('ready');lastOpportunity=opportunity;
  const prompt=raceNodes.stuntPrompt;ui.hidden(prompt,!opportunity);ui.text(prompt,opportunity+' · '+(mobileDevice?tr('TAP MINI'):keyText('PRESS E')));
  document.body.classList.toggle('drifting',state.drift.active);document.body.classList.toggle('charged',state.drift.charge>.78);
  ui.text(raceNodes.boostValue,`${Math.floor(state.boost*3+.01)} / 3`);
  ui.style(raceNodes.driftFill,'width',`${state.drift.charge*100}%`);
  ui.text(raceNodes.driftPercent,state.nitro>0?`${state.nitro.toFixed(1)}s`:state.miniTurbo>0?`${state.miniTurbo.toFixed(1)}s`:`${Math.round(state.drift.charge*100)}%`);
  ui.style(raceNodes.boostCountdown,'transform',`scaleX(${state.nitro>0?state.nitro/2.1:state.miniTurbo/1.5})`);
  ui.text(raceNodes.boostTitle,state.nitro>0?'NITRO':state.miniTurbo>0?(state.boostKind||'MINI TURBO'):'TURBO');ui.attr(raceNodes.boostStatus,'aria-hidden',String(state.nitro<=0&&state.miniTurbo<=0));
  ui.text(raceNodes.driftLabel,keyText(state.nitro>0?'NITRO BOOST':state.miniTurbo>0?(state.boostKind||'MINI TURBO'):state.drift.active?(state.drift.charge>=.78?'CHARGE → RELEASE → E':state.drift.charge>=.32?'CHARGE → RELEASE → E':'DRIFT / CHARGING'):(matchMedia('(pointer:coarse), (max-width:950px)').matches?'HOLD DRIFT + STEER':'HOLD SPACE + STEER')));
  ui.text(raceNodes.driftHint,keyText(state.drift.charge>.78?(document.querySelector('#toggleDrift').checked?'Tap SPACE again, then press E':'Release drift, then press E to boost'):state.drift.charge>.32?'Turbo ready · Keep charging to upgrade':(document.querySelector('#toggleDrift').checked?'Tap SPACE again, then press E':'Release drift, then press E to boost')));
  if(Math.abs(race.elapsed-lastRaceUI)<.1&&race.phase==='racing')return;lastRaceUI=race.elapsed;
  const ordered=standings(race),scores=teamScores(race);
  ui.text(raceNodes.blueScore,scores.blue);ui.text(raceNodes.redScore,scores.red);
  ui.html(raceNodes.leaderboard,ordered.map((r,i)=>`<div class="leader-row ${r.id===0?'you':''}"><b>${i+1}</b><i class="team-dot ${race.mode==='team'?r.team:'solo'}"></i><span>${r.name}</span><strong>${r.finishTime!==null?'FINISH':r.id===0?'YOU':'AI'}</strong></div>`).join(''));
  if(race.racers[0].finishTime!==null){ui.text(raceNodes.driftLabel,'FINISHED / AWAITING RESULTS');ui.text(raceNodes.driftHint,`Waiting for racers · ${Math.max(0,Math.ceil(20-(race.elapsed-race.firstFinish)))}s remaining`);}
  const occupied=[];
  ai.forEach((a,i)=>{
    const r=race.racers[i+1],p=a.mesh.position.clone().add(new THREE.Vector3(0,13,0)).project(camera);
    const el=nameTags[i],screenX=(p.x*.5+.5)*innerWidth,screenY=(-p.y*.5+.5)*innerHeight,clear=occupied.every(q=>Math.abs(q.x-screenX)>110||Math.abs(q.y-screenY)>28),visible=!lesson&&!gateSlice&&clear&&occupied.length<3&&p.z>-1&&p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.85&&a.mesh.position.distanceTo(player.position)<450;
    if(visible)occupied.push({x:screenX,y:screenY});el.hidden=!visible;el.style.left=`${(p.x*.5+.5)*100}%`;el.style.top=`${(-p.y*.5+.5)*100}%`;
    el.textContent=`${r.name} · ${race.mode==='team'?(r.team===race.team?'TEAMMATE':'RIVAL'):'AI'}`;el.dataset.team=race.mode==='team'?r.team:'solo';
    const f=curve.getPointAt(a.t);mapDots[i].setAttribute('cx',f.x/1350*63+90);mapDots[i].setAttribute('cy',f.z/1350*63+70);mapDots[i].setAttribute('fill',race.mode==='solo'?'#ffd38b':r.team==='blue'?'#65c4ff':'#ff8997');
  });
}

function finishRace(){
 finishExperience();
  race.phase='finished';keyboard.clear();actions.clear();mobile.clear();document.querySelector('#results').hidden=false;document.querySelector('#raceAgain').focus();
  const scores=teamScores(race,true),ordered=standings(race);
  const winner=scores.blue===scores.red?'DRAW':scores.blue>scores.red?'BLUE TEAM WINS':'RED TEAM WINS';
  document.querySelector('#resultTitle').textContent=race.mode==='team'?winner:ordered[0].id===0?'YOU WIN!':'Race complete';
  document.querySelector('#resultSubtitle').textContent=race.mode==='team'?`BLUE ${scores.blue} : ${scores.red} RED · Points awarded to finishers`:`Your position: P${state.rank} · ${selectedScene==='harbor'?'Neon Harbor':selectedScene==='citadel'?'Jade Citadel':'Bay Circuit'} / 3 laps`;
  document.querySelector('#resultRows').innerHTML=ordered.map((r,i)=>`<tr class="${r.id===0?'you':''}"><td>${String(i+1).padStart(2,'0')}</td><td><i class="team-dot ${race.mode==='team'?r.team:'solo'}"></i>${r.name}${r.id===0?' / YOU':' / AI'}</td><td>${r.finishTime===null?'DNF':formatTime(r.finishTime)}</td><td>${r.finishTime===null?0:SCORE_TABLE[i]}</td></tr>`).join('');
}
function updateSprintHUD(){
  if(!gateSlice)return;
  const hud=document.querySelector('#sprintHUD');hud.hidden=false;
  ui.text(document.querySelector('#sprintStage'),`GATE RUN · ${sprint.turns} / 3`);
  ui.text(document.querySelector('#sprintInstruction'),keyText(sprintInstruction(state.t)));
  ui.style(document.querySelector('#sprintProgress'),'transform',`scaleX(${clamp((race.racers[0].progress-GATE_SPRINT.start)/(GATE_SPRINT.finish-GATE_SPRINT.start),0,1)})`);
  ui.text(raceNodes.lap,'SPRINT');
}
function finishSprint(){
  race.phase='finished';keyboard.clear();actions.clear();mobile.clear();state.speed=0;state.vx=0;state.vz=0;
  let saved=false;try{if(!replayData)saved=saveSprint(localStorage,sprintRecordKey(craftIndex,document.querySelector('#beginnerSetting').checked),sprint);}catch{}
  document.querySelector('#results').hidden=false;document.querySelector('#results table').hidden=true;
  document.querySelector('#resultTitle').textContent='GATE RUN COMPLETE';
  document.querySelector('#resultSubtitle').textContent=`${formatTime(sprint.elapsed)} · ${tr('Three turns, one jump.')}`;
  document.querySelector('#challengeResult').textContent=tr(`Drifts ${sprint.drifts} · Mini boosts ${sprint.boosts} · Collisions ${sprint.collisions}`)+`
${tr('CUT BOOST')} ${sprint.cut} · ${tr('AIR BOOST')} ${sprint.air} · ${tr('LAND BOOST')} ${sprint.land}
`+tr(saved?'Challenge saved separately. Race records unchanged.':'Challenge complete. Race records unchanged.');
  document.querySelector('#raceAgain').focus();
  if(replayData){let output=document.querySelector('#replayReport');if(!output){output=document.createElement('output');output.id='replayReport';output.hidden=true;output.dataset.noTranslate='';document.body.append(output);}output.textContent=JSON.stringify({inputHash:replayData.inputHash,ticks:replayTick,sprint,performance:perf.exportReport()});}
}
function formatTime(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;}
function returnLobby(){document.querySelector('#sprintHUD').hidden=true;lesson=null;document.querySelector('#lessonHUD').hidden=true;document.body.classList.remove('in-lesson');ghost.visible=false;empRing.visible=false;race=null;helpOpen=false;keyboard.clear();actions.clear();mobile.clear();document.querySelector('#lobby').hidden=false;document.querySelector('#results').hidden=true;document.querySelector('#controlsPanel').hidden=true;document.body.classList.remove('in-race','boosting','drifting','charged');raceEffects.reset();streaks.material.opacity=0;setCraft(craftIndex);document.querySelector('#raceStart').focus();}
document.querySelector('#raceStart').addEventListener('click',()=>{let trained=gateSlice;try{trained=trained||localStorage.getItem('apex-trained')==='yes';}catch{}beginLaunch(trained?reset:startLesson);});
document.querySelector('#raceAgain').addEventListener('click',reset);
document.querySelectorAll('[data-lobby]').forEach(el=>el.addEventListener('click',returnLobby));
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>{selectedMode=el.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',String(b===el));});document.querySelector('#teamChoice').hidden=selectedMode!=='team';setCraft(craftIndex);}));
document.querySelectorAll('[data-team]').forEach(el=>el.addEventListener('click',()=>{selectedTeam=el.dataset.team;document.querySelectorAll('[data-team]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',String(b===el));});setCraft(craftIndex);}));
function loop(){
  requestAnimationFrame(loop);const timing=frameTiming(clock.getDelta()),elapsed=timing.dt;
  uiWritesThisFrame=0;perf.beginFrame(timing.frameMs,{droppedMs:timing.droppedMs});if(diagnosticsEnabled)renderer.info.reset();
  if(document.hidden||helpOpen||lesson?.timedOut){audio.update(0,false,false,false);perf.endFrame({phase:'paused'});return;}
  let dt=0;
  if(race?.phase==='countdown'){
    race.countdown-=elapsed;document.querySelector('#countdown').textContent=race.countdown>0?Math.ceil(race.countdown):'GO!';
    if(race.countdown<=0){race.phase='racing';document.querySelector('#countdown').hidden=true;ping('GO! / FULL THROTTLE','#ffdf87');}
  }else if(race?.phase==='racing'){
    dt=elapsed;race.elapsed+=dt;simulationTime=race.elapsed;
    if(actions.has('KeyR')){reset();dt=0;}
  }
  const time=simulationTime;
  if(!race){
    audio.update(0,false,false,false);
    lobbyTime+=elapsed;
    if(launchElapsed!==null){launchElapsed+=elapsed;document.body.classList.toggle('launch-cut',launchElapsed>.75);if(launchElapsed>=1.05){const action=launchAction;launchElapsed=null;launchAction=null;document.body.classList.remove('is-launching');document.querySelector('#raceStart').disabled=false;action();setTimeout(()=>document.body.classList.remove('launch-cut'),100);perf.endFrame({phase:'launch'});return;}}
    perf.measure('lobby-render',()=>showroom.render(renderer,player,lobbyTime,reducedMotion,launchElapsed===null?0:Math.min(1,launchElapsed/.85)));
    perf.endFrame({phase:'lobby'});
    return;
  }else{
    let meta;let steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
    if(replayData&&race.phase==='racing'){replayAccumulator+=dt;steps=Math.min(10,Math.floor((replayAccumulator+1e-9)*120));step=1/120;replayAccumulator-=steps*step;}
    perf.setSteps(steps);
    race.elapsed-=dt;
    perf.measure('simulation',()=>{for(let i=0;i<steps;i++){if(gateSlice&&sprint.finished&&!lesson)break;race.elapsed+=step;updatePlayer(step,race.elapsed);updateAI(step,race.elapsed);actions.delete('ShiftLeft');actions.delete('ShiftRight');actions.delete('KeyE');}});
    perf.measure('vehicle-presentation',()=>{meta=presentPlayer(dt,race.elapsed);presentAI(race.elapsed);});
    perf.measure('audio',()=>audio.update(state.speed/650,state.drift.active?Math.min(1,Math.abs(state.yaw)*3+.15):0,meta.boosting,race.phase==='racing'&&race.racers[0].finishTime===null,state.lap));
    if(dt>0&&race.racers[0].finishTime===null)perf.measure('world',()=>{updatePickups(dt,time);updateCombat(dt);});
    perf.measure('presentation',()=>{updateExperience(dt);updateCamera(elapsed,meta);updateSpeedFX(time,meta);});
    perf.measure('hud',()=>{updateHUD();updateRaceHUD();presentLesson();});
    perf.measure('race-effects',()=>raceEffects.update(dt,player,state,meta.f,meta.boosting));
    if(!lesson&&race.phase==='racing'){if(gateSlice&&sprint.finished)finishSprint();else if(!gateSlice&&shouldFinish(race))finishRace();}
  }
  actions.clear();trackMat.uniforms.time.value=time;sea.material.uniforms.time.value=time*.15;
  perf.measure('render',()=>{if(composer&&document.querySelector('#qualitySetting').value==='quality')composer.render();else renderer.render(scene,camera);});
  perf.endFrame({phase:race?.phase || 'none',uiWrites:uiWritesThisFrame});
}
let lesson=null,lessonFired=false,lessonFinished=false,smoothedSteer=0,lastOpportunity=null,empCooldown=0,empPulse=0;
let runStats,lapRecord,lapNumber=0,bestLap=null,recordKey='',lastBoosting=false,lapAssisted=false;
const ghost=makeCraft(0x9dd8ff,.9);ghost.name='Personal best ghost';ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.22;o.material.depthWrite=false;o.castShadow=false;}});ghost.visible=false;scene.add(ghost);
const empRing=new THREE.Mesh(new THREE.RingGeometry(148,150,96),new THREE.MeshBasicMaterial({color:0xff729c,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}));empRing.rotation.x=-Math.PI/2;empRing.visible=false;scene.add(empRing);
function resetExperience(){
 lesson=null;lessonFired=false;lessonFinished=false;smoothedSteer=0;lastOpportunity=null;empCooldown=0;empPulse=0;lastBoosting=false;
 document.querySelector('#lessonHUD').hidden=true;document.body.classList.remove('in-lesson');
 runStats={collisions:0,boosts:0,drifts:0,recoveries:[],recoveryStart:null};lapRecord=createLapRecord();lapNumber=0;
 lapAssisted=document.querySelector('#beginnerSetting').checked;
 recordKey=gateSlice?sprintRecordKey(craftIndex,document.querySelector('#beginnerSetting').checked):`apex-best-v2-${requestedScene==='harbor'?'harbor-v2':requestedScene}-${craftIndex}-${document.querySelector('#beginnerSetting').checked?'assisted':'standard'}`;
 try{const v=gateSlice?null:JSON.parse(localStorage.getItem(recordKey));bestLap=v&&Number.isFinite(v.time)&&Array.isArray(v.samples)&&v.samples.every(p=>Array.isArray(p)&&p.length===5&&p.every(Number.isFinite))?v:null;}catch{bestLap=null;}
}
function startLesson(){
 reset();lesson=createLesson();race.phase='racing';race.racers[0].progress=.002;state.t=.002;placeLesson();
 document.querySelector('#countdown').hidden=true;document.querySelector('#lessonHUD').hidden=false;document.querySelector('#retryLesson').hidden=true;document.body.classList.add('in-lesson');
 updateLesson(0,{steer:0,speed:0,brake:false,charge:0,fired:false});presentLesson();
}
function placeLesson(){const f=trackFrame(.002);state.t=.002;race.racers[0].progress=.002;Object.assign(state,{x:f.p.x,z:f.p.z,heading:Math.atan2(f.tan.x,f.tan.z),vx:0,vz:0,speed:0,lane:0,laneVel:0,roadIndex:null});Object.assign(stunts,createStunts());state.drift={active:false,charge:0,direction:0};cameraReady=false;}
function updateLesson(dt,input){
 const before=lesson.step,advanced=stepLesson(lesson,input,dt);lessonFired=false;
 if(advanced){audio.cue('complete');ping('STEP COMPLETE','#a2f1d6');if(before<2)placeLesson();}
 if(lesson.step===3&&!state.drift.active&&!boostOpportunity(stunts)&&!input.fired&&!lesson.done){lesson.step=2;ping('CHARGE A DRIFT','#a2f1d6');}
 if(lesson.timedOut){document.querySelector('#retryLesson').hidden=false;keyboard.clear();mobile.clear();audio.update(0,0,false,false);}
 if(lesson.done)lessonFinished=true;
}
function presentLesson(){
 if(!lesson)return;
 const titles=['TURN LEFT / RIGHT','BRAKE TO SLOW DOWN','CHARGE A DRIFT','RELEASE, THEN PRESS E'];
 const instructions=['Use A / D or touch arrows.','Hold S or BRAKE until speed drops.','Hold SPACE / DRIFT with steering until the bar turns blue.','Release SPACE / DRIFT, then press E / MINI while ready.'];
 ui.text(document.querySelector('#lessonTitle'),lesson.done?'PRACTICE COMPLETE':`${lesson.step+1} / 4 · ${keyText(titles[lesson.step])}`);
 ui.text(document.querySelector('#lessonInstruction'),lesson.timedOut?'Practice paused. Retry or skip to race.':lesson.done?'PRACTICE COMPLETE':keyText(instructions[lesson.step]));
 ui.text(document.querySelector('#lessonTime'),`${Math.max(0,Math.ceil(55-lesson.elapsed))}s`);document.querySelector('#lessonProgress').value=lesson.step;
}
function updateExperience(dt){
 if(lessonFinished){try{localStorage.setItem('apex-trained','yes');}catch{}reset();return;}
 if(lesson){ghost.visible=false;return;}
 if(gateSlice){ghost.visible=false;updateSprintHUD();return;}
 if(race.phase!=='racing')return;
 if(document.querySelector('#beginnerSetting').checked!==lapAssisted)lapRecord.invalid=true;
 const progress=race.racers[0].progress-lapNumber;
 if(race.racers[0].finishTime===null||progress>=1){
 const result=recordLap(lapRecord,progress,race.elapsed,{x:state.x,y:player.position.y,z:state.z,heading:state.heading});
 if(result){if(result.valid){if(!bestLap||result.time<bestLap.time){bestLap=result;try{localStorage.setItem(recordKey,JSON.stringify(result));}catch{}ping('NEW PERSONAL BEST','#a8ebdc');}if(onlineClub.configured&&club.profile())onlineClub.submit({scene:requestedScene,assisted:lapAssisted,craft:craftIndex,lap:result}).then(saved=>{if(saved)club.message('New global best lap submitted.');}).catch(error=>club.message(`Lap upload failed: ${error.message}`));}lapNumber++;lapRecord=createLapRecord();lapRecord.started=true;lapRecord.startTime=race.elapsed;lapAssisted=document.querySelector('#beginnerSetting').checked;}
 }
 const ghostState=bestLap&&document.querySelector('#ghostSetting').checked?ghostPose(bestLap.samples,race.elapsed-lapRecord.startTime):null;
 ghost.visible=!!ghostState&&lapRecord.started&&race.racers[0].finishTime===null;
 if(ghost.visible){ghost.position.set(ghostState.x,ghostState.y,ghostState.z);ghost.rotation.set(0,ghostState.heading,0);}
 const split=lapRecord.splits.length-1,delta=split>=0&&bestLap?.splits[split]!==undefined?lapRecord.splits[split]-bestLap.splits[split]:null;
 document.querySelector('#lapDelta').textContent=bestLap?`LAP BEST ${formatTime(bestLap.time)}${delta===null?'':` · SECTOR ${split+1} ${delta>0?'+':''}${delta.toFixed(2)}s`}`:'PERSONAL BEST —';
 const f=trackFrame(state.t),next=trackFrame(state.t+.018),turn=f.tan.clone().cross(next.tan).y;
 const corner=document.querySelector('#cornerPrompt');corner.hidden=!document.querySelector('#beginnerSetting').checked||Math.abs(turn)<.13;corner.textContent=`BRAKE · ${turn>0?'LEFT TURN':'RIGHT TURN'}`;
 const boosting=state.nitro>0||state.miniTurbo>0;if(lastBoosting&&!boosting)audio.cue('end');lastBoosting=boosting;
}
function finishExperience(){
 if(gateSlice)return;
 ghost.visible=false;const award=medals({...runStats,finished:race.racers[0].finishTime!==null});let best=0;try{best=Math.max(Number(localStorage.getItem('apex-medal')||0),award);localStorage.setItem('apex-medal',String(best));}catch{}
 const names=['—','BRONZE','SILVER','GOLD'];document.querySelector('#challengeResult').textContent=`${names[award]} · Collisions ${runStats.collisions} · Drifts ${runStats.drifts} · Mini boosts ${runStats.boosts} · Best medal ${names[best]}${runStats.recoveries.length?` · Recovery avg ${(runStats.recoveries.reduce((a,b)=>a+b,0)/runStats.recoveries.length).toFixed(1)}s`:''}`;
 if(award){document.querySelector('#liverySetting option[value=reward]').disabled=false;audio.cue('complete');}
}
function setupExperience(){
 try{document.querySelector('#liverySetting option[value=reward]').disabled=Number(localStorage.getItem('apex-medal')||0)<1;}catch{}
 const ids=['beginnerSetting','ghostSetting','liverySetting','musicVolume','engineVolume','promptVolume'];
 try{const saved=JSON.parse(localStorage.getItem('apex-experience')||'{}');for(const id of ids)if(saved[id]!==undefined){const el=document.getElementById(id);if(el.type==='checkbox')el.checked=!!saved[id];else el.value=saved[id];}}catch{}
 const save=()=>{const values={};for(const id of ids){const el=document.getElementById(id);values[id]=el.type==='checkbox'?el.checked:el.value;}try{localStorage.setItem('apex-experience',JSON.stringify(values));}catch{}for(const kind of ['music','engine','prompt'])audio.setVolume(kind,Number(document.getElementById(kind+'Volume').value)/100);};
 ids.forEach(id=>document.getElementById(id).addEventListener('change',()=>{save();if(id==='liverySetting')setCraft(craftIndex);}));save();
 document.querySelector('#practiceStart').addEventListener('click',startLesson);document.querySelector('#practiceSettings').addEventListener('click',()=>{document.querySelector('#settingsDialog').close();startLesson();});
 document.querySelector('#skipLesson').addEventListener('click',()=>{try{localStorage.setItem('apex-trained','yes');}catch{}reset();});document.querySelector('#retryLesson').addEventListener('click',startLesson);
 const rules=document.createElement('p');rules.className='challenge-rules';rules.textContent=tr('Bronze: finish. Silver: finish with ≤3 collisions. Gold: also complete 6 drifts and 6 mini boosts.');document.querySelector('[data-settings-panel="controls"]').append(rules);
}

let launchElapsed=null,launchAction=null;
function beginLaunch(action){
 if(launchElapsed!==null)return;
 if(reducedMotion){action();return;}
 launchElapsed=0;launchAction=action;document.body.classList.add('is-launching');document.querySelector('#raceStart').disabled=true;audio.start();audio.cue('complete');
}
function updateLobbyRecord(){
 const names=['CLUB DRIVER','BRONZE DRIVER','SILVER DRIVER','GOLD DRIVER'];let medal=0,record=null;
 try{medal=Math.min(3,Number(localStorage.getItem('apex-medal')||0));record=JSON.parse(localStorage.getItem(`apex-best-v2-${requestedScene==='harbor'?'harbor-v2':requestedScene}-${craftIndex}-${document.querySelector('#beginnerSetting').checked?'assisted':'standard'}`)||'null');}catch{}
 document.querySelector('#profileMedal').textContent=names[medal]||names[0];document.querySelector('#sceneBest').textContent=record?.time?`PERSONAL BEST ${formatTime(record.time)}`:'PERSONAL BEST —';
}
function snapshot(s,c,width,height){
  const target=new THREE.WebGLRenderTarget(width,height);target.texture.colorSpace=THREE.SRGBColorSpace;const previous=renderer.getRenderTarget();
  const pixels=new Uint8Array(width*height*4);
  try{renderer.setRenderTarget(target);renderer.render(s,c);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);}
  finally{renderer.setRenderTarget(previous);target.dispose();}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);
  for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return canvas.toDataURL('image/png');
}

function updateScenePreview(){
 if(scenePreviews.has(requestedScene))return;
 const f=trackFrame(.025),previewCamera=new THREE.PerspectiveCamera(55,432/200,.1,9000);previewCamera.position.copy(f.p).addScaledVector(f.tan,-145).addScaledVector(f.side,25).addScaledVector(f.normal,60);previewCamera.lookAt(f.p.clone().addScaledVector(f.tan,75).addScaledVector(f.normal,18));
 const url=snapshot(scene,previewCamera,432,200),image=document.querySelector(`button[data-scene="${requestedScene}"] img`);image.src=url;image.hidden=false;try{localStorage.setItem(`apex-lobby-preview-v2-${requestedScene}`,url);}catch{}
 scenePreviews.add(requestedScene);
}
function setupClubLobby(){
 showroom.scene.environment=scene.environment;
 for(const type of ['bay','citadel','harbor']){
  const route=new THREE.CatmullRomCurve3(circuitPoints(type).map(p=>new THREE.Vector3(...p)),true,'catmullrom',type==='harbor'?.65:.35);
  document.querySelector(`button[data-scene="${type}"] polyline`).setAttribute('points',Array.from({length:101},(_,i)=>{const p=route.getPointAt(i/100);return `${90+p.x/1350*63},${70+p.z/1350*63}`;}).join(' '));
  try{const cached=localStorage.getItem(`apex-lobby-preview-v2-${type}`);if(cached?.startsWith('data:image/png;base64,')){const image=document.querySelector(`button[data-scene="${type}"] img`);image.src=cached;image.hidden=false;}}catch{}
 }
 const miniScene=new THREE.Scene();miniScene.background=new THREE.Color(0x102635);miniScene.environment=scene.environment;miniScene.add(new THREE.HemisphereLight(0xd8efff,0x293646,2));const light=new THREE.DirectionalLight(0xffe8c6,3);light.position.set(12,22,18);miniScene.add(light);
 const miniCamera=new THREE.PerspectiveCamera(38,216/124,.1,150);miniCamera.position.set(26,16,35);miniCamera.lookAt(0,0,0);const kart=makeCraft(0xffffff,1);miniScene.add(kart);
 for(let i=0;i<craftDefs.length;i++){configureKart(kart,craftDefs[i]);colorKart(kart,craftDefs[i].color);applyCustomization(kart,readGarage().cars[i],craftDefs[i].style==='rally'?0x1497a0:craftDefs[i].color);document.querySelector(`[data-craft="${i}"] img`).src=snapshot(miniScene,miniCamera,216,124);}
 const geometries=new Set(),materials=new Set();kart.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 updateScenePreview();
 updateLobbyRecord();
}

let driverMounted=false;
function showDriver(){if(driverMounted)return;try{mountDriverStudio(document.querySelector('#driverStudio'),()=>!race&&document.querySelector('#settingsDialog').open&&!document.querySelector('[data-settings-panel=driver]').hidden);driverMounted=true;}catch{document.querySelector('#driverStudio .driver-action').textContent='3D preview unavailable on this device';}}

document.querySelector('#motionSetting').checked=reducedMotion;
function saveSettings(){try{localStorage.setItem('apex-settings',JSON.stringify({toggleDrift:document.querySelector('#toggleDrift').checked,motion:reducedMotion,audio:document.querySelector('#audioSetting').checked,quality:document.querySelector('#qualitySetting').value}));}catch{}}
function applyQuality(){const low=document.querySelector('#qualitySetting').value==='performance';renderer.shadowMap.enabled=!low;renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.6));renderer.setSize(innerWidth,innerHeight);if(!low)ensureComposer();composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(innerWidth,innerHeight);if(bloom)bloom.enabled=!low;saveSettings();}
if(mobileDevice)document.querySelector('#qualitySetting').value='performance';
try{const saved=JSON.parse(localStorage.getItem('apex-settings')||'null');if(saved){document.querySelector('#toggleDrift').checked=!!saved.toggleDrift;reducedMotion=!!saved.motion;document.querySelector('#motionSetting').checked=reducedMotion;document.querySelector('#audioSetting').checked=saved.audio!==false;document.querySelector('#qualitySetting').value=saved.quality==='performance'?'performance':'quality';}}catch{}
audio.setEnabled(document.querySelector('#audioSetting').checked);
document.querySelector('#toggleDrift').addEventListener('change',saveSettings);
document.querySelector('#audioSetting').addEventListener('change',e=>{audio.setEnabled(e.target.checked);saveSettings();});
document.querySelector('#motionSetting').addEventListener('change',e=>{reducedMotion=e.target.checked;saveSettings();});
document.querySelector('#qualitySetting').addEventListener('change',applyQuality);
applyQuality();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toggleControls(true);document.querySelector('#runtimeError').hidden=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&race?.phase==='racing')toggleControls(true);});
try{const choice=JSON.parse(sessionStorage.getItem('apex-lobby-choice')||'null');if(choice&&craftDefs[choice.craft]){craftIndex=choice.craft;selectedMode=choice.mode==='solo'?'solo':'team';selectedTeam=choice.team==='red'?'red':'blue';document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===selectedMode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});document.querySelectorAll('[data-team]').forEach(b=>{const on=b.dataset.team===selectedTeam;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});document.querySelector('#teamChoice').hidden=selectedMode==='solo';}}catch{}
const garageChoice=new URLSearchParams(location.search).get('craft');if(garageChoice!==null&&/^[0-5]$/.test(garageChoice))craftIndex=Number(garageChoice);
if(gateSlice){
  craftIndex=4;selectedMode='solo';document.body.classList.add('diagnostic-slice');
  document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode==='solo';b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  document.querySelector('#teamChoice').hidden=true;
  document.querySelector('#raceStart').innerHTML='Launch gate sprint <span>↗</span>';
  document.querySelector('.scene-options').hidden=true;document.querySelector('.mode-options').hidden=true;
  document.querySelector('.race-disclosure').textContent=replayData?'DIAGNOSTIC REPLAY · Recorded inputs · No records saved':'Three turns, one jump. Your controls. Separate challenge records.';
}
setCraft(craftIndex);
selectScene(requestedScene);
setupExperience();
if(gateSlice)document.querySelector('#autoThrottle').checked=true;
setupClubLobby();
mountKeyboardSettings({getBindings:()=>bindings,setBindings:next=>{bindings=next;keyboard.clear();actions.clear();driftLatched=false;updateKeyboardDescription();try{localStorage.setItem('apex-keybindings',JSON.stringify(next));return true;}catch{return false;}}});
setupLanguage();
const club=mountOnlineClub({scene:()=>requestedScene,assisted:()=>document.querySelector('#beginnerSetting').checked,craft:()=>craftIndex,onProfile:profile=>{document.querySelector('#profileName').textContent=profile?.player_name||'GUEST';document.querySelector('.club-online').lastChild.textContent=profile?' ONLINE CLUB':' LOCAL CLUB';}});
loop();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight)});

const settingsDialog=document.querySelector('#settingsDialog');
document.querySelector('#openSettings').addEventListener('click',()=>settingsDialog.showModal());
document.querySelector('#closeSettings').addEventListener('click',()=>settingsDialog.close());
settingsDialog.addEventListener('click',e=>{if(e.target===settingsDialog){const r=settingsDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)settingsDialog.close();}});
document.querySelectorAll('[data-settings]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-settings]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelectorAll('[data-settings-panel]').forEach(panel=>panel.hidden=panel.dataset.settingsPanel!==button.dataset.settings);
 if(button.dataset.settings==='driver')showDriver();
}));

document.querySelector('.lobby-tools a').addEventListener('click',()=>{try{sessionStorage.setItem('apex-lobby-choice',JSON.stringify({craft:craftIndex,mode:selectedMode,team:selectedTeam}));}catch{}});
addEventListener('storage',e=>{if(e.key===GARAGE_KEY&&!race)setCraft(craftIndex);});
