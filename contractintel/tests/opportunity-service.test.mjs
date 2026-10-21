import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {refreshNotices,reserveRequest,descriptionText} from '../opportunities/source.mjs';
import {opportunityRoute} from '../opportunities/api.mjs';
import {handle} from '../worker/api.mjs';

const today=new Date().toISOString().slice(0,10),now=new Date(today+'T23:00:00Z');
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../opportunities/schema.sql',import.meta.url),'utf8'));
 const prepare=sql=>{const bound=params=>({sql,params,all:async()=>({results:sqlite.prepare(sql).all(...params)}),first:async()=>sqlite.prepare(sql).get(...params)||null,run:async()=>sqlite.prepare(sql).run(...params)});return {...bound([]),bind:(...params)=>bound(params)};};
 const db={prepare,batch:async stmts=>{sqlite.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(sqlite.prepare(s.sql).run(...s.params));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,db,env:{OPPORTUNITIES_DB:db,SAM_API_KEY:'private-test-key'}};
}
const notice=(n,extra={})=>({noticeId:n.toString(16).padStart(32,'0'),title:'HVAC maintenance '+n,solicitationNumber:'TEST-'+n,fullParentPathCode:'097.5700.'+(n%2?'FA4800':'W9124J'),fullParentPathName:'DEFENSE.AIR FORCE.TEST OFFICE',type:'o',active:'Yes',postedDate:today+' '+String(n%24).padStart(2,'0')+':00:00',responseDeadLine:today,naicsCode:'238220',classificationCode:'J041',typeOfSetAside:'SBA',typeOfSetAsideDescription:'Total Small Business',description:'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid='+n+'&api_key=private-test-key',uiLink:'https://sam.gov/opp/'+n.toString(16).padStart(32,'0')+'/view',...extra});
const source=rows=>async()=>new Response(JSON.stringify({totalRecords:rows.length,opportunitiesData:rows}));
const get=(env,query='')=>opportunityRoute(new URL('https://test/api/opportunities?'+query),env);

test('Opportunity search sorts full source timestamps across pages and filters without ingestion-time ordering',async()=>{
 const f=fixture();try{await refreshNotices(f.env,{now,days:1,fetcher:source(Array.from({length:65},(_,i)=>notice(i+1))),pause:async()=>{}});const a=await get(f.env),b=await get(f.env,'page=2&run='+a.run);assert.equal(a.total,65);assert.equal(a.rows.length,50);assert.equal(b.rows.length,15);const rows=[...a.rows,...b.rows];assert.deepEqual(rows.map(r=>r.posted.raw),[...rows].sort((a,b)=>b.posted.raw.localeCompare(a.posted.raw)).map(r=>r.posted.raw));
 const filtered=await get(f.env,'office=FA4800&q=HVAC&naics=238220&psc=J041&set_aside=SBA');assert.equal(filtered.total,33);assert.ok(filtered.rows.every(r=>r.office_code==='FA4800'));assert.equal(filtered.sort,'newest_posted_first');assert.equal(a.coverage.windows[0].complete,true);
 assert.ok(!JSON.stringify(a).includes('private-test-key'));assert.ok(!JSON.stringify(a).includes('description_ref'));
 }finally{f.sqlite.close();}
});

test('Ingestion passes SAM page indexes, marks bounded partial coverage and never treats a failed scan as empty success',async()=>{
 const f=fixture();try{const offsets=[];await refreshNotices(f.env,{now,days:1,maxCalls:2,pause:async()=>{},fetcher:async u=>{offsets.push(u.searchParams.get('offset'));return new Response(JSON.stringify({totalRecords:3,opportunitiesData:offsets.length===1?[notice(1),notice(2)]:[notice(3)]}));}});assert.deepEqual(offsets,['0','1']);const prior=await get(f.env);assert.equal(prior.total,3);
 await assert.rejects(refreshNotices(f.env,{now,days:1,fetcher:async()=>new Response('{}'),pause:async()=>{}}),/unexpected notice/);assert.equal((await get(f.env)).run,prior.run);assert.ok((await get(f.env)).last_refresh.last_error);
 await refreshNotices(f.env,{now,days:2,maxCalls:1,pause:async()=>{},fetcher:source([notice(4)])});const partial=await get(f.env);assert.equal(partial.coverage.complete,false);assert.equal(partial.coverage.windows.length,1);
 }finally{f.sqlite.close();}
});

