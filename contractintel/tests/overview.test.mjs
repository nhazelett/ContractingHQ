import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalYear,fiscalMonths,fiscalTotals,endingCounts,setAsideGroups} from '../web/overview.mjs';
import {resolve} from '../web/source.mjs';
test('fiscal rollover, full prior FY and current partial month',()=>{
 assert.equal(fiscalYear('2026-09-30'),2026);assert.equal(fiscalYear('2026-10-01'),2027);
 const months=fiscalMonths('2026-10-20');
 assert.equal(months.length,13);assert.deepEqual(months[0],{start:'2025-10-01',end:'2025-10-31'});
 assert.deepEqual(months.at(-1),{start:'2026-10-01',end:'2026-10-20'});
});
test('FY obligations include deobligations and count contracts once per year',()=>{
 const totals=fiscalTotals([{award_id:'a',date:'2026-09-30',cents:'120001'},{award_id:'a',date:'2026-09-30',cents:'-20000'},{award_id:'a',date:'2026-10-01',cents:'500'},{award_id:'b',date:'2026-10-01',cents:null}],'2026-10-20');
 assert.equal(totals[0].cents,100001n);assert.equal(totals[0].awards.size,1);assert.equal(totals[1].awards.size,2);assert.equal(totals[1].missing,1);
});
test('current end windows differ from final-end recompete candidates',()=>{
 const counts=endingCounts([{current_end_date:'2026-11-01',potential_end_date:'2028-10-20'},{current_end_date:'2026-10-19',potential_end_date:'2027-01-01'},{current_end_date:'2026-10-20'},{current_end_date:'2026-10-21',potential_end_date:'2026-10-21',details_pending:true}],'2026-10-20');
 assert.deepEqual(counts,{90:2,180:2,365:2,recompetes:1});
});
test('unknown set-asides stay separate and missing values are not invented',()=>{
 const groups=setAsideGroups([{set_aside:'8(a)',award_amount_cents:'100'},{set_aside:'8(a)',award_amount_cents:null},{set_aside:null,award_amount_cents:'0'},{set_aside:'8(a)',details_pending:true}]);
 assert.equal(groups[0].count,2);assert.equal(groups[0].missing,1);assert.equal(groups[1].label,'Not reported');
});
test('fiscal source requests transaction amounts, excludes other PIID prefixes',async()=>{
 let request;
 const result=await resolve(new URL('https://test/api/fiscal?office=FA4800&start=2026-10-01&end=2026-10-20&page=1'),{OFFICES:[{code:'FA4800'}],UPSTREAM_FETCH:async(url,options)=>{
  request=JSON.parse(options.body);assert.ok(url.endsWith('/spending_by_transaction/'));
  return Response.json({results:[{'Award ID':'FA480024C0006','Action Date':'2026-10-12','Transaction Amount':'-12.34',generated_internal_id:'CONT_AWD_FA480024C0006_9700_NONE_NONE'},{'Award ID':'FA485524C0006'}],page_metadata:{hasNext:false}});
 }});
 assert.deepEqual(request.filters.keywords,['FA4800*']);assert.equal(request.limit,100);assert.ok(request.fields.includes('Transaction Amount'));assert.equal(result.rows.length,1);assert.equal(result.rows[0].cents,'-1234');
});
