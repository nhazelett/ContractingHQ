// Starts only the controller workflow. The Actions controller reserves work in D1.
import {CONFIG} from '../ingest.mjs';
import {currentDate} from '../../web/calendar.mjs';
export async function dispatchAutomaticQueue(env,{now=Date.now,fetcher=fetch}={}){
 if(!env.PORTFOLIO_DB||!env.GITHUB_DISPATCH_TOKEN)return {status:'queue_not_configured'};
 const db=env.PORTFOLIO_DB;
 const control=await db.prepare('SELECT * FROM portfolio_rollout_control WHERE singleton=1').first();
 if(!control?.review_json)return {status:'awaiting_fa4800_and_cost_review'};
 if(control.paused)return {status:'paused'};
 if(control.lease_id)return {status:'busy_or_reconciliation_required'};
 const review=JSON.parse(control.review_json);
 const pub=await db.prepare("SELECT p.published_run_id FROM office_publications p JOIN portfolio_publication_receipts r ON r.publication_id=p.published_run_id WHERE p.office_dodaac='FA4800' AND r.status='published'").first();
 if(!pub||pub.published_run_id!==review.fa4800_publication_version)return {status:'awaiting_fa4800_validation'};
 const key='rollout|'+currentDate(now()),id=crypto.randomUUID(),stamp=new Date(now()).toISOString();
 const reservation=await db.prepare("INSERT INTO ingest_dispatches(dispatch_key,request_id,started_at,lease_until,status) VALUES(?,?,?,?,'dispatching') ON CONFLICT(dispatch_key) DO UPDATE SET request_id=excluded.request_id,started_at=excluded.started_at,lease_until=excluded.lease_until,status=excluded.status WHERE ingest_dispatches.status<>'accepted' AND ingest_dispatches.lease_until<?").bind(key,id,stamp,new Date(now()+CONFIG.dispatchLeaseMs).toISOString(),stamp).run();
 if(!reservation.meta?.changes)return {status:'already_dispatched'};
 // A timeout leaves an uncertain dispatch until its lease expires. D1 job claims still deduplicate workers.
 const response=await fetcher('https://api.github.com/repos/'+CONFIG.githubRepository+'/actions/workflows/'+CONFIG.rollout.workflow+'/dispatches',{method:'POST',headers:{Authorization:'Bearer '+env.GITHUB_DISPATCH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'ContractIntel'},body:JSON.stringify({ref:CONFIG.githubRef,inputs:{batch:'1'}}),redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});
 if(!response.ok)throw new Error('Automatic queue dispatch failed: HTTP '+response.status);
 await db.prepare("UPDATE ingest_dispatches SET status='accepted',accepted_at=?,http_status=? WHERE dispatch_key=? AND request_id=?").bind(new Date(now()).toISOString(),response.status,key,id).run();
 return {status:'dispatched',workflow:CONFIG.rollout.workflow};
}
