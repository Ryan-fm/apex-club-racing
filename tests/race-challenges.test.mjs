import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChallenge,stepChallenge,challengeComplete,settleChallenge,careerProfile,careerTier} from '../race-challenges.js';
const drive=(run,kind,options={})=>stepChallenge(run,{events:[{kind,...options}],collisions:0,routeId:options.routeId},.1);
test('alternating driving actions build a bounded chain; repetition, expiry and collision cannot farm it',()=>{
 const s=createChallenge();drive(s,'nitro');drive(s,'nitro');assert.equal(s.chain,1);
 drive(s,'drift-release');drive(s,'mini');assert.equal(s.chain,3);
 for(let i=0;i<10;i++)drive(s,i%2?'mini':'nitro');assert.equal(s.chain,6);
 stepChallenge(s,{events:[],collisions:0},7);assert.equal(s.chain,0);assert.equal(s.bestChain,6);
 drive(s,'mini');stepChallenge(s,{events:[{kind:'nitro'},{kind:'collision'}],collisions:1},.1);assert.equal(s.chain,0);
 drive(s,'mini');stepChallenge(s,{events:[],collisions:2},.1);assert.equal(s.chain,0,'AI contact or manual recovery also breaks a chain');
});
test('exploration requires distinct paths, not repeatedly entering one shortcut',()=>{
 const s=createChallenge('explorer');
 for(let i=0;i<8;i++)drive(s,'route-enter',{route:'shortcut',routeId:'cut-0'});
 assert.equal(s.cuts.size,1);assert(!challengeComplete(s));
 drive(s,'route-enter',{route:'shortcut',routeId:'cut-1'});
 for(const routeId of ['express-0','express-1'])drive(s,'route-enter',{route:'express',routeId});
 for(let i=0;i<3;i++)drive(s,'nitro');assert(challengeComplete(s));
});
test('precision requires both a podium and at most two contacts',()=>{
 const s=createChallenge('precision');assert(challengeComplete(s,{collisions:2,rank:3}));assert(!challengeComplete(s,{collisions:3,rank:1}));assert(!challengeComplete(s,{collisions:0,rank:4}));
});
test('abandonment, invalid records and duplicate settlement never award experience',()=>{
 for(const options of [{finished:false,valid:true},{finished:true,valid:false}]){
  const s=createChallenge(),result=settleChallenge(s,{xp:100},options);assert.equal(result.xp,0);assert.equal(result.profile.xp,100);assert.equal(settleChallenge(s,{}, {finished:true,valid:true}),null);
 }
});
test('valid finishes settle contract, podium and combo bonuses and unlock a title',()=>{
 const s=createChallenge('flow');for(let i=0;i<6;i++){drive(s,'drift-release');drive(s,'mini');drive(s,'nitro');}
 assert(challengeComplete(s));
 const reward=settleChallenge(s,{xp:100,finishes:2,contracts:1,bestChain:2},{finished:true,valid:true,rank:2});
 assert.equal(reward.xp,150);assert.equal(reward.profile.xp,250);assert.equal(reward.profile.finishes,3);assert.equal(reward.profile.contracts,2);assert(reward.promoted);assert.equal(careerTier(reward.profile).xp,150);
 const before=reward.profile.xp;drive(s,'mini');assert.equal(settleChallenge(s,reward.profile,{finished:true,valid:true}),null);assert.equal(reward.profile.xp,before);
});
test('unfinished contracts still grant a valid finish reward and storage is validated',()=>{
 const s=createChallenge();const reward=settleChallenge(s,{}, {finished:true,valid:true,rank:8});assert.equal(reward.xp,40);assert(!reward.completed);
 assert.deepEqual(careerProfile({xp:-1,finishes:Infinity,contracts:'9',bestChain:100}),{xp:0,finishes:0,contracts:0,bestChain:6});assert.equal(createChallenge('unknown').id,'flow');
});
