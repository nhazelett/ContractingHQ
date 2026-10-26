import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,runIngest,seedOffices} from '../../portfolio/ingest.mjs';
import {officeSnapshot,storedAward} from '../../portfolio/read.mjs';
import {sqlite,source,office,fixed} from '../../tests/fixtures/portfolio-d1.mjs';
import {exportOffice} from './export.mjs';
import {PILOT,buildBundle,restoreBundle,unpack,canonical,compatible,bytes,digest,snapshotFromTables} from './core.mjs';
import {createPilotWorker} from './worker.mjs';
import {compareCSV} from './csv.mjs';
function bucket(){const objects=new Map();return {objects,async put(key,value,options={}){const data=new Uint8Array(value);objects.set(key,{bytes:data,customMetadata:options.customMetadata||{}});},async get(key){const entry=objects.get(key);return entry?{size:entry.bytes.length,customMetadata:entry.customMetadata,arrayBuffer:async()=>entry.bytes.slice().buffer,json:async()=>JSON.parse(new TextDecoder().decode(entry.bytes))}:null;},async head(key){const entry=objects.get(key);return entry?{size:entry.bytes.length,customMetadata:entry.customMetadata}:null;}};}
async function fixture(){const {db,sql}=sqlite();await seedOffices(db,[office]);const upstream=source();await runIngest({PORTFOLIO_DB:db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config:{sourceIntervalMs:0}});return {db,sql,tables:await exportOffice(db)};}
async function uploaded(tables){const bundle=await buildBundle(tables,{now:fixed}),store=bucket(),worker=createPilotWorker({now:fixed}),env={BUCKET:store,R2_BENCH_TOKEN:'unit-test-token'};for(const object of bundle.objects)await store.put(object.key,object.bytes,{customMetadata:{sha256:object.sha256}});const put=async manifest=>{const data=bytes(manifest);return worker.fetch(new Request('https://pilot/__bench/object?key='+encodeURIComponent(PILOT.prefix+'/current.json'),{method:'PUT',headers:{Authorization:'Bearer '+env.R2_BENCH_TOKEN,'X-Object-SHA256':await digest(data)},body:data}),env);};return {bundle,store,worker,env,put};}
test('R2 bundles losslessly preserve every SQL field, raw JSON string, and source evidence',async()=>{
 const x=await fixture(),bundle=await buildBundle(x.tables,{now:fixed}),map=new Map(bundle.objects.map(o=>[o.key,o]));
 const restored=await restoreBundle(bundle.manifest,d=>unpack(map.get(d.key).bytes,d.sha256));assert.equal(canonical(restored),canonical(x.tables));assert.equal(restored.awards[0].raw_json,x.tables.awards[0].raw_json);assert.ok(bundle.objects.length<=PILOT.maxObjects);
 const again=await buildBundle(x.tables,{now:()=>fixed()+CONFIG.millisecondsPerDay});assert.equal(again.manifest.version,bundle.manifest.version);assert.equal(again.manifest.source_published_at,bundle.manifest.source_published_at);assert.deepEqual(again.objects.map(o=>o.sha256),bundle.objects.map(o=>o.sha256));
});
test('The isolated reader matches every D1 response field except its honest source marker, across all windows',async()=>{
 const x=await fixture(),p=await uploaded(x.tables);assert.equal((await p.put(p.bundle.manifest)).status,200);
 for(const start of CONFIG.windows){const request=new Request('https://pilot/api/office/FA4528?start='+start,{headers:{Authorization:'Bearer '+p.env.R2_BENCH_TOKEN}}),response=await p.worker.fetch(request,p.env);assert.equal(response.status,200);const actual=await response.json(),expected=await officeSnapshot(x.db,PILOT.office,start,{now:fixed});assert.equal(canonical(compatible(actual)),canonical(compatible(expected)));assert.equal(actual.source,'r2');assert.equal(actual.today,'2026-10-25');const csv=await compareCSV(actual.records,expected.records,actual.today);assert.ok(csv.every(row=>row.match));}
 const id=x.tables.awards[0].generated_unique_award_id,response=await p.worker.fetch(new Request('https://pilot/api/office/FA4528/award?id='+id,{headers:{Authorization:'Bearer '+p.env.R2_BENCH_TOKEN}}),p.env);assert.equal(canonical(compatible(await response.json())),canonical(compatible(await storedAward(x.db,PILOT.office,id))));
});
test('Failed publication and corrupt uploads retain the previous completed R2 pointer',async()=>{
 const x=await fixture(),p=await uploaded(x.tables);assert.equal((await p.put(p.bundle.manifest)).status,200);const key=PILOT.prefix+'/current.json',before=await (await p.store.get(key)).arrayBuffer();
 const missing=structuredClone(p.bundle.manifest);missing.objects[0].key=missing.objects[0].key.replace('/metadata-','/missing-');missing.metadata.key=missing.objects[0].key;assert.equal((await p.put(missing)).status,409);assert.deepEqual(await (await p.store.get(key)).arrayBuffer(),before);
 const object=p.bundle.objects[0],bad=new Request('https://pilot/__bench/object?key='+encodeURIComponent(object.key),{method:'PUT',headers:{Authorization:'Bearer '+p.env.R2_BENCH_TOKEN,'X-Object-SHA256':'0'.repeat(64)},body:'corrupt'});assert.equal((await p.worker.fetch(bad,p.env)).status,400);assert.deepEqual(await (await p.store.get(key)).arrayBuffer(),before);
});
test('Other offices, unauthorized reads, and unstored history pages never trigger a source fetch',async()=>{
 const x=await fixture(),p=await uploaded(x.tables);await p.put(p.bundle.manifest);const headers={Authorization:'Bearer '+p.env.R2_BENCH_TOKEN};
 assert.equal((await p.worker.fetch(new Request('https://pilot/api/office/FA4528'),p.env)).status,401);
 const other=await p.worker.fetch(new Request('https://pilot/api/office/FA4800',{headers}),p.env);assert.equal(other.status,404);assert.equal(other.headers.get('X-Benchmark-R2-Reads'),'0');
 assert.equal((await p.worker.fetch(new Request('https://pilot/api/office/FA4528/award?id='+x.tables.awards[0].generated_unique_award_id+'&page=2',{headers}),p.env)).status,404);
 await assert.rejects(unpack(p.bundle.objects[0].bytes,'0'.repeat(64)),/checksum/);
});
test('The R2 view recomputes dates on the current New York day, without changing source freshness',async()=>{
 const x=await fixture(),a=snapshotFromTables(x.tables,CONFIG.windows[0],()=>Date.parse('2026-10-26T03:59:00Z')),b=snapshotFromTables(x.tables,CONFIG.windows[0],()=>Date.parse('2026-10-26T04:01:00Z'));
 assert.equal(a.today,'2026-10-25');assert.equal(b.today,'2026-10-26');assert.equal(a.records[0].days_to_current_end,1);assert.equal(b.records[0].days_to_current_end,0);assert.equal(a.published_at,b.published_at);
});
test('Incomplete source copies fail before publication',async()=>{const x=await fixture(),bad=structuredClone(x.tables);bad.awards.pop();await assert.rejects(buildBundle(bad),/counts/);});
