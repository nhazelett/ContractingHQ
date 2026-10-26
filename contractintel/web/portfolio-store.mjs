// Optional stored source. Failure always returns control to the existing live path.
export async function tryOfficeSnapshot({office,start,signal,fetcher=fetch,base='',origin=location.origin}){
 try{
  const url=new URL(base+'/api/office/'+encodeURIComponent(office),origin);url.searchParams.set('start',start);
  const response=await fetcher(url,{cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000)});
  if(!response.ok)return null;const data=await response.json();
  if(data.office!==office||data.start!==start||!['d1','r2'].includes(data.source)||data.complete!==true||!Array.isArray(data.records)||!Array.isArray(data.fiscal_totals)||data.records.some(r=>!r.award_id?.startsWith('CONT_AWD_'+office)||r.details_pending)||data.fiscal_totals.length!==2||data.fiscal_totals.some(t=>!Array.isArray(t.award_ids)||t.award_ids.length!==t.count))return null;
  return data;
 }catch{return null;}
}
export async function tryStoredEvidence({path,params,office,signal,fetcher=fetch,base='',origin=location.origin}){
 if(!['award','award-summary','history'].includes(path))return null;
 try{
  const url=new URL(base+'/api/office/'+office+'/award',origin);url.searchParams.set('id',params.id);url.searchParams.set('page',params.page||1);
  const response=await fetcher(url,{cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000)});if(!response.ok)return null;
  const data=await response.json();if(data.award?.award_id!==params.id||!Array.isArray(data.history?.actions))return null;
  return path==='history'?{...data.history,fetched_at:data.fetched_at}:data;
 }catch(error){if(signal?.aborted)throw error;return null;}
}
export function storedFiscal(data){return data.map(t=>({year:t.year,cents:BigInt(t.cents),awards:new Set(t.award_ids),missing:t.missing})).sort((a,b)=>a.year-b.year);}
export function freshnessLabel(value){return 'Updated '+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));}
