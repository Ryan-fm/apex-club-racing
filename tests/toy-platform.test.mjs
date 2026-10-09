import test from 'node:test';
import assert from 'node:assert/strict';
import {createToyClub,raceScore} from '../toy-platform.js';
const race={scene:'harbor',assisted:false,time:123.456,laps:Array.from({length:3},()=>({valid:true}))};
test('Toy negative milliseconds preserve faster-wins order and reject unsupported records',()=>{
 assert.deepEqual(raceScore(race),{board:3,score:-123456});assert(raceScore({...race,time:120}).score>raceScore(race).score);
 for(const invalid of [{assisted:true},{scene:'unknown'},{time:NaN},{time:0},{time:17000},{laps:[]},{laps:[{valid:true},{valid:false},{valid:true}]}])assert.throws(()=>raceScore({...race,...invalid}));
});
test('public board reads are cached, refresh is explicit, and no profile request is made',async()=>{
 let reads=0,profiles=0;const sdk={isSupport:async()=>true,getUserProfile:async()=>{profiles++;return {nickname:'车手',avatar:'',toyOpenId:'private'};},getRankList:async req=>{reads++;assert.equal(req.board,3);return [{rank:1,score:-123456,nickname:'车手',avatar:''},{rank:2,score:0,nickname:'invalid'}];}};
 const club=createToyClub(async()=>sdk);assert.equal(await club.current(),null);const [a,b]=await Promise.all([club.leaderboard('harbor',false),club.leaderboard('harbor',false)]);assert.deepEqual(a,b);assert.equal(a[0].time_ms,123456);assert.equal(a.length,1);await club.leaderboard('harbor',false);assert.equal(reads,1);assert.equal(profiles,0);
 await club.leaderboard('harbor',false,{refresh:true});assert.equal(reads,2);await club.leaderboard('harbor',false,{period:'week'});assert.equal(reads,3);
 assert.deepEqual(await club.connect(),{player_name:'车手',avatar:''});assert.equal(profiles,1);
});
test('score submits deduplicate, invalidate cached boards, and failures allow a later retry',async()=>{
 let submissions=0,reads=0,fail=false;const sdk={isSupport:async()=>true,getRankList:async()=>{reads++;return [];},submitScore:async request=>{submissions++;assert(request.score<0);if(fail)throw {code:307044};return {score:request.score};}};
 const club=createToyClub(async()=>sdk);await club.leaderboard('harbor',false);await Promise.all([club.submit(race),club.submit(race)]);assert.equal(submissions,1);await club.submit(race);assert.equal(submissions,1);await club.leaderboard('harbor',false);assert.equal(reads,2);
 fail=true;await assert.rejects(club.submit({...race,time:120}),/请求过于频繁/);assert.equal(submissions,2);fail=false;await club.submit({...race,time:120});assert.equal(submissions,3);
});
test('negative score is a valid personal rank and unsupported SDK never submits',async()=>{
 const club=createToyClub(async()=>({isSupport:async()=>true,getMyRank:async()=>({ranked:true,rank:9,score:-50000})}));assert.deepEqual(await club.myRank('bay'),{rank:9,time_ms:50000});
 const unsupported=createToyClub(async()=>({isSupport:async()=>false}));await assert.rejects(unsupported.submit(race),/B站 Toy/);
});
