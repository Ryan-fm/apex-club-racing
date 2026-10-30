import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRacePreparation} from '../runtime/race-preparation.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {resolve,reject,promise};};
test('one warmup runs per concurrent request and retry reuses a successfully prepared variant',async()=>{
 const job=deferred(),states=[],calls=[];let time=0;
 const preparation=createRacePreparation({prepare:async options=>{calls.push(options.cached);if(!options.cached)await job.promise;},setBusy:v=>states.push(v),now:()=>time});
 const first=preparation.run('halloween/quality/apex');assert.equal(preparation.run('halloween/quality/apex'),first);
 await Promise.resolve();assert.equal(preparation.busy,true);assert.deepEqual(calls,[false]);time=250;job.resolve();assert.equal(await first,true);
 assert.equal(preparation.busy,false);assert.equal(preparation.report().durationMs,250);
 await preparation.run('halloween/quality/apex');assert.deepEqual(calls,[false,true]);assert.deepEqual(states,[true,false,true,false]);
});
test('returning to the lobby prevents old preparation from reopening or stopping a newer race',async()=>{
 const old=deferred(),current=deferred(),states=[];let calls=0;
 const preparation=createRacePreparation({prepare:async({isCurrent})=>{await (++calls===1?old:current).promise;if(isCurrent())states.push('render');},setBusy:v=>states.push(v)});
 const first=preparation.run('old');await Promise.resolve();preparation.cancel();const second=preparation.run('new');await Promise.resolve();
 old.resolve();assert.equal(await first,false);assert.equal(preparation.busy,true);assert(!states.includes('render'));
 current.resolve();assert.equal(await second,true);assert.equal(preparation.busy,false);assert.equal(states.filter(s=>s==='render').length,1);
});
test('a rejected compilation clears the loading overlay and can be retried',async()=>{
 const errors=[];let attempts=0;
 const preparation=createRacePreparation({prepare:async({cached})=>{assert.equal(cached,false);if(!attempts++)throw Error('context lost');},onError:e=>errors.push(e.message)});
 assert.equal(await preparation.run('bay'),false);assert.equal(preparation.busy,false);assert.deepEqual(errors,['context lost']);
 assert.equal(await preparation.run('bay'),true);
});
