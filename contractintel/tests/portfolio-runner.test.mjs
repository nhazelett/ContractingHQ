import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,runIngest,seedOffices} from '../portfolio/ingest.mjs';
import {createHttpD1,verifyAtomicBatch} from '../portfolio/d1-http.mjs';
import {dispatchIngest} from '../portfolio/dispatch.mjs';
import {officeSnapshot} from '../portfolio/read.mjs';
import {runPackage} from '../portfolio/runner.mjs';
import {portfolioRoute} from '../portfolio/http.mjs';
import {compareOffice} from '../portfolio/compare.mjs';
import {sqlite,source,office,fixed} from './fixtures/portfolio-d1.mjs';
function httpFixture(){
 const {db,sql}=sqlite(),bodies=[];
 const execute=entry=>{const statement=db.prepare(entry.sql).bind(...(entry.params||[]));return /^(SELECT|PRAGMA)/i.test(entry.sql.trim())?statement.all():statement.run();};
 const fetcher=async(url,options)=>{const body=JSON.parse(options.body);bodies.push(body);try{let rows;if(body.batch){sql.exec('BEGIN');try{rows=[];for(const entry of body.batch)rows.push(await execute(entry));sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}else rows=[await execute(body)];return Response.json({success:true,result:rows.map(r=>({...r,success:true}))});}catch{return Response.json({success:false,errors:[{code:7500}]},{status:400});}};
 const remote=createHttpD1({account:'a'.repeat(32),database:'b'.repeat(8)+'-bbbb-bbbb-bbbb-bbbbbbbbbbbb',token:'unit-test-only',fetcher,interval:0});
 return {db:remote,sql,bodies};
}
test('D1 HTTP sends bound parameter batches in one request, and rolls back on execution failure',async()=>{
 const x=httpFixture();assert.deepEqual(await verifyAtomicBatch(x.db),{atomic_batch_rollback:'passed'});assert.equal(x.bodies.filter(b=>b.batch).length,1);
 await x.db.prepare('CREATE TABLE parameter_probe(value TEXT)').run();const value="single quote ' and ?; DROP TABLE awards;";await x.db.batch([x.db.prepare('INSERT INTO parameter_probe VALUES(?)').bind(value),x.db.prepare('INSERT INTO parameter_probe VALUES(?)').bind('second')]);assert.equal(x.sql.prepare('SELECT value FROM parameter_probe LIMIT 1').get().value,value);assert.ok(x.sql.prepare("SELECT name FROM sqlite_master WHERE name='awards'").get());
});
test('The full ingest package uses the D1 HTTP adapter without changing source helper semantics',async()=>{
 const x=httpFixture();await seedOffices(x.db,[office]);const upstream=source();const result=await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}});assert.equal(result.status,'completed');assert.equal((await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed})).records.length,4);assert.ok(x.bodies.some(b=>b.batch?.length>1));
});
test('A lost publication response recognizes the committed complete snapshot and does not downgrade it',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const original=x.db.batch;let dropped=false;x.db.batch=async statements=>{const out=await original(statements);if(!dropped&&statements.some(s=>s._sql?.startsWith('INSERT INTO office_publications'))){dropped=true;throw new Error('Response lost after commit');}return out;};
 const result=await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:source().fetcher,config:{sourceIntervalMs:0}});assert.equal(result.status,'completed');assert.ok(await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed}));assert.equal(x.sql.prepare('SELECT status FROM ingest_office_progress').get().status,'completed');
});
test('Cron dispatch makes only a GitHub workflow request and deduplicates accepted daily dispatches',async()=>{
 const x=sqlite(),calls=[];const env={PORTFOLIO_DB:x.db,GITHUB_DISPATCH_TOKEN:'unit-test-only'};
 const fetcher=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(null,{status:204});};
 assert.equal((await dispatchIngest(env,{fetcher,now:fixed})).status,'dispatched');assert.equal((await dispatchIngest(env,{fetcher,now:fixed})).status,'already_dispatched');assert.equal(calls.length,1);assert.ok(calls[0].url.startsWith('https://api.github.com/repos/nhazelett/ContractingHQ/actions/workflows/'));assert.equal(calls[0].body.inputs.office,'FA4528');assert.equal(calls[0].body.inputs.verify,'false');
});
test('Failed GitHub dispatch remains retryable; missing or expired credentials never masquerade as success',async()=>{
 const x=sqlite();await assert.rejects(dispatchIngest({PORTFOLIO_DB:x.db}),/CONTRACTINTEL_GITHUB_TOKEN/);
 const env={PORTFOLIO_DB:x.db,GITHUB_DISPATCH_TOKEN:'unit-test-only'};await assert.rejects(dispatchIngest(env,{fetcher:async()=>new Response(null,{status:401}),now:fixed}),/HTTP 401/);assert.equal(x.sql.prepare('SELECT status FROM ingest_dispatches').get().status,'failed');
 const later=()=>fixed()+1;assert.equal((await dispatchIngest(env,{fetcher:async()=>new Response(null,{status:204}),now:later})).status,'dispatched');
});

test('Public pilot progress exposes counts without raw records, config or credentials',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:source().fetcher,config:{sourceIntervalMs:0,maxSourceRequests:8}});
 const data=await portfolioRoute(new Request('https://local/api/office/FA4528/progress'),{PORTFOLIO_DB:x.db});assert.equal(data.office,'FA4528');assert.equal(data.status,'yielded');assert.ok(data.awards_prepared>=0);assert.equal(data.checkpoint_json,undefined);assert.equal(data.work_id,undefined);assert.equal(data.config_json,undefined);
});

