import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,runIngest,seedOffices} from '../ingest.mjs';
import {officeSnapshot} from '../read.mjs';
import {sqlite,source,office,fixed} from '../../tests/fixtures/portfolio-d1.mjs';
import {exportOffice} from '../../benchmarks/r2/export.mjs';
import {compareCSV} from '../../benchmarks/r2/csv.mjs';
import {PILOT,buildBundle,bytes,digest,canonical,compatible,pack,unpack,snapshotFromTables} from './format.mjs';
import {createGateway} from './gateway.mjs';
import {CURRENT,SETTINGS,runR2Chunk,loadPublication} from './ingest.mjs';
import {cacheImmutable} from './cache.mjs';

const config={sourceIntervalMs:0};
function bucket(){
 const objects=new Map();let revision=0;
 const wrap=entry=>entry?{...entry,size:entry.bytes.length,arrayBuffer:async()=>entry.bytes.slice().buffer,json:async()=>JSON.parse(new TextDecoder().decode(entry.bytes))}:null;
 return {objects,get:async key=>wrap(objects.get(key)),head:async key=>wrap(objects.get(key)),async put(key,value,options={}){
  const previous=objects.get(key),condition=options.onlyIf;
  if(condition?.get('If-Match')&&condition.get('If-Match')!==previous?.httpEtag)return null;
  if(condition?.get('If-None-Match')==='*'&&previous)return null;
  const etag=String(++revision),entry={bytes:new Uint8Array(value),etag,httpEtag:'"'+etag+'"',customMetadata:options.customMetadata||{}};objects.set(key,entry);return wrap(entry);
 }};
}
export function gatewayStore(target=bucket(),baseline=bucket()){
 const gateway=createGateway(),env={TARGET:target,BASELINE:baseline,R2_UPDATE_TOKEN:'fixture-secret'},calls=[];
 const call=async(key,method='GET',body,options={},area='target')=>{
  const headers={Authorization:'Bearer '+env.R2_UPDATE_TOKEN};
  if(method==='PUT'){headers['X-Object-SHA256']=options.sha;headers[options.expected===null?'If-None-Match':'If-Match']=options.expected===null?'*':options.expected;}
  const response=await gateway.fetch(new Request('https://r2/object?key='+encodeURIComponent(key)+'&area='+area,{method,headers,body}),env);calls.push({key,method,area,status:response.status});
  if(response.status===404)return null;
  if(!response.ok)throw Object.assign(new Error((await response.json()).error),{status:response.status});
  return {bytes:method==='GET'?new Uint8Array(await response.arrayBuffer()):null,etag:response.headers.get('ETag'),sha:response.headers.get('X-Object-SHA256')};
 };
 const store={get:key=>call(key),head:key=>call(key,'HEAD'),put:(key,body,options)=>call(key,'PUT',body,options)};
 return {store,target,baseline,gateway,env,calls,call};
}
async function fixture(){
 const {db,sql}=sqlite(),upstream=source();await seedOffices(db,[office]);
 await runIngest({PORTFOLIO_DB:db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config});
 const tables=await exportOffice(db),bundle=await buildBundle(tables,{now:fixed}),cloud=gatewayStore();
 for(const object of bundle.objects)await cloud.store.put(object.key,object.bytes,{expected:null,sha:object.sha256});
 const pointer=bytes(bundle.manifest);await cloud.store.put(CURRENT,pointer,{expected:null,sha:await digest(pointer)});
 return {...cloud,upstream,db,sql,tables,bundle};
}
const ingest=x=>({store:x.store,directory:[office],now:fixed,fetcher:x.upstream.fetcher,config});

