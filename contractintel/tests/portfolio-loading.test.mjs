import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSnapshot,validSnapshot,visiblePortfolio,createPortfolioMemory} from '../web/portfolio-memory.mjs';
import {incorporatePortfolio,portfolioComplete,summariesComplete} from '../web/portfolio-progress.mjs';
import {scanPortfolio} from '../web/portfolio-loader.mjs';
import {resolve} from '../web/source.mjs';
const id=n=>'CONT_AWD_FA480024C'+String(n).padStart(4,'0')+'_9700_-NONE-_-NONE-';
const row=n=>({award_id:id(n),piid:'FA480024C'+String(n).padStart(4,'0'),description:'Requirement '+n,current_end_date:'2027-01-01',potential_end_date:'2028-01-01',award_amount_cents:'12345',details_pending:false});
const office='FA4800',window='2021-10-01';

test('Browser snapshots isolate office/window, bound metadata, and exclude histories and unfinished source details',()=>{
 const rows=[{...row(1),contacts:['private'],history:{actions:[{}]},source_refresh_pending:true}, {...row(2),details_pending:true},{...row(3),details_unavailable:true},{...row(4),award_id:'CONT_AWD_W9124J24C0001'}];
 const s=makeSnapshot(office,window,rows,100);assert.equal(s.records.length,1);assert.equal(s.records[0].award_amount_cents,'12345');assert.equal(s.records[0].history,undefined);assert.equal(s.records[0].contacts,undefined);assert.equal(s.records[0].source_refresh_pending,undefined);
 assert.equal(validSnapshot(s,'W9124J',window),null);assert.equal(validSnapshot(s,office,'2024-10-01'),null);assert.equal(validSnapshot({...s,version:999},office,window),null);assert.equal(validSnapshot({...s,records:null},office,window),null);
 assert.equal(makeSnapshot(office,window,[{...row(1),description:'x'.repeat(2100000)}]),null);assert.equal(makeSnapshot(office,window,[row(1)],NaN),null);
});

test('Browser preview never overwrites fresh source data; pending rows retain an explicit updating marker',()=>{
 const saved=new Map([[id(1),{...row(1),description:'Saved'}],[id(2),row(2)]]);
 const records=new Map([[id(1),{...row(1),details_pending:true,description:'New search description'}]]);
 const pending=visiblePortfolio(records,saved);assert.equal(pending.length,2);assert.equal(pending[0].description,'New search description');assert.equal(pending[0].source_refresh_pending,true);
 records.set(id(1),{...row(1),description:'Fresh',award_amount_cents:'99999'});
 const fresh=visiblePortfolio(records,saved);assert.equal(fresh[0].description,'Fresh');assert.equal(fresh[0].award_amount_cents,'99999');assert.ok(!fresh[0].source_refresh_pending);assert.equal(fresh[1].source_refresh_pending,true);
 saved.clear();assert.equal(visiblePortfolio(records,saved).length,1);
});

// Transactional event fixture; stores survive opening a second application instance.
function memoryFactory({quota=false}={}){
 const data=new Map();
 return {data,open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){let tx={};let done;
 const finish=()=>{clearTimeout(done);done=setTimeout(()=>tx.oncomplete?.(),0);};
 const store={get(key){const r={};queueMicrotask(()=>{r.result=structuredClone(data.get(key));r.onsuccess?.();finish();});return r;},getAll(){const r={};queueMicrotask(()=>{r.result=structuredClone([...data.values()]);r.onsuccess?.();finish();});return r;},put(s){if(quota)throw new Error('Quota exceeded');data.set(s.key,structuredClone(s));finish();},delete(k){data.delete(k);finish();}};
 tx.objectStore=()=>store;tx.abort=()=>{clearTimeout(done);queueMicrotask(()=>tx.onabort?.());};return tx;}};request.onsuccess?.();});return request;}};
}

test('Browser storage persists between visits and evicts the oldest of more than three portfolios',async()=>{
 const factory=memoryFactory(),first=createPortfolioMemory(factory);
 assert.equal(await first.put(makeSnapshot(office,window,[row(1)],1)),true);
 assert.equal((await createPortfolioMemory(factory).get(office,window)).records.length,1);
 for(const [n,date]of ['2024-10-01','2025-10-01','2007-10-01'].entries())await first.put(makeSnapshot(office,date,[row(1)],n+2));
 assert.equal(factory.data.size,3);assert.equal(await first.get(office,window),null);assert.ok(await first.get(office,'2007-10-01'));
});

test('Unavailable, denied or full browser storage cannot block fresh source loading',async()=>{
 for(const factory of [null,{open(){throw Error('Storage denied');}},memoryFactory({quota:true})]){
  const store=createPortfolioMemory(factory);assert.equal(await store.get(office,window),null);assert.equal(await store.put(makeSnapshot(office,window,[row(1)])),false);
 }
});

