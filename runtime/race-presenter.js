const angle = a => Math.atan2(Math.sin(a),Math.cos(a));
// Bounded camera smoothing: no road tangent and no feedback into vehicle physics.
export function chaseHeading(previous,target,dt,snap=false){
 if(snap||!Number.isFinite(previous))return target;
 const delta=angle(target-previous),lag=Math.max(-.10,Math.min(.10,delta*Math.exp(-22*dt)));
 return target-lag;
}
export function createSuspension(){return {offset:0,velocity:0,wasAirborne:false};}
export function stepSuspension(s,airborne,dt,reducedMotion=false){
 if(s.wasAirborne&&!airborne&&!reducedMotion)s.velocity=-5;
 s.wasAirborne=airborne;
 if(reducedMotion){s.offset=0;s.velocity=0;return 0;}
 // Analytic critically damped spring remains stable at all display rates.
 const omega=15,decay=Math.exp(-omega*dt),v=s.velocity+omega*s.offset;
 s.offset=(s.offset+v*dt)*decay;s.velocity=(s.velocity-omega*v*dt)*decay;
 return s.offset;
}
