"""Rebuild catalog using world-countries 5.1.0, GeoNamescache 3.0.2 and admin1 codes.
Usage: PYTHONPATH=SOURCE/python python scripts/expand-catalog.py SOURCE
Source datasets remain separately licensed; see public/CATALOG-LICENSE.txt.
"""
import sys,json,re,math
from pathlib import Path
import geonamescache
source=Path(sys.argv[1]);base=Path(__file__).resolve().parents[1]
world=json.loads((source/'world-countries/package/countries.json').read_text())
old=json.loads((source/'original-catalog.json').read_text())
admins={p[0]:p[1] for line in (source/'admin1.txt').read_text().splitlines() if len(p:=line.split('\t'))>=2}
gc=geonamescache.GeonamesCache();geo=list(gc.get_cities().values())
bycode={}
for g in geo:bycode.setdefault(g['countrycode'],[]).append(g)
curated=[]
for line in (base/'data/curated-cities.txt').read_text().splitlines():
 if not line or line.startswith('#'):continue
 code,region,city,coord,pois=line.split('|');lat,lng=map(float,coord.split(','));curated.append((code,region,city,lat,lng,pois))
korean_names=json.loads((base/'data/country-names-ko.json').read_text());oldc={r['code']:r['payload'] for r in old};allnames=set();countries=[];stations={};cityInfo={};places=[];presets=[]
krregions={'11':'서울','26':'부산','27':'대구','28':'인천','29':'광주','30':'대전','31':'울산','41':'경기','42':'강원','43':'충북','44':'충남','45':'전북','46':'전남','47':'경북','48':'경남','49':'제주','50':'세종'}
# GeoNames uses its own admin1 codes for Korea.
kradmins={'Seoul':'서울','Busan':'부산','Daegu':'대구','Incheon':'인천','Gwangju':'광주','Daejeon':'대전','Ulsan':'울산','Gyeonggi-do':'경기','Gangwon-do':'강원','Gangwon':'강원','North Chungcheong':'충북','South Chungcheong':'충남','North Jeolla':'전북','South Jeolla':'전남','North Gyeongsang':'경북','South Gyeongsang':'경남','Jeju-do':'제주','Jeju':'제주','Sejong':'세종','Chungcheongnam-do':'충남','Chungcheongbuk-do':'충북','Gyeongsangbuk-do':'경북','Gyeongsangnam-do':'경남','Jeollabuk-do':'전북','Jeollanam-do':'전남'}
for w in sorted(world,key=lambda w: (w['cca2'] not in oldc,list(oldc).index(w['cca2']) if w['cca2'] in oldc else w['cca2'])):
 code=w['cca2'];name=oldc.get(code,{}).get('country',{}).get('name') or korean_names.get(code) or w.get('translations',{}).get('kor',{}).get('common') or w['name']['common']
 country={'id':code,'name':name,'en':w['name']['common'],'lat':w['latlng'][0],'lng':w['latlng'][1],'flag':code,'cities':[],'continent':{'Asia':'아시아','Europe':'유럽','Africa':'아프리카','Americas':'아메리카','Oceania':'오세아니아','Antarctic':'남극'}.get(w['region'],w['region']),'aliases':w.get('altSpellings',[])}
 if code=='KR':country['aliases']+=['한국','남한','South Korea'];country['name']='대한민국'
 if code=='TW':country['name']='대만';country['aliases']+=['타이완']
 def add(city,lat,lng,region='',en='',aliases=[],geoid=None):
  if city in country['cities']:return city
  key=city if city not in allnames else city+' · '+name
  if key in allnames:key+=' · '+region
  allnames.add(key);country['cities'].append(key);stations[key]=[lat,lng];cityInfo[key]={'name':city,'en':en or city,'region':region or '기타 지역','country':code,'aliases':list(dict.fromkeys(aliases))[:12],'geonameId':geoid};return key
 entries=sorted(bycode.get(code,[]),key=lambda g:-g['population']);used=set()
 seeds=[]
 for city,coords in oldc.get(code,{}).get('stations',{}).items():seeds.append((city,*coords,None))
 for cc,region,city,lat,lng,pois in curated:
  if cc==code:
   if any(s[0]==city for s in seeds):seeds=[s for s in seeds if s[0]!=city]
   seeds.append((city,lat,lng,region))
 for city,lat,lng,region in seeds:
  near=min(entries,key=lambda g:(g['latitude']-lat)**2+((g['longitude']-lng)*math.cos(lat*math.pi/180))**2) if entries else None
  if near and ((near['latitude']-lat)**2+(near['longitude']-lng)**2)<.05:
   used.add(near['geonameid']);reg=admins.get(code+'.'+near['admin1code'],'기타 지역');region=region or reg;en=near['name'];aliases=[a for a in near.get('alternatenames',[]) if re.fullmatch('[가-힣 ]+',a)]
  else:en=city;aliases=[]
  key=add(city,lat,lng,region or '주요 도시',en,aliases,near['geonameid'] if near else None)
 # Up to 50 population-ranked cities plus all curated destinations; no invented destinations.
 for g in entries[:50]:
  if g['geonameid'] in used:continue
  hangul=[a for a in g.get('alternatenames',[]) if re.fullmatch('[가-힣 ]+',a)]
  city=hangul[0] if hangul else g['name'];region=admins.get(code+'.'+g['admin1code'],'기타 지역')
  if code=='KR':region=kradmins.get(region,region);city=re.sub('시$','',city)
  if any(abs(stations[k][0]-g['latitude'])<.05 and abs(stations[k][1]-g['longitude'])<.05 for k in country['cities']):continue
  add(city,g['latitude'],g['longitude'],region,g['name'],hangul,g['geonameid'])
 if code=='JP':
  for city,region in [('도쿄','간토'),('교토','간사이'),('오사카','간사이')]:
   if city in cityInfo:cityInfo[city]['region']=region
 for p in oldc.get(code,{}).get('places',[]):places.append(p)
 for p in oldc.get(code,{}).get('visitPresets',[]):
  if p['id'] not in {x['id'] for x in oldc.get(code,{}).get('places',[])}:presets.append(p)
 for cc,region,city,lat,lng,pois in curated:
  if cc!=code:continue
  key=next(k for k in country['cities'] if cityInfo[k]['name']==city)
  for i,entry in enumerate(pois.split(';')):
   pname,coord=entry.split('@');la,lo=map(float,coord.split(','))
   if any(p['city']==key and p['name']==pname for p in places):continue
   food=any(x in pname for x in ['시장','마켓','식당가','골목'])
   places.append({'id':code+'-'+key+'-curated-'+str(i),'city':key,'name':pname,'lat':la,'lng':lo,'duration':60 if food else 75,'type':'식사' if food else '관광','note':'좌표·체류시간은 계획용 근삿값 · 운영시간·예약 별도 확인'})
 countries.append(country)
# Normalize all Korean regions to the 17 administrative areas, retaining city names.
for k,m in cityInfo.items():
 if m['country']=='KR':
  r=m['region'];m['region']=next((v for key,v in kradmins.items() if key.lower() in r.lower()),kradmins.get(r,r))
result={'countries':countries,'stations':stations,'cityInfo':cityInfo,'places':places,'visitPresets':presets+places}
(base/'public/catalog-data.js').write_text('export const expandedCatalog='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
rows=[{'code':c['id'],'sort_order':i,'payload':{'country':c,'stations':{k:stations[k] for k in c['cities']},'cityInfo':{k:cityInfo[k] for k in c['cities']},'places':[p for p in places if p['city'] in c['cities']],'visitPresets':[p for p in presets+places if p['city'] in c['cities']]}} for i,c in enumerate(countries)]
(base/'data/catalog.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'countries':len(countries),'selectableCountries':sum(bool(c['cities']) for c in countries),'cities':len(stations),'places':len(places),'citiesWithPlaces':len(set(p['city'] for p in places)),'koreaRegions':sorted(set(m['region'] for m in cityInfo.values() if m['country']=='KR'))},ensure_ascii=False))
