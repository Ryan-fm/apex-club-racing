import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenTilt,tiltSteering,isHandheldDevice,isLandscapeDisplay,requestLandscapeDisplay} from '../mobile-controls.js';
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
  Object.defineProperty(globalThis,'screen',{configurable:true,value:{orientation:{angle:0,addEventListener(t,f){this.change=f;}}}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}});Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:()=>{}});
  const windowEvents={};window.visualViewport={addEventListener(t,f){windowEvents['visual-'+t]=f;}};
  Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:(t,f)=>{windowEvents[t]=f;}});
  let racing=true,pauses=0;
  const controls=createMobileControls({handheld:true,active:()=>racing,action:x=>actions.push(x),pause(){pauses++;racing=false;}});
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
  orientation.matches=false;
  controls.prepareLaunch(()=>launches++);assert.equal(gate.hidden,false);
  screen.orientation.type='landscape-primary';windowEvents.orientationchange();
  assert.equal(launches,2);assert.equal(gate.hidden,true);
  windowEvents.resize();documentEvents.fullscreenchange();assert.equal(launches,2);
  screen.orientation.type='portrait-primary';
  controls.prepareLaunch(()=>launches++);gate.querySelector('.secondary').listeners.click();
  screen.orientation.type='landscape-secondary';windowEvents.resize();assert.equal(launches,2);
  controls.prepareLaunch(()=>launches++);assert.equal(launches,3);assert.equal(gate.hidden,true);
  screen.orientation.type='portrait-primary';
  controls.prepareLaunch(()=>launches++);assert.equal(gate.hidden,false);
  window.innerWidth=851;window.innerHeight=393;windowEvents.resize();
  assert.equal(launches,4);assert.equal(gate.hidden,true);
  windowEvents['visual-resize']();assert.equal(launches,4);
  window.innerWidth=393;window.innerHeight=851;screen.orientation.type='portrait-primary';
  racing=false;const before=pauses;
  controls.prepareLaunch(()=>{launches++;racing=true;});
  screen.orientation.type='landscape-primary';screen.orientation.angle=90;screen.orientation.change();
  assert.equal(launches,5);assert.equal(racing,true);assert.equal(pauses,before,'the rotation that starts a race must not immediately pause it');
  window.orientation=90;windowEvents.orientationchange();assert.equal(pauses,before,'duplicate native/legacy notifications must not pause the newly started race');
  screen.orientation.type='portrait-primary';screen.orientation.angle=0;window.orientation=0;screen.orientation.change();
  assert.equal(pauses,before+1);assert.equal(racing,false,'rotating during an existing race still pauses safely');
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

test('Android embedded orientation detection handles stale viewport and legacy WebViews',()=>{
 assert.equal(isLandscapeDisplay({innerWidth:393,innerHeight:851},{orientation:{type:'landscape-primary'}},false),true);
 assert.equal(isLandscapeDisplay({innerWidth:393,innerHeight:851},{orientation:{type:'landscape-secondary'}},false),true);
 assert.equal(isLandscapeDisplay({innerWidth:851,innerHeight:393},{},false),true);
 for(const orientation of [-90,90])assert.equal(isLandscapeDisplay({orientation},{},false),true);
 assert.equal(isLandscapeDisplay({innerWidth:393,innerHeight:851,orientation:0},{orientation:{type:'portrait-primary',angle:90}},false),false);
 assert.equal(isLandscapeDisplay({},{orientation:{angle:90}},false),true);
 assert.equal(isLandscapeDisplay({},{},true),true);
});

test('stale Android portrait type does not override an updated legacy rotation angle',()=>{
 for(const orientation of [90,-90,270])assert.equal(isLandscapeDisplay({innerWidth:393,innerHeight:851,orientation},{orientation:{type:'portrait-primary',angle:0}},false),true);
 assert.equal(isLandscapeDisplay({orientation:0},{orientation:{type:'portrait-primary',angle:90}},false),false);
});
test('orientation is attempted after fullscreen rejection and preserves API receivers',async()=>{
 const calls=[],element={requestFullscreen(){assert.equal(this,element);calls.push('fullscreen');throw Object.assign(new Error(),{name:'NotAllowedError'});}};
 const orientation={lock(value){assert.equal(this,orientation);calls.push(value);return Promise.resolve();}};
 const result=await requestLandscapeDisplay({documentElement:element},{orientation},20);
 assert.deepEqual(calls,['fullscreen','landscape']);assert.equal(result.fullscreen.reason,'NotAllowedError');assert.equal(result.orientation.ok,true);
});
test('hung fullscreen cannot prevent the landscape request or hang the UI',async()=>{
 let locked=false;
 const result=await requestLandscapeDisplay({documentElement:{requestFullscreen:()=>new Promise(()=>{})}},{orientation:{lock(){locked=true;return new Promise(()=>{});}}},10);
 assert.equal(locked,true);assert.equal(result.fullscreen.reason,'TimeoutError');assert.equal(result.orientation.reason,'TimeoutError');
});
test('legacy fullscreen and orientation APIs work without modern event methods',async()=>{
 const calls=[];
 const result=await requestLandscapeDisplay({documentElement:{webkitRequestFullscreen(){calls.push('fullscreen');}}},{lockOrientation(value){calls.push(value);return true;}},20);
 assert.deepEqual(calls,['fullscreen','landscape']);assert.equal(result.fullscreen.ok,true);assert.equal(result.orientation.ok,true);
 const unsupported=await requestLandscapeDisplay({documentElement:{}},{},20);
 assert.equal(unsupported.orientation.reason,'unsupported');
 const denied=await requestLandscapeDisplay({fullscreenElement:{}},{lockOrientation:()=>false},20);
 assert.equal(denied.orientation.ok,false);
});
