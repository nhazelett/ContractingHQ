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
