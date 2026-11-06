import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../portfolio/ingest.mjs';
import {assertSafeRemoval,assertDiscoveryComplete} from '../portfolio/publication-safety.mjs';
import {runIngest,seedOffices} from '../portfolio/ingest.mjs';
import {sqlite,source,office,fixed} from './fixtures/portfolio-d1.mjs';
const options={windows:CONFIG.windows,limits:CONFIG.publicationSafety};
const rows=(count,offset=0)=>Array.from({length:count},(_,i)=>({generated_unique_award_id:'award-'+(i+offset)}));
const tables=awards=>({awards,award_windows:awards.flatMap(row=>CONFIG.windows.map(window_start=>({...row,window_start})))});

test('The 1,613-award incident is blocked even when additions hide the net loss',()=>{
 const before=tables(rows(4091)),after=tables([...rows(2478,1613),...rows(1613,5000)]);
 assert.throws(()=>assertSafeRemoval(before,after,options),/remove 1613 of 4091/);
});
test('Every window is protected even when the complete award set is unchanged',()=>{
 const before=tables(rows(4091)),after=structuredClone(before);
 after.award_windows=after.award_windows.filter(row=>row.window_start!==CONFIG.windows[0]||Number(row.generated_unique_award_id.slice(6))>=1613);
 assert.throws(()=>assertSafeRemoval(before,after,options),/window 2007-10-01 would remove 1613/);
});
test('Absolute and fractional removal limits fail independently',()=>{
 assert.throws(()=>assertSafeRemoval(tables(rows(10000)),tables(rows(9899,101)),options),/remove 101/);
 assert.throws(()=>assertSafeRemoval(tables(rows(100)),tables(rows(90,10)),options),/remove 10/);
 assert.doesNotThrow(()=>assertSafeRemoval(tables(rows(2000)),tables(rows(1900,100)),options));
});
test('Ordinary small removals, unchanged data and initial population remain permitted',()=>{
 assert.doesNotThrow(()=>assertSafeRemoval(tables(rows(5)),tables(rows(4)),options));
 assert.doesNotThrow(()=>assertSafeRemoval(tables(rows(4091)),tables(rows(4091)),options));
 assert.doesNotThrow(()=>assertSafeRemoval(tables([]),tables(rows(4091)),options));
});
test('A nonempty publication cannot silently become empty',()=>{
 assert.throws(()=>assertSafeRemoval(tables(rows(1)),tables([]),options),/publication retained/);
});
test('Invalid removal configuration fails closed',()=>{
 for(const limits of [{...options.limits,maxRemovedAwards:NaN},{...options.limits,maxRemovedFraction:2},{...options.limits,minRemovedForFraction:0}])assert.throws(()=>assertSafeRemoval(tables([]),tables([]),{...options,limits}),/Invalid publication removal limits/);
});
const complete=()=>({discovery_version:1,window:CONFIG.windows.length,page:1,cursor:null,sort_value:null,windows:Object.fromEntries(CONFIG.windows.map(start=>[start,['award-1']])),discovery_windows:Object.fromEntries(CONFIG.windows.map(start=>[start,{complete:true,pages:2,unique_awards:1}]))});
test('Discovery requires explicit terminal-page evidence for every window',()=>{
 assert.doesNotThrow(()=>assertDiscoveryComplete(complete(),CONFIG.windows));
 for(const mutate of [s=>delete s.discovery_version,s=>s.window--,s=>s.page++,s=>s.cursor='123',s=>delete s.discovery_windows[CONFIG.windows[0]],s=>s.discovery_windows[CONFIG.windows[0]].complete=false,s=>s.discovery_windows[CONFIG.windows[0]].pages=0,s=>s.windows[CONFIG.windows[0]].push('award-2'),s=>s.windows[CONFIG.windows[0]].push('award-1')]){
  const state=complete();mutate(state);assert.throws(()=>assertDiscoveryComplete(state,CONFIG.windows),/Discovery/);
 }
});

async function legacyFixture(){const x=sqlite(),upstream=source();await seedOffices(x.db,[office]);
 const env={PORTFOLIO_DB:x.db,OFFICES:[office]},config={sourceIntervalMs:0};
 await runIngest(env,{mode:'backfill',now:fixed,fetcher:upstream.fetcher,config});return {...x,upstream,env,config};
}
test('Legacy D1 ingest refuses an emptied source scan and retains published awards',async()=>{
 const x=await legacyFixture(),before=x.sql.prepare('SELECT * FROM office_publications').get();
 const fetcher=async(url,options)=>url.includes('spending_by_award')?Response.json({results:[],page_metadata:{hasNext:false}}):x.upstream.fetcher(url,options);
 await assert.rejects(runIngest(x.env,{mode:'nightly',now:fixed,fetcher,config:x.config}),/Publication removal guard/);
 assert.deepEqual(x.sql.prepare('SELECT * FROM office_publications').get(),before);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,5);x.sql.close();
});
test('Legacy D1 checkpoints without discovery evidence cannot resume source work',async()=>{
 const x=await legacyFixture();
 await runIngest(x.env,{mode:'nightly',now:fixed,fetcher:x.upstream.fetcher,config:{...x.config,maxSourceRequests:4,sourceRequestReserve:2}});
 const row=x.sql.prepare('SELECT checkpoint_json FROM ingest_office_progress').get(),cp=JSON.parse(row.checkpoint_json);delete cp.discovery_version;
 x.sql.prepare('UPDATE ingest_office_progress SET checkpoint_json=?').run(JSON.stringify(cp));
 await assert.rejects(runIngest(x.env,{mode:'nightly',now:fixed,fetcher:async()=>{throw Error('must not fetch');},config:x.config}),/Legacy checkpoint lacks discovery/);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,5);x.sql.close();
});
test('Legacy D1 batch rejects a publication that changed after removal validation',async()=>{
 const x=await legacyFixture();let injected=false;
 const db={...x.db,batch:async statements=>{
  if(!injected&&statements.some(s=>s._sql.includes('publication_unchanged'))){injected=true;
   x.sql.prepare("INSERT INTO ingest_runs(id,mode,started_at,status,config_json) VALUES('concurrent-winner','nightly',?,'completed','{}')").run(new Date(fixed()).toISOString());
   x.sql.exec("UPDATE office_publications SET published_run_id='concurrent-winner'");
  }
  return x.db.batch(statements);
 }};
 await assert.rejects(runIngest({...x.env,PORTFOLIO_DB:db},{mode:'nightly',now:fixed,fetcher:x.upstream.fetcher,config:x.config}),/malformed JSON/);
 assert.equal(injected,true);assert.equal(x.sql.prepare('SELECT published_run_id FROM office_publications').get().published_run_id,'concurrent-winner');
 assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,5);x.sql.close();
});
