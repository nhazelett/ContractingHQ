import {summariesComplete,portfolioComplete} from './portfolio-progress.mjs';
export async function scanPortfolio({state,api,hydrateEvidence,incorporate,selectRows,sleep,render,progress,queueSave,saveNow=queueSave,failure,clearError,now=Date.now}){
 if(state.busy||portfolioComplete(state))return;
 const generation=state.generation,signal=state.controller.signal;state.busy=true;state.paused=false;clearError();progress();
 try{
  while(!state.paused&&!summariesComplete(state)){
   if(!state.pending.length&&state.hasNext){
    const data=await api('awards',{office:state.office,start:state.window,page:state.page,cursor:state.cursor,sort_value:state.sortValue},signal);
    if(generation!==state.generation)return;
    state.page++;state.cursor=data.cursor;state.sortValue=data.sort_value;state.hasNext=data.has_next;state.candidates+=data.candidates;state.excluded+=data.excluded;state.checked=data.fetched_at;
    for(const row of data.rows)if(!state.records.has(row.award_id)){state.records.set(row.award_id,row);state.pending.push(row.award_id);}state.pending=selectRows(state.pending.map(id=>state.records.get(id)),{sort:'contract_end'}).map(r=>r.award_id);render();
   }
   const results=[];
   for(const id of state.pending.slice(0,2)){await sleep(Math.max(0,700-(now()-state.lastRequest)));if(generation!==state.generation||state.paused)break;state.lastRequest=now();results.push(api('award-summary',{id},signal).then(data=>({id,data}),error=>({id,error})));}
   const batch=await Promise.all(results);if(generation!==state.generation)return;
   let error;
   for(const result of batch){
    if(result.error){if(result.error.status===404){state.records.set(result.id,{...state.records.get(result.id),details_pending:false,details_unavailable:true,detail_error:result.error.message});state.pending=state.pending.filter(id=>id!==result.id);}else error=result.error;continue;}
    state.records.set(result.id,incorporate(result.data));if(state.cache.size>=500)state.cache.delete(state.cache.keys().next().value);state.cache.set(result.id,result.data);state.pending=state.pending.filter(id=>id!==result.id);if(!state.evidencePending.includes(result.id))state.evidencePending.push(result.id);
   }
   if(summariesComplete(state))state.preview.clear();queueSave();render();if(error)throw error;
  }
  if(summariesComplete(state))state.preview.clear();
  while(!state.paused&&state.evidencePending.length){
   const results=[];
   for(const id of state.evidencePending.slice(0,2)){await sleep(Math.max(0,700-(now()-state.lastRequest)));if(generation!==state.generation||state.paused)break;state.lastRequest=now();results.push(hydrateEvidence(id,signal).then(()=>null,error=>error));}
   const batch=await Promise.all(results);if(generation!==state.generation)return;render();const error=batch.find(Boolean);if(error)throw error;
  }
 }catch(error){if(error.name!=='AbortError'&&generation===state.generation){state.paused=true;failure(error);}}
 finally{if(generation===state.generation){state.busy=false;saveNow();render();}}
}

