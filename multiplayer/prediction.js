import {PHYSICS_DT,stepRoomPlayer} from './simulation.js';
export class RoomPrediction{
 constructor(player,track){this.player=player;this.track=track;this.pending=[];this.seq=0;}
 predict(input,race){const frame={seq:++this.seq,input:structuredClone(input)};this.pending.push(frame);stepRoomPlayer(this.player,input,race,this.track);return frame;}
 reconcile(snapshot,room){
  this.seq=Math.max(this.seq,snapshot.ack);this.pending=this.pending.filter(frame=>frame.seq>snapshot.ack);
  Object.assign(this.player.state,structuredClone(snapshot.state));Object.assign(this.player.stunts,structuredClone(snapshot.stunts));Object.assign(this.player.racer,structuredClone(snapshot.racer));
  if(room.phase==='racing'){
   const replayRace={elapsed:room.elapsed,firstFinish:room.firstFinish};
   for(const frame of this.pending){replayRace.elapsed+=PHYSICS_DT;stepRoomPlayer(this.player,frame.input,replayRace,this.track);}
  }else this.pending=[];
 }
}
