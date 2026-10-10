import {test} from 'node:test';
import assert from 'node:assert/strict';
import {multiplayerTrack,spawnPlayer,stepRoomPlayer,idleInput} from '../multiplayer/simulation.js';

test('scripted driver completes the canyon main loop without persistent wall locks',()=>{
 const track={...multiplayerTrack('canyon'),routes:[]},player={...spawnPlayer('canyon',0),craft:1},p=track.curve.getPointAt(0),tan=track.curve.getTangentAt(0),race={elapsed:0,firstFinish:null};
 Object.assign(player.state,{x:p.x,z:p.z,t:0,heading:Math.atan2(tan.x,tan.z),lane:0,speed:100});player.racer.progress=0;
 let hits=0,steps=0;
 for(;steps<18000&&player.racer.progress<1;steps++){
  const s=player.state,ahead=track.curve.getPointAt((s.t+.007)%1),aim=Math.atan2(ahead.x-s.x,ahead.z-s.z),error=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading));race.elapsed+=1/60;
  const result=stepRoomPlayer(player,{...idleInput(),throttle:true,rawSteer:Math.max(-1,Math.min(1,-error*2.5)),brake:Math.abs(error)>.5&&s.speed>170},race,track);
  hits+=Number(result.wallHit);assert(!player.stunts.airborne);
 }
 assert(player.racer.progress>=1,'the full main road must be traversable');assert(hits<40,`persistent contacts: ${hits}`);
});
