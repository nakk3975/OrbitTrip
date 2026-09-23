import test from 'node:test';
import assert from 'node:assert/strict';
import {createHotelSearch} from '../hotels.mjs';
import {createGeo} from '../geo.mjs';
test('curated hotels match local and foreign aliases within chosen country and city radius',async()=>{
 const search=createHotelSearch(null);
 assert.equal((await search({q:'아늑',country:'KR',lat:37.5665,lng:126.978}))[0].id,'kr-anook-sinchon');
 for(const q of ['APA','아파','アパホテル','APA Hotel'])assert.equal((await search({q,country:'JP',lat:35.6895,lng:139.6917})).length,3);
 assert.equal((await search({q:'APA',country:'KR',lat:37.5665,lng:126.978})).length,0);
 assert.equal((await search({q:'APA',country:'JP',lat:34.6937,lng:135.5023})).length,0);
});
test('registered hotel lookup works without external API key and survives DB outage',async()=>{
 let databaseCalls=0,upstreamCalls=0;
 const search=createHotelSearch({hotels:async()=>{databaseCalls++;throw Error('offline');}});
 const handle=createGeo({key:'',hotelSearch:search,fetcher:()=>upstreamCalls++});let result;
 await handle({method:'GET'},{},new URL('http://localhost/api/geo/location?kind=hotel&country=KR&lat=37.5665&lng=126.978&q='+encodeURIComponent('아늑')),(status,body)=>result={status,body});
 assert.equal(result.status,200);assert.equal(result.body.places.length,1);assert.equal(upstreamCalls,0);
 await search({q:'아늑',country:'KR',lat:37.5665,lng:126.978});assert.equal(databaseCalls,1);
});