test('Daily SAM budget is atomic, bounded and shared by ingestion and description reads',async()=>{
 const f=fixture();try{for(let i=0;i<10;i++)await reserveRequest(f.db,now);await assert.rejects(reserveRequest(f.db,now),e=>e.status===429);assert.equal(f.sqlite.prepare('SELECT requests FROM opp_usage').get().requests,10);let calls=0;await assert.rejects(refreshNotices(f.env,{now,days:1,fetcher:async()=>{calls++;return source([])();},pause:async()=>{}}),/budget/);assert.equal(calls,0);}finally{f.sqlite.close();}
});

test('Descriptions are cached, rendered as text and never leak authenticated references',async()=>{
 const f=fixture();try{await refreshNotices(f.env,{now,days:1,fetcher:source([notice(1)]),pause:async()=>{}});let calls=0;f.env.SAM_FETCH=async u=>{calls++;assert.equal(u.origin,'https://api.sam.gov');assert.equal(u.searchParams.get('api_key'),'private-test-key');return new Response(JSON.stringify({description:'<p>Maintain ventilation.</p><script>unsafe()</script><p>Respond &amp; inspect.</p>'}));};const id=notice(1).noticeId,url=new URL('https://test/api/opportunity?id='+id+'&description=1');const a=await opportunityRoute(url,f.env),b=await opportunityRoute(url,f.env);assert.equal(calls,1);assert.equal(a.description.status,'available');assert.equal(b.description.text,'Maintain ventilation.\nRespond & inspect.');assert.ok(!JSON.stringify(a).includes('private-test-key'));assert.ok(!a.description.text.includes('unsafe'));assert.equal(descriptionText('<img src=x onerror=bad>Safe'),'Safe');}finally{f.sqlite.close();}
});

test('Source failures and description quotas preserve indexed detail and public links',async()=>{
 const f=fixture();try{await refreshNotices(f.env,{now,days:1,fetcher:source([notice(1)]),pause:async()=>{}});f.env.SAM_FETCH=async()=>{throw new Error('private-test-key');};const r=await opportunityRoute(new URL('https://test/api/opportunity?id='+notice(1).noticeId+'&description=1'),f.env);assert.equal(r.notice.title,'HVAC maintenance 1');assert.equal(r.description.status,'unavailable');assert.ok(!JSON.stringify(r).includes('private-test-key'));}finally{f.sqlite.close();}
});

test('Filters, CSV and read-only routes reject injection and retain all filtered results',async()=>{
 const f=fixture();try{await refreshNotices(f.env,{now,days:1,fetcher:source([notice(1,{title:'=unsafe title'}),notice(2)]),pause:async()=>{}});for(const q of ['psc=bad%3BDROP','page=-1','sort=value','posted_from=2026-02-30','q='+('a'.repeat(161))])await assert.rejects(get(f.env,q),e=>e.status===400);
 const csv=await get(f.env,'export=csv');assert.equal(csv.headers.get('Content-Type'),'text/csv; charset=utf-8');const data=await csv.text();assert.equal(data.trim().split('\r\n').length,3);assert.ok(data.includes("'=unsafe title"));assert.equal((await handle(new Request('https://test/api/opportunities',{method:'POST'}),f.env)).status,405);assert.equal((await handle(new Request('https://test/api/opportunities?psc=invalid'),f.env)).status,400);
 }finally{f.sqlite.close();}
});

test('Empty, unconfigured and retired indexes stay distinct',async()=>{
 const f=fixture();try{await assert.rejects(get(f.env),e=>e.status===503);await refreshNotices(f.env,{now,days:1,fetcher:source([]),pause:async()=>{}});assert.equal((await get(f.env)).total,0);await assert.rejects(get(f.env,'run='+'a'.repeat(36)),e=>e.status===409);assert.equal((await handle(new Request('https://test/api/opportunities'),{})).status,503);}finally{f.sqlite.close();}
});
