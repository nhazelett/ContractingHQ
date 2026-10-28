import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {seedAutomaticQueue,validateRanking,enqueueDemand,nextAutomaticJob} from '../portfolio/queue/automatic.mjs';
const directory=Array.from({length:151},(_,i)=>({code:'A'+String(i).padStart(5,'0'),name:'Office '+i}));
function ranking(){const rows=directory.map((o,i)=>({rank:i+1,office:o.code,name:o.name,fy_obligations_cents:String(100000-i),transaction_count:1}));return {fiscal_year:2025,start_date:'2024-10-01',end_date:'2025-09-30',basis:'PIID first six characters; net FY transaction obligations',source:{sha256:'a'.repeat(64)},ranking:rows,seed:rows.slice(0,150)};}
async function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE offices(dodaac TEXT PRIMARY KEY); CREATE TABLE office_publications(office_dodaac TEXT PRIMARY KEY);');
 for(const o of directory)sqlite.prepare('INSERT INTO offices VALUES(?)').run(o.code);
 sqlite.exec(await fs.readFile(new URL('../portfolio/migrations/0005.sql',import.meta.url),'utf8'));
 const prepare=sql=>{const wrap=params=>({sql,params,bind:(...args)=>wrap(args),run:async()=>({meta:{changes:sqlite.prepare(sql).run(...params).changes}})});return wrap([]);};
 return {sqlite,prepare,batch:async stmts=>{sqlite.exec('BEGIN');try{for(const s of stmts)sqlite.prepare(s.sql).run(...s.params);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
test('Seed exactly 150 in ranking order; reruns preserve completed and in-flight work',async()=>{
 const db=await database(),doc=ranking();
 await seedAutomaticQueue(db,doc,directory);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM portfolio_rollout_jobs').get().n,150);
 db.sqlite.exec("UPDATE portfolio_rollout_jobs SET status='ready',publication_version='v1',attempts=4 WHERE office_dodaac='A00000'");
 db.sqlite.exec("UPDATE portfolio_rollout_jobs SET status='verifying',checkpoint_ref='checkpoint',attempts=5 WHERE office_dodaac='A00001'");
 await seedAutomaticQueue(db,doc,directory);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM portfolio_seed_rankings').get().n,1);
 assert.equal(db.sqlite.prepare("SELECT publication_version FROM portfolio_rollout_jobs WHERE office_dodaac='A00000'").get().publication_version,'v1');
 assert.equal(db.sqlite.prepare("SELECT attempts FROM portfolio_rollout_jobs WHERE office_dodaac='A00001'").get().attempts,5);
 db.sqlite.close();
});
test('Reject approximate, incomplete, duplicate, or incorrectly ordered rankings',async()=>{
 for(const alter of [d=>d.basis='reported awarding office',d=>d.ranking.pop(),d=>d.seed.reverse(),d=>d.ranking[1].office=d.ranking[0].office,d=>d.ranking[0].fy_obligations_cents='0']){
  const doc=ranking();alter(doc);await assert.rejects(validateRanking(doc,directory));
 }
});
test('Demand enqueues once, validates directory, skips published, and never displaces ranked seeds',async()=>{
 const db=await database();await seedAutomaticQueue(db,ranking(),directory);
 await enqueueDemand(db,'A00150');await enqueueDemand(db,'A00150');await enqueueDemand(db,'NOPE00');
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM portfolio_rollout_jobs').get().n,151);
 assert.equal(db.sqlite.prepare("SELECT priority FROM portfolio_rollout_jobs WHERE office_dodaac='A00150'").get().priority,151);
 db.sqlite.close();
});
test('Selection is gated, resumes before new offices, and refuses uncertain leases',()=>{
 const rows=[{office_dodaac:'A00000',priority:1,status:'queued',attempts:0},{office_dodaac:'A00001',priority:2,status:'verifying',attempts:1,checkpoint_ref:'saved'}];
 assert.equal(nextAutomaticJob(rows).decision,'awaiting_fa4800_validation');
 assert.equal(nextAutomaticJob(rows,{fa4800Verified:true}).decision,'awaiting_cost_review');
 const gates={fa4800Verified:true,costsReviewed:true,storageReady:true};
 assert.equal(nextAutomaticJob(rows,gates).office,'A00001');
 assert.equal(nextAutomaticJob([{...rows[0],lease_id:'uncertain'}],gates).decision,'busy_or_reconciliation_required');
});
