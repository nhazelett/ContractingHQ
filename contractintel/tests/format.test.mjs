import test from 'node:test';
import assert from 'node:assert/strict';
import {money,dollars,csvCell,daysRemaining,endLabel,portfolioStatus} from '../web/format.mjs';
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
  assert.equal(endLabel('2026-10-19','2026-10-20'),'Date passed');
  assert.equal(daysRemaining('2028-03-01','2028-02-28'),2);
  assert.equal(daysRemaining(null,'2026-10-20'),null);
  assert.equal(daysRemaining('2026-02-30','2026-10-20'),null);
});

test('Portfolio status distinguishes option uncertainty, missing dates and inconsistent dates',()=>{
 const today='2026-10-19';
 assert.equal(portfolioStatus({current_end_date:'2026-10-19',potential_end_date:'2028-01-01'},today),'Within reported current PoP');
 assert.equal(portfolioStatus({current_end_date:'2025-01-01',potential_end_date:'2028-01-01'},today),'Potentially ongoing — verify');
 assert.equal(portfolioStatus({potential_end_date:'2028-01-01'},today),'Potentially ongoing — verify');
 assert.equal(portfolioStatus({current_end_date:'2025-01-01',potential_end_date:'2026-01-01'},today),'Reported dates passed');
 assert.equal(portfolioStatus({current_end_date:'2028-01-01',potential_end_date:'2027-01-01'},today),'Dates inconsistent');
 assert.equal(portfolioStatus({},today),'Dates need review');
});
