import test from 'node:test';import assert from 'node:assert/strict';
import {createToyClub} from '../toy-platform.js';
import {weekKey} from '../progression-rules.js';
test('Toy cloud progress serializes concurrent updates and deduplicates retries',async()=>{
 let stored={},calls=0;const sdk={isSupport:async()=>true,getUserProfile:async()=>({nickname:'Driver',avatar:''}),getCloudStorage:async()=>({...stored}),setCloudStorage:async value=>{calls++;stored={...stored,...value};}};
 const club=createToyClub(async()=>sdk);await assert.rejects(()=>club.progress(),/先连接/);await club.connect();
 await Promise.all([club.progress({seconds:60,batch:'one'}),club.progress({seconds:60,batch:'two'})]);assert.equal((await club.progress()).total_seconds,120);await club.progress({seconds:60,batch:'one'});assert.equal((await club.progress()).total_seconds,120);
 await assert.rejects(()=>club.claimReward('warmup'),/尚未完成/);
 for(let i=0;i<8;i++)await club.progress({seconds:60,batch:'more-'+i});await club.claimReward('warmup');assert.equal((await club.progress()).activity_points,20);await club.claimReward('warmup');assert.equal((await club.progress()).activity_points,20);
 await club.saveGarage({cars:{1:{livery:'ember',paint:'#ffaa33'}}});assert.equal((await club.progress()).garage.cars[1].livery,'ember');await assert.rejects(()=>club.saveGarage({cars:{1:{livery:'champion'}}}),/未解锁/);
 await club.recordProgressRace('same-race');await club.recordProgressRace('same-race');assert.equal((await club.progress()).week_races,1);assert.ok(calls>0);
});
test('Toy rejects corrupt cloud data without overwriting the original',async()=>{let writes=0;const club=createToyClub(async()=>({isSupport:async()=>true,getUserProfile:async()=>({nickname:'D'}),getCloudStorage:async()=>({'apex.progress.v1':'broken-json'}),setCloudStorage:async()=>writes++}));await club.connect();await assert.rejects(()=>club.progress({seconds:30,batch:'x'}),/未覆盖/);assert.equal(writes,0);});
test('cloud opt-in survives navigation without requesting identity on page load',async()=>{
 const previous=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 try{let profiles=0;const sdk={isSupport:async()=>true,getUserProfile:async()=>{profiles++;return {nickname:'Driver'};},getCloudStorage:async()=>({})};const first=createToyClub(async()=>sdk);assert.equal(first.signedIn(),false);await first.connect();const next=createToyClub(async()=>sdk);assert.equal(next.signedIn(),true);assert.equal(await next.current(),null);await next.progress();assert.equal(profiles,1);await next.logout();assert.equal(next.signedIn(),false);}finally{if(previous)globalThis.localStorage=previous;else delete globalThis.localStorage;}
});
