import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomService} from '../server/rooms.js';
import {multiplayerTrack,spawnPlayer,idleInput,sanitizeInput,PHYSICS_DT} from '../multiplayer/simulation.js';
import {RoomPrediction} from '../multiplayer/prediction.js';
const setup=()=>{let now=0;const rooms=new RoomService({now:()=>now}),connections=[];const connect=()=>{const c={messages:[],send(message){this.messages.push(structuredClone(message));}};rooms.attach(c);connections.push(c);return c;};return {rooms,connect,connections,time(value){now=value;}};};
const enter=(f,connection,type='create',code)=>f.rooms.handle(connection,{type,code,name:'车手',craft:1,scene:'bay'});
function readyRace(f,count=2){const members=[];for(let i=0;i<count;i++){const connection=f.connect(),data=enter(f,connection,i?'join':'create',members[0]?.data.room.code);members.push({connection,data});f.rooms.handle(connection,{type:'ready',ready:true});}f.rooms.handle(members[0].connection,{type:'start'});return members;}
test('four seats, host-only start, ready gate, and no secret in room broadcasts',()=>{
 const f=setup(),host=f.connect(),created=enter(f,host),code=created.room.code;
 assert.throws(()=>f.rooms.handle(host,{type:'start'}),/至少 2/);
 for(let i=0;i<3;i++)enter(f,f.connect(),'join',code);
 assert.throws(()=>enter(f,f.connect(),'join',code),/最多 4/);
 const room=f.rooms.rooms.get(code);assert.equal(room.players.size,4);assert(!JSON.stringify(f.rooms.view(room)).includes(created.resumeToken));
 const guest=f.connections[1];assert.throws(()=>f.rooms.handle(guest,{type:'start'}),/只有房主/);assert.throws(()=>f.rooms.handle(guest,{type:'configure',scene:'harbor'}),/只有房主/);
 assert.throws(()=>f.rooms.handle(host,{type:'start'}),/准备/);
 for(const connection of f.connections.slice(0,4))f.rooms.handle(connection,{type:'ready',ready:true});
 f.rooms.handle(host,{type:'configure',scene:'citadel'});assert([...room.players.values()].every(p=>!p.ready));
 for(const connection of f.connections.slice(0,4))f.rooms.handle(connection,{type:'ready',ready:true});f.rooms.handle(host,{type:'start'});assert.equal(room.phase,'countdown');assert.equal(room.round,1);assert.equal(room.players.size,4);
 assert.throws(()=>enter(f,f.connect(),'join',code),/比赛已开始/);
});
test('server ignores client positions, drives only after countdown, validates sequences and times out stale controls',()=>{
 const f=setup(),members=readyRace(f),room=f.rooms.rooms.get(members[0].data.room.code),p=room.players.get(members[0].data.playerId);
 const initial=p.state.z;f.rooms.handle(members[0].connection,{type:'input',seq:1,input:{...idleInput(),throttle:true,x:100000}});f.rooms.tick();assert.equal(p.state.z,initial);
 f.time(3);f.rooms.tick();assert.equal(room.phase,'racing');f.rooms.handle(members[0].connection,{type:'input',seq:1,input:{...idleInput(),throttle:true}});
 for(let i=0;i<20;i++){f.time(3+i*PHYSICS_DT);f.rooms.tick();}assert(p.state.speed>0);assert.equal(p.ack,1);assert(p.state.x!==100000);
 assert.throws(()=>f.rooms.handle(members[0].connection,{type:'input',seq:1,input:idleInput()}),/sequence/);assert.throws(()=>sanitizeInput({rawSteer:Infinity}),/Invalid/);
 const before=p.state.speed;f.time(4);for(let i=0;i<10;i++)f.rooms.tick();assert(p.state.speed<before);
});
test('disconnect reserves seat, transfers host, authenticates resume and expires to DNF',()=>{
 const f=setup(),members=readyRace(f,4),room=f.rooms.rooms.get(members[0].data.room.code);
 f.rooms.detach(members[0].connection);assert.equal(room.players.size,4);assert.equal(room.host,members[1].data.playerId);
 assert.throws(()=>f.rooms.handle(f.connect(),{type:'resume',code:room.code,resumeToken:'fake'}),/重连已过期/);
 f.time(5);const replacement=f.connect();f.rooms.handle(replacement,{type:'resume',code:room.code,resumeToken:members[0].data.resumeToken});assert(room.players.get(members[0].data.playerId).connection===replacement);
 f.rooms.detach(replacement);f.time(26);f.rooms.tick();assert(room.players.get(members[0].data.playerId).dnf);
});
test('explicit race leave retains DNF result, last departure cleans up, and names cannot inject markup',()=>{
 const f=setup(),members=readyRace(f),room=f.rooms.rooms.get(members[0].data.room.code);
 f.rooms.handle(members[0].connection,{type:'leave'});assert.equal(room.players.size,2);assert(room.players.get(members[0].data.playerId).dnf);
 f.rooms.detach(members[1].connection);f.time(21);f.rooms.tick();assert.equal(f.rooms.rooms.size,0);
 assert.throws(()=>f.rooms.handle(f.connect(),{type:'create',name:'<img>',craft:1,scene:'bay'}),/昵称/);
});
test('server finish timeout and rematch reset readiness and race resources',()=>{
 const f=setup(),members=readyRace(f),room=f.rooms.rooms.get(members[0].data.room.code);f.time(3);f.rooms.tick();room.elapsed=599.999;f.rooms.tick();assert.equal(room.phase,'finished');assert([...room.players.values()].every(p=>p.dnf));
 assert.throws(()=>f.rooms.handle(members[1].connection,{type:'rematch'}),/只有房主/);f.rooms.handle(members[0].connection,{type:'rematch'});assert.equal(room.phase,'lobby');assert([...room.players.values()].every(p=>!p.ready&&!p.state));
});
test('client prediction replays only unacknowledged inputs and matches shared server physics',()=>{
 const track=multiplayerTrack('bay'),player={...spawnPlayer('bay',0),craft:1},authoritative=structuredClone(player),prediction=new RoomPrediction(player,track),race={elapsed:0,firstFinish:null},serverRace={elapsed:0,firstFinish:null};
 const input={...idleInput(),rawSteer:.2,throttle:true};prediction.predict(input,race);const first=structuredClone(player);prediction.predict(input,race);
 prediction.reconcile({...first,ack:1},{phase:'racing',elapsed:0,firstFinish:null});assert.equal(prediction.pending.length,1);
 const expected={...first,craft:1},reference=new RoomPrediction(expected,track);reference.predict(input,serverRace);assert(Math.abs(player.state.x-expected.state.x)<1e-9);assert(Math.abs(player.state.heading-expected.state.heading)<1e-9);
});

