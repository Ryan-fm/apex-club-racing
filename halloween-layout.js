// Lantern Hollow: a generous launch straight, manor sweep, graveyard S-bends,
// a forest hairpin and a long moonlit return. No stacked or intersecting roads.
export const HALLOWEEN_HALF_WIDTH=42;
export const HALLOWEEN_TENSION=.60;
const WAYPOINTS=[
 [1120,170,0],[1120,174,360],[960,190,730],[600,210,1030],
 [200,220,1070],[-180,210,850],[-260,200,520],[-560,185,450],
 [-700,180,800],[-1050,170,900],[-1300,166,540],[-1330,160,80],
 [-1140,165,-260],[-1260,174,-660],[-1010,190,-1020],
 [-600,210,-1130],[-200,225,-900],[130,220,-1000],
 [500,200,-1140],[910,184,-920],[1140,174,-550],[1120,170,-200]
];
export function halloweenCircuitPoints(){return WAYPOINTS.map(point=>[...point]);}