test('A real nightly pass reuses unchanged raw evidence and matches a fresh live-path backfill, including every CSV',async()=>{
 const x=await fixture(),before=x.upstream.calls.length;
 x.upstream.raw[0].description='New requirement description';
 const result=await runR2Chunk(ingest(x));assert.equal(result.status,'completed');assert.equal(result.hydrated_changes,1);
 const details=x.upstream.calls.slice(before).filter(call=>call.path.includes('/awards/'));assert.equal(details.length,1);
 const y=sqlite();await seedOffices(y.db,[office]);await runIngest({PORTFOLIO_DB:y.db,OFFICES:[office]},{mode:'backfill',now:fixed,fetcher:x.upstream.fetcher,config});
 const actual=await loadPublication(x.store);
 for(const start of CONFIG.windows){const r2=snapshotFromTables(actual.tables,start,fixed),live=await officeSnapshot(y.db,SETTINGS.office,start,{now:fixed});
  const normalize=value=>{const payload=compatible(value);delete payload.publication_id;return payload;};
  assert.equal(canonical(normalize(r2)),canonical(normalize(live)));assert.ok((await compareCSV(r2.records,live.records,r2.today)).every(row=>row.match));
 }
 for(const prior of x.tables.awards.slice(1)){const saved=actual.tables.awards.find(row=>row.generated_unique_award_id===prior.generated_unique_award_id);assert.equal(canonical(saved),canonical(prior));}
 assert.equal(actual.tables.awards[0].raw_json,JSON.stringify(x.upstream.raw[0]));
 const count=x.upstream.calls.length,writes=x.calls.filter(call=>call.method==='PUT').length;
 assert.equal((await runR2Chunk(ingest(x))).status,'retained');assert.equal(x.upstream.calls.length,count);assert.equal(x.calls.filter(call=>call.method==='PUT').length,writes);
});

test('Budget yields and source failures resume without exposing incomplete office data',async()=>{
 const x=await fixture(),original=(await x.store.get(CURRENT)).bytes;
 const first=await runR2Chunk({...ingest(x),config:{...config,maxSourceRequests:4,sourceRequestReserve:2}});assert.equal(first.status,'yielded');assert.deepEqual((await x.store.get(CURRENT)).bytes,original);
 const checkpoint=await unpack((await x.store.get(SETTINGS.checkpointKey)).bytes);assert.equal(checkpoint.phase,'discover');assert.equal(checkpoint.window,1);
 // HTTP 500 is deliberately not added to the existing helper's retry rules.
 const failed=await assert.rejects(runR2Chunk({...ingest(x),fetcher:async()=>new Response('',{status:500})}),/temporarily unavailable/);void failed;
 assert.deepEqual((await x.store.get(CURRENT)).bytes,original);
 const resumed=await runR2Chunk(ingest(x));assert.equal(resumed.status,'completed');assert.equal(resumed.work_id,first.work_id);
 const state=await unpack((await x.store.get(SETTINGS.checkpointKey)).bytes);assert.equal(state.attempts.length,3);assert.equal(state.attempts[1].status,'failed');
});

test('A validation failure retains the old pointer and a retry reuses already uploaded candidate objects',async()=>{
 const x=await fixture(),original=(await x.store.get(CURRENT)).bytes;
 await assert.rejects(runR2Chunk({...ingest(x),beforePublish:async()=>{throw new Error('Injected validation failure');}}),/Injected validation/);
 assert.deepEqual((await x.store.get(CURRENT)).bytes,original);
 const result=await runR2Chunk(ingest(x));assert.equal(result.status,'completed');
 // Fixed time + the same logical work ID makes a repeat candidate deterministic.
 assert.equal(result.uploaded_objects,0);
});

test('Concurrent pointer changes, incomplete fiscal pages, and the two-version guard fail closed',async()=>{
 const x=await fixture();await runR2Chunk(ingest(x));const before=(await x.store.get(CURRENT)).bytes;
 await assert.rejects(runR2Chunk({...ingest(x),force:true}),/Two-version/);assert.deepEqual((await x.store.get(CURRENT)).bytes,before);
 const y=await fixture();await runR2Chunk({...ingest(y),config:{...config,maxSourceRequests:4,sourceRequestReserve:2}});
 const cp=await y.store.get(SETTINGS.checkpointKey),state=await unpack(cp.bytes);state.phase='publish';state.hydrate_index=Object.keys(state.candidates).length;
 const encoded=await pack(state);await y.store.put(SETTINGS.checkpointKey,encoded.bytes,{expected:cp.etag,sha:encoded.sha256});
 await assert.rejects(runR2Chunk(ingest(y)),/coverage is incomplete/);
 const head=await y.store.get(CURRENT);await assert.rejects(y.store.put(CURRENT,head.bytes,{expected:'"obsolete"',sha:await digest(head.bytes)}),/conditional/);
});

