import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {reserveAutomaticBatch,finishAutomaticBatch} from '../portfolio/queue/controller.mjs';
import {dispatchAutomaticQueue} from '../portfolio/queue/dispatch.mjs';
import {automaticProfile} from '../portfolio/queue/profile.mjs';
import {CONFIG} from '../portfolio/ingest.mjs';
const now=Date.parse('2026-10-28T14:00:00Z');
async function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec("CREATE TABLE offices(dodaac TEXT PRIMARY KEY); INSERT INTO offices VALUES('N00024'),('N00019'); CREATE TABLE office_publications(office_dodaac TEXT PRIMARY KEY,published_run_id TEXT); CREATE TABLE portfolio_publication_receipts(publication_id TEXT PRIMARY KEY,office_dodaac TEXT,status TEXT,comparison_json TEXT); CREATE TABLE ingest_dispatches(dispatch_key TEXT PRIMARY KEY,request_id TEXT,started_at TEXT,lease_until TEXT,status TEXT,accepted_at TEXT,http_status INTEGER);");
 for(const file of ['0005.sql','0006.sql'])sqlite.exec(await fs.readFile(new URL('../portfolio/migrations/'+file,import.meta.url),'utf8'));
 sqlite.exec("INSERT INTO portfolio_rollout_jobs(office_dodaac,origin,priority,requested_at,updated_at) VALUES('N00024','seed',1,'now','now'),('N00019','seed',2,'now','now');");
 const prepare=sql=>{const wrap=params=>({sql,params,bind:(...args)=>wrap(args),first:async()=>sqlite.prepare(sql).get(...params)||null,all:async()=>({results:sqlite.prepare(sql).all(...params),meta:{size_after:1000}}),run:async()=>({meta:{changes:sqlite.prepare(sql).run(...params).changes}})});return wrap([]);};
 const db={prepare,sqlite,batch:async statements=>{sqlite.exec('BEGIN');try{const result=statements.map(s=>({meta:{changes:sqlite.prepare(s.sql).run(...s.params).changes}}));sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 db.approve=()=>{
  sqlite.exec("INSERT INTO office_publications VALUES('FA4800','verified'); INSERT INTO portfolio_publication_receipts VALUES('verified','FA4800','published','{\"match\":true}');");
  sqlite.prepare('UPDATE portfolio_rollout_control SET review_json=?').run(JSON.stringify({fa4800_publication_version:'verified',costs_reviewed:true,baseline_r2_bytes:1000}));
 };
 return db;
}
test('No cost review or matching independent FA4800 receipt means no reservation or source work',async()=>{
 const db=await fixture();
 assert.equal((await reserveAutomaticBatch(db,{now})).decision,'awaiting_fa4800_and_cost_review');
 db.sqlite.prepare('UPDATE portfolio_rollout_control SET review_json=?').run('{}');
 assert.equal((await reserveAutomaticBatch(db,{now})).decision,'awaiting_fa4800_validation');
 assert.equal(db.sqlite.prepare('SELECT attempts FROM portfolio_rollout_jobs LIMIT 1').get().attempts,0);
 db.sqlite.close();
});
test('Concurrent reservations allow one job and reserve its budget exactly once',async()=>{
 const db=await fixture();db.approve();
 const results=await Promise.all([reserveAutomaticBatch(db,{now,id:'first'}),reserveAutomaticBatch(db,{now,id:'second'})]);
 assert.equal(results.filter(r=>r.decision==='reserved').length,1);
 assert.equal(db.sqlite.prepare('SELECT source_requests FROM portfolio_rollout_days').get().source_requests,CONFIG.r2Nightly.maxSourceRequestsPerJob);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM portfolio_rollout_jobs WHERE lease_id IS NOT NULL').get().n,1);
 assert.equal((await reserveAutomaticBatch(db,{now:now+CONFIG.rollout.queueLeaseMs+1})).decision,'reconciliation_required');
 db.sqlite.close();
});
test('Yield refunds unused budget, preserves checkpoint and resumes the same office',async()=>{
 const db=await fixture();db.approve();
 const {claim}=await reserveAutomaticBatch(db,{now});
 await finishAutomaticBatch(db,claim,{office:claim.office,status:'yielded',source_requests:50,chunks:[{status:'prepared'}]},{now:now+1000});
 assert.equal(db.sqlite.prepare('SELECT source_requests FROM portfolio_rollout_days').get().source_requests,50);
 const next=await reserveAutomaticBatch(db,{now:now+2000});
 assert.equal(next.claim.office,claim.office);
 assert.equal(db.sqlite.prepare('SELECT reserved_r2_bytes FROM portfolio_rollout_control').get().reserved_r2_bytes,CONFIG.r2Nightly.maxBucketBytes);
 await assert.rejects(finishAutomaticBatch(db,claim,{office:claim.office,status:'yielded',source_requests:1},{now:now+3000}));
 db.sqlite.close();
});
test('Ready needs admitted cache and matching D1 version; failed publication cannot advance queue',async()=>{
 const db=await fixture();db.approve();const {claim}=await reserveAutomaticBatch(db,{now});
 const report={office:claim.office,status:'passed',source_requests:25,d1_publication_version:'new',read_enabled:true};
 await assert.rejects(finishAutomaticBatch(db,claim,report,{now:now+1000}));
 db.sqlite.prepare('INSERT INTO office_publications VALUES(?,?)').run(claim.office,'new');
 db.sqlite.prepare('INSERT INTO portfolio_publication_receipts VALUES(?,?,?,?)').run('new',claim.office,'published','{"match":true}');
 await finishAutomaticBatch(db,claim,report,{now:now+1000});
 const next=await reserveAutomaticBatch(db,{now:now+2000});assert.equal(next.claim.office,'N00019');
 db.sqlite.close();
});
test('Daily work and storage caps stop a new reservation; terminal failures pause the queue',async()=>{
 const db=await fixture();db.approve();
 db.sqlite.prepare('INSERT INTO portfolio_rollout_days VALUES(?,?,?)').run('2026-10-28',CONFIG.queue.maxDailySourceRequests,0);
 assert.equal((await reserveAutomaticBatch(db,{now})).decision,'daily_limit');
 db.sqlite.exec('DELETE FROM portfolio_rollout_days');
 db.sqlite.prepare('UPDATE portfolio_rollout_control SET reserved_r2_bytes=?').run(CONFIG.queue.maxTotalStorageBytes);
 assert.equal((await reserveAutomaticBatch(db,{now})).decision,'r2_storage_limit');
 db.sqlite.exec('UPDATE portfolio_rollout_control SET reserved_r2_bytes=0');
 const {claim}=await reserveAutomaticBatch(db,{now});
 await finishAutomaticBatch(db,claim,{office:claim.office,status:'failed',source_requests:1,error:'checksum differs'},{now:now+1000});
 assert.equal((await reserveAutomaticBatch(db,{now:now+2000})).decision,'paused');
 db.sqlite.close();
});
test('Cron only dispatches the gated controller and deduplicates its daily dispatch',async()=>{
 const db=await fixture();let calls=0;
 const env={PORTFOLIO_DB:db,GITHUB_DISPATCH_TOKEN:'fake'};
 const fetcher=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).ref,CONFIG.githubRef);assert.ok(url.endsWith('/'+CONFIG.rollout.workflow+'/dispatches'));return new Response(null,{status:204});};
 assert.equal((await dispatchAutomaticQueue(env,{now:()=>now,fetcher})).status,'awaiting_fa4800_and_cost_review');
 db.approve();
 assert.equal((await dispatchAutomaticQueue(env,{now:()=>now,fetcher})).status,'dispatched');
 assert.equal((await dispatchAutomaticQueue(env,{now:()=>now,fetcher})).status,'already_dispatched');
 assert.equal(calls,1);db.sqlite.close();
});
test('Automatic profiles are directory scoped and never replace original pilots',()=>{
 const profile=automaticProfile('N00024',[{code:'N00024'}]);
 assert.equal(profile.bucket,CONFIG.rollout.sharedBucket);assert.equal(profile.baselineBucket,profile.bucket);
 assert.throws(()=>automaticProfile('FA4528',[{code:'FA4528'}]));
 assert.throws(()=>automaticProfile('BAD000',[]));
});

