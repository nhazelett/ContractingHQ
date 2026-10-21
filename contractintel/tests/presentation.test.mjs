import test from 'node:test';
import assert from 'node:assert/strict';
import {category,scopeRows,expiryRows,runwaySegments} from '../web/presentation.mjs';
const today='2026-10-20';
const row=(piid,current,potential)=>({piid,award_id:piid,start_date:'2025-01-01',current_end_date:current,potential_end_date:potential});
test('Presentation datasets retain completed and uncertain records without changing lifecycle definitions',()=>{
 const rows=[row('a','2026-12-01','2027-12-01'),row('b','2026-09-01','2026-09-01'),row('c','2026-09-01',null)];
 assert.equal(scopeRows(rows,'all',today).length,3);assert.deepEqual(scopeRows(rows,'active',today).map(r=>r.piid),['a','c']);assert.equal(scopeRows(rows,'completed',today)[0].piid,'b');assert.equal(scopeRows(rows,'review',today)[0].piid,'c');
});
test('Expiration groups are disjoint and respect current versus potential dates and date conflicts',()=>{
 const date=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
 const rows=[0,90,91,180,181,365,366].map(n=>row(String(n),date(n),date(n+10)));
 rows.push(row('conflict',date(10),date(5)));
 assert.deepEqual([expiryRows(rows,'current',0,90,today).length,expiryRows(rows,'current',91,180,today).length,expiryRows(rows,'current',181,365,today).length],[2,2,2]);
 assert.equal(expiryRows(rows,'potential',0,365,today).length,5);
});
test('Runway clips to a year and never paints unsupported current performance',()=>{
 const ongoing=runwaySegments(row('a','2026-11-19','2028-01-01'),today);assert.ok(ongoing.solid>0);assert.equal(ongoing.beyond,true);assert.equal(Math.round(ongoing.solid+ongoing.extension),100);
 const possible=runwaySegments(row('b','2026-09-01','2026-12-01'),today);assert.equal(possible.solid,0);assert.ok(possible.extension>0);
 const review=runwaySegments(row('c','2026-12-01','2026-11-01'),today);assert.equal(review.solid+review.extension,0);
});
test('Set-aside colors remain stable and never equate no set-aside to full and open',()=>{
 assert.equal(category('SMALL BUSINESS SET ASIDE - TOTAL').color,'#2a78d6');assert.equal(category('8(A) SOLE SOURCE').color,category('8A COMPETED').color);
 assert.equal(category('NO SET ASIDE USED.').label,'No set-aside used');assert.equal(category('Not reported').label,'Not reported');assert.equal(category('HUBZONE SET-ASIDE').label,'HUBZone');
});
