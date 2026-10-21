import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newestFirst} from './notice.mjs';
const base='https://kthq-contractintel.nickhazelett.workers.dev';
async function json(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'Live API must succeed');return r.json();}
const first=await json('/api/opportunities?type=opportunities&status=active');assert.ok(first.run);assert.ok(Array.isArray(first.rows));assert.equal(first.sort,'newest_posted_first');assert.ok(first.coverage.windows.length>0);
let combined=first.rows;if(first.total>50){const page=await json('/api/opportunities?type=opportunities&status=active&page=2&run='+first.run);combined=combined.concat(page.rows);}assert.deepEqual(combined.map(r=>r.notice_id),newestFirst(combined).map(r=>r.notice_id));
if(first.rows.length){const n=first.rows[0],detail=await json('/api/opportunity?id='+n.notice_id+'&run='+first.run);assert.equal(detail.notice.notice_id,n.notice_id);assert.ok(Array.isArray(detail.notice.documents));assert.ok(Array.isArray(detail.notice.contacts));assert.ok(!JSON.stringify(detail).includes('api_key='));
 if(n.office_code&&/^[A-Z0-9]{6}$/.test(n.office_code)){const scoped=await json('/api/opportunities?office='+n.office_code+'&run='+first.run);assert.ok(scoped.rows.every(r=>r.office_code===n.office_code));}
}
const noMatch=await json('/api/opportunities?q=NO_MATCH_6F182A93&run='+first.run);assert.equal(noMatch.total,0);
const csv=await fetch(base+'/api/opportunities?type=opportunities&status=active&export=csv&run='+first.run,{signal:AbortSignal.timeout(25000)});assert.equal(csv.status,200);assert.ok(csv.headers.get('Content-Type').includes('text/csv'));const csvText=await csv.text();assert.ok(csvText.includes('Requirement'));assert.ok(csvText.includes('Public source'));
const digest=text=>createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
for(const file of ['opportunities.html','opportunities.mjs','opportunities.css','index.html','app.mjs']){const r=await fetch(base+'/'+file,{signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);assert.equal(digest(await r.text()),digest(await fs.readFile(new URL('../web/'+file,import.meta.url),'utf8')),'Deployed asset must match working source: '+file);}
console.log(JSON.stringify({live_api:'passed',newest_pagination:'passed',office_filter:'passed',detail:'passed',empty_filter:'passed',csv:'passed',assets:'matched',indexed:first.indexed_count,default_matches:first.total,checked_at:first.checked_at,coverage:first.coverage.windows}));
