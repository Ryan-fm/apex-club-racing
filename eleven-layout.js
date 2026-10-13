// Reconstructed from the PC Eleven City replay references, not the mobile remaster.
// The original source scene/coordinates are unavailable; these are authored world units.
export const CITY_GROUND=10;
export const CITY_WAYPOINTS=[
 [1040,-780],[1040,900],[760,900],[760,-120],[480,-120],[480,780],
 [200,780],[200,-120],[-80,-120],[-80,640],[-360,640],[-360,-220],
 [-700,-220],[-700,460],[-1040,460],[-1040,-860],[-720,-860],
 [-720,-570],[-380,-570],[-380,-930],[100,-930],[100,-570],
 [520,-570],[520,-1080],[1040,-1080]
];
// Rear street corner cuts. No invented acceleration lanes on this circuit.
export const CITY_CUT_CORNERS=[17,19,21,23];
export function cityCircuitPoints(){
 const corners=CITY_WAYPOINTS.map((p,i)=>{
  const a=CITY_WAYPOINTS[(i+CITY_WAYPOINTS.length-1)%CITY_WAYPOINTS.length],b=CITY_WAYPOINTS[(i+1)%CITY_WAYPOINTS.length];
  const la=Math.hypot(a[0]-p[0],a[1]-p[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const inward=[(a[0]-p[0])/la,(a[1]-p[1])/la],outward=[(b[0]-p[0])/lb,(b[1]-p[1])/lb];
  const r=Math.abs(inward[0]*outward[1]-inward[1]*outward[0])<.01?0:Math.min(96,la*.34,lb*.34);
  return {p,inward,outward,r,entry:[p[0]+inward[0]*r,p[1]+inward[1]*r],exit:[p[0]+outward[0]*r,p[1]+outward[1]*r]};
 });
 const result=[];
 for(let i=0;i<corners.length;i++){
  const c=corners[i],prev=corners[(i+corners.length-1)%corners.length];
  if(i){const distance=Math.hypot(c.entry[0]-prev.exit[0],c.entry[1]-prev.exit[1]),steps=Math.max(1,Math.ceil(distance/80));for(let j=1;j<steps;j++)result.push([prev.exit[0]+(c.entry[0]-prev.exit[0])*j/steps,CITY_GROUND,prev.exit[1]+(c.entry[1]-prev.exit[1])*j/steps]);}
  if(!c.r){result.push([c.p[0],CITY_GROUND,c.p[1]]);continue;}
  const center=[c.p[0]+(c.inward[0]+c.outward[0])*c.r,c.p[1]+(c.inward[1]+c.outward[1])*c.r];
  const start=Math.atan2(c.entry[1]-center[1],c.entry[0]-center[0]),end=Math.atan2(c.exit[1]-center[1],c.exit[0]-center[0]);
  const delta=Math.atan2(Math.sin(end-start),Math.cos(end-start));
  for(let j=0;j<=8;j++){const angle=start+delta*j/8;result.push([center[0]+Math.cos(angle)*c.r,CITY_GROUND,center[1]+Math.sin(angle)*c.r]);}
 }
 // Sample the final straight as well, retaining the starting line at index zero.
 const last=corners.at(-1).exit,first=corners[0].entry,distance=Math.hypot(first[0]-last[0],first[1]-last[1]),steps=Math.ceil(distance/80);
 for(let j=1;j<steps;j++)result.push([last[0]+(first[0]-last[0])*j/steps,CITY_GROUND,last[1]+(first[1]-last[1])*j/steps]);
 return result;
}
