import {RoomClient} from './client.js';
import {circuitPoints} from '../track-layout.js';
import {roomKartImage} from './showroom.js';
import {craftDefs} from '../kart-catalog.js';
import {getLanguage,onLanguageChange} from '../localization.js';
const local=(zh,en)=>getLanguage()==='zh'?zh:en;
export function mountRoomUI({endpoint,getSetup,onRoom,onExit,onStatus}){
 const dialog=document.createElement('dialog');dialog.id='roomDialog';dialog.setAttribute('aria-labelledby','roomTitle');
 dialog.innerHTML=`<div class="room-top"><h2 id="roomTitle"></h2><button id="roomClose" type="button">×</button></div><p id="roomStatus" role="status" aria-live="polite"></p><div id="roomEntry"><label id="roomNameLabel">昵称 / Name<input id="roomName" maxlength="16" autocomplete="nickname" placeholder="车手 / Driver"></label><button id="roomCreate" type="button"></button><div class="room-join"><input id="roomCodeInput" maxlength="6" aria-label="房间码 / Room code" placeholder="房间码 / Room code"><button id="roomJoin" type="button"></button></div></div><div id="roomMembers" hidden><div class="room-heading"><div class="room-brand"><span>APEX CLUB / MULTIPLAYER</span><h3 id="roomHeadline"></h3><p id="roomSubtitle"></p></div><div class="room-ticket"><small>PRIVATE PADDOCK</small><strong id="roomCode"></strong><span id="roomSignal"></span></div></div><div class="room-layout"><section class="room-grid"><div class="room-section-title">STARTING GRID <span id="roomCount"></span></div><ol id="roomPlayers"></ol></section><aside class="room-track"><div class="room-section-title">RACE SETUP</div><div class="room-track-art"><span id="roomTrackName"></span><small>GRAND PRIX · 03 LAPS</small><svg viewBox="0 0 260 120" aria-hidden="true"><path d="M45 85 C5 45 32 10 90 24 L185 18 Q250 20 225 65 L180 98 Q140 115 115 75 Q80 42 45 85Z"/></svg></div><div class="room-settings"><label>赛道 / Circuit<select id="roomScene"><option value="bay">晴湾 / Bay</option><option value="citadel">玉城 / Citadel</option><option value="harbor">港湾 / Harbor</option></select></label><label>赛车 / Kart<select id="roomCraft"></select></label></div><p id="roomRules"></p></aside></div><div class="room-actions"><p id="roomHint"></p><button id="roomInvite" type="button"></button><button id="roomReady" type="button"></button><button id="roomStart" type="button"></button><button id="roomLeave" type="button"></button></div></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id),open=document.querySelector('#openRoom');let busy=false;
 const status=text=>{$('roomStatus').textContent=text;};
 const client=new RoomClient(endpoint,{onRoom:room=>{render(room);onRoom(room,client);},onStatus:value=>{const map={connected:local('已连接多人服务。','Connected.'),disconnected:local('连接中断，正在重连；比赛继续。','Reconnecting. The race continues.'),reconnected:local('已重新连接。','Reconnected.'),closed:''};status(map[value]??value);onStatus(value);}});
 $('roomCraft').innerHTML=craftDefs.map((d,i)=>`<option value="${i}">${d.name}</option>`).join('');
 let savedSession;try{$('roomName').value=localStorage.getItem('apex-room-name')||'';savedSession=JSON.parse(sessionStorage.getItem('apex-room-session')||'null');}catch{}
 const query=new URLSearchParams(location.search);$('roomCodeInput').value=(query.get('room')||'').slice(0,6);
 function render(room=client.room){
  try{if(room?.code&&client.joined&&client.resumeToken)sessionStorage.setItem('apex-room-session',JSON.stringify({endpoint,code:room.code,resumeToken:client.resumeToken}));else if(!room&&client.closed)sessionStorage.removeItem('apex-room-session');}catch{}
  $('roomTitle').textContent=local('好友同玩 · 最多 4 人','Race with friends · Up to 4');
  $('roomCreate').textContent=local('创建房间','Create room');$('roomJoin').textContent=local('加入房间','Join');$('roomInvite').textContent=local('复制邀请链接','Copy invite');$('roomLeave').textContent=local('退出房间','Leave room');
  $('roomRules').textContent=local('标准三圈 · 漂移、小喷、氮气 · 无碰撞和 EMP。打开帮助不会暂停其他玩家。','Three standard laps · Drift, mini, nitro · No collisions or EMP. Help does not pause the race.');
  open.textContent=room?local(`房间 ${room.code} · ${room.players.length}/4`,`Room ${room.code} · ${room.players.length}/4`):local('好友同玩 · 最多 4 人 ↗','Race with friends · Up to 4 ↗');
  dialog.classList.toggle('is-room',!!room);$('roomClose').textContent=room?local('返回车库 ↗','Garage ↗'):'×';$('roomEntry').hidden=!!room;$('roomMembers').hidden=!room;if(!room)return;
  $('roomHeadline').textContent=local('集结，准备出发。','ASSEMBLE. THEN ACCELERATE.');$('roomSubtitle').textContent=local('你的赛车，你的伙伴。下一场精彩，从这里开始。','Your kart. Your crew. Your next great race starts here.');dialog.dataset.scene=room.scene;dialog.classList.toggle('all-ready',room.players.length>=2&&room.players.every(p=>p.ready&&p.connected));$('roomSignal').textContent=local('● 实时联机 · 最多 4 人','● LIVE SESSION · MAX 4');
  const me=room.players.find(p=>p.id===client.playerId),host=room.host===client.playerId;
  $('roomCode').textContent=local(`房间 ${room.code}`,`ROOM ${room.code}`);$('roomCount').textContent=`${room.players.length} / 4`;$('roomTrackName').textContent=({bay:local('晴湾赛道','SUNLIT BAY'),citadel:local('玉城赛道','JADE CITADEL'),harbor:local('霓虹港湾','NEON HARBOR')})[room.scene];$('roomTrackName').parentElement.dataset.scene=room.scene;const points=circuitPoints(room.scene);const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);const xmin=Math.min(...xs),zmin=Math.min(...zs),scale=Math.min(220/(Math.max(...xs)-xmin),90/(Math.max(...zs)-zmin));$('roomTrackName').parentElement.querySelector('path').setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${20+(p[0]-xmin)*scale},${15+(p[2]-zmin)*scale}`).join(' ')+'Z');
  $('roomScene').value=room.scene;$('roomScene').disabled=!host||room.phase!=='lobby';if(me)$('roomCraft').value=me.craft;$('roomCraft').disabled=room.phase!=='lobby';
  const signature=JSON.stringify([room.players.map(p=>[p.id,p.name,p.craft,p.ready,p.connected]),room.host,client.playerId,getLanguage()]);
  if($('roomPlayers').dataset.signature!==signature){
   $('roomPlayers').dataset.signature=signature;$('roomPlayers').replaceChildren();
   for(let i=0;i<4;i++){
    const p=room.players[i],li=document.createElement('li');li.className='room-seat'+(p?.id===client.playerId?' is-me':'')+(p?.ready?' is-ready':'')+(!p?' is-empty':'');
    if(p){li.innerHTML='<div class="seat-top"><span class="seat-number"></span><span class="seat-role"></span></div><div class="seat-stage"><div class="seat-beam" aria-hidden="true"></div><div class="seat-platform" aria-hidden="true"></div><img class="seat-kart" alt=""></div><div class="seat-info"><strong></strong><span class="seat-car"></span><span class="seat-state"></span></div>';
     li.style.setProperty('--kart-accent','#'+craftDefs[p.craft].color.toString(16).padStart(6,'0'));li.querySelector('.seat-number').textContent=`0${i+1}`;li.querySelector('.seat-role').textContent=[p.id===room.host?local('房主','HOST'):'',p.id===client.playerId?local('你','YOU'):''].filter(Boolean).join(' · ');
     li.querySelector('strong').textContent=p.name;li.querySelector('.seat-car').textContent=craftDefs[p.craft].name;li.querySelector('img').src=roomKartImage(p.craft);li.querySelector('img').alt=craftDefs[p.craft].name;
     li.querySelector('.seat-state').textContent=!p.connected?local('○ 重连中','○ RECONNECTING'):p.ready?local('✓ 已准备','✓ READY'):local('● 等待准备','● NOT READY');
    }else{li.innerHTML='<span class="seat-number"></span><button class="seat-invite" type="button"><span>＋</span><strong></strong><small></small></button>';li.querySelector('.seat-number').textContent=`0${i+1}`;li.querySelector('strong').textContent=local('邀请好友','INVITE FRIEND');li.querySelector('small').textContent=local('复制链接，共同出发','Share a link to join');li.querySelector('button').onclick=()=>$('roomInvite').click();}
    $('roomPlayers').append(li);
   }
  }
  $('roomHint').textContent=room.players.length<2?local('邀请至少一位好友，即可一起开赛。','Invite a friend to race.'):room.players.some(p=>!p.connected)?local('等待车手重新连接…','Waiting for reconnection…'):room.players.some(p=>!p.ready)?local('所有车手准备后，由房主发车。','The host starts when everyone is ready.'):local('车手已就位，随时出发。','Everyone is ready. Start your engines.');
  $('roomReady').textContent=me?.ready?local('取消准备','Unready'):local('准备','Ready');$('roomReady').disabled=room.phase!=='lobby';
  $('roomStart').textContent=room.phase==='finished'?local('返回房间，下一局','Next round'):local('房主开始比赛','Start race');$('roomStart').disabled=!host||(room.phase!=='finished'&&(room.phase!=='lobby'||room.players.length<2||room.players.some(p=>!p.ready||!p.connected)));
 }
 async function run(action){if(busy)return;busy=true;try{await action();}catch(error){status(error.message);}finally{busy=false;render();}}
 open.addEventListener('click',()=>{render();if(!endpoint)status(local('多人服务尚未配置，暂时无法在线开房。','Multiplayer service is not configured yet.'));dialog.showModal();});
 $('roomClose').addEventListener('click',()=>dialog.close());
 const enter=type=>run(async()=>{if(!endpoint)throw Error(local('多人服务尚未配置。','Multiplayer service is not configured.'));const setup=getSetup();if(!setup)throw Error(local('请先结束当前比赛。','Finish the current race first.'));const name=$('roomName').value.trim();await client.enter(type,{...setup,name,code:$('roomCodeInput').value.trim().toUpperCase()});try{localStorage.setItem('apex-room-name',name);}catch{}});
 $('roomCreate').addEventListener('click',()=>enter('create'));$('roomJoin').addEventListener('click',()=>enter('join'));
 $('roomReady').addEventListener('click',()=>run(()=>client.request('ready',{ready:!client.room.players.find(p=>p.id===client.playerId)?.ready})));
 $('roomStart').addEventListener('click',()=>run(()=>client.request(client.room.phase==='finished'?'rematch':'start')));
 $('roomScene').addEventListener('change',event=>run(()=>client.request('configure',{scene:event.target.value})));
 $('roomCraft').addEventListener('change',event=>run(()=>client.request('configure',{craft:Number(event.target.value)})));
 $('roomInvite').addEventListener('click',()=>run(async()=>{const url=new URL('./race.html',location.href);url.searchParams.set('room',client.room.code);url.searchParams.set('scene',client.room.scene);try{await navigator.clipboard.writeText(url.href);status(local('邀请链接已复制。','Invitation copied.'));}catch{status(url.href);}}));
 $('roomLeave').addEventListener('click',()=>run(async()=>{await client.leave();dialog.close();onExit();}));
 onLanguageChange(()=>render());render();if(query.has('room')){dialog.showModal();if(!endpoint)status(local('多人服务尚未配置。','Multiplayer service is not configured.'));}
 if(savedSession?.endpoint===endpoint&&(!query.get('room')||query.get('room').toUpperCase()===savedSession.code))client.restoreSession(savedSession).catch(error=>{try{sessionStorage.removeItem('apex-room-session');}catch{}status(error.message);render();});
 return {client,dialog,status,render,open:()=>{render();if(!dialog.open)dialog.showModal();}};
}
