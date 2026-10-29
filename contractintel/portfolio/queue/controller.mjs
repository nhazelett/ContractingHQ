import {CONFIG} from '../ingest.mjs';
import {currentDate} from '../../web/calendar.mjs';
import {nextAutomaticJob} from './automatic.mjs';
import {capacityDecision} from './capacity.mjs';
import {ensureMaintenanceSchema,enqueueDueMaintenance} from './maintenance.mjs';
const cfg=CONFIG.rollout,limits=CONFIG.queue;
const fail=(ok,message)=>{if(!ok)throw new Error(message);};
export async function reserveAutomaticBatch(db,{now=Date.now(),id=crypto.randomUUID()}={}){
 await ensureMaintenanceSchema(db);
 const control=await db.prepare('SELECT * FROM portfolio_rollout_control WHERE singleton=1').first();
 if(!control?.review_json)return {decision:'awaiting_fa4800_and_cost_review'};
 if(control.paused)return {decision:'paused'};
 if(control.lease_id)return {decision:Date.parse(control.lease_until)<now?'reconciliation_required':'busy'};
 const review=JSON.parse(control.review_json);
 const published=await db.prepare("SELECT p.published_run_id,r.comparison_json FROM office_publications p JOIN portfolio_publication_receipts r ON r.publication_id=p.published_run_id WHERE p.office_dodaac='FA4800' AND r.status='published'").first();
 if(!published||published.published_run_id!==review.fa4800_publication_version||JSON.parse(published.comparison_json).match!==true)return {decision:'awaiting_fa4800_validation'};
 if(review.capacity_version!==CONFIG.capacity.version||review.costs_reviewed!==true||!Number.isSafeInteger(review.baseline_r2_bytes)||review.baseline_r2_bytes<0)return {decision:'awaiting_cost_review'};
 const physical=await db.prepare('SELECT 1 AS storage_probe').all(),bytes=physical.meta?.size_after;
 if(!Number.isSafeInteger(bytes)||bytes<0)return {decision:'storage_measurement_required'};
 if(bytes>=CONFIG.capacity.maxD1Bytes)return {decision:'d1_storage_limit'};
 const day=currentDate(now),runtime=CONFIG.r2Nightly.runnerMinutes*60000,requests=CONFIG.r2Nightly.maxSourceRequestsPerJob;
 if(currentDate(now+cfg.queueLeaseMs)!==day)return {decision:'day_boundary_wait'};
 await enqueueDueMaintenance(db,{now});
 const rows=(await db.prepare("SELECT * FROM portfolio_rollout_jobs WHERE status<>'ready' ORDER BY priority,office_dodaac").all()).results;
 const selection=nextAutomaticJob(rows.filter(row=>!CONFIG.r2Offices[row.office_dodaac]),{fa4800Verified:true,costsReviewed:true,storageReady:true,now});
 if(selection.decision!=='ready_to_reserve')return selection;
 const job=selection.job;
 if(CONFIG.r2Offices[job.office_dodaac])return {decision:'pilot_requires_existing_workflow',office:job.office_dodaac};
 const reserve=Math.max(0,CONFIG.capacity.perOfficeR2Bytes-job.storage_reserved_bytes);
 const capacity=capacityDecision({d1Bytes:bytes,baselineR2Bytes:review.baseline_r2_bytes,reservedR2Bytes:control.reserved_r2_bytes+reserve,newOffice:!job.maintenance&&job.attempts===0});
 if(capacity!=='ready')return {decision:capacity};
 const ledger=await db.prepare('SELECT * FROM portfolio_rollout_days WHERE day=?').bind(day).first();
 if((ledger?.source_requests||0)+requests>limits.maxDailySourceRequests||(ledger?.runtime_ms||0)+runtime>limits.maxDailyRuntimeMs)return {decision:'daily_limit'};
 const stamp=new Date(now).toISOString(),until=new Date(now+cfg.queueLeaseMs).toISOString();
 // CHECK assertion makes claim, budget reservation and global lease one atomic D1 transaction.
 try{await db.batch([
  db.prepare('INSERT OR IGNORE INTO portfolio_rollout_days(day) VALUES(?)').bind(day),
  db.prepare("INSERT INTO portfolio_rollout_assertions(id,valid) SELECT ?,coalesce((SELECT CASE WHEN c.lease_id IS NULL AND c.paused=0 AND c.review_json=? AND c.reserved_r2_bytes=? AND j.attempts=? AND j.lease_id IS NULL AND j.status=? AND b.source_requests+?<=? AND b.runtime_ms+?<=? THEN 1 ELSE 0 END FROM portfolio_rollout_control c JOIN portfolio_rollout_jobs j ON j.office_dodaac=? JOIN portfolio_rollout_days b ON b.day=? WHERE c.singleton=1),0)").bind(id,control.review_json,control.reserved_r2_bytes,job.attempts,job.status,requests,limits.maxDailySourceRequests,runtime,limits.maxDailyRuntimeMs,job.office_dodaac,day),
  db.prepare('UPDATE portfolio_rollout_days SET source_requests=source_requests+?,runtime_ms=runtime_ms+? WHERE day=?').bind(requests,runtime,day),
  db.prepare('UPDATE portfolio_rollout_control SET lease_id=?,lease_until=?,reserved_r2_bytes=reserved_r2_bytes+? WHERE singleton=1').bind(id,until,reserve),
  db.prepare("UPDATE portfolio_rollout_jobs SET status=CASE WHEN status='verifying' THEN status ELSE 'importing' END,storage_reserved_bytes=storage_reserved_bytes+?,attempts=attempts+1,lease_id=?,lease_until=?,updated_at=? WHERE office_dodaac=?").bind(reserve,id,until,stamp,job.office_dodaac),
  db.prepare('DELETE FROM portfolio_rollout_assertions WHERE id=?').bind(id)
 ]);}catch(error){
  const current=await db.prepare('SELECT lease_id FROM portfolio_rollout_control WHERE singleton=1').first();
  if(current?.lease_id===id)return {decision:'reserved',claim:{id,office:job.office_dodaac,day,started_at:stamp,lease_until:until,reserved_requests:requests,reserved_runtime_ms:runtime,maintenance:job.maintenance===1,r2_reserved_bytes:job.storage_reserved_bytes+reserve}};
  if(current?.lease_id)return {decision:'busy'};
  throw error;
 }
 return {decision:'reserved',claim:{id,office:job.office_dodaac,day,started_at:stamp,lease_until:until,reserved_requests:requests,reserved_runtime_ms:runtime,maintenance:job.maintenance===1,r2_reserved_bytes:job.storage_reserved_bytes+reserve}};
}
export async function finishAutomaticBatch(db,claim,report,{now=Date.now()}={}){
 fail(report?.office===claim.office,'Report office differs from its claim.');
 const requests=report.source_requests,runtime=now-Date.parse(claim.started_at);
 fail(Number.isSafeInteger(requests)&&requests>=0&&requests<=claim.reserved_requests&&runtime>=0&&runtime<=claim.reserved_runtime_ms,'Measured usage exceeds its reserved budget; reconciliation required.');
 let status,version=null,reason=report.error||null;
 if(report.status==='passed'){
  version=report.d1_publication_version;
  const receipt=await db.prepare("SELECT r.comparison_json FROM portfolio_publication_receipts r JOIN office_publications p ON p.published_run_id=r.publication_id WHERE p.office_dodaac=? AND p.published_run_id=? AND r.status='published'").bind(claim.office,version).first();
  fail(receipt&&JSON.parse(receipt.comparison_json).match===true&&report.read_enabled===true,'Ready requires a matching D1 receipt and admitted R2 cache.');
  status='ready';
 }else if(report.status==='yielded')status=report.chunks?.at(-1)?.status==='prepared'?'verifying':'importing';
 else status='stopped';
 const stamp=new Date(now).toISOString(),checkpoint=status==='ready'?null:'pilot/'+claim.office+'/checkpoint.json.gz';
 const stored=status==='ready'?report.reserved_storage_bytes:claim.r2_reserved_bytes;
 fail(Number.isSafeInteger(stored)&&stored>=0&&stored<=CONFIG.capacity.perOfficeR2Bytes,'Measured office storage is missing or exceeds its reservation.');
 const nextRefresh=status==='ready'?new Date(now+CONFIG.capacity.maintenanceEveryMs).toISOString():null;
 const transient=report.source_failures?.length||report.source_network_errors||/^R2 gateway (network failure:|HTTP (429|500|502|503|504))|^USAspending (did not respond in time\.|returned an unreadable response\.)/.test(report.error||'');
 const delay=status==='stopped'?null:new Date(now+(transient?cfg.queueRetryMs:0)).toISOString();
 await db.batch([
  db.prepare("INSERT INTO portfolio_rollout_assertions(id,valid) SELECT ?,coalesce((SELECT CASE WHEN c.lease_id=? AND j.lease_id=? THEN 1 ELSE 0 END FROM portfolio_rollout_control c JOIN portfolio_rollout_jobs j ON j.office_dodaac=? WHERE c.singleton=1),0)").bind(claim.id,claim.id,claim.id,claim.office),
  db.prepare('UPDATE portfolio_rollout_days SET source_requests=source_requests+?,runtime_ms=runtime_ms+? WHERE day=?').bind(requests-claim.reserved_requests,runtime-claim.reserved_runtime_ms,claim.day),
  db.prepare('UPDATE portfolio_rollout_jobs SET status=?,checkpoint_ref=?,lease_id=NULL,lease_until=NULL,not_before=?,last_error=?,publication_version=coalesce(?,publication_version),next_refresh_at=coalesce(?,next_refresh_at),storage_reserved_bytes=?,updated_at=? WHERE office_dodaac=?').bind(status,checkpoint,delay,reason,version,nextRefresh,stored,stamp,claim.office),
  db.prepare("UPDATE portfolio_rollout_control SET lease_id=NULL,lease_until=NULL,reserved_r2_bytes=reserved_r2_bytes+?,paused=CASE WHEN ?='stopped' THEN 1 ELSE paused END WHERE singleton=1").bind(stored-claim.r2_reserved_bytes,status),
  db.prepare('DELETE FROM portfolio_rollout_assertions WHERE id=?').bind(claim.id)
 ]);
 return {status,office:claim.office,continue:status!=='stopped'};
}
