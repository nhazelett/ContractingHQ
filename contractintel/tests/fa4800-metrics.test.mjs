import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCost,listRuns,parseReport} from '../portfolio/fa4800-metrics.mjs';
test('Import cost includes failed attempts, deduplicates retries, and discloses missing accounting',()=>{
 const report=(source_requests,start,end)=>({office:'FA4800',source_requests,started_at:start,finished_at:end});
 const a={attempt_key:'one',report:report(100,'2026-10-26T10:00:00Z','2026-10-26T10:01:00Z')},b={attempt_key:'two',report:report(200,'2026-10-26T10:05:00Z','2026-10-26T10:07:00Z')};
 const current={d1_publication_version:'version',views:[{start:'2007-10-01',after:{total_awards:2000}}],stored_compressed_publication_bytes:4000000};
 const result=summarizeCost([a,a,b],current,{unknownAttempts:[{job_id:1}]});
 assert.equal(result.source_requests_reported,300);assert.equal(result.source_job_minutes,3);assert.equal(result.elapsed_minutes,7);assert.equal(result.per_1000_awards.source_requests_reported,150);assert.equal(result.per_1000_awards.compressed_bytes,2000000);assert.equal(result.request_accounting_complete,false);assert.ok(result.source_requests_upper_bound>300);
});


test('Provisional audit reports measured work but never substitutes checkpoint size for a published snapshot',()=>{
 const report={office:'FA4800',status:'yielded',source_requests:100,started_at:'2026-10-28T10:00:00Z',finished_at:'2026-10-28T10:02:00Z',checkpoint_bytes:7000000,chunks:[{work_id:'w',discovered_awards:7968}]};
 const result=summarizeCost([{attempt_key:'one',report}],report,{provisional:true});
 assert.equal(result.status,'provisional_unpublished');assert.equal(result.d1_publication_version,null);
 assert.equal(result.compressed_bytes_one_r2_publication,null);assert.equal(result.per_1000_awards.compressed_bytes,null);
 assert.equal(result.checkpoint_bytes_latest,7000000);assert.equal(result.source_job_minutes,2);
 assert.throws(()=>summarizeCost([{attempt_key:'one',report}],report));
});
test('History pagination reads all pages and refuses a truncated audit',async()=>{
 const paths=[],api=async path=>{paths.push(path);return Response.json({total_count:3,workflow_runs:path.includes('page=1')?[{id:1},{id:2}]:[{id:3}]});};
 const rows=await listRuns(api,{maxRuns:4,pageSize:2});assert.deepEqual(rows.map(r=>r.id),[1,2,3]);assert.equal(paths.length,2);
 await assert.rejects(listRuns(async()=>Response.json({total_count:5,workflow_runs:[]}),{maxRuns:4,pageSize:2}),/limit/);
});
test('Report parsing ignores malformed lines and uses the final structured report',()=>{
 const report=parseReport('noise\nnow {"r2_update_report":broken}\nlater {"r2_update_report":{"office":"FA4800","source_requests":7}}');
 assert.equal(report.source_requests,7);
});
