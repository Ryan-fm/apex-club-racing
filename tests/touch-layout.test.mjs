import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TOUCH_LAYOUT,TOUCH_LAYOUT_KEY,sanitizeTouchLayout,loadTouchLayout,saveTouchLayout,applyTouchLayout} from '../touch-layout.js';
import {createChallengeNotice,stepChallengeNotice} from '../challenge-ui.js';
import {createChallenge,stepChallenge} from '../race-challenges.js';

test('touch layouts accept only supported geometry and recover from corrupt or unavailable storage',()=>{
 assert.deepEqual(sanitizeTouchLayout({layout:'mirrored',scale:115,inset:36}),{layout:'mirrored',scale:115,inset:36});
 for(const value of [null,undefined,{},'mirrored',{layout:'evil',scale:'115',inset:-24},{scale:10000,inset:NaN}])assert.deepEqual(sanitizeTouchLayout(value),DEFAULT_TOUCH_LAYOUT);
 for(const storage of [null,{getItem:()=>'{broken'},{getItem(){throw Error('blocked');}}])assert.deepEqual(loadTouchLayout(storage),DEFAULT_TOUCH_LAYOUT);
 assert.equal(saveTouchLayout({},null),false);assert.equal(saveTouchLayout({},{setItem(){throw Error('quota');}}),false);
});

test('touch preferences persist and apply as real dimensions without changing driving intents',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const desired={layout:'mirrored',scale:85,inset:12};assert(saveTouchLayout(desired,storage));assert.deepEqual(loadTouchLayout(storage),desired);
 assert(values.has(TOUCH_LAYOUT_KEY));
 const styles=new Map(),controls={dataset:{},style:{setProperty:(key,value)=>styles.set(key,value)}};
 assert.deepEqual(applyTouchLayout(controls,desired),desired);assert.equal(controls.dataset.touchLayout,'mirrored');
 assert.equal(styles.get('--touch-size'),'0.85');assert.equal(styles.get('--touch-inset'),'12px');
 assert.equal(saveTouchLayout(DEFAULT_TOUCH_LAYOUT,storage),true);assert.deepEqual(loadTouchLayout(storage),DEFAULT_TOUCH_LAYOUT);
});

test('challenge notices respond to new goal progress, then expire without chain-countdown spam',()=>{
 const run=createChallenge('flow'),notice=createChallengeNotice(),metrics={collisions:0,rank:8};
 assert.equal(stepChallengeNotice(notice,run,metrics,.1),false);
 stepChallenge(run,{events:[{kind:'drift-release'}]},.1);assert.equal(stepChallengeNotice(notice,run,metrics,.1),true);
 const original=notice.remaining;
 stepChallenge(run,{events:[]},.5);stepChallengeNotice(notice,run,metrics,.5);assert.equal(notice.remaining,original-.5);
 stepChallengeNotice(notice,run,metrics,0);assert.equal(notice.remaining,original-.5,'pause must not consume notice time');
 assert.equal(stepChallengeNotice(notice,run,metrics,3),false);
 for(let i=0;i<6;i++)stepChallenge(run,{events:[{kind:'drift-release'}]},.1);
 assert.equal(stepChallengeNotice(notice,run,metrics,.1),true);stepChallengeNotice(notice,run,metrics,3);
 stepChallenge(run,{events:[{kind:'drift-release'}]},.1);assert.equal(stepChallengeNotice(notice,run,metrics,.1),false,'actions beyond a complete goal must stay quiet');
});

test('exploration and podium notices cannot be retriggered by repeated entries or rank oscillation',()=>{
 const explorer=createChallenge('explorer'),notice=createChallengeNotice(),metrics={collisions:0,rank:8};
 stepChallenge(explorer,{events:[{kind:'route-enter',route:'shortcut'}],routeId:'cut-0'},0);
 assert(stepChallengeNotice(notice,explorer,metrics,0));stepChallengeNotice(notice,explorer,metrics,3);
 stepChallenge(explorer,{events:[{kind:'route-enter',route:'shortcut'}],routeId:'cut-0'},0);
 assert.equal(stepChallengeNotice(notice,explorer,metrics,.1),false);
 const precision=createChallenge('precision'),podium=createChallengeNotice();
 assert(stepChallengeNotice(podium,precision,{collisions:0,rank:3},0));stepChallengeNotice(podium,precision,{collisions:0,rank:4},3);
 assert.equal(stepChallengeNotice(podium,precision,{collisions:0,rank:2},.1),false);
});
