// One-office, read-only D1 export and isolated R2 benchmark. No source API calls.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../../portfolio/ingest.mjs';
import {createHttpD1} from '../../portfolio/d1-http.mjs';
import {officeSnapshot,storedAward,publication} from '../../portfolio/read.mjs';
import {counts} from '../../portfolio/compare.mjs';
import {wait} from '../../web/source-requests.mjs';
import {exportOffice} from './export.mjs';
import {compareCSV} from './csv.mjs';
import {PILOT,buildBundle,restoreBundle,unpack,canonical,compatible,bytes,digest,validateManifest,snapshotFromTables} from './core.mjs';
const root=new URL('../../',import.meta.url),output=new URL('./out/',import.meta.url),currentKey=PILOT.prefix+'/current.json';
const report={office:PILOT.office,started_at:new Date().toISOString(),production_changed:false,source_api_calls:0,d1:{http_requests:0,rows_read:0,rows_written:0},r2:{http_requests:0,reads:0,writes:0,uploaded_bytes:0},cloud_status:'not_started',temporary_worker_deleted:null};
let temporaryConfig=null,temporaryName=null,secret='',remoteBase='';
const save=async()=>{await fs.mkdir(output,{recursive:true});await fs.writeFile(new URL('fa4528-r2-report.json',output),JSON.stringify(report,null,2)+'\n');};
function must(condition,message){if(!condition)throw new Error(message);}
async function command(args,input=''){
 return new Promise((resolve,reject)=>{const child=spawn('npx',['--yes','wrangler@4.140.0',...args],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',data=>{stdout+=data;if(Buffer.byteLength(stdout)>PILOT.processOutputBytes)child.kill();});child.stderr.on('data',data=>{stderr+=data;if(Buffer.byteLength(stderr)>PILOT.processOutputBytes)child.kill();});child.on('error',()=>reject(new Error('Wrangler process could not start.')));child.on('close',code=>{if(code!==0){console.error((stderr||stdout).replaceAll(secret||'\0','[REDACTED]').slice(-PILOT.processOutputBytes));reject(new Error('Wrangler '+args[0]+' failed; benchmark source remains unchanged.'));}else{console.log(stdout.replaceAll(secret||'\0','[REDACTED]'));resolve(stdout);}});child.stdin.end(input);
 });
}
async function main(){
 const configuration=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),binding=configuration.d1_databases.find(b=>b.binding==='PORTFOLIO_DB'),token=process.env.CLOUDFLARE_API_TOKEN;must(token,'Cloudflare repository secret is missing.');
 const cf=async(path,method='GET',body)=>{const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+configuration.account_id+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});let data;try{data=await response.json();}catch{throw new Error('Cloudflare returned an unreadable benchmark response.');}return {ok:response.ok&&data.success,status:response.status,data};};
 const auditedFetch=async(url,options)=>{
  must(++report.d1.http_requests<=PILOT.maxD1Requests,'D1 read-request budget reached.');const body=JSON.parse(options.body),statements=body.batch||[body];must(statements.every(s=>/^SELECT\b/i.test(s.sql.trim())),'Benchmark refuses any D1 mutation.');
  const response=await fetch(url,options);if(response.ok){const data=await response.clone().json();for(const result of data.result||[]){report.d1.rows_read+=result.meta?.rows_read||0;report.d1.rows_written+=result.meta?.rows_written||0;}}return response;
 };
 const db=createHttpD1({account:configuration.account_id,database:binding.database_id,token,fetcher:auditedFetch});
 console.log(JSON.stringify({stage:'export_existing_d1',office:PILOT.office}));
 const tables=await exportOffice(db),bundle=await buildBundle(tables),map=new Map(bundle.objects.map(object=>[object.key,object]));
 const local=await restoreBundle(bundle.manifest,descriptor=>unpack(map.get(descriptor.key).bytes,descriptor.sha256));must(canonical(local)===canonical(tables),'Local round-trip changed source fields.');
 report.source_publication_id=bundle.manifest.source_publication_id;report.source_published_at=bundle.manifest.source_published_at;report.source_encoded_bytes=bundle.source_encoded_bytes;report.compressed_bytes=bundle.compressed_bytes;report.objects=bundle.objects.length;report.compression_ratio=bundle.source_encoded_bytes/bundle.compressed_bytes;
 report.table_fields=await Promise.all(Object.entries(tables).map(async([table,rows])=>({table,rows:rows.length,columns:rows.length?Object.keys(rows[0]):[],sha256:await digest(canonical(rows)),exact_local_match:canonical(rows)===canonical(local[table])})));
 report.local_payloads=[];for(const start of CONFIG.windows){const expected=await officeSnapshot(db,PILOT.office,start),actual=snapshotFromTables(local,start);must(canonical(compatible(actual))===canonical(compatible(expected)),'Local snapshot changed page data.');report.local_payloads.push({start,awards:actual.records.length,match:true});}
 must(report.d1.rows_written===0,'D1 writes were detected.');report.cloud_status='local_export_verified';await save();
 console.log(JSON.stringify({stage:'local_export_verified',awards:tables.awards.length,compressed_bytes:bundle.compressed_bytes,objects:bundle.objects.length,d1_rows_written:report.d1.rows_written}));
 let bucket=await cf('/r2/buckets/'+PILOT.bucket);if(!bucket.ok&&bucket.status===404)bucket=await cf('/r2/buckets','POST',{name:PILOT.bucket});
 if(!bucket.ok){report.cloud_status='blocked';report.blocker={stage:'r2_bucket',http_status:bucket.status,codes:(bucket.data.errors||[]).map(e=>e.code)};throw new Error('R2 bucket access/setup is unavailable; see the report. No production data changed.');}
 const managed=await cf('/r2/buckets/'+PILOT.bucket+'/domains/managed');if(!managed.ok||managed.data.result.enabled!==false){report.cloud_status='blocked';report.blocker={stage:'private_bucket_check',http_status:managed.status,codes:(managed.data.errors||[]).map(e=>e.code)};throw new Error('Private bucket status could not be confirmed; benchmark stopped.');}
 report.bucket=PILOT.bucket;report.bucket_public_access=false;
 const runSuffix=(process.env.GITHUB_RUN_ID||Date.now().toString())+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');temporaryName=PILOT.workerPrefix+'-'+runSuffix;
 const directory=new URL('./.pilot-run/',import.meta.url);await fs.mkdir(directory,{recursive:true});temporaryConfig=fileURLToPath(new URL('wrangler.json',directory));
 await fs.writeFile(temporaryConfig,JSON.stringify({name:temporaryName,main:'../worker.mjs',account_id:configuration.account_id,compatibility_date:configuration.compatibility_date,workers_dev:true,preview_urls:false,observability:{enabled:false},limits:{cpu_ms:PILOT.workerCPUMs},r2_buckets:[{binding:'BUCKET',bucket_name:PILOT.bucket}]},null,2));
 secret=crypto.randomUUID()+crypto.randomUUID();console.log('::add-mask::'+secret);
 const deployment=await command(['deploy','--config',temporaryConfig]),addresses=deployment.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/g)||[];remoteBase=addresses.find(address=>new URL(address).hostname.startsWith(temporaryName+'.'));must(remoteBase,'Temporary Worker URL was not returned.');
 await command(['secret','put','R2_BENCH_TOKEN','--config',temporaryConfig],secret);
 const call=async(path,{method='GET',body,sha,authenticated=true,allow=[]}={})=>{
  must(++report.r2.http_requests<=PILOT.maxHTTPRequests,'R2 benchmark request budget reached.');const response=await fetch(remoteBase+path,{method,headers:{...(authenticated?{Authorization:'Bearer '+secret}:{}),...(sha?{'X-Object-SHA256':sha}:{})},body,redirect:'error',signal:AbortSignal.timeout(PILOT.httpTimeoutMs)});report.r2.reads+=Number(response.headers.get('X-Benchmark-R2-Reads')||0);report.r2.writes+=Number(response.headers.get('X-Benchmark-R2-Writes')||0);if(!response.ok&&!allow.includes(response.status))throw new Error('R2 benchmark endpoint returned HTTP '+response.status+' at '+path.split('?')[0]);return response;
 };
 let ready=false;for(let attempt=0;attempt<PILOT.readyAttempts;attempt++){const response=await call('/__bench/health',{allow:[401,503]});if(response.ok){ready=true;break;}await wait(PILOT.readyWaitMs);}must(ready,'Temporary Worker credential did not become ready.');
 must((await call('/api/office/FA4528',{authenticated:false,allow:[401]})).status===401,'Unauthenticated benchmark access was allowed.');must((await call('/api/office/FA4800',{allow:[404]})).status===404,'Another office was accessible.');
 const objectPath=key=>'/__bench/object?key='+encodeURIComponent(key),priorResponse=await call(objectPath(currentKey),{allow:[404]}),prior=priorResponse.ok?validateManifest(await priorResponse.json()):null;
 const retained=[...new Set([bundle.manifest.version,...(prior?.retained_versions||[])])];must(retained.length<=PILOT.maxStoredVersions,'Pilot retention guard reached; existing copies retained.');bundle.manifest.retained_versions=retained;
 const uploadObjects=async()=>{let uploaded=0;for(const object of bundle.objects){const head=await call(objectPath(object.key),{method:'HEAD',allow:[404]});if(head.ok&&head.headers.get('X-Object-SHA256')===object.sha256)continue;await call(objectPath(object.key),{method:'PUT',body:object.bytes,sha:object.sha256});uploaded++;report.r2.uploaded_bytes+=object.bytes.length;}return uploaded;};
 const uploaded=await uploadObjects();
 console.log(JSON.stringify({stage:'uploaded_owned_pilot_objects',new_objects:uploaded,bytes:report.r2.uploaded_bytes}));
 const downloaded=new Map();for(const object of bundle.objects){const response=await call(objectPath(object.key));const data=new Uint8Array(await response.arrayBuffer());must(await digest(data)===object.sha256,'R2 object checksum differs from the source copy.');downloaded.set(object.key,data);}
 const restored=await restoreBundle(bundle.manifest,descriptor=>unpack(downloaded.get(descriptor.key),descriptor.sha256));must(canonical(restored)===canonical(tables),'R2 changed source fields.');report.raw_round_trip_match=true;
 const pointer=bytes(bundle.manifest);if(prior?.version!==bundle.manifest.version)await call(objectPath(currentKey),{method:'PUT',body:pointer,sha:await digest(pointer)});
 const before=await (await call(objectPath(currentKey))).text(),invalid=structuredClone(bundle.manifest);invalid.objects[0].key=invalid.objects[0].key.replace('/metadata-','/absent-');invalid.metadata.key=invalid.objects[0].key;const invalidBytes=bytes(invalid),rejected=await call(objectPath(currentKey),{method:'PUT',body:invalidBytes,sha:await digest(invalidBytes),allow:[409]});must(rejected.status===409,'Incomplete R2 publication was not rejected.');must(await (await call(objectPath(currentKey))).text()===before,'Failed publication changed the previous pointer.');report.failed_publication_retained=true;
 report.views=[];report.csv=[];report.timings=[];
 for(const start of CONFIG.windows){
  let actual;for(let sample=0;sample<PILOT.readSamples;sample++){
   const begin=performance.now();actual=await (await call('/api/office/FA4528?start='+start)).json();const elapsed=performance.now()-begin;report.timings.push({source:'r2',start,sample,awards:actual.records.length,elapsed_ms:Math.round(elapsed)});
   const d1Begin=performance.now(),response=await fetch(PILOT.productionBase+'/api/office/FA4528?start='+start,{signal:AbortSignal.timeout(PILOT.httpTimeoutMs),cache:'no-store'});must(response.ok,'Live D1 comparison endpoint failed.');const expected=await response.json();report.timings.push({source:'d1',start,sample,awards:expected.records.length,elapsed_ms:Math.round(performance.now()-d1Begin)});must(expected.publication_id===bundle.manifest.source_publication_id,'D1 publication changed during benchmark.');must(canonical(compatible(actual))===canonical(compatible(expected)),'R2 page payload differs from D1.');
  }
  const expected=snapshotFromTables(tables,start),a=counts(expected.records,actual.today),b=counts(actual.records,actual.today),metrics=Object.keys(a).map(metric=>({metric,d1:a[metric],r2:b[metric],match:a[metric]===b[metric]}));
  for(const total of expected.fiscal_totals){const other=actual.fiscal_totals.find(row=>row.year===total.year);for(const key of ['cents','count','missing'])metrics.push({metric:'FY'+total.year+'_'+key,d1:total[key],r2:other?.[key],match:total[key]===other?.[key]});}
  must(metrics.every(metric=>metric.match),'D1/R2 metric mismatch.');report.views.push({start,full_payload_match:true,metrics});const csv=await compareCSV(expected.records,actual.records,actual.today);must(csv.every(row=>row.match),'CSV bytes changed.');report.csv.push({start,checks:csv});
 }
 report.evidence=[];const ids=tables.awards.map(row=>row.generated_unique_award_id);for(let i=0;i<PILOT.evidenceSamples;i++){const id=ids[Math.floor(i*(ids.length-1)/Math.max(1,PILOT.evidenceSamples-1))],expected=await storedAward(db,PILOT.office,id),actual=await (await call('/api/office/FA4528/award?id='+encodeURIComponent(id))).json();must(canonical(compatible(actual))===canonical(compatible(expected)),'Evidence payload changed.');report.evidence.push({id,match:true});}
 const initialWrites=report.r2.writes;must(await uploadObjects()===0,'Unchanged objects were re-uploaded.');must(report.r2.writes===initialWrites,'Unchanged validation wrote R2 objects.');report.unchanged_second_pass_writes=report.r2.writes-initialWrites;
 const end=await publication(db,PILOT.office);must(end.published_run_id===bundle.manifest.source_publication_id&&report.d1.rows_written===0,'The source publication changed.');
 const perOffice=bundle.compressed_bytes+pointer.length;report.projection={offices:CONFIG.storageProjectionOffices,one_version_bytes:perOffice*CONFIG.storageProjectionOffices,two_versions_upper_bound_bytes:perOffice*CONFIG.storageProjectionOffices*PILOT.maxStoredVersions,warning:'FA4528-only linear scenario; office sizes, source-change rates, traffic and other account usage vary. This is not a bill or a spending cap.'};report.cloud_status='passed';
}
try{await main();}catch(error){report.error=error.message;report.cloud_status=report.cloud_status==='blocked'?'blocked':'failed';process.exitCode=1;console.error(error.message);}finally{
 if(temporaryName&&temporaryConfig)try{await command(['delete','--config',temporaryConfig,'--force']);report.temporary_worker_deleted=true;}catch(error){report.temporary_worker_deleted=false;report.cleanup_error=error.message;process.exitCode=1;}
 report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({r2_pilot_result:report}));
}
