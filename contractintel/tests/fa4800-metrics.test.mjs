import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCost} from '../portfolio/fa4800-metrics.mjs';
test('Import cost includes failed attempts, deduplicates retries, and discloses missing accounting',()=>{
 const report=(source_requests,start,end)=>({office:'FA4800',source_requests,started_at:start,finished_at:end});
 const a={attempt_key:'one',report:report(100,'2026-10-26T10:00:00Z','2026-10-26T10:01:00Z')},b={attempt_key:'two',report:report(200,'2026-10-26T10:05:00Z','2026-10-26T10:07:00Z')};
 const current={d1_publication_version:'version',views:[{start:'2007-10-01',after:{total_awards:2000}}],stored_compressed_publication_bytes:4000000};
 const result=summarizeCost([a,a,b],current,{unknownAttempts:[{job_id:1}]});
 assert.equal(result.source_requests_reported,300);assert.equal(result.source_job_minutes,3);assert.equal(result.elapsed_minutes,7);assert.equal(result.per_1000_awards.source_requests_reported,150);assert.equal(result.per_1000_awards.compressed_bytes,2000000);assert.equal(result.request_accounting_complete,false);assert.ok(result.source_requests_upper_bound>300);
});
