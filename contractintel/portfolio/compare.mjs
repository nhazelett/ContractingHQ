// Independent source scan: no D1 records construct the live side.
import {resolve} from '../web/source.mjs';
import {createSourceFetch} from '../web/source-requests.mjs';
import {incorporatePortfolio} from '../web/portfolio-progress.mjs';
import {expiryRows,scopeRows} from '../web/presentation.mjs';
import {fiscalMonths,fiscalTotals} from '../web/overview.mjs';
import {currentDate} from '../web/calendar.mjs';
import {CONFIG} from './ingest.mjs';
export function counts(rows,today){
 const active=scopeRows(rows,'active',today),review=scopeRows(rows,'review',today),result={total_awards:rows.length,active_upcoming:active.length,current_contracts:active.length-review.length,potentially_completed:scopeRows(rows,'completed',today).length,needs_date_review:review.length};
 for(const basis of ['current','potential'])for(const days of CONFIG.expiryWindows){result[basis+'_ending_'+days]=expiryRows(rows,basis,0,days,today).length;result[basis+'_active_ending_'+days]=expiryRows(active,basis,0,days,today).length;}
 result.recompete_candidates=expiryRows(active,'potential',0,CONFIG.recompeteDays,today).length;return result;
}
export async function compareOffice({office='FA4528',directory,getSnapshot,fetcher=fetch,sourceFetch,onProgress=()=>{},today,checkpoint,onCheckpoint=async()=>{},publicationKey='',now=Date.now}){
 if(!CONFIG.offices.includes(office))throw new Error('Comparison is restricted to FA4528.');
 const sourceDay=new Date(now()).toISOString().slice(0,10),fiscalToday=today||currentDate(now());
 const reusable=checkpoint?.version===CONFIG.schemaVersion&&checkpoint.office===office&&checkpoint.publication_key===publicationKey&&checkpoint.source_day===sourceDay&&checkpoint.fiscal_through===fiscalToday&&now()-Date.parse(checkpoint.started_at)>=0&&now()-Date.parse(checkpoint.started_at)<CONFIG.verificationCheckpointMs;
 const work=reusable?checkpoint:{version:CONFIG.schemaVersion,office,publication_key:publicationKey,source_day:sourceDay,fiscal_through:fiscalToday,started_at:new Date(now()).toISOString(),windows:[],candidates:[],awards:[],fiscal_rows:[],fiscal_index:0,requests:0};
 const request=sourceFetch||createSourceFetch({interval:CONFIG.sourceIntervalMs,fetcher,onRetry:info=>onProgress({source_retry:info})});
 const api=async(path,params={})=>{const url=new URL('/api/'+path,'https://compare.internal');for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined)url.searchParams.set(k,v);work.requests++;try{return await resolve(url,{OFFICES:directory,SOURCE_FETCH:request,SUMMARY_ONLY:path==='award'});}catch(error){onProgress({source_error:{path,status:error.status||null}});throw error;}};
 const awards=new Map(work.awards),candidates=new Map(work.candidates),windows=new Map(work.windows);
 const save=async()=>{work.awards=[...awards];work.candidates=[...candidates];work.windows=[...windows];work.updated_at=new Date(now()).toISOString();await onCheckpoint(work);};
 try{
  onProgress({verification_checkpoint:{resumed:!!reusable,source_awards_complete:awards.size,started_at:work.started_at}});
  for(const start of CONFIG.windows){if(windows.has(start))continue;let page=1,cursor=null,sortValue=null,hasNext=true;const ids=[];
   while(hasNext){const data=await api('awards',{office,start,page,cursor,sort_value:sortValue});for(const row of data.rows){ids.push(row.award_id);if(!candidates.has(row.award_id))candidates.set(row.award_id,row);}if(candidates.size>CONFIG.maxAwards)throw new Error('Comparison award guard reached.');hasNext=data.has_next;cursor=data.cursor;sortValue=data.sort_value;page++;}
   windows.set(start,[...new Set(ids)]);await save();
  }
  for(const[id,row]of candidates){if(awards.has(id))continue;
   try{awards.set(id,incorporatePortfolio(await api('award',{id})));}catch(error){if(error.status!==404)throw error;awards.set(id,{...row,details_pending:false,details_unavailable:true,detail_error:error.message});}
   if(awards.size%CONFIG.stageWriteBatch===0){await save();onProgress({live_awards_complete:awards.size,live_awards_total:candidates.size});}
  }
  await save();
  const months=fiscalMonths(fiscalToday);
  for(;work.fiscal_index<months.length;){const month=months[work.fiscal_index],monthRows=[];let page=1,hasNext=true;
   while(hasNext){const data=await api('fiscal',{office,...month,page});monthRows.push(...data.rows);hasNext=data.has_next;if(hasNext&&page>=CONFIG.maxFiscalPages)throw new Error('Fiscal source limit reached; comparison incomplete.');page++;}
   work.fiscal_rows.push(...monthRows);work.fiscal_index++;await save();
  }
  const liveFiscal=fiscalTotals(work.fiscal_rows,fiscalToday).map(t=>({year:t.year,cents:String(t.cents),count:t.awards.size,missing:t.missing})),results=[],mismatches=[];
  today=today||currentDate(now());
  for(const[start,ids]of windows){
   const snapshot=await getSnapshot(start),live=counts(ids.map(id=>awards.get(id)),today),stored=counts(snapshot.records,today),metrics=Object.keys(live).map(metric=>({metric,d1:stored[metric],live:live[metric],match:stored[metric]===live[metric]}));
   for(const t of liveFiscal){const d=snapshot.fiscal_totals.find(f=>f.year===t.year);for(const[label,key]of [['net_obligation_cents','cents'],['contract_count','count'],['missing_amounts','missing']])metrics.push({metric:'FY'+t.year+'_'+label,d1:d?.[key],live:t[key],match:d?.[key]===t[key]});}
   const storedIds=new Set(snapshot.records.map(r=>r.award_id)),liveIds=new Set(ids),identity={only_d1:[...storedIds].filter(id=>!liveIds.has(id)),only_live:ids.filter(id=>!storedIds.has(id))},differences=metrics.filter(m=>!m.match);
   if(differences.length||identity.only_d1.length||identity.only_live.length)mismatches.push({start,metrics:differences,...identity});results.push({start,publication_id:snapshot.publication_id,published_at:snapshot.published_at,metrics,...identity});
  }
  return {office,today,fiscal_through:fiscalToday,time_zone:CONFIG.timeZone,match:mismatches.length===0,source_calls_at_adapter:work.requests,source_started_at:work.started_at,source_finished_at:new Date(now()).toISOString(),resumed:!!reusable,windows:results,mismatches,note:'Active/upcoming includes date-review records; current_contracts subtracts date review. Expiring counts use existing evidence exclusions. The independent source scan can resume from source-only checkpoints for the same publication/day within its configured lifetime. No D1 rows construct live metrics. Live data may change during the scan.'};
 }catch(error){await save();throw error;}
}
