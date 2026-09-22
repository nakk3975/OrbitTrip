// Assign compact areas across the whole trip before ordering visits inside a day.
// Kept independent of API/network so offline recommendations are deterministic.
export function allocateAreas(config,days,pool,{distance,anchorsFor,windowFor,minute,isTransport}){
 const slots=[];
 for(const [index,date] of days.entries()){
  const anchors=anchorsFor(config,date),window=windowFor(config,date);if(anchors.some(p=>p.allDay))continue;
  let city=config.cities[index],start=minute(window.start);
  const add=(end,local)=>{const minutes=end-start-local.reduce((n,p)=>n+minute(p.end)-minute(p.start)+15,0);if(minutes>=40)slots.push({date,city,minutes,anchors:local,groups:[],load:0});};
  let local=[];for(const a of anchors){if(isTransport(a)){add(minute(a.start)-30,local);city=a.to;start=minute(a.end)+20;local=[];}else local.push(a);}add(minute(window.end),local);
 }
 const groups=[];
 for(const p of pool){let group=p.area?groups.find(g=>g.city===p.city&&g.area===p.area):null;
  if(!group&&!p.area){const nearby=groups.filter(g=>g.city===p.city&&(g.points.length<5||p.type==='식사'&&g.points.some(v=>v.type!=='식사'))&&g.points.every(v=>distance(v,p)<=3.5)).sort((a,b)=>distance(a.center,p)-distance(b.center,p));group=nearby[0];}
  if(!group){group={city:p.city,area:p.area||'',points:[],center:p};groups.push(group);}
  group.points.push(p);group.center={lat:group.points.reduce((n,v)=>n+v.lat,0)/group.points.length,lng:group.points.reduce((n,v)=>n+v.lng,0)/group.points.length};
 }
 // Split only unnamed dense groups when enough places exist but too few day areas.
 for(const city of new Set(slots.map(s=>s.city))){const needed=new Set(slots.filter(s=>s.city===city).map(s=>s.date)).size;while(groups.filter(g=>g.city===city).length<needed){const g=groups.filter(g=>g.city===city&&!g.area&&g.points.length>=2).sort((a,b)=>b.points.length-a.points.length)[0];if(!g)break;const seed=g.points[0],ordered=[...g.points].sort((a,b)=>distance(seed,a)-distance(seed,b)),half=Math.ceil(ordered.length/2);g.points=ordered.slice(0,half);g.center=g.points[0];const tail=ordered.slice(half);groups.push({city,area:'',points:tail,center:tail[0]});}}
 const weight=g=>g.points.filter(p=>p.type!=='식사').length+Math.min(1,g.points.filter(p=>p.type==='식사').length);
 const assignment=new Map();
 // Reserve an anchor's neighborhood for its date, so earlier days do not consume it.
 for(const group of groups){const possible=slots.filter(s=>s.city===group.city);const anchored=possible.flatMap(s=>s.anchors.map(a=>({s,d:distance(a,group.center)}))).sort((a,b)=>a.d-b.d);if(anchored[0]?.d<=3.5){group.preferred=anchored[0].s;group.anchorDistance=anchored[0].d;}}
 groups.sort((a,b)=>Number(!!b.preferred)-Number(!!a.preferred)||(a.preferred&&b.preferred?a.anchorDistance-b.anchorDistance:0)||weight(b)-weight(a));
 for(const g of groups){const possible=slots.filter(s=>s.city===g.city);if(!possible.length)continue;
  const score=s=>s.load/Math.max(1,s.minutes/100)*100+(s.groups.length?Math.min(...s.groups.map(v=>distance(v.center,g.center)))*4:0);
  const slot=(g.preferred&&g.preferred.load+Math.min(weight(g),config.pace==='slow'?3:5)<=(config.pace==='slow'?3:5)?g.preferred:null)||[...possible].sort((a,b)=>score(a)-score(b)||days.indexOf(a.date)-days.indexOf(b.date))[0];
  slot.groups.push(g);slot.load+=Math.min(weight(g),config.pace==='slow'?3:5);for(const p of g.points)assignment.set(p.id,slot.date);
 }
 return assignment;
}
