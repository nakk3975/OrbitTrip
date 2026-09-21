import pg from 'pg';
export function createStore(connectionString){
 const pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000});
 pool.on('error',()=>console.error('Idle database connection failed'));
 async function transaction(owner,fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('app.owner_id',$1,true)",[owner]);const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}
 return {
  async get(owner,country){return transaction(owner,async c=>(await c.query('SELECT payload, revision FROM orbittrip.draft WHERE owner_id=$1 AND country=$2',[owner,country])).rows[0]||null);},
  async put(owner,country,payload,revision){return transaction(owner,async c=>{const result=revision===0?await c.query('INSERT INTO orbittrip.draft(owner_id,country,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING revision',[owner,country,payload]):await c.query('UPDATE orbittrip.draft SET payload=$3,revision=revision+1,updated_at=now() WHERE owner_id=$1 AND country=$2 AND revision=$4 RETURNING revision',[owner,country,payload,revision]);return result.rows[0]||null;});},
  catalog:async()=>{const {rows}=await pool.query('SELECT payload FROM orbittrip.catalog_country ORDER BY sort_order,code');return rows.map(r=>r.payload);},
  close:()=>pool.end()
 };
}
