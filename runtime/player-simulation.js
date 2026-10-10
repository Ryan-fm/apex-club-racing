import {stepHandling,resolveTrackContact,progressDelta} from '../driving-model.js';
import {projectRoad} from '../track-routes.js';
import {updateDrift} from '../race-rules.js';
import {offerDrift,stepStunts,fireStunt} from '../stunt-model.js';

// The same driving step is used by races and deterministic regression replays.
// No DOM, camera, model animation, audio or automatic steering belongs here.
export function stepPlayerSimulation(state, stunts, input, kart, track, dt) {
  const events=[];
  if(input.commands?.nitro && state.boost>=.333 && state.nitro<=0){
    state.boost=Math.max(0,state.boost-1/3);state.nitro=2.1;events.push({kind:'nitro'});
  }
  state.nitro=Math.max(0,state.nitro-dt);state.miniTurbo=Math.max(0,state.miniTurbo-dt);
  const blocked=Math.abs(state.lane)>(state.roadHalfWidth??track.halfWidth(state.t))-6.2&&state.laneVel*state.lane>0;
  const wasDrifting=state.drift.active,direction=state.drift.direction;
  const reward=updateDrift(state.drift,{held:input.driftHeld&&!stunts.airborne,steer:input.driftSteer??input.rawSteer,speed:state.speed,blocked:blocked||stunts.airborne},dt*kart.drift);
  if(!wasDrifting&&state.drift.active){state.hop=.24;events.push({kind:'drift-start'});}
  if(reward){offerDrift(stunts,reward,input.rawSteer*direction<0);state.boost=Math.min(1,state.boost+(reward>1?.34:.17));events.push({kind:'drift-release',power:reward});}
  // A deliberate press up to 100ms before take-off/landing can use the next
  // genuine opportunity. It never invents a boost or extends an expired window.
  stunts.miniBuffer=input.commands?.mini ? .1 :Math.max(0,(stunts.miniBuffer||0)-dt);
  const fire=()=>{if(stunts.miniBuffer<=0)return;const spray=fireStunt(stunts);if(spray){stunts.miniBuffer=0;state.miniTurbo=Math.max(state.miniTurbo,spray.duration);state.boostKind=spray.kind;events.push({...spray,kind:'mini',type:spray.kind});}};
  fire();
  const surface=projectRoad(state,track);
  state.surfaceBoost=surface.surfaceBoost;
  stepHandling(state,{steer:stunts.airborne?input.rawSteer*.35:input.rawSteer,throttle:input.throttle,brake:input.brake,boosting:state.nitro>0||state.miniTurbo>0,surfaceBoost:state.surfaceBoost,grade:surface.grade*(Math.sin(state.heading)*surface.sideZ-Math.cos(state.heading)*surface.sideX)},kart,dt);
  const road=projectRoad(state,track);state.roadIndex=road.index;
  if(road.routeId!==state.routeId&&road.routeId)events.push({kind:"route-enter",route:road.routeKind});
  if(road.surfaceBoost&&!state.surfaceBoost)events.push({kind:"fast-road"});
  state.routeId=road.routeId;state.roadHalfWidth=road.halfWidth;state.surfaceBoost=road.surfaceBoost;
  const hadContact=state.wallContact>0,wallHit=resolveTrackContact(state,road,road.halfWidth-6);
  if(wallHit){state.nitro=0;state.miniTurbo=0;if(!hadContact)events.push({kind:'collision'});}
  const wasAirborne=stunts.airborne;
  stepStunts(stunts,{ground:road.ground,ramp:0,speed:state.speed,dt,blocked:wallHit});
  if(!wasAirborne&&stunts.airborne)events.push({kind:'takeoff'});
  if(wasAirborne&&!stunts.airborne&&!wallHit)events.push({kind:'land'});
  if(!wallHit)fire();
  const delta=progressDelta(state.t,road.t);state.t=(road.t+1)%1;
  state.hit=Math.max(0,state.hit-dt);
  return {events,delta,wallHit,boosting:state.nitro>0||state.miniTurbo>0||state.surfaceBoost,steer:input.rawSteer};
}
