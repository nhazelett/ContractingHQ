// Resumable FA4528 R2 ingest. Atomic publication; no D1 award writes.
import {CONFIG,documentFor,r2Profile} from '../ingest.mjs';
import {resolve,validAwardID} from '../../web/source.mjs';
import {createSourceFetch} from '../../web/source-requests.mjs';
import {currentDate} from '../../web/calendar.mjs';
import {fiscalMonths,fiscalTotals,fiscalYear} from '../../web/overview.mjs';
import {createFormat} from './format.mjs';

export function createOfficeIngest(profile){
const {PILOT,bytes,pack,unpack,canonical,checkTables,buildBundle,restoreBundle,validateManifest,digest}=createFormat(profile);
const SETTINGS={...CONFIG.r2Nightly,...profile,checkpointKey:profile.prefix+'/checkpoint.json.gz',ledgerKey:profile.prefix+'/budget.json',verificationKey:profile.prefix+'/verification.json.gz',admissionKey:profile.prefix+'/admission.json',workerPrefix:'kthq-ci-r2-'+profile.office.toLowerCase()};
const CURRENT=PILOT.prefix+'/current.json';
class BudgetReached extends Error {}
const must=(value,message)=>{if(!value)throw new Error(message);};
const compare=(a,b)=>a<b?-1:a>b?1:0;
async function loadPublication(store){
 const entry=await store.get(CURRENT);if(!entry)return null;
 const manifest=validateManifest(JSON.parse(new TextDecoder().decode(entry.bytes)));
 let lookup;
 const tables=await restoreBundle(manifest,async descriptor=>{
  const object=await store.get(descriptor.key);must(object,'Publication object is missing.');const value=await unpack(object.bytes,descriptor.sha256);if(descriptor.key===manifest.lookup.key)lookup=value;return value;
 });
 return {manifest,tables,lookup,etag:entry.etag};
}

// The checkpoint is one bounded, atomic R2 object. Published evidence is referenced,
// not copied into it. A failed upload leaves the previous checkpoint intact.
async function saveCheckpoint(store,state,etag){
 must(bytes(state).length<=SETTINGS.maxCheckpointJSONBytes,'Checkpoint JSON budget reached; publication retained.');
 const object=await pack(state);must(object.bytes.length<=SETTINGS.maxCheckpointBytes,'Checkpoint storage budget reached; publication retained.');
 const result=await store.put(SETTINGS.checkpointKey,object.bytes,{expected:etag,sha:object.sha256});return result.etag;
}

function candidateTables(base,state,{now=Date.now,sourceRequests=state.source_requests}={}){
 must(state.phase==='publish'&&state.hydrate_index===Object.keys(state.candidates).length,'Award pass is incomplete.');
 must(state.month===state.months.length&&canonical(state.months)===canonical(fiscalMonths(state.today)),'Fiscal month coverage is incomplete.');
 must(CONFIG.windows.every(start=>Array.isArray(state.windows[start])),'A history window is incomplete.');
 const windowIDs=new Set(Object.values(state.windows).flat());
 must(windowIDs.size===Object.keys(state.candidates).length&&Object.keys(state.candidates).every(id=>windowIDs.has(id)),'Window membership differs from discovered awards.');
 const expectedPages=new Set();
 for(const month of state.months){
  let page=1;for(;;){
   must(page<=CONFIG.maxFiscalPages,'Fiscal paging budget exceeded.');
   const key=month.start+'|'+String(page).padStart(String(CONFIG.maxFiscalPages).length,'0'),data=state.fiscal_pages[key];
   must(data&&Array.isArray(data.rows)&&typeof data.has_next==='boolean','A fiscal page is incomplete.');expectedPages.add(key);
   if(!data.has_next)break;page++;
  }
 }
 must(expectedPages.size===Object.keys(state.fiscal_pages).length,'Unexpected fiscal pages in checkpoint.');
 const pub=base.office_publications[0],id=state.work_id,stamp=state.publishing_at||new Date(now()).toISOString();
 const oldAwards=new Map(base.awards.map(row=>[row.generated_unique_award_id,row]));
 const awards=[],history=[];
 for(const awardID of Object.keys(state.candidates).sort(compare)){
  const old=oldAwards.get(awardID),doc=state.documents[awardID];
  must(old||doc,'A discovered award has not been hydrated.');
  if(!doc||doc.source_hash===old?.source_hash){awards.push(old);history.push(...base.award_history_pages.filter(row=>row.generated_unique_award_id===awardID));continue;}
  awards.push({...doc.db,record_json:JSON.stringify(doc.record),raw_json:JSON.stringify(doc.raw),source_hash:doc.source_hash,published_run_id:id});
  if(doc.history){
   history.push({generated_unique_award_id:awardID,page:1,actions_json:JSON.stringify(doc.history.actions),raw_json:JSON.stringify(doc.rawHistory),has_next:doc.history.has_next?1:0,source_hash:doc.source_hash,published_run_id:id});
   history.push(...base.award_history_pages.filter(row=>row.generated_unique_award_id===awardID&&row.page!==1));
  }
 }
 const windows=Object.entries(state.windows).flatMap(([window_start,ids])=>ids.map(generated_unique_award_id=>({generated_unique_award_id,window_start}))).sort((a,b)=>compare(a.generated_unique_award_id,b.generated_unique_award_id)||compare(a.window_start,b.window_start));
 const rows=Object.keys(state.fiscal_pages).sort(compare).flatMap(key=>state.fiscal_pages[key].rows),totals=fiscalTotals(rows,state.today);
 const fiscal=totals.map(total=>({office_dodaac:SETTINGS.office,fiscal_year:total.year,net_obligation_cents:String(total.cents),distinct_contract_count:total.awards.size,transaction_count:rows.filter(row=>fiscalYear(row.date)===total.year).length,missing_amount_count:total.missing,coverage_start:(total.year-1)+'-10-01',coverage_end:total.year===fiscalYear(state.today)?state.today:total.year+'-09-30',complete:1,award_ids_json:JSON.stringify([...total.awards].sort()),published_run_id:id}));
 const run={id,mode:state.mode,started_at:state.started_at,ended_at:stamp,status:'completed',offices_touched:1,rows_written:0,rows_read:0,source_requests:sourceRequests,error_count:0,errors_json:'[]',config_json:JSON.stringify({backend:'r2-shadow',...CONFIG}),resume_from_run_id:pub.published_run_id};
 const tables={...base,awards,award_windows:windows,award_history_pages:history.sort((a,b)=>compare(a.generated_unique_award_id,b.generated_unique_award_id)||a.page-b.page),fiscal_totals:fiscal,
  office_publications:[{...pub,published_run_id:id,coverage_end:state.today,award_count:awards.length,fiscal_complete:1,published_at:stamp}],ingest_runs:[...base.ingest_runs,run]};
 const lastFull=tables.ingest_runs.filter(row=>row.mode==='backfill'&&row.status==='completed').sort((a,b)=>compare(b.started_at,a.started_at))[0];
 const referenced=new Set([id,lastFull?.id,...awards.map(row=>row.published_run_id),...history.map(row=>row.published_run_id)]);
 tables.ingest_runs=tables.ingest_runs.filter(row=>referenced.has(row.id)).sort((a,b)=>compare(a.id,b.id));
 checkTables(tables);return tables;
}

async function publishCandidate(store,base,state,tables,{now=Date.now,beforePublish=async()=>{}}={}){
 const current=await store.get(CURRENT);must((current?.etag||null)===base.etag,'Another publication won; checkpoint retained for review.');
 const bundle=await buildBundle(tables,{now,previousLookup:base.lookup});
 if(base.manifest.version){const archive=await pack(base.manifest),archiveKey=PILOT.prefix+'/objects/manifest-'+base.manifest.version+'-'+archive.sha256+'.json.gz';
 if(!await store.head(archiveKey))await store.put(archiveKey,archive.bytes,{expected:null,sha:archive.sha256});
 bundle.manifest.previous_manifest={key:archiveKey,sha256:archive.sha256,compressed_bytes:archive.bytes.length,raw_bytes:archive.rawBytes};}
 bundle.manifest.retained_versions=[...new Set([bundle.manifest.version,...base.manifest.retained_versions])].slice(0,PILOT.maxStoredVersions);
 let uploaded=0,reused=0;
 for(const object of bundle.objects){
  const existing=await store.head(object.key);
  if(existing){must(existing.sha===object.sha256,'Immutable object identity differs.');reused++;continue;}
  await store.put(object.key,object.bytes,{expected:null,sha:object.sha256});uploaded++;
 }
 // Verify the actual stored bytes, all raw SQL fields, every window and fiscal
 // total before the single conditional pointer write makes any data visible.
 const restored=await restoreBundle(bundle.manifest,async descriptor=>{
  const object=await store.get(descriptor.key);must(object,'Candidate object was not stored.');return unpack(object.bytes,descriptor.sha256);
 });
 must(canonical(restored)===canonical(tables),'Candidate round trip changed a field; old publication retained.');
 await beforePublish({tables,restored,bundle});
 const pointer=bytes(bundle.manifest);
 try{await store.put(CURRENT,pointer,{expected:base.etag,sha:await digest(pointer)});}
 catch(error){
  // A lost response after a successful R2 write must not cause a second publish.
  const observed=await store.get(CURRENT).catch(()=>null);
  if(!observed||JSON.parse(new TextDecoder().decode(observed.bytes)).version!==bundle.manifest.version)throw error;
 }
 return {publication_id:state.work_id,version:bundle.manifest.version,uploaded_objects:uploaded,reused_objects:reused,compressed_bytes:bundle.compressed_bytes,raw_round_trip_match:true};
}

async function runR2Chunk({store,directory,mode='nightly',fetcher=fetch,now=Date.now,config:overrides={},beforePublish,force=false}={}){
 must(CONFIG.modes.includes(mode),'Invalid ingest mode.');
 must(directory.some(office=>office.code===SETTINGS.office),'Selected office directory entry is missing.');
 const config={...CONFIG,offices:[SETTINGS.office],...overrides};must(config.offices.length===1&&config.offices[0]===SETTINGS.office,'Cross-office ingestion is not permitted.');
 let base=await loadPublication(store);
 if(!base){
  const entry=directory.find(row=>row.code===SETTINGS.office);
  base={etag:null,manifest:{version:null,retained_versions:[],source_publication_id:null},tables:{offices:[{dodaac:entry.code,name:entry.name,reported_name:entry.reported_name||null,department:entry.department||null,parent_dodaac:null,command:entry.command||null,base:entry.base||null,location:entry.location||null,confidence:entry.confidence||null,raw_json:JSON.stringify(entry)}],awards:[],award_windows:[],award_history_pages:[],fiscal_totals:[],ingest_runs:[],office_publications:[{office_dodaac:entry.code,published_run_id:null,coverage_start:CONFIG.windows[0],coverage_end:null,windows_json:JSON.stringify(CONFIG.windows),award_count:0,fiscal_complete:0,schema_version:CONFIG.schemaVersion,published_at:null}]}};
 }
 let saved=await store.get(SETTINGS.checkpointKey),etag=saved?.etag||null,state=saved?await unpack(saved.bytes,null,SETTINGS.maxCheckpointJSONBytes):null;
 if(state){
  must(state.format_version===SETTINGS.formatVersion&&state.office===SETTINGS.office,'Invalid checkpoint identity.');
  if(state.work_id===base.manifest.source_publication_id&&state.status!=='completed'){
   // Publication succeeded but checkpoint acknowledgement may have been lost.
   if(state.status!=='completed'){state.status='completed';state.phase='done';await saveCheckpoint(store,state,etag);}
   return {status:'retained',office:SETTINGS.office,publication_id:state.work_id,source_requests:0};
  }
  if(state.status==='completed'){
   if(!force&&mode==='nightly'&&currentDate(Date.parse(base.manifest.source_published_at))===currentDate(now()))return {status:'retained',office:SETTINGS.office,publication_id:state.work_id,source_requests:0};
   state=null;
  }
  else must(state.base_version===base.manifest.version,'Published data changed under a pending checkpoint; stopped for review.');
 }
 const started=now(),today=currentDate(started),requests={count:0,failures:[]},deadline=new AbortController();
 if(!state){
  const lastFull=base.tables.ingest_runs.filter(row=>row.mode==='backfill'&&row.status==='completed').sort((a,b)=>compare(b.started_at,a.started_at))[0];
  const reconcile=mode==='backfill'||!lastFull||started-Date.parse(lastFull.started_at)>config.reconciliationDays*config.millisecondsPerDay;
  state={format_version:SETTINGS.formatVersion,office:SETTINGS.office,work_id:crypto.randomUUID(),base_version:base.manifest.version,
   mode:reconcile?'backfill':mode,started_at:new Date(started).toISOString(),today,source_end_utc:new Date(started).toISOString().slice(0,10),
   phase:reconcile?'discover':'changes',status:'running',page:1,cursor:null,sort_value:null,window:0,candidates:{},windows:{},changed:{},documents:{},
   hydrate_index:0,month:0,fiscal_page:1,months:fiscalMonths(today),fiscal_pages:{},source_requests:0,attempts:[]};
  etag=await saveCheckpoint(store,state,etag);
 }
 const timer=setTimeout(()=>deadline.abort(new BudgetReached('Chunk time budget reached.')),config.maxRuntimeMs);
 const remaining=()=>now()-started<config.maxRuntimeMs-config.shutdownReserveMs&&requests.count<config.maxSourceRequests-config.sourceRequestReserve;
 const ensure=()=>{if(!remaining())throw new BudgetReached('Source/time budget reached.');};
 const rawResponses=new Map(),paced=createSourceFetch({interval:config.sourceIntervalMs,fetcher:async(url,options)=>{
  if(state.mode==='backfill'&&state.source_requests>=SETTINGS.maxOfficeBackfillRequests)throw new Error('Office backfill request budget reached; review required.');
  if(requests.count>=config.maxSourceRequests){const error=new BudgetReached('Source request limit reached.');deadline.abort(error);throw error;}
  requests.count++;state.source_requests++;const response=await fetcher(url,options);
  if(!response.ok)requests.failures.push(response.status);
  if(response.ok){const path=new URL(url).pathname,key=path+(path==='/api/v2/transactions/'?'|'+JSON.parse(options.body).award_id:'');if(path.startsWith('/api/v2/awards/')||path==='/api/v2/transactions/')rawResponses.set(key,await response.clone().json());}
  return response;
 }});
 const request=async(path,params)=>{ensure();const url=new URL('/api/'+path,'https://portfolio.internal');for(const [key,value]of Object.entries(params))if(value!==null&&value!==undefined)url.searchParams.set(key,value);return resolve(url,{OFFICES:directory,SOURCE_FETCH:paced,SIGNAL:deadline.signal});};
 const persist=async()=>{etag=await saveCheckpoint(store,state,etag);};
 let result,error;
 try{
  while(state.phase!=='publish'){
   ensure();
   if(state.phase==='changes'){
    must(state.page<=SETTINGS.maxChangedPages,'Changed-award page limit reached.');
    const end=state.source_end_utc,start=new Date(Date.parse(end+'T00:00:00Z')-config.lookbackDays*config.millisecondsPerDay).toISOString().slice(0,10);
    const body={filters:{award_type_codes:config.awardTypes,keywords:[SETTINGS.office],time_period:[{start_date:start,end_date:end,date_type:'last_modified_date'}]},fields:['Award ID','generated_internal_id','End Date'],limit:config.searchBatch,page:state.page,sort:'End Date',order:'desc'};
    if(state.cursor!==null){body.last_record_unique_id=Number(state.cursor);const value=String(state.sort_value);body.last_record_sort_value=/^-?\d+$/.test(value)?new Date(Number(value)).toISOString().slice(0,10):value;}
    const response=await paced('https://api.usaspending.gov/api/v2/search/spending_by_award/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:deadline.signal});
    must(response.ok,'Changed-award discovery failed: HTTP '+response.status);
    const data=await response.json();must(Array.isArray(data.results)&&typeof data.page_metadata?.hasNext==='boolean','Invalid changed-award response.');
    for(const row of data.results)if(String(row['Award ID']||'').startsWith(SETTINGS.office)&&validAwardID(row.generated_internal_id)){
     must(row.generated_internal_id.startsWith('CONT_AWD_'+SETTINGS.office),'Changed-award identity conflicts with its office.');state.changed[row.generated_internal_id]=true;
    }
    must(Object.keys(state.changed).length<=config.maxAwards,'Changed-award budget reached.');
    state.page++;state.cursor=data.page_metadata.last_record_unique_id??null;state.sort_value=data.page_metadata.last_record_sort_value??null;
    if(!data.page_metadata.hasNext){state.phase='discover';state.page=1;state.cursor=null;state.sort_value=null;}
    state.search_pages_since_checkpoint=(state.search_pages_since_checkpoint||0)+1;
    if(state.search_pages_since_checkpoint>=SETTINGS.checkpointEverySearchPages||state.phase==='discover'){state.search_pages_since_checkpoint=0;await persist();}
   }else if(state.phase==='discover'){
    const start=config.windows[state.window],data=await request('awards',{office:SETTINGS.office,start,page:state.page,cursor:state.cursor,sort_value:state.sort_value});
    state.candidate_scans=(state.candidate_scans||0)+data.candidates;must(state.candidate_scans<=SETTINGS.maxCandidates,'Discovery candidate limit reached.');
    const ids=new Set(state.windows[start]||[]);for(const row of data.rows){must(row.award_id.startsWith('CONT_AWD_'+SETTINGS.office),'Discovered award identity conflicts with its office.');ids.add(row.award_id);state.candidates[row.award_id]=row;}
    state.windows[start]=[...ids].sort(compare);must(Object.keys(state.candidates).length<=config.maxAwards,'Office award limit reached.');
    state.page++;state.cursor=data.cursor;state.sort_value=data.sort_value;
    if(!data.has_next){state.window++;state.page=1;state.cursor=null;state.sort_value=null;if(state.window===config.windows.length)state.phase='hydrate';}
    state.search_pages_since_checkpoint=(state.search_pages_since_checkpoint||0)+1;
    if(state.search_pages_since_checkpoint>=SETTINGS.checkpointEverySearchPages||!data.has_next){state.search_pages_since_checkpoint=0;await persist();}
   }else if(state.phase==='hydrate'){
    const old=new Map(base.tables.awards.map(row=>[row.generated_unique_award_id,row])),ids=Object.keys(state.candidates).sort(compare);
    if(state.hydrate_index===ids.length){state.phase='fiscal';await persist();continue;}
    const id=ids[state.hydrate_index],prior=old.get(id);
    if(state.mode==='backfill'||state.changed[id]||!prior||prior.details_unavailable){
     rawResponses.clear();let doc;
     try{const data=await request('award',{id});doc=await documentFor(data,rawResponses.get('/api/v2/awards/'+encodeURIComponent(id)+'/')||{},rawResponses.get('/api/v2/transactions/|'+id)||null,state.today);}
     catch(problem){
      if(problem.status!==404)throw problem;
      const row={...state.candidates[id],office_code:SETTINGS.office,office_name:directory.find(office=>office.code===SETTINGS.office).name,details_pending:false,details_unavailable:true,detail_error:problem.message};
      doc=await documentFor({award:row,history:null},{search_record:state.candidates[id]},null,state.today);
     }
     if(doc.source_hash!==prior?.source_hash)state.documents[id]=doc;
     state.hydrated_since_checkpoint=(state.hydrated_since_checkpoint||0)+1;
    }
    state.hydrate_index++;
    if(state.hydrated_since_checkpoint>=(state.mode==='backfill'?SETTINGS.backfillCheckpointEveryAwards:SETTINGS.checkpointEveryAwards)){state.hydrated_since_checkpoint=0;await persist();}
   }else if(state.phase==='fiscal'){
    if(state.month===state.months.length){state.phase='publish';state.publishing_at=new Date(now()).toISOString();await persist();continue;}
    const month=state.months[state.month],data=await request('fiscal',{office:SETTINGS.office,...month,page:state.fiscal_page});
    must(!data.has_next||state.fiscal_page<config.maxFiscalPages,'Fiscal month exceeds the existing paging limit.');
    state.fiscal_pages[month.start+'|'+String(state.fiscal_page).padStart(String(config.maxFiscalPages).length,'0')]=data;
    if(data.has_next)state.fiscal_page++;else{state.month++;state.fiscal_page=1;}
    state.fiscal_pages_since_checkpoint=(state.fiscal_pages_since_checkpoint||0)+1;
    if(state.fiscal_pages_since_checkpoint>=SETTINGS.checkpointEveryFiscalPages||state.month===state.months.length){state.fiscal_pages_since_checkpoint=0;await persist();}
   }else throw new Error('Unknown checkpoint phase.');
  }
  ensure();const tables=candidateTables(base.tables,state,{now});
  const published=await publishCandidate(store,base,state,tables,{now,beforePublish:async candidate=>{ensure();await beforePublish?.(candidate);ensure();}});state.status='completed';state.phase='done';result={status:'completed',...published};
 }catch(problem){
  error=problem;state.status=problem instanceof BudgetReached||deadline.signal.aborted?'yielded':'failed';result={status:state.status,error:problem.message};
 }finally{
  clearTimeout(timer);
  state.attempts.push({started_at:new Date(started).toISOString(),ended_at:new Date(now()).toISOString(),status:result?.status||'failed',source_requests:requests.count,http_failures:requests.failures});
  must(state.attempts.length<=SETTINGS.maxAuditRuns,'Audit limit reached; checkpoint retained.');
  await persist();
 }
 const summary={office:SETTINGS.office,mode:state.mode,phase:state.phase,work_id:state.work_id,source_requests:requests.count,total_source_requests:state.source_requests,discovered_awards:Object.keys(state.candidates).length,hydrated_changes:Object.keys(state.documents).length,...result};
 if(error&&result.status==='failed')throw Object.assign(new Error(error.message),{result:summary});return summary;
}

return {SETTINGS,CURRENT,loadPublication,candidateTables,publishCandidate,runR2Chunk};
}
export const {SETTINGS,CURRENT,loadPublication,candidateTables,publishCandidate,runR2Chunk}=createOfficeIngest(r2Profile(CONFIG.r2Pilot.office));
