import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeModifications} from '../worker/modifications.mjs';
const row=(mod,day,reason,end,extra={})=>({modification_number:mod,action_date:day,action_type_code:reason,reported_current_end:end,transaction_id:mod+'-'+day,...extra});
test('Counts distinct mods, ignores base, and finds an option PoP change behind later funding mods',()=>{
 const data=summarizeModifications([
 row('0','2023-01-01','','2023-12-31'),
 row('P00001','2023-02-01','C','2023-12-31'),
 row('P00002','2023-12-01','G','2024-12-31'),
 row('P00003','2024-02-01','C','2024-12-31'),
 row('P00004','2024-03-01','G','2024-12-31'),
 row('P00005','2024-04-01','B','2025-03-31')]);
 assert.equal(data.mods_loaded,5);assert.equal(data.latest_mod.modification_number,'P00005');
 assert.equal(data.latest_option_mod.modification_number,'P00004');
 assert.equal(data.latest_option_mod.end_change,'unchanged');
 assert.equal(data.latest_option_pop_change.modification_number,'P00002');
 assert.equal(data.latest_option_pop_change.previous_current_end,'2023-12-31');
 assert.equal(data.latest_option_pop_change.reported_current_end,'2024-12-31');
});
test('A lone P00014 is one loaded mod and its prior end is unknown',()=>{
 const data=summarizeModifications([row('P00014','2025-01-01','G','2026-01-01')]);
 assert.equal(data.mods_loaded,1);assert.equal(data.base_award_loaded,false);assert.equal(data.latest_option_pop_change,null);
 assert.equal(data.latest_option_mod.end_change,'unknown');
});
test('Duplicate reports are one mod, with conflicts blocking PoP attribution',()=>{
 const data=summarizeModifications([row('0','2023-01-01','','2023-12-31'),row('P00001','2023-12-01','G','2024-12-31'),row('P00001','2023-12-01','G','2025-12-31',{transaction_id:'z'})]);
 assert.equal(data.mods_loaded,1);assert.equal(data.latest_mod.source_records,2);assert.equal(data.latest_mod.conflicting_records,true);assert.equal(data.latest_option_pop_change,null);
});
test('Numeric aliases normalize and original award zero variants are excluded',()=>{
 const data=summarizeModifications([row('000','2023-01-01','','2023-12-31'),row('02','2023-12-01','C','2023-12-31'),row('2','2023-12-01','C','2023-12-31')]);
 assert.equal(data.mods_loaded,1);assert.equal(data.base_award_loaded,true);
});
test('Same-day, missing-end and sequence gaps do not establish an option PoP change',()=>{
 for(const rows of [
 [row('0','2023-01-01','','2023-12-31'),row('P00001','2023-01-01','G','2024-12-31')],
 [row('0','2023-01-01','',null),row('P00001','2023-12-01','G','2024-12-31')],
 [row('P00001','2023-01-01','C','2023-12-31'),row('P00003','2023-12-01','G','2024-12-31')]
 ])assert.equal(summarizeModifications(rows).latest_option_pop_change,null);
 const gap=summarizeModifications([row('P00001','2023-01-01','C','2023-12-31'),row('P00003','2023-12-01','G','2024-12-31')]);assert.equal(gap.latest_option_change_candidate.modification_number,'P00003');
});
test('A non-option PoP change is retained but never classified as an option exercise',()=>{
 const data=summarizeModifications([row('0','2023-01-01','','2023-12-31'),row('P00001','2023-12-01','B','2024-12-31')]);
 assert.equal(data.latest_mod.end_change,'extended');assert.equal(data.latest_option_mod,null);assert.equal(data.latest_option_pop_change,null);
});
test('Missing identifiers and truncation remain explicit',()=>{
 const data=summarizeModifications([row('','2025-01-01','G','2025-12-31')],{truncated:true});
 assert.equal(data.mods_loaded,0);assert.equal(data.missing_mod_numbers,1);assert.equal(data.truncated,true);assert.equal(data.latest_option_mod,null);
});
