// One reviewed recovery of N00024's legacy gateway transport stop.
import fs from 'node:fs/promises';
import {CONFIG} from '../ingest.mjs';
import {createHttpD1} from '../d1-http.mjs';
import {recoverStoppedNetworkOffice} from './recover-network.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN,dispatch=process.env.DISPATCH_SECRET,github=process.env.GITHUB_TOKEN,sha=process.env.GITHUB_SHA;
if(!token||!dispatch||!github||!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Recovery requires its trusted workflow context.');
console.log('::add-mask::'+token);console.log('::add-mask::'+dispatch);
let deployed=false;
for(let i=0;i<90;i++){
 const response=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/contractintel-preview.yml/runs?head_sha='+sha+'&per_page=5',{headers:{Authorization:'Bearer '+github,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Recovery deployment status read failed.');
 const run=(await response.json()).workflow_runs.find(r=>r.head_sha===sha);
 if(run?.status==='completed'){if(run.conclusion!=='success')throw Error('Deployment did not pass; queue remains stopped.');deployed=true;break;}
 if(i%6===0)console.log(JSON.stringify({network_recovery:'awaiting_validated_deployment',attempt:i+1}));
 await new Promise(resolve=>setTimeout(resolve,10000));
}
if(!deployed)throw Error('Deployment wait expired; queue remains stopped.');
const config=JSON.parse(await fs.readFile(new URL('../../worker/wrangler.jsonc',import.meta.url),'utf8'));
const binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');if(!binding)throw Error('Recovery D1 binding missing.');
let queries=0;
const db=createHttpD1({account:config.account_id,database:binding.database_id,token,fetcher:(...args)=>{if(++queries>30)throw Error('Recovery query budget reached.');return fetch(...args);}});
const result=await recoverStoppedNetworkOffice(db,{office:'N00024'});
console.log(JSON.stringify({network_recovery:result}));
const response=await fetch('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/'+CONFIG.rollout.workflow+'/dispatches',{method:'POST',headers:{Authorization:'Bearer '+dispatch,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{batch:'1'}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
if(!response.ok)throw Error('Recovery saved, but queue dispatch failed: HTTP '+response.status);
console.log(JSON.stringify({network_recovery_dispatch:'accepted',office:'N00024'}));
