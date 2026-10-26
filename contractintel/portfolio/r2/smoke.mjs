import assert from 'node:assert/strict';
import {CONFIG} from '../ingest.mjs';
import {tryOfficeSnapshot,tryStoredEvidence,storedFiscal} from '../../web/portfolio-store.mjs';
import {counts} from '../compare.mjs';
import fs from 'node:fs/promises';
const origin=CONFIG.r2Pilot.productionBase,baseline=JSON.parse(await fs.readFile(new URL('../../docs/fa4528-r2-update.json',import.meta.url),'utf8')).cold_replay;
const samples=[];
for(const start of CONFIG.windows){
 const snapshot=await tryOfficeSnapshot({office:'FA4528',start,origin});
 assert.ok(snapshot);assert.equal(snapshot.source,'r2');assert.equal(snapshot.fiscal_totals.length,2);assert.equal(storedFiscal(snapshot.fiscal_totals).length,2);
 const expected=baseline.views.find(view=>view.start===start);
 if(snapshot.publication_id===baseline.publication_id&&snapshot.today===expected.today)assert.deepEqual(counts(snapshot.records,snapshot.today),expected.after);
 samples.push({start,source:snapshot.source,awards:snapshot.records.length,publication:snapshot.publication_id});
 for(const index of [0,Math.floor(snapshot.records.length/2),snapshot.records.length-1]){
  if(!snapshot.records.length)continue;
  const id=snapshot.records[index].award_id,evidence=await tryStoredEvidence({path:'award',params:{id},office:'FA4528',origin});
  assert.ok(evidence);assert.equal(evidence.award.award_id,id);assert.equal(evidence.source,'r2');
 }
}
console.log(JSON.stringify({fa4528_r2_live_smoke:{passed:true,windows:samples}}));
