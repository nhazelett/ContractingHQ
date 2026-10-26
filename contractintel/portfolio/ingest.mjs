// All NEW ingestion limits live here. Existing source helper internals are intentionally unchanged.
export const CONFIG=Object.freeze({
 offices:['FA4528'],windows:['2007-10-01','2021-10-01','2024-10-01','2025-10-01'],
 awardTypes:['A','B','C','D'],lookbackDays:14,searchBatch:100,historyBatch:200,
 sourceIntervalMs:400,maxRuntimeMs:180000,shutdownReserveMs:15000,leaseMs:300000,
 maxSourceRequests:180,sourceRequestReserve:2,maxD1Queries:850,maxPageD1Queries:220,maxAwards:25000,maxCandidates:100000,
 maxFiscalPages:100,stageWriteBatch:20,directorySeedBatch:10,maxBackfillChunks:40,secretReadyAttempts:10,secretWaitMs:2000,d1HttpTimeoutMs:60000,d1IntervalMs:300,dispatchTimeoutMs:15000,dispatchLeaseMs:120000,
 githubRepository:'nhazelett/ContractingHQ',githubWorkflow:'contractintel-portfolio-ingest.yml',githubRef:'codex/contractintel',backupCron:'0 10 * * *',runnerJobMinutes:360,maxStorageBytes:268435456,maxRunRowsWritten:100000,
 millisecondsPerDay:86400000,reconciliationDays:30,expiryWindows:[90,180,365],recompeteDays:365,
 schemaVersion:1,timeZone:'America/New_York',cron:'0 7 * * *',
 modes:['backfill','nightly'],storageProjectionOffices:1432
});
import {resolve,cents,validAwardID} from '../web/source.mjs';
import {createSourceFetch} from '../web/source-requests.mjs';
import {incorporatePortfolio} from '../web/portfolio-progress.mjs';
import {lifecycle} from '../web/lifecycle.mjs';
import {daysRemaining} from '../web/format.mjs';
import {fiscalMonths,fiscalYear,fiscalTotals} from '../web/overview.mjs';
import {currentDate} from '../web/calendar.mjs';
const SOURCE='https://api.usaspending.gov';
const stamp=now=>new Date(now()).toISOString();
const parse=JSON.parse;
class YieldRun extends Error {}
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function derive(row,today){
 const life=lifecycle(row,today),current=daysRemaining(row.current_end_date,today),potential=daysRemaining(row.potential_end_date,today);
 return {lifecycle_kind:life.kind,dataset_bucket:life.scope,date_review_flag:life.kind==='review'?1:0,
 classification_reason:life.reason,days_to_current_end:current,days_to_potential_end:potential,
 recompete_candidate:!row.details_pending&&!row.details_unavailable&&life.kind!=='review'&&potential!==null&&potential>=0&&potential<=CONFIG.recompeteDays?1:0,derived_as_of:today};
}
export async function documentFor(data,raw,rawHistory,today){
 const row=incorporatePortfolio(data),latest=raw.latest_transaction_contract_data||{},recipient=raw.recipient||{};
 const db={generated_unique_award_id:row.award_id,piid:row.piid,parent_piid:row.parent_piid||null,office_dodaac:row.office_code,
 recipient_name:row.recipient||null,recipient_uei:recipient.recipient_uei||latest.recipient_uei||null,description:row.description||null,
 naics_code:latest.naics||null,naics_description:latest.naics_description||null,psc_code:latest.product_or_service_code||null,
 psc_description:latest.product_or_service_description||null,set_aside_code:latest.type_set_aside||null,set_aside_description:row.set_aside||null,
 award_type_code:raw.type||null,award_type_description:raw.type_description||null,competition:row.competition||null,pricing_type:row.pricing_type||null,
 pop_start_date:row.start_date,current_pop_end_date:row.current_end_date,potential_final_end_date:row.potential_end_date,
 date_signed:raw.date_signed||null,source_last_modified_date:raw.period_of_performance?.last_modified_date||null,latest_action_date:row.latest_action_date,
 current_value_cents:row.award_amount_cents,total_obligation_cents:row.obligation_cents,base_exercised_options_cents:row.award_amount_cents,
 potential_value_cents:cents(raw.base_and_all_options),...derive(row,today),latest_mod_number:row.latest_mod_number,
 latest_option_mod_number:row.latest_option_mod_number,details_unavailable:row.details_unavailable?1:0,detail_error:row.detail_error||null,
 history_has_next:data.history?.has_next?1:0};
 return {db,record:row,raw,history:data.history,rawHistory,source_hash:await hash([row,raw,data.history,rawHistory])};
}
export async function seedOffices(db,offices){
 // Directory is shipped with the application, never guessed from an award's contracting agency.
 for(let i=0;i<offices.length;i+=CONFIG.directorySeedBatch){
  const chunk=offices.slice(i,i+CONFIG.directorySeedBatch),values=chunk.map(()=>'(?,?,?,?,NULL,?,?,?,?,?)').join(','),params=chunk.flatMap(o=>[o.code,o.name,o.reported_name||null,o.department||null,o.command||null,o.base||null,o.location||null,o.confidence||null,JSON.stringify(o)]);
  await db.prepare('INSERT INTO offices(dodaac,name,reported_name,department,parent_dodaac,command,base,location,confidence,raw_json) VALUES '+values+' ON CONFLICT(dodaac) DO UPDATE SET name=excluded.name,reported_name=excluded.reported_name,department=excluded.department,command=excluded.command,base=excluded.base,location=excluded.location,confidence=excluded.confidence,raw_json=excluded.raw_json WHERE raw_json<>excluded.raw_json').bind(...params).run();
 }

}
function meter(binding,stats){
 const count=result=>{stats.queries++;stats.rowsRead+=result?.meta?.rows_read||0;stats.rowsWritten+=result?.meta?.rows_written||0;return result;};
 return {prepare(sql){const wrap=stmt=>({bind:(...args)=>wrap(stmt.bind(...args)),all:async()=>count(await stmt.all()),run:async()=>count(await stmt.run()),first:async()=>((count(await stmt.all())).results||[])[0]||null,_stmt:stmt});return wrap(binding.prepare(sql));},batch:async statements=>(await binding.batch(statements.map(s=>s._stmt))).map(count)};
}
export async function runIngest(env,{mode='nightly',now=Date.now,fetcher=fetch,config:overrides={}}={}){
 const config={...CONFIG,...overrides};
 if(!config.modes.includes(mode))throw new Error('Invalid ingestion mode.');
 if(config.offices.some(o=>!CONFIG.offices.includes(o)))throw new Error('The pilot is restricted to FA4528.');
 if(!env.PORTFOLIO_DB)throw new Error('Portfolio D1 binding is missing.');
 const started=now(),runId=crypto.randomUUID(),stats={queries:0,rowsRead:0,rowsWritten:0,sourceRequests:0,sourceFailures:[]},db=meter(env.PORTFOLIO_DB,stats);
 const lease=await db.prepare('UPDATE ingest_lock SET owner=?,lease_until=? WHERE singleton=1 AND (owner IS NULL OR lease_until<?)').bind(runId,new Date(started+config.leaseMs).toISOString(),stamp(now)).run();
 if(!lease.meta?.changes)return {status:'busy',offices:config.offices};
 let progress,checkpoint,workId,runMode=mode,previousRun=null,status='running',errorMessage=null,touched=0;
 const remaining=()=>now()-started<config.maxRuntimeMs-config.shutdownReserveMs&&stats.sourceRequests<config.maxSourceRequests-config.sourceRequestReserve&&stats.queries<config.maxD1Queries-config.maxPageD1Queries&&stats.rowsWritten<config.maxRunRowsWritten;
 const ensure=()=>{if(!remaining())throw new YieldRun('Budget reached; checkpoint retained.');};
 const rawResponses=new Map(),deadline=new AbortController(),deadlineTimer=setTimeout(()=>deadline.abort(new Error('Ingestion time budget reached.')),config.maxRuntimeMs);
 const paced=createSourceFetch({interval:config.sourceIntervalMs,fetcher:async(url,options)=>{
  ensure();stats.sourceRequests++;const response=await fetcher(url,options);if(!response.ok)stats.sourceFailures.push({status:response.status,path:new URL(url).pathname});
  if(response.ok)try{rawResponses.set(new URL(url).pathname,await response.clone().json());}catch{}
  return response;
 }});
 const request=async(path,params={},summary=false)=>{
  ensure();const url=new URL('/api/'+path,'https://portfolio.internal');for(const [key,value]of Object.entries(params))if(value!==null&&value!==undefined)url.searchParams.set(key,value);
  return resolve(url,{OFFICES:env.OFFICES||[],SOURCE_FETCH:paced,SIGNAL:deadline.signal,SUMMARY_ONLY:summary});
 };
 const put=async(kind,key,data)=>db.prepare('INSERT INTO ingest_stage(work_id,record_kind,record_key,data_json) VALUES(?,?,?,?) ON CONFLICT(work_id,record_kind,record_key) DO UPDATE SET data_json=excluded.data_json').bind(workId,kind,key,JSON.stringify(data)).run();
 const putMany=async entries=>{for(let i=0;i<entries.length;i+=config.stageWriteBatch)await db.batch(entries.slice(i,i+config.stageWriteBatch).map(([kind,key,data])=>db.prepare('INSERT INTO ingest_stage(work_id,record_kind,record_key,data_json) VALUES(?,?,?,?) ON CONFLICT(work_id,record_kind,record_key) DO UPDATE SET data_json=excluded.data_json').bind(workId,kind,key,JSON.stringify(data))));};
 const save=async()=>db.prepare('UPDATE ingest_office_progress SET run_id=?,checkpoint_json=?,updated_at=? WHERE office_dodaac=?').bind(runId,JSON.stringify(checkpoint),stamp(now),config.offices[0]).run();
 try{
  await db.prepare('INSERT INTO ingest_runs(id,mode,started_at,status,config_json,resume_from_run_id) VALUES(?,?,?,?,?,NULL)').bind(runId,mode,stamp(now),'running',JSON.stringify(config)).run();
  const probe=await db.prepare('SELECT 1 AS storage_probe').all();
  if(!Number.isFinite(probe.meta?.size_after))throw new Error('Portfolio storage measurement is unavailable; stopped safely.');
  if(probe.meta.size_after>=config.maxStorageBytes)throw new Error('Portfolio storage budget reached; publication retained.');
  const office=config.offices[0];
  progress=await db.prepare('SELECT * FROM ingest_office_progress WHERE office_dodaac=? AND status IN (\'running\',\'yielded\',\'failed\')').bind(office).first();
  previousRun=progress?.run_id||null;
  await db.prepare('UPDATE ingest_runs SET resume_from_run_id=? WHERE id=?').bind(previousRun,runId).run();
  const published=await db.prepare('SELECT p.*,r.mode FROM office_publications p JOIN ingest_runs r ON r.id=p.published_run_id WHERE office_dodaac=?').bind(office).first();
  if(progress){checkpoint=parse(progress.checkpoint_json);workId=progress.work_id;runMode=progress.mode;}
  else{
   runMode=!published?'backfill':mode;
   if(runMode==='nightly'){const last=await db.prepare("SELECT max(started_at) started_at FROM ingest_runs WHERE mode='backfill' AND status='completed'").first();if(!last.started_at||now()-Date.parse(last.started_at)>config.reconciliationDays*config.millisecondsPerDay)runMode='backfill';}
   const today=currentDate(now());workId=runId;
   checkpoint={phase:runMode==='nightly'?'changes':'discover',today,window:0,page:1,cursor:null,sortValue:null,after:'',month:0,fiscalPage:1,months:fiscalMonths(today),candidates:0};
   await db.prepare('INSERT INTO ingest_office_progress(office_dodaac,run_id,work_id,mode,status,checkpoint_json,started_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(office_dodaac) DO UPDATE SET run_id=excluded.run_id,work_id=excluded.work_id,mode=excluded.mode,status=excluded.status,checkpoint_json=excluded.checkpoint_json,started_at=excluded.started_at,updated_at=excluded.updated_at').bind(office,runId,workId,runMode,'running',JSON.stringify(checkpoint),stamp(now),stamp(now)).run();
  }
  touched=1;await db.prepare('UPDATE ingest_runs SET mode=? WHERE id=?').bind(runMode,runId).run();
  while(remaining()&&checkpoint.phase!=='done'){
   if(checkpoint.phase==='changes'){
    const end=checkpoint.today,start=new Date(Date.parse(end+'T00:00:00Z')-config.lookbackDays*config.millisecondsPerDay).toISOString().slice(0,10);
    const body={filters:{award_type_codes:config.awardTypes,keywords:[office],time_period:[{start_date:start,end_date:end,date_type:'last_modified_date'}]},fields:['Award ID','generated_internal_id','End Date'],limit:config.searchBatch,page:checkpoint.page,sort:'End Date',order:'desc'};
    if(checkpoint.cursor!==null){body.last_record_unique_id=checkpoint.cursor;body.last_record_sort_value=checkpoint.sortValue;}
    const response=await paced(SOURCE+'/api/v2/search/spending_by_award/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:deadline.signal});
    if(!response.ok)throw new Error('USAspending changed-award discovery failed: '+response.status);
    const data=await response.json();if(!Array.isArray(data.results)||typeof data.page_metadata?.hasNext!=='boolean')throw new Error('Invalid changed-award discovery response.');
    for(const row of data.results)if(String(row['Award ID']||'').startsWith(office)&&validAwardID(row.generated_internal_id))await put('changed',row.generated_internal_id,{});
    checkpoint.page++;checkpoint.cursor=data.page_metadata.last_record_unique_id??null;checkpoint.sortValue=data.page_metadata.last_record_sort_value??null;
    if(!data.page_metadata.hasNext){checkpoint.phase='discover';checkpoint.page=1;checkpoint.cursor=null;checkpoint.sortValue=null;}
    await save();
   }else if(checkpoint.phase==='discover'){
    const start=config.windows[checkpoint.window],data=await request('awards',{office,start,page:checkpoint.page,cursor:checkpoint.cursor,sort_value:checkpoint.sortValue});
    checkpoint.candidates+=data.candidates;if(checkpoint.candidates>config.maxCandidates)throw new Error('Office candidate budget exceeded.');
    await putMany(data.rows.flatMap(row=>[['window',start+'|'+row.award_id,{award_id:row.award_id,window_start:start}],['candidate',row.award_id,row]]));
    checkpoint.page++;checkpoint.cursor=data.cursor;checkpoint.sortValue=data.sort_value;
    if(!data.has_next){checkpoint.window++;checkpoint.page=1;checkpoint.cursor=null;checkpoint.sortValue=null;if(checkpoint.window===config.windows.length)checkpoint.phase='hydrate';}
    await save();
   }else if(checkpoint.phase==='hydrate'){
    const next=await db.prepare("SELECT record_key,data_json FROM ingest_stage WHERE work_id=? AND record_kind='candidate' AND record_key>? ORDER BY record_key LIMIT 1").bind(workId,checkpoint.after).first();
    if(!next){checkpoint.phase='fiscal';await save();continue;}
    if(checkpoint.awardCount===undefined){const count=await db.prepare("SELECT count(*) n FROM ingest_stage WHERE work_id=? AND record_kind='candidate'").bind(workId).first();checkpoint.awardCount=count.n;}
    if(checkpoint.awardCount>config.maxAwards)throw new Error('Office award budget exceeded.');
    const id=next.record_key,changed=runMode==='backfill'||await db.prepare("SELECT 1 n FROM ingest_stage WHERE work_id=? AND record_kind='changed' AND record_key=?").bind(workId,id).first();
    const old=!changed?await db.prepare('SELECT record_json,raw_json,source_hash FROM awards WHERE generated_unique_award_id=?').bind(id).first():null;
    let doc;
    if(old){
     const h=await db.prepare('SELECT * FROM award_history_pages WHERE generated_unique_award_id=? AND page=1').bind(id).first(),record=parse(old.record_json);
     doc=await documentFor({award:record,history:h?{actions:parse(h.actions_json),has_next:!!h.has_next,page:1}:null},parse(old.raw_json),h?parse(h.raw_json):null,checkpoint.today);
    }else{
     try{
      rawResponses.clear();const data=await request('award',{id});doc=await documentFor(data,rawResponses.get('/api/v2/awards/'+encodeURIComponent(id)+'/')||{},rawResponses.get('/api/v2/transactions/')||null,checkpoint.today);
     }catch(error){
      if(error instanceof YieldRun)throw error;
      if(error.status!==404)throw error;
      const row={...parse(next.data_json),office_code:office,office_name:(env.OFFICES||[]).find(o=>o.code===office)?.name,details_pending:false,details_unavailable:true,detail_error:error.message};
      doc=await documentFor({award:row,history:null},{search_record:parse(next.data_json)},null,checkpoint.today);
     }
    }
    await put('award',id,doc);checkpoint.after=id;await save();
   }else if(checkpoint.phase==='fiscal'){
    if(checkpoint.month===checkpoint.months.length){checkpoint.phase='publish';await save();continue;}
    const month=checkpoint.months[checkpoint.month],data=await request('fiscal',{office,...month,page:checkpoint.fiscalPage});
    await put('fiscal-page',month.start+'|'+checkpoint.fiscalPage,data);
    if(data.has_next&&checkpoint.fiscalPage>=config.maxFiscalPages)throw new Error('Fiscal month exceeds the existing source paging limit.');
    if(data.has_next)checkpoint.fiscalPage++;else{checkpoint.month++;checkpoint.fiscalPage=1;}
    await save();
   }else if(checkpoint.phase==='publish'){
    ensure();await publishOffice(db,{workId,office,runId,checkpoint,config,now});checkpoint.phase='done';
   }
  }
  status=checkpoint.phase==='done'?'completed':'yielded';
 }catch(error){
  const committed=checkpoint?.phase==='publish'?await db.prepare("SELECT p.published_run_id FROM office_publications p JOIN ingest_runs r ON r.id=p.published_run_id WHERE p.office_dodaac=? AND p.published_run_id=? AND r.status='completed'").bind(config.offices[0],runId).first().catch(()=>null):null;
  if(committed){checkpoint.phase='done';status='completed';}
  else if(error instanceof YieldRun||deadline.signal.aborted)status='yielded';else{status='failed';errorMessage=(error.message||'Ingestion failed.')+(stats.sourceFailures.length?' Source HTTP '+stats.sourceFailures.at(-1).status+' at '+stats.sourceFailures.at(-1).path+'.':'');}
 }finally{
  clearTimeout(deadlineTimer);
  try{
   if(workId)await db.prepare("UPDATE ingest_office_progress SET status=?,updated_at=? WHERE office_dodaac=? AND work_id=? AND status<>'completed'").bind(status,stamp(now),config.offices[0],workId).run();
   await db.prepare("UPDATE ingest_runs SET ended_at=?,status=CASE WHEN status='completed' THEN status ELSE ? END,offices_touched=?,rows_written=?,rows_read=?,source_requests=?,error_count=?,errors_json=? WHERE id=?").bind(stamp(now),status,touched,stats.rowsWritten,stats.rowsRead,stats.sourceRequests,errorMessage?1:0,JSON.stringify(errorMessage?[errorMessage]:[]),runId).run();
  }finally{await db.prepare('UPDATE ingest_lock SET owner=NULL,lease_until=NULL WHERE singleton=1 AND owner=?').bind(runId).run();}
 }
 const result={run_id:runId,status,office:config.offices[0],mode:runMode,phase:checkpoint?.phase,...stats,error:errorMessage};
 console.log(JSON.stringify({portfolio_ingest:result}));
 if(errorMessage)throw Object.assign(new Error(errorMessage),{result});return result;
}
async function publishOffice(db,{workId,office,runId,checkpoint,config,now}){
 const staged=await db.prepare("SELECT data_json FROM ingest_stage WHERE work_id=? AND record_kind='award' LIMIT 1").bind(workId).first();
 const columns=staged?Object.keys(parse(staged.data_json).db):[];
 const statements=[];
 if(columns.length){
  const jsonCols=['record_json','raw_json','source_hash'],expressions=columns.map(c=>"json_extract(data_json,'$.db."+c+"')").concat(["json_extract(data_json,'$.record')","json_extract(data_json,'$.raw')","json_extract(data_json,'$.source_hash')",'?']);
  statements.push(db.prepare('INSERT INTO awards('+columns.concat(jsonCols,'published_run_id').join(',')+') SELECT '+expressions.join(',')+" FROM ingest_stage WHERE work_id=? AND record_kind='award' ON CONFLICT(generated_unique_award_id) DO UPDATE SET "+columns.filter(c=>c!=='generated_unique_award_id').concat(jsonCols,'published_run_id').map(c=>c+'=excluded.'+c).join(',')+' WHERE awards.source_hash<>excluded.source_hash').bind(runId,workId));
 }
 statements.push(db.prepare("DELETE FROM awards WHERE office_dodaac=? AND generated_unique_award_id NOT IN(SELECT record_key FROM ingest_stage WHERE work_id=? AND record_kind='award')").bind(office,workId));
 statements.push(db.prepare('DELETE FROM award_windows WHERE generated_unique_award_id IN(SELECT generated_unique_award_id FROM awards WHERE office_dodaac=?)').bind(office));
 statements.push(db.prepare("INSERT INTO award_windows SELECT json_extract(data_json,'$.award_id'),json_extract(data_json,'$.window_start') FROM ingest_stage WHERE work_id=? AND record_kind='window'").bind(workId));
 statements.push(db.prepare("DELETE FROM award_history_pages WHERE generated_unique_award_id IN(SELECT record_key FROM ingest_stage WHERE work_id=? AND record_kind='award' AND json_type(data_json,'$.history')='null')").bind(workId));
 statements.push(db.prepare("INSERT INTO award_history_pages(generated_unique_award_id,page,actions_json,raw_json,has_next,source_hash,published_run_id) SELECT record_key,1,json_extract(data_json,'$.history.actions'),coalesce(json_extract(data_json,'$.rawHistory'),'null'),json_extract(data_json,'$.history.has_next'),json_extract(data_json,'$.source_hash'),? FROM ingest_stage WHERE work_id=? AND record_kind='award' AND json_type(data_json,'$.history')='object' ON CONFLICT(generated_unique_award_id,page) DO UPDATE SET actions_json=excluded.actions_json,raw_json=excluded.raw_json,has_next=excluded.has_next,source_hash=excluded.source_hash,published_run_id=excluded.published_run_id WHERE award_history_pages.source_hash<>excluded.source_hash").bind(runId,workId));
 const pages=await db.prepare("SELECT data_json FROM ingest_stage WHERE work_id=? AND record_kind='fiscal-page' ORDER BY record_key").bind(workId).all(),rows=pages.results.flatMap(p=>parse(p.data_json).rows),totals=fiscalTotals(rows,checkpoint.today);
 for(const total of totals){const values=[office,total.year,String(total.cents),total.awards.size,rows.filter(r=>fiscalYear(r.date)===total.year).length,total.missing,(total.year-1)+'-10-01',total.year===fiscalYear(checkpoint.today)?checkpoint.today:total.year+'-09-30',1,JSON.stringify([...total.awards].sort()),runId];
  statements.push(db.prepare('INSERT INTO fiscal_totals VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(office_dodaac,fiscal_year) DO UPDATE SET net_obligation_cents=excluded.net_obligation_cents,distinct_contract_count=excluded.distinct_contract_count,transaction_count=excluded.transaction_count,missing_amount_count=excluded.missing_amount_count,coverage_start=excluded.coverage_start,coverage_end=excluded.coverage_end,complete=excluded.complete,award_ids_json=excluded.award_ids_json,published_run_id=excluded.published_run_id WHERE net_obligation_cents<>excluded.net_obligation_cents OR distinct_contract_count<>excluded.distinct_contract_count OR transaction_count<>excluded.transaction_count OR missing_amount_count<>excluded.missing_amount_count OR coverage_end<>excluded.coverage_end OR award_ids_json<>excluded.award_ids_json').bind(...values));
 }
 const n=await db.prepare("SELECT count(*) n FROM ingest_stage WHERE work_id=? AND record_kind='award'").bind(workId).first();
 statements.push(db.prepare('INSERT INTO office_publications VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(office_dodaac) DO UPDATE SET published_run_id=excluded.published_run_id,coverage_start=excluded.coverage_start,coverage_end=excluded.coverage_end,windows_json=excluded.windows_json,award_count=excluded.award_count,fiscal_complete=excluded.fiscal_complete,schema_version=excluded.schema_version,published_at=excluded.published_at').bind(office,runId,config.windows[0],checkpoint.today,JSON.stringify(config.windows),n.n,1,config.schemaVersion,stamp(now)));
 statements.push(db.prepare("UPDATE ingest_runs SET status='completed' WHERE id=?").bind(runId));
 statements.push(db.prepare("UPDATE ingest_office_progress SET status='completed',checkpoint_json=? WHERE office_dodaac=? AND work_id=?").bind(JSON.stringify({...checkpoint,phase:'done'}),office,workId));
 statements.push(db.prepare('DELETE FROM ingest_stage WHERE work_id=?').bind(workId));
 // D1 batch is a transaction: readers see the old complete publication or the new complete one.
 await db.batch(statements);
}
