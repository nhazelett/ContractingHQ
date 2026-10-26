import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,runIngest,seedOffices} from '../portfolio/ingest.mjs';
import {createHttpD1,verifyAtomicBatch} from '../portfolio/d1-http.mjs';
import {dispatchIngest} from '../portfolio/dispatch.mjs';
import {officeSnapshot} from '../portfolio/read.mjs';
import {runPackage} from '../portfolio/runner.mjs';
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
