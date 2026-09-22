import {allocateAreas} from './planning-areas.js';
import {knownRoute} from './route-cache.js';
import {places,stations} from './data.js';
export const minute=s=>{if(!/^\d{2}:\d{2}$/.test(s))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;};
export const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function dates(start,end){const a=Date.parse(start+'T00:00:00Z'),b=Date.parse(end+'T00:00:00Z');if(!Number.isFinite(a)||!Number.isFinite(b)||new Date(a).toISOString().slice(0,10)!==start||new Date(b).toISOString().slice(0,10)!==end||b<a||b-a>29*86400000)throw Error('여행 기간은 올바른 날짜로 1~30일 이내 입력해 주세요.');return Array.from({length:(b-a)/86400000+1},(_,i)=>new Date(a+i*86400000).toISOString().slice(0,10));}
export function distance(a,b){const r=Math.PI/180;const h=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));}
export const travelModes={transit:'대중교통',driving:'자동차',walking:'도보'};
export const normalizeMode=mode=>Object.hasOwn(travelModes,mode)?mode:'transit';
// Offline estimate boundary: replace this provider with a routing API later.
export function routeEstimate(a,b,mode='transit'){
 mode=normalizeMode(mode);const live=knownRoute(a,b,mode);if(live)return {...live,method:travelModes[mode],minutes:live.minutes+(mode==='driving'?8:0),notice:live.notice+(mode==='driving'?' · 주차 여유 8분 추가':'')};const d=a&&b?distance(a,b):0;
 const minutes=d<.05?0:Math.ceil((mode==='walking'?d*1.25/4.3*60:mode==='driving'?10+d*1.3/30*60:d<1.8?d*1.25/4.3*60:12+d/23*60)/5)*5;
 const method=mode==='transit'&&d<1.8?'가까운 구간 · 도보 연결':travelModes[mode];
 const steps=mode==='walking'?['출발지','도보 이동','도착지']:mode==='driving'?['출발지','차량 이동','주차 후 도보','도착지']:d<1.8?['출발지','도보 이동','도착지']:['출발지','역·정류장까지 도보','철도·버스 이동','목적지까지 도보','도착지'];
 return {mode,method,minutes,steps,distanceKm:d,source:'offline-estimate',notice:'좌표 거리 기반 추정 · 실제 도로·노선·환승은 API 연결 후 제공'};
}
export const travel=(a,b,mode)=>routeEstimate(a,b,mode).minutes;
export const station=city=>({city,lat:stations[city][0],lng:stations[city][1],name:city+' 기준 지점'});
export const isTransport=p=>p.kind==='transport'||(p.locked&&!!p.to);
export const before=p=>isTransport(p)?30:p.locked&&!p.allDay?(p.buffer??15):0;
export const after=p=>isTransport(p)?20:0;
export const endPoint=p=>isTransport(p)?station(p.to):p;
export const windowFor=(config,date)=>config.windows?.[date]||{start:'09:00',end:'20:00'};
export function anchorsFor(config,date){const w=windowFor(config,date);return [...(config.fixed||[]).filter(f=>f.date===date).map(f=>({...f,...station(f.from),name:f.name||'도시 간 이동',uid:f.id,type:'교통',kind:'transport',locked:true,note:`${f.from} → ${f.to} · 출발 전 30분 / 도착 후 20분 여유`})),...(config.visits||[]).filter(f=>f.date===date).map(f=>({...f,uid:f.id,locked:true,kind:'visit',start:f.allDay?w.start:f.start,end:f.allDay?w.end:f.end,note:f.allDay?'하루 전체 · 이동 포함 · 다른 추천을 넣지 않아요':f.note||'미리 정한 방문 · 시작 전 15분 여유'}))].sort((a,b)=>minute(a.start)-minute(b.start));}
export function recommendWindows(config){const result={};for(const [i,date]of dates(config.start,config.end).entries()){let start=config.pace==='slow'?600:540,end=config.pace==='slow'?1080:1200;const anchors=anchorsFor(config,date).filter(x=>!x.allDay);if(anchors.length){const first=anchors[0],last=anchors.at(-1);start=Math.min(start,minute(first.start)-before(first)-travel(station(config.cities[i]),first,config.travelMode));end=Math.max(end,minute(last.end)+after(last));}result[date]={start:clock(Math.max(0,Math.floor(start/15)*15)),end:clock(Math.min(1439,Math.ceil(end/15)*15))};}return result;}
export function validate(config){const days=dates(config.start,config.end);if(config.cities.length!==days.length||config.cities.some(c=>!stations[c]))throw Error('모든 날짜의 도시를 선택해 주세요.');if([...(config.fixed||[]),...(config.visits||[])].some(f=>!days.includes(f.date)))throw Error('여행 기간 밖의 고정 일정이 있습니다. 날짜를 수정하거나 삭제해 주세요.');let previous;
 for(let i=0;i<days.length;i++){const date=days[i],w=windowFor(config,date),a=minute(w.start),b=minute(w.end);if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)throw Error(`${date}: 활동 종료는 시작보다 늦어야 합니다. 당일 일정만 지원합니다.`);let city=config.cities[i];if(previous&&previous!==city)throw Error(`${date}: 전날 도착 도시(${previous})와 다릅니다. 도시 간 이동을 추가해 주세요.`);let pos=station(city),now=a;
 const anchors=anchorsFor(config,date);for(const f of anchors){const start=minute(f.start),end=minute(f.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw Error(`${date}: 고정 일정의 시작·종료 시간을 확인해 주세요.`);if(start<a||end>b)throw Error(`${date}: ${f.name}이 활동시간 밖입니다. 활동시간 추천 또는 직접 수정을 이용해 주세요.`);if(!Number.isFinite(f.lat)||!Number.isFinite(f.lng)||Math.abs(f.lat)>90||Math.abs(f.lng)>180)throw Error(`${f.name}: 올바른 장소 좌표가 필요합니다.`);if(f.allDay&&anchors.length>1)throw Error(`${date}: 하루 전체 일정과 다른 고정 일정이 겹칩니다.`);if(start<now)throw Error(`${date}: 고정 일정 시간이 서로 겹칩니다.`);if(isTransport(f)){if(f.from!==city)throw Error(`${date}: 출발 도시는 ${city}이어야 합니다.`);if(!stations[f.to]||f.from===f.to)throw Error('서로 다른 출발·도착 도시를 선택해 주세요.');}else if(f.city!==city)throw Error(`${date}: ${f.name}의 기준 도시(${f.city})와 현재 도시(${city})가 다릅니다.`);
 const needed=f.allDay?0:travel(pos,f,config.travelMode)+before(f);if(now+needed>start)throw Error(`${date}: ${f.name}까지 이동·대기 시간이 ${now+needed-start}분 부족합니다. 고정 일정 간 간격 또는 활동 시작을 조정해 주세요.`);now=end+after(f);if(now>b)throw Error(`${date}: 도착 후 여유 시간이 활동 종료를 넘습니다. 활동시간을 늘려주세요.`);pos=endPoint(f);if(isTransport(f))city=f.to;}previous=city;}
 return days;}
