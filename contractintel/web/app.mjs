import {scopeNames,scopeRows,category,expiryRows,countdown,swatch,drawContracts,drawSetAsides,valueTotal,empty} from './presentation.mjs';
import {money,csvCell,dollars,text,daysRemaining,endLabel,portfolioStatus,contractEnd,totalPop} from './format.mjs';
import {summarizeModifications} from './modifications.mjs';
import {selectRows} from './register.mjs';
import {createSourceFetch} from './source-requests.mjs';
import {lifecycle,lifecycleRows} from './lifecycle.mjs';
import {resolve as sourceResolve} from './source.mjs';
import {fiscalYear,fiscalMonths,fiscalTotals,setAsideLabel,setAsideGroups,endingCounts} from './overview.mjs';
const sourceCache=new Map();
const sourceFetch=createSourceFetch({onRetry:({delay})=>{$('source-retry').textContent='USAspending is busy. Automatically retrying after '+Math.ceil(delay/1000)+' seconds; loaded records are retained.';}});
let fiscal={};
const $=id=>document.getElementById(id);
const API=location.hostname==='127.0.0.1'||location.hostname==='localhost'?'':'https://kthq-contractintel.nickhazelett.workers.dev';
const state={scope:'active',office:'FA4800',directory:[],records:new Map(),rows:[],pending:[],page:1,cursor:null,sortValue:null,hasNext:true,busy:false,paused:false,generation:0,direction:'asc',controller:null,candidates:0,excluded:0,cache:new Map(),lastRequest:0,checked:null};
const fields=[['piid','PIID','145px'],['description','Requirement','minmax(195px,1fr)'],['award_amount_cents','Award Amount','140px'],['latest_mod_number','Latest Mod #','110px'],['latest_option_mod_number','Latest option Mod','145px'],['current_end_date','Current PoP end','130px'],['total_pop','Total contract PoP','200px'],['days_left','Days until contract ends','175px'],['recipient','Awardee','155px'],['set_aside','Set-aside','200px'],['latest_action_date','Latest source action','145px'],['status','Date status','205px'],['start_date','PoP start','115px'],['potential_end_date','Potential final end','145px'],['obligation_cents','Source net obligations','155px']];
const defaultColumns=['days_left','description','piid','recipient','set_aside','current_end_date','potential_end_date','award_amount_cents','latest_action_date'];
const visible=new Set(defaultColumns);
const ui={tab:'overview',page:0,pageSize:50,selected:null,expanded:new Set(),expiryLimit:50};
let detailGeneration=0;
function el(tag,content,className){const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(className)n.className=className;return n;}
function failure(error){$('error').hidden=false;$('error').textContent=error.message;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,params={},signal){const u=new URL(API+'/api/'+path,location.origin);for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined)u.searchParams.set(k,v);if(['awards','award','history','fiscal'].includes(path)){const key=u.href,cached=sourceCache.get(key);if(cached&&Date.now()-cached.time<21600000)return cached.data;const data=await sourceResolve(u,{OFFICES:state.directory,SIGNAL:signal,SOURCE_FETCH:sourceFetch});if(sourceCache.size>=250)sourceCache.delete(sourceCache.keys().next().value);sourceCache.set(key,{time:Date.now(),data});$('source-retry').textContent='';return data;}const r=await fetch(u,{signal});let data;try{data=await r.json();}catch{throw new Error('The data service did not return a readable response.');}if(!r.ok)throw Object.assign(new Error(data.error||'The data service is unavailable.'),{status:r.status});return data;}
function query(){return {q:$('search').value,view:$('view').value,sort:$('sort').value,direction:state.direction,basis:$('date-basis').value};}
function startDialog(title,kicker='SOURCE EVIDENCE'){$('detail-title').textContent=title;$('detail-kicker').textContent=kicker;$('detail-body').replaceChildren(el('p','Loading…','muted'));if(!$('detail').open)$('detail').showModal();return ++detailGeneration;}
function controls(){const done=!state.hasNext&&!state.pending.length;$('continue').disabled=state.busy||done;$('continue').textContent=done?'Portfolio loaded':state.busy?'Loading portfolio…':'Resume loading';$('continue').hidden=state.busy||done;$('pause').disabled=!state.busy;$('load-more').hidden=done||state.busy;$('load-more').disabled=state.busy;$('export').disabled=!state.records.size;$('retry-missing').hidden=![...state.records.values()].some(r=>r.details_unavailable);$('retry-missing').disabled=state.busy;}
function progress(){
 const all=[...state.records.values()],ready=all.filter(r=>!r.details_pending&&!r.details_unavailable).length,missing=all.filter(r=>r.details_unavailable).length,complete=!state.hasNext&&!state.pending.length,o=state.directory.find(o=>o.code===state.office);
 $('office-label').textContent=state.office+' · '+(o?.name||'Select office')+(o?.base?' · '+o.base:'');
 $('freshness').textContent=(state.busy?(state.paused?'Pausing':'Loading portfolio'):complete?'Search complete':state.paused?'Paused':'Ready')+' · '+ready.toLocaleString()+' contracts loaded';
 $('coverage').textContent=(state.busy?'Loading — counts cover loaded records. ':complete?'Search complete for selected window. ':'Counts cover loaded records. ')+ready.toLocaleString()+' detailed / '+all.length.toLocaleString()+' matching awards'+(missing?' · '+missing+' unavailable details':'')+' · '+state.candidates.toLocaleString()+' candidates checked';
 if(state.busy&&!complete)$('progress').removeAttribute('value');else $('progress').value=complete?100:0;
 $('progress').hidden=!state.busy;renderLoadingNotice();controls();if(state.busy&&!state.records.size)renderOverview();
}
function renderLoadingNotice(){
 const portfolioComplete=!state.hasNext&&!state.pending.length,fiscalComplete=fiscal.index===fiscal.months?.length;
 $('loading-notice').hidden=portfolioComplete&&fiscalComplete;
 if(portfolioComplete&&fiscalComplete)return;
 const loading=portfolioComplete?fiscal.busy:state.busy&&!state.paused,interrupted=portfolioComplete?Boolean(fiscal.error):!$('error').hidden;
 $('loading-notice-title').textContent=loading?(portfolioComplete?'Loading fiscal-year totals from USAspending':'Loading your office portfolio from USAspending'):interrupted?'USAspending loading interrupted':state.paused||portfolioComplete?(!portfolioComplete&&fiscal.busy?'Portfolio paused · fiscal totals still loading':'USAspending loading paused'):'Preparing your USAspending portfolio';
 $('loading-notice-copy').textContent=loading?'A full portfolio can take several minutes to load, especially for larger offices. Explore results as they arrive; portfolio counts are partial until the scan finishes, and fiscal totals appear when their scan completes. Keep this page open, or use Pause and Resume.':interrupted?'Loaded records are retained. Use the loading controls to retry. Completing the USAspending scan can take several minutes; results remain partial until it finishes.':'The full USAspending portfolio can take several minutes to load. Loaded records stay available in this page; resume loading when you are ready. Results remain partial until their scans finish.';
}
function incorporate(data){const h=summarizeModifications(data.history.actions,{truncated:data.history.has_next});return {...data.award,latest_mod_number:h.latest_mod?.modification_number||null,latest_option_mod_number:h.latest_option_mod?.modification_number||null,latest_action_date:data.history.actions[0]?.action_date||data.award.latest_action_date,details_pending:false};}
async function loadOffice(){state.controller?.abort();state.controller=new AbortController();state.generation++;state.office=$('office').value;state.records=new Map();state.cache=new Map();state.pending=[];state.page=1;state.cursor=null;state.sortValue=null;state.hasNext=true;state.busy=false;state.paused=false;state.candidates=0;state.excluded=0;$('error').hidden=true;$('table-scroll').scrollTop=0;$('set-aside').value='';resetFiscal();render();loadFiscal();await loadBatch();}
async function loadBatch(){
 if(state.busy||!state.hasNext&&!state.pending.length)return;
 const generation=state.generation,signal=state.controller.signal;state.busy=true;state.paused=false;$('error').hidden=true;progress();
 try{do{
  if(!state.pending.length&&state.hasNext){
   const data=await api('awards',{office:state.office,start:$('window').value,page:state.page,cursor:state.cursor,sort_value:state.sortValue},signal);
   if(generation!==state.generation)return;
   state.page++;state.cursor=data.cursor;state.sortValue=data.sort_value;state.hasNext=data.has_next;state.candidates+=data.candidates;state.excluded+=data.excluded;state.checked=data.fetched_at;
   for(const row of data.rows)if(!state.records.has(row.award_id)){state.records.set(row.award_id,row);state.pending.push(row.award_id);}state.pending=selectRows(state.pending.map(id=>state.records.get(id)),{sort:'contract_end'}).map(r=>r.award_id);render();
  }
  while(state.pending.length&&!state.paused){
   // Two award loads in flight; every underlying source call shares the request scheduler.
   const ids=state.pending.slice(0,2),results=[];
   for(const id of ids){await sleep(Math.max(0,700-(Date.now()-state.lastRequest)));if(generation!==state.generation||state.paused)break;state.lastRequest=Date.now();results.push(api('award',{id},signal).then(data=>({id,data}),error=>({id,error})));}
   const batch=await Promise.all(results);if(generation!==state.generation)return;
   let error;for(const result of batch){if(result.error){if(result.error.status===404){state.records.set(result.id,{...state.records.get(result.id),details_pending:false,details_unavailable:true,detail_error:result.error.message});state.pending=state.pending.filter(id=>id!==result.id);}else error=result.error;continue;}state.records.set(result.id,incorporate(result.data));if(state.cache.size>=500)state.cache.delete(state.cache.keys().next().value);state.cache.set(result.id,result.data);state.pending=state.pending.filter(id=>id!==result.id);}
   render();if(error)throw error;
  }
 }while(!state.paused&&state.hasNext);
 }catch(error){if(error.name!=='AbortError'&&generation===state.generation){state.paused=true;failure(error);}}
 finally{if(generation===state.generation){state.busy=false;render();}}
}
function render(){
 state.rows=selectRows(scopeRows([...state.records.values()],state.scope).filter(r=>!$('set-aside').value||setAsideLabel(r)===$('set-aside').value),query());
 $('dataset').value=state.scope;renderRows();renderOverview();progress();
}
function openRegister(view='all',basis=null,setAside=''){
 $('view').value=view;if(basis)$('date-basis').value=basis;
 if(setAside!==null)$('set-aside').value=setAside;
 $('search').value='';ui.page=0;$('table-scroll').scrollTop=0;setTab('register');render();
}
function selectCategory(label){openRegister('all',null,label);}
function renderOverview(){
 const all=[...state.records.values()],ready=all.filter(r=>!r.details_pending&&!r.details_unavailable),rows=scopeRows(ready,state.scope),basis=$('date-basis').value,upcoming=expiryRows(rows,basis),recompetes=expiryRows(rows,'potential'),active=scopeRows(all,'active'),review=scopeRows(all,'review');
 const mode=basis==='potential'?'Potential final end':'Reported current PoP';
 $('overview-basis').textContent=mode;$('expiring-basis').textContent=mode+' · '+scopeNames[state.scope];
 $('kpi-active').textContent=(active.length-review.length).toLocaleString();$('kpi-review').textContent='+ '+review.length.toLocaleString()+' need date review';
 $('expiring-180-count').textContent=upcoming.filter(r=>r.days<=180).length.toLocaleString();$('kpi-90').textContent=upcoming.filter(r=>r.days<=90).length.toLocaleString()+' within 90 days';$('kpi-date-mode').textContent='Selected dataset · '+(basis==='potential'?'potential end':'current PoP')+' ↗';
 $('recompete-count').textContent=recompetes.length.toLocaleString();
 drawContracts($('overview-contracts'),upcoming.slice(0,10),basis,r=>award(r.award_id),state.busy);
 $('upcoming-caption').textContent='Next '+Math.min(upcoming.length,10)+' of '+upcoming.length.toLocaleString()+' reported ends within 365 days · '+mode+'.';
 renderSetAsides(rows);drawSetAsides($('set-aside-mix'),rows,selectCategory,state.busy,true);renderExpiring(upcoming);
}
function renderExpiring(upcoming){
 const panel=$('expiration-groups');panel.replaceChildren();let more=false;
 for(const [min,max,label]of [[0,90,'Within 90 days'],[91,180,'91–180 days'],[181,365,'181–365 days']]){
  const entries=upcoming.filter(r=>r.days>=min&&r.days<=max),section=el('section',undefined,'panel'),heading=el('div',undefined,'panel-heading'),totals=el('span',entries.length.toLocaleString()+' contracts · '+valueTotal(entries),'group-count');heading.append(el('h2',label),totals);section.append(heading);
  const box=el('div');
  drawContracts(box,entries.slice(0,ui.expiryLimit),$('date-basis').value,r=>{
   const id=r.award_id;ui.expanded.has(id)?ui.expanded.delete(id):ui.expanded.add(id);renderExpiring(upcoming);
   [...panel.querySelectorAll('[data-award]')].find(n=>n.dataset.award===id)?.focus({preventScroll:true});
  },state.busy,{expanded:ui.expanded,detailFor:r=>{
   const detail=el('div',undefined,'inline-evidence'),data=state.cache.get(r.award_id);
   detail.append(el('strong',text(r.description)),el('p','Current end: '+text(r.current_end_date)+' · Potential final end: '+text(r.potential_end_date)+' · Current value: '+money(r.award_amount_cents)),el('p','Latest reported mod: '+(r.latest_mod_number||'None Found')+' · Latest option-exercise mod: '+(r.latest_option_mod_number||'None Found')));
   if(data)detail.append(evidenceTable(data.history.actions.slice(0,3),[['action_date','Date'],['modification_number','Mod'],['obligation_cents','Obligation change'],['description','Description']]));
   const full=el('button','Open full source evidence →');full.addEventListener('click',()=>award(r.award_id));detail.append(full);return detail;
  }});
  section.append(box);if(entries.length>ui.expiryLimit){more=true;section.append(el('p','Showing '+ui.expiryLimit+' of '+entries.length+' loaded matches.','caption'));}panel.append(section);
 }$('more-expiring').hidden=!more;
}
function renderRows(){
 const focused=document.activeElement?.closest('#table-rows a')?.textContent;
 const pages=Math.max(1,Math.ceil(state.rows.length/ui.pageSize));ui.page=Math.min(ui.page,pages-1);
 $('dataset-empty').hidden=state.rows.length>0;$('dataset-empty').textContent=state.busy?'Loading — matching contracts appear as details arrive.':'No contracts match this dataset and the Register filters.';
 const ordered=[...defaultColumns,...fields.map(f=>f[0]).filter(k=>!defaultColumns.includes(k))],columns=ordered.filter(k=>visible.has(k)).map(k=>fields.find(f=>f[0]===k));
 const widths={description:'minmax(340px,1.6fr)',days_left:'85px',piid:'160px',recipient:'minmax(180px,1fr)',set_aside:'190px',current_end_date:'125px',potential_end_date:'125px',award_amount_cents:'145px',latest_action_date:'125px'},labels={days_left:'Ends in',recipient:'Awardee',award_amount_cents:'Current value',latest_action_date:'Latest action'};
 const grid=columns.map(f=>widths[f[0]]||f[2]).join(' ');$('table-head').style.gridTemplateColumns=grid;$('table-head').replaceChildren(...columns.map(f=>{const n=el('div',labels[f[0]]||f[1]);n.setAttribute('role','columnheader');return n;}));$('virtual-table').setAttribute('aria-rowcount',state.rows.length+1);$('table-space').style.height='auto';$('table-rows').replaceChildren();
 const first=ui.page*ui.pageSize,last=Math.min(state.rows.length,first+ui.pageSize),basis=$('date-basis').value;
 for(let i=first;i<last;i++){
  const row=state.rows[i],life=lifecycle(row),div=el('div',undefined,'data-row lifecycle-'+life.kind+(ui.selected===row.award_id?' selected':''));div.style.gridTemplateColumns=grid;div.setAttribute('role','row');div.setAttribute('aria-rowindex',i+2);div.setAttribute('aria-label',row.piid+' · '+life.label);div.addEventListener('click',e=>{if(!e.target.closest('a'))award(row.award_id);});
  for(const[field]of columns){const cell=el('div');cell.setAttribute('role','cell');
   if(field==='piid'){const a=el('a',row.piid);a.href='#register?award='+encodeURIComponent(row.award_id);a.addEventListener('click',e=>{e.preventDefault();award(row.award_id);});cell.className='piid-cell';cell.append(a);if(life.kind!=='upcoming'){const badge=el('span',life.label,'lifecycle-badge');badge.title=life.reason;cell.append(badge);}}
   else if(field==='description'){const a=el('a',row.description||'Description not reported','requirement-link');a.href='#register?award='+encodeURIComponent(row.award_id);a.addEventListener('click',e=>{e.preventDefault();award(row.award_id);});cell.className='requirement-cell';cell.append(a);}
   else if(field==='days_left'){cell.append(countdown(life.kind==='review'?null:daysRemaining(row[basis==='potential'?'potential_end_date':'current_end_date'])));}
   else if(field==='set_aside'){const label=setAsideLabel(row);cell.append(swatch(label),el('span',' '+label));}
   else{const detail=['award_amount_cents','latest_mod_number','latest_option_mod_number','potential_end_date','total_pop'];cell.textContent=row.details_pending&&detail.includes(field)?'Loading…':row.details_unavailable&&detail.includes(field)?'Unavailable':field==='latest_mod_number'||field==='latest_option_mod_number'?(row[field]||'None Found'):field==='total_pop'?totalPop(row):field==='status'?portfolioStatus(row):field.endsWith('_cents')?money(row[field]):text(row[field]);if(field.endsWith('_cents'))cell.className='money';else if(field.endsWith('_date'))cell.className='mono';}
   cell.title=cell.textContent;div.append(cell);
  }$('table-rows').append(div);
 }
 $('award-count').textContent=state.rows.length.toLocaleString()+' matches';$('register-summary').textContent=state.rows.length.toLocaleString()+' of '+scopeRows([...state.records.values()],state.scope).length.toLocaleString()+' loaded contracts match · '+scopeNames[state.scope]+' · countdown uses '+(basis==='potential'?'potential final end':'current PoP end');
 $('table-state').textContent=state.rows.length?(first+1)+'–'+last+' of '+state.rows.length.toLocaleString():'0 results';$('page-number').textContent='Page '+(ui.page+1)+' / '+pages;$('previous-page').disabled=ui.page===0;$('next-page').disabled=ui.page>=pages-1;if(focused)[...$('table-rows').querySelectorAll('a')].find(n=>n.textContent===focused)?.focus({preventScroll:true});
}
function evidenceTable(rows,columns){const wrap=el('div',undefined,'evidence-scroll'),table=el('table',undefined,'evidence-table'),head=el('tr');for(const[,label]of columns)head.append(el('th',label));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const[key]of columns){const td=el('td',key.endsWith('_cents')?money(row[key]):text(row[key]));tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);return wrap;}

