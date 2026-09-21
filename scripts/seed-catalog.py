"""Seed the catalog atomically using Neon's SQL-over-HTTP endpoint.
DATABASE_URL_ADMIN must be supplied securely (never commit it).
"""
import os,json,urllib.request,urllib.parse
from pathlib import Path
uri=os.environ['DATABASE_URL_ADMIN']
host=urllib.parse.urlparse(uri).hostname
rows=json.loads((Path(__file__).resolve().parents[1]/'data/catalog.json').read_text())
query="""INSERT INTO orbittrip.catalog_country(code,name,sort_order,payload)
SELECT x->>'code',x->'payload'->'country'->>'name',(x->>'sort_order')::integer,x->'payload'
FROM jsonb_array_elements($1::jsonb) AS x
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order,payload=EXCLUDED.payload
RETURNING code"""
req=urllib.request.Request('https://'+host+'/sql',data=json.dumps({'query':query,'params':[json.dumps(rows,ensure_ascii=False)]}).encode(),headers={'Neon-Connection-String':uri,'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=60) as r:
 result=json.loads(r.read());print('Seeded catalog countries/territories:',result['rowCount'])
