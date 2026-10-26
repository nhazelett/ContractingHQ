// Cron and authenticated HTTP only dispatch GitHub; no USAspending request is made here.
import {CONFIG} from './ingest.mjs';
import {currentDate} from '../web/calendar.mjs';
export async function dispatchIngest(env,{mode='nightly',origin='cron',fetcher=fetch,now=Date.now}={}){
 if(!CONFIG.modes.includes(mode)||!['cron','admin'].includes(origin))throw new Error('Invalid dispatch request.');
 if(!env.GITHUB_DISPATCH_TOKEN)throw new Error('Set repository secret CONTRACTINTEL_GITHUB_TOKEN and deploy it as Worker secret GITHUB_DISPATCH_TOKEN.');
 if(!env.PORTFOLIO_DB)throw new Error('Portfolio D1 binding is missing.');
 const db=env.PORTFOLIO_DB,date=currentDate(now()),id=crypto.randomUUID(),stamp=new Date(now()).toISOString(),key=origin==='cron'?'cron|'+date:id;
 const result=await db.prepare("INSERT INTO ingest_dispatches(dispatch_key,request_id,started_at,lease_until,status) VALUES(?,?,?,?, 'dispatching') ON CONFLICT(dispatch_key) DO UPDATE SET request_id=excluded.request_id,started_at=excluded.started_at,lease_until=excluded.lease_until,status=excluded.status WHERE ingest_dispatches.status<>'accepted' AND ingest_dispatches.lease_until<?").bind(key,id,stamp,new Date(now()+CONFIG.dispatchLeaseMs).toISOString(),stamp).run();
 if(!result.meta?.changes)return {status:'already_dispatched',office:CONFIG.offices[0]};
 const url='https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/'+CONFIG.githubWorkflow+'/dispatches';
 try{
  const response=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_DISPATCH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ContractIntel'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{office:CONFIG.offices[0],mode,origin,request_id:id,verify:mode==='backfill'?'true':'false'}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
  if(!response.ok)throw Object.assign(new Error('GitHub workflow dispatch failed: HTTP '+response.status+'. Check the repository secret, token permission and workflow registration.'),{httpStatus:response.status});
  await db.prepare("UPDATE ingest_dispatches SET status='accepted',accepted_at=?,http_status=? WHERE dispatch_key=? AND request_id=?").bind(new Date(now()).toISOString(),response.status,key,id).run();
  const summary={status:'dispatched',office:CONFIG.offices[0],mode,origin,request_id:id,repository:CONFIG.githubRepository,workflow:CONFIG.githubWorkflow,ref:CONFIG.githubRef};console.log(JSON.stringify({portfolio_dispatch:summary}));return summary;
 }catch(error){await db.prepare("UPDATE ingest_dispatches SET status='failed',http_status=?,lease_until=? WHERE dispatch_key=? AND request_id=?").bind(error.httpStatus||null,new Date(now()).toISOString(),key,id).run();throw error;}
}