function renderModifications(history){
 const section=el('section',undefined,'mod-history');section.append(el('h3','Modification & option history'));
 const latest=history.latest_mod,option=history.latest_option_mod,change=history.latest_option_pop_change;
 const cards=el('div',undefined,'mod-cards');
 for(const[label,value,note]of [
 ['Latest reported mod',latest?.modification_number||'None Found',latest?latest.action_date+' · '+(latest.option_exercised?'Option exercise':latest.action_type||'Reason not reported'):'No numbered mods in loaded records'],
 ['Latest option-exercise mod',option?.modification_number||'None Found',option?option.action_date+' · '+(option.end_change==='unknown'?'PoP change cannot be established':option.end_change==='unchanged'?'Reported PoP end unchanged':'Reported PoP end '+option.end_change):'No option-exercise code is verified in the available history. This does not establish that the contract has no options.'],
 ['Latest option mod changing PoP end',change?.modification_number||'Not established',change?change.action_date+' · '+change.previous_current_end+' → '+change.reported_current_end:'Needs an option exercise and comparable before/after records']
 ]){const card=el('div',undefined,'mod-card');card.append(el('span',label),el('strong',value),el('small',note));cards.append(card);}section.append(cards);
 if(change){section.append(el('p','PoP comparison: '+change.previous_modification_number+' ('+change.previous_action_date+') → '+change.modification_number+' ('+change.action_date+'). '+(change.comparison_note||'End-date change observed between successive loaded actions.'),'notice'));}
 if(!change&&history.latest_option_change_candidate){const candidate=history.latest_option_change_candidate;section.append(el('p','Possible option-related change at '+candidate.modification_number+': '+candidate.previous_current_end+' → '+candidate.reported_current_end+'. A mod sequence gap prevents attribution to this option exercise.','notice'));}if(option&&!change)section.append(el('p','Latest option mod '+option.modification_number+': '+(option.comparison_note||'No end-date change is established in the loaded sequence.')+(option.reported_current_end?' Reported end: '+option.reported_current_end+'.':''),'notice'));
 if(history.latest_mod_date_tied)section.append(el('p','Several mods share the latest action date; their within-day order needs review.','notice'));
 if(history.truncated)section.append(el('p','More source actions are available. Load older history below to extend this scan.','notice'));
 section.append(el('p','History may be incomplete. Date changes compare successive available actions; gaps and same-day records can limit attribution. Later non-option mods may also change the PoP.','muted'));
 const details=el('details',undefined,'mod-timeline'),summary=el('summary','Review available modification history');details.append(summary);
 const list=el('div'),more=el('button','Show more history');let shown=0;
 const render=()=>{shown=Math.min(shown+100,history.actions.length);const rows=history.actions.slice(0,shown).map(r=>({...r,modification_number:/^0+$/.test(r.modification_number)?'0 · Original award':r.modification_number||'Not reported',reason:r.action_type||r.action_type_code||'Original award / not reported',change:r.end_change==='unknown'?'Unknown: '+r.comparison_note:r.end_change+(r.sequence_gap?' · sequence gap':''),description:r.description||'Not reported'}));list.replaceChildren(evidenceTable(rows,[['modification_number','Mod'],['action_date','Action date'],['reason','Reported reason'],['previous_current_end','Previous loaded end'],['reported_current_end','Reported end'],['change','PoP end change'],['description','Source description (excerpt)']]));more.hidden=shown>=history.actions.length;};more.addEventListener('click',render);render();details.append(list,more);section.append(details);return section;
}

