// Actions controller: reserve one durable batch, run the existing ingest package, settle, continue.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {CONFIG} from '../ingest.mjs';
import {createHttpD1} from '../d1-http.mjs';
import {reserveAutomaticBatch,finishAutomaticBatch} from './controller.mjs';
import {wait} from '../../web/source-requests.mjs';
const config=JSON.parse(await fs.readFile(new URL('../../worker/wrangler.jsonc',import.meta.url),'utf8'));
const token=process.env.CLOUDFLARE_API_TOKEN,binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');
if(!token||!binding)throw new Error('Automatic queue D1 access missing.');
if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
const db=createHttpD1({account:config.account_id,database:binding.database_id,token});
await db.prepare(await fs.readFile(new URL('../migrations/0006.sql',import.meta.url),'utf8')).run();
const batch=Number(process.env.ROLLOUT_BATCH||'1');
if(!Number.isSafeInteger(batch)||batch<1||batch>CONFIG.rollout.maxControllerBatches)throw new Error('Invalid controller batch.');
let result=await reserveAutomaticBatch(db);
if(result.decision==='retry_wait'){
 await wait(CONFIG.rollout.queueRetryMs);
 result=await reserveAutomaticBatch(db);
}
console.log(JSON.stringify({automatic_queue:result.decision,office:result.claim?.office}));
if(result.decision==='reserved'){
 const claim=result.claim;
 const exit=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../r2/runner.mjs',import.meta.url))],{stdio:'inherit',shell:false,env:{...process.env,AUTOMATIC_OFFICE:claim.office,PILOT_OFFICE:claim.office,ROLLOUT_CLAIM_ID:claim.id,RUN_MODE:'nightly',PERFORM_VERIFY:'true',AUTO_RESUME:'true',COHORT_BATCH:'1'}});
  child.on('error',()=>reject(new Error('Automatic ingest could not start; reconcile its reserved claim.')));
  child.on('close',resolve);
 });
 let report;try{report=JSON.parse(await fs.readFile(new URL('../r2/out/'+claim.office.toLowerCase()+'-r2-update.json',import.meta.url),'utf8'));}catch{throw new Error('Missing batch report; reservation retained for reconciliation.');}
 if(report.temporary_worker_deleted===false)throw new Error('Temporary gateway cleanup failed; retain claim for reconciliation.');
 const completion=await finishAutomaticBatch(db,claim,report);
 console.log(JSON.stringify({automatic_queue_completion:completion,child_exit:exit}));
 if(!completion.continue)throw new Error('Automatic office import stopped; review its saved report.');
 if(batch<CONFIG.rollout.maxControllerBatches){
  const dispatch=process.env.DISPATCH_SECRET;if(!dispatch)throw new Error('Queue continuation credential missing.');
  const response=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/'+CONFIG.rollout.workflow+'/dispatches',{method:'POST',headers:{Authorization:'Bearer '+dispatch,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{batch:String(batch+1)}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
  if(!response.ok)throw new Error('Queue continuation dispatch failed: HTTP '+response.status);
  console.log(JSON.stringify({automatic_queue_continuation:true,next_batch:batch+1}));
 }
}