test('A queued non-pilot office uses the original source package, publishes D1 first, then serves its shared R2 snapshot',async()=>{
 const {sqlite,source,office,fixed}=await import('./fixtures/portfolio-d1.mjs');
 const {createOfficeIngest}=await import('../portfolio/r2/ingest.mjs');
 const {createFormat}=await import('../portfolio/r2/format.mjs');
 const {recordValidation,publishD1}=await import('../portfolio/publication-d1.mjs');
 const {compareOffice}=await import('../portfolio/compare.mjs');
 const {readR2}=await import('../portfolio/r2/read.mjs');
 const target={...office,code:'N00024',name:'Fixture NAVSEA'},profile=automaticProfile(target.code,[target]),engine=createOfficeIngest(profile),format=createFormat(profile),original=source();
 const fetcher=async(url,options={})=>{
  const response=await original.fetcher(String(url).replaceAll('N00024','FA4528'),{...options,body:options.body?.replaceAll('N00024','FA4528')});
  return new Response(JSON.stringify(await response.json()).replaceAll('FA4528','N00024'),{status:response.status,headers:{'Content-Type':'application/json'}});
 };
 const objects=new Map();let revision=0;
 const store={get:async key=>objects.get(key)||null,head:async key=>objects.get(key)||null,put:async(key,bytes,{expected,sha}={})=>{assert.equal(objects.get(key)?.etag||null,expected);const value={bytes,sha,etag:String(++revision)};objects.set(key,value);return value;}};
 let candidate;
 await engine.runR2Chunk({store,directory:[target],now:fixed,fetcher,prepareOnly:true,onPrepared:async value=>{candidate=value;},config:{sourceIntervalMs:0}});
 assert.ok(candidate);assert.equal(await store.get(engine.CURRENT),null);
 const comparison=await compareOffice({office:target.code,automaticOffice:target.code,directory:[target],now:fixed,today:'2026-10-25',fetcher,getSnapshot:async start=>format.snapshotFromTables(candidate.tables,start,fixed)});
 assert.equal(comparison.match,true);
 const x=sqlite();x.sql.exec(await fs.readFile(new URL('../portfolio/migrations/0004.sql',import.meta.url),'utf8'));
 await recordValidation(x.db,candidate.tables,profile,comparison);
 const authoritative=await publishD1(x.db,candidate.tables,profile);
 await engine.publishCandidate(store,candidate.base,candidate.state,authoritative.tables,{d1PublicationVersion:authoritative.version});
 const admission={office:target.code,verified:true,schema_version:CONFIG.schemaVersion,publication_id:authoritative.version,comparison_sha256:'a'.repeat(64)};
 objects.set(profile.prefix+'/admission.json',{bytes:format.bytes(admission)});
 const bucket={get:async key=>{const row=objects.get(key);return row?{json:async()=>JSON.parse(new TextDecoder().decode(row.bytes)),arrayBuffer:async()=>row.bytes.slice().buffer}:null;}};
 const snapshot=await readR2(bucket,target.code,{profile,now:fixed,d1Publication:{published_run_id:authoritative.version}});
 assert.equal(snapshot.source,'r2');assert.ok(snapshot.records.length>0);assert.ok(snapshot.records.every(r=>r.piid.startsWith('N00024')));
 assert.ok([...objects.keys()].every(key=>key.startsWith('pilot/N00024/')));
 x.sql.close();
});
