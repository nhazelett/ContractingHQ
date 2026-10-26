import {daysRemaining,money,text} from './format.mjs';
import {lifecycle} from './lifecycle.mjs';
const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
export const datasetNames={active:'Current contracts',completed:'Potentially completed',review:'Dates unclear',all:'All contracts'};
export const endName=basis=>basis==='potential'?'Could end as late as':'Contract ends';
export const endHelp=basis=>basis==='potential'?'Includes unexercised options; not a confirmed schedule':'Reported current period of performance end';
export const fieldNames={description:'Requirement',recipient:'Vendor',current_end_date:'Contract ends',potential_end_date:'Could end as late as',set_aside:'Who can bid',obligation_cents:'Money spent',days_left:'Time remaining',award_amount_cents:'Current value'};
export function whoCanBid(source){
 const value=String(source||'Not reported'),s=value.toUpperCase().replace(/[_-]/g,' ');
 if(s==='NOT REPORTED')return 'Not reported';
 if(/NO SET\s*ASIDE/.test(s))return 'No set-aside listed';
 if(/SERVICE.?DISABLED|SDVOSB/.test(s))return 'Service-disabled veteran-owned';
 if(/ECONOMICALLY.*WOM|EDWOSB/.test(s))return 'Economically disadvantaged women-owned';
 if(/WOM[AE]N|WOSB/.test(s))return 'Women-owned small businesses';
 if(/HUBZONE/.test(s))return 'HUBZone businesses';
 if(/8\s*\(?A\)?/.test(s))return '8(a) businesses';
 if(/PARTIAL.*SMALL BUSINESS/.test(s))return 'Partly reserved for small businesses';
 if(/SMALL BUSINESS.*SET\s*ASIDE/.test(s))return 'Small businesses only';
 return value;
}
export function biddingLabel(source){const n=el('span',whoCanBid(source));n.title='Source set-aside: '+(source||'Not reported')+(/NO SET\s*ASIDE/i.test(source||'')?'. This does not establish full and open competition.':'');return n;}
export function dateText(value,brief=false){if(!value)return 'Not reported';const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-US',{month:'short',...(brief?{}:{day:'numeric'}),year:'numeric',timeZone:'UTC'}).format(d):String(value);}
export function datePresentation(row,basis,countdown){
 const box=el('div',undefined,'contract-date'),potential=basis==='potential',key=potential?'potential_end_date':'current_end_date',other=potential?'current_end_date':'potential_end_date',line=el('div',undefined,'primary-date'),date=el('span',dateText(row[key]));
 date.title=endHelp(basis)+(row[key]?' · '+row[key]:'');line.append(date);
 if(countdown)line.append(countdown(lifecycle(row).kind==='review'?null:daysRemaining(row[key])));box.append(line);
 if(row[other]&&row[other]!==row[key]){const note=el('small',(potential?'Current period ends ':'Could run to ')+dateText(row[other],true),'secondary-date');note.title=(potential?endHelp('current'):endHelp('potential'))+' · '+row[other];box.append(note);}
 return box;
}
export function simpleContractCells(row,basis,onOpen,countdown,tag='td'){
 const description=el(tag,undefined,'simple-requirement'),a=el('a',row.description||'Description not reported','requirement-link');a.href='#register?award='+encodeURIComponent(row.award_id);a.title=row.description||'Description not reported';a.dataset.award=row.award_id;a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onOpen(row);});description.append(a);
 const number=el('span',undefined,'contract-number');number.title='Contract number (PIID), as reported by USAspending';number.append(el('span','Contract #: ','contract-number-label'),el('span',row.piid||'Not reported','contract-number-value'));description.append(number);
 if(row.source_refresh_pending)description.append(el('span','Updating','refresh-badge'));
 const life=lifecycle(row);if(life.kind==='review'||life.kind==='uncertain'||life.kind==='completed'){const badge=el('small',life.kind==='review'?'Dates unclear':life.label,'lifecycle-badge');badge.title=life.reason;description.append(badge);}
 const vendor=el(tag,text(row.recipient),'simple-vendor'),date=el(tag,undefined,'simple-date'),value=el(tag,row.details_pending?'Loading…':row.details_unavailable?'Unavailable':money(row.award_amount_cents),'simple-value');date.append(datePresentation(row,basis,countdown));
 const cells=[description,vendor,date,value];for(const [i,label]of ['Requirement','Vendor',endName(basis),'Current value'].entries()){cells[i].dataset.label=label;if(tag!=='td')cells[i].setAttribute('role','cell');}return cells;
}
export function renderSimpleRegister({state,ui,total,basis,onOpen,countdown}){
 const $=id=>document.getElementById(id),focused=document.activeElement?.dataset.award,pages=Math.max(1,Math.ceil(state.rows.length/ui.pageSize));ui.page=Math.min(ui.page,pages-1);
 $('dataset-empty').hidden=state.rows.length>0;$('dataset-empty').textContent=state.busy?'Loading — matching contracts appear as details arrive.':'No contracts match this dataset and the All contracts filters.';
 $('table-head').style.gridTemplateColumns='';$('table-head').replaceChildren(...['Requirement','Vendor',endName(basis),'Current value'].map(label=>{const n=el('div',label);n.setAttribute('role','columnheader');return n;}));$('virtual-table').setAttribute('aria-rowcount',state.rows.length+1);$('table-space').style.height='auto';$('table-rows').replaceChildren();
 const first=ui.page*ui.pageSize,last=Math.min(state.rows.length,first+ui.pageSize);
 for(let i=first;i<last;i++){const row=state.rows[i],life=lifecycle(row),div=el('div',undefined,'data-row simple-row lifecycle-'+life.kind+(ui.selected===row.award_id?' selected':''));div.setAttribute('role','row');div.setAttribute('aria-rowindex',i+2);div.setAttribute('aria-label',row.piid+' · '+life.label);div.append(...simpleContractCells(row,basis,onOpen,countdown,'div'));div.addEventListener('click',e=>{if(!e.target.closest('a'))onOpen(row);});$('table-rows').append(div);}
 $('award-count').textContent=state.rows.length.toLocaleString()+' matches';$('register-summary').textContent=state.rows.length.toLocaleString()+' of '+total.toLocaleString()+' available contracts match · '+datasetNames[state.scope]+' · '+endName(basis);
 $('table-state').textContent=state.rows.length?(first+1)+'–'+last+' of '+state.rows.length.toLocaleString():'0 results';$('page-number').textContent='Page '+(ui.page+1)+' / '+pages;$('previous-page').disabled=ui.page===0;$('next-page').disabled=ui.page>=pages-1;
 if(focused)[...$('table-rows').querySelectorAll('a')].find(n=>n.dataset.award===focused)?.focus({preventScroll:true});
}
export function settingsChips(){
 const $=id=>document.getElementById(id),box=$('active-settings');box.replaceChildren();
 for(const [id,defaultValue,name]of [['dataset','active','Dataset'],['window','2021-10-01','History'],['date-basis','current','End dates']]){
  const input=$(id),value=input.value,label=id==='dataset'?datasetNames[value]:id==='date-basis'?endName(value):input.selectedOptions[0]?.textContent||value,chip=el('span',undefined,'setting-chip');chip.append(el('span',label));chip.title=id==='date-basis'?endHelp(value):name+': '+label;
  if(value!==defaultValue){const clear=el('button','×');clear.type='button';clear.setAttribute('aria-label','Reset '+name.toLowerCase()+' to default');clear.addEventListener('click',()=>{input.value=defaultValue;input.dispatchEvent(new Event('change',{bubbles:true}));});chip.append(clear);}box.append(chip);
 }
}
export function wirePanel(triggerId,dialogId,closeId){
 const trigger=document.getElementById(triggerId),dialog=document.getElementById(dialogId),close=document.getElementById(closeId);
 const hide=()=>dialog.close();trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();trigger.setAttribute('aria-expanded','true');});close.addEventListener('click',hide);dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});
}
export function revealOffice(){
 const $=id=>document.getElementById(id);$('header-office-slot').append($('office-controls'));$('office-welcome').hidden=true;$('portfolio-workspace').hidden=false;$('primary-navigation').hidden=false;$('office-dropdown').hidden=false;$('loading-rail').hidden=false;document.documentElement.dataset.officeReady='true';
}
export async function welcomeOffice(){
 const $=id=>document.getElementById(id);$('welcome-office-slot').replaceChildren($('office-controls'));$('welcome-office-go').disabled=false;$('office-search').focus();
 await new Promise(resolve=>{const form=$('welcome-office-form'),choose=e=>{e.preventDefault();if(!$('office').value)return;form.removeEventListener('submit',choose);revealOffice();resolve();};form.addEventListener('submit',choose);});
}

export function compactLoading(){
 const status=document.getElementById('freshness'),full=status.textContent,match=full.match(/^(.*?)(, [\d,]+ contracts so far| · [\d,]+ contracts loaded)$/);status.title=full;status.replaceChildren(el('span',match?match[1]:full,'loading-message'));if(match)status.append(el('span',match[2],'loading-count'));
}
