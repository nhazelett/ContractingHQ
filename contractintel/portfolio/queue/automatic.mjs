import {CONFIG} from '../ingest.mjs';
const cfg=CONFIG.rollout;
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function validateRanking(document,directory){
 check(document?.fiscal_year===cfg.fiscalYear&&document.start_date===cfg.startDate&&document.end_date===cfg.endDate,'Ranking fiscal window differs.');
 check(document.basis==='PIID first six characters; net FY transaction obligations','Ranking must use PIID-prefix net obligations.');
 check(/^[a-f0-9]{64}$/.test(document.source?.sha256||''),'Ranking source checksum missing.');
 const codes=new Set(directory.map(o=>o.code)),rows=document.ranking;
 check(Array.isArray(rows)&&rows.length===codes.size&&document.seed?.length===cfg.seedCount,'Incomplete office ranking.');
 const seen=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  check(codes.has(row.office)&&!seen.has(row.office)&&row.rank===i+1,'Invalid ranking office or rank.');
  check(/^-?\d+$/.test(row.fy_obligations_cents)&&Number.isSafeInteger(row.transaction_count)&&row.transaction_count>=0,'Invalid ranking amounts.');
  if(i){const before=rows[i-1],a=BigInt(before.fy_obligations_cents),b=BigInt(row.fy_obligations_cents);check(a>b||a===b&&before.office<row.office,'Ranking order must be descending net obligations, then office code.');}
  seen.add(row.office);
 }
 check(JSON.stringify(document.seed)===JSON.stringify(rows.slice(0,cfg.seedCount)),'Seed must be the exact leading ranking cohort.');
 return {ranking_id:await digest({source:document.source.sha256,ranking:rows}),directory_sha256:await digest(directory)};
}
export async function seedAutomaticQueue(db,document,directory,{now=Date.now()}={}){
 const identity=await validateRanking(document,directory),stamp=new Date(now).toISOString();
 // Existing ranking is immutable. All offices are enqueued atomically, in ranked order.
 const statements=[db.prepare('INSERT INTO portfolio_seed_rankings(ranking_id,fiscal_year,source_sha256,source_json,directory_sha256,ranking_json,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(ranking_id) DO NOTHING').bind(identity.ranking_id,cfg.fiscalYear,document.source.sha256,JSON.stringify(document.source),identity.directory_sha256,JSON.stringify(document.ranking),stamp)];
 for(const row of document.seed)statements.push(db.prepare("INSERT INTO portfolio_rollout_jobs(office_dodaac,origin,seed_rank,ranking_id,priority,status,requested_at,updated_at) VALUES(?,'seed',?,?,?,'queued',?,?) ON CONFLICT(office_dodaac) DO UPDATE SET origin='seed',seed_rank=excluded.seed_rank,ranking_id=excluded.ranking_id,priority=excluded.priority WHERE portfolio_rollout_jobs.status='queued'").bind(row.office,row.rank,identity.ranking_id,row.rank,stamp,stamp));
 await db.batch(statements);
 return {...identity,seed_offices:document.seed.length,execution_enabled:false};
}
export async function enqueueDemand(db,office,{now=Date.now()}={}){
 const stamp=new Date(now).toISOString();
 // The SELECT both validates the directory and avoids requeueing published offices.
 return db.prepare("INSERT INTO portfolio_rollout_jobs(office_dodaac,origin,priority,status,requested_at,updated_at) SELECT dodaac,'demand',?,'queued',?,? FROM offices WHERE dodaac=? AND NOT EXISTS(SELECT 1 FROM office_publications WHERE office_dodaac=?) ON CONFLICT(office_dodaac) DO NOTHING").bind(cfg.seedCount+1,stamp,stamp,office,office).run();
}
export function nextAutomaticJob(rows,{fa4800Verified=false,costsReviewed=false,storageReady=false,now=Date.now()}={}){
 if(!fa4800Verified)return {decision:'awaiting_fa4800_validation'};
 if(!costsReviewed)return {decision:'awaiting_cost_review'};
 if(!storageReady)return {decision:'awaiting_storage_capacity'};
 if(rows.some(r=>r.lease_id))return {decision:'busy_or_reconciliation_required'};
 const pending=rows.filter(r=>['queued','importing','verifying'].includes(r.status)&&r.attempts<cfg.queueMaxAttempts);
 const continuations=pending.filter(r=>r.checkpoint_ref);
 const list=continuations.length?continuations:pending;
 list.sort((a,b)=>a.priority-b.priority||a.office_dodaac.localeCompare(b.office_dodaac));
 const job=list[0];
 if(!job)return {decision:'idle'};
 if(job.not_before&&Date.parse(job.not_before)>now)return {decision:'retry_wait'};
 return {decision:'ready_to_reserve',office:job.office_dodaac,job};
}
