// Read-only job audit, including failed attempts. No USAspending requests.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {CONFIG} from './ingest.mjs';
export function summarizeCost(records,current,{unknownAttempts=[],now=Date.now(),provisional=false}={}){
 const byAttempt=new Map(records.map(r=>[r.attempt_key,r]));
 const reports=[...byAttempt.values()].filter(r=>r.report.office==='FA4800').map(r=>r.report);
 const awards=current.views?.find(v=>v.start===CONFIG.windows[0])?.after?.total_awards??(provisional?current.chunks?.find(c=>c.discovered_awards)?.discovered_awards:null);
 if(!Number.isSafeInteger(awards)||awards<1||(!provisional&&!current.d1_publication_version))throw new Error('A completed authoritative FA4800 publication is required.');
 const requests=reports.reduce((n,r)=>n+(r.source_requests||0),0),activeMs=reports.reduce((n,r)=>n+Math.max(0,Date.parse(r.finished_at)-Date.parse(r.started_at)),0);
 const starts=reports.map(r=>Date.parse(r.started_at)).filter(Number.isFinite),ends=reports.map(r=>Date.parse(r.finished_at)).filter(Number.isFinite);
 const compressed=Number.isSafeInteger(current.stored_compressed_publication_bytes)?current.stored_compressed_publication_bytes:null,scale=1000/awards;
 return {office:'FA4800',status:provisional?'provisional_unpublished':'verified_publication',d1_publication_version:current.d1_publication_version??null,awards,generated_at:new Date(now).toISOString(),
  source_requests_reported:requests,source_requests_upper_bound:requests+unknownAttempts.length*CONFIG.r2Nightly.maxSourceRequestsPerJob,request_accounting_complete:unknownAttempts.length===0,unknown_attempts:unknownAttempts,
  source_job_minutes:activeMs/60000,elapsed_minutes:starts.length?(Math.max(...ends)-Math.min(...starts))/60000:null,reported_job_attempts:reports.length,
  r2_http_requests_reported:reports.reduce((n,r)=>n+(r.r2?.http_requests||0),0),r2_reads_reported:reports.reduce((n,r)=>n+(r.r2?.reads||0),0),r2_writes_reported:reports.reduce((n,r)=>n+(r.r2?.writes||0),0),
  checkpoint_bytes_latest:current.checkpoint_bytes??null,verification_progress:current.verification_progress??null,
  compressed_bytes_one_r2_publication:compressed,per_1000_awards:{source_requests_reported:requests*scale,source_job_minutes:activeMs/60000*scale,compressed_bytes:compressed===null?null:compressed*scale},
  notes:['Provisional reports never open the rollout gate.','Requests include initial import, independent verification and reported retries.','Source-job minutes include transfer, staging and backoff between report start/end; they are not billable-runner minutes or a billing statement.','Compressed publication size is unavailable until publication; checkpoint size is not substituted.','Missing final reports are disclosed as unknown attempts; totals are not exact when accounting is incomplete.']};
}
export async function listRuns(api,config=CONFIG.metrics){
 const runs=[];let total=null;
 for(let page=1;runs.length<config.maxRuns;page++){
  const count=Math.min(config.pageSize,config.maxRuns-runs.length);
  const data=await(await api('/actions/workflows/contractintel-r2-cohort.yml/runs?branch='+encodeURIComponent(CONFIG.githubRef)+'&per_page='+count+'&page='+page)).json();
  total=data.total_count;
  if(total>config.maxRuns)throw new Error('Metrics history exceeds its configured audit limit; no truncated cost claim.');
  runs.push(...data.workflow_runs);
  if(runs.length>=total||data.workflow_runs.length<count)return runs;
 }
 throw new Error('Metrics pagination did not reach the end of history.');
}
export function parseReport(text){
 let report;for(const line of text.split('\n')){const start=line.indexOf('{"r2_update_report":');if(start>=0)try{report=JSON.parse(line.slice(start)).r2_update_report;}catch{}}
 return report;
}
async function main(){
 const output=new URL('./r2/out/',import.meta.url),audit=process.env.COST_AUDIT_ONLY==='true';
 let current;
 if(!audit){
  current=JSON.parse(await fs.readFile(new URL('fa4800-r2-update.json',output),'utf8'));
  if(current.status!=='passed'||!current.d1_publication_version){console.log('FA4800 cost report awaits authoritative publication and verification.');return;}
 }
 const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('Metrics requires the workflow Actions-read token.');
 const base='https://api.github.com/repos/'+CONFIG.githubRepository,headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'ContractIntel metrics'};
 let calls=0;
 const api=async path=>{if(++calls>CONFIG.metrics.maxGitHubCalls)throw new Error('Metrics GitHub request budget reached.');const r=await fetch(base+path,{headers,redirect:'follow',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});if(!r.ok)throw new Error('Metrics GitHub read failed: HTTP '+r.status);return r;};
 const runs=await listRuns(api),records=current?[{attempt_key:process.env.GITHUB_RUN_ID+'|'+process.env.GITHUB_RUN_ATTEMPT,report:current}]:[],unknown=[];
 for(const run of runs){
  if(run.run_attempt>CONFIG.metrics.maxAttemptsPerRun)throw new Error('Metrics attempt limit reached.');
  for(let attempt=1;attempt<=run.run_attempt;attempt++){
   if(!audit&&String(run.id)===process.env.GITHUB_RUN_ID&&String(attempt)===process.env.GITHUB_RUN_ATTEMPT)continue;
   const jobs=await(await api('/actions/runs/'+run.id+'/attempts/'+attempt+'/jobs?per_page='+CONFIG.metrics.maxJobsPerAttempt)).json();
   if(jobs.total_count>CONFIG.metrics.maxJobsPerAttempt)throw new Error('Metrics job limit reached.');
   for(const job of jobs.jobs){
    if(job.status!=='completed')continue;
    let text;
    try{
     const response=await api('/actions/jobs/'+job.id+'/logs'),reader=response.body.getReader(),chunks=[];let size=0;
     for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>CONFIG.metrics.maxLogBytes){await reader.cancel();throw new Error('Log limit');}chunks.push(value);}
     text=Buffer.concat(chunks).toString('utf8');
    }catch{unknown.push({job_id:job.id,reason:'Logs unavailable or oversized',started_at:job.started_at});continue;}
    const report=parseReport(text);
    if(report)records.push({attempt_key:run.id+'|'+attempt,report});
    else if(job.steps?.some(s=>/Backfill or resume/.test(s.name)&&s.status!=='skipped'&&s.started_at))unknown.push({job_id:job.id,reason:'No final source report',started_at:job.started_at});
   }
  }
 }
 if(!current)current=records.map(r=>r.report).sort((a,b)=>Date.parse(b.finished_at)-Date.parse(a.finished_at))[0];
 if(!current)throw new Error('No completed source reports were available.');
 const work=current.chunks?.find(r=>r.work_id)?.work_id||current.d1_publication_version||current.publication_id;
 if(!work)throw new Error('Cannot scope the audit to a publication work ID.');
 const matching=records.filter(r=>r.report.chunks?.some(c=>c.work_id===work)||r.report.d1_publication_version===work);
 const earliest=Math.min(...matching.map(r=>Date.parse(r.report.started_at)));
 if(!Number.isFinite(earliest))throw new Error('Work history start is unavailable.');
 const scoped=records.filter(({report})=>Date.parse(report.started_at)>=earliest&&Date.parse(report.started_at)<=Date.parse(current.finished_at));
 const result=summarizeCost(scoped,current,{provisional:current.status!=='passed'||!current.d1_publication_version,unknownAttempts:unknown.filter(a=>!a.started_at||Date.parse(a.started_at)>=earliest&&Date.parse(a.started_at)<=Date.parse(current.finished_at))});
 result.github_read_requests=calls;result.audit_through=current.finished_at;
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(new URL('fa4800-cost.json',output),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({fa4800_cost_report:result}));
 if(audit&&process.env.CLOUDFLARE_API_TOKEN){
  const {createHttpD1}=await import('./d1-http.mjs'),{storageReport}=await import('./read.mjs');
  const config=JSON.parse(await fs.readFile(new URL('../worker/wrangler.jsonc',import.meta.url),'utf8')),binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');
  let queries=0;
  const db=createHttpD1({account:config.account_id,database:binding.database_id,token:process.env.CLOUDFLARE_API_TOKEN,fetcher:(...args)=>{if(++queries>CONFIG.metrics.maxStorageQueries)throw new Error('Storage audit query limit reached.');return fetch(...args);}});
  const report=await storageReport(db);
  // D1 read-only: measure live tables, explicitly disclose the currently published offices.
  report.published_offices=(await db.prepare('SELECT office_dodaac,published_run_id,award_count FROM office_publications ORDER BY office_dodaac').all()).results;
  report.automatic_queue=(await db.prepare('SELECT status,count(*) offices FROM portfolio_rollout_jobs GROUP BY status').all()).results;
  report.rollout_gate=(await db.prepare('SELECT review_json IS NOT NULL AS review_present,paused,lease_id IS NOT NULL AS active FROM portfolio_rollout_control WHERE singleton=1').first());
  await fs.writeFile(new URL('d1-storage-audit.json',output),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({d1_storage_audit:report}));
 }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
