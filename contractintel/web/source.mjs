// Shared public-source adapter. No credentials or paid storage.
const SOURCE='https://api.usaspending.gov';
const TTL=21600;
export class ServiceError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const isoDate=value=>{const s=String(value??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;};
export function cents(value){const m=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value??'').trim());return m?String((m[1]?-1n:1n)*(BigInt(m[2])*100n+BigInt((m[3]||'').padEnd(2,'0')))):null;}
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
function number(value,def,max){if(value===null)return def;if(!/^\d+$/.test(value)||Number(value)<1||Number(value)>max)throw new ServiceError('Invalid page.');return Number(value);}
export function validAwardID(id){return typeof id==='string'&&id.length<=250&&/^CONT_AWD_[A-Z0-9][A-Z0-9._-]*$/.test(id);}
export function normalizeAward(data){
 const pop=data.period_of_performance||{},latest=data.latest_transaction_contract_data||{};
 return {award_id:data.generated_unique_award_id,piid:data.piid,description:data.description,recipient:data.recipient?.recipient_name,
 start_date:isoDate(pop.start_date),current_end_date:isoDate(pop.end_date),potential_end_date:isoDate(pop.potential_end_date),
 latest_action_date:isoDate(data.date_signed),last_modified_date:isoDate(pop.last_modified_date),
 award_amount_cents:cents(data.base_exercised_options),obligation_cents:cents(data.total_obligation),
 parent_piid:data.parent_award?.piid||null,source_url:'https://www.usaspending.gov/award/'+encodeURIComponent(data.generated_unique_award_id),
 competition:latest.extent_competed_description,pricing_type:latest.type_of_contract_pricing_description,set_aside:latest.type_set_aside_description};
}
export function normalizeAction(r){return {transaction_id:String(r.id),action_date:isoDate(r.action_date)||'',modification_number:r.modification_number||'',action_type_code:r.action_type||'',action_type:r.action_type_description||'',description:String(r.description||'').slice(0,1500),obligation_cents:cents(r.federal_action_obligation),reported_start:null,reported_current_end:null,reported_potential_end:null};}
async function upstream(env,path,body){
 let response;try{response=await (env.SOURCE_FETCH||env.UPSTREAM_FETCH||fetch)(SOURCE+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:env.SOURCE_FETCH?env.SIGNAL:env.SIGNAL?AbortSignal.any([env.SIGNAL,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});}catch(error){if(env.SIGNAL?.aborted)throw Object.assign(new Error('Request cancelled.'),{name:'AbortError'});throw new ServiceError('USAspending did not respond in time. Your loaded records are retained; retry shortly.',503);}
 if(response.status===404)throw new ServiceError('USAspending lists this award in search, but its detail record is not available yet. Try again later.',404);
 if(!response.ok)throw new ServiceError(response.status===429?'USAspending is busy or rate limited. Pause and retry shortly.':'USAspending is temporarily unavailable. Retry shortly.',response.status===429?429:503);
 try{return await response.json();}catch{throw new ServiceError('USAspending returned an unreadable response. Retry shortly.',503);}
}
export async function resolve(url,env){
 const offices=env.OFFICES||[],DIRECTORY=new Map(offices.map(o=>[o.code,o]));
 const p=url.searchParams;
 if(url.pathname==='/api/offices')return {offices,assignment:'PIID prefix',directory_note:'User-supplied FY22–26 office directory; labels retain the supplied confidence rating.'};
 if(url.pathname==='/api/status')return {mode:'On-demand public API',office_count:offices.length,source:'USAspending.gov',cache_hours:TTL/3600,r2_writes:false,background_import:false,notes:[
 'Office assignment uses the first six characters of the award PIID. Keyword search candidates are checked against that exact prefix.',
 'All 1,432 supplied office codes are selectable. Availability depends on public source coverage; this is not a certification of a complete department-wide inventory.',
 'Public award data is requested directly by your browser, with no API key. Only offices selected in this browser are loaded. No overnight import or R2 archive is used.',
 'The selected search window covers reported actions. Earlier awards with no action in that window may be absent. Public DoD reporting is delayed.',
 'Dates and values come from the award API. Potential ends include options that may not have been exercised.',
 'The public transaction API supplies option-exercise codes but not per-mod PoP dates. A confirmed option exercise does not by itself establish a PoP change.',
 'Opening an office starts a fresh source scan. Up to three small metadata snapshots can be kept on this device while fresh records load; saved rows are marked Updating. Contract summaries load before transaction evidence. Register, end-date, and set-aside counts cover available records. Fiscal cards use a separate prior/current FY transaction scan and stay blank until it completes.'
 ]};
 if(url.pathname==='/api/fiscal'){
  const office=p.get('office'),start=isoDate(p.get('start')),end=isoDate(p.get('end'));
  if(!DIRECTORY.has(office)||!start||!end||end<start||start.slice(0,7)!==end.slice(0,7))throw new ServiceError('Invalid fiscal query.');
  const page=number(p.get('page'),1,100);
  const data=await upstream(env,'/api/v2/search/spending_by_transaction/',{filters:{award_type_codes:['A','B','C','D'],keywords:[office+'*'],time_period:[{start_date:start,end_date:end}]},fields:['Award ID','Mod','Action Date','Transaction Amount','generated_internal_id','internal_id'],limit:100,page,sort:'Action Date',order:'desc'});
  if(!Array.isArray(data.results)||typeof data.page_metadata?.hasNext!=='boolean')throw new ServiceError('Unexpected fiscal response.',503);
  const rows=data.results.filter(r=>String(r['Award ID']||'').toUpperCase().startsWith(office)).map(r=>{
   const date=isoDate(r['Action Date']),id=r.generated_internal_id;
   if(!validAwardID(id)||!date||date<start||date>end)throw new ServiceError('Invalid fiscal record; totals remain incomplete.',503);
   return {award_id:id,date,cents:cents(r['Transaction Amount'])};
  });
  return {rows,has_next:data.page_metadata.hasNext,page};
 }
 if(url.pathname==='/api/awards'){
  const office=p.get('office');if(!DIRECTORY.has(office))throw new ServiceError('Select an office from the directory.');
  const start=p.get('start')||'2021-10-01';if(!['2007-10-01','2021-10-01','2024-10-01','2025-10-01'].includes(start))throw new ServiceError('Invalid search window.');
  const page=number(p.get('page'),1,100000),today=new Date().toISOString().slice(0,10);
  const body={filters:{award_type_codes:['A','B','C','D'],keywords:[office],time_period:[{start_date:start,end_date:today}]},fields:['Award ID','Recipient Name','Description','Start Date','End Date','Award Amount','generated_internal_id','Last Modified Date'],limit:100,page,sort:'End Date',order:'desc'};
  const cursor=p.get('cursor'),sortValue=p.get('sort_value');
  if(cursor!==null||sortValue!==null){if(!/^\d{1,16}$/.test(cursor||'')||!(/^-?\d{1,20}$/.test(sortValue||'')||isoDate(sortValue)===sortValue||sortValue==='None'))throw new ServiceError('Invalid search cursor.');body.last_record_unique_id=Number(cursor);const timestamp=/^-?\d+$/.test(sortValue)?new Date(Number(sortValue)):null;if(timestamp&&!Number.isFinite(timestamp.getTime()))throw new ServiceError('Invalid search cursor.');body.last_record_sort_value=timestamp?isoDate(timestamp.toISOString()):sortValue;}
  if(page>100&&!cursor)throw new ServiceError('A search cursor is required to continue beyond 10,000 candidates.');
  const data=await upstream(env,'/api/v2/search/spending_by_award/',body);
  if(!Array.isArray(data.results)||typeof data.page_metadata?.hasNext!=='boolean')throw new ServiceError('USAspending returned an unexpected search response.',503);
  const matches=data.results.filter(r=>String(r['Award ID']||'').toUpperCase().startsWith(office)&&validAwardID(r.generated_internal_id));
  return {office,start,end:today,page,has_next:data.page_metadata.hasNext,cursor:data.page_metadata.last_record_unique_id??null,sort_value:data.page_metadata.last_record_sort_value??null,candidates:data.results.length,excluded:data.results.length-matches.length,fetched_at:new Date().toISOString(),rows:matches.map(r=>({award_id:r.generated_internal_id,piid:r['Award ID'],description:r.Description,recipient:r['Recipient Name'],start_date:isoDate(r['Start Date']),current_end_date:isoDate(r['End Date']),potential_end_date:null,award_amount_cents:null,details_pending:true}))};
 }
 if(['/api/award','/api/history'].includes(url.pathname)){
  const id=p.get('id');if(!validAwardID(id))throw new ServiceError('Invalid contract award identifier.');
  const prefix=id.slice('CONT_AWD_'.length,'CONT_AWD_'.length+6);if(!DIRECTORY.has(prefix))throw new ServiceError('Award prefix is not in the office directory.');
  const page=number(p.get('page'),1,1000);
  const history=async()=>{const data=await upstream(env,'/api/v2/transactions/',{award_id:id,limit:200,page,sort:'action_date',order:'desc'});if(!Array.isArray(data.results)||typeof data.page_metadata?.hasNext!=='boolean')throw new ServiceError('USAspending returned an unexpected history response.',503);return {actions:data.results.map(normalizeAction),has_next:data.page_metadata.hasNext,page};};
  if(url.pathname==='/api/history')return {...await history(),fetched_at:new Date().toISOString()};
  // Browser scan can request core fields first; default public award responses retain history.
  const [data,hist]=await Promise.all([upstream(env,'/api/v2/awards/'+encodeURIComponent(id)+'/'),env.SUMMARY_ONLY?null:history()]);
  if(data.generated_unique_award_id!==id||!String(data.piid||'').startsWith(prefix))throw new ServiceError('The source award identity could not be verified.',503);
  return {award:{...normalizeAward(data),office_code:prefix,office_name:DIRECTORY.get(prefix).name},history:hist,fetched_at:new Date().toISOString()};
 }
 throw new ServiceError('Unknown endpoint.',404);
}