// Search all orders of at most five suggested stops within one free interval.
// Fixed visits are outside this function and are never moved.
function orderSegment(items,origin,start,until,target,mode){
 let best=null,bestScore=Infinity;
 const walk=(remaining,ordered,pos,now,score)=>{if(score>=bestScore)return;if(!remaining.length){const tail=target?travel(pos,target,mode):0;if(now+tail<=until&&score+tail<bestScore){bestScore=score+tail;best=ordered;}return;}
  for(const [i,p] of remaining.entries()){const move=travel(pos,p,mode),at=p.type==='식사'?Math.max(now+move,660):now+move,end=at+p.duration;if(end+(target?travel(p,target,mode):0)>until)continue;const next={...p,start:clock(at),end:clock(end),move};walk(remaining.filter((_,j)=>i!==j),[...ordered,next],p,end,score+move+distance(pos,p)*8+(at-now-move)*.1+(p.type==='식사'&&at>840?12:0));}
 };walk(items,[],origin,start,0);return best||items;
}
export function generate(config){const days=validate(config),used=new Set((config.visits||[]).flatMap(v=>[v.placeId,v.name]).filter(Boolean));
 const pool=[];for(const p of [...places,...(config.externalPlaces||[])]){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!Number.isFinite(p.duration)||p.duration<=0)continue;if(pool.some(v=>v.id===p.id||(v.city===p.city&&v.name.replace(/\s/g,'')===p.name.replace(/\s/g,''))))continue;pool.push(p);}
 pool.sort((a,b)=>Number(a.type==='식사')-Number(b.type==='식사'));
 const assignment=allocateAreas(config,days,pool.filter(p=>!used.has(p.id)&&!used.has(p.name)),{distance,anchorsFor,windowFor,minute,isTransport});
 return days.map((date,index)=>{const w=windowFor(config,date),anchors=anchorsFor(config,date);let city=config.cities[index],pos=station(city),now=minute(w.start),items=[],count=0,meal=false;const limit=config.pace==='slow'?3:5;
 const fill=(until,target)=>{const segmentIndex=items.length,origin=pos,segmentStart=now;while(count<limit){const candidates=pool.filter(p=>p.city===city&&(!meal||p.type!=='식사')&&assignment.get(p.id)===date&&!used.has(p.id)&&!used.has(p.name)).map(p=>{const move=travel(pos,p,config.travelMode);const start=p.type==='식사'?Math.max(now+move,660):now+move;return {p,move,start};}).filter(({p,move,start})=>start+ p.duration+(target?travel(p,target,config.travelMode):0)<=until).sort((a,b)=>{
  const lunch=now>=660&&now<=840&&!meal;
  const score=x=>x.move+distance(pos,x.p)*8+(target?Math.max(0,travel(x.p,target,config.travelMode)-travel(pos,target,config.travelMode))*.7:0)+(x.start-now-x.move)*.6+(x.p.type==='식사'?(meal?65:lunch?-5:12):0);
  return score(a)-score(b)||distance(pos,a.p)-distance(pos,b.p)||a.p.id.localeCompare(b.p.id);
 });if(!candidates.length)break;const {p,move,start}=candidates[0];now=start;items.push({...p,uid:date+'-'+p.id,start:clock(now),end:clock(now+p.duration),locked:false,kind:'suggestion',move});now+=p.duration;pos=p;used.add(p.id);used.add(p.name);count++;if(p.type==='식사')meal=true;}const ordered=orderSegment(items.slice(segmentIndex),origin,segmentStart,until,target,config.travelMode);items.splice(segmentIndex,items.length-segmentIndex,...ordered);if(ordered.length){pos=ordered.at(-1);now=minute(pos.end);}};
 for(const f of anchors){if(!f.allDay)fill(minute(f.start)-before(f),f);items.push({...f,move:f.allDay?0:travel(pos,f,config.travelMode)});now=minute(f.end)+after(f);pos=endPoint(f);if(isTransport(f))city=f.to;}
 fill(minute(w.end),null);const day={date,city:config.cities[index],window:{...w},travelMode:normalizeMode(config.travelMode),items};day.gaps=freeGaps(day);day.planningNotice=!items.length?'추천할 장소가 부족하거나 활동시간·예약 조건에 맞는 장소가 없습니다. 장소 검색으로 후보를 추가해주세요.':items.filter(p=>!p.locked).length<Math.min(limit,2)&&!anchors.some(p=>p.allDay)?'이날 배정된 지역의 추천 후보가 적습니다. 주변 장소를 검색해 추가할 수 있어요.':'';day.areas=[...new Set(items.map(p=>p.area).filter(Boolean))];return day;});}