test('Late history from an unavailable award cannot be stored as another award raw evidence',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const upstream=source(),[missing,next]=upstream.ids;
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):{};
  if(path.includes('/awards/'+missing+'/'))return new Response('',{status:404});
  if(path.includes('/transactions/')&&body.award_id===missing){await new Promise(r=>setTimeout(r,30));return upstream.fetcher(url,options);}
  if(path.includes('/awards/'+next+'/'))await new Promise(r=>setTimeout(r,60));
  return upstream.fetcher(url,options);
 };
 await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher,config:{sourceIntervalMs:0}});
 const stored=x.sql.prepare('SELECT actions_json,raw_json FROM award_history_pages WHERE generated_unique_award_id=?').get(next);
 assert.equal(JSON.parse(stored.actions_json)[0].transaction_id,next+'G');assert.equal(JSON.parse(stored.raw_json).results[0].id,next+'G');
});

test('Publication repairs an older staged raw-history mismatch by re-fetching that award only',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const upstream=source(),env={PORTFOLIO_DB:x.db,OFFICES:[office]},options={mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0,maxSourceRequests:10}};
 assert.equal((await runIngest(env,options)).status,'yielded');const rows=x.sql.prepare("SELECT * FROM ingest_stage WHERE record_kind='award' ORDER BY record_key").all();assert.equal(rows.length,2);const old=JSON.parse(rows[1].data_json);old.rawHistory=JSON.parse(rows[0].data_json).rawHistory;x.sql.prepare('UPDATE ingest_stage SET data_json=? WHERE work_id=? AND record_kind=? AND record_key=?').run(JSON.stringify(old),rows[1].work_id,rows[1].record_kind,rows[1].record_key);
 assert.equal((await runIngest(env,{...options,config:{sourceIntervalMs:0}})).status,'completed');const evidence=x.sql.prepare('SELECT raw_json FROM award_history_pages WHERE generated_unique_award_id=?').get(upstream.ids[1]);assert.equal(JSON.parse(evidence.raw_json).results[0].id,upstream.ids[1]+'G');assert.equal(upstream.calls.filter(c=>c.path.includes('/awards/'+upstream.ids[1]+'/')).length,2);
});

test('Nightly changed-award pagination converts timestamp cursors exactly like the live search adapter',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const upstream=source(),env={PORTFOLIO_DB:x.db,OFFICES:[office]};await runIngest(env,{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}});let pages=0,observed;
 const fetcher=async(url,options={})=>{const body=options.body?JSON.parse(options.body):{};
  if(body.filters?.time_period?.[0]?.date_type==='last_modified_date'){
   pages++;if(pages===1)return Response.json({results:[],page_metadata:{hasNext:true,last_record_unique_id:55,last_record_sort_value:Date.parse('2026-10-25T00:00:00Z')}});
   observed=body;return Response.json({results:[],page_metadata:{hasNext:false}});
  }return upstream.fetcher(url,options);
 };
 assert.equal((await runIngest(env,{mode:'nightly',now:fixed,fetcher,config:{sourceIntervalMs:0}})).status,'completed');assert.equal(pages,2);assert.equal(observed.last_record_sort_value,'2026-10-25');assert.equal(observed.last_record_unique_id,55);
});

test('Nightly reuses unchanged evidence inside D1 while preserving every published business record',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const upstream=source(),env={PORTFOLIO_DB:x.db,OFFICES:[office]},options={now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}};await runIngest(env,{...options,mode:'backfill'});
 const before=x.sql.prepare('SELECT * FROM awards ORDER BY generated_unique_award_id').all(),history=x.sql.prepare('SELECT * FROM award_history_pages ORDER BY generated_unique_award_id').all();let copies=0;const prepare=x.db.prepare;x.db.prepare=sql=>{if(sql.includes('Copy unchanged'))copies++;if(sql.startsWith('INSERT INTO ingest_stage')&&sql.includes('FROM awards a LEFT JOIN'))copies++;return prepare(sql);};
 await runIngest(env,{...options,mode:'nightly'});assert.equal(copies,1);assert.deepEqual(x.sql.prepare('SELECT * FROM awards ORDER BY generated_unique_award_id').all(),before);assert.deepEqual(x.sql.prepare('SELECT * FROM award_history_pages ORDER BY generated_unique_award_id').all(),history);
});

test('Independent count comparison reads fresh award summaries and fiscal transactions without redundant history requests',async()=>{
 const x=sqlite();await seedOffices(x.db,[office]);const upstream=source();await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}});upstream.calls.length=0;
 const report=await compareOffice({directory:[office],today:'2026-10-25',sourceFetch:upstream.fetcher,getSnapshot:start=>officeSnapshot(x.db,'FA4528',start,{now:fixed})});assert.equal(report.match,true);assert.equal(report.windows.length,4);assert.equal(report.windows.reduce((n,w)=>n+w.metrics.length,0),96);assert.equal(upstream.calls.filter(c=>c.path.includes('/transactions/')).length,0);assert.equal(upstream.calls.filter(c=>c.path.includes('/awards/')).length,5);
});
