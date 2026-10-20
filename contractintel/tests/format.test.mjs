import test from 'node:test';
import assert from 'node:assert/strict';
import {money,dollars,csvCell} from '../web/format.mjs';
test('Financial formatting preserves cents, sign, missing and large values',()=>{
  assert.equal(money('9007199254740991'),'$90,071,992,547,409.91');
  assert.equal(money('-1'),'−$0.01');assert.equal(money(null),'Not reported');
  assert.equal(dollars('-10001'),'-100.01');assert.equal(dollars('0'),'0.00');
  assert.equal(csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);
  assert.equal(csvCell('ACME "Research", Inc.'),'"ACME ""Research"", Inc."');
});