test('four server-driven racers finish three laps and receive the same authoritative result',()=>{
 const f=setup(),members=readyRace(f,4),room=f.rooms.rooms.get(members[0].data.room.code),track=multiplayerTrack('bay');f.time(3);f.rooms.tick();
 for(let tick=1;tick<24000&&room.phase==='racing';tick++){
  f.time(3+tick*PHYSICS_DT);
  for(const {connection,data} of members){
   const p=room.players.get(data.playerId);if(p.racer.finishTime!==null)continue;
   const ahead=track.curve.getPointAt((p.state.t+.008)%1),heading=Math.atan2(ahead.x-p.state.x,ahead.z-p.state.z),error=Math.atan2(Math.sin(heading-p.state.heading),Math.cos(heading-p.state.heading));
   f.rooms.handle(connection,{type:'input',seq:tick,input:{...idleInput(),throttle:true,brake:p.state.speed>360||Math.abs(error)>.65,rawSteer:Math.max(-1,Math.min(1,-error*2.6))}});
  }
  f.rooms.tick();
 }
 assert.equal(room.phase,'finished');assert([...room.players.values()].every(p=>p.racer.progress===3&&p.racer.finishTime>0&&!p.dnf));
 const results=members.map(({connection})=>connection.messages.at(-1).room.players.map(p=>[p.id,p.racer.finishTime]));for(const result of results)assert.deepEqual(result,results[0]);
});

test('equal-progress multiplayer standings use server grid order for every client',async()=>{
 const {standings}=await import('../race-rules.js');
 const racers=[0,1,2,3].map(sortOrder=>({sortOrder,progress:1,finishTime:null}));
 for(let local=0;local<4;local++){
  const ordered=[racers[local],...racers.filter((_,i)=>i!==local)].map((r,id)=>({...r,id}));
  assert.deepEqual(standings({racers:ordered}).map(r=>r.sortOrder),[0,1,2,3]);
 }
});

test('four-player canyon room uses the new shared circuit and retains the seat limit',()=>{
 const f=setup(),members=[];
 for(let i=0;i<4;i++){const connection=f.connect();const data=f.rooms.handle(connection,{type:i?'join':'create',code:members[0]?.data.room.code,name:`Driver${i}`,craft:i,scene:'canyon'});members.push({connection,data});}
 const code=members[0].data.room.code,room=f.rooms.rooms.get(code);assert.equal(room.scene,'canyon');assert.equal(room.players.size,4);
 assert.throws(()=>f.rooms.handle(f.connect(),{type:'join',code,name:'Fifth',craft:1,scene:'canyon'}),/最多 4/);
 for(const member of members)f.rooms.handle(member.connection,{type:'ready',ready:true});
 f.rooms.handle(members[0].connection,{type:'start'});assert.equal(room.phase,'countdown');
 const track=multiplayerTrack('canyon');assert.equal(track.routes.length,4);assert(track.curve.getLength()>7000);
 for(const player of room.players.values())assert(Number.isFinite(player.state.x)&&Number.isFinite(player.state.heading));
});
