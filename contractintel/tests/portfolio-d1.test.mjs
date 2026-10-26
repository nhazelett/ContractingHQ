import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runIngest,seedOffices,CONFIG,derive} from '../portfolio/ingest.mjs';
import {officeSnapshot,storedAward,storageReport} from '../portfolio/read.mjs';
import {portfolioRoute} from '../portfolio/http.mjs';
import {currentDate} from '../web/calendar.mjs';
import {tryOfficeSnapshot,tryStoredEvidence,storedFiscal} from '../web/portfolio-store.mjs';
import {sqlite,source,office,fixed} from './fixtures/portfolio-d1.mjs';
const opts=()=>({mode:'backfill',now:fixed,config:{sourceIntervalMs:0}});
async function setup(){const {db,sql}=sqlite();await seedOffices(db,[office]);const upstream=source();return {db,sql,upstream,env:{PORTFOLIO_DB:db,OFFICES:[office],PORTFOLIO_INGEST_SECRET:'test-secret'}};}
test('NY calendar handles UTC midnight, both DST transitions, and fiscal-year rollover',()=>{
 for(const [instant,date]of [['2026-10-26T01:00:00Z','2026-10-25'],['2026-03-08T06:59:59Z','2026-03-08'],['2026-03-08T07:00:00Z','2026-03-08'],['2026-11-01T05:59:59Z','2026-11-01'],['2026-11-01T06:00:00Z','2026-11-01'],['2026-10-01T02:00:00Z','2026-09-30']])assert.equal(currentDate(Date.parse(instant)),date);
});
test('Backfill publishes all four exact windows, evidence, cents, and transaction-based FY totals',async()=>{
 const x=await setup();const result=await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});assert.equal(result.status,'completed');
 const all=await officeSnapshot(x.db,'FA4528',CONFIG.windows[0],{now:fixed}),recent=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed});
 assert.equal(all.records.length,5);assert.equal(recent.records.length,4);assert.equal(recent.today,'2026-10-25');assert.equal(recent.records[0].days_to_current_end,1);
 assert.equal(recent.records[0].award_amount_cents,'10001');assert.equal(recent.records[0].latest_option_mod_number,'P00001');assert.equal(recent.records.filter(r=>r.date_review_flag).length,2);
 assert.equal(recent.fiscal_totals[0].cents,'-1500');assert.equal(recent.fiscal_totals[0].count,1);assert.equal(recent.fiscal_totals[1].cents,'-125');
 const detail=await storedAward(x.db,'FA4528',x.upstream.ids[0]);assert.equal(detail.history.actions[0].action_type_code,'G');assert.equal(detail.history.has_next,true);assert.equal(detail.award.source_url.includes('usaspending.gov/award/'),true);
 assert.equal(x.sql.prepare('SELECT count(*) n FROM ingest_stage').get().n,0);
 assert.equal(x.sql.prepare('SELECT recipient_uei FROM awards LIMIT 1').get().recipient_uei,'UEI0');
});
test('Budgeted invocations resume their checkpoints and never expose partial offices',async()=>{
 const x=await setup();let result,attempts=0;
 do{result=await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher,config:{sourceIntervalMs:0,maxSourceRequests:8}});attempts++;if(result.status==='yielded')await assert.rejects(officeSnapshot(x.db,'FA4528',CONFIG.windows[1]),e=>e.status===404);}while(result.status==='yielded'&&attempts<20);
 assert.equal(result.status,'completed');assert.ok(attempts>1);assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,5);assert.equal(x.sql.prepare('SELECT count(*) n FROM ingest_runs').get().n,attempts);
});
test('Repeated backfill leaves award/evidence business records unchanged and history IDs are unique',async()=>{
 const x=await setup();await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});const before=x.sql.prepare('SELECT * FROM awards ORDER BY generated_unique_award_id').all(),history=x.sql.prepare('SELECT * FROM award_history_pages ORDER BY generated_unique_award_id').all();
 await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});assert.deepEqual(x.sql.prepare('SELECT * FROM awards ORDER BY generated_unique_award_id').all(),before);assert.deepEqual(x.sql.prepare('SELECT * FROM award_history_pages ORDER BY generated_unique_award_id').all(),history);
});
test('Nightly hydrates changed awards only, preserving all-window coverage and unchanged awards',async()=>{
 const x=await setup();await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});x.upstream.calls.length=0;
 await runIngest(x.env,{...opts(),mode:'nightly',fetcher:x.upstream.fetcher});assert.equal(x.upstream.calls.filter(c=>c.path.includes('/awards/')).length,1);assert.equal(x.sql.prepare('SELECT count(*) n FROM awards').get().n,5);assert.equal(x.upstream.calls[0].body.filters.time_period[0].date_type,'last_modified_date');
});
test('Serve-time days and classification recompute on NY date without waiting for ingest',async()=>{
 const x=await setup();await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});
 const earlier=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:()=>Date.parse('2026-10-26T03:59:59Z')}),later=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:()=>Date.parse('2026-10-26T04:00:00Z')});
 assert.equal(earlier.records[0].days_to_current_end,1);assert.equal(later.records[0].days_to_current_end,0);assert.equal(later.today,'2026-10-26');
 assert.equal(derive({current_end_date:'2026-10-25',potential_end_date:'2026-10-25'},later.today).dataset_bucket,'completed');
});
test('Office publications gate missing offices; the scope cannot expand beyond FA4528',async()=>{
 const x=await setup();await assert.rejects(officeSnapshot(x.db,'FA4800',CONFIG.windows[1]),e=>e.status===404);await assert.rejects(runIngest(x.env,{...opts(),config:{offices:['FA4800']}}),/restricted/);
 x.sql.prepare("UPDATE ingest_lock SET owner='other',lease_until='2099-01-01'").run();assert.equal((await runIngest(x.env,opts())).status,'busy');
});
test('HTTP job requires secret and POST; the read route rejects unexpected query parameters',async()=>{
 const x=await setup(),base='https://local/api/admin/portfolio/ingest';
 await assert.rejects(portfolioRoute(new Request(base,{method:'POST',body:'{}'}),x.env),e=>e.status===401);
 await assert.rejects(portfolioRoute(new Request(base,{headers:{'X-ContractIntel-Ingest-Secret':'test-secret'}}),x.env),e=>e.status===405);
 await assert.rejects(portfolioRoute(new Request(base,{method:'POST',headers:{'X-ContractIntel-Ingest-Secret':'test-secret'},body:JSON.stringify({office:'FA4800',mode:'backfill'})}),x.env),e=>e.status===400);
 await assert.rejects(portfolioRoute(new Request('https://local/api/office/FA4528?invalid=1'),x.env),e=>e.status===400);
});
test('D1 failures, malformed payloads, and missing older evidence cleanly select live fallback',async()=>{
 for(const fetcher of [async()=>new Response('',{status:404}),async()=>{throw new Error('timeout');},async()=>Response.json({complete:true,source:'d1',office:'FA4528',start:CONFIG.windows[1]})])assert.equal(await tryOfficeSnapshot({office:'FA4528',start:CONFIG.windows[1],fetcher,origin:'https://local'}),null);
 assert.equal(await tryStoredEvidence({office:'FA4528',path:'history',params:{id:'id',page:2},origin:'https://local',fetcher:async()=>new Response('',{status:404})}),null);
 assert.equal(storedFiscal([{year:2027,cents:'-5',award_ids:['a'],missing:0}])[0].cents,-5n);
});
test('Storage report measures each table and separately reports raw vs normalized history bytes',async()=>{
 const x=await setup();await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});const report=await storageReport(x.db);assert.ok(report.physical_bytes>0);assert.ok(report.table_sizes.find(t=>t.table==='awards').logical_bytes>0);assert.ok(report.history.raw_page_bytes>0);assert.equal(report.projection.offices,1432);assert.equal(report.projection.fixed_directory_bytes+report.projection.one_office_payload_bytes*1432,report.projection.total_logical_bytes);
});
test('Approved live fetch/retry, parsing, scan and cache helpers are unchanged',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./fixtures/portfolio-presentation-baseline.json',import.meta.url),'utf8'));
 for(const f of ['web/source.mjs','web/source-requests.mjs','web/portfolio-loader.mjs','web/portfolio-memory.mjs','web/portfolio-progress.mjs'])assert.ok(baseline.files[f]);
});

