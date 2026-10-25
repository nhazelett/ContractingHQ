import {daysRemaining,money,text} from './format.mjs';
import {lifecycle} from './lifecycle.mjs';
import {setAsideLabel,setAsideGroups} from './overview.mjs';

export const scopeNames={active:'Active / upcoming',completed:'Potentially completed',review:'Needs date review',all:'All contracts'};
export function scopeRows(rows,scope,today){return rows.filter(r=>scope==='all'||(scope==='review'?lifecycle(r,today).kind==='review':lifecycle(r,today).scope===scope));}
export function category(label){
 const s=label.toUpperCase();
 if(s==='NOT REPORTED')return {color:'#898781',label:'Not reported'};
 if(s.includes('SERVICE DISABLED')||s.includes('SDVOSB'))return {color:'#eda100',label:'SDVOSB'};
 if(s.includes('WOMEN')||s.includes('WOSB'))return {color:'#e87ba4',label:'Women-owned'};
 if(s.includes('8(A)')||s.includes('8A '))return {color:'#1baf7a',label:'8(a)'};
 if(s.includes('HUBZONE'))return {color:'#898781',label:'HUBZone'};
 if(s.includes('NO SET ASIDE'))return {color:'#eb6834',label:'No set-aside used'};
 if(s.includes('SMALL BUSINESS SET ASIDE'))return {color:'#2a78d6',label:'Small business'};
 return {color:'#898781',label:'Other'};
}
export function expiryRows(rows,basis='current',min=0,max=365,today){
 const key=basis==='potential'?'potential_end_date':'current_end_date';
 return rows.filter(r=>!r.details_pending&&!r.details_unavailable&&lifecycle(r,today).kind!=='review')
  .map(row=>({row,days:daysRemaining(row[key],today)})).filter(r=>r.days!==null&&r.days>=min&&r.days<=max)
  .sort((a,b)=>a.days-b.days||a.row.piid.localeCompare(b.row.piid));
}
export function runwaySegments(row,today){
 const current=daysRemaining(row.current_end_date,today),potential=daysRemaining(row.potential_end_date,today);
 if(lifecycle(row,today).kind==='review')return {solid:0,extension:0,start:0,beyond:false};
 const solid=Math.max(0,Math.min(365,current??0));
 return {solid:solid/365*100,start:solid/365*100,extension:Math.max(0,Math.min(365,potential??0)-solid)/365*100,beyond:potential>365};
}
const node=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(cls)n.className=cls;return n;};
export function countdown(days){return node('span',days===null?'—':days<0?'Passed':days===0?'Today':days+'d','countdown '+(days!==null&&days>=0&&days<=90?'urgent':days>90&&days<=180?'soon':''));}
export function swatch(label){const n=node('span',undefined,'swatch');n.style.background=category(label).color;return n;}
export function empty(container,busy,message){container.replaceChildren();if(busy){const n=node('div',undefined,'skeletons');n.setAttribute('aria-label','Loading contract details');for(let i=0;i<3;i++)n.append(node('span',undefined,'skeleton'));container.append(n);}container.append(node('p',busy?'Loading records — results appear as details arrive.':message,'empty'));}
export function drawContracts(container,entries,basis,onOpen,busy,{expanded,detailFor}={}){
 if(!entries.length){empty(container,busy,'No reported upcoming ends in this dataset and date mode.');return;}
 const wrap=node('div',undefined,'contracts-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label','Scrollable upcoming contracts');
 const table=node('table',undefined,'contracts-table'),thead=node('thead'),head=node('tr');
 table.setAttribute('aria-label','Upcoming contracts by requirement');
 for(const label of ['Ends in','Requirement / PIID','Awardee',basis==='potential'?'Potential final end':'Current PoP end','Current value','Set-aside']){const th=node('th',label);th.scope='col';head.append(th);}thead.append(head);table.append(thead);
 const body=node('tbody');
 for(const {row,days}of entries){
  const tr=node('tr'),ends=node('td'),requirement=node('td',undefined,'contract-requirement'),button=node('button',text(row.description)==='Not reported'?'Description not reported':text(row.description),'requirement-link');
  button.type='button';button.dataset.award=row.award_id;button.title=text(row.description);button.setAttribute('aria-label',(row.description||'Description not reported')+' · '+row.piid);
  if(expanded){button.setAttribute('aria-expanded',String(expanded.has(row.award_id)));button.setAttribute('aria-controls','evidence-'+row.award_id);}
  button.addEventListener('click',()=>onOpen(row));
  requirement.append(button,node('span',row.piid,'requirement-piid'));if(row.source_refresh_pending)requirement.append(node('span','Updating','refresh-badge'));
  ends.append(countdown(days));const setAside=node('td'),label=setAsideLabel(row);setAside.append(swatch(label),node('span',' '+label));
  tr.append(ends,requirement,node('td',text(row.recipient)),node('td',text(row[basis==='potential'?'potential_end_date':'current_end_date']),'mono'),node('td',money(row.award_amount_cents),'money'),setAside);
  tr.addEventListener('click',e=>{if(!e.target.closest('button'))onOpen(row);});body.append(tr);
  if(expanded){const detailRow=node('tr');detailRow.id='evidence-'+row.award_id;detailRow.hidden=!expanded.has(row.award_id);const cell=node('td');cell.colSpan=6;cell.className='expanded-evidence';if(!detailRow.hidden&&detailFor)cell.append(detailFor(row));detailRow.append(cell);body.append(detailRow);}
 }
 table.append(body);wrap.append(table);container.replaceChildren(wrap);
}
export function drawSetAsides(container,rows,onSelect,busy,compact=false){
 const groups=setAsideGroups(rows);if(!groups.length){empty(container,busy,'No set-aside details available for this dataset.');return;}
 container.replaceChildren();const total=groups.reduce((n,g)=>n+g.count,0),stack=node('div',undefined,'set-aside-stack');stack.setAttribute('aria-label','Set-aside share by contract count');
 for(const g of groups){const b=node('button');b.style.flex=g.count;b.style.background=category(g.label).color;b.setAttribute('aria-label',g.label+': '+g.count+' contracts');b.title=g.label+': '+g.count+' contracts';b.addEventListener('click',()=>onSelect(g.label));stack.append(b);}container.append(stack);
 const list=node('div',undefined,compact?'set-aside-list compact':'set-aside-list');
 for(const g of groups){const b=node('button',undefined,'set-aside-row'),name=node('span',undefined,'category-name');name.append(swatch(g.label),node('span',g.label));b.append(name,node('strong',g.count.toLocaleString()+' · '+Math.round(g.count/total*100)+'%'),node('small',money(String(g.cents))+(g.missing?' · incomplete value':'')));b.addEventListener('click',()=>onSelect(g.label));list.append(b);}container.append(list);
}
export function valueTotal(entries){let sum=0n,missing=0;for(const {row}of entries){if(row.award_amount_cents==null)missing++;else sum+=BigInt(row.award_amount_cents);}return money(String(sum),true)+(missing?' · some values missing':'');}
