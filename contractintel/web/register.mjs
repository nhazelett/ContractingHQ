import {currentDate} from './calendar.mjs';
import {contractEnd,daysRemaining} from './format.mjs';
export function selectRows(records,{q='',view='all',sort='contract_end',direction='asc',basis='current',today=currentDate()}={}){
 const query=q.trim().toLowerCase(),dateKey=basis==='potential'?'potential_end_date':'current_end_date';
 const rows=records.filter(r=>{
  if(query&&![r.piid,r.description,r.recipient].some(v=>String(v||'').toLowerCase().includes(query)))return false;
  const c=daysRemaining(r.current_end_date,today),p=daysRemaining(r.potential_end_date,today),d=daysRemaining(r[dateKey],today);
  if(view==='review')return c!==null&&c>=0||p!==null&&p>=0;
  if(view==='active')return c!==null&&c>=0;
  if(view==='potential_active')return p!==null&&p>=0;
  if(view==='verify')return (c===null||c<0)&&p!==null&&p>=0;
  if(view==='past')return c!==null&&c<0&&p!==null&&p<0;
  if(view==='date_review')return c===null||p===null||p<c;
  if(view==='unknown')return c===null;
  if(['90','180','365'].includes(view))return d!==null&&d>=0&&d<=Number(view);
  if(['1y','3y','5y'].includes(view))return r.latest_action_date&&r.latest_action_date>=String(Number(today.slice(0,4))-Number(view[0]))+today.slice(4);
  return true;
 });
 const sign=direction==='desc'?-1:1;
 const field={end:'current_end_date',potential:'potential_end_date',vendor:'recipient',action:'latest_action_date',piid:'piid',value:'award_amount_cents'}[sort];
 const value=r=>sort==='review'?(r.current_end_date>=today?r.current_end_date:r.potential_end_date>=today?r.potential_end_date:contractEnd(r)):r[field];
 rows.sort((a,b)=>{
  if(sort==='contract_end'){
   const x=contractEnd(a),y=contractEnd(b),group=d=>!d?2:d>=today?0:1,gx=group(x),gy=group(y);
   if(gx!==gy)return gx-gy;
   if(x!==y)return String(x||'').localeCompare(String(y||''))*(gx===1?-1:sign);
  }else{const x=value(a),y=value(b);if(x==null&&y!=null)return 1;if(y==null&&x!=null)return -1;if(x!=null&&y!=null){const cmp=sort==='value'?(BigInt(x)<BigInt(y)?-1:BigInt(x)>BigInt(y)?1:0):String(x).localeCompare(String(y));if(cmp)return cmp*sign;}}
  return a.piid.localeCompare(b.piid)||a.award_id.localeCompare(b.award_id);
 });return rows;
}

