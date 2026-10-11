import test from 'node:test';
import assert from 'node:assert/strict';
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
const {onlineClub}=await import('../online-club.js');
const {progression}=await import('../progression.js');
const {weekKey}=await import('../progression-rules.js');
test('guest active driving persists while a huge frame cannot award menu time',async()=>{
 onlineClub.signedIn=()=>false;await progression.refresh();progression.tick(3600);for(let i=0;i<160;i++)progression.tick(.0625);await progression.flush();assert.equal(progression.state.total_seconds,10);assert.equal(JSON.parse(store.get('apex-progress-guest-v1')).total_seconds,10);
});
test('cloud retry retains the same receipt and concurrent flushes send once',async()=>{
 onlineClub.signedIn=()=>true;let failing=true;const batches=[];let hold,server={week:weekKey(),total_seconds:0,liveries:['solid','stripes']};
 onlineClub.progress=async request=>{if(!request)return server;batches.push(request);if(failing)throw Error('offline');await new Promise(resolve=>hold=resolve);server={...server,total_seconds:request.seconds,week_seconds:request.seconds};return server;};
 await progression.refresh();for(let i=0;i<160;i++)progression.tick(.0625);await progression.flush();assert.equal(progression.state.total_seconds,0);failing=false;const a=progression.flush(),b=progression.flush();assert.equal(batches.length,2);assert.equal(batches[0].batch,batches[1].batch);hold();await Promise.all([a,b]);assert.equal(progression.state.total_seconds,10);await progression.flush();assert.equal(batches.length,2);
});
