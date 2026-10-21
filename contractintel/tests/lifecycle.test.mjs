import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycle,lifecycleRows} from '../web/lifecycle.mjs';
import {selectRows} from '../web/register.mjs';
const today='2026-10-20';
const award=(id,current,final,extra={})=>({piid:id,award_id:id,current_end_date:current,potential_end_date:final,...extra});
test('Past final ends are potential completion; today is still upcoming',()=>{
 assert.equal(lifecycle(award('past','2025-09-30','2026-10-19'),today).kind,'completed');
 assert.equal(lifecycle(award('today','2026-10-20','2026-10-20'),today).kind,'upcoming');
 assert.equal(lifecycle(award('final-only',null,'2026-10-19'),today).kind,'completed');
});
test('Unexercised or unreported options never disappear due to current end alone',()=>{
 assert.equal(lifecycle(award('options','2026-09-30','2027-09-30'),today).kind,'uncertain');
 assert.equal(lifecycle(award('missing','2026-09-30',null),today).kind,'review');
 assert.equal(lifecycle(award('none',null,null),today).scope,'active');
});
test('Contradictory, invalid, unavailable and loading dates remain in review',()=>{
 for(const row of [
  award('conflict','2027-09-30','2026-09-30'),
  award('start','2025-09-30','2026-09-30',{start_date:'2027-01-01'}),
  award('invalid',null,'2026-02-30'),
  award('pending','2025-09-30','2025-09-30',{details_pending:true}),
  award('unavailable','2025-09-30','2025-09-30',{details_unavailable:true})
 ])assert.equal(lifecycle(row,today).kind,'review');
});
test('Two disjoint datasets retain every record; active ends remain soonest first',()=>{
 const rows=[award('late','2027-10-01','2027-10-01'),award('done','2025-01-01','2025-01-01'),award('soon','2026-10-21','2026-10-21'),award('unknown',null,null)];
 const active=lifecycleRows(rows,'active',today),done=lifecycleRows(rows,'completed',today);
 assert.deepEqual(done.map(r=>r.piid),['done']);
 assert.equal(active.length+done.length,rows.length);
 assert.deepEqual(selectRows(active,{today}).map(r=>r.piid),['soon','late','unknown']);
 assert.equal(rows.length,4);
});
