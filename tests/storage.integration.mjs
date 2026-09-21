import assert from 'node:assert/strict';
import {createStore} from '../db.mjs';
const store=createStore(process.env.DATABASE_URL),owner='verify-'+Date.now();
try{
 assert.equal(await store.get(owner,'JP'),null);
 const payload={country:'JP',plan:[],test:true};
 assert.equal((await store.put(owner,'JP',payload,0)).revision,1);
 assert.deepEqual((await store.get(owner,'JP')).payload,payload);
 assert.equal(await store.get(owner+'-other','JP'),null);
 assert.equal(await store.put(owner,'JP',payload,0),null);
 assert.equal((await store.put(owner,'JP',payload,1)).revision,2);
 assert.equal(await store.put(owner,'JP',payload,1),null);
 console.log('PASS Neon: write/read, owner isolation, stale revision rejection. Test owner: '+owner);
}finally{await store.close();}
