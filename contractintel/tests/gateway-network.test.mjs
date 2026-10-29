import test from 'node:test';
import assert from 'node:assert/strict';
import {retryGateway,transientConnection} from '../portfolio/r2/retry.mjs';
import {continuationDecision} from '../portfolio/r2/cohort-policy.mjs';
import {CONFIG} from '../portfolio/ingest.mjs';
const network=()=>new TypeError('fetch failed',{cause:{code:'ECONNRESET'}});
test('Gateway dropped connections retry with bounded exponential backoff and jitter',async()=>{
 let calls=0;const delays=[],events=[];
 const response=await retryGateway(async()=>{if(++calls<3)throw network();return new Response('ok');},{sleep:async n=>delays.push(n),random:()=>0.5,onRetry:event=>events.push(event)});
 assert.equal(response.status,200);assert.equal(calls,3);assert.deepEqual(delays,[1500,2500]);assert.ok(events.every(e=>e.network_failure&&e.status===null));
});
test('Exhausted connection retries yield for another bounded job, not a permanent queue stop',async()=>{
 let calls=0;
 await assert.rejects(retryGateway(async()=>{calls++;throw network();},{sleep:async()=>{},random:()=>0}),error=>{
  assert.equal(error.message,'R2 gateway network failure: fetch failed');
  assert.equal(continuationDecision({status:'failed',error:error.message},1).resume,true);
  assert.equal(continuationDecision({status:'failed',error:error.message},CONFIG.r2Nightly.maxCohortRuns).blocked,true);
  return true;
 });assert.equal(calls,CONFIG.authority.retryAttempts);
});
test('Lost conditional write response preserves the precondition for existing checksum reconciliation',async()=>{
 let calls=0,commits=0;const expected='old-etag',observed=[];
 const response=await retryGateway(async()=>{calls++;observed.push(expected);if(calls===1){commits++;throw network();}return new Response(null,{status:412});},{sleep:async()=>{}});
 assert.equal(response.status,412);assert.equal(commits,1);assert.deepEqual(observed,['old-etag','old-etag']);
});
test('Validation failures, programming errors, caller cancellation and uncertain D1 writes never become retries',async()=>{
 for(const error of [new Error('checksum differs'),new TypeError('Invalid URL'),new DOMException('cancelled','AbortError'),new TypeError('fetch failed',{cause:{code:'CERT_HAS_EXPIRED'}}),new Error('D1 HTTP connection failed; write outcome may be unknown.')]){
  let calls=0;await assert.rejects(retryGateway(async()=>{calls++;throw error;},{sleep:async()=>{throw Error('must not retry');}}),e=>e===error);assert.equal(calls,1);
 }
 assert.equal(transientConnection(new TypeError('fetch failed')),true);
 for(const message of ['R2 gateway network failure: fetch failed; checksum differs','D1 HTTP connection failed; write outcome may be unknown.','fetch failed'])assert.equal(continuationDecision({status:'failed',error:message},1).resume,false);
});
test('Source facade transport errors are resumable without misclassifying malformed data',async()=>{
 for(const message of ['USAspending did not respond in time. Your loaded records are retained; retry shortly.','USAspending returned an unreadable response. Retry shortly.'])assert.equal(continuationDecision({status:'failed',error:message},1).resume,true);
 assert.equal(continuationDecision({status:'failed',error:'Invalid source payload'},1).resume,false);
 await assert.rejects(retryGateway(()=>new Response('ok'),{attempts:0}),/retry budget/);
});
