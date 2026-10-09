import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {WebSocketServer} from 'ws';
import Redis from 'ioredis';
import {DistributedRooms} from './distributed-rooms.js';

export function createDistributedServer({redisUrl=process.env.REDIS_URL||process.env.KV_URL,prefix='apex:rooms:v1',allowOrigin=originAllowed}={}){
 const instance=randomUUID(),clients=new Map(),pending=new Map(),batches=new Map(),phases=new Map(),lastWorked=new Map();let timer,heartbeat,busy=false,failed=false;
 const options={lazyConnect:true,maxRetriesPerRequest:1,connectTimeout:5000,retryStrategy:times=>times>5?null:Math.min(times*250,2000)};
 const redis=redisUrl?new Redis(redisUrl,options):null,subscriber=redis?.duplicate(),store=redis&&new DistributedRooms(redis,{prefix});
 redis?.on('error',()=>{failed=true;});subscriber?.on('error',()=>{failed=true;});
 let ready;
 const connect=()=>ready??=(async()=>{if(!redis)throw Error('房间服务尚未配置。');await Promise.all([redis.connect(),subscriber.connect()]);await subscriber.subscribe(store.replyChannel(instance));failed=false;})();
 const send=(ws,message)=>{if(ws.readyState===1&&ws.bufferedAmount<256*1024)ws.send(JSON.stringify(message));};
 subscriber?.on('message',(channel,encoded)=>{
  let event;try{event=JSON.parse(encoded);}catch{return;}
  if(channel===store.replyChannel(instance)){
   if(event.retired){clients.get(event.connection)?.ws.close(4001,'Session resumed elsewhere');return;}
   const request=pending.get(event.id);if(!request)return;pending.delete(event.id);clearTimeout(request.timer);event.error?request.reject(Error(event.error)):request.resolve(event.data);
  }else if(event.type==='snapshot'){phases.set(event.room.code,event.room.phase);for(const entry of clients.values())if(entry.code===event.room.code)send(entry.ws,event);}
 });
 const activeCodes=()=>new Set([...clients.values()].flatMap(entry=>[entry.code,entry.pendingCode].filter(Boolean)));
 async function flush(){
  const groups=[...batches];batches.clear();
  await Promise.all(groups.map(async([code,events])=>{try{await store.enqueue(code,events);}catch{for(const event of events)clients.get(event.connection)?.ws.close(1013,'Room service unavailable');}}));
 }
 async function pump(){if(busy||!store)return;busy=true;try{await flush();await Promise.all([...activeCodes()].filter(code=>['countdown','racing'].includes(phases.get(code))||Date.now()-(lastWorked.get(code)||0)>=1000).map(code=>{lastWorked.set(code,Date.now());return store.advance(code);}));failed=false;}catch{failed=true;for(const entry of clients.values())entry.ws.close(1013,'Room service unavailable');}finally{busy=false;}}
 function queue(code,event){const batch=batches.get(code)||[];batch.push(event);batches.set(code,batch);}
 async function request(entry,code,message){
  const id=randomUUID();
  const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('房间服务响应超时，请重试。'));},8000);pending.set(id,{resolve,reject,timer});});
  // Prevent a rejected enqueue from leaving an unobserved timeout promise.
  try{await store.enqueue(code,[{id,instance,connection:entry.id,message}]);await store.advance(code);return await result;}
  catch(error){const task=pending.get(id);if(task){pending.delete(id);clearTimeout(task.timer);task.resolve(null);}throw error;}
 }
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  if(req.method==='GET'){
   try{await connect();await redis.ping();res.writeHead(200);res.end(JSON.stringify({ok:true,roomLimit:4,sharedState:true}));}catch{res.writeHead(503);res.end(JSON.stringify({ok:false,configured:!!redisUrl}));}return;
  }
  res.writeHead(426);res.end(JSON.stringify({error:'WebSocket connection required'}));
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 server.on('upgrade',async(req,socket,head)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!['/api/rooms','/api/rooms/','/ws'].includes(path)||!allowOrigin(req.headers.origin)||clients.size>=200){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  try{await connect();if(socket.destroyed)return;wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));}
  catch{socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');socket.destroy();}
 });
 wss.on('connection',ws=>{
  const entry={id:randomUUID(),ws,code:null,pendingCode:null,alive:true,count:0,window:Date.now(),mutating:false};clients.set(entry.id,entry);
  if(!timer)timer=setInterval(pump,50);
  if(!heartbeat)heartbeat=setInterval(()=>{for(const entry of clients.values()){if(!entry.alive){entry.ws.terminate();continue;}entry.alive=false;entry.ws.ping();if(entry.code)queue(entry.code,{kind:'presence',instance,connection:entry.id});}},5000);
  ws.on('pong',()=>entry.alive=true);ws.on('error',()=>{});
  ws.on('message',async raw=>{
   let message,ownsMutation=false;
   try{
    if(Date.now()-entry.window>=1000){entry.count=0;entry.window=Date.now();}if(++entry.count>150){ws.close(1008,'Too many messages');return;}
    message=JSON.parse(raw);if(!message||typeof message!=='object'||typeof message.type!=='string')throw Error('Invalid message.');
    if(message.type==='input'){if(!entry.code)throw Error('你尚未加入房间。');queue(entry.code,{instance,connection:entry.id,message});return;}
    if(entry.mutating)throw Error('上一个操作还在处理中。');entry.mutating=true;ownsMutation=true;
    let code=entry.code;
    if(['create','join','resume'].includes(message.type)){
     if(code)throw Error('请先退出当前房间。');code=message.type==='create'?await store.reserve():String(message.code||'').toUpperCase();
     if(!/^[A-F0-9]{6}$/.test(code))throw Error('房间码应为 6 位。');message.code=code;entry.pendingCode=code;
     await subscriber.subscribe(store.snapshotChannel(code));
    }
    if(!code)throw Error('你尚未加入房间。');
    // Keep the last driving batch ahead of recover/leave in the shared queue.
    await flush();const data=await request(entry,code,message);
    if(['create','join','resume'].includes(message.type))entry.code=code;
    if(message.type==='leave')entry.code=null;
    if(message.requestId)send(ws,{type:'response',requestId:message.requestId,data});
    if(data?.room)send(ws,{type:'snapshot',room:data.room});
   }catch(error){send(ws,{type:'error',requestId:message?.requestId,message:error.message});}
   finally{if(ownsMutation){entry.pendingCode=null;entry.mutating=false;}}
  });
  ws.on('close',()=>{
   clients.delete(entry.id);const code=entry.code||entry.pendingCode;
   if(code)store.enqueue(code,[{kind:'disconnect',instance,connection:entry.id}]).then(()=>store.advance(code)).catch(()=>{});
   if(!clients.size){clearInterval(timer);clearInterval(heartbeat);timer=heartbeat=null;flush().catch(()=>{});}
  });
 });
 return {server,wss,store,get failed(){return failed;},async close(){clearInterval(timer);clearInterval(heartbeat);for(const entry of clients.values())entry.ws.terminate();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Server closed'));}pending.clear();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));redis?.disconnect();subscriber?.disconnect();}};
}
export function originAllowed(origin,additionalOrigins=process.env.ROOM_ALLOWED_ORIGINS||''){
 if(!origin)return true;
 try{const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)return false;const extra=additionalOrigins.split(',').map(value=>value.trim()).filter(Boolean);return extra.includes(url.origin)||url.hostname==='apex-club-racing.vercel.app'||/^apex-club-racing-[a-z0-9-]+-ryan-1d85\.vercel\.app$/.test(url.hostname);}catch{return false;}
}
