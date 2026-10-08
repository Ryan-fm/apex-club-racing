import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenTilt,tiltSteering,isHandheldDevice} from '../mobile-controls.js';
test('landscape directions follow screen rotation in either grip',()=>{
 assert(screenTilt(20,0,90)>0);assert(screenTilt(20,0,270)<0);
 assert(screenTilt(0,20,0)>0);assert(screenTilt(0,20,180)<0);
 assert.equal(screenTilt(null,20,90),null);
});
test('calibrated tilt has a dead zone and bounded steering',()=>{
 assert.equal(tiltSteering(17,15),0);assert.equal(tiltSteering(42,15),1);
 assert.equal(tiltSteering(-100,15),-1);assert.equal(tiltSteering(30,15),.5);
});

import {createMobileControls} from '../mobile-controls.js';
test('multi-touch steering slides independently of drift and clears on cancellation',()=>{
 const saved=new Map(['document','screen','window','addEventListener','matchMedia'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const make=()=>({focus(){},listeners:{},attrs:{},dataset:{},checked:true,classList:{toggle(){},remove(){}},style:{setProperty(){}},addEventListener(t,f){this.listeners[t]=f;},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;}});
 const drive=['left','right','drift','nitro','emp','throttle','brake'].map(name=>Object.assign(make(),{dataset:{drive:name},parentElement:{getBoundingClientRect:()=>({left:0,right:180,top:100,bottom:190})}}));
 const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,make());return nodes.get(s);};
 const query=s=>s.startsWith('[data-drive=')?drive.find(b=>s.includes('"'+b.dataset.drive+'"')):get(s);
 let actions=[];const documentEvents={};const orientation={matches:false,addEventListener(t,f){this.change=f;}};const gate=Object.assign(make(),{querySelector:query,querySelectorAll:()=>[],focus(){}});
 Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>orientation});
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{lang:'zh-CN',classList:{toggle(){}}},body:{append(){}},createElement:()=>gate,querySelector:query,querySelectorAll:s=>s==='[data-drive]'?drive:[],addEventListener(t,f){documentEvents[t]=f;}}});
  Object.defineProperty(globalThis,'screen',{configurable:true,value:{orientation:{angle:90,addEventListener(){}}}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}});Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:()=>{}});
  const controls=createMobileControls({handheld:true,active:()=>true,action:x=>actions.push(x),pause(){}});
  for(const type of ['contextmenu','selectstart','dragstart']){let prevented=false;documentEvents[type]({target:{closest:()=>null},preventDefault(){prevented=true;}});assert(prevented);prevented=false;documentEvents[type]({target:{closest:()=>({})},preventDefault(){prevented=true;}});assert(!prevented);}
  const fire=(name,type,id,x=30,y=150)=>drive.find(b=>b.dataset.drive===name).listeners[type]({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
  fire('left','pointerdown',1);fire('drift','pointerdown',2);
  assert.equal(controls.steer(.016),-1);assert(controls.down('drift'));
  fire('left','pointermove',1,140);assert.equal(controls.steer(.016),1);assert(controls.down('drift'));
  fire('left','pointercancel',1);assert.equal(controls.steer(.016),0);assert(controls.down('drift'));
  controls.update({boost:0,nitro:0,weapon:0,drift:{active:true,charge:.4}});
  fire('nitro','pointerdown',3);assert.deepEqual(actions,[]);
  controls.update({boost:1,nitro:0,weapon:1,drift:{active:false,charge:0}});
  fire('nitro','pointerdown',4);assert.deepEqual(actions,['nitro']);
  controls.clear();assert(!controls.down('drift'));assert.equal(controls.steer(.016),0);
  let launches=0;controls.prepareLaunch(()=>launches++);assert.equal(launches,0);assert.equal(gate.hidden,false);orientation.matches=true;orientation.change();assert.equal(launches,1);assert.equal(gate.hidden,true);orientation.change();assert.equal(launches,1);
 }finally{for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
});

test('sensor controls exclude desktops and touchscreen laptops, include phones and iPad',()=>{
 for(const nav of [{userAgent:'Windows NT',maxTouchPoints:10},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0},{userAgent:'Linux x86_64'},undefined])assert.equal(isHandheldDevice(nav),false);
 for(const nav of [{userAgent:'iPhone'},{userAgent:'Android'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5},{userAgentData:{mobile:true}}])assert.equal(isHandheldDevice(nav),true);
});
test('desktop adapter registers no sensor, orientation or touch listeners',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
 try{
  Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{classList:{toggle(){}}}}});
  const controls=createMobileControls({handheld:false,action(){throw Error('desktop mobile action');},active:()=>true,pause(){throw Error('desktop orientation pause');}});
  assert.equal(controls.down('throttle'),false);assert.equal(controls.down('brake'),false);assert.equal(controls.steer(.1),0);controls.clear();controls.update({});
 }finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
});
