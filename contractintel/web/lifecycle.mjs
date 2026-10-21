import {daysRemaining} from './format.mjs';

// Planning classification only: performance dates do not establish actual closeout.
export function lifecycle(row,today=new Date().toISOString().slice(0,10)){
 const result=(kind,label,reason)=>({kind,label,reason,scope:kind==='completed'?'completed':'active'});
 if(row.details_pending)return result('review','Checking dates','Award details are still loading.');
 if(row.details_unavailable)return result('review','Dates need review','The source detail record is unavailable.');
 const current=daysRemaining(row.current_end_date,today),final=daysRemaining(row.potential_end_date,today),start=daysRemaining(row.start_date,today);
 if(current!==null&&final!==null&&final<current||start!==null&&(current!==null&&current<start||final!==null&&final<start))
  return result('review','Dates inconsistent','Reported dates conflict; completion cannot be inferred.');
 if(final!==null&&final<0)return result('completed','Potentially completed','Reported potential final end has passed. Review performance, acceptance, and closeout status.');
 if(current!==null&&current>=0)return result('upcoming','Active / upcoming','Within the reported current period of performance.');
 if(final!==null&&final>=0)return result('uncertain','Potentially ongoing','Potential final end is ahead; confirm whether options were exercised.');
 return result('review','Dates need review','The potential final end is missing. A past current end alone does not establish completion.');
}
export function lifecycleRows(rows,scope='active',today){return rows.filter(row=>lifecycle(row,today).scope===scope);}
