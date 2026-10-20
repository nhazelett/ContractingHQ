import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, csv, fiscalYear } from '../worker/api.mjs';
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
