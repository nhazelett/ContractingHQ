import {CONFIG,derive} from './ingest.mjs';
import {currentDate} from '../web/calendar.mjs';
export class PortfolioError extends Error {constructor(message,status=503){super(message);this.status=status;}}
export async function publication(db,office){
 return db.prepare("SELECT p.* FROM office_publications p JOIN ingest_runs r ON r.id=p.published_run_id WHERE p.office_dodaac=? AND r.status='completed'").bind(office).first();
}
export async function officeSnapshot(db,office,start,{now=Date.now}={}){
 if(!db)throw new PortfolioError('Office has not been published to D1; use live USAspending.',404);
 if(!CONFIG.windows.includes(start))throw new PortfolioError('Invalid search window.',400);
 const pub=await publication(db,office);if(!pub||!JSON.parse(pub.windows_json).includes(start))throw new PortfolioError('Office has not been published for this window; use live USAspending.',404);
 // One statement pins rows, totals and metadata to the same SQLite read snapshot during publication.
 const data=await db.prepare(`SELECT
 (SELECT json_group_array(json(a.record_json)) FROM awards a JOIN award_windows w ON w.generated_unique_award_id=a.generated_unique_award_id WHERE a.office_dodaac=p.office_dodaac AND w.window_start=?) records,
 (SELECT json_group_array(json_object('year',fiscal_year,'cents',net_obligation_cents,'award_ids',json(award_ids_json),'count',distinct_contract_count,'missing',missing_amount_count,'transaction_count',transaction_count,'coverage_end',coverage_end)) FROM fiscal_totals WHERE office_dodaac=p.office_dodaac AND complete=1) totals,
 p.published_run_id,p.published_at,p.coverage_end FROM office_publications p JOIN ingest_runs r ON r.id=p.published_run_id WHERE office_dodaac=? AND r.status='completed'`).bind(start,office).first();
 if(!data)throw new PortfolioError('Office publication is not ready; use live USAspending.',404);
 const today=currentDate(now()),records=JSON.parse(data.records).map(row=>({...row,...derive(row,today)}));
 return {office,start,source:'d1',complete:true,records,fiscal_totals:JSON.parse(data.totals),published_at:data.published_at,publication_id:data.published_run_id,today,time_zone:CONFIG.timeZone,coverage_end:data.coverage_end};
}
export async function storedAward(db,office,id,page=1){
 if(!db||!await publication(db,office))throw new PortfolioError('Stored evidence is unavailable; use live USAspending.',404);
 const data=await db.prepare('SELECT a.record_json,p.published_at,h.actions_json,h.has_next FROM awards a JOIN office_publications p ON p.office_dodaac=a.office_dodaac LEFT JOIN award_history_pages h ON h.generated_unique_award_id=a.generated_unique_award_id AND h.page=? WHERE a.office_dodaac=? AND a.generated_unique_award_id=?').bind(page,office,id).first();
 if(!data?.actions_json)throw new PortfolioError('This evidence page is not stored; use live USAspending.',404);
 return {award:JSON.parse(data.record_json),history:{actions:JSON.parse(data.actions_json),has_next:!!data.has_next,page},fetched_at:data.published_at,source:'d1'};
}
export async function storageReport(db){
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name").all(),sizes=[];
 for(const {name}of tables.results){
  if(!/^[a-z_]+$/.test(name))continue;
  const columns=await db.prepare('PRAGMA table_info('+name+')').all();
  const expression=columns.results.map(c=>'coalesce(length(CAST("'+c.name+'" AS BLOB)),0)').join('+');
  const row=await db.prepare('SELECT count(*) rows,coalesce(sum('+expression+'),0) logical_bytes FROM '+name).first();sizes.push({table:name,...row});
 }
 const history=await db.prepare('SELECT coalesce(sum(length(CAST(actions_json AS BLOB))),0) normalized_action_bytes,coalesce(sum(length(CAST(raw_json AS BLOB))),0) raw_page_bytes FROM award_history_pages').first();
 const probe=await db.prepare('SELECT 1 AS storage_probe').all();
 const fixed=sizes.filter(t=>t.table==='offices').reduce((n,t)=>n+t.logical_bytes,0),variable=sizes.filter(t=>['awards','award_windows','award_history_pages','fiscal_totals'].includes(t.table)).reduce((n,t)=>n+t.logical_bytes,0);
 return {physical_bytes:probe.meta?.size_after??null,table_sizes:sizes,history,
 projection:{offices:CONFIG.storageProjectionOffices,fixed_directory_bytes:fixed,one_office_payload_bytes:variable,total_logical_bytes:fixed+variable*CONFIG.storageProjectionOffices,warning:'Linear FA4528-only extrapolation, not a forecast: office award counts and history depths vary. Logical table bytes exclude SQLite/index overhead. Physical total includes overhead and unused pages.'}};
}