test('Summary-only source reads defer history without altering the default public award response',async()=>{
 const calls=[],detail={generated_unique_award_id:id(1),piid:row(1).piid,base_exercised_options:'123.45',period_of_performance:{end_date:'2027-01-01',potential_end_date:'2028-01-01'}};
 const env={OFFICES:[{code:office,name:'Test office'}],SUMMARY_ONLY:true,UPSTREAM_FETCH:async url=>{calls.push(url);return Response.json(url.includes('/transactions/')?{results:[],page_metadata:{hasNext:false}}:detail);}};
 const url=new URL('https://test/api/award?id='+id(1)),summary=await resolve(url,env);
 assert.equal(calls.length,1);assert.equal(summary.history,null);assert.equal(summary.award.award_amount_cents,'12345');assert.equal(incorporatePortfolio(summary).history_pending,true);
 calls.length=0;const full=await resolve(url,{...env,SUMMARY_ONLY:false});assert.equal(calls.length,2);assert.deepEqual(full.history.actions,[]);assert.equal(incorporatePortfolio(full).history_pending,false);
});

function fixture(rows=[row(1),row(2),row(3)]){
 const state={office,window,generation:1,controller:new AbortController(),records:new Map(),preview:new Map([[id(9),row(9)]]),cache:new Map(),pending:[],evidencePending:[],page:1,cursor:null,sortValue:null,hasNext:true,busy:false,paused:false,candidates:0,excluded:0,lastRequest:0};
 const trace=[],errors=[];let clock=0;
 const context={state,trace,errors,now:()=>clock,sleep:async ms=>{clock+=ms;},selectRows:r=>r,incorporate:incorporatePortfolio,progress(){},render(){},queueSave(){},clearError(){},failure:e=>errors.push(e),
 api:async(path,p)=>{trace.push(path+':'+(p.id||p.page));if(path==='awards'){const batch=rows.slice((p.page-1)*2,p.page*2);return {rows:batch.map(r=>({...r,details_pending:true})),has_next:p.page*2<rows.length,cursor:String(p.page),sort_value:'2027-01-01',candidates:batch.length,excluded:0,fetched_at:'2026-10-25T00:00:00Z'};}return {award:rows.find(r=>r.award_id===p.id),history:null};},
 hydrateEvidence:async id=>{trace.push('history:'+id);const current=state.records.get(id);state.records.set(id,incorporatePortfolio({award:current,history:{actions:[{modification_number:'P00001',action_date:'2026-10-01',action_type_code:'G'}],has_next:false}}));state.evidencePending=state.evidencePending.filter(x=>x!==id);}
 };return context;
}

test('Every summary is available before the background evidence phase; fresh discovery removes stale preview rows',async()=>{
 const f=fixture();await scanPortfolio(f);assert.equal(f.errors.length,0);assert.equal(f.state.records.size,3);assert.ok(portfolioComplete(f.state));assert.equal(f.state.preview.size,0);
 const firstHistory=f.trace.findIndex(t=>t.startsWith('history:')),lastSummary=f.trace.findLastIndex(t=>t.startsWith('award-summary:'));assert.ok(firstHistory>lastSummary);
 assert.ok([...f.state.records.values()].every(r=>!r.history_pending&&r.latest_mod_number==='P00001'));
});

test('Pause and resume retain summaries and load each remaining evidence record once',async()=>{
 const f=fixture(),api=f.api;let once=true;f.api=async(path,p)=>{const result=await api(path,p);if(path==='award-summary'&&once){once=false;f.state.paused=true;}return result;};
 await scanPortfolio(f);assert.equal(f.state.busy,false);assert.equal(f.state.paused,true);assert.equal(f.state.records.get(id(1)).history_pending,true);assert.ok(!portfolioComplete(f.state));
 await scanPortfolio(f);assert.ok(portfolioComplete(f.state));assert.equal(f.trace.filter(t=>t==='award-summary:'+id(1)).length,1);assert.equal(f.trace.filter(t=>t.startsWith('history:')).length,3);
});

test('Source failure keeps prior browser results and partial metadata, then retry completes normally',async()=>{
 const f=fixture(),api=f.api;let fail=true;f.api=async(path,p)=>{if(path==='award-summary'&&p.id===id(2)&&fail)throw Object.assign(Error('Source busy'),{status:503});return api(path,p);};
 await scanPortfolio(f);assert.equal(f.errors.length,1);assert.equal(f.state.preview.size,1);assert.equal(f.state.records.get(id(1)).details_pending,false);assert.ok(f.state.pending.includes(id(2)));
 fail=false;await scanPortfolio(f);assert.ok(portfolioComplete(f.state));assert.equal(f.state.preview.size,0);
});

test('Evidence failure never marks a portfolio complete or fabricates missing modifications',async()=>{
 const f=fixture([row(1)]),hydrate=f.hydrateEvidence;f.hydrateEvidence=async()=>{throw Error('History unavailable');};
 await scanPortfolio(f);assert.ok(summariesComplete(f.state));assert.ok(!portfolioComplete(f.state));assert.equal(f.state.records.get(id(1)).history_pending,true);assert.equal(f.state.records.get(id(1)).latest_mod_number,null);
 f.hydrateEvidence=hydrate;await scanPortfolio(f);assert.ok(portfolioComplete(f.state));
});

test('A successful empty fresh scan replaces the saved preview; an office switch rejects late responses',async()=>{
 const empty=fixture([]);await scanPortfolio(empty);assert.equal(empty.state.preview.size,0);assert.ok(portfolioComplete(empty.state));
 const f=fixture(),api=f.api;f.api=async(path,p)=>{const result=await api(path,p);if(path==='awards'){f.state.generation++;f.state.busy=false;}return result;};
 await scanPortfolio(f);assert.equal(f.state.records.size,0);assert.equal(f.trace.filter(t=>t.startsWith('award-summary')).length,0);
});