export function freeGaps(day){const gaps=[];let now=minute(day.window?.start||'09:00'),pos=station(day.city);for(const p of day.items){const needed=p.allDay?0:travel(pos,p,day.travelMode)+before(p),end=minute(p.start)-needed;if(end-now>=30)gaps.push({start:clock(now),end:clock(end),minutes:end-now});now=minute(p.end)+after(p);pos=endPoint(p);}const end=minute(day.window?.end||'20:00');if(end-now>=30)gaps.push({start:clock(now),end:clock(end),minutes:end-now});return gaps;}
export function warnings(day){const result=[];let now=minute(day.window?.start||'09:00'),pos=station(day.city),name='활동 시작';for(const p of day.items){const a=minute(p.start),b=minute(p.end);if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b){result.push(`${p.name}: 시작·종료 시간을 확인해 주세요.`);continue;}if(a<minute(day.window?.start||'00:00')||b+after(p)>minute(day.window?.end||'23:59'))result.push(`${p.name}: 활동시간 밖의 일정입니다.`);const needed=p.allDay?0:travel(pos,p,day.travelMode)+before(p);if(now+needed>a)result.push(`${name} → ${p.name}: 이동·대기 시간이 ${now+needed-a}분 부족합니다.`);now=b+after(p);pos=endPoint(p);name=p.name;}return result;}
