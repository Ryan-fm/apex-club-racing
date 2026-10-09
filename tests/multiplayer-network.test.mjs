import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createMultiplayerServer} from '../server/multiplayer.js';
import {RoomClient} from '../multiplayer/client.js';
const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out');};
test('four real sockets create, join, synchronize countdown/positions, recover and leave',async()=>{
 const app=createMultiplayerServer();await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const endpoint=`ws://127.0.0.1:${app.server.address().port}/ws`,clients=Array.from({length:5},()=>new RoomClient(endpoint,{WebSocketImpl:WebSocket}));
 try{
  await clients[0].enter('create',{name:'房主',craft:1,scene:'bay'});const code=clients[0].room.code;
  for(let i=1;i<4;i++)await clients[i].enter('join',{name:`好友${i}`,craft:i,code});
  await assert.rejects(clients[4].enter('join',{name:'第五位',craft:1,code}),/最多 4/);
  for(const client of clients.slice(0,4))await client.request('ready',{ready:true});await clients[0].request('start');
  await waitFor(()=>clients.slice(0,4).every(client=>client.room.phase==='racing'));
  for(let seq=1;seq<=20;seq++){clients[0].input(seq,{rawSteer:0,throttle:true,brake:false,driftHeld:false,commands:{}});await new Promise(resolve=>setTimeout(resolve,17));}
  await waitFor(()=>clients[1].room.players.find(p=>p.id===clients[0].playerId)?.state.speed>30);
  const savedId=clients[0].playerId;clients[0].socket.terminate();await waitFor(()=>clients[0].socket?.readyState===1&&clients[1].room.players.find(p=>p.id===savedId)?.connected);assert.equal(clients[0].playerId,savedId);
  const mine=clients[0].room.players.find(p=>p.id===clients[0].playerId),progress=mine.racer.progress;await clients[0].request('recover');await waitFor(()=>clients[0].room.players.find(p=>p.id===clients[0].playerId)?.state.speed===0);assert(clients[0].room.players.find(p=>p.id===clients[0].playerId).racer.progress>=progress);
  await clients[0].leave();await waitFor(()=>clients[1].room.host===clients[1].playerId);assert(clients[1].room.players.find(p=>p.id===mine.id).dnf);
 }finally{for(const client of clients)await client.leave().catch(()=>{});await app.close();}
});
