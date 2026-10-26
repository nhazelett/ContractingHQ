import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageDashboard} from '../portfolio/r2/dashboard.mjs';
import {progressMetadata} from '../portfolio/r2/progress.mjs';
import {CONFIG,r2Profile} from '../portfolio/ingest.mjs';
import {createGateway} from '../portfolio/r2/gateway.mjs';
import {createFormat} from '../portfolio/r2/format.mjs';
test('Coverage uses bounded HEAD/list measurements without downloading checkpoint records',async()=>{
 const calls=[],saved={phase:'hydrate',status:'failed',candidates:{a:{raw:'private'}},hydrate_index:1,source_requests:9,attempts:[{http_failures:[{status:500,path:'/private-award'}]}]};
 const bucket={get:async key=>{calls.push(['get',key]);return null;},head:async key=>({size:20,uploaded:new Date('2026-10-26T20:00:00Z'),customMetadata:key.endsWith('checkpoint.json.gz')?progressMetadata(saved):{}}),list:async options=>{assert.equal(options.limit,CONFIG.coverage.listLimit);return {objects:[{size:20},{size:30}],truncated:false};}};
 const result=await coverageDashboard({PORTFOLIO_R2_FA4800:bucket,OFFICES:[{code:'FA4800'}]});
 const row=result.offices.find(o=>o.office==='FA4800');assert.equal(row.status,'importing');assert.equal(row.progress.prepared,1);assert.equal(row.storage.bytes,50);assert.match(row.issue,/500/);
 assert.ok(!calls.some(([method,key])=>method==='get'&&/checkpoint|verification/.test(key)));
 assert.ok(!JSON.stringify(result).includes('private-award'));assert.ok(!JSON.stringify(result).includes('"raw"'));
});
test('Coverage reports truncated storage as incomplete and survives an unavailable bucket',async()=>{
 const bucket={get:async()=>null,head:async()=>null,list:async()=>({objects:[{size:100}],truncated:true})};
 const result=await coverageDashboard({PORTFOLIO_R2_FA4800:bucket});
 assert.equal(result.offices[1].storage.complete,false);assert.equal(result.offices[0].storage,null);assert.match(result.offices[0].issue,/unavailable/);
});
test('Gateway stores safe progress metadata in the existing checkpoint write',async()=>{
 const profile=r2Profile('FA4800'),format=createFormat(profile),objects=new Map();let writes=0;
 const bucket={get:async key=>objects.get(key)||null,head:async key=>objects.get(key)||null,put:async(key,body,options)=>{writes++;const bytes=new Uint8Array(body);const object={size:bytes.length,etag:'fixture',httpEtag:'"fixture"',customMetadata:options.customMetadata,json:async()=>JSON.parse(new TextDecoder().decode(bytes))};objects.set(key,object);return object;}};
 const state={office:'FA4800',format_version:1,work_id:'test',phase:'hydrate',status:'yielded',candidates:{a:{secret:'must not leak'}},hydrate_index:1,source_requests:2};
 const body=await format.pack(state);
 const response=await createGateway(profile).fetch(new Request('https://gateway/object?key=pilot%2FFA4800%2Fcheckpoint.json.gz',{method:'PUT',headers:{Authorization:'Bearer fixture','If-None-Match':'*','X-Object-SHA256':body.sha256},body:body.bytes}),{TARGET:bucket,R2_UPDATE_TOKEN:'fixture'});
 assert.equal(response.status,200);assert.equal(writes,2); // existing ledger + checkpoint, no extra object/write
 const metadata=objects.get(profile.prefix+'/checkpoint.json.gz').customMetadata;
 assert.equal(JSON.parse(metadata.progress).prepared,1);assert.ok(!JSON.stringify(metadata).includes('must not leak'));
});
