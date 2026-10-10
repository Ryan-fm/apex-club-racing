// A narrow window or touchscreen laptop is not a phone.
export function isHandheldDevice(nav=globalThis.navigator){
  return !!nav && (nav.userAgentData?.mobile===true || /Android|iPhone|iPad|iPod/i.test(nav.userAgent||'') || (nav.platform==='MacIntel'&&nav.maxTouchPoints>1));
}
// Screen-relative tilt: map gravity into the phone's current screen axes.
export function screenTilt(beta,gamma,angle=0){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma))return null;
  const b=beta*Math.PI/180,g=gamma*Math.PI/180,a=angle*Math.PI/180;
  const x=Math.cos(b)*Math.sin(g),y=Math.sin(b);
  return Math.asin(Math.max(-1,Math.min(1,x*Math.cos(a)+y*Math.sin(a))))*180/Math.PI;
}
export function tiltSteering(value,center=0){
  const d=value-center;return Math.sign(d)*Math.min(1,Math.max(0,Math.abs(d)-3)/24);
}
// Embedded Android pages can retain a portrait viewport after the device rotates.
export function isLandscapeDisplay(win=globalThis.window,display=globalThis.screen,media=false){
  const type=display?.orientation?.type;
  if(type?.startsWith('landscape'))return true;
  if(Number.isFinite(win?.innerWidth)&&Number.isFinite(win?.innerHeight)&&win.innerWidth>win.innerHeight)return true;
  if(media)return true;
  // Some Android WebViews keep a stale orientation.type but update window.orientation.
  if(Number.isFinite(win?.orientation)&&Math.abs(win.orientation)%180===90)return true;
  return !type&&Number.isFinite(display?.orientation?.angle)&&Math.abs(display.orientation.angle)%180===90;
}
// Native WebView calls may reject, expose legacy APIs, or never settle.
// Bound each call so a blocked fullscreen request cannot also block orientation.
export async function requestLandscapeDisplay(doc=globalThis.document,display=globalThis.screen,timeoutMs=1800){
  const attempt=async operation=>{
    if(!operation)return {ok:false,reason:'unsupported'};
    let timer;
    try{
      const result=operation();
      const value=await Promise.race([Promise.resolve(result),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('timeout'),{name:'TimeoutError'})),timeoutMs);})]);
      return value===false?{ok:false,reason:'denied'}:{ok:true};
    }catch(error){return {ok:false,reason:error?.name||'denied'};}
    finally{clearTimeout(timer);}
  };
  const element=doc?.documentElement;
  const fullscreenMethod=element?.requestFullscreen||element?.webkitRequestFullscreen;
  const fullscreen=doc?.fullscreenElement||doc?.webkitFullscreenElement?{ok:true}:await attempt(fullscreenMethod&&(()=>fullscreenMethod.call(element)));
  const orientationMethod=display?.orientation?.lock;
  const legacyMethod=display?.lockOrientation||display?.mozLockOrientation||display?.msLockOrientation;
  const orientation=await attempt(orientationMethod?()=>orientationMethod.call(display.orientation,'landscape'):legacyMethod?()=>legacyMethod.call(display,'landscape'):null);
  return {fullscreen,orientation};
}
export function createMobileControls({action,active,pause,handheld=isHandheldDevice()}){
  document.documentElement?.classList.toggle('handheld-input',handheld);
  if(!handheld)return {clear(){},update(){},down:()=>false,steer:()=>0,prepareLaunch:go=>go()};
  const landscape=matchMedia('(orientation: landscape)');
  const gate=document.createElement('section');
  gate.id='landscapeGate';gate.hidden=true;gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');gate.setAttribute('aria-labelledby','landscapeGateTitle');
  gate.innerHTML='<div class="landscape-card"><span class="rotate-device" aria-hidden="true">↻</span><h2 id="landscapeGateTitle"></h2><p></p><button type="button" class="primary"></button><button type="button" class="secondary"></button></div>';
  document.body.append(gate);
  let pendingLaunch=null,returnFocus=null;
  const closeGate=()=>{gate.hidden=true;pendingLaunch=null;returnFocus?.focus();};
  let requestingLandscape=false;
  const requestLandscape=async()=>{
    if(requestingLandscape)return;
    requestingLandscape=true;
    const primary=gate.querySelector('.primary');primary.disabled=true;
    try{
      const result=await requestLandscapeDisplay();
      resumeLaunch();
      if(pendingLaunch&&!gate.hidden){
        const zh=document.documentElement.lang.startsWith('zh');
        gate.querySelector('p').textContent=result.orientation.ok
          ?(zh?'横屏请求已发送。请横放手机，等待画面旋转。':'Landscape requested. Turn your phone sideways and wait for the display.')
          :(zh?'当前浏览器或 App 没有允许自动横屏。请打开手机自动旋转后横放；如果整个页面仍不旋转，请从浏览器打开游戏。':'This browser or app did not allow automatic landscape. Enable auto-rotate and turn sideways; if the entire page stays portrait, open the game in a browser.');
      }
      return result;
    }finally{requestingLandscape=false;primary.disabled=false;}
  };
  gate.querySelector('.primary').addEventListener('click',requestLandscape);
  gate.querySelector('.secondary').addEventListener('click',closeGate);
  gate.addEventListener('keydown',e=>{if(e.key==='Escape')closeGate();if(e.key==='Tab'){const buttons=[...gate.querySelectorAll('button')];e.preventDefault();(document.activeElement===buttons[0]?buttons[1]:buttons[0]).focus();}});
  const resumeLaunch=()=>{
    if(!pendingLaunch||!isLandscapeDisplay(window,screen,landscape.matches))return;
    const go=pendingLaunch;pendingLaunch=null;gate.hidden=true;go();
  };
  if(landscape.addEventListener)landscape.addEventListener('change',resumeLaunch);
  else landscape.addListener?.(resumeLaunch);
  addEventListener('resize',resumeLaunch);
  window.visualViewport?.addEventListener('resize',resumeLaunch);
  for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,resumeLaunch);
  const prepareLaunch=go=>{
    if(isLandscapeDisplay(window,screen,landscape.matches)){void requestLandscape();go();return;}
    pendingLaunch=go;returnFocus=document.activeElement;
    const zh=document.documentElement.lang.startsWith('zh');
    gate.querySelector('h2').textContent=zh?'横过来，准备出发':'Turn sideways to race';
    gate.querySelector('p').textContent=zh?'横屏后自动进入赛道。左手转向，右手漂移和加速。若屏幕没有旋转，请关闭手机的旋转锁定。':'Turn your phone sideways to begin. Steer on the left; drift and boost on the right. Disable rotation lock if needed.';
    gate.querySelector('.primary').textContent=zh?'全屏并尝试横屏':'Fullscreen / landscape';
    gate.querySelector('.secondary').textContent=zh?'返回选车与赛道':'Back to race setup';
    gate.hidden=false;gate.querySelector('.primary').focus();
  };
  const editable=e=>e.target?.closest?.('input,textarea,[contenteditable="true"]');
  for(const type of ['contextmenu','selectstart','dragstart'])document.addEventListener(type,e=>{if(!editable(e))e.preventDefault();});
  const held=new Map();let enabled=false,center=null,reading=null,lastSample=0,filtered=0,request=0;
  const status=document.querySelector('#tiltStatus'),toggle=document.querySelector('#tiltToggle');
  const centerButton=document.querySelector('#mobileCenter');centerButton.hidden=true;
  const angle=()=>screen.orientation?.angle??window.orientation??0;
  const clear=()=>{held.clear();filtered=0;document.querySelectorAll('[data-drive]').forEach(b=>b.classList.remove('held'));};
  const buttons=[...document.querySelectorAll('[data-drive]')];
  const paintHeld=()=>buttons.forEach(b=>b.classList.toggle('held',[...held.values()].includes(b.dataset.drive)));
  buttons.forEach(button=>{
    const steering=['left','right'].includes(button.dataset.drive);
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(!active()||button.getAttribute('aria-disabled')==='true')return;
      button.setPointerCapture(e.pointerId);held.set(e.pointerId,button.dataset.drive);paintHeld();
      if(['nitro','emp','mini'].includes(button.dataset.drive))action(button.dataset.drive);
    });
    button.addEventListener('pointermove',e=>{
      if(!steering||!button.hasPointerCapture(e.pointerId))return;
      const r=button.parentElement.getBoundingClientRect();
      if(e.clientY<r.top-24||e.clientY>r.bottom+24||e.clientX<r.left-24||e.clientX>r.right+24)held.delete(e.pointerId);
      else held.set(e.pointerId,e.clientX<(r.left+r.right)/2?'left':'right');
      paintHeld();
    });
    const release=e=>{held.delete(e.pointerId);paintHeld();};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
    button.addEventListener('contextmenu',e=>e.preventDefault());
  });
  const throttle=document.querySelector('#autoThrottle');
  const syncThrottle=()=>{document.querySelector('#touchControls').classList.toggle('auto-throttle-on',throttle.checked);document.querySelector('#touchControls').classList.toggle('manual-throttle',!throttle.checked);};
  throttle.addEventListener('change',syncThrottle);syncThrottle();
  const nitroButton=document.querySelector('[data-drive="nitro"]'),empButton=document.querySelector('[data-drive="emp"]');
  const driftButton=document.querySelector('[data-drive="drift"]');
  const nitroState=document.querySelector('#touchNitroState'),nitroCount=document.querySelector('#touchNitroCount'),driftState=document.querySelector('#touchDriftState'),empState=document.querySelector('#touchEmpState');
  const pips=[...document.querySelectorAll('.nitro-stock i')];
  const off=message=>{centerButton.hidden=true;enabled=false;request++;toggle.textContent='Enable tilt steering';toggle.setAttribute('aria-pressed','false');status.textContent=message;filtered=0;};
  addEventListener('deviceorientation',e=>{
    if(!enabled)return;const v=screenTilt(e.beta,e.gamma,angle());if(v===null)return;
    reading=v;lastSample=performance.now();if(center===null){center=v;status.textContent='Tilt ready · Hold comfortably, then lean left / right.';}
  });
  toggle.addEventListener('click',async()=>{
    if(enabled){off('Touch steering active.');return;}
    const id=++request;toggle.disabled=true;
    try{
      if(!window.isSecureContext||!window.DeviceOrientationEvent)throw Error('unavailable');
      if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('permission');
      if(id!==request)return;
      enabled=true;centerButton.hidden=false;center=null;reading=null;lastSample=0;toggle.textContent='Disable tilt steering';toggle.setAttribute('aria-pressed','true');status.textContent='Hold the phone comfortably. Waiting for sensor…';
      setTimeout(()=>{if(enabled&&id===request&&center===null)off('No motion data. Use touch controls or allow Motion & Orientation in browser settings.');},4000);
    }catch{off('Motion unavailable or permission denied. Touch steering is ready.');}
    finally{toggle.disabled=false;}
  });
  document.querySelector('#tiltCenter').addEventListener('click',()=>{if(enabled){center=null;filtered=0;status.textContent='Hold still to center steering…';}else status.textContent='Enable tilt steering first, or use the arrow buttons.';});
  document.querySelector('#mobileCenter').addEventListener('click',()=>{center=null;filtered=0;});
  // Pause an existing race before resuming a pending launch. Separate listeners
  // previously let Android start a race and pause it in the same change event.
  const rotationState=()=>Number.isFinite(window.orientation)?window.orientation:screen.orientation?.angle??screen.orientation?.type;
  let lastRotation=rotationState();
  const orientationChanged=()=>{
    const rotation=rotationState();
    const changed=rotation!==lastRotation;lastRotation=rotation;
    clear();center=null;if(changed&&active())pause();
    resumeLaunch();
  };
  screen.orientation?.addEventListener?.('change',orientationChanged);
  addEventListener('orientationchange',orientationChanged);
  addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  document.querySelector('#landscapeMode').addEventListener('click',async()=>{
    const result=await requestLandscape();
    if(!result)return;
    const zh=document.documentElement.lang.startsWith('zh');
    document.querySelector('#screenHint').textContent=result.orientation.ok
      ?(zh?'横屏请求已发送，请横放手机。':'Landscape requested. Turn your phone sideways.')
      :(zh?'此浏览器或 App 未允许自动横屏。请打开自动旋转；仍无效时从浏览器打开游戏。':'This browser or app did not allow automatic landscape. Enable auto-rotate, or open the game in a browser.');
  });
  return {clear,prepareLaunch,update({boost,nitro,weapon,drift,empCooldown=0}){
    resumeLaunch();
    const count=Math.floor(boost*3+.01),ready=boost>=.333&&nitro<=0;
    nitroButton.classList.toggle('unavailable',!ready&&nitro<=0);nitroButton.classList.toggle('firing',nitro>0);
    nitroButton.setAttribute('aria-disabled',String(!ready));nitroButton.setAttribute('aria-label',`Nitro, ${count} charges${nitro>0?', boosting':''}`);
    nitroCount.textContent=count;nitroState.textContent=nitro>0?`${nitro.toFixed(1)}s BOOST`:count?'TAP TO BOOST':'DRIFT TO FILL';
    pips.forEach((p,i)=>p.classList.toggle('full',i<count));
    driftButton.style.setProperty('--drift-charge',Math.round(drift.charge*100));
    driftState.textContent=drift.active?(drift.charge>=.32?'RELEASE → MINI':'CHARGING'):'HOLD TO SLIDE';
    const unavailable=weapon<.34||empCooldown>0;empButton.classList.toggle('unavailable',unavailable);empButton.setAttribute('aria-disabled',String(unavailable));empState.textContent=empCooldown>0?`${Math.ceil(empCooldown)}s`:weapon>=.34?'READY':`${Math.ceil((.34-weapon)/.018)}s`;
  },down:name=>[...held.values()].includes(name),steer(dt){
    const touch=Number(this.down('right'))-Number(this.down('left'));
    if(this.down('right')||this.down('left'))return touch;
    const target=enabled&&center!==null&&reading!==null&&performance.now()-lastSample<1000?tiltSteering(reading,center):0;
    filtered+=(target-filtered)*(1-Math.exp(-10*dt));return Math.abs(filtered)<.01?0:filtered;
  }};
}
