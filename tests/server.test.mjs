import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
test('production protects assets and API; health remains public',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3018',NODE_ENV:'production',APP_USER:'test',APP_PASSWORD:'test-secret',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 try{await new Promise((ok,no)=>{child.stdout.once('data',ok);child.once('exit',()=>no(Error('Server exited')));child.once('error',no);});
 for(const path of ['/','/app.js','/api/storage','/api/drafts/JP'])assert.equal((await fetch('http://localhost:3018'+path)).status,401);
 assert.equal((await fetch('http://localhost:3018/health')).status,200);
 const headers={Authorization:'Basic '+Buffer.from('test:test-secret').toString('base64')};
 assert.equal((await fetch('http://localhost:3018/',{headers})).status,200);
 assert.deepEqual(await(await fetch('http://localhost:3018/api/storage',{headers})).json(),{enabled:false});
 assert.equal((await fetch('http://localhost:3018/api/drafts/JP',{headers})).status,503);
 }finally{child.kill();}
});
test('public access opens pages but cannot expose private drafts',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3019',NODE_ENV:'production',PUBLIC_ACCESS:'true',APP_USER:'test',APP_PASSWORD:'test-secret',DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 try{await new Promise((ok,no)=>{child.stdout.once('data',ok);child.once('exit',()=>no(Error('Server exited')));child.once('error',no);});
 for(const path of ['/','/app.js'])assert.equal((await fetch('http://localhost:3019'+path)).status,200);
 assert.deepEqual(await(await fetch('http://localhost:3019/api/storage')).json(),{enabled:false});
 for(const method of ['GET','PUT']){const r=await fetch('http://localhost:3019/api/drafts/JP',{method});assert.equal(r.status,401);assert.equal(r.headers.get('www-authenticate'),null);}
 }finally{child.kill();}
});
