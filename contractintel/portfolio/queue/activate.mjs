// Authorized rollout activation: measure before opening the durable review gate.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../ingest.mjs';
import {createHttpD1} from '../d1-http.mjs';
import {storageReport} from '../read.mjs';
import {ensureMaintenanceSchema} from './maintenance.mjs';
import {capacityDecision,partitionPlan} from './capacity.mjs';
const root=new URL('../../',import.meta.url),dir=new URL('./.audit/',import.meta.url);
const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8'));
const token=process.env.CLOUDFLARE_API_TOKEN,dispatch=process.env.DISPATCH_SECRET;
if(!token||!dispatch)throw new Error('Activation requires existing Cloudflare and dispatch secrets.');
const must=(value,message)=>{if(!value)throw new Error(message);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const secret=crypto.randomUUID()+crypto.randomUUID();
console.log('::add-mask::'+secret);
const worker='kthq-ci-capacity-'+process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
must(/^kthq-ci-capacity-\d+-\d+$/.test(worker),'Activation must run inside its bounded Actions job.');
async function cf(path,method='GET'){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+config.account_id+path,{method,headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(60000)});
 if(method==='DELETE'&&r.status===404)return null;
 const d=await r.json();must(r.ok&&d.success,'Cloudflare capacity operation failed: HTTP '+r.status);return d.result;
}
async function command(args,input=''){
 return new Promise((resolve,reject)=>{
  const child=spawn('npx',['--yes','wrangler@4.140.0',...args],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe']});
  let output='';const collect=data=>{output+=data;if(output.length>CONFIG.r2Pilot.processOutputBytes)child.kill();};
  child.stdout.on('data',collect);child.stderr.on('data',collect);child.on('error',()=>reject(Error('Audit gateway process failed.')));
  child.on('close',code=>code?reject(Error('Audit gateway deployment failed.')):resolve(output));child.stdin.end(input);
 });
}
async function awaitDeployment(){
 const sha=process.env.GITHUB_SHA,github=process.env.GITHUB_TOKEN;
 must(/^[a-f0-9]{40}$/.test(sha||'')&&github,'Deployment verification context missing.');
 for(let i=0;i<90;i++){
  const r=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/contractintel-preview.yml/runs?head_sha='+sha+'&per_page=5',{headers:{Authorization:'Bearer '+github,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
  must(r.ok,'Deployment status read failed.');
  const run=(await r.json()).workflow_runs.find(x=>x.head_sha===sha);
  if(run?.status==='completed'){must(run.conclusion==='success','Code deployment failed; activation retained closed.');return;}
  if(i%6===0)console.log(JSON.stringify({activation:'awaiting_validated_deployment',attempt:i+1}));
  await pause(10000);
 }
 throw Error('Deployment wait expired; activation retained closed.');
}
await awaitDeployment();
const binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');must(binding,'D1 binding missing.');
let queries=0;
const db=createHttpD1({account:config.account_id,database:binding.database_id,token,fetcher:(...args)=>{must(++queries<=250,'Activation D1 query budget reached.');return fetch(...args);}});
await ensureMaintenanceSchema(db);
const prior=await db.prepare('SELECT * FROM portfolio_rollout_control WHERE singleton=1').first();
must(prior&&!prior.lease_id,'Active or uncertain queue claim requires reconciliation.');
if(prior.review_json){
 const old=JSON.parse(prior.review_json);
 must(old.capacity_version===CONFIG.capacity.version,'An existing different capacity review requires explicit reconciliation.');
 console.log(JSON.stringify({capacity_activation:'already_reviewed'}));
}else{
 const pub=await db.prepare("SELECT p.published_run_id,p.award_count,r.comparison_json FROM office_publications p JOIN portfolio_publication_receipts r ON r.publication_id=p.published_run_id WHERE p.office_dodaac='FA4800' AND r.status='published'").first();
 const evidence=JSON.parse(await fs.readFile(new URL('docs/fa4800-cost.json',root),'utf8'));
 must(pub&&JSON.parse(pub.comparison_json).match===true&&evidence.status==='verified_publication'&&evidence.d1_publication_version===pub.published_run_id&&evidence.awards===pub.award_count&&evidence.request_accounting_complete===true,'Measured cost report must match the independently validated publication.');
 const existingJobs=(await db.prepare("SELECT count(*) n FROM portfolio_rollout_jobs WHERE attempts>0 OR status<>'queued'").first()).n;
 must(existingJobs===0&&prior.reserved_r2_bytes===0,'Initial baseline cannot be reset after automatic imports have begun.');
 const buckets=[...new Set([...Object.values(CONFIG.r2Offices).map(p=>p.bucket),CONFIG.r2Nightly.baselineBucket,CONFIG.rollout.sharedBucket])];
 must(buckets.length===4,'Audit bindings require the four managed portfolio buckets.');
 const bucketReports=[];
 let deployed=false;
 try{
  for(const bucket of buckets){const managed=await cf('/r2/buckets/'+bucket+'/domains/managed');must(managed.enabled===false,'Managed portfolio bucket must remain private.');}
  await fs.mkdir(dir,{recursive:true});
  const configPath=fileURLToPath(new URL('wrangler.json',dir));
  await fs.writeFile(configPath,JSON.stringify({name:worker,main:'../storage-audit-worker.mjs',account_id:config.account_id,compatibility_date:config.compatibility_date,workers_dev:true,preview_urls:false,observability:{enabled:false},r2_buckets:buckets.map((bucket_name,i)=>({binding:'B'+i,bucket_name}))}));
  deployed=true;const output=await command(['deploy','--config',configPath]);
  const url=(output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/g)||[]).find(x=>new URL(x).hostname.startsWith(worker+'.'));must(url,'Audit gateway address missing.');
  await command(['secret','put','STORAGE_AUDIT_TOKEN','--config',configPath],secret);
  for(let index=0;index<buckets.length;index++){
   let cursor=null,bytes=0,objects=0,complete=false;const seen=new Set();
   for(let page=0;page<128;page++){
    const address=url+'/list?bucket=B'+index+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    let r;
    for(let retry=0;retry<10;retry++){
     r=await fetch(address,{headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(60000)});
     if(r.ok)break;
     if(![401,404,429,503].includes(r.status))break;
     await r.body?.cancel();await pause(2000);
    }
    must(r.ok,'Complete R2 listing failed; no baseline was recorded.');
    const data=await r.json();must(Number.isSafeInteger(data.bytes)&&data.bytes>=0&&Number.isSafeInteger(data.objects)&&data.objects>=0&&typeof data.truncated==='boolean','Invalid R2 measurement.');
    bytes+=data.bytes;objects+=data.objects;
    if(!data.truncated){complete=true;break;}
    must(typeof data.cursor==='string'&&data.cursor&&!seen.has(data.cursor),'R2 cursor did not advance.');seen.add(data.cursor);cursor=data.cursor;
   }
   must(complete,'R2 listing truncated by audit budget; activation retained closed.');
   bucketReports.push({bucket:buckets[index],bytes,objects,complete:true});
  }
 }finally{
  // The exact task-owned Worker is deleted before the review can be recorded.
  if(deployed)await cf('/workers/scripts/'+worker,'DELETE');
 }
 const measured=await storageReport(db);
 const baseline=bucketReports.reduce((n,b)=>n+b.bytes,0);
 const ready=capacityDecision({d1Bytes:measured.physical_bytes,baselineR2Bytes:baseline,reservedR2Bytes:CONFIG.capacity.perOfficeR2Bytes,newOffice:true});
 must(ready==='ready','Capacity review blocked: '+ready);
 const review={capacity_version:CONFIG.capacity.version,fa4800_publication_version:pub.published_run_id,costs_reviewed:true,reviewed_at:new Date().toISOString(),baseline_r2_bytes:baseline,buckets:bucketReports,d1_physical_bytes:measured.physical_bytes,d1_table_sizes:measured.table_sizes,partition:partitionPlan(measured.physical_bytes),limits:{...CONFIG.capacity,maxDailySourceRequests:CONFIG.queue.maxDailySourceRequests,maxDailyRuntimeMs:CONFIG.queue.maxDailyRuntimeMs},source_costs_per_1000_awards:evidence.per_1000_awards};
 const changed=await db.prepare('UPDATE portfolio_rollout_control SET review_json=? WHERE singleton=1 AND review_json IS NULL AND lease_id IS NULL AND reserved_r2_bytes=0').bind(JSON.stringify(review)).run();
 must(changed.meta?.changes===1,'Activation raced another review; no queue dispatch attempted.');
 await fs.writeFile(new URL('capacity-review.json',dir),JSON.stringify(review,null,2)+'\n');
 console.log(JSON.stringify({capacity_review:review}));
}
const response=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/'+CONFIG.rollout.workflow+'/dispatches',{method:'POST',headers:{Authorization:'Bearer '+dispatch,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{batch:'1'}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
must(response.ok,'Queue activation recorded, but initial dispatch failed: HTTP '+response.status);
console.log(JSON.stringify({capacity_activation:'queue_dispatched',workflow:CONFIG.rollout.workflow}));
