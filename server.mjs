import http from 'node:http';
import {gzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {createGeo} from './geo.mjs';
const geo=createGeo();
import {createStore} from './db.mjs';
const store=process.env.DATABASE_URL?createStore(process.env.DATABASE_URL):null;
const publicAccess=process.env.PUBLIC_ACCESS==='true';
let catalogCache=null,catalogCachedAt=0;
const root=path.resolve('public'),port=Number(process.env.PORT||3000),local=process.env.NODE_ENV!=='production';
if(!local&&(!process.env.APP_USER||!process.env.APP_PASSWORD)){throw Error('Production requires APP_USER and APP_PASSWORD; refusing public access.');}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");if(req.url==='/health'){res.writeHead(200);res.end('ok');return;}const expected='Basic '+Buffer.from(process.env.APP_USER+':'+process.env.APP_PASSWORD).toString('base64');const authenticated=!!process.env.APP_USER&&!!process.env.APP_PASSWORD&&equal(req.headers.authorization||'',expected);if(!local&&!publicAccess&&!authenticated){res.writeHead(401,{'WWW-Authenticate':'Basic realm="OrbitTrip Private", charset="UTF-8"'});res.end('Private OrbitTrip');return;}
try{
 const apiPath=new URL(req.url,'http://localhost').pathname;
 if(apiPath.startsWith('/api/')){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  const reply=(status,data)=>{let body=Buffer.from(JSON.stringify(data));if(body.length>2048&&req.headers['accept-encoding']?.includes('gzip')){body=gzipSync(body);res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');}res.writeHead(status);res.end(body);};
  if(await geo(req,res,new URL(req.url,'http://localhost'),reply))return;
  if(apiPath==='/api/catalog'&&req.method==='GET'){
   if(!store){reply(503,{error:'Catalog unavailable'});return;}
   if(!catalogCache||Date.now()-catalogCachedAt>300000){const rows=await store.catalog();if(!rows.length){reply(503,{error:'Catalog empty'});return;}catalogCache={countries:rows.map(r=>r.country),stations:Object.assign({},...rows.map(r=>r.stations)),cityInfo:Object.assign({},...rows.map(r=>r.cityInfo||{})),places:rows.flatMap(r=>r.places),visitPresets:rows.flatMap(r=>r.visitPresets)};catalogCachedAt=Date.now();}
   reply(200,catalogCache);return;
  }
  if(apiPath==='/api/storage'&&req.method==='GET'){reply(200,{enabled:!!store&&(!publicAccess||authenticated)});return;}
  if(publicAccess&&!authenticated){reply(401,{error:'개인 서버 일정은 인증이 필요합니다. 브라우저 저장을 이용해주세요.'});return;}
  if(!store){reply(503,{error:'서버 저장이 연결되지 않았습니다.'});return;}
  const match=apiPath.match(/^\/api\/drafts\/(JP|KR|FR|IT|GB|ES|DE|CH|US|CA|AU|NZ|TH|VN|SG|TW)$/);
  if(!match){reply(404,{error:'Not found'});return;}
  const owner=process.env.APP_USER||'local-owner',country=match[1];
  if(req.method==='GET'){reply(200,(await store.get(owner,country))||{payload:null,revision:0});return;}
  if(req.method!=='PUT'){reply(405,{error:'Method not allowed'});return;}
  if(!req.headers['content-type']?.startsWith('application/json')||req.headers['x-orbittrip-request']!=='1'){reply(403,{error:'Invalid request'});return;}
  let body='',bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>1024*1024){reply(413,{error:'일정 크기는 1MB 이하여야 합니다.'});return;}body+=chunk;}
  let data;try{data=JSON.parse(body);}catch{reply(400,{error:'Invalid JSON'});return;}
  if(!data.payload||data.payload.country!==country||!Array.isArray(data.payload.plan)||!Number.isSafeInteger(data.revision)||data.revision<0){reply(400,{error:'잘못된 일정 형식입니다.'});return;}
  try{const saved=await store.put(owner,country,data.payload,data.revision);reply(saved?200:409,saved||{error:'서버 일정이 변경됐습니다. 서버에서 불러온 뒤 다시 저장해주세요.'});}catch{reply(503,{error:'서버 저장에 실패했습니다. 브라우저 일정은 유지됩니다.'});}return;
 }
 if(['/vendor/leaflet.js','/vendor/leaflet.css'].includes(apiPath)){const name=apiPath.split('/').at(-1);const body=await readFile(path.resolve('node_modules/leaflet/dist',name));res.writeHead(200,{'Content-Type':name.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'public, max-age=86400'});res.end(body);return;}
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();let body=await readFile(file);if(body.length>2048&&req.headers['accept-encoding']?.includes('gzip')){body=gzipSync(body);res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');}const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type+(type.startsWith('image/')?'':'; charset=utf-8'),'Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(req.url.startsWith('/api/')?503:404);res.end('Request failed');}}).listen(port,'0.0.0.0',()=>console.log('OrbitTrip ready on port '+port));
