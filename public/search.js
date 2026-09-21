export const normalize=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,'');
export function searchCountries(countries,query,cityInfo={}){
 const q=normalize(query);if(!q)return [];
 const matches=countries.map(c=>{const names=[c.name,c.en,c.id,...(c.aliases||[])].map(normalize);let rank=names.some(x=>x===q)?0:names.some(x=>x.startsWith(q))?1:99;
 const city=c.cities.find(k=>[k,cityInfo[k]?.name,cityInfo[k]?.en,...(cityInfo[k]?.aliases||[])].some(n=>n&&normalize(n).startsWith(q)));
 if(city&&rank===99)rank=2;return {country:c,rank,city};}).filter(x=>x.rank<99);
 return matches.sort((a,b)=>a.rank-b.rank||a.country.name.localeCompare(b.country.name,'ko'));
}
