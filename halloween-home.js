import {halloweenCircuitPoints,HALLOWEEN_TENSION} from './halloween-layout.js';
import {getLanguage} from './localization.js';

const stops=[
 {waypoint:0,kicker:'THE LIGHTS ARE YOUR LINE',title:['循着灯光，驶入万圣夜。','Follow the lanterns into the night.'],description:['从宽阔直道起步，让琥珀色护栏引出第一个弯。先稳住方向，再把加速留给出弯。','Launch on the open straight. Let the amber barriers lead you into the first bend. Hold your line, then boost on the exit.'],tip:['琥珀色标记指引主路，青色标记指向快速路。','Amber guides the circuit. Cyan marks the express roads.']},
 {waypoint:3,kicker:'THE MANOR BEYOND THE BEND',title:['古堡出现，下一个弯也近了。','The manor marks your next move.'],description:['高塔和发光窗户立在长弯外侧。提前选好入弯线，让漂移与出弯的小喷连成一次顺畅的超越。','Turrets and lit windows stand beyond the long sweep. Choose your entry early and link a drift with an exit boost.'],tip:['看向出弯方向，保持赛车与路沿之间的余量。','Look toward the exit and leave room beside the barrier.']},
 {waypoint:7,kicker:'A SHORTER ROAD. A FINER LINE.',title:['穿过墓园，抄一条漂亮的近道。','Take the graveyard line.'],description:['绿色路标指向更窄的墓园近道。用精准的入弯换取距离优势，驶过墓碑与铁栅，再平顺汇回主路。','Green signs lead to the narrower graveyard cut. Trade precision for a shorter route past headstones and ironwork, then merge smoothly onto the circuit.'],tip:['近道更窄，进入前减速，出口留足汇入空间。','Brake before the narrow entry. Leave room to rejoin at the exit.']}
];

export function mountHalloweenHome(){
 const svg=document.querySelector('#nightCircuitMap'),buttons=[...document.querySelectorAll('[data-night-stop]')];
 if(!svg||buttons.length!==stops.length)return {render(){}};
 const raw=halloweenCircuitPoints().map(([x,,z])=>[x,z]);
 const xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const scale=Math.min(500/(Math.max(...xs)-Math.min(...xs)),310/(Math.max(...ys)-Math.min(...ys)));
 const points=raw.map(([x,y])=>[320+(x-cx)*scale,210+(y-cy)*scale]),n=points.length,t=HALLOWEEN_TENSION/3;
 const pair=p=>p.map(v=>v.toFixed(2)).join(' ');
 let d=`M ${pair(points[0])}`;
 // The same uniform Catmull-Rom control points and tension as the race, in XZ.
 for(let i=0;i<n;i++){
  const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],e=points[(i+2)%n];
  d+=` C ${pair([b[0]+(c[0]-a[0])*t,b[1]+(c[1]-a[1])*t])} ${pair([c[0]-(e[0]-b[0])*t,c[1]-(e[1]-b[1])*t])} ${pair(c)}`;
 }
 for(const selector of ['#nightCircuitPath','#nightCircuitGlow'])document.querySelector(selector).setAttribute('d',d+' Z');
 const ns='http://www.w3.org/2000/svg',markers=[];
 const host=document.querySelector('#nightCircuitMarkers');
 stops.forEach((stop,i)=>{
  const [x,y]=points[stop.waypoint],group=document.createElementNS(ns,'g');group.classList.add('circuit-marker');group.setAttribute('transform',`translate(${x} ${y})`);
  for(const [radius,cls]of [[18,'marker-halo'],[6,'marker-core']]){const circle=document.createElementNS(ns,'circle');circle.setAttribute('r',radius);circle.setAttribute('class',cls);group.append(circle);}
  const label=document.createElementNS(ns,'text');label.setAttribute('x',14);label.setAttribute('y',-13);label.textContent=`0${i+1}`;group.append(label);host.append(group);markers.push(group);
 });
 let selected=0;
 function render(){
  const index=getLanguage()==='zh'?0:1,stop=stops[selected];
  buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===selected));button.tabIndex=i===selected?0:-1;markers[i].classList.toggle('is-active',i===selected);});
  document.querySelector('#nightRoutePanel').setAttribute('aria-labelledby',buttons[selected].id);
  document.querySelector('#nightStopKicker').textContent=stop.kicker;
  document.querySelector('#nightStopTitle').textContent=stop.title[index];
  document.querySelector('#nightStopDescription').textContent=stop.description[index];
  document.querySelector('#nightStopTip').textContent=stop.tip[index];
  svg.setAttribute('aria-label',index===0?`幽光南瓜谷路线 · ${buttons[selected].textContent.trim()}`:`Lantern Hollow circuit · ${buttons[selected].textContent.trim()}`);
 }
 buttons.forEach((button,i)=>{
  button.addEventListener('click',()=>{selected=i;render();});
  button.addEventListener('keydown',event=>{
   let next;if(event.key==='ArrowRight')next=(i+1)%buttons.length;else if(event.key==='ArrowLeft')next=(i+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;
   event.preventDefault();selected=next;render();buttons[next].focus();
  });
 });
 render();return {render};
}
