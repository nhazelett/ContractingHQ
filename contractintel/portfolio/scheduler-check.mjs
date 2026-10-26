// Verify repository-secret permissions without printing or retrieving a credential.
import {CONFIG} from './ingest.mjs';
const token=process.env.DISPATCH_SECRET;if(!token)throw new Error('GitHub dispatch secret is missing.');
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
const base='https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/';
const check=await fetch(base+CONFIG.githubWorkflow,{headers,redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
if(!check.ok)throw new Error('GitHub workflow read check failed: HTTP '+check.status);
const response=await fetch(base+'contractintel-r2-update.yml/dispatches',{method:'POST',headers,body:JSON.stringify({ref:CONFIG.githubRef,inputs:{office:'FA4528',mode:'nightly'}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
console.log(JSON.stringify({github_dispatch_check:{workflow_read_status:check.status,dispatch_status:response.status,office:'FA4528'}}));
if(!response.ok)throw new Error('GitHub workflow dispatch failed: HTTP '+response.status);
