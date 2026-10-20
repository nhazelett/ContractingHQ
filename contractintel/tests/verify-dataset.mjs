// Offline verification of the actual built dataset through the production API handler.
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {handle} from '../worker/api.mjs';
const path=process.argv[2];if(!path)throw new Error('Pass a built dataset.sqlite path');
const db=new DatabaseSync(path,{readOnly:true});
const env={DB:{prepare:sql=>({bind:(...args)=>({all:async()=>({results:db.prepare(sql).all(...args)})})})}};
async function get(path){const response=await handle(new Request('https://local/api/'+path),env);assert.equal(response.status,200);return response.json();}
const status=await get('status');assert.ok(status.dataset);
let total=0;
for(const office of ['FA4800','FA4855','FA8101']){
  const summary=await get('summary?office='+office);
  for(const row of summary.rollups.filter(r=>r.dimension==='all')){
    const data=await get(`transactions?office=${office}&fy=${row.fiscal_year}&limit=1000`);
    assert.equal(data.obligation_cents,row.obligation_cents);
    if(data.total<=1000)assert.equal(data.rows.reduce((n,r)=>n+BigInt(r.obligation_cents),0n).toString(),row.obligation_cents);
  }
  const awards=await get('awards?office='+office+'&limit=1000');total+=awards.total;
  if(awards.rows.length){const award=await get('award?id='+encodeURIComponent(awards.rows[0].award_id));const tx=await get('transactions?award='+encodeURIComponent(award.award.award_id));assert.equal(tx.obligation_cents,award.award.obligation_cents);}
  const noMatches=await get('awards?office='+office+'&q='+encodeURIComponent("' OR 1=1;--"));assert.equal(noMatches.total,0);
}
console.log(JSON.stringify({dataset:status.dataset.id,awards_in_pilot_offices:total,transaction_reconciliation:'passed',detail_api:'passed',search_input:'passed'}));db.close();