test('The gateway rejects other offices, unauthorized traffic, baseline writes and corrupt bytes',async()=>{
 const x=await fixture();assert.equal((await x.gateway.fetch(new Request('https://r2/health'),x.env)).status,401);
 await assert.rejects(x.call('pilot/FA4800/current.json'),/owned FA4528/);
 await assert.rejects(x.call(CURRENT,'PUT',bytes('{}'),{expected:null,sha:await digest('{}')},'baseline'),/not allowed/);
 const cp=await pack({office:SETTINGS.office,format_version:SETTINGS.formatVersion,work_id:'example'});
 await assert.rejects(x.store.put(SETTINGS.checkpointKey,cp.bytes,{expected:null,sha:'0'.repeat(64)}),/checksum/);
 const key=PILOT.prefix+'/objects/cap-'+'a'.repeat(64)+'.json.gz',body=bytes('immutable');
 // Reservations are bounded independently of whatever bytes a caller uploads.
 const ledger=await x.target.get(SETTINGS.ledgerKey),data=await ledger.json();data.keys[key]={bytes:SETTINGS.maxBucketBytes,sha:await digest(body)};
 await x.target.put(SETTINGS.ledgerKey,bytes(data));
 const otherKey=PILOT.prefix+'/objects/over-'+await digest(body)+'.json.gz';await assert.rejects(x.store.put(otherKey,body,{expected:null,sha:await digest(body)}),/storage guard/);
});

test('New York midnight changes serve-time classifications but never source freshness',async()=>{
 const x=await fixture();await runR2Chunk(ingest(x));const stored=await loadPublication(x.store);
 const a=snapshotFromTables(stored.tables,CONFIG.windows[0],()=>Date.parse('2026-10-26T03:59:00Z')),b=snapshotFromTables(stored.tables,CONFIG.windows[0],()=>Date.parse('2026-10-26T04:01:00Z'));
 assert.equal(a.today,'2026-10-25');assert.equal(b.today,'2026-10-26');assert.equal(a.published_at,b.published_at);assert.notEqual(a.records[0].days_to_current_end,b.records[0].days_to_current_end);
});

test('An unchanged source refresh reuses evidence files and the last full reconciliation is retained',async()=>{
 const x=await fixture(),result=await runR2Chunk(ingest(x));assert.equal(result.hydrated_changes,0);assert.ok(result.reused_objects>0);
 const actual=await loadPublication(x.store);assert.equal(canonical(actual.tables.awards),canonical(x.tables.awards));assert.equal(canonical(actual.tables.award_history_pages),canonical(x.tables.award_history_pages));
 assert.ok(actual.tables.ingest_runs.some(row=>row.mode==='backfill'&&row.id===x.tables.office_publications[0].published_run_id));
});

test('New and removed awards follow the live discovery windows, with no stranded current rows',async()=>{
 const x=await fixture(),removed=x.upstream.raw.pop(),added=structuredClone(x.upstream.raw[0]);
 added.generated_unique_award_id='CONT_AWD_FA4528NEW_9700_-NONE-_-NONE-';added.piid='FA4528NEW';added.description='Brand-new service';x.upstream.raw.push(added);
 const result=await runR2Chunk(ingest(x));assert.equal(result.status,'completed');assert.equal(result.hydrated_changes,1);
 const actual=await loadPublication(x.store);assert.ok(!actual.tables.awards.some(row=>row.generated_unique_award_id===removed.generated_unique_award_id));
 assert.ok(actual.tables.awards.some(row=>row.generated_unique_award_id===added.generated_unique_award_id));
 assert.ok(!actual.tables.award_windows.some(row=>row.generated_unique_award_id===removed.generated_unique_award_id));
 assert.ok(!actual.tables.award_history_pages.some(row=>row.generated_unique_award_id===removed.generated_unique_award_id));
 // The old immutable objects still contain the removed award's raw data.
 for(const object of x.bundle.objects)assert.ok(x.target.objects.has(object.key));
});

test('A lost response after publication is reconciled, and a lost final checkpoint resumes as complete',async()=>{
 const x=await fixture();let injected=false;
 const flaky={...x.store,async put(key,body,options){const result=await x.store.put(key,body,options);if(key===CURRENT&&!injected){injected=true;throw new Error('Connection interrupted after commit');}return result;}};
 assert.equal((await runR2Chunk({...ingest(x),store:flaky})).status,'completed');
 const cp=await x.store.get(SETTINGS.checkpointKey),state=await unpack(cp.bytes);state.status='running';state.phase='publish';const encoded=await pack(state);await x.store.put(SETTINGS.checkpointKey,encoded.bytes,{expected:cp.etag,sha:encoded.sha256});
 const result=await runR2Chunk({...ingest(x),fetcher:async()=>{throw new Error('Should not refetch');}});assert.equal(result.status,'retained');
 assert.equal((await unpack((await x.store.get(SETTINGS.checkpointKey)).bytes)).status,'completed');
});

