import {randomBytes,randomUUID} from 'node:crypto';
import {RoomService} from './rooms.js';
import {PHYSICS_DT} from '../multiplayer/simulation.js';

const TTL=3600;
const RESERVE=`
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[2])
if redis.call('ZCARD',KEYS[2])>=100 then return -1 end
if not redis.call('SET',KEYS[1],ARGV[1],'NX','EX',ARGV[3]) then return 0 end
redis.call('ZADD',KEYS[2],tonumber(ARGV[2])+tonumber(ARGV[3]),ARGV[4])
return 1`;
const ENQUEUE=`
if not redis.call('EXISTS',KEYS[1]) then return -1 end
if redis.call('LLEN',KEYS[2])+tonumber(ARGV[1])>512 then return 0 end
for i=2,#ARGV do redis.call('RPUSH',KEYS[2],ARGV[i]) end
redis.call('EXPIRE',KEYS[2],3600)
return 1`;
// Fencing and consuming the queue happen with the state commit. A worker that
// loses its lease cannot overwrite a successor or consume uncommitted commands.
const COMMIT=`
if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
if ARGV[2]=='deleted' then
 redis.call('DEL',KEYS[2]);redis.call('ZREM',KEYS[4],ARGV[5])
else
 redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[4]);redis.call('ZADD',KEYS[4],ARGV[6],ARGV[5])
end
if tonumber(ARGV[3])>0 then redis.call('LTRIM',KEYS[3],ARGV[3],-1) end
for i=7,#ARGV,2 do redis.call('PUBLISH',ARGV[i],ARGV[i+1]) end
redis.call('DEL',KEYS[1]);return 1`;

export class DistributedRooms{
 constructor(redis,{prefix='apex:rooms:v1',now=()=>Date.now()/1000}={}){this.redis=redis;this.prefix=prefix;this.now=now;}
 key(code,suffix='state'){return `${this.prefix}:${code}:${suffix}`;}
 get index(){return `${this.prefix}:active`;}
 snapshotChannel(code){return this.key(code,'snapshot');}
 replyChannel(instance){return `${this.prefix}:reply:${instance}`;}
 async reserve(){
  for(let i=0;i<8;i++){
   const code=randomBytes(3).toString('hex').toUpperCase(),record={room:null,lastTick:this.now()};
   const result=await this.redis.eval(RESERVE,2,this.key(code),this.index,JSON.stringify(record),this.now(),TTL,code);
   if(result===1)return code;if(result===-1)throw Error('服务繁忙，请稍后再试。');
  }throw Error('创建失败，请重试。');
 }
 async enqueue(code,events){
  if(!/^[A-F0-9]{6}$/.test(code))throw Error('房间码应为 6 位。');
  const result=await this.redis.eval(ENQUEUE,2,this.key(code),this.key(code,'queue'),events.length,...events.map(e=>JSON.stringify(e)));
  if(result===-1)throw Error('房间不存在或已结束。');if(result===0)throw Error('服务繁忙，请稍后再试。');
 }
 hydrate(record,code,clock){
  const service=new RoomService({now:()=>clock.value,makeRoomCode:()=>code});service.broadcast=()=>{};
  if(!record.room)return service;
  const room={...record.room,players:new Map()};
  for(const saved of record.room.players){
   const player={...saved,lastRecover:saved.lastRecover??-Infinity,connection:saved.connection?{id:saved.connection.id,instance:saved.connection.instance,seenAt:saved.connection.seenAt,send(){}}:null};
   room.players.set(player.id,player);if(player.connection)service.connections.set(player.connection,{room:code,player:player.id});
  }
  service.rooms.set(code,room);return service;
 }
 serialize(room){if(!room)return null;return {...room,players:[...room.players.values()].map(p=>({...p,connection:p.connection?{id:p.connection.id,instance:p.connection.instance,seenAt:p.connection.seenAt}:null}))};}
 async advance(code){
  const lease=randomUUID(),lock=this.key(code,'lock');
  if(await this.redis.set(lock,lease,'PX',1500,'NX')!=='OK')return false;
  try{
   const [raw,commands]=await Promise.all([this.redis.get(this.key(code)),this.redis.lrange(this.key(code,'queue'),0,255)]);
   if(!raw){await this.release(lock,lease);return false;}
   const record=JSON.parse(raw),now=this.now(),clock={value:record.lastTick},service=this.hydrate(record,code,clock),replies=[];
   let room=service.rooms.get(code);
   // A killed function may never emit close. Presence leases make its players
   // resumable; a token-authenticated resume can also retire the previous socket.
   clock.value=now;
   if(room)for(const player of room.players.values())if(player.connection&&now-player.connection.seenAt>12)service.detach(player.connection);
   const steps=Math.min(15,Math.max(0,Math.floor((now-record.lastTick)/PHYSICS_DT)));
   const base=steps===15?now-steps*PHYSICS_DT:record.lastTick;
   for(let i=0;i<steps;i++){clock.value=base+(i+1)*PHYSICS_DT;service.tick();}
   clock.value=now;
   for(const encoded of commands){
    const event=JSON.parse(encoded);let data,error;
    room=service.rooms.get(code);
    let connection=room&&[...room.players.values()].find(p=>p.connection?.id===event.connection)?.connection;
    try{
     if(event.kind==='disconnect'){if(connection)service.detach(connection);continue;}
     if(event.kind==='presence'){if(connection)connection.seenAt=now;continue;}
     if(event.message.type==='resume'&&!connection){
      const previous=room&&[...room.players.values()].find(p=>p.token&&p.token===event.message.resumeToken);
      if(previous?.connection){const old=previous.connection;service.detach(old);replies.push([this.replyChannel(old.instance),JSON.stringify({connection:old.id,retired:true})]);}
     }
     if(!connection){connection={id:event.connection,instance:event.instance,seenAt:now,send(){}};service.attach(connection);}
     connection.seenAt=now;
     data=service.handle(connection,event.message);
    }catch(cause){error=cause.message;}
    if(event.id)replies.push([this.replyChannel(event.instance),JSON.stringify({id:event.id,connection:event.connection,data,error})]);
   }
   room=service.rooms.get(code);
   const next={room:this.serialize(room),lastTick:steps===15?now:record.lastTick+steps*PHYSICS_DT};
   if(room)replies.push([this.snapshotChannel(code),JSON.stringify({type:'snapshot',room:service.view(room)})]);
   const result=await this.redis.eval(COMMIT,4,lock,this.key(code),this.key(code,'queue'),this.index,lease,room?JSON.stringify(next):'deleted',commands.length,TTL,code,now+TTL,...replies.flat());
   return result===1;
  }catch(error){await this.release(lock,lease).catch(()=>{});throw error;}
 }
 async release(lock,lease){await this.redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,lock,lease);}
}
