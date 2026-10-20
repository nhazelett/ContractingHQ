import test from 'node:test';
import assert from 'node:assert/strict';
import {money,dollars,csvCell,daysRemaining,endLabel} from '../web/format.mjs';
test('Financial formatting preserves cents, sign, missing and large values',()=>{
  assert.equal(money('9007199254740991'),'$90,071,992,547,409.91');
  assert.equal(money('-1'),'−$0.01');assert.equal(money(null),'Not reported');
  assert.equal(dollars('-10001'),'-100.01');assert.equal(dollars('0'),'0.00');
  assert.equal(csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);
  assert.equal(csvCell('ACME "Research", Inc.'),'"ACME ""Research"", Inc."');
});
test('Reported end dates use calendar days and distinguish missing, past, and today',()=>{
  assert.equal(daysRemaining('2026-10-20','2026-10-20'),0);
  assert.equal(endLabel('2026-10-20','2026-10-20'),'Ends today');
  assert.equal(endLabel('2026-10-19','2026-10-20'),'Ended');
  assert.equal(daysRemaining('2028-03-01','2028-02-28'),2);
  assert.equal(daysRemaining(null,'2026-10-20'),null);
  assert.equal(daysRemaining('2026-02-30','2026-10-20'),null);
});
