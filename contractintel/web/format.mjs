import {currentDate} from './calendar.mjs';
export function money(value, compact=false) {
  if (value===null || value===undefined) return 'Not reported';
  const cents=BigInt(value), negative=cents<0n, absolute=negative?-cents:cents;
  if(compact && absolute>=100000000n) return (negative?'−':'')+'$'+(Number(absolute)/100000000).toLocaleString('en-US',{maximumFractionDigits:2})+'M';
  if(compact && absolute>=100000n) return (negative?'−':'')+'$'+(Number(absolute)/100000).toLocaleString('en-US',{maximumFractionDigits:1})+'K';
  return (negative?'−':'')+'$'+(absolute/100n).toLocaleString('en-US')+'.'+String(absolute%100n).padStart(2,'0');
}
export function csvCell(value) {
  let text=String(value??'');
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text)&&!/^-[0-9]+(\.[0-9]+)?$/.test(text))) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function dollars(cents) {
  if(cents==null) return '';
  const n=BigInt(cents), a=n<0n?-n:n;
  return (n<0n?'-':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0');
}
export const text=value=>value===null||value===undefined||value===''?'Not reported':String(value);
export function coveredFiscalYear(dataset,fy){return dataset.coverage_start<=`${fy}-09-30`&&dataset.coverage_end>=`${fy-1}-10-01`;}
export function daysRemaining(endDate,today=currentDate()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(today))return null;
  const end=Date.parse(endDate+'T00:00:00Z'),start=Date.parse(today+'T00:00:00Z');
  if(!Number.isFinite(end)||!Number.isFinite(start)||new Date(end).toISOString().slice(0,10)!==endDate)return null;
  return Math.round((end-start)/86400000);
}
export function endLabel(endDate,today){
  const days=daysRemaining(endDate,today);
  return days===null?'Not reported':days<0?'Date passed':days===0?'Ends today':days===1?'1 day':days.toLocaleString()+' days';
}

export function portfolioStatus(row,today=currentDate()){
  const current=daysRemaining(row.current_end_date,today),potential=daysRemaining(row.potential_end_date,today);
  if(current!==null&&potential!==null&&potential<current)return 'Dates inconsistent';
  if(current!==null&&current>=0)return 'Within reported current PoP';
  if(potential!==null&&potential>=0)return 'Potentially ongoing — verify';
  if(current!==null&&potential!==null)return 'Reported dates passed';
  return 'Dates need review';
}

// Planning duration includes all reported options; current end stays separately visible.
export const contractEnd=row=>row.potential_end_date||row.current_end_date||null;
export const totalPop=row=>text(row.start_date)+' → '+text(row.potential_end_date);

