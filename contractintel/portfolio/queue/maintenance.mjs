import {CONFIG} from '../ingest.mjs';
export async function ensureMaintenanceSchema(db){
 const definitions={next_refresh_at:'TEXT',maintenance:'INTEGER NOT NULL DEFAULT 0 CHECK(maintenance IN (0,1))',storage_reserved_bytes:'INTEGER NOT NULL DEFAULT 0'};
 for(const [name,type] of Object.entries(definitions)){
  const columns=(await db.prepare('PRAGMA table_info(portfolio_rollout_jobs)').all()).results;
  if(columns.some(c=>c.name===name))continue;
  try{await db.prepare('ALTER TABLE portfolio_rollout_jobs ADD COLUMN '+name+' '+type).run();}
  catch(error){if(!(await db.prepare('PRAGMA table_info(portfolio_rollout_jobs)').all()).results.some(c=>c.name===name))throw error;}
 }
}
// Requeue at most one due office per controller turn. Publication stays readable
// throughout refresh, and maintenance competes under the same daily budget.
export async function enqueueDueMaintenance(db,{now=Date.now()}={}){
 const rows=(await db.prepare("SELECT * FROM portfolio_rollout_jobs WHERE status='ready' AND lease_id IS NULL ORDER BY updated_at,office_dodaac").all()).results;
 const row=rows.filter(r=>!CONFIG.r2Offices[r.office_dodaac]).find(r=>{
  const due=r.next_refresh_at?Date.parse(r.next_refresh_at):Date.parse(r.updated_at)+CONFIG.capacity.maintenanceEveryMs;
  return Number.isFinite(due)&&due<=now;
 });
 if(!row)return null;
 const result=await db.prepare("UPDATE portfolio_rollout_jobs SET status='queued',maintenance=1,attempts=0,not_before=NULL,last_error=NULL WHERE office_dodaac=? AND status='ready' AND lease_id IS NULL AND updated_at=?").bind(row.office_dodaac,row.updated_at).run();
 return result.meta?.changes?row.office_dodaac:null;
}
