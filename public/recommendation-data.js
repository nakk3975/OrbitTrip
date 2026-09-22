import {places,stations} from './data.js';
import {dates,distance,anchorsFor,windowFor,minute} from './engine.js';
// Explicit generation only: cap one preparation at eight requests, reuse saved results.
export async function prepareRecommendations(config,progress=()=>{},{fetcher=fetch}={}){
 const extra=[...(config.externalPlaces||[])],notices=[];let status=null,requests=0;
 const needs=new Map();for(const [i,date] of dates(config.start,config.end).entries()){if(anchorsFor(config,date).some(a=>a.allDay))continue;const w=windowFor(config,date),count=Math.min(config.pace==='slow'?3:5,Math.max(1,Math.floor((minute(w.end)-minute(w.start))/100)));const city=config.cities[i];needs.set(city,(needs.get(city)||0)+count);}
 for(const f of config.fixed||[])needs.set(f.to,(needs.get(f.to)||0)+2);
 for(const [city,need] of needs){const current=()=>[...places,...extra].filter(p=>p.city===city&&!config.visits?.some(v=>v.placeId===p.id||v.name===p.name));const capacity=()=>current().filter(p=>p.type!=='식사').length+Math.min(Math.ceil(need/5),current().filter(p=>p.type==='식사').length);if(capacity()>=need)continue;
  if(status===null){try{const r=await fetcher('/api/geo/status',{signal:AbortSignal.timeout(8000)});status=r.ok&&(await r.json()).enabled;}catch{status=false;}}
  if(!status){notices.push(`${city}: 추가 장소 조회를 이용할 수 없어 저장된 후보로 계획했습니다.`);continue;}
  const [lat,lng]=stations[city],centers=[{lat,lng}];for(const p of [...(config.visits||[]).filter(p=>p.city===city),...current()])if(centers.length<4&&centers.every(c=>distance(c,p)>2.5))centers.push(p);
  // If there are no local landmarks yet, search additional nearby districts.
  for(const [dy,dx] of [[.035,0],[0,.045],[-.035,0]])if(centers.length<4)centers.push({lat:Math.max(-85,Math.min(85,lat+dy)),lng:Math.max(-180,Math.min(180,lng+dx))});
  for(const center of centers){if(capacity()>=need||requests>=8)break;
   for(const kind of ['sights','food']){if(requests>=8)break;requests++;progress(`${city}의 ${kind==='sights'?'관광지':'주변 음식점'} 후보를 확보하고 있어요…`);
    try{const params=new URLSearchParams({lat:center.lat,lng:center.lng,radius:'7000',kind,recommendations:'1'}),r=await fetcher('/api/geo/places?'+params,{signal:AbortSignal.timeout(20000)});const body=await r.json();if(!r.ok)throw Error(body.error||'조회 실패');for(const p of body.places||[]){if(!p.id||!p.name||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!Number.isFinite(p.duration)||p.duration<=0)continue;const existing=current();if(existing.some(v=>v.id===p.id||v.name.replace(/\s/g,'')===p.name.replace(/\s/g,'')||distance(v,p)<.07&&v.type===p.type))continue;extra.push({...p,city});}}
    catch{notices.push(`${city}: 일부 장소를 가져오지 못해 확보된 후보로 계획했습니다.`);break;}
   }
  }
  if(capacity()<need)notices.push(`${city}: ${need}곳 목표 중 후보 ${current().length}곳을 확보했습니다. 부족한 날짜는 장소를 직접 추가해주세요.`);
 }
 return {places:extra,notices:[...new Set(notices)]};
}
