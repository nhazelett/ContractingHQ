import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sqlite,source,office,fixed} from './fixtures/portfolio-d1.mjs';
import {runIngest,seedOffices,CONFIG,r2Profile} from '../portfolio/ingest.mjs';
import {recordValidation,publishD1,resumeValidatedCandidate} from '../portfolio/publication-d1.mjs';
import {publication,officeSnapshot} from '../portfolio/read.mjs';
import {exportOffice} from '../benchmarks/r2/export.mjs';
import {createFormat} from '../portfolio/r2/format.mjs';
import {retryGateway} from '../portfolio/r2/retry.mjs';
import {readR2} from '../portfolio/r2/read.mjs';
const profile=r2Profile('FA4528'),format=createFormat(profile);
async function candidate(){
 const x=sqlite(),upstream=source();await seedOffices(x.db,[office]);await runIngest({PORTFOLIO_DB:x.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}});
 const tables=await exportOffice(x.db);x.sql.close();return tables;
}
function target(){const x=sqlite();x.sql.exec(readFileSync(new URL('../portfolio/migrations/0004.sql',import.meta.url),'utf8'));return x;}
test('D1 receives every award, raw field, evidence page, window and fiscal total before R2 is generated',async()=>{
 const tables=await candidate(),x=target();
 await assert.rejects(publishD1(x.db,tables,profile),/receipt/);
 await assert.rejects(recordValidation(x.db,tables,profile,{match:false}),/did not match/);
 assert.equal(await publication(x.db,'FA4528'),null);
 await recordValidation(x.db,tables,profile,{match:true,kind:'independent-source-fixture'});
 const result=await publishD1(x.db,tables,profile);assert.equal(format.canonical(result.tables),format.canonical(tables));
 assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,tables.awards.length);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM ingest_stage').get().n,0);
 const bundle=await format.buildBundle(result.tables,{d1PublicationVersion:result.version});
 assert.equal(bundle.manifest.d1_publication_version,(await publication(x.db,'FA4528')).published_run_id);
 assert.equal((await publishD1(x.db,tables,profile)).reconciled,true);
 const objects=new Map(bundle.objects.map(o=>[o.key,o.bytes]));objects.set(profile.prefix+'/current.json',format.bytes(bundle.manifest));
 const bucket={get:async key=>{const body=objects.get(key);return body?{json:async()=>JSON.parse(new TextDecoder().decode(body)),arrayBuffer:async()=>body.slice().buffer}:null;}};
 const snapshot=await readR2(bucket,'FA4528',{d1Publication:await publication(x.db,'FA4528')});assert.equal(snapshot.records.length,4);
 await assert.rejects(readR2(bucket,'FA4528',{d1Publication:{published_run_id:'different'}}),/authoritative/);
 await assert.rejects(readR2(bucket,'FA4528',{d1Publication:null}),/authoritative/);x.sql.close();
});
test('A failed authoritative publication rolls back every published table and resumes from staged work',async()=>{
 const old=await candidate(),next=await candidate(),x=target();
 await recordValidation(x.db,old,profile,{match:true});await publishD1(x.db,old,profile);
 await recordValidation(x.db,next,profile,{match:true});
 const prior=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed});
 x.sql.exec("CREATE TRIGGER authority_failure BEFORE INSERT ON awards BEGIN SELECT RAISE(ABORT,'simulated publication failure'); END");
 await assert.rejects(publishD1(x.db,next,profile),/simulated/);
 assert.equal((await publication(x.db,'FA4528')).published_run_id,old.office_publications[0].published_run_id);
 assert.equal(format.canonical(await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed})),format.canonical(prior));
 assert.ok(x.sql.prepare('SELECT count(*) n FROM ingest_stage').get().n>0);
 x.sql.exec('DROP TRIGGER authority_failure');
 assert.equal((await publishD1(x.db,next,profile)).version,next.office_publications[0].published_run_id);x.sql.close();
});
test('Partial staging cannot publish, and corrupted staging fails the full SQL round-trip gate',async()=>{
 const tables=await candidate(),x=target();await recordValidation(x.db,tables,profile,{match:true});
 const work='authority:'+tables.office_publications[0].published_run_id,row={...tables.awards[0],description:'altered'};
 const key=JSON.stringify([row.generated_unique_award_id]);
 await x.db.prepare('INSERT INTO ingest_stage VALUES(?,?,?,?)').bind(work,'awards',key,JSON.stringify(row)).run();
 await assert.rejects(publishD1(x.db,tables,profile),/round trip differs/);assert.equal(await publication(x.db,'FA4528'),null);x.sql.close();
});
test('Gateway retry uses bounded backoff and jitter inside a job without retrying terminal statuses',async()=>{
 let calls=0;const delays=[];
 const response=await retryGateway(async()=>new Response(null,{status:++calls<3?503:200}),{sleep:async ms=>delays.push(ms),random:()=>0.5});
 assert.equal(response.status,200);assert.equal(calls,3);assert.deepEqual(delays,[1500,2500]);
 calls=0;await retryGateway(async()=>{calls++;return new Response(null,{status:413});},{sleep:async()=>{throw Error('must not retry');}});assert.equal(calls,1);
 calls=0;const exhausted=await retryGateway(async()=>{calls++;return new Response(null,{status:503});},{sleep:async()=>{},random:()=>0});assert.equal(calls,CONFIG.authority.retryAttempts);assert.equal(exhausted.status,503);
});

