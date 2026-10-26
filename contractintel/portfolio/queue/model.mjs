import {validAdmission} from '../r2/admission.mjs';
import {currentDate} from '../../web/calendar.mjs';
import {CONFIG} from '../ingest.mjs';
import {planDocument,planHash} from '../../web/queue-plan.mjs';
export const POLICY=Object.freeze({...CONFIG.queue,batchSourceRequests:CONFIG.r2Nightly.maxSourceRequestsPerJob,batchRuntimeMs:CONFIG.r2Nightly.runnerMinutes*60000,officeStorageBytes:CONFIG.r2Nightly.maxBucketBytes});
const copy=value=>structuredClone(value);
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const stamp=now=>new Date(now).toISOString();
export const emptyQueue=()=>({version:1,revision:0,paused:true,groups:[],budgets:[],active:null});
function bounded(state){check(new TextEncoder().encode(JSON.stringify(state)).length<=POLICY.maxStateBytes,'Queue storage limit reached.');return state;}
export async function changeQueue(current,command,directory,{now=Date.now(),id=crypto.randomUUID()}={}){
 const state=copy(current);
 check(command&&typeof command==='object','Invalid queue command.');
 const group=state.groups.find(g=>g.id===command.group_id);
 if(command.action==='enqueue'){
  check(state.groups.length<POLICY.maxGroups,'Queue group limit reached.');
  const supplied=command.plan,plan=planDocument(supplied?.offices,directory,POLICY),hash=await planHash(plan);
  check(JSON.stringify({...plan,sha256:hash})===JSON.stringify(supplied),'The reviewed plan changed. Export a fresh plan.');
  const existing=new Set(state.groups.flatMap(g=>g.items.filter(i=>i.status!=='cancelled').map(i=>i.office)));
  check(!plan.offices.some(code=>existing.has(code)),'An office is already in the queue.');
  check(state.groups.reduce((n,g)=>n+g.items.length,0)+plan.offices.length<=POLICY.maxOffices,'Queue office limit reached.');
  state.groups.push({id,plan_hash:hash,created_at:stamp(now),approved_at:null,paused:false,items:plan.offices.map(office=>({office,status:'queued',attempts:0,checkpoint:null,not_before:null,reason:null,usage:{source_requests:0,runtime_ms:0,stored_bytes:0}}))});
 }else if(command.action==='approve'){
  check(group,'Unknown queue group.');check(command.plan_hash===group.plan_hash,'Approve the exact reviewed plan.');
  check(!group.items.some(i=>i.status==='cancelled'),'Cancelled groups need a new plan.');group.approved_at??=stamp(now);
 }else if(['pause','resume'].includes(command.action)){
  if(command.group_id){check(group,'Unknown queue group.');group.paused=command.action==='pause';}else state.paused=command.action==='pause';
 }else if(command.action==='cancel'){
  check(group,'Unknown queue group.');
  check(state.active?.group_id!==group.id,'An active batch must finish or be reconciled before cancellation.');
  for(const item of group.items)if(!['ready','cancelled'].includes(item.status)){item.status='cancelled';item.reason='Cancelled by administrator.';}
 }else if(command.action==='retry'){
  check(group,'Unknown queue group.');const item=group.items.find(i=>i.office===command.office);
  check(item?.status==='stopped','Only stopped work can be reviewed for retry.');
  check(item.reason!=='execution_uncertain','Reconcile the uncertain batch before retrying.');
  check(item.attempts<POLICY.maxAttempts,'Office attempt limit reached.');
  item.status=item.checkpoint?.phase==='verification'?'verifying':'queued';item.not_before=null;item.reason=null;
 }else throw new Error('Unknown queue command.');
 state.revision++;return bounded(state);
}
export function publicQueue(state,{available=true}={}){
 return {available,execution_enabled:POLICY.executionEnabled,paused:state.paused,revision:state.revision,limits:POLICY,
  active:state.active?{office:state.active.office,started_at:state.active.started_at}:null,
  groups:state.groups.map(g=>({id:g.id,plan_hash:g.plan_hash,approved:!!g.approved_at,paused:g.paused,created_at:g.created_at,items:g.items.map(i=>({office:i.office,status:i.status,attempts:i.attempts,reason:i.reason,not_before:i.not_before,usage:i.usage}))})),
  budgets:state.budgets};
}
// Pure reservation engine. Production has no dispatcher wired to it in this release.
// Tests supply enabled=true and simulated completions; HTTP cannot enable execution.
export function reserveNext(current,{now=Date.now(),storage,enabled=POLICY.executionEnabled,enabledOffices=[],claimId=crypto.randomUUID()}={}){
 const state=copy(current);
 if(!enabled)return {state,decision:'execution_disabled'};
 if(state.paused)return {state,decision:'paused'};
 const day=currentDate(now);
 if(currentDate(now+POLICY.batchRuntimeMs+POLICY.leaseGraceMs)!==day)return {state,decision:'day_boundary_wait'};
 if(state.active){
  if(now>state.active.expires_at){
   const group=state.groups.find(g=>g.id===state.active.group_id),item=group.items.find(i=>i.office===state.active.office);
   item.status='stopped';item.reason='execution_uncertain';state.active=null;state.paused=true;state.revision++;return {state:bounded(state),decision:'reconcile_required'};
  }
  return {state,decision:'busy'};
 }
 if(!storage?.complete||!Number.isSafeInteger(storage.bytes)||storage.bytes<0||!Number.isFinite(storage.measured_at)||now<storage.measured_at||now-storage.measured_at>POLICY.maxStorageMeasurementAgeMs)return {state,decision:'storage_measurement_required'};
 if(storage.bytes+POLICY.officeStorageBytes>POLICY.maxTotalStorageBytes)return {state,decision:'storage_limit'};
 // Keep only recent ledgers; future days or a clock moving backwards fail closed.
 check(!state.budgets.some(b=>b.day>day),'Budget clock moved backwards.');
 let budget=state.budgets.find(b=>b.day===day);
 if(!budget){budget={day,source_requests:0,runtime_ms:0};state.budgets.push(budget);state.budgets=state.budgets.slice(-POLICY.retainedBudgetDays);}
 if(budget.source_requests+POLICY.batchSourceRequests>POLICY.maxDailySourceRequests||budget.runtime_ms+POLICY.batchRuntimeMs>POLICY.maxDailyRuntimeMs)return {state:current,decision:'daily_limit'};
 // Resume the in-flight office before beginning another office.
 const candidates=state.groups.filter(g=>g.approved_at&&!g.paused).flatMap(g=>g.items.filter(i=>['queued','importing','verifying'].includes(i.status)).map(i=>({group:g,item:i})));
 const active=candidates.find(({item})=>item.attempts>0)||candidates[0];
 if(!active)return {state:current,decision:'idle'};
 const {group,item}=active;
 if(item.not_before&&Date.parse(item.not_before)>now)return {state:current,decision:'retry_wait'};
 if(!enabledOffices.includes(item.office))return {state:current,decision:'office_not_enabled'};
 if(item.attempts>=POLICY.maxAttempts){item.status='stopped';item.reason='attempt_limit';state.revision++;return {state:bounded(state),decision:'attempt_limit'};}
 budget.source_requests+=POLICY.batchSourceRequests;budget.runtime_ms+=POLICY.batchRuntimeMs;
 item.status=item.status==='verifying'?'verifying':'importing';item.attempts++;item.reason=null;
 state.active={id:claimId,group_id:group.id,office:item.office,phase:item.status,started_at:stamp(now),expires_at:now+POLICY.batchRuntimeMs+POLICY.leaseGraceMs,day,reserved_requests:POLICY.batchSourceRequests,reserved_runtime_ms:POLICY.batchRuntimeMs};
 state.revision++;return {state:bounded(state),decision:'reserved',claim:copy(state.active)};
}
export function finishBatch(current,claimId,result,{now=Date.now()}={}){
 const state=copy(current),claim=state.active;
 check(claim&&claim.id===claimId,'Stale or duplicate batch completion.');
 const group=state.groups.find(g=>g.id===claim.group_id),item=group.items.find(i=>i.office===claim.office),budget=state.budgets.find(b=>b.day===claim.day);
 for(const key of ['source_requests','runtime_ms','stored_bytes'])check(Number.isSafeInteger(result[key])&&result[key]>=0,'Measured batch usage is required.');
 check(result.source_requests<=claim.reserved_requests&&result.runtime_ms<=claim.reserved_runtime_ms,'Batch exceeded its reserved work budget.');
 check(result.stored_bytes<=POLICY.officeStorageBytes,'Office storage limit reached.');
 check(['yielded','imported','verified','failed'].includes(result.status),'Unknown batch outcome.');
 if(result.checkpoint){
  check(['import','verification'].includes(result.checkpoint.phase)&&typeof result.checkpoint.ref==='string'&&result.checkpoint.ref.length>0&&result.checkpoint.ref.length<=POLICY.maxCheckpointRefLength,'Invalid saved checkpoint reference.');
 }
 if(['yielded','imported'].includes(result.status))check(result.checkpoint,'A resumable checkpoint is required.');
 if(result.status==='imported')check(claim.phase==='importing'&&result.checkpoint?.phase==='verification','A completed import must continue at independent verification.');
 if(result.status==='yielded')check(result.checkpoint?.phase===(claim.phase==='verifying'?'verification':'import'),'Checkpoint phase differs from the reserved batch.');
 if(result.status==='verified')check(claim.phase==='verifying'&&result.parity===true&&result.published===true&&validAdmission(result.admission,claim.office)&&result.admission.publication_id===result.publication_id,'Ready requires independent parity and complete publication.');
 check(now>=Date.parse(claim.started_at)&&now<=claim.expires_at,'Batch timing needs reconciliation.');
 budget.source_requests+=result.source_requests-claim.reserved_requests;budget.runtime_ms+=result.runtime_ms-claim.reserved_runtime_ms;
 item.usage.source_requests+=result.source_requests;item.usage.runtime_ms+=result.runtime_ms;item.usage.stored_bytes=result.stored_bytes;
 if(result.checkpoint)item.checkpoint=copy(result.checkpoint);
 item.not_before=null;item.reason=null;
 if(result.status==='verified')item.status='ready';
 else if(result.status==='imported')item.status='verifying';
 else if(result.status==='yielded')item.status=claim.phase;
 else{
  const temporary=result.retryable===true&&result.review_required!==true&&[429,500,502,503,504].includes(result.http_status);
  item.status=temporary?claim.phase:'stopped';item.reason=temporary?'temporary_source_error':'review_required';
  if(temporary)item.not_before=stamp(now+POLICY.retryDelayMs);
 }
 state.active=null;state.revision++;return bounded(state);
}
