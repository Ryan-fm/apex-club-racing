import {getLanguage,onLanguageChange,tr} from './localization.js';

export const TOUCH_LAYOUT_KEY='apex-touch-layout-v1';
export const DEFAULT_TOUCH_LAYOUT=Object.freeze({layout:'standard',scale:100,inset:24});
export function sanitizeTouchLayout(value){
 return {layout:value?.layout==='mirrored'?'mirrored':'standard',scale:[85,100,115].includes(value?.scale)?value.scale:100,inset:[12,24,36].includes(value?.inset)?value.inset:24};
}
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}
export function loadTouchLayout(storage=browserStorage()){
 try{return sanitizeTouchLayout(JSON.parse(storage?.getItem(TOUCH_LAYOUT_KEY)||'null'));}catch{return {...DEFAULT_TOUCH_LAYOUT};}
}
export function saveTouchLayout(value,storage=browserStorage()){
 try{if(!storage?.setItem)return false;storage.setItem(TOUCH_LAYOUT_KEY,JSON.stringify(sanitizeTouchLayout(value)));return true;}catch{return false;}
}
export function applyTouchLayout(controls,value){
 const layout=sanitizeTouchLayout(value);
 controls.dataset.touchLayout=layout.layout;
 controls.style.setProperty('--touch-size',String(layout.scale/100));
 controls.style.setProperty('--touch-inset',`${layout.inset}px`);
 return layout;
}

// Layout changes affect only button geometry. Steering and boost keep the same intents.
export function mountTouchLayout({handheld=document.documentElement.classList.contains('handheld-input'),onChange=()=>{}}={}){
 if(!handheld)return null;
 const controls=document.querySelector('#touchControls'),host=document.querySelector('.mobile-settings');
 if(!controls||!host)return null;
 let value=applyTouchLayout(controls,loadTouchLayout()),message='';
 const section=document.createElement('section');section.id='touchLayoutSettings';section.dataset.noTranslate='';
 section.setAttribute('aria-labelledby','touchLayoutTitle');
 section.innerHTML='<div class="touch-layout-heading"><h3 id="touchLayoutTitle"></h3><button type="button" data-touch-defaults></button></div><p class="touch-layout-note"></p><div class="touch-layout-fields"></div><p class="touch-layout-status" role="status" aria-live="polite"></p>';
 const fields=section.querySelector('.touch-layout-fields'),selects={};
 const choices={
  layout:[['standard',['左手转向','Steering on left']],['mirrored',['右手转向','Steering on right']]],
  scale:[[85,['小 · 85%','Small · 85%']],[100,['标准 · 100%','Standard · 100%']],[115,['大 · 115%','Large · 115%']]],
  inset:[[12,['靠近边缘','Near the edge']],[24,['标准间距','Standard inset']],[36,['向内移动','Further inward']]]
 };
 const local=pair=>pair[getLanguage()==='zh'?0:1];
 function render(){
  section.querySelector('h3').textContent=local(['触控布局','Touch layout']);
  section.querySelector('[data-touch-defaults]').textContent=tr('Restore defaults');
  section.querySelector('.touch-layout-note').textContent=local(['调整左右手、按键大小与横屏边距。仅改变按钮布局，操控规则保持一致。','Choose your steering hand, button size and landscape inset. Driving controls stay the same.']);
  const labels={layout:['转向位置','Steering hand'],scale:['按键大小','Button size'],inset:['屏幕边距','Edge spacing']};
  for(const [key,select]of Object.entries(selects)){
   select.previousElementSibling.textContent=local(labels[key]);
   [...select.options].forEach((option,i)=>option.textContent=local(choices[key][i][1]));
   select.value=String(value[key]);
  }
  section.querySelector('.touch-layout-status').textContent=message==='saved'?local(['布局已保存在本机。','Layout saved on this device.']):message==='session'?local(['已应用布局；浏览器无法保存，下次打开将恢复默认。','Layout applied for this session. Browser storage is unavailable.']):local(['设置会自动保存；竖屏时自动收紧边距。','Settings save automatically; portrait spacing stays compact.']);
 }
 function change(next){
  onChange();value=applyTouchLayout(controls,next);message=saveTouchLayout(value)?'saved':'session';render();
 }
 for(const [key,options]of Object.entries(choices)){
  const label=document.createElement('label'),name=document.createElement('span'),select=document.createElement('select');
  select.id=`touch-layout-${key}`;label.append(name,select);fields.append(label);selects[key]=select;
  for(const [optionValue]of options){const option=document.createElement('option');option.value=String(optionValue);select.append(option);}
  select.addEventListener('change',()=>change({...value,[key]:key==='layout'?select.value:Number(select.value)}));
 }
 section.querySelector('[data-touch-defaults]').addEventListener('click',()=>change(DEFAULT_TOUCH_LAYOUT));
 host.append(section);onLanguageChange(render);render();
 const sync=event=>{
  if(event.key!==TOUCH_LAYOUT_KEY&&event.key!==null)return;
  onChange();value=applyTouchLayout(controls,loadTouchLayout());message='';render();
 };
 globalThis.addEventListener?.('storage',sync);
 return {get value(){return {...value};},reset:()=>change(DEFAULT_TOUCH_LAYOUT)};
}
