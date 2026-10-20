import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, csv, fiscalYear, sourceAmountCents } from '../worker/stored-api.mjs';
function env() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001.sql', import.meta.url), 'utf8'));
  db.exec(`INSERT INTO dataset_versions(id,created_at,status,coverage_start,coverage_end,scope,completeness) VALUES ('v1','2026-01-01','published','2025-01-01','2026-01-01','test','partial'); INSERT INTO active_dataset VALUES (1,'v1');`);
  return { db, DB: { prepare: sql => ({ bind: (...args) => ({ all: async () => ({ results: db.prepare(sql).all(...args) }) }) }) } };
}
test('API validates office, sort and pinned dataset; exposes no live-data fiction', async () => {
  const e = env();
  for (const query of ['office=UNKNOWN', 'sort=recipient;DROP TABLE awards', 'limit=-1']) {
    const response = await handle(new Request('https://local/api/awards?' + query), e);
    assert.equal(response.status, 400);
  }
  assert.equal((await handle(new Request('https://local/api/awards?version=retired'), e)).status, 409);
  const summary = await (await handle(new Request('https://local/api/summary'), e)).json();
  assert.equal(summary.version, 'v1'); assert.deepEqual(summary.rollups, []);
  assert.equal((await handle(new Request('https://local/api/status', { method: 'POST' }), e)).status, 405);
  e.db.close();
});
test('Exact CSV cells, formula prevention and fiscal-year boundary', () => {
  assert.equal(fiscalYear('2025-09-30'), 2025); assert.equal(fiscalYear('2025-10-01'), 2026);
  const output = csv([{ vendor: '=HYPERLINK("bad")', cents: '-123' }], ['vendor', 'cents']);
  assert.ok(output.includes("\"'=HYPERLINK")); assert.ok(output.includes('"-123"'));
});

test('Option exercise evidence is version scoped and never invents an option count or current year', async () => {
  const e = env();
  e.db.exec(`INSERT INTO dataset_versions(id,created_at,status,coverage_start,coverage_end,scope,completeness) VALUES ('v2','2026-01-02','published','2025-01-01','2026-01-01','test','partial');
    INSERT INTO source_files VALUES ('sha','key','https://example.org/source','{}','2026-01-01',1,0);
    INSERT INTO awards(version_id,award_id,piid,office_code,office_name,first_action_date,latest_action_date,obligation_cents,transaction_count,number_of_actions,latest_transaction_id)
      VALUES ('v1','a1','PIID1','FA4800','Test','2025-01-01','2025-09-30',0,3,3,'t3');`);
  const insert = e.db.prepare(`INSERT INTO transactions(version_id,transaction_id,award_id,piid,action_date,fiscal_year,modification_number,office_code,office_name,obligation_cents,number_of_actions,source_sha256,raw_json) VALUES (?,?,'a1','PIID1','2025-09-30',2025,?,'FA4800','Test',0,1,'sha',?)`);
  insert.run('v1','t1','P00001',JSON.stringify({action_type_code:'G',transaction_description:'Exercise option year 4',period_of_performance_current_end_date:'2026-09-30'}));
  insert.run('v1','t2','P00002',JSON.stringify({action_type_code:'C',transaction_description:'Funds for option year 4'}));
  insert.run('v1','t3','P00003',JSON.stringify({transaction_description:'Option years mentioned without a reported exercise code'}));
  insert.run('v2','t4','P00004',JSON.stringify({action_type_code:'G'}));
  const response=await handle(new Request('https://local/api/award?id=a1&version=v1'),e);
  assert.equal(response.status,200);
  const data=await response.json();
  const listing=await (await handle(new Request('https://local/api/awards?office=FA4800&version=v1'),e)).json();
  assert.equal(listing.rows[0].mods_loaded,3);assert.equal(listing.rows[0].latest_mod_number,'P00003');assert.equal(listing.rows[0].latest_option_mod_number,'P00001');
  assert.equal(data.modifications.mods_loaded,3);assert.equal(data.modifications.latest_mod.modification_number,'P00003');assert.equal(data.modifications.latest_option_pop_change,null);
  assert.equal(data.options.exercise_actions_loaded,1);
  assert.equal(data.options.total_options,null);
  assert.equal(data.options.current_option_year,null);
  assert.equal(data.options.actions[0].description,'Exercise option year 4');
  assert.equal(data.options.actions[0].reported_current_end,'2026-09-30');
  e.db.prepare('DELETE FROM transactions WHERE transaction_id=?').run('t1');
  const empty=await (await handle(new Request('https://local/api/award?id=a1&version=v1'),e)).json();
  assert.equal(empty.options.exercise_actions_loaded,0);
  assert.equal(empty.options.total_options,null);
  assert.deepEqual(empty.options.actions,[]);
  e.db.close();
});