test('A source failure retains the last complete publication, records the error, and can resume',async()=>{
 const x=await setup();await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher});const before=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed});
 await assert.rejects(runIngest(x.env,{...opts(),fetcher:async()=>new Response('',{status:400})}));
 const during=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed});assert.equal(during.publication_id,before.publication_id);assert.equal(x.sql.prepare("SELECT count(*) n FROM ingest_runs WHERE status='failed' AND error_count=1").get().n,1);
 assert.equal((await runIngest(x.env,{...opts(),fetcher:x.upstream.fetcher})).status,'completed');
});
test('A genuinely empty office publishes a valid zero-award D1 result',async()=>{
 const x=await setup();const fetcher=async url=>new URL(url).pathname.includes('/awards/')?x.upstream.fetcher(url):Response.json({results:[],page_metadata:{hasNext:false}});
 assert.equal((await runIngest(x.env,{...opts(),fetcher})).status,'completed');const data=await officeSnapshot(x.db,'FA4528',CONFIG.windows[1],{now:fixed});assert.equal(data.records.length,0);assert.equal(data.fiscal_totals[0].count,0);
});

test('A portfolio larger than D1 single-value limit serves complete individual records and consistent totals',async()=>{
 const {db,sql}=sqlite({maxValueBytes:2000000});await seedOffices(db,[office]);await runIngest({PORTFOLIO_DB:db,OFFICES:[office]},{...opts(),fetcher:source().fetcher});
 const rows=sql.prepare('SELECT generated_unique_award_id,record_json FROM awards').all();
 for(const row of rows){const record=JSON.parse(row.record_json);record.description='Long source description '.padEnd(450000,'x');sql.prepare('UPDATE awards SET record_json=? WHERE generated_unique_award_id=?').run(JSON.stringify(record),row.generated_unique_award_id);}
 await assert.rejects(db.prepare('SELECT json_group_array(json(record_json)) records FROM awards').first(),/maximum length/);
 const snapshot=await officeSnapshot(db,'FA4528',CONFIG.windows[0],{now:fixed});
 assert.equal(snapshot.records.length,5);assert.ok(snapshot.records.every(r=>r.description.length===450000));assert.equal(snapshot.fiscal_totals.length,2);assert.ok(snapshot.fiscal_totals.every(t=>Array.isArray(t.award_ids)));assert.equal(snapshot.publication_id,sql.prepare('SELECT published_run_id FROM office_publications').get().published_run_id);
});
