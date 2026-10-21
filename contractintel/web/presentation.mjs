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
function axis(){const n=node('div',undefined,'runway-axis');n.append(node('span','CONTRACT / AWARDEE'));const ticks=node('div',undefined,'axis-ticks');for(const label of ['Today','+90d','+180d','+270d','+365d'])ticks.append(node('span',label));n.append(ticks,node('span','ENDS IN'));return n;}
export function runwayRow({row,days},onOpen){
 const btn=node('button',undefined,'runway-row');btn.type='button';
 const label=node('span',undefined,'runway-label');label.append(node('strong',row.piid),node('span',text(row.recipient)));
 const track=node('span',undefined,'runway-track'),seg=runwaySegments(row),color=category(setAsideLabel(row)).color;
 if(seg.solid>0){const bar=node('span',undefined,'runway-solid');bar.style.width=seg.solid+'%';bar.style.background=color;track.append(bar);}
 if(seg.extension>0){const bar=node('span',undefined,'runway-potential'+(seg.beyond?' beyond':''));bar.style.left=seg.start+'%';bar.style.width=seg.extension+'%';bar.style.background=color;track.append(bar);}
 if(!seg.solid&&!seg.extension)track.append(node('span','Ends today','track-note'));
 const tooltipText=row.piid+' · '+text(row.recipient)+' | Current end: '+text(row.current_end_date)+' | Potential end: '+text(row.potential_end_date)+' | Current value: '+money(row.award_amount_cents);
 btn.setAttribute('aria-label',tooltipText);btn.title=tooltipText;
 btn.append(label,track,countdown(days),node('span',tooltipText,'runway-tooltip'));btn.addEventListener('click',()=>onOpen(row));return btn;
}
export function drawRunway(container,rows,onOpen,busy){
 if(!rows.length){empty(container,busy,'No reported upcoming ends in this dataset and date mode.');return;}
 const inner=node('div',undefined,'runway-inner');inner.append(axis());for(const row of rows)inner.append(runwayRow(row,onOpen));container.replaceChildren(inner);
}
export function drawLegend(container,rows){const groups=new Map();for(const r of rows){const c=category(setAsideLabel(r));groups.set(c.label,c);}
 container.replaceChildren();for(const c of groups.values()){const label=node('span',undefined,'legend-item'),dot=node('span',undefined,'swatch');dot.style.background=c.color;label.append(dot,node('span',c.label));container.append(label);}
}
export function drawSetAsides(container,rows,onSelect,busy,compact=false){
 const groups=setAsideGroups(rows);if(!groups.length){empty(container,busy,'No set-aside details available for this dataset.');return;}
 container.replaceChildren();const total=groups.reduce((n,g)=>n+g.count,0),stack=node('div',undefined,'set-aside-stack');stack.setAttribute('aria-label','Set-aside share by contract count');
 for(const g of groups){const b=node('button');b.style.flex=g.count;b.style.background=category(g.label).color;b.setAttribute('aria-label',g.label+': '+g.count+' contracts');b.title=g.label+': '+g.count+' contracts';b.addEventListener('click',()=>onSelect(g.label));stack.append(b);}container.append(stack);
 const list=node('div',undefined,compact?'set-aside-list compact':'set-aside-list');
 for(const g of groups){const b=node('button',undefined,'set-aside-row'),name=node('span',undefined,'category-name');name.append(swatch(g.label),node('span',g.label));b.append(name,node('strong',g.count.toLocaleString()+' · '+Math.round(g.count/total*100)+'%'),node('small',money(String(g.cents))+(g.missing?' · incomplete value':'')));b.addEventListener('click',()=>onSelect(g.label));list.append(b);}container.append(list);
}
export function valueTotal(entries){let sum=0n,missing=0;for(const {row}of entries){if(row.award_amount_cents==null)missing++;else sum+=BigInt(row.award_amount_cents);}return money(String(sum),true)+(missing?' · some values missing':'');}
