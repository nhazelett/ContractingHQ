import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const require=createRequire(import.meta.url);
const api=require('../training-search.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../training-search-index.js',import.meta.url),'utf8'),context);
const raw=context.window.KTHQ_TRAINING_SEARCH_INDEX.entries;
const entries=api.prepare(raw);
const find=q=>api.search(entries,q);
const first=q=>find(q).matches[0]?.entry.url;
test('exact title wins over incidental mentions',()=>assert.equal(first('Contractor Responsibility'),'contractor-responsibility.html'));
test('acronyms locate their training topics',()=>{
 assert.equal(first('COC'),'contractor-responsibility.html');
 assert.equal(first('GPC'),'government-purchase-cards.html');
 assert.equal(first('UDM'),'unit-deployment-manager.html');
 assert.ok(find('SOW').matches.slice(0,3).some(x=>x.entry.url==='statements-of-work.html'));
});
test('partial multiword queries work',()=>assert.equal(first('past perf'),'past-performance.html'));
test('case and punctuation normalize consistently',()=>assert.equal(first('COC!!!'),first('coc')));
test('set-aside spelling variants agree',()=>assert.equal(first('set-aside'),first('set aside')));
test('minor typos recover useful results',()=>{assert.equal(first('responsibilty'),'contractor-responsibility.html');assert.equal(find('responsibilty').fuzzy,true)});
test('unmatched query and stopwords return no results',()=>{assert.equal(find('zzzzzzzzzzzzz').matches.length,0);assert.equal(find('the and').matches.length,0)});
test('every query token must match',()=>assert.equal(find('past performance zzzzzzzzzzzzz').matches.length,0));
test('unsafe destination URLs are rejected',()=>assert.equal(api.prepare([{...raw[0],url:'javascript:alert(1)'},{...raw[0],url:'https://example.com'}]).length,0));
test('index has unique existing destinations',()=>{assert.equal(new Set(raw.map(e=>e.url)).size,raw.length);for(const e of raw)assert.ok(fs.existsSync(new URL('../'+e.url,import.meta.url)),e.url)});
test('boundary appears once in Intermediate',()=>{const e=raw.filter(e=>e.url==='evaluation-responsibility-boundary.html');assert.equal(e.length,1);assert.equal(e[0].tracks.join(','),'Intermediate')});
test('every result has usable display metadata',()=>{for(const e of raw){assert.ok(e.title.length>2);assert.ok(e.description.length>10);assert.ok(e.tracks.length>0)}});
test('benchmark repeated representative queries',()=>{
 const queries=['COC','past perf','funding','government purchase card','responsibilty','zzzzzzzzzzzzz'];
 const samples=[];for(let i=0;i<300;i++){const start=performance.now();find(queries[i%queries.length]);samples.push(performance.now()-start)}
 samples.sort((a,b)=>a-b);console.log(`Search benchmark: ${entries.length} pages, median ${samples[150].toFixed(2)} ms, p95 ${samples[285].toFixed(2)} ms (local Node runtime).`);
});
test('search initializes during the site music-player navigation',()=>{
 const page=fs.readFileSync(new URL('../training.html',import.meta.url),'utf8');
 const body=page.slice(page.indexOf('<body'));
 assert.match(body,/<script src="training-search\.js\?v=[^"]+"><\/script>/);
 assert.doesNotMatch(page.slice(0,page.indexOf('<body')),/<script[^>]+src="training-search\.js/);
});
