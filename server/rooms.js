import {randomBytes,randomUUID} from 'node:crypto';
import {ROOM_LIMIT,SCENES,PHYSICS_DT,spawnPlayer,multiplayerTrack,stepRoomPlayer,idleInput,sanitizeInput,recoverRoomPlayer} from '../multiplayer/simulation.js';
const cleanName=name=>{if(typeof name!=='string')throw Error('请输入车手昵称。');name=name.trim();if(!name||name.length>16||/[<>\u0000-\u001f\u007f]/.test(name))throw Error('昵称需为 1–16 个字符，不含特殊标记。');return name;};
const cleanCraft=craft=>{if(!Number.isInteger(craft)||craft<0||craft>5)throw Error('Invalid kart.');return craft;};
export class RoomService{
 constructor({now=()=>performance.now()/1000,maxRooms=100,makeRoomCode=()=>randomBytes(4).toString('hex').slice(0,6).toUpperCase()}={}){this.now=now;this.maxRooms=maxRooms;this.makeRoomCode=makeRoomCode;this.rooms=new Map();this.connections=new Map();}
 attach(connection){this.connections.set(connection,{room:null,player:null});}
 view(room){return {code:room.code,scene:room.scene,host:room.host,phase:room.phase,round:room.round,countdown:Math.max(0,room.startsAt-this.now()),elapsed:room.elapsed,firstFinish:room.firstFinish,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,craft:p.craft,ready:p.ready,connected:!!p.connection,dnf:p.dnf,ack:p.ack,...(p.state?{state:p.state,stunts:p.stunts,racer:p.racer}:{})}))};}
 broadcast(room){const message={type:'snapshot',room:this.view(room)};for(const p of room.players.values())p.connection?.send(message);}
 membership(connection){const member=this.connections.get(connection),room=this.rooms.get(member?.room),player=room?.players.get(member?.player);if(!room||!player||player.connection!==connection)throw Error('你尚未加入房间。');return {room,player};}
 detach(connection,explicit=false){
 const member=this.connections.get(connection),room=this.rooms.get(member?.room),p=room?.players.get(member?.player);this.connections.delete(connection);
 if(!p||p.connection!==connection)return;p.connection=null;p.input=idleInput();p.queue=[];p.disconnectedAt=this.now();
 if(explicit&&(room.phase==='lobby'||room.phase==='finished'))room.players.delete(p.id);
 else if(explicit){p.dnf=true;p.token='';}
 this.electHost(room);if(!room.players.size)this.rooms.delete(room.code);else this.broadcast(room);
 }
 electHost(room){if(!room.players.get(room.host)?.connection)room.host=[...room.players.values()].find(p=>p.connection)?.id??null;}
 join(connection,room,name,craft){
 if(this.connections.get(connection)?.room)throw Error('请先退出当前房间。');if(room.phase!=='lobby')throw Error('比赛已开始，请等下一局。');if(room.players.size>=ROOM_LIMIT)throw Error('房间已满，最多 4 人。');
 const player={id:randomUUID(),token:randomBytes(24).toString('hex'),name:cleanName(name),craft:cleanCraft(craft),ready:false,connection,disconnectedAt:null,dnf:false,queue:[],input:idleInput(),ack:0,lastSeq:0,lastInputAt:this.now(),lastRecover:-Infinity};
 room.players.set(player.id,player);if(!room.host)room.host=player.id;this.connections.set(connection,{room:room.code,player:player.id});return {playerId:player.id,resumeToken:player.token,room:this.view(room)};
 }
 handle(connection,message){
 if(!message||typeof message!=='object')throw Error('Invalid message.');
 const {type}=message;
 if(type==='create'){
  if(this.connections.get(connection)?.room)throw Error('请先退出当前房间。');if(this.rooms.size>=this.maxRooms)throw Error('服务繁忙，请稍后再试。');if(!SCENES.includes(message.scene))throw Error('Unknown circuit.');cleanName(message.name);cleanCraft(message.craft);
  let code;do{code=this.makeRoomCode();}while(this.rooms.has(code));
  const room={code,scene:message.scene,host:null,phase:'lobby',round:0,startsAt:0,elapsed:0,firstFinish:null,players:new Map(),createdAt:this.now()};this.rooms.set(code,room);const result=this.join(connection,room,message.name,message.craft);this.broadcast(room);return result;
 }
 if(type==='join'){const room=this.rooms.get(String(message.code).toUpperCase());if(!room)throw Error('房间不存在或已结束。');const result=this.join(connection,room,message.name,message.craft);this.broadcast(room);return result;}
 if(type==='resume'){
  if(this.connections.get(connection)?.room)throw Error('Already joined.');const room=this.rooms.get(message.code),player=room&&[...room.players.values()].find(p=>p.token===message.resumeToken);
  if(!player||player.dnf||player.connection||this.now()-player.disconnectedAt>20)throw Error('重连已过期，请重新加入房间。');
  player.connection=connection;player.disconnectedAt=null;player.input=idleInput();player.queue=[];player.lastInputAt=this.now();this.connections.set(connection,{room:room.code,player:player.id});this.electHost(room);this.broadcast(room);return {playerId:player.id,resumeToken:player.token,room:this.view(room)};
 }
 if(type==='leave'){this.membership(connection);this.detach(connection,true);this.attach(connection);return {};}
 const {room,player}=this.membership(connection);
 if(type==='ready'){if(room.phase!=='lobby')throw Error('比赛中无法修改准备状态。');player.ready=message.ready===true;}
 else if(type==='configure'){
  if(room.phase!=='lobby')throw Error('比赛中无法修改设置。');if(message.craft!==undefined){player.craft=cleanCraft(message.craft);player.ready=false;}
  if(message.scene!==undefined){if(room.host!==player.id)throw Error('只有房主可以选赛道。');if(!SCENES.includes(message.scene))throw Error('Unknown circuit.');room.scene=message.scene;for(const p of room.players.values())p.ready=false;}
 }
 else if(type==='start'){
  if(room.host!==player.id)throw Error('只有房主可以开赛。');if(room.phase!=='lobby')throw Error('比赛已开始。');if(room.players.size<2||[...room.players.values()].some(p=>!p.ready||!p.connection))throw Error('至少 2 位车手，且所有人准备后才能开赛。');
  room.phase='countdown';room.round++;room.startsAt=this.now()+3;room.elapsed=0;room.firstFinish=null;
  [...room.players.values()].forEach((p,i)=>{Object.assign(p,spawnPlayer(room.scene,i));p.dnf=false;p.ack=0;p.lastSeq=0;p.queue=[];p.input=idleInput();p.lastInputAt=this.now();});
 }
 else if(type==='rematch'){
  if(room.host!==player.id||room.phase!=='finished')throw Error('只有房主可以在结算后开启下一局。');room.phase='lobby';room.elapsed=0;room.firstFinish=null;
  for(const p of [...room.players.values()]){if(!p.connection)room.players.delete(p.id);else{p.ready=false;p.state=null;p.stunts=null;p.racer=null;p.dnf=false;}}
 }
 else if(type==='recover'){
  if(room.phase!=='racing'||player.racer.finishTime!==null||this.now()-player.lastRecover<3)throw Error('暂时无法返回赛道。');recoverRoomPlayer(player,multiplayerTrack(room.scene));player.queue=[];player.input=idleInput();player.ack=player.lastSeq;player.lastRecover=this.now();
 }
 else if(type==='input'){
  if(room.phase!=='racing'||player.dnf||player.racer.finishTime!==null)return {};
  if(!Number.isSafeInteger(message.seq)||message.seq<=player.lastSeq||message.seq>player.lastSeq+1000)throw Error('Invalid input sequence.');
  const input=sanitizeInput(message.input);player.lastSeq=message.seq;player.queue.push({seq:message.seq,input});if(player.queue.length>8)player.queue.shift();player.lastInputAt=this.now();return {};
 }
 else throw Error('Unknown command.');
 this.broadcast(room);return {room:this.view(room)};
 }
 tick(dt=PHYSICS_DT){
 for(const room of this.rooms.values()){
  const now=this.now();let membershipChanged=false;
  for(const p of [...room.players.values()])if(!p.connection&&now-p.disconnectedAt>20){if(room.phase==='countdown'||room.phase==='racing'){if(!p.dnf){p.dnf=true;membershipChanged=true;}}else{room.players.delete(p.id);membershipChanged=true;}}
  if(![...room.players.values()].some(p=>p.connection)){if([...room.players.values()].every(p=>now-p.disconnectedAt>20))this.rooms.delete(room.code);continue;}
  if(membershipChanged){this.electHost(room);this.broadcast(room);}
  if(room.phase==='countdown'){if(now<room.startsAt)continue;room.phase='racing';}
  if(room.phase!=='racing')continue;room.elapsed+=dt;
  const track=multiplayerTrack(room.scene);
  for(const p of room.players.values()){
   if(p.dnf)continue;const next=p.queue.shift();if(next){p.input=next.input;p.ack=next.seq;}
   const input=now-p.lastInputAt>.5?idleInput():p.input;stepRoomPlayer(p,input,room,track,dt);p.input={...p.input,commands:{}};
  }
  const players=[...room.players.values()];if(players.every(p=>p.dnf||p.racer.finishTime!==null)||(room.firstFinish!==null&&room.elapsed-room.firstFinish>=20)||room.elapsed>=600){room.phase='finished';for(const p of players)if(p.racer.finishTime===null)p.dnf=true;this.broadcast(room);}
 }
 }
}
