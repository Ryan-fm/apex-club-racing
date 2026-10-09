import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Redis from 'ioredis';
import {WebSocket} from 'ws';
import {RoomClient} from '../multiplayer/client.js';
import {createDistributedServer,originAllowed} from '../server/vercel-multiplayer.js';
import {DistributedRooms} from '../server/distributed-rooms.js';
const waitFor=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out');};
test('production multiplayer selects allowed project origins only',()=>{
 assert(originAllowed('https://apex-club-racing.vercel.app'));assert(originAllowed('https://apex-club-racing-git-main-ryan-1d85.vercel.app'));
 assert(!originAllowed('https://evil.example'));assert(!originAllowed('http://apex-club-racing.vercel.app'));assert(!originAllowed('https://apex-club-racing.vercel.app.evil.example'));
});
test('additional embedding origins require exact configured HTTPS origins',()=>{
 const configured='https://embed.example, https://preview.example';
 assert(originAllowed('https://embed.example',configured));assert(originAllowed('https://preview.example',configured));
 for(const origin of ['https://embed.example.evil.example','http://embed.example','https://embed.example/path','https://other.example'])assert(!originAllowed(origin,configured));
});
test('four players share one race across two independent Vercel gateways and survive gateway replacement',{skip:!process.env.REDIS_TEST_URL},async()=>{
 const prefix=`apex:test:${randomUUID()}`,url=process.env.REDIS_TEST_URL,apps=[],clients=[];
 async function gateway(){const app=createDistributedServer({redisUrl:url,prefix,allowOrigin:()=>true});apps.push(app);await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return `ws://127.0.0.1:${app.server.address().port}/api/rooms`;}
 try{
  const endpoints=[await gateway(),await gateway()];
  for(let i=0;i<5;i++)clients.push(new RoomClient(endpoints[i%2],{WebSocketImpl:WebSocket}));
  await clients[0].enter('create',{name:'房主',scene:'bay',craft:1});const code=clients[0].room.code;
  for(let i=1;i<4;i++)await clients[i].enter('join',{name:`好友 ${i}`,craft:i,code});
  await assert.rejects(clients[4].enter('join',{name:'第五人',craft:0,code}),/最多 4/);
  await assert.rejects(clients[1].request('start'),/房主/);
  for(const c of clients.slice(0,4))await c.request('ready',{ready:true});await clients[0].request('start');
  await waitFor(()=>clients.slice(0,4).every(c=>c.room.phase==='racing'));
  for(let seq=1;seq<=24;seq++){for(const c of clients.slice(0,4))c.input(seq,{rawSteer:0,throttle:true,commands:{}});await new Promise(resolve=>setTimeout(resolve,17));}
  await waitFor(()=>clients[1].room.players.every(p=>p.state.speed>30));
  assert(clients[0].room.players.every(p=>p.racer.sortOrder>=0));assert(!JSON.stringify(clients[0].room).includes(clients[0].resumeToken));
  // Explicitly route replacement sockets to a third instance, as a duration
  // cutoff or deployment would do. No process-local player or room state moves.
  const replacement=await gateway();clients[0].endpoint=replacement;
  const id=clients[0].playerId;clients[0].socket.terminate();
  await waitFor(()=>clients[0].joined&&clients[0].socket?.readyState===1&&clients[0].room.players.find(p=>p.id===id)?.connected);
  assert.equal(clients[0].playerId,id);assert.equal(clients[0].room.players.length,4);
  const saved={endpoint:replacement,code,resumeToken:clients[0].resumeToken};
  const refreshed=new RoomClient(replacement,{WebSocketImpl:WebSocket});clients.push(refreshed);await refreshed.restoreSession(saved);assert.equal(refreshed.playerId,id);
  await waitFor(()=>!clients[0].joined);clients[0].closed=true;clearTimeout(clients[0].reconnectTimer);clients[0]=refreshed;
  await clients[0].request('recover');await clients[0].leave();
  await waitFor(()=>clients[1].room.players.find(p=>p.id===id)?.dnf);
 }finally{
  for(const c of clients)await c.leave().catch(()=>{});for(const app of apps)await app.close();
  const redis=new Redis(url);const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);redis.disconnect();
 }
});
test('room state survives worker loss, leases fence stale writes and reservations expire',{skip:!process.env.REDIS_TEST_URL},async()=>{
 const redis=new Redis(process.env.REDIS_TEST_URL),prefix=`apex:test:${randomUUID()}`;let now=100;
 const first=new DistributedRooms(redis,{prefix,now:()=>now}),second=new DistributedRooms(redis,{prefix,now:()=>now});
 try{
  const code=await first.reserve();await first.enqueue(code,[{id:'create',instance:'one',connection:'host',message:{type:'create',name:'主机',scene:'bay',craft:1}}]);await first.advance(code);
  const saved=JSON.parse(await redis.get(first.key(code)));assert.equal(saved.room.players.length,1);const token=saved.room.players[0].token;
  await redis.set(first.key(code,'lock'),'another-worker','PX',1000);assert.equal(await second.advance(code),false);await redis.del(first.key(code,'lock'));
  now+=13;await second.advance(code);let state=JSON.parse(await redis.get(first.key(code)));assert.equal(state.room.players[0].connection,null);
  await second.enqueue(code,[{id:'resume',instance:'two',connection:'new-host',message:{type:'resume',code,resumeToken:token}}]);await second.advance(code);
  state=JSON.parse(await redis.get(first.key(code)));assert.equal(state.room.players[0].connection.id,'new-host');
  now+=13;await second.advance(code);now+=21;await first.advance(code);assert.equal(await redis.get(first.key(code)),null);
 }finally{const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);redis.disconnect();}
});