test('The real source engine prepares without publishing R2; D1 publication precedes cache promotion',async()=>{
 const {createOfficeIngest}=await import('../portfolio/r2/ingest.mjs'),engine=createOfficeIngest(profile),upstream=source(),objects=new Map();let revision=0,prepared;
 const store={get:async key=>objects.get(key)||null,head:async key=>objects.get(key)||null,put:async(key,bytes,{expected,sha})=>{assert.equal(objects.get(key)?.etag||null,expected);const value={bytes,etag:String(++revision),sha};objects.set(key,value);return value;}};
 const outcome=await engine.runR2Chunk({store,directory:[office],fetcher:upstream.fetcher,now:fixed,config:{sourceIntervalMs:0},prepareOnly:true,onPrepared:async value=>prepared=value});
 assert.equal(outcome.status,'prepared');assert.equal(await store.get(engine.CURRENT),null);assert.ok(prepared.tables.awards.length>0);
 const x=target();await recordValidation(x.db,prepared.tables,profile,{match:true,kind:'independent-source-fixture'});
 const native=await publishD1(x.db,prepared.tables,profile);
 await engine.publishCandidate(store,prepared.base,prepared.state,native.tables,{now:fixed,d1PublicationVersion:native.version});
 const manifest=JSON.parse(new TextDecoder().decode((await store.get(engine.CURRENT)).bytes));assert.equal(manifest.d1_publication_version,(await publication(x.db,'FA4528')).published_run_id);
 assert.equal(format.canonical((await engine.loadPublication(store)).tables),format.canonical(await exportOffice(x.db)));x.sql.close();
});

test('Large checkpoints use authenticated summaries without decompression inside the Worker',async()=>{
 const {createGateway}=await import('../portfolio/r2/gateway.mjs');
 const objects=new Map(),bucket={
  get:async key=>objects.get(key)||null,head:async key=>objects.get(key)||null,
  put:async(key,body,options)=>{const value={size:body.length,etag:'fixture',httpEtag:'"fixture"',customMetadata:options.customMetadata,json:async()=>JSON.parse(new TextDecoder().decode(body)),arrayBuffer:async()=>new Uint8Array(body).buffer};objects.set(key,value);return value;}
 };
 const packed=await format.pack({office:'FA4528',format_version:1,work_id:'fixture',raw:'X'.repeat(CONFIG.authority.legacyCheckpointJSONBytes+1)});
 const summary={office:'FA4528',format_version:1,work_id:'fixture',progress:JSON.stringify({kind:'import',phase:'hydrate',status:'yielded',prepared:100,discovered:100})};
 const original=globalThis.DecompressionStream;globalThis.DecompressionStream=class{constructor(){throw Error('Worker must not decompress this checkpoint');}};
 try{
  const response=await createGateway(profile).fetch(new Request('https://gateway/object?key='+encodeURIComponent(profile.prefix+'/checkpoint.json.gz'),{method:'PUT',headers:{Authorization:'Bearer fixture','If-None-Match':'*','X-Object-SHA256':packed.sha256,'X-Checkpoint-Summary':JSON.stringify(summary)},body:packed.bytes}),{TARGET:bucket,R2_UPDATE_TOKEN:'fixture'});
  assert.equal(response.status,200);assert.equal(objects.get(profile.prefix+'/checkpoint.json.gz').customMetadata.progress,summary.progress);
 }finally{globalThis.DecompressionStream=original;}
});

