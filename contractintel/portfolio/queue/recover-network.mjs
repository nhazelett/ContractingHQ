import {CONFIG} from '../ingest.mjs';
// Operator recovery for the observed legacy failure only. Do not clear other
// stops, leases, validation failures, reservations, budgets or attempt counters.
export async function recoverStoppedNetworkOffice(db,{office,expectedError='fetch failed',now=Date.now(),id=crypto.randomUUID()}={}){
 const must=(ok,message)=>{if(!ok)throw Error(message);};
 must(/^[A-Z0-9]{6}$/.test(office||''),'Invalid recovery office.');
 must(expectedError==='fetch failed','Recovery is limited to the observed legacy transport error.');
 const control=await db.prepare('SELECT * FROM portfolio_rollout_control WHERE singleton=1').first();
 const job=await db.prepare('SELECT * FROM portfolio_rollout_jobs WHERE office_dodaac=?').bind(office).first();
 must(control&&job,'Recovery queue state missing.');
 must(!control.lease_id&&!job.lease_id,'Active or uncertain lease requires reconciliation.');
 if(control.paused===0&&['importing','verifying','ready'].includes(job.status))return {recovered:false,status:job.status,office};
 must(control.paused===1&&job.status==='stopped'&&job.last_error===expectedError,'Recovery does not match the reviewed network failure.');
 must(job.checkpoint_ref==='pilot/'+office+'/checkpoint.json.gz'&&job.attempts<CONFIG.rollout.queueMaxAttempts,'Saved checkpoint or retry budget is unavailable.');
 const stopped=await db.prepare("SELECT count(*) n FROM portfolio_rollout_jobs WHERE status='stopped'").first();
 must(stopped.n===1,'Other stopped work requires separate review.');
 await db.prepare('CREATE TABLE IF NOT EXISTS portfolio_rollout_recoveries(recovery_id TEXT PRIMARY KEY,office_dodaac TEXT NOT NULL,checkpoint_ref TEXT NOT NULL,prior_error TEXT NOT NULL,created_at TEXT NOT NULL)').run();
 const stamp=new Date(now).toISOString();
 const statements=[
  db.prepare("INSERT INTO portfolio_rollout_assertions(id,valid) SELECT ?,coalesce((SELECT CASE WHEN c.paused=1 AND c.lease_id IS NULL AND j.lease_id IS NULL AND j.status='stopped' AND j.last_error=? AND j.checkpoint_ref=? AND j.attempts=? AND (SELECT count(*) FROM portfolio_rollout_jobs WHERE status='stopped')=1 THEN 1 ELSE 0 END FROM portfolio_rollout_control c JOIN portfolio_rollout_jobs j ON j.office_dodaac=? WHERE c.singleton=1),0)").bind(id,expectedError,job.checkpoint_ref,job.attempts,office),
  db.prepare('INSERT INTO portfolio_rollout_recoveries VALUES(?,?,?,?,?)').bind(id,office,job.checkpoint_ref,expectedError,stamp),
  db.prepare("UPDATE portfolio_rollout_jobs SET status='importing',last_error=NULL,not_before=NULL,updated_at=? WHERE office_dodaac=?").bind(stamp,office),
  db.prepare('UPDATE portfolio_rollout_control SET paused=0 WHERE singleton=1'),
  db.prepare('DELETE FROM portfolio_rollout_assertions WHERE id=?').bind(id)
 ];
 try{await db.batch(statements);}catch(error){
  const observed=await db.prepare('SELECT recovery_id FROM portfolio_rollout_recoveries WHERE recovery_id=?').bind(id).first().catch(()=>null);
  if(!observed)throw error;
 }
 return {recovered:true,office,checkpoint_ref:job.checkpoint_ref,prior_attempts:job.attempts,recovery_id:id};
}
