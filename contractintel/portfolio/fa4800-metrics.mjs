// Aggregate actual historical job reports, including failures/retries; never query USAspending.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {CONFIG} from './ingest.mjs';
export function summarizeCost(records,current,{unknownAttempts=[],now=Date.now()}={}){
 const byAttempt=new Map(records.map(r=>[r.attempt_key,r]));
 const reports=[...byAttempt.values()].filter(r=>r.report.office==='FA4800').map(r=>r.report);
 const awards=current.views?.find(v=>v.start===CONFIG.windows[0])?.after?.total_awards;
 if(!Number.isSafeInteger(awards)||awards<1||!current.d1_publication_version)throw new Error('A completed authoritative FA4800 publication is required.');
 const requests=reports.reduce((n,r)=>n+(r.source_requests||0),0),activeMs=reports.reduce((n,r)=>n+Math.max(0,Date.parse(r.finished_at)-Date.parse(r.started_at)),0);
 const starts=reports.map(r=>Date.parse(r.started_at)).filter(Number.isFinite),ends=reports.map(r=>Date.parse(r.finished_at)).filter(Number.isFinite),compressed=current.stored_compressed_publication_bytes;
 const scale=1000/awards;
 return {office:'FA4800',d1_publication_version:current.d1_publication_version,awards,generated_at:new Date(now).toISOString(),
  source_requests_reported:requests,source_requests_upper_bound:requests+unknownAttempts.length*CONFIG.r2Nightly.maxSourceRequestsPerJob,request_accounting_complete:unknownAttempts.length===0,unknown_attempts:unknownAttempts,
  source_job_minutes:activeMs/60000,elapsed_minutes:(Math.max(...ends)-Math.min(...starts))/60000,reported_job_attempts:reports.length,
  compressed_bytes_one_r2_publication:compressed,per_1000_awards:{source_requests_reported:requests*scale,source_job_minutes:activeMs/60000*scale,compressed_bytes:compressed*scale},
  notes:['Requests include initial import, independent verification and reported retries.','Source-job minutes include transfer, staging and backoff time between each report start/end; queue gaps appear only in elapsed time.','Compressed bytes cover one complete R2 publication, not checkpoints, retained versions or D1 storage.','Missing final reports are disclosed as unknown attempts; totals are not presented as exact when accounting is incomplete.']};
}
async function main(){
 const output=new URL('./r2/out/',import.meta.url),current=JSON.parse(await fs.readFile(new URL('fa4800-r2-update.json',output),'utf8'));
 if(current.status!=='passed'||!current.d1_round_trip_match){console.log('FA4800 cost report awaits authoritative publication and verification.');return;}
 const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('Metrics requires the workflow Actions-read token.');
 const base='https://api.github.com/repos/'+CONFIG.githubRepository,headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'ContractIntel metrics'};
 const api=async path=>{const r=await fetch(base+path,{headers,redirect:'follow',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});if(!r.ok)throw new Error('Metrics GitHub read failed: HTTP '+r.status);return r;};
 const listing=await(await api('/actions/workflows/contractintel-r2-cohort.yml/runs?branch='+encodeURIComponent(CONFIG.githubRef)+'&per_page='+CONFIG.metrics.maxRuns)).json();
 if(listing.total_count>CONFIG.metrics.maxRuns)throw new Error('Metrics history exceeds configured limit; report requires a paged audit.');
 const records=[{attempt_key:process.env.GITHUB_RUN_ID+'|'+process.env.GITHUB_RUN_ATTEMPT,report:current}],unknown=[];
 const work=current.chunks?.find(r=>r.work_id)?.work_id;
 let earliest=Date.parse(current.started_at);
 // Read every attempt, not just the newest rerun of a workflow.
 for(const run of listing.workflow_runs){
  if(run.run_attempt>CONFIG.metrics.maxAttemptsPerRun)throw new Error('Metrics attempt limit reached.');
  for(let attempt=1;attempt<=run.run_attempt;attempt++){
   if(String(run.id)===process.env.GITHUB_RUN_ID&&String(attempt)===process.env.GITHUB_RUN_ATTEMPT)continue;
   const jobs=await(await api('/actions/runs/'+run.id+'/attempts/'+attempt+'/jobs?per_page='+CONFIG.metrics.maxJobsPerAttempt)).json();
   if(jobs.total_count>CONFIG.metrics.maxJobsPerAttempt)throw new Error('Metrics job limit reached.');
   for(const job of jobs.jobs){
    if(job.status!=='completed')continue;
    let text;
    try{const response=await api('/actions/jobs/'+job.id+'/logs');text=await response.text();if(Buffer.byteLength(text)>CONFIG.metrics.maxLogBytes)throw new Error('Metrics log size budget reached.');}
    catch{unknown.push({job_id:job.id,reason:'Logs unavailable'});continue;}
    let report;
    for(const line of text.split('\n')){const start=line.indexOf('{"r2_update_report":');if(start>=0)try{report=JSON.parse(line.slice(start)).r2_update_report;}catch{}}
    if(report){
     records.push({attempt_key:run.id+'|'+attempt,report});
     if(report.chunks?.some(c=>c.work_id===work))earliest=Math.min(earliest,Date.parse(report.started_at));
    }else if(job.steps?.some(s=>/Backfill or resume/.test(s.name)&&s.started_at))unknown.push({job_id:job.id,reason:'No final source report',started_at:job.started_at});
   }
  }
 }
 const scoped=records.filter(({report})=>Date.parse(report.started_at)>=earliest&&Date.parse(report.started_at)<=Date.parse(current.finished_at));
 const result=summarizeCost(scoped,current,{unknownAttempts:unknown.filter(a=>!a.started_at||Date.parse(a.started_at)>=earliest)});
 await fs.writeFile(new URL('fa4800-cost.json',output),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({fa4800_cost_report:result}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