async function award(id){
 ui.selected=id;setTab('register',false);if(location.hash!=='#register?award='+encodeURIComponent(id))history.pushState(null,'','#register?award='+encodeURIComponent(id));renderRows();const token=startDialog('Award details');
 try{
  let data=state.cache.get(id)||await api('award',{id});if(token!==detailGeneration)return;const a=data.award;let history={...data.history,actions:[...data.history.actions]};
  const draw=()=>{
   if(token!==detailGeneration)return;const body=$('detail-body');$('detail-title').textContent=a.piid;body.replaceChildren();
   const identity=el('div',undefined,'detail-identity');identity.append(swatch(setAsideLabel(a)),el('strong',text(a.recipient)),el('span',setAsideLabel(a)));const source=el('a','Open on USAspending ↗');source.href=a.source_url;source.target='_blank';source.rel='noopener noreferrer';identity.append(source);body.append(identity,el('p',text(a.description)));
   const primary=el('dl',undefined,'detail-grid primary-stats');for(const[label,value]of [['Current PoP end',text(a.current_end_date)+' · '+endLabel(a.current_end_date)],['Potential final end',text(a.potential_end_date)],['Current value',money(a.award_amount_cents)]]){const box=el('div');box.append(el('dt',label),el('dd',value));primary.append(box);}body.append(primary);
   const mods=summarizeModifications(history.actions,{truncated:history.has_next}),chips=el('div',undefined,'evidence-chips');for(const[label,mod]of [['Latest reported mod',mods.latest_mod],['Latest option-exercise mod',mods.latest_option_mod]]){const chip=el('span');chip.append(el('small',label),el('strong',mod?.modification_number||'None Found'));if(mod)chip.append(el('small',mod.action_date));chips.append(chip);}body.append(chips,el('p','Option exercise is reported by source action codes; option periods are not established. Verify before action.','notice'));
   body.append(el('h3','Recent source transactions','evidence-heading'),evidenceTable(history.actions.slice(0,10),[['action_date','Date'],['modification_number','Mod'],['obligation_cents','Obligation change'],['description','Description']]));
   const full=el('details');full.append(el('summary','View all '+history.actions.length+' loaded source transactions'),evidenceTable(history.actions,[['action_date','Date'],['modification_number','Mod'],['obligation_cents','Obligation change'],['description','Description']]));body.append(full);
   if(history.has_next){const more=el('button','Load 200 older source actions');more.className='load-evidence';more.addEventListener('click',async()=>{more.disabled=true;try{const next=await api('history',{id,page:history.page+1});if(token!==detailGeneration)return;history={...next,actions:[...history.actions,...next.actions]};draw();}catch(error){more.disabled=false;body.append(el('p',error.message,'notice'));}});body.append(more);}
   const evidence=el('details');evidence.className='detail-extra';evidence.append(el('summary','Modification and option evidence'),renderModifications(mods));body.append(evidence);
   const metadata=el('details'),grid=el('dl',undefined,'detail-grid');metadata.className='detail-extra';metadata.append(el('summary','Contract classification and additional fields'));
   for(const[label,value]of [['Portfolio group',lifecycle(a).label],['Group explanation',lifecycle(a).reason],['Date status',portfolioStatus(a)],['PoP start',a.start_date],['Total contract PoP',totalPop(a)],['Office by PIID prefix',a.office_code+' · '+a.office_name],['Source net obligations',money(a.obligation_cents)],['Parent PIID',a.parent_piid],['Set-aside',a.set_aside],['Competition',a.competition],['Pricing',a.pricing_type]]){const box=el('div');box.append(el('dt',label),el('dd',text(value)));grid.append(box);}metadata.append(grid);body.append(metadata,el('p','Public source checked '+new Date(data.fetched_at).toLocaleString()+'. History may be incomplete.','muted'));
  };draw();
 }catch(error){if(token===detailGeneration){const retry=el('button','Retry award details');retry.addEventListener('click',()=>award(id));$('detail-body').replaceChildren(el('p',error.message,'notice'),retry);}}
}
async function status(){const token=startDialog('Data status');try{const data=await api('status');if(token!==detailGeneration)return;$('detail-body').replaceChildren(el('h3',data.mode),...data.notes.map(n=>el('p',n,'muted')));}catch(error){if(token===detailGeneration)$('detail-body').replaceChildren(el('p',error.message,'notice'));}}
function exportLoaded(){const columns=fields.map(([key,label])=>[key,label]).concat([['lifecycle','Portfolio group'],['source_url','Public source'],['details_pending','Details still pending'],['detail_error','Source detail error']]);const lines=[columns.map(c=>csvCell(c[1])).join(',')];for(const row of state.rows)lines.push(columns.map(([key])=>csvCell(key==='lifecycle'?lifecycle(row).label:key==='status'?portfolioStatus(row):key==='total_pop'?totalPop(row):key==='days_left'?daysRemaining(contractEnd(row)):key.endsWith('_cents')?dollars(row[key]):row[key])).join(','));const link=el('a');link.href=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));link.download='kthq-'+state.scope+'-'+state.office+'-'+new Date().toISOString().slice(0,10)+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
function filterOffices(){const q=$('office-search').value.trim().toLowerCase(),department=$('department').value;const matches=state.directory.filter(o=>(!department||o.department===department)&&[o.code,o.name,o.reported_name,o.base,o.location,o.command].some(v=>String(v).toLowerCase().includes(q)));$('office').replaceChildren();const selected=state.directory.find(o=>o.code===state.office);if(selected&&!matches.includes(selected)){const option=el('option',selected.code+' · '+selected.name+' (selected)');option.value=selected.code;$('office').append(option);}for(const o of matches){const option=el('option',o.code+' · '+o.name+(o.base?' · '+o.base:''));option.value=o.code;$('office').append(option);}$('office').value=state.office;$('directory-count').textContent=matches.length.toLocaleString()+' of '+state.directory.length.toLocaleString()+' supplied office codes · FY22–26 directory';}
for(const[key,label]of fields){const option=el('label'),input=el('input');input.type='checkbox';input.checked=visible.has(key);input.disabled=key==='piid';input.addEventListener('change',()=>{input.checked?visible.add(key):visible.delete(key);renderRows();});option.append(input,el('span',label));$('columns').querySelector('.column-options').append(option);}
for(const id of ['view','sort','date-basis','set-aside'])$(id).addEventListener('change',()=>{ui.page=0;$('table-scroll').scrollTop=0;render();});
$('search').addEventListener('input',()=>{ui.page=0;$('table-scroll').scrollTop=0;render();});
$('direction').addEventListener('click',()=>{state.direction=state.direction==='asc'?'desc':'asc';$('direction').textContent=state.direction==='asc'?'Ascending ↑':'Descending ↓';render();});
for(const id of ['office','window'])$(id).addEventListener('change',()=>{ui.page=0;ui.selected=null;ui.expanded.clear();$('office-dropdown').open=false;loadOffice();});
$('office-search').addEventListener('input',filterOffices);$('department').addEventListener('change',filterOffices);$('continue').addEventListener('click',loadBatch);
$('retry-missing').addEventListener('click',()=>{for(const row of state.records.values())if(row.details_unavailable){row.details_pending=true;row.details_unavailable=false;state.pending.push(row.award_id);}render();loadBatch();});
$('load-more').addEventListener('click',loadBatch);$('pause').addEventListener('click',()=>{state.paused=true;progress();});$('export').addEventListener('click',exportLoaded);
$('status-button').addEventListener('click',()=>{$('methodology').close();status();});
function closeDetail(){if($('detail').open)$('detail').close();detailGeneration++;ui.selected=null;if(location.hash.includes('award'))history.pushState(null,'','#'+ui.tab);renderRows();}
$('close-detail').addEventListener('click',closeDetail);$('detail').addEventListener('cancel',e=>{e.preventDefault();closeDetail();});
$('methodology-button').addEventListener('click',()=>$('methodology').showModal());$('close-methodology').addEventListener('click',()=>$('methodology').close());
$('dataset').addEventListener('change',()=>{state.scope=$('dataset').value;ui.page=0;render();});
$('kpi-active-button').addEventListener('click',()=>{state.scope='active';openRegister();});
$('expiring-180').addEventListener('click',()=>openRegister('180'));
$('recompetes').addEventListener('click',()=>openRegister('365','potential'));
$('upcoming-register').addEventListener('click',()=>openRegister('365'));
$('more-expiring').addEventListener('click',()=>{ui.expiryLimit+=50;renderOverview();});
for(const [id,step]of [['previous-page',-1],['next-page',1]])$(id).addEventListener('click',()=>{ui.page+=step;$('table-scroll').scrollTop=0;renderRows();});
const tabs=['overview','expiring','register','set-asides'];
function setTab(name,write=true){
 if(!tabs.includes(name))name='overview';ui.tab=name;
 for(const tab of tabs){$('tab-'+tab).setAttribute('aria-selected',String(tab===name));$('tab-'+tab).tabIndex=tab===name?0:-1;$('panel-'+tab).hidden=tab!==name;}
 if(write&&location.hash!=='#'+name)history.pushState(null,'','#'+name);
}
for(const [i,name]of tabs.entries()){
 $('tab-'+name).addEventListener('click',()=>setTab(name));
 $('tab-'+name).addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%4;if(e.key==='ArrowLeft')n=(i+3)%4;if(e.key==='Home')n=0;if(e.key==='End')n=3;if(n!==undefined){e.preventDefault();setTab(tabs[n]);$('tab-'+tabs[n]).focus();}});
}
function route(){
 const hash=location.hash.slice(1),[tab,params]=hash.split('?'),id=tab.startsWith('award-')?decodeURIComponent(tab.slice(6)):new URLSearchParams(params||'').get('award');
 setTab(id?'register':tab,false);
 if(id&&state.directory.length){if(ui.selected!==id||!$('detail').open)award(id);}
 else if(!id&&$('detail').open)closeDetail();
}
window.addEventListener('hashchange',route);setTab(location.hash.slice(1).split('?')[0],false);

