import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../portfolio/ingest.mjs';
import {capacityDecision,partitionPlan} from '../portfolio/queue/capacity.mjs';
import {auditPage} from '../portfolio/queue/storage-audit-worker.mjs';
test('D1 and R2 capacity are independent and keep staging headroom',()=>{
 assert.equal(capacityDecision({d1Bytes:142479360,baselineR2Bytes:30000000,reservedR2Bytes:CONFIG.capacity.perOfficeR2Bytes,newOffice:true}),'ready');
 assert.equal(capacityDecision({d1Bytes:1,baselineR2Bytes:0,reservedR2Bytes:CONFIG.capacity.maxR2Bytes,newOffice:false}),'r2_storage_limit');
 assert.equal(capacityDecision({d1Bytes:CONFIG.capacity.maxD1Bytes,baselineR2Bytes:0}),'d1_storage_limit');
 assert.equal(capacityDecision({d1Bytes:NaN,baselineR2Bytes:0}),'storage_measurement_required');
});
test('New offices stop before partition threshold while existing offices may refresh',()=>{
 const bytes=CONFIG.capacity.partitionAtBytes;
 assert.equal(capacityDecision({d1Bytes:bytes,baselineR2Bytes:0,newOffice:true}),'database_partition_required');
 assert.equal(capacityDecision({d1Bytes:bytes,baselineR2Bytes:0,newOffice:false}),'ready');
 const plan=partitionPlan(bytes);
 assert.equal(plan.automatic_shard_creation,false);
 assert.ok(plan.hard_guard_bytes<10000000000);
 assert.ok(plan.requirements.some(x=>x.includes('read')));
});
test('Storage gateway lists every object page and refuses unauthorized access and writes',async()=>{
 const calls=[];
 const env={STORAGE_AUDIT_TOKEN:'fixture',B0:{list:async options=>{calls.push(options);return options.cursor?{objects:[{size:9}],truncated:false}:{objects:[{size:3},{size:5}],truncated:true,cursor:'next'};}}};
 const request=(suffix='',method='GET',auth='fixture')=>new Request('https://audit/list?bucket=B0'+suffix,{method,headers:{Authorization:'Bearer '+auth}});
 assert.equal((await auditPage(request('','GET','wrong'),env)).status,401);
 assert.equal((await auditPage(request('','POST'),env)).status,405);
 const first=await(await auditPage(request(),env)).json();
 assert.deepEqual(first,{bytes:8,objects:2,truncated:true,cursor:'next'});
 const second=await(await auditPage(request('&cursor=next'),env)).json();
 assert.deepEqual(second,{bytes:9,objects:1,truncated:false,cursor:null});
 assert.equal(calls[1].cursor,'next');
 assert.equal((await auditPage(new Request('https://audit/list?bucket=B4',{headers:{Authorization:'Bearer fixture'}}),env)).status,400);
});
test('Storage gateway rejects malformed object sizes rather than claiming a complete baseline',async()=>{
 const response=await auditPage(new Request('https://audit/list?bucket=B0',{headers:{Authorization:'Bearer fixture'}}),{STORAGE_AUDIT_TOKEN:'fixture',B0:{list:async()=>({objects:[{size:-1}],truncated:false})}});
 assert.equal(response.status,503);
});

test('D1 work-budget exhaustion stays resumable instead of becoming an uncertain network write',async()=>{
 const {createHttpD1}=await import('../portfolio/d1-http.mjs');
 const db=createHttpD1({account:'a'.repeat(32),database:'a'.repeat(36),token:'fixture',interval:0,fetcher:async()=>{throw Error('D1 job budget reached; saved staging will resume.');}});
 await assert.rejects(db.prepare('SELECT 1').all(),/^Error: D1 job budget reached; saved staging will resume\.$/);
});
