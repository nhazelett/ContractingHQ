import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONFIG} from '../portfolio/ingest.mjs';
import {reviewedPlan} from '../web/queue-plan.mjs';
import {POLICY,emptyQueue,changeQueue,reserveNext,finishBatch,publicQueue} from '../portfolio/queue/model.mjs';
import {readQueue,mutateQueue} from '../portfolio/queue/store.mjs';
import {portfolioRoute} from '../portfolio/http.mjs';
import {sqlite} from './fixtures/portfolio-d1.mjs';
const directory=['FA0001','FA0002','FA0003','FA0004','FA0005','FA0006'].map(code=>({code,name:'Test '+code}));
const now=Date.parse('2026-10-27T02:00:00Z'),storage={bytes:0,complete:true,measured_at:now};
async function group(offices=['FA0001','FA0002']){
 const plan=await reviewedPlan(offices,directory,POLICY);
 let state=await changeQueue(emptyQueue(),{action:'enqueue',plan},directory,{now,id:'group-a'});
 state=await changeQueue(state,{action:'approve',group_id:'group-a',plan_hash:plan.sha256},directory,{now});
 state=await changeQueue(state,{action:'resume'},directory,{now});return {state,plan};
}
const reserve=(state,options={})=>reserveNext(state,{now,storage,enabled:true,enabledOffices:directory.map(o=>o.code),...options});
const verified={parity:true,published:true,publication_id:'publication',admission:{office:'FA0001',verified:true,schema_version:CONFIG.schemaVersion,publication_id:'publication',comparison_sha256:'a'.repeat(64)}};
const usage=(extra={})=>({source_requests:10,runtime_ms:1000,stored_bytes:100,...extra});
test('Plans require directory membership, exact fingerprints, bounded groups and separate approval',async()=>{
 await assert.rejects(reviewedPlan(['UNKNOWN'],directory,POLICY),/directory/);
 await assert.rejects(reviewedPlan(['FA0001','FA0001'],directory,POLICY),/once/);
 await assert.rejects(reviewedPlan(directory.map(o=>o.code),directory,POLICY),/between/);
 const plan=await reviewedPlan(['FA0001'],directory,POLICY);
 const state=await changeQueue(emptyQueue(),{action:'enqueue',plan},directory,{now,id:'group-a'});
 assert.equal(state.paused,true);assert.equal(state.groups[0].approved_at,null);
 assert.equal(reserve(state).decision,'paused');
 const resumed=await changeQueue(state,{action:'resume'},directory,{now});assert.equal(reserve(resumed).decision,'idle');
 await assert.rejects(changeQueue(state,{action:'approve',group_id:'group-a',plan_hash:'wrong'},directory),/exact/);
 await assert.rejects(changeQueue(state,{action:'enqueue',plan},directory),/already/);
 await assert.rejects(changeQueue(emptyQueue(),{action:'enqueue',plan:{...plan,offices:['FA0002']}},directory),/changed/);
});
test('Production queue remains disabled even with approved work and no source calls are made',async()=>{
 const {state}=await group();const before=JSON.stringify(state);
 const result=reserveNext(state,{now,storage,enabledOffices:directory.map(o=>o.code)});
 assert.equal(CONFIG.queue.executionEnabled,false);assert.equal(result.decision,'execution_disabled');assert.equal(JSON.stringify(state),before);
 assert.deepEqual(Object.keys(CONFIG.r2Offices),['FA4528','FA4800']);
});
test('One office resumes across batches, then verifies before another begins',async()=>{
 let {state}=await group();let next=reserve(state,{claimId:'a'});assert.equal(next.claim.office,'FA0001');assert.equal(reserve(next.state).decision,'busy');
 state=finishBatch(next.state,'a',usage({status:'yielded',checkpoint:{phase:'import',ref:'private-checkpoint'}}),{now});
 next=reserve(state,{claimId:'b'});assert.equal(next.claim.office,'FA0001');assert.equal(next.state.groups[0].items[0].checkpoint.ref,'private-checkpoint');
 state=finishBatch(next.state,'b',usage({status:'imported',checkpoint:{phase:'verification',ref:'source-comparison'}}),{now});
 assert.equal(state.groups[0].items[0].status,'verifying');next=reserve(state,{claimId:'c'});assert.equal(next.claim.phase,'verifying');
 assert.throws(()=>finishBatch(next.state,'c',usage({status:'verified',parity:false,published:true})),/independent parity/);
 state=finishBatch(next.state,'c',usage({status:'verified',...verified}),{now});
 assert.equal(state.groups[0].items[0].status,'ready');assert.equal(reserve(state).claim.office,'FA0002');
 assert.throws(()=>finishBatch(state,'c',usage({status:'verified',...verified})),/Stale/);
 assert.ok(!JSON.stringify(publicQueue(state)).includes('source-comparison'),'private checkpoint references stay private');
});
test('Daily budgets reserve worst-case work before a batch and reset on the New York day',async()=>{
 let {state}=await group(['FA0001']);
 for(let i=0;i<3;i++){const batch=reserve(state,{claimId:'batch-'+i});assert.equal(batch.decision,'reserved');state=finishBatch(batch.state,batch.claim.id,usage({source_requests:POLICY.batchSourceRequests,runtime_ms:POLICY.batchRuntimeMs,status:'yielded',checkpoint:{phase:'import',ref:'saved'}}),{now});}
 const boundary=Date.parse('2026-10-27T03:50:00Z');assert.equal(reserve(state,{now:boundary,storage:{...storage,measured_at:boundary}}).decision,'day_boundary_wait');
 assert.equal(state.budgets[0].day,'2026-10-26');assert.equal(reserve(state).decision,'daily_limit');
 const later=Date.parse('2026-10-27T04:01:00Z');assert.equal(reserve(state,{now:later,storage:{...storage,measured_at:later}}).decision,'reserved');
 assert.throws(()=>reserve(state,{now:now-86400000,storage:{...storage,measured_at:now-86400000}}),/clock moved backwards/);
});
test('Storage uncertainty, stale measurements and exhausted capacity stop reservations',async()=>{
 const {state}=await group();assert.equal(reserve(state,{storage:null}).decision,'storage_measurement_required');
 assert.equal(reserve(state,{storage:{...storage,complete:false}}).decision,'storage_measurement_required');
 assert.equal(reserve(state,{storage:{...storage,measured_at:now-POLICY.maxStorageMeasurementAgeMs-1}}).decision,'storage_measurement_required');
 assert.equal(reserve(state,{storage:{...storage,bytes:POLICY.maxTotalStorageBytes}}).decision,'storage_limit');
 assert.equal(reserve(state,{enabledOffices:[]}).decision,'office_not_enabled');
});
test('Transient failures resume from checkpoints; permanent failures stop for review',async()=>{
 let {state}=await group(['FA0001']);let batch=reserve(state,{claimId:'a'});
 state=finishBatch(batch.state,'a',usage({status:'failed',http_status:500,retryable:true,checkpoint:{phase:'import',ref:'retained'}}),{now});
 assert.equal(reserve(state).decision,'retry_wait');
 const later=now+POLICY.retryDelayMs;batch=reserve(state,{now:later,storage:{...storage,measured_at:later},claimId:'b'});assert.equal(batch.decision,'reserved');
 state=finishBatch(batch.state,'b',usage({status:'failed',http_status:400,retryable:true}),{now:later});assert.equal(state.groups[0].items[0].status,'stopped');
 state=await changeQueue(state,{action:'retry',group_id:'group-a',office:'FA0001'},directory,{now:later});assert.equal(state.groups[0].items[0].checkpoint.ref,'retained');
});
test('A lost completion keeps its reservation and pauses the queue for reconciliation',async()=>{
 const {state}=await group();const batch=reserve(state,{claimId:'lost'}),later=batch.claim.expires_at+1;
 const result=reserve(batch.state,{now:later,storage:{...storage,measured_at:later}});
 assert.equal(result.decision,'reconcile_required');assert.equal(result.state.paused,true);assert.equal(result.state.budgets[0].source_requests,POLICY.batchSourceRequests);
 await assert.rejects(changeQueue(result.state,{action:'retry',group_id:'group-a',office:'FA0001'},directory),/Reconcile/);
});
test('Measured usage and checkpoint phases cannot bypass reservations or publication checks',async()=>{
 const {state}=await group();const batch=reserve(state,{claimId:'a'});
 assert.throws(()=>finishBatch(batch.state,'a',usage({source_requests:POLICY.batchSourceRequests+1,status:'failed'})),/reserved/);
 assert.throws(()=>finishBatch(batch.state,'a',usage({status:'verified',...verified})),/independent/);
 assert.throws(()=>finishBatch(batch.state,'a',usage({status:'yielded',checkpoint:{phase:'verification',ref:'bad'}})),/phase/);
 assert.throws(()=>finishBatch(batch.state,'a',usage({status:'imported',checkpoint:{phase:'import',ref:'bad'}})),/verification/);
});
test('Durable queue commands use revision leases, and HTTP writes require the existing secret',async()=>{
 const {db,sql}=sqlite();sql.exec(readFileSync(new URL('../portfolio/migrations/0003.sql',import.meta.url),'utf8'));
 assert.equal((await readQueue(db)).revision,0);const plan=await reviewedPlan(['FA0001'],directory,POLICY);
 const command={action:'enqueue',plan,expected_revision:0};
 const outcomes=await Promise.allSettled([mutateQueue(db,command,directory,{now,id:'one'}),mutateQueue(db,command,directory,{now,id:'two'})]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await readQueue(db)).groups.length,1);
 await assert.rejects(mutateQueue(db,{action:'resume',expected_revision:0},directory),/changed/);
 const env={PORTFOLIO_DB:db,OFFICES:directory,PORTFOLIO_INGEST_SECRET:'fixture'};
 await assert.rejects(portfolioRoute(new Request('https://local/api/admin/portfolio/queue',{method:'POST',body:'{}'}),env),e=>e.status===401);
 const request=body=>new Request('https://local/api/admin/portfolio/queue',{method:'POST',headers:{'X-ContractIntel-Ingest-Secret':'fixture'},body:JSON.stringify(body)});
 await assert.rejects(portfolioRoute(request({action:'tick',expected_revision:1,executionEnabled:true}),env),e=>e.status===400);
 await assert.rejects(portfolioRoute(request({action:'resume',expected_revision:1,executionEnabled:true}),env),e=>e.status===400);
 const result=await portfolioRoute(new Request('https://local/api/admin/portfolio/queue',{headers:{'X-ContractIntel-Ingest-Secret':'fixture'}}),env);
 assert.equal(result.execution_enabled,false);assert.equal(result.groups.length,1);sql.close();
});
test('Queue endpoint bounds request bodies before any mutation',async()=>{
 const request=new Request('https://local/api/admin/portfolio/queue',{method:'POST',headers:{'X-ContractIntel-Ingest-Secret':'fixture'},body:' '.repeat(CONFIG.queue.maxRequestBytes+1)});
 await assert.rejects(portfolioRoute(request,{PORTFOLIO_INGEST_SECRET:'fixture',OFFICES:directory}),e=>e.status===413);
});