function theme(value){document.documentElement.dataset.theme=value;$('theme').textContent=value==='dark'?'Light mode':'Dark mode';try{localStorage.setItem('contractintel-theme',value);}catch{}}
let saved;try{saved=localStorage.getItem('contractintel-theme');}catch{}theme(saved==='dark'?'dark':'light');$('theme').addEventListener('click',()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark'));

function resetFiscal(){fiscal={generation:state.generation,months:fiscalMonths(),index:0,page:1,rows:[],busy:false,paused:false,error:null};renderFiscal();}
function renderFiscal(){
 const fy=fiscalYear(),totals=fiscalTotals(fiscal.rows||[]),complete=fiscal.index===fiscal.months?.length;
 for(const [i,prefix] of ['prior','current'].entries()){
  const b=totals[i],year=i?fy:fy-1;
  $(prefix+'-dollar-label').textContent=(i?'OBLIGATED':'TOTAL PORTFOLIO')+' · FY'+year;
  $(prefix+'-count-label').textContent='CONTRACTS · FY'+year;
  $(prefix+'-dollars').textContent=complete?(b.missing?'Unavailable':money(String(b.cents))):'—';
  $(prefix+'-contracts').textContent=complete?b.awards.size.toLocaleString():'—';
 }
 $('fiscal-status').textContent=complete?'Office-wide scan complete · net obligations including deobligations · distinct contracts with reported activity.':(fiscal.busy?'Loading fiscal totals. ':fiscal.error?fiscal.error+' ':'Fiscal totals paused. ')+(fiscal.index||0)+' of '+(fiscal.months?.length||0)+' monthly windows complete. Totals remain blank until the full scan completes.';
 renderLoadingNotice();renderFiscalVisual(totals,complete);$('fiscal-continue').hidden=complete||fiscal.busy;$('fiscal-pause').hidden=!fiscal.busy;$('fiscal-continue').disabled=fiscal.busy||complete;$('fiscal-continue').textContent=fiscal.error?'Retry fiscal-year totals':'Continue fiscal-year totals';$('fiscal-pause').disabled=!fiscal.busy;
}
async function loadFiscal(){
 if(fiscal.busy||fiscal.index===fiscal.months.length)return;
 const f=fiscal,generation=state.generation;f.busy=true;f.paused=false;f.error=null;renderFiscal();
 try{while(f.index<f.months.length&&!f.paused){
  const month=f.months[f.index],data=await api('fiscal',{office:state.office,...month,page:f.page},state.controller.signal);
  if(generation!==state.generation)return;
  if(data.has_next&&f.page>=100)throw new Error('This month exceeds the source paging limit; fiscal totals are unavailable.');
  f.rows.push(...data.rows);if(data.has_next)f.page++;else{f.index++;f.page=1;}renderFiscal();await sleep(700);
 }}catch(error){if(error.name!=='AbortError')f.error=error.message;}
 finally{if(generation===state.generation){f.busy=false;renderFiscal();}}
}
function renderSetAsides(rows){
 const groups=setAsideGroups(rows),selected=$('set-aside').value,picker=$('set-aside');picker.replaceChildren(new Option('All set-asides',''));for(const g of groups)picker.add(new Option(g.label,g.label));if(selected&&!groups.some(g=>g.label===selected))picker.add(new Option(selected,selected));picker.value=selected;
 $('set-aside-scope').textContent=scopeNames[state.scope];drawSetAsides($('set-aside-groups'),rows,selectCategory,state.busy);
}
function renderFiscalVisual(totals,complete){
 const fy=fiscalYear();$('kpi-fy-label').textContent='Obligations · FY'+fy+' YTD';$('kpi-obligations').textContent=complete?(totals[1].missing?'Unavailable':money(String(totals[1].cents),true)):'—';$('kpi-obligations').title=$('current-dollars').textContent;$('kpi-prior').textContent='FY'+(fy-1)+': '+(complete?(totals[0].missing?'Unavailable':money(String(totals[0].cents),true)):'loading');
 const chart=$('fiscal-chart');chart.replaceChildren();if(!complete){chart.append(el('p',fiscal.error?'Fiscal source unavailable. Use Retry fiscal totals below.':fiscal.paused?'Fiscal totals paused.':'Loading fiscal totals…','muted'));return;}
 const max=Math.max(...totals.map(t=>Math.abs(Number(t.cents))),1);
 for(const t of totals){const line=el('div',undefined,'fy-bar'),track=el('div',undefined,'fy-bar-track'),fill=el('div',undefined,'fy-bar-fill');fill.style.width=t.missing?'0%':Math.abs(Number(t.cents))/max*100+'%';if(t.year===fy)fill.style.opacity='.45';track.append(fill);line.append(el('span','FY'+t.year+(t.year===fy?' YTD':'')),track,el('strong',t.missing?'Unavailable':money(String(t.cents),true)));line.title=t.missing?'Some transaction values unavailable':money(String(t.cents));chart.append(line);}
}

$('fiscal-continue').addEventListener('click',loadFiscal);$('fiscal-pause').addEventListener('click',()=>{fiscal.paused=true;});

async function init(){try{const data=await api('offices');state.directory=data.offices;for(const name of [...new Set(data.offices.map(o=>o.department))].sort()){const option=el('option',name);option.value=name;$('department').append(option);}const selected=new URLSearchParams(location.search).get('office');if(data.offices.some(o=>o.code===selected))state.office=selected;filterOffices();const hash=location.hash;if(hash.startsWith('#award-'))award(decodeURIComponent(hash.slice(7)));route();await loadOffice();}catch(error){failure(error);$('freshness').textContent='Unable to load the public API. Try refreshing.';}}init();

