// Geoapify gateway: fixed upstream endpoints only; keys never leave the server.
export function createGeo({key=process.env.GEOAPIFY_API_KEY,fetcher=fetch,now=Date.now,hotelSearch=null}={}) {
 const cache=new Map(),pending=new Map();let bytes=0,nextSlot=0,day='',spent=0;
 const fail=(status,message)=>Object.assign(new Error(message),{status});
 function number(params,name,min,max){const raw=params.get(name);const n=raw===null||raw.trim()===''?NaN:Number(raw);if(!Number.isFinite(n)||n<min||n>max)throw fail(400,'올바른 위치와 조회 범위를 입력해주세요.');return n;}
 function trim(s,max=200){return typeof s==='string'?s.slice(0,max):'';}
 async function upstream(path,params,binary=false,cost=1){
  if(!key)throw fail(503,'장소·지도 서비스가 아직 설정되지 않았습니다.');
  const qs=new URLSearchParams(params),id=path+'?'+qs;
  const cached=cache.get(id);if(cached&&cached.until>now())return cached.value;
  if(pending.has(id))return pending.get(id);
  if(pending.size>=24)throw fail(429,'조회가 많습니다. 잠시 후 다시 시도해주세요.');
  const date=new Date(now()).toISOString().slice(0,10);if(day!==date){day=date;spent=0;}
  if(spent+cost>2000)throw fail(429,'오늘의 외부 조회 한도에 도달했습니다. 저장된 장소로 계속 계획할 수 있습니다.');spent+=cost;
  const task=(async()=>{const wait=Math.max(0,nextSlot-now());nextSlot=Math.max(now(),nextSlot)+300;await new Promise(r=>setTimeout(r,wait));qs.set('apiKey',key);
   let response;try{response=await fetcher('https://api.geoapify.com'+path+'?'+qs,{signal:AbortSignal.timeout(12000),redirect:'error'});}catch{throw fail(503,'외부 지도 서비스 연결이 지연됩니다. 잠시 후 다시 시도해주세요.');}
   if(!response.ok)throw fail(response.status===429?429:503,response.status===429?'외부 서비스 조회 한도에 도달했습니다. 잠시 후 다시 시도해주세요.':'외부 지도 서비스에서 결과를 가져오지 못했습니다.');
   let value;try{value=binary?Buffer.from(await response.arrayBuffer()):await response.json();}catch{throw fail(502,'지도 응답을 처리하지 못했습니다.');}
   const size=binary?value.length:Buffer.byteLength(JSON.stringify(value));
   if(size>4*1024*1024)throw fail(502,'지도 응답이 너무 큽니다.');
   const previous=cache.get(id);if(previous){bytes-=previous.size;cache.delete(id);}while(cache.size&&(bytes+size>32*1024*1024||cache.size>=1000)){const first=cache.keys().next().value;bytes-=cache.get(first).size;cache.delete(first);}
   cache.set(id,{value,size,until:now()+(binary?86400000:3600000)});bytes+=size;return value;
  })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }
 return async function handle(req,res,url,reply){
  if(!url.pathname.startsWith('/api/geo/'))return false;
  try{
   if(req.method!=='GET')throw fail(405,'GET 요청만 지원합니다.');
   const p=url.searchParams;
   if(url.pathname==='/api/geo/status'){reply(200,{enabled:!!key,provider:'Geoapify',modes:['driving','walking']});return true;}
   if(url.pathname==='/api/geo/location'){
    const lat=number(p,'lat',-85,85),lng=number(p,'lng',-180,180),q=(p.get('q')||'').trim(),country=(p.get('country')||'').toLowerCase();
    if(q.length<2||q.length>200||!/^[a-z]{2}$/.test(country))throw fail(400,'검색어와 국가를 확인해주세요.');
    const kind=p.get('kind')||'address';if(!['address','hotel'].includes(kind))throw fail(400,'검색 방법을 확인해주세요.');
    if(kind==='hotel'&&hotelSearch){
     const places=await hotelSearch({q,country,lat,lng});
     if(places.length){reply(200,{places,attribution:'OrbitTrip 등록 숙소 · 공식 지점 정보 / Geoapify · OpenStreetMap',notice:'등록 숙소 결과입니다. 주소와 예약 내역을 확인해주세요.'});return true;}
    }
    let rows=[];
    const apa=country==='jp'&&/^(apa(?:\s*hotel)?|아파(?:\s*호텔)?|アパホテル)$/i.test(q);
    const queries=apa?[q,...['APA','アパホテル'].filter(v=>v.toLowerCase()!==q.toLowerCase())]:[q];
    let partial=false;
    const responses=await Promise.allSettled((kind==='hotel'?queries:[q]).map(async query=>{
     const data=kind==='hotel'?await upstream('/v2/places',{categories:'accommodation',name:query,filter:`circle:${lng},${lat},30000`,bias:`proximity:${lng},${lat}`,limit:'20',lang:'ko'},false,2):await upstream('/v1/geocode/search',{text:query,bias:`proximity:${lng},${lat}`,filter:`countrycode:${country}`,limit:'8',lang:'ko',format:'json'});
     return kind==='hotel'?(data.features||[]).map(f=>f.properties||{}):data.results||[];
    }));
    if(responses.every(r=>r.status==='rejected'))throw responses[0].reason;
    for(const r of responses){if(r.status==='fulfilled')rows.push(...r.value);else partial=true;}
    const places=[];
    for(const v of rows){
     if(!Number.isFinite(v.lat)||!Number.isFinite(v.lon)||Math.abs(v.lat)>85||Math.abs(v.lon)>180||(v.country_code&&v.country_code.toLowerCase()!==country))continue;
     const name=trim(v.name||v.address_line1||v.formatted,120);
     if(kind==='hotel'&&apa&&!/(?:^|[^a-z])apa(?:[^a-z]|$)|アパ|아파/i.test(name))continue;
     if(places.some(p=>Math.abs(p.lat-v.lat)<.0001&&Math.abs(p.lng-v.lon)<.0001))continue;
     places.push({name,address:trim(v.formatted,300),lat:v.lat,lng:v.lon});
    }
    reply(200,{places,...(partial?{notice:'일부 검색만 완료했습니다. 잠시 후 다시 검색해주세요.'}:{}),attribution:'Powered by Geoapify · © OpenStreetMap contributors'});return true;
   }
   if(url.pathname==='/api/geo/places'){
    const lat=number(p,'lat',-85,85),lng=number(p,'lng',-180,180),radius=number(p,'radius',1000,30000),kind=p.get('kind')||'sights',q=(p.get('q')||'').trim();
    const categories={sights:'tourism.sights,tourism.attraction,entertainment.museum',food:'catering.restaurant',cafe:'catering.cafe'};
    if(!categories[kind]||q.length>80)throw fail(400,'검색 조건을 확인해주세요.');
    const recommendations=p.get('recommendations')==='1';
    const args={categories:recommendations&&kind==='sights'?'tourism.sights,entertainment.museum,entertainment.aquarium,leisure.park':categories[kind],filter:`circle:${lng},${lat},${radius}`,bias:`proximity:${lng},${lat}`,limit:recommendations&&kind==='sights'?'40':'20',lang:'ko'};if(q)args.name=q;
    const data=await upstream('/v2/places',args,false,2);
    const places=(data.features||[]).map(f=>f.properties||{}).filter(v=>v.name&&Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&(!recommendations||!(v.categories||[]).some(c=>c.startsWith('tourism.sights.memorial')))).map(v=>({id:'geo-'+trim(v.place_id,400),name:trim(v.name,120),lat:v.lat,lng:v.lon,address:trim(v.formatted,300),type:kind==='food'?'식사':kind==='cafe'?'카페':'관광',duration:kind==='cafe'?45:60,source:'geoapify',note:'Geoapify / OpenStreetMap · 체류시간은 계획용 제안입니다.'}));
    reply(200,{places,attribution:'Powered by Geoapify · © OpenStreetMap contributors'});return true;
   }
   if(url.pathname==='/api/geo/route'){
    const a={lat:number(p,'fromLat',-85,85),lng:number(p,'fromLng',-180,180)},b={lat:number(p,'toLat',-85,85),lng:number(p,'toLng',-180,180)},mode=p.get('mode');
    if(!['driving','walking'].includes(mode))throw fail(422,'대중교통 노선·시간표는 지원하지 않습니다. 외부 지도에서 확인해주세요.');
    const rad=Math.PI/180,h=Math.sin((a.lat-b.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((a.lng-b.lng)*rad/2)**2;
    if(6371*2*Math.asin(Math.min(1,Math.sqrt(h)))>500)throw fail(422,'500km를 넘는 구간은 예약 교통편으로 직접 입력해주세요.');
    const data=await upstream('/v1/routing',{waypoints:`${a.lat},${a.lng}|${b.lat},${b.lng}`,mode:mode==='driving'?'drive':'walk',details:'instruction_details',format:'geojson',lang:'en'},false,4);
    const f=data.features?.[0],v=f?.properties;
    if(!v||!Number.isFinite(v.time)||!Number.isFinite(v.distance)||!['LineString','MultiLineString'].includes(f.geometry?.type))throw fail(404,'연결 가능한 경로를 찾지 못했습니다.');
    reply(200,{mode,source:'geoapify',minutes:Math.ceil(v.time/60),distanceKm:Math.round(v.distance/10)/100,geometry:f.geometry,steps:(v.legs||[]).flatMap(l=>l.steps||[]).map(s=>trim(s.instruction?.text,250)).filter(Boolean).slice(0,60),notice:'도로·보행망 기반 예상 시간 · 실시간 교통, 주차·휴식 시간 제외'});return true;
   }
   const tile=url.pathname.match(/^\/api\/geo\/tiles\/(\d{1,2})\/(\d+)\/(\d+)\.png$/);
   if(tile){const [z,x,y]=tile.slice(1).map(Number);if(z<2||z>18||x>=2**z||y>=2**z)throw fail(400,'잘못된 지도 범위입니다.');const image=await upstream(`/v1/tile/dark-matter/${z}/${x}/${y}.png`,{},true);res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});res.end(image);return true;}
   throw fail(404,'Not found');
  }catch(e){reply(e.status||503,{error:e.status?e.message:'외부 지도 정보를 불러오지 못했습니다.'});return true;}
 };
}
