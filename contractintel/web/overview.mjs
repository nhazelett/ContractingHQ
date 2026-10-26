import {currentDate} from './calendar.mjs';
import {daysRemaining} from './format.mjs';
export function fiscalYear(today=currentDate()){return Number(today.slice(0,4))+(Number(today.slice(5,7))>=10?1:0);}
export function fiscalMonths(today=currentDate()){
 const fy=fiscalYear(today),months=[];
 for(let year=fy-2;year<=Number(today.slice(0,4));year++)for(let month=1;month<=12;month++){
  const start=year+'-'+String(month).padStart(2,'0')+'-01';
  if(start<(fy-2)+'-10-01'||start>today)continue;
  const end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  months.push({start,end:end>today?today:end});
 }return months;
}
export function fiscalTotals(rows,today){
 const fy=fiscalYear(today),result=new Map([fy-1,fy].map(year=>[year,{year,cents:0n,awards:new Set(),missing:0}]));
 for(const row of rows){const bucket=result.get(fiscalYear(row.date));if(!bucket)continue;bucket.awards.add(row.award_id);if(row.cents===null)bucket.missing++;else bucket.cents+=BigInt(row.cents);}
 return [...result.values()];
}
export const setAsideLabel=row=>row.set_aside?.trim()||'Not reported';
export function setAsideGroups(rows){
 const groups=new Map();
 for(const row of rows){if(row.details_pending||row.details_unavailable)continue;const label=setAsideLabel(row);const g=groups.get(label)||{label,count:0,cents:0n,missing:0};g.count++;if(row.award_amount_cents==null)g.missing++;else g.cents+=BigInt(row.award_amount_cents);groups.set(label,g);}
 return [...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
}
export function endingCounts(rows,today){
 const ready=rows.filter(r=>!r.details_pending&&!r.details_unavailable),counts={90:0,180:0,365:0,recompetes:0};
 for(const r of ready){const current=daysRemaining(r.current_end_date,today),potential=daysRemaining(r.potential_end_date,today);for(const n of [90,180,365])if(current!==null&&current>=0&&current<=n)counts[n]++;if(potential!==null&&potential>=0&&potential<=365)counts.recompetes++;}
 return counts;
}
