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
export async function compareOffice({office='FA4528',directory,getSnapshot,fetcher=fetch,onProgress=()=>{},today=currentDate()}){
 if(!CONFIG.offices.includes(office))throw new Error('Comparison is restricted to FA4528.');
 const request=createSourceFetch({interval:CONFIG.sourceIntervalMs,fetcher});let requests=0;
 const api=async(path,params={})=>{const url=new URL('/api/'+path,'https://compare.internal');for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined)url.searchParams.set(k,v);requests++;return resolve(url,{OFFICES:directory,SOURCE_FETCH:request});};
 const awards=new Map(),windows=new Map();
 for(const start of CONFIG.windows){let page=1,cursor=null,sortValue=null,hasNext=true;const ids=[];
  while(hasNext){const data=await api('awards',{office,start,page,cursor,sort_value:sortValue});for(const row of data.rows){ids.push(row.award_id);if(!awards.has(row.award_id))awards.set(row.award_id,row);}hasNext=data.has_next;cursor=data.cursor;sortValue=data.sort_value;page++;}windows.set(start,[...new Set(ids)]);
 }
 let complete=0;for(const[id,row]of awards){try{awards.set(id,incorporatePortfolio(await api('award',{id})));}catch(error){if(error.status!==404)throw error;awards.set(id,{...row,details_pending:false,details_unavailable:true,detail_error:error.message});}complete++;if(complete%CONFIG.stageWriteBatch===0)onProgress({live_awards_complete:complete,live_awards_total:awards.size});}
 const fiscalRows=[];for(const month of fiscalMonths(today)){let page=1,hasNext=true;while(hasNext){const data=await api('fiscal',{office,...month,page});fiscalRows.push(...data.rows);hasNext=data.has_next;if(hasNext&&page>=CONFIG.maxFiscalPages)throw new Error('Fiscal source limit reached; comparison incomplete.');page++;}}
 const liveFiscal=fiscalTotals(fiscalRows,today).map(t=>({year:t.year,cents:String(t.cents),count:t.awards.size,missing:t.missing})),results=[],mismatches=[];
 for(const[start,ids]of windows){
  const snapshot=await getSnapshot(start),live=counts(ids.map(id=>awards.get(id)),today),stored=counts(snapshot.records,today),metrics=Object.keys(live).map(metric=>({metric,d1:stored[metric],live:live[metric],match:stored[metric]===live[metric]}));
  for(const t of liveFiscal){const d=snapshot.fiscal_totals.find(f=>f.year===t.year);for(const[label,key]of [['net_obligation_cents','cents'],['contract_count','count'],['missing_amounts','missing']])metrics.push({metric:'FY'+t.year+'_'+label,d1:d?.[key],live:t[key],match:d?.[key]===t[key]});}
  const storedIds=new Set(snapshot.records.map(r=>r.award_id)),liveIds=new Set(ids),identity={only_d1:[...storedIds].filter(id=>!liveIds.has(id)),only_live:ids.filter(id=>!storedIds.has(id))},differences=metrics.filter(m=>!m.match);
  if(differences.length||identity.only_d1.length||identity.only_live.length)mismatches.push({start,metrics:differences,...identity});results.push({start,publication_id:snapshot.publication_id,published_at:snapshot.published_at,metrics,...identity});
 }
 return {office,today,time_zone:CONFIG.timeZone,match:mismatches.length===0,source_calls_at_adapter:requests,windows:results,mismatches,note:'Active/upcoming includes date-review records; current_contracts subtracts date review. Expiring counts use existing evidence exclusions. Live data may change between ingestion and this independent scan.'};
}
