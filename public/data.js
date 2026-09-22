import {tokyoAreas,tokyoPlaces} from './tokyo-places.js';
import {expandedCatalog} from './catalog-data.js';
export const countries=[...expandedCatalog.countries];
export const stations={...expandedCatalog.stations};
export const cityInfo={...expandedCatalog.cityInfo};
export const places=[...expandedCatalog.places];
export const visitPresets=[...expandedCatalog.visitPresets];
export let catalogSource='bundled';
if(typeof window!=='undefined')try{
 const response=await fetch('/api/catalog',{signal:AbortSignal.timeout(6000)});
 if(response.ok){const data=await response.json();
 if(data.cityInfo&&Array.isArray(data.countries)&&data.countries.length>=countries.length&&data.countries.every(c=>c.id&&Array.isArray(c.cities)&&c.cities.every(city=>Array.isArray(data.stations?.[city])))&&Array.isArray(data.places)&&Array.isArray(data.visitPresets)){
 countries.splice(0,countries.length,...data.countries);Object.assign(stations,data.stations);Object.assign(cityInfo,data.cityInfo);places.splice(0,places.length,...data.places);visitPresets.splice(0,visitPresets.length,...data.visitPresets);catalogSource='database';
 }}
}catch{}

// Apply the curated supplement after either DB or bundled catalog loads.
for(const p of places)if(tokyoAreas[p.id])p.area=tokyoAreas[p.id];
for(const p of tokyoPlaces){if(!places.some(v=>v.id===p.id))places.push(p);if(!visitPresets.some(v=>v.id===p.id))visitPresets.push(p);}
