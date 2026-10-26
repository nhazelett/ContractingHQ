import {continuationDecision} from './cohort-policy.mjs';
// Continue only known resumable cases; never retry a mismatch or exhausted office guard.
import fs from 'node:fs/promises';
import {CONFIG} from '../ingest.mjs';
const office=process.env.PILOT_OFFICE;
if(office!=='FA4800')throw new Error('This bounded continuation is restricted to FA4800.');
let report;try{report=JSON.parse(await fs.readFile(new URL('./out/fa4800-r2-update.json',import.meta.url),'utf8'));}catch{console.log('No progress report; automatic continuation is disabled.');process.exit(0);}
const batch=Number(process.env.COHORT_BATCH||'1'),maximum=CONFIG.r2Nightly.maxCohortRuns;
const progress=report.chunks?.at(-1)||report.failed_chunk||{},decision=continuationDecision(report,batch);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'## FA4800 batch '+batch+' / '+maximum+'\n\nStatus: '+report.status+'\n\nAwards discovered: '+(progress.discovered_awards??'see prior batch')+'; evidence prepared: '+(progress.hydrated_changes??'see prior batch')+'.\n\nCached reads open only after the full independent comparison passes.\n\n'+(decision.resume?'Next bounded batch is being dispatched.':decision.reason)+'\n');
if(!decision.resume){console.log(JSON.stringify({cohort_continuation:false,office,...decision}));if(decision.blocked)throw new Error(decision.reason);process.exit(0);}
const token=process.env.DISPATCH_SECRET;if(!token)throw new Error('Continuation credential is missing.');
const response=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/contractintel-r2-cohort.yml/dispatches',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{office,mode:'nightly',verify:process.env.PERFORM_VERIFY==='true',auto_resume:true,batch:String(batch+1)}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
console.log(JSON.stringify({cohort_continuation:true,office,next_batch:batch+1,maximum,http_status:response.status}));
if(!response.ok)throw new Error('Continuation dispatch failed; saved progress is retained.');