test('Missing fiscal pages and mismatched source office IDs are rejected before publication',async()=>{
 const x=await fixture(),before=(await x.store.get(CURRENT)).bytes;
 await assert.rejects(runR2Chunk({...ingest(x),beforePublish:async()=>{throw new Error('Pause for fiscal check');}}),/Pause/);
 const saved=await x.store.get(SETTINGS.checkpointKey),state=await unpack(saved.bytes);delete state.fiscal_pages[Object.keys(state.fiscal_pages)[0]];const encoded=await pack(state);
 await x.store.put(SETTINGS.checkpointKey,encoded.bytes,{expected:saved.etag,sha:encoded.sha256});await assert.rejects(runR2Chunk(ingest(x)),/fiscal page is incomplete/);assert.deepEqual((await x.store.get(CURRENT)).bytes,before);
 const y=await fixture(),fetcher=async(url,options)=>{
  const response=await y.upstream.fetcher(url,options);if(!url.includes('spending_by_award'))return response;const data=await response.json();data.results[0].generated_internal_id='CONT_AWD_FA4800UNRELATED_9700_-NONE-_-NONE-';return Response.json(data);
 };
 await assert.rejects(runR2Chunk({...ingest(y),fetcher}),/identity conflicts/);assert.ok(!y.upstream.calls.some(call=>call.path.includes('/awards/CONT_AWD_FA4800')));
});

test('Adding an early-sorting award preserves other evidence chunks and the next unchanged build is byte-identical',async()=>{
 const x=await fixture(),tables=structuredClone(x.tables),template=tables.awards[0];
 const makeRow=label=>{const row=structuredClone(template),id='CONT_AWD_FA4528'+label+'_9700_-NONE-_-NONE-';row.generated_unique_award_id=id;row.piid='FA4528'+label;const record=JSON.parse(row.record_json);record.award_id=id;record.piid=row.piid;row.record_json=JSON.stringify(record);const raw=JSON.parse(row.raw_json);raw.generated_unique_award_id=id;raw.piid=row.piid;row.raw_json=JSON.stringify(raw);return row;};
 tables.awards=Array.from({length:CONFIG.r2Pilot.chunkAwards*2+5},(_,i)=>makeRow('T'+String(i).padStart(4,'0')));
 tables.award_history_pages=[];tables.award_windows=tables.awards.flatMap(row=>CONFIG.windows.map(window_start=>({generated_unique_award_id:row.generated_unique_award_id,window_start})));tables.office_publications[0].award_count=tables.awards.length;
 const a=await buildBundle(tables,{now:fixed}),index=async bundle=>{const object=bundle.objects.find(row=>row.key===bundle.manifest.lookup.key);return unpack(object.bytes,object.sha256);};
 const inserted=makeRow('0EARLY');tables.awards.unshift(inserted);tables.award_windows.unshift(...CONFIG.windows.map(window_start=>({generated_unique_award_id:inserted.generated_unique_award_id,window_start})));tables.office_publications[0].award_count++;
 const b=await buildBundle(tables,{now:fixed,previousLookup:await index(a)}),oldEvidence=a.objects.filter(row=>row.key.includes('/evidence-'));
 assert.equal(oldEvidence.filter(row=>b.objects.some(next=>next.key===row.key)).length,2);
 const c=await buildBundle(tables,{now:fixed,previousLookup:await index(b)});assert.deepEqual(c.objects.map(row=>row.key),b.objects.map(row=>row.key));
});

test('Only immutable R2 reads are cached, and newly uploaded files must be downloaded for verification',async()=>{
 const x=await fixture(),cached=cacheImmutable(x.store),key=x.bundle.objects[0].key;
 const before=x.calls.length;await cached.get(key);await cached.get(key);assert.equal(x.calls.slice(before).filter(call=>call.key===key&&call.method==='GET').length,1);
 const pointerReads=x.calls.filter(call=>call.key===CURRENT&&call.method==='GET').length;await cached.get(CURRENT);await cached.get(CURRENT);assert.equal(x.calls.filter(call=>call.key===CURRENT&&call.method==='GET').length-pointerReads,2);
 const encoded=await pack({new:'source record'}),newKey=PILOT.prefix+'/objects/new-'+encoded.sha256+'.json.gz';
 assert.equal(await cached.get(newKey),null);await cached.put(newKey,encoded.bytes,{expected:null,sha:encoded.sha256});const first=x.calls.length;assert.deepEqual((await cached.get(newKey)).bytes,encoded.bytes);assert.equal(x.calls.slice(first).filter(call=>call.key===newKey&&call.method==='GET').length,1);
});