test('A validated candidate resumes config drift without changing its receipt or accepting altered data',async()=>{
 const tables=await candidate(),x=target(),id=tables.office_publications[0].published_run_id;
 const receipt=await recordValidation(x.db,tables,profile,{match:true});
 const original=tables.ingest_runs.find(run=>run.id===id);
 await x.db.prepare('INSERT INTO ingest_stage VALUES(?,?,?,?)').bind('authority:'+id,'ingest_runs',JSON.stringify([id]),JSON.stringify(original)).run();
 const changed=structuredClone(tables);changed.ingest_runs.find(run=>run.id===id).config_json='{"metrics":"updated"}';
 await assert.rejects(publishD1(x.db,changed,profile),/identity differs/);
 const restored=await resumeValidatedCandidate(x.db,changed,profile);
 assert.equal(format.canonical(restored),format.canonical(tables));
 assert.equal((await publishD1(x.db,restored,profile)).version,id);
 assert.equal(x.sql.prepare('SELECT content_sha256 FROM portfolio_publication_receipts').get().content_sha256,receipt.content_sha256);
 // Recovery also works after atomic publication removed the staging rows.
 assert.equal(format.canonical(await resumeValidatedCandidate(x.db,changed,profile)),format.canonical(tables));
 const corrupt=structuredClone(changed);corrupt.awards[0].description='altered';
 await assert.rejects(resumeValidatedCandidate(x.db,corrupt,profile),/identity differs/);
 const wrongOffice={...profile,office:'FA4800'};
 await assert.rejects(resumeValidatedCandidate(x.db,changed,wrongOffice));
 x.sql.close();
});
test('Receipt metadata recovery refuses missing or corrupted saved metadata',async()=>{
 const tables=await candidate(),x=target(),id=tables.office_publications[0].published_run_id;
 assert.equal(await resumeValidatedCandidate(x.db,tables,profile),tables);
 await recordValidation(x.db,tables,profile,{match:true});
 assert.equal(await resumeValidatedCandidate(x.db,tables,profile),tables);
 const changed=structuredClone(tables);changed.ingest_runs.find(run=>run.id===id).config_json='{}';
 await assert.rejects(resumeValidatedCandidate(x.db,changed,profile),/metadata is unavailable/);
 const original={...tables.ingest_runs.find(run=>run.id===id),config_json:'{"corrupt":true}'};
 await x.db.prepare('INSERT INTO ingest_stage VALUES(?,?,?,?)').bind('authority:'+id,'ingest_runs',JSON.stringify([id]),JSON.stringify(original)).run();
 await assert.rejects(resumeValidatedCandidate(x.db,changed,profile),/identity differs/);
 assert.equal(await publication(x.db,profile.office),null);x.sql.close();
});
test('Prepared checkpoints retain their original config metadata across resumes',async()=>{
 const {createOfficeIngest}=await import('../portfolio/r2/ingest.mjs'),engine=createOfficeIngest(profile),upstream=source(),objects=new Map();let rev=0,prepared;
 const store={get:async key=>objects.get(key)||null,put:async(key,bytes,{expected,sha})=>{assert.equal(objects.get(key)?.etag||null,expected);const value={bytes,etag:String(++rev),sha};objects.set(key,value);return value;}};
 const run=()=>engine.runR2Chunk({store,directory:[office],fetcher:upstream.fetcher,now:fixed,config:{sourceIntervalMs:0},prepareOnly:true,onPrepared:async value=>prepared=value});
 await run();
 assert.equal(prepared.state.candidate_config_json,prepared.tables.ingest_runs.find(r=>r.id===prepared.state.work_id).config_json);
 prepared.state.candidate_config_json='{"backend":"original-config"}';
 const packed=await format.pack(prepared.state);
 const key=engine.SETTINGS.checkpointKey;objects.set(key,{bytes:packed.bytes,etag:String(++rev),sha:packed.sha256});
 await run();
 assert.equal(prepared.tables.ingest_runs.find(r=>r.id===prepared.state.work_id).config_json,'{"backend":"original-config"}');
});
