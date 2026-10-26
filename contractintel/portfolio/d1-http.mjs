// Node runner adapter. Values remain bound parameters; a publication is one HTTP batch, never a loop.
import {CONFIG} from './ingest.mjs';
export function createHttpD1({account,database,token,fetcher=fetch,interval=CONFIG.d1IntervalMs,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!/^[a-f0-9]{32}$/.test(account)||!/^[a-f0-9-]{36}$/.test(database)||!token)throw new Error('D1 HTTP credentials or identifiers are missing.');
 const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+database+'/query';let queue=Promise.resolve(),next=0;
 const execute=async body=>{
  const turn=queue.then(async()=>{const delay=Math.max(0,next-now());if(delay)await sleep(delay);next=now()+interval;});queue=turn.catch(()=>{});await turn;
  let response;try{response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(CONFIG.d1HttpTimeoutMs)});}catch{throw new Error('D1 HTTP connection failed; write outcome may be unknown. No automatic write replay.');}
  let data;try{data=await response.json();}catch{throw new Error('D1 HTTP returned an unreadable response; no automatic write replay.');}
  if(!response.ok||!data.success||!Array.isArray(data.result)||data.result.some(r=>!r.success))throw new Error('D1 HTTP query failed: '+response.status+'; codes '+(data.errors||[]).map(e=>e.code).join(','));
  return data.result;
 };
 const prepare=sql=>{const statement=params=>({sql,params,bind:(...args)=>statement(args),all:async()=>(await execute({sql,params}))[0],run:async()=>(await execute({sql,params}))[0],first:async()=>((await execute({sql,params}))[0].results||[])[0]||null});return statement([]);};
 return {prepare,batch:statements=>execute({batch:statements.map(s=>({sql:s.sql,params:s.params}))})};
}
export async function verifyAtomicBatch(db){
 const key=crypto.randomUUID();
 await db.prepare('CREATE TABLE IF NOT EXISTS _portfolio_atomicity_probe(probe_key TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1))').run();
 let failed=false;try{await db.batch([db.prepare('INSERT INTO _portfolio_atomicity_probe VALUES(?,1)').bind(key),db.prepare('INSERT INTO _portfolio_atomicity_probe VALUES(?,0)').bind(key+'-invalid')]);}catch{failed=true;}
 const row=await db.prepare('SELECT count(*) n FROM _portfolio_atomicity_probe WHERE probe_key=?').bind(key).first();
 if(!failed||row.n!==0)throw new Error('D1 HTTP batch rollback check failed. Ingestion is disabled.');
 await db.prepare('DROP TABLE _portfolio_atomicity_probe').run();return {atomic_batch_rollback:'passed'};
}