test('Planning portfolio includes potential dates, separates uncertainty and respects expiration basis',async()=>{
 const e=env();const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const insert=e.db.prepare(`INSERT INTO awards(version_id,award_id,piid,office_code,office_name,first_action_date,latest_action_date,obligation_cents,transaction_count,number_of_actions,latest_transaction_id,current_end_date,potential_end_date) VALUES ('v1',?,?,'FA4800','Test','2025-01-01','2025-09-30',0,0,0,'t',?,?)`);
 for(const[id,c,p]of [['current',day(20),day(200)],['potential',day(-20),day(20)],['missing_current',null,day(20)],['past',day(-100),day(-20)],['missing',null,null],['inconsistent',day(200),day(100)]])insert.run(id,id,c,p);
 const get=async path=>{const r=await handle(new Request('https://local/api/'+path),e);assert.equal(r.status,200);return r.json();};
 assert.equal((await get('awards?view=review&sort=review')).total,4);
 assert.equal((await get('awards?view=verify')).total,2);
 assert.equal((await get('awards?view=past')).total,1);
 assert.equal((await get('awards?view=date_review')).total,3);
 assert.equal((await get('awards?view=90&date_basis=current')).total,1);
 assert.equal((await get('awards?view=90&date_basis=potential')).total,2);
 const summary=await get('summary?date_basis=potential');
 assert.equal(summary.counts.portfolio_review,4);assert.equal(summary.counts.needs_verification,2);assert.equal(summary.counts.expires_90,2);
 assert.equal((await handle(new Request('https://local/api/summary?date_basis=invalid'),e)).status,400);
 e.db.close();
});

test('Default all-award order prioritizes upcoming final ends across pages, then past and unknown',async()=>{
 const e=env(),day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const insert=e.db.prepare(`INSERT INTO awards(version_id,award_id,piid,office_code,office_name,first_action_date,latest_action_date,obligation_cents,transaction_count,number_of_actions,latest_transaction_id,current_end_date,potential_end_date) VALUES ('v1',?,?,'FA4800','Test','2025-01-01','2025-09-30',0,0,0,'t',?,?)`);
 for(const[id,c,p]of [['old',day(-200),day(-100)],['near',day(-20),day(2)],['later',day(1),day(30)],['today',day(0),null],['recent',day(-1),day(-1)],['unknown',null,null]])insert.run(id,id,c,p);
 const page=async offset=>(await (await handle(new Request('https://local/api/awards?limit=2&offset='+offset),e)).json());
 const pages=await Promise.all([page(0),page(2),page(4)]);
 assert.deepEqual(pages.flatMap(p=>p.rows.map(r=>r.award_id)),['today','near','later','recent','old','unknown']);
 assert.equal(pages[0].total,6);
 e.db.close();
});
test('Award Amount uses the latest source cumulative value, preserving cents and missing data',async()=>{
 assert.equal(sourceAmountCents('28779919.15'),'2877991915');
 assert.equal(sourceAmountCents('90071992547409.91'),'9007199254740991');
 assert.equal(sourceAmountCents('-0.01'),'-1');assert.equal(sourceAmountCents('0.00'),'0');
 for(const v of [null,'','not available','1.234'])assert.equal(sourceAmountCents(v),null);
 const e=env();
 e.db.exec(`INSERT INTO source_files VALUES ('sha','key','https://example.org/source','{}','2026-01-01',1,0);
 INSERT INTO awards(version_id,award_id,piid,office_code,office_name,first_action_date,latest_action_date,obligation_cents,current_value_cents,transaction_count,number_of_actions,latest_transaction_id) VALUES ('v1','bos','BOS','FA4800','Test','2025-09-05','2025-09-05',-13514404,0,1,1,'t43');`);
 e.db.prepare(`INSERT INTO transactions(version_id,transaction_id,award_id,piid,action_date,fiscal_year,modification_number,office_code,office_name,obligation_cents,number_of_actions,source_sha256,raw_json) VALUES ('v1','t43','bos','BOS','2025-09-05',2025,'P00043','FA4800','Test',-13514404,1,'sha',?)`).run(JSON.stringify({current_total_value_of_award:'28779919.15',base_and_exercised_options_value:'0.00',action_type_code:'C'}));
 const listing=await (await handle(new Request('https://local/api/awards'),e)).json();
 const detail=await (await handle(new Request('https://local/api/award?id=bos'),e)).json();
 assert.equal(listing.rows[0].award_amount_cents,'2877991915');assert.equal(detail.award.award_amount_cents,'2877991915');
 assert.equal(listing.rows[0].latest_mod_number,'P00043');assert.equal(listing.rows[0].latest_option_mod_number,null);
 assert.equal(detail.options.total_options,null);assert.equal(Object.hasOwn(detail.award,'award_amount_source'),false);
 e.db.close();
});
