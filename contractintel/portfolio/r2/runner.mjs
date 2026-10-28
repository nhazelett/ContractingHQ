import {createHttpD1} from '../d1-http.mjs';
import {publication} from '../read.mjs';
import {exportOffice} from '../../benchmarks/r2/export.mjs';
import {receiptFor,recordValidation,publishD1} from '../publication-d1.mjs';
import {progressMetadata} from './progress.mjs';
import {retryGateway} from './retry.mjs';
import {continuationDecision} from './cohort-policy.mjs';
import {validAdmission} from './admission.mjs';
import {cleanupRetained} from './retention.mjs';
// GitHub Actions entry point for the FA4528-only R2 shadow updater.
// D1 is authoritative; R2 is generated only from a validated D1 publication.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG,r2Profile} from '../ingest.mjs';
import {wait} from '../../web/source-requests.mjs';
import {counts,compareOffice} from '../compare.mjs';
import {compareCSV} from '../../benchmarks/r2/csv.mjs';
import {createFormat} from './format.mjs';
import {createOfficeIngest} from './ingest.mjs';
import {cacheImmutable} from './cache.mjs';

import {automaticProfile} from '../queue/profile.mjs';
const automaticOffice=process.env.AUTOMATIC_OFFICE;
const profile=automaticOffice?automaticProfile(automaticOffice,JSON.parse(await fs.readFile(new URL('../../worker/offices.json',import.meta.url),'utf8'))):r2Profile(process.env.PILOT_OFFICE||CONFIG.r2Pilot.office);
const {PILOT,bytes,pack,digest,validateManifest,restoreBundle,unpack,canonical,snapshotFromTables}=createFormat(profile);
const {SETTINGS,CURRENT,loadPublication,runR2Chunk,publishCandidate}=createOfficeIngest(profile);
const root=new URL('../../',import.meta.url),output=new URL('./out/',import.meta.url);
const report={office:SETTINGS.office,started_at:new Date().toISOString(),status:'starting',production_changed:false,d1_requests:0,
 source_requests:0,r2:{http_requests:0,reads:0,writes:0,uploaded_bytes:0},chunks:[],temporary_worker_deleted:null};
