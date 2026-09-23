import {readFile} from 'node:fs/promises';
const seed=JSON.parse(await readFile(new URL('./data/hotels.json',import.meta.url),'utf8'));
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export function searchHotels(rows,{q,country,lat,lng}){
 const query=normalize(q);if(!query)return [];
 const rad=Math.PI/180;
 return rows.filter(h=>h.country===country.toUpperCase()&&[h.name,h.address,...h.aliases].some(v=>normalize(v).includes(query)))
 .map(h=>({...h,distanceKm:6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin((h.lat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(h.lat*rad)*Math.sin((h.lng-lng)*rad/2)**2)))}))
 .filter(h=>h.distanceKm<=30).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,20)
 .map(h=>({id:h.id,name:h.name,address:h.address,lat:h.lat,lng:h.lng,city:h.city,source:'orbittrip-catalog',sourceUrl:h.sourceUrl,verifiedAt:h.verifiedAt}));
}
export function createHotelSearch(store){
 let snapshot=seed,expires=0;
 return async args=>{
  if(store&&Date.now()>expires){expires=Date.now()+300000;try{const rows=await store.hotels();snapshot=[...rows,...seed.filter(h=>!rows.some(r=>r.id===h.id))];}catch{snapshot=seed;}}
  return searchHotels(snapshot,args);
 };
}
