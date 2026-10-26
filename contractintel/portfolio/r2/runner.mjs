// GitHub Actions entry point for the FA4528-only R2 shadow updater.
// No D1 requests, no production deploy, no stored source data in job artifacts.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../ingest.mjs';
import {wait} from '../../web/source-requests.mjs';
import {counts} from '../compare.mjs';
import {compareCSV} from '../../benchmarks/r2/csv.mjs';
import {PILOT,bytes,digest,validateManifest,restoreBundle,unpack,canonical,snapshotFromTables} from './format.mjs';
import {SETTINGS,CURRENT,loadPublication,runR2Chunk} from './ingest.mjs';
import {cacheImmutable} from './cache.mjs';

const root=new URL('../../',import.meta.url),output=new URL('./out/',import.meta.url);
const report={office:SETTINGS.office,started_at:new Date().toISOString(),status:'starting',production_changed:false,d1_requests:0,
 source_requests:0,r2:{http_requests:0,reads:0,writes:0,uploaded_bytes:0},chunks:[],temporary_worker_deleted:null};
let secret='',workerName=null,cf=null;
const must=(condition,message)=>{if(!condition)throw new Error(message);};
const save=async()=>{await fs.mkdir(output,{recursive:true});await fs.writeFile(new URL('fa4528-r2-update.json',output),JSON.stringify(report,null,2)+'\n');};
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
 const mode=process.env.RUN_MODE||'nightly';must(CONFIG.modes.includes(mode),'Invalid ingest mode.');
 must(!process.env.PILOT_OFFICE||process.env.PILOT_OFFICE===SETTINGS.office,'Only FA4528 is authorized.');
 cf=async(path,method='GET',body)=>{
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+configuration.account_id+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});
  let data;try{data=await response.json();}catch{throw new Error('Unreadable Cloudflare setup response.');}
  return {ok:response.ok&&data.success,status:response.status,data};
 };
 let bucket=await cf('/r2/buckets/'+SETTINGS.bucket);
 if(!bucket.ok&&bucket.status===404)bucket=await cf('/r2/buckets','POST',{name:SETTINGS.bucket});
 must(bucket.ok,'The private R2 shadow bucket could not be opened.');
 for(const name of [SETTINGS.bucket,SETTINGS.baselineBucket]){const managed=await cf('/r2/buckets/'+name+'/domains/managed');must(managed.ok&&managed.data.result.enabled===false,'Private bucket status could not be confirmed.');}
 report.bucket=SETTINGS.bucket;report.bucket_public_access=false;
 workerName=SETTINGS.workerPrefix+'-'+(process.env.GITHUB_RUN_ID||Date.now())+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
 const directory=new URL('./.run/',import.meta.url);await fs.mkdir(directory,{recursive:true});const configPath=fileURLToPath(new URL('wrangler.json',directory));
 await fs.writeFile(configPath,JSON.stringify({name:workerName,main:'../gateway.mjs',account_id:configuration.account_id,compatibility_date:configuration.compatibility_date,workers_dev:true,preview_urls:false,observability:{enabled:false},limits:{cpu_ms:PILOT.workerCPUMs},r2_buckets:[{binding:'TARGET',bucket_name:SETTINGS.bucket},{binding:'BASELINE',bucket_name:SETTINGS.baselineBucket}]},null,2));
 secret=crypto.randomUUID()+crypto.randomUUID();if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+secret);
 const deployed=await command(['deploy','--config',configPath]),url=(deployed.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/g)||[]).find(value=>new URL(value).hostname.startsWith(workerName+'.'));
 must(url,'The temporary gateway address was not returned.');await command(['secret','put','R2_UPDATE_TOKEN','--config',configPath],secret);
 const call=async(path,{method='GET',body,expected,sha,allow=[]}={})=>{
  must(++report.r2.http_requests<=SETTINGS.maxHTTPRequestsPerJob,'Gateway request budget reached.');
  if(body){must(report.r2.uploaded_bytes+body.length<=SETTINGS.maxUploadBytesPerJob,'Job upload budget reached.');report.r2.uploaded_bytes+=body.length;}
  const headers={Authorization:'Bearer '+secret};if(sha)headers['X-Object-SHA256']=sha;
  if(method==='PUT')headers[expected===null?'If-None-Match':'If-Match']=expected===null?'*':expected;
  let response;
  for(let attempt=0;attempt<CONFIG.secretReadyAttempts;attempt++){
   if(attempt){must(++report.r2.http_requests<=SETTINGS.maxHTTPRequestsPerJob,'Gateway request budget reached.');await wait(CONFIG.secretWaitMs);}
   response=await fetch(url+path,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});
   if(response.status!==401)break;
   await response.body?.cancel();
  }
  report.r2.reads+=Number(response.headers.get('X-R2-Reads')||0);report.r2.writes+=Number(response.headers.get('X-R2-Writes')||0);
  if(!response.ok&&!allow.includes(response.status)){let message='R2 gateway HTTP '+response.status;try{message+=': '+(await response.json()).error;}catch{}throw new Error(message);}
  return response;
 };
 let ready=false;for(let attempt=0;attempt<PILOT.readyAttempts;attempt++){const response=await call('/health',{allow:[401,404,503]});if(response.ok){ready=true;break;}await wait(PILOT.readyWaitMs);}must(ready,'Temporary gateway did not become ready.');
 const remote=area=>({
  async get(key){const response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{allow:[404]});return response.status===404?null:{bytes:new Uint8Array(await response.arrayBuffer()),etag:response.headers.get('ETag')};},
  async head(key){const response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'HEAD',allow:[404]});return response.status===404?null:{sha:response.headers.get('X-Object-SHA256'),etag:response.headers.get('ETag')};},
  async put(key,body,options){const response=await call('/object?area='+area+'&key='+encodeURIComponent(key),{method:'PUT',body,...options});return {etag:response.headers.get('ETag')};}
 });
 const store=cacheImmutable(remote('target')),baseline=cacheImmutable(remote('baseline'));
 if(!await store.get(CURRENT)){
  const pointer=await baseline.get(CURRENT);must(pointer,'The previously verified FA4528 pilot is missing.');
  const manifest=validateManifest(JSON.parse(new TextDecoder().decode(pointer.bytes)));
  // Bootstrap only from the previously verified private R2 copy. No D1 export.
  const objects=new Map();for(const descriptor of manifest.objects){const object=await baseline.get(descriptor.key);must(object&&await digest(object.bytes)===descriptor.sha256,'Baseline checksum differs.');objects.set(descriptor.key,object.bytes);}
  const source=await restoreBundle(manifest,descriptor=>unpack(objects.get(descriptor.key),descriptor.sha256));
  for(const descriptor of manifest.objects)if(!await store.head(descriptor.key))await store.put(descriptor.key,objects.get(descriptor.key),{expected:null,sha:descriptor.sha256});
  const restored=await restoreBundle(manifest,async descriptor=>unpack((await store.get(descriptor.key)).bytes,descriptor.sha256));must(canonical(restored)===canonical(source),'Bootstrap round trip differs.');
  await store.put(CURRENT,pointer.bytes,{expected:null,sha:await digest(pointer.bytes)});report.seeded_from_verified_r2=true;
 }else report.seeded_from_verified_r2=false;
 const before=await loadPublication(store);report.previous_publication_id=before.manifest.source_publication_id;
 const directoryData=JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8'));
 // This fetcher is exclusively for the source adapter. Every source operation
 // is either a GET award read or one of the existing read-only search POSTs.
 const fetcher=async(sourceURL,options={})=>{
  must(++report.source_requests<=SETTINGS.maxSourceRequestsPerJob,'Job source-request budget reached.');
  const parsed=new URL(sourceURL);must(parsed.origin==='https://api.usaspending.gov'&&((options.method||'GET')==='GET'&&parsed.pathname.startsWith('/api/v2/awards/')||options.method==='POST'&&['/api/v2/search/spending_by_award/','/api/v2/search/spending_by_transaction/','/api/v2/transactions/'].includes(parsed.pathname)),'Unexpected source operation refused.');
  return fetch(sourceURL,options);
 };
 let result;
 for(let chunk=0;chunk<SETTINGS.maxChunksPerJob;chunk++){
  result=await runR2Chunk({store,directory:directoryData,mode,fetcher,beforePublish:async({tables,restored})=>{
   const checks=[];for(const start of CONFIG.windows){const expected=snapshotFromTables(tables,start),actual=snapshotFromTables(restored,start);must(canonical(expected)===canonical(actual),'Stored application payload differs.');const csv=await compareCSV(expected.records,actual.records,actual.today);must(csv.every(check=>check.match),'Stored CSV output differs.');checks.push({start,awards:actual.records.length,full_payload_match:true,csv_checks:csv.length});}report.application_checks=checks;
  }});
  report.chunks.push(result);await save();console.log(JSON.stringify({r2_update_chunk:result}));
  if(['completed','retained'].includes(result.status))break;
 }
 must(result&&['completed','retained'].includes(result.status),'Chunk limit reached; saved progress will resume on the next manual run.');
 const after=await loadPublication(store);report.publication_id=after.manifest.source_publication_id;report.source_published_at=after.manifest.source_published_at;
 report.views=CONFIG.windows.map(start=>{const prior=snapshotFromTables(before.tables,start),current=snapshotFromTables(after.tables,start);return {start,today:current.today,before:counts(prior.records,current.today),after:counts(current.records,current.today),fiscal_totals:current.fiscal_totals.map(({award_ids,...total})=>total)};});
 report.change_summary={new_awards:after.tables.awards.filter(row=>!before.tables.awards.some(old=>old.generated_unique_award_id===row.generated_unique_award_id)).length,removed_awards:before.tables.awards.filter(row=>!after.tables.awards.some(next=>next.generated_unique_award_id===row.generated_unique_award_id)).length,changed_awards:after.tables.awards.filter(row=>{const old=before.tables.awards.find(previous=>previous.generated_unique_award_id===row.generated_unique_award_id);return old&&old.source_hash!==row.source_hash;}).length};
 const unchangedBefore=report.r2.writes,replay=await runR2Chunk({store,directory:directoryData,fetcher:async()=>{throw new Error('Same-day replay must not fetch the source.');}});must(replay.status==='retained'&&report.r2.writes===unchangedBefore,'Same-day replay did work.');report.same_day_replay={status:replay.status,source_requests:0,r2_writes:report.r2.writes-unchangedBefore};
 const ledger=await store.get(SETTINGS.ledgerKey),keys=JSON.parse(new TextDecoder().decode(ledger.bytes)).keys;
 report.reserved_storage_bytes=Object.values(keys).reduce((sum,entry)=>sum+entry.bytes,0)+SETTINGS.maxLedgerBytes;
 const pointer=await store.get(CURRENT),checkpoint=await store.get(SETTINGS.checkpointKey);
 report.actual_stored_bytes=Object.entries(keys).filter(([key])=>![CURRENT,SETTINGS.checkpointKey].includes(key)).reduce((sum,[,entry])=>sum+entry.bytes,0)+ledger.bytes.length+pointer.bytes.length+(checkpoint?.bytes.length||0);
 report.stored_objects=Object.keys(keys).length+1;
 report.stored_compressed_publication_bytes=after.manifest.objects.reduce((sum,object)=>sum+object.compressed_bytes,0);
 report.limitations=['Shadow R2 publication only; the live website and Cron continue using the existing D1 path.','This is an incremental refresh from the previously verified baseline, not another independent 4,091-award source backfill.','At two published versions or the configured byte/object budget, further updates stop for review. No raw evidence is deleted.'];
 report.status='passed';
}
try{await main();}catch(error){report.status='failed';report.error=error.message;if(error.result)report.failed_chunk=error.result;console.error(error.message);process.exitCode=1;}finally{
 if(workerName&&cf)try{const response=await cf('/workers/scripts/'+workerName,'DELETE');must(response.ok||response.status===404,'Temporary gateway cleanup failed.');report.temporary_worker_deleted=true;}catch(error){report.temporary_worker_deleted=false;report.cleanup_error=error.message;process.exitCode=1;}
 report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({r2_update_report:report}));
}
