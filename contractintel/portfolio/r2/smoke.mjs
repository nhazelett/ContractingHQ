import assert from 'node:assert/strict';
import {CONFIG} from '../ingest.mjs';
import {tryOfficeSnapshot,tryStoredEvidence,storedFiscal} from '../../web/portfolio-store.mjs';
import {counts} from '../compare.mjs';
import fs from 'node:fs/promises';
const origin=CONFIG.r2Pilot.productionBase,baseline=JSON.parse(await fs.readFile(new URL('../../docs/fa4528-r2-update.json',import.meta.url),'utf8')).cold_replay;
const samples=[];
for(const start of CONFIG.windows){
 const snapshot=await tryOfficeSnapshot({office:'FA4528',start,origin});
 assert.ok(snapshot);assert.ok(['r2','d1'].includes(snapshot.source));assert.equal(snapshot.fiscal_totals.length,2);assert.equal(storedFiscal(snapshot.fiscal_totals).length,2);
 const expected=baseline.views.find(view=>view.start===start);
 if(snapshot.publication_id===baseline.publication_id&&snapshot.today===expected.today)assert.deepEqual(counts(snapshot.records,snapshot.today),expected.after);
 samples.push({start,source:snapshot.source,awards:snapshot.records.length,publication:snapshot.publication_id});
 for(const index of [0,Math.floor(snapshot.records.length/2),snapshot.records.length-1]){
  if(!snapshot.records.length)continue;
  const id=snapshot.records[index].award_id,evidence=await tryStoredEvidence({path:'award',params:{id},office:'FA4528',origin});
  assert.ok(evidence);assert.equal(evidence.award.award_id,id);assert.ok(['r2','d1'].includes(evidence.source));
 }
}
console.log(JSON.stringify({fa4528_r2_live_smoke:{passed:true,windows:samples}}));


for(const path of ['/coverage','/coverage.html','/api/office/coverage/details']){
 const response=await fetch(origin+path,{redirect:'manual'});assert.ok([302,303,401,403].includes(response.status),'Unauthenticated coverage must be blocked: '+path);
 if(response.status===302||response.status===303)assert.ok(new URL(response.headers.get('Location'),origin).hostname.endsWith('.cloudflareaccess.com'),'Redirect must be an Access login');
}
const home=await(await fetch(origin+'/')).text();assert.ok(!home.includes('href="./coverage.html"'));
const publicCoverage=await(await fetch(origin+'/api/office/coverage')).json();assert.ok(Array.isArray(publicCoverage.offices));
console.log(JSON.stringify({coverage_access_smoke:{passed:true,unauthenticated_page_and_data_blocked:true,nav_link_removed:true}}));