let secret='',workerName=null,cf=null;
const must=(condition,message)=>{if(!condition)throw new Error(message);};
const save=async()=>{await fs.mkdir(output,{recursive:true});await fs.writeFile(new URL(SETTINGS.office.toLowerCase()+'-r2-update.json',output),JSON.stringify(report,null,2)+'\n');};
async function command(args,input=''){
 return new Promise((resolve,reject)=>{
  const child=spawn('npx',['--yes','wrangler@4.140.0',...args],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  const collect=(data,isError)=>{if(isError)stderr+=data;else stdout+=data;if(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)>PILOT.processOutputBytes)child.kill();};
  child.stdout.on('data',data=>collect(data,false));child.stderr.on('data',data=>collect(data,true));child.on('error',()=>reject(new Error('Wrangler could not start.')));
  child.on('close',code=>{const text=(stdout+'\n'+stderr).replaceAll(secret||'\0','[REDACTED]');if(code){console.error(text.slice(-PILOT.processOutputBytes));reject(new Error('Temporary gateway '+args[0]+' failed.'));}else{console.log(text);resolve(stdout);}});child.stdin.end(input);
 });
}
async function main(){
 const configuration=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),token=process.env.CLOUDFLARE_API_TOKEN;
 must(token,'Cloudflare repository secret is missing.');
 const database=configuration.d1_databases?.find(b=>b.binding==='PORTFOLIO_DB')?.database_id;must(database,'Authoritative D1 binding is missing.');
 const db=createHttpD1({account:configuration.account_id,database,token,fetcher:async(...args)=>{must(report.d1_requests<CONFIG.authority.maxHTTPRequestsPerJob,'D1 job budget reached; saved staging will resume.');report.d1_requests++;return fetch(...args);}});
 await db.prepare(await fs.readFile(new URL('portfolio/migrations/0004.sql',root),'utf8')).run();

 if(automaticOffice){const claim=await db.prepare('SELECT c.lease_id,j.office_dodaac,j.lease_until FROM portfolio_rollout_control c JOIN portfolio_rollout_jobs j ON j.lease_id=c.lease_id WHERE c.singleton=1').first();must(claim?.lease_id===process.env.ROLLOUT_CLAIM_ID&&claim.office_dodaac===automaticOffice&&Date.parse(claim.lease_until)>Date.now(),'Automatic office requires a current durable queue claim.');}
 const mode=process.env.RUN_MODE||'nightly';must(CONFIG.modes.includes(mode),'Invalid ingest mode.');
 must(!process.env.PILOT_OFFICE||process.env.PILOT_OFFICE===SETTINGS.office,'Office is outside the configured rollout.');
 cf=async(path,method='GET',body)=>{
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+configuration.account_id+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});
  let data;try{data=await response.json();}catch{throw new Error('Unreadable Cloudflare setup response.');}
  return {ok:response.ok&&data.success,status:response.status,data};
 };
 let bucket=await cf('/r2/buckets/'+SETTINGS.bucket);
 if(!bucket.ok&&bucket.status===404){bucket=await cf('/r2/buckets','POST',{name:SETTINGS.bucket});if(!bucket.ok)bucket=await cf('/r2/buckets/'+SETTINGS.bucket);}
 must(bucket.ok,'The private R2 shadow bucket could not be opened.');
 for(const name of [SETTINGS.bucket,SETTINGS.baselineBucket]){const managed=await cf('/r2/buckets/'+name+'/domains/managed');must(managed.ok&&managed.data.result.enabled===false,'Private bucket status could not be confirmed.');}
 report.bucket=SETTINGS.bucket;report.bucket_public_access=false;
 workerName=SETTINGS.workerPrefix+'-'+(process.env.GITHUB_RUN_ID||Date.now())+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
 const directory=new URL('./.run/',import.meta.url);await fs.mkdir(directory,{recursive:true});const configPath=fileURLToPath(new URL('wrangler.json',directory));
 await fs.writeFile(new URL('gateway-entry.mjs',directory),"import {createGateway} from '../gateway.mjs';\nexport default createGateway("+JSON.stringify(profile)+");\n");
 await fs.writeFile(configPath,JSON.stringify({name:workerName,main:'gateway-entry.mjs',account_id:configuration.account_id,compatibility_date:configuration.compatibility_date,workers_dev:true,preview_urls:false,observability:{enabled:false},limits:{cpu_ms:PILOT.workerCPUMs},r2_buckets:[{binding:'TARGET',bucket_name:SETTINGS.bucket},{binding:'BASELINE',bucket_name:SETTINGS.baselineBucket}]},null,2));
 secret=crypto.randomUUID()+crypto.randomUUID();if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+secret);
 const deployed=await command(['deploy','--config',configPath]),url=(deployed.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/g)||[]).find(value=>new URL(value).hostname.startsWith(workerName+'.'));
 must(url,'The temporary gateway address was not returned.');await command(['secret','put','R2_UPDATE_TOKEN','--config',configPath],secret);
 const call=async(path,{method='GET',body,expected,sha,allow=[],summary}={})=>{
  const headers={Authorization:'Bearer '+secret};
  if(method==='DELETE')headers['X-Current-Etag']=expected;if(sha)headers['X-Object-SHA256']=sha;if(summary)headers['X-Checkpoint-Summary']=JSON.stringify(summary);
  if(method==='PUT')headers[expected===null?'If-None-Match':'If-Match']=expected===null?'*':expected;
  const attempt=async()=>{
   must(++report.r2.http_requests<=SETTINGS.maxHTTPRequestsPerJob,'Gateway request budget reached.');
   if(body){must(report.r2.uploaded_bytes+body.length<=SETTINGS.maxUploadBytesPerJob,'Job upload budget reached.');report.r2.uploaded_bytes+=body.length;}
   const response=await fetch(url+path,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});
   report.r2.reads+=Number(response.headers.get('X-R2-Reads')||0);report.r2.writes+=Number(response.headers.get('X-R2-Writes')||0);return response;
  };
  let response;
  for(let readyAttempt=0;readyAttempt<CONFIG.secretReadyAttempts;readyAttempt++){
   if(readyAttempt)await wait(CONFIG.secretWaitMs);
   response=await retryGateway(attempt,{sleep:wait,onRetry:details=>{report.gateway_retries=(report.gateway_retries||0)+1;console.log(JSON.stringify({gateway_retry:details}));}});
   if(response.status!==401&&!(response.status===404&&!response.headers.has('X-R2-Reads')))break;
   await response.body?.cancel();
  }
  if(!response.ok&&!allow.includes(response.status)){let message='R2 gateway HTTP '+response.status;try{message+=': '+(await response.json()).error;}catch{}throw new Error(message);}
  return response;
 };
 let ready=false;for(let attempt=0;attempt<PILOT.readyAttempts;attempt++){const response=await call('/health',{allow:[401,404,503]});if(response.ok){ready=true;break;}await wait(PILOT.readyWaitMs);}must(ready,'Temporary gateway did not become ready.');
 const remote=area=>({
  async get(key){const response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{allow:[404]});if(response.status===404)return null;const value={bytes:new Uint8Array(await response.arrayBuffer()),etag:response.headers.get('ETag')};if(key===SETTINGS.checkpointKey)report.checkpoint_bytes=value.bytes.length;return value;},
  async head(key){const response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'HEAD',allow:[404]});return response.status===404?null:{sha:response.headers.get('X-Object-SHA256'),etag:response.headers.get('ETag')};},
  async remove(key,expected){return (await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'DELETE',expected})).json();},
  async put(key,body,options){let response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'PUT',body,...options,allow:[412]});if(response.status===412){const head=await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'HEAD'});must(head.headers.get('X-Object-SHA256')===options.sha,'Conditional write identity differs; review required.');return {etag:head.headers.get('ETag')};}return {etag:response.headers.get('ETag')};}
 });
 const store=cacheImmutable(remote('target'),profile),baseline=cacheImmutable(remote('baseline'),profile);
 if(process.env.REQUIRE_ADMISSION==='true'&&!profile.readEnabled){const admission=await store.get(SETTINGS.admissionKey);if(!admission||!validAdmission(JSON.parse(new TextDecoder().decode(admission.bytes)),SETTINGS.office)){report.status='not_admitted';return;}report.admission_present=true;}
 report.seeded_from_verified_r2=false;
 let before=await loadPublication(store);report.previous_publication_id=before?.manifest.source_publication_id||null;
 report.retention_before=before?await cleanupRetained(store,before,profile):{deleted:0,protected_or_grace:0};
 const directoryData=JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8'));
 // This fetcher is exclusively for the source adapter. Every source operation
 // is either a GET award read or one of the existing read-only search POSTs.
 const fetcher=async(sourceURL,options={})=>{
  must(report.source_requests<SETTINGS.maxSourceRequestsPerJob,'Job source-request budget reached.');report.source_requests++;
  const parsed=new URL(sourceURL);const category=parsed.pathname.includes('spending_by_award')?(options.body&&JSON.parse(options.body).filters?.time_period?.[0]?.date_type==='last_modified_date'?'changed_discovery':'full_discovery'):parsed.pathname.includes('spending_by_transaction')?'fiscal':parsed.pathname==='/api/v2/transactions/'?'evidence':'award_detail';report.source_breakdown??={};report.source_breakdown[category]=(report.source_breakdown[category]||0)+1;must(parsed.origin==='https://api.usaspending.gov'&&((options.method||'GET')==='GET'&&parsed.pathname.startsWith('/api/v2/awards/')||options.method==='POST'&&['/api/v2/search/spending_by_award/','/api/v2/search/spending_by_transaction/','/api/v2/transactions/'].includes(parsed.pathname)),'Unexpected source operation refused.');
  try{const response=await fetch(sourceURL,options);if(!response.ok)(report.source_failures??=[]).push({status:response.status,path:parsed.pathname});return response;}catch(error){report.source_network_errors=(report.source_network_errors||0)+1;throw error;}
 };

 const checkApplication=async({tables,restored})=>{
  const checks=[];for(const start of CONFIG.windows){const expected=snapshotFromTables(tables,start),actual=snapshotFromTables(restored,start);must(canonical(expected)===canonical(actual),'Stored application payload differs.');const csv=await compareCSV(expected.records,actual.records,actual.today);must(csv.every(check=>check.match),'Stored CSV output differs.');checks.push({start,awards:actual.records.length,full_payload_match:true,csv_checks:csv.length});}report.application_checks=checks;
 };
 // Repair the existing FA4528 cache from D1, never by treating an older R2 copy as authoritative.
 const existingD1=await publication(db,SETTINGS.office);
 if(existingD1&&before?.manifest.d1_publication_version!==existingD1.published_run_id){
  const tables=await exportOffice(db,{profile}),base=before||{etag:null,manifest:{version:null,retained_versions:[]}};
  await publishCandidate(store,base,{work_id:existingD1.published_run_id},tables,{d1PublicationVersion:existingD1.published_run_id,beforePublish:checkApplication});
  before=await loadPublication(store);report.authority_cache_repaired=true;
 }
 let result,candidate;
 for(let chunk=0;chunk<SETTINGS.maxChunksPerJob;chunk++){
  if(chunk&&SETTINGS.maxUploadBytesPerJob-report.r2.uploaded_bytes<2*SETTINGS.maxCheckpointBytes)throw new Error('Job upload budget reached; stopped before starting another source chunk.');
  result=await runR2Chunk({store,directory:directoryData,mode,fetcher,force:process.env.FORCE_R2_REFRESH==='true',prepareOnly:true,onPrepared:async value=>{candidate=value;}});
  report.chunks.push(result);await save();console.log(JSON.stringify({r2_update_chunk:result}));
  if(['prepared','completed','retained'].includes(result.status))break;
 }
 must(result&&['prepared','completed','retained'].includes(result.status),'Chunk limit reached; saved progress will resume on the next run.');
 if(!candidate&&before&&!existingD1)candidate={tables:before.tables,state:{work_id:before.manifest.source_publication_id},base:before};
 if(candidate){
  const {tables,state,base}=candidate;
  await checkApplication({tables,restored:tables});
  let receipt=(await receiptFor(db,tables,profile)).row;
  if(!receipt){
   let comparison;
   if(process.env.PERFORM_VERIFY==='true'||!existingD1){
    const saved=await store.get(SETTINGS.verificationKey);let pending=saved?await unpack(saved.bytes,null,SETTINGS.maxCheckpointJSONBytes):null,etag=saved?.etag||null,saves=0;
    const persist=async()=>{if(!pending)return;const packed=await pack(pending);const summary={office:SETTINGS.office,format_version:SETTINGS.formatVersion,work_id:state.work_id,...progressMetadata(pending,true)};const saved=await store.put(SETTINGS.verificationKey,packed.bytes,{expected:etag,sha:packed.sha256,summary});etag=saved.etag;};
    try{
     must(!pending||pending.requests<SETTINGS.maxVerificationRequests,'Independent verification request budget reached; review required.');
     comparison=await compareOffice({office:SETTINGS.office,automaticOffice,directory:directoryData,publicationKey:state.work_id,checkpoint:pending,fetcher,getSnapshot:async start=>snapshotFromTables(tables,start),onCheckpoint:async value=>{pending=value;must(pending.requests<=SETTINGS.maxVerificationRequests,'Independent verification request budget reached; review required.');if(++saves%SETTINGS.verificationSaveEvery===0)await persist();}});
    }finally{await persist();}
    report.independent_comparison=comparison;must(comparison.match,'Independent source comparison did not match; D1 publication retained.');
   }else comparison={match:true,kind:'incremental_source_and_full_payload_validation',checks:report.application_checks,publication_id:state.work_id};
   receipt=await recordValidation(db,tables,profile,comparison);
  }
  const authoritative=await publishD1(db,tables,profile);report.d1_publication_version=authoritative.version;report.d1_round_trip_match=true;
  result={status:'completed',...await publishCandidate(store,base,state,authoritative.tables,{d1PublicationVersion:authoritative.version,beforePublish:checkApplication})};
  if(profile.admitOnVerified){
   const prior=await store.get(SETTINGS.admissionKey),value=bytes({office:SETTINGS.office,verified:true,schema_version:CONFIG.schemaVersion,publication_id:authoritative.version,comparison_sha256:await digest(receipt.comparison_json),verified_at:new Date().toISOString()});
   await store.put(SETTINGS.admissionKey,value,{expected:prior?.etag||null,sha:await digest(value)});report.cache_admitted=true;
  }
 }
 const after=await loadPublication(store);report.production_changed=(profile.readEnabled||report.admission_present||report.cache_admitted)&&result.status==='completed';report.publication_id=after.manifest.source_publication_id;report.source_published_at=after.manifest.source_published_at;
 report.views=CONFIG.windows.map(start=>{const prior=before?snapshotFromTables(before.tables,start):{records:[]},current=snapshotFromTables(after.tables,start);return {start,today:current.today,before:counts(prior.records,current.today),after:counts(current.records,current.today),fiscal_totals:current.fiscal_totals.map(({award_ids,...total})=>total)};});
 report.change_summary={new_awards:after.tables.awards.filter(row=>!(before?.tables.awards||[]).some(old=>old.generated_unique_award_id===row.generated_unique_award_id)).length,removed_awards:(before?.tables.awards||[]).filter(row=>!after.tables.awards.some(next=>next.generated_unique_award_id===row.generated_unique_award_id)).length,changed_awards:after.tables.awards.filter(row=>{const old=(before?.tables.awards||[]).find(previous=>previous.generated_unique_award_id===row.generated_unique_award_id);return old&&old.source_hash!==row.source_hash;}).length};
 report.retention_cleanup=await cleanupRetained(store,after,profile);
 const ledger=await store.get(SETTINGS.ledgerKey),keys=JSON.parse(new TextDecoder().decode(ledger.bytes)).keys;
 report.reserved_storage_bytes=Object.values(keys).reduce((sum,entry)=>sum+entry.bytes,0)+SETTINGS.maxLedgerBytes;
 const pointer=await store.get(CURRENT),checkpoint=await store.get(SETTINGS.checkpointKey);
 report.actual_stored_bytes=Object.entries(keys).filter(([key])=>![CURRENT,SETTINGS.checkpointKey].includes(key)).reduce((sum,[,entry])=>sum+entry.bytes,0)+ledger.bytes.length+pointer.bytes.length+(checkpoint?.bytes.length||0);
 report.stored_objects=Object.keys(keys).length+1;
 report.stored_compressed_publication_bytes=after.manifest.objects.reduce((sum,object)=>sum+object.compressed_bytes,0);
 report.read_enabled=profile.readEnabled;report.limitations=[profile.readEnabled?'This office is enabled for cached reads.':'Cached reads remain disabled until the independent comparison gate passes.','Independent-source verification, when requested, is reported separately; the source can change during a scan.','Current and previous complete versions are retained. Unreferenced older objects are removed only after the configured grace period; byte/object guards still stop growth.'];
 report.read_enabled=profile.readEnabled||report.cache_admitted===true||report.admission_present===true;

 if(profile.admitOnVerified&&after.manifest.d1_publication_version&&!report.cache_admitted){
  const receipt=await db.prepare("SELECT * FROM portfolio_publication_receipts WHERE publication_id=? AND status='published'").bind(after.manifest.d1_publication_version).first();
  must(receipt?.office_dodaac===SETTINGS.office&&JSON.parse(receipt.comparison_json).match===true,'D1 authority admission receipt is missing.');
  const prior=await store.get(SETTINGS.admissionKey),old=prior?JSON.parse(new TextDecoder().decode(prior.bytes)):null;
  if(!validAdmission(old,SETTINGS.office)||old.publication_id!==after.manifest.d1_publication_version){
   const value=bytes({office:SETTINGS.office,verified:true,schema_version:CONFIG.schemaVersion,publication_id:after.manifest.d1_publication_version,comparison_sha256:await digest(receipt.comparison_json),verified_at:new Date().toISOString()});
   await store.put(SETTINGS.admissionKey,value,{expected:prior?.etag||null,sha:await digest(value)});
  }
  report.cache_admitted=true;report.read_enabled=true;
 }
 report.d1_publication_version??=after.manifest.d1_publication_version;
 report.authority='d1';report.status='passed';
}
try{await main();}catch(error){report.status='failed';report.error=error.message;
 if(error.result)report.failed_chunk=error.result;
 const healthyBudget=/Chunk limit reached|Job source-request budget reached|Job upload budget reached|D1 job budget reached/.test(error.message);
 if(healthyBudget)report.resume_recommended=true;
 const decision=continuationDecision(report,Number(process.env.COHORT_BATCH||'1'));
 if(process.env.AUTO_RESUME==='true'&&decision.resume){report.status='yielded';report.resume_recommended=true;process.exitCode=0;}else process.exitCode=1;
 console.error(error.message);
}finally{
 if(workerName&&cf)try{const response=await cf('/workers/scripts/'+workerName,'DELETE');must(response.ok||response.status===404,'Temporary gateway cleanup failed.');report.temporary_worker_deleted=true;}catch(error){report.temporary_worker_deleted=false;report.cleanup_error=error.message;process.exitCode=1;}
 report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({r2_update_report:report}));
}

