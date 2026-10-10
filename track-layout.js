// Distinct authored loops. Each begins with an open straight before the first landmark.
export function circuitPoints(scene,{classic=false}={}){
 // Harbor: launch climb → crown hairpins → dock chicane → lower switchbacks.
 // No crossing in XZ: physics projects onto a 2D road, so stacked crossings are unsafe.
 let points;
 if(scene==='harbor')points= [[1100,180,0],[1100,210,400],[1100,265,700],[900,315,1030],[650,320,1000],[510,290,790],[580,260,520],[420,235,350],[200,210,440],[160,200,780],[-80,205,1030],[-430,195,980],[-520,180,750],[-340,165,560],[-450,150,350],[-760,145,450],[-1050,150,700],[-1180,165,410],[-1050,180,140],[-800,200,-80],[-1040,215,-320],[-1120,225,-650],[-900,220,-940],[-640,205,-960],[-430,180,-720],[-480,155,-440],[-270,145,-280],[-70,150,-480],[0,175,-820],[270,195,-1050],[530,210,-990],[620,215,-740],[460,210,-540],[600,195,-320],[850,180,-420],[1090,170,-550],[1170,170,-360],[1100,175,-160]];
 else if(scene==='citadel')points= [[1080,160,0],[1080,165,340],[930,175,620],[630,185,640],[570,215,920],[280,225,990],[100,205,650],[-190,190,640],[-220,180,960],[-570,155,940],[-720,150,600],[-1080,170,490],[-1130,185,100],[-850,200,-130],[-1060,220,-450],[-870,230,-780],[-410,205,-820],[-250,175,-580],[100,150,-620],[390,150,-950],[790,155,-850],[1080,160,-490]];
 else points=[[1100,165,0],[1100,170,400],[840,180,740],[420,190,900],[-80,180,930],[-580,165,840],[-960,150,510],[-1100,150,70],[-970,155,-410],[-630,175,-780],[-160,190,-930],[350,180,-880],[800,160,-660],[1090,160,-350]];
 // Broad, continuous hills instead of take-off ramps. Junctions share these elevations.
 const hills=scene==='harbor'?{19:25,20:45,21:25,28:25,29:45,30:25}:scene==='citadel'?{14:15,15:40,16:55,17:25,19:30,20:50,21:20}:{2:30,3:85,4:100,5:45,8:35,9:65,10:35};
 if(classic)return points;
 return points.map(([x,y,z],i)=>[x,y+(hills[i]||0),z]);
}
export function roadHalfWidth(scene,t){
 if(scene!=='citadel')return 38;
 // Smoothly narrowed gate approaches with wider courtyard exits.
 const gates=[.025,.275,.525,.775];let proximity=1;
 for(const g of gates){const d=Math.abs(t-g);proximity=Math.min(proximity,Math.min(d,1-d)/.02);}
 return 30+8*Math.min(1,proximity);
}
