import {reviewedPlan} from './queue-plan.mjs';
const $=id=>document.getElementById(id);
let coverage=null,directory=[],page=0,selection=[],plan=null,planGeneration=0;
try{const saved=JSON.parse(localStorage.getItem('contractintel-queue-draft')||'[]');if(Array.isArray(saved))selection=saved.filter(code=>typeof code==='string');}catch{}
const pageSize=30;
const labels={stored:'Stored portfolio',importing:'Import in progress',verifying:'Awaiting verification',live:'Live scan'};
const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
const fmt=n=>Number(n).toLocaleString(),size=n=>(n/1048576).toFixed(2)+' MiB';
const date=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Not available';
const officeName=code=>{const office=directory.find(o=>o.code===code);return office?[code,office.name,office.base].filter(Boolean).join(' · '):code;};
function addStat(list,label,value){const item=document.createElement('div');item.append(text('dt',label),text('dd',value));list.append(item);}
function render(){
 if(!coverage)return;
 const entries=coverage.offices,stored=entries.filter(o=>o.status==='stored').length,imports=entries.filter(o=>['importing','verifying'].includes(o.status)).length,total=directory.length||coverage.directory_count;
 $('coverage-summary').replaceChildren(...[[stored,'Stored offices'],[imports,'Imports / verification'],[total?Math.max(0,total-stored-imports):'—','Other offices · live scan'],[entries.filter(o=>o.storage).length,'Offices with storage measurements']].map(([value,label])=>{const box=text('div','','coverage-stat');box.append(text('strong',typeof value==='number'?fmt(value):value),text('span',label));return box;}));
 $('office-cards').replaceChildren(...entries.map(row=>{
  const card=text('article','','coverage-card');card.append(text('h3',officeName(row.office)),text('span',labels[row.status]||'Live scan','coverage-badge '+row.status));
  const dl=document.createElement('dl'),p=row.progress;
  addStat(dl,'Import stage',row.status==='stored'?'Ready':({hydrate:'Loading award details',discover:'Finding contracts',fiscal:'Calculating fiscal totals',publish:'Preparing publication',verification:'Comparing with live source',done:'Awaiting comparison'}[row.phase]||'Waiting for saved progress'));
  addStat(dl,'Prepared / discovered',p?.kind==='import'&&p.prepared!==null&&p.discovered!==null?fmt(p.prepared)+' / '+fmt(p.discovered):'Not yet reported');
  addStat(dl,'Source requests · saved work',p?.requests!==null&&p?.requests!==undefined?fmt(p.requests):'Not yet reported');
  addStat(dl,'Progress saved',date(p?.saved_at));
  addStat(dl,'Portfolio updated',date(row.updated_at));
  addStat(dl,'Private storage',row.storage?(row.storage.complete?'':'At least ')+size(row.storage.bytes)+' · '+fmt(row.storage.objects)+' objects':'Unavailable');
  addStat(dl,'Per-office guard',size(row.limits.bytes)+' · '+fmt(row.limits.objects)+' objects');
  card.append(dl);
  if(p?.kind==='import'&&p.discovered>0&&p.prepared!==null){const bar=document.createElement('progress');bar.max=p.discovered;bar.value=Math.min(p.prepared,p.discovered);bar.setAttribute('aria-label','Award details prepared');card.append(bar);}
  if(row.storage)card.append(text('p','Storage measured '+date(row.storage.measured_at)+(row.storage.complete?'':'; listing reached its safety limit.'),'caption'));
  if(row.issue)card.append(text('p',row.issue,'coverage-issue'));
  const links=text('div','','coverage-links'),portfolio=text('a','Open portfolio');portfolio.href='./?office='+encodeURIComponent(row.office);
  const workflow=text('a','View import / errors ↗');workflow.href=row.workflow_url;workflow.target='_blank';workflow.rel='noopener';links.append(portfolio,workflow);card.append(links);return card;
 }));
 $('office-cards').setAttribute('aria-busy','false');renderQueue();renderDirectory();
}
function renderDirectory(){
 const q=$('office-search').value.trim().toLowerCase(),matches=directory.filter(o=>[o.code,o.name,o.base,o.location,o.command,o.department,o.reported_name].filter(Boolean).join(' ').toLowerCase().includes(q));
 const count=Math.ceil(matches.length/pageSize);page=Math.min(page,Math.max(0,count-1));
 $('directory-status').textContent=fmt(matches.length)+' offices match'+(directory.length?'':' · directory unavailable; retry Refresh status');
 $('directory-results').replaceChildren(...matches.slice(page*pageSize,(page+1)*pageSize).map(o=>{const row=text('div','','directory-row'),info=document.createElement('div'),link=text('a',[o.code,o.name].filter(Boolean).join(' · '));link.href='./?office='+encodeURIComponent(o.code);info.append(link,text('small',[o.base,o.location,o.department].filter(Boolean).join(' · ')));const status=coverage?.offices.find(e=>e.office===o.code)?.status||'live';const actions=text('div','','queue-office-actions'),badge=text('span',labels[status],'coverage-badge '+status),button=text('button',selection.includes(o.code)?'Remove from draft':'Add to draft');button.type='button';button.setAttribute('aria-label',(selection.includes(o.code)?'Remove ':'Add ')+o.code+' '+o.name+' '+(selection.includes(o.code)?'from':'to')+' import draft');
 button.disabled=!coverage?.queue?.limits||status!=='live'||queuedOffices().has(o.code)||(!selection.includes(o.code)&&selection.length>=coverage.queue.limits.maxGroupOffices);
 button.onclick=()=>toggleOffice(o.code);actions.append(badge,button);row.append(info,actions);return row;}));
 if(!matches.length)$('directory-results').append(text('p','No offices match. Try a base name or six-character DoDAAC.'));
 $('previous').disabled=page===0;$('next').disabled=page+1>=count;$('page-status').textContent=count?'Page '+(page+1)+' of '+count:'No results';
}
async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
async function refresh(){
 $('refresh').disabled=true;$('load-status').textContent='Reading saved coverage…';$('coverage-error').hidden=true;
 try{
  const [status,offices]=await Promise.allSettled([get('./api/office/coverage/details'),directory.length?Promise.resolve(directory):get('./api/offices')]);
  if(offices.status==='fulfilled'){const value=offices.value;directory=Array.isArray(value)?value:value.offices||[];}
  if(status.status==='rejected')throw status.reason;coverage=status.value;render();$('load-status').textContent='Coverage loaded '+date(coverage.generated_at)+'. Refresh manually for newer saved progress.';
  if(offices.status==='rejected'){$('coverage-error').textContent='Office directory unavailable. Coverage cards still work; use Refresh status to retry.';$('coverage-error').hidden=false;}
 }catch{$('load-status').textContent='Coverage could not be refreshed.';$('coverage-error').textContent='Coverage service unavailable. Use Refresh status to retry. Portfolio and Opportunities remain available.';$('coverage-error').hidden=false;$('office-cards').setAttribute('aria-busy','false');}
 finally{$('refresh').disabled=false;}
}
let theme='light';try{theme=localStorage.getItem('contractintel-theme')||'light';}catch{}
function setTheme(value){theme=value;document.documentElement.dataset.theme=value;$('theme').textContent=value==='dark'?'Light mode':'Dark mode';$('theme').setAttribute('aria-label','Switch to '+(value==='dark'?'light':'dark')+' mode');}
setTheme(theme);$('theme').onclick=()=>{setTheme(theme==='dark'?'light':'dark');try{localStorage.setItem('contractintel-theme',theme);}catch{}};
$('refresh').onclick=refresh;$('office-search').oninput=()=>{page=0;renderDirectory();};$('previous').onclick=()=>{page--;renderDirectory();};$('next').onclick=()=>{page++;renderDirectory();};refresh();

function queuedOffices(){return new Set((coverage?.queue?.groups||[]).flatMap(g=>g.items.filter(i=>i.status!=='cancelled').map(i=>i.office)));}
function renderQueue(){
 const queue=coverage?.queue,limits=queue?.limits;
 $('queue-mode').textContent=!queue?.available?'Shared queue unavailable. Draft planning remains local.':queue.execution_enabled?'Queue enabled'+(queue.paused?' · paused':''):'Execution disabled · no additional office imports will start';
 const active=(queue?.groups||[]).flatMap(g=>g.items),names={queued:'Queued',importing:'Importing',verifying:'Verifying',ready:'Ready',stopped:'Stopped for review',cancelled:'Cancelled'};
 $('queue-groups').replaceChildren(...(queue?.groups||[]).map(g=>{
  const box=text('article','','queue-group');box.append(text('h3',(g.approved?'Approved group':'Awaiting administrator approval')+(g.paused?' · paused':'')),text('p','Group '+g.id,'queue-fingerprint'));
  const list=document.createElement('ul');for(const item of g.items){const label=names[item.status]||'Unknown';list.append(text('li',officeName(item.office)+' · '+label+(item.reason?' · '+item.reason.replaceAll('_',' '):'')));}box.append(list);return box;
 }));
 if(!active.length)$('queue-groups').append(text('p','No offices have been submitted to the shared queue.'));
 $('queue-limits').replaceChildren(...(limits?[[limits.maxGroupOffices+' offices','Maximum reviewed group'],[fmt(limits.maxDailySourceRequests)+' requests / day','Proposed queue source-request limit'],[(limits.maxDailyRuntimeMs/60000)+' minutes / day','Proposed queue runtime limit'],[size(limits.maxTotalStorageBytes),'Proposed combined storage guard'],['1 office at a time','Resume saved work before starting another'],['Verification required','Every office must match before fast loading']]:[]).map(([value,label])=>{const el=text('div','','queue-limit');el.append(text('strong',value),text('span',label));return el;}));
 refreshPlan();
}
function toggleOffice(code){
 if(selection.includes(code))selection=selection.filter(o=>o!==code);
 else if(coverage?.queue?.limits&&selection.length<coverage.queue.limits.maxGroupOffices&&!queuedOffices().has(code))selection.push(code);
 saveDraft();refreshPlan();renderDirectory();
}
function saveDraft(){try{localStorage.setItem('contractintel-queue-draft',JSON.stringify(selection));}catch{}}
async function refreshPlan(){
 const generation=++planGeneration;plan=null;$('queue-export').disabled=true;
 const limits=coverage?.queue?.limits,known=new Set(directory.map(o=>o.code)),existing=queuedOffices();
 selection=selection.filter(code=>known.has(code)&&!existing.has(code)&&!coverage?.offices.some(o=>o.office===code&&o.status!=='live')).slice(0,limits?.maxGroupOffices||0);saveDraft();
 $('queue-selection').replaceChildren(...selection.map(code=>{const button=text('button',officeName(code)+' ×');button.type='button';button.setAttribute('aria-label','Remove '+code+' from import draft');button.onclick=()=>toggleOffice(code);return button;}));
 $('queue-clear').disabled=!selection.length;$('queue-plan-hash').textContent='';
 if(!limits){$('queue-plan-status').textContent='Queue policy unavailable. Refresh status to retry.';return;}
 if(!selection.length){$('queue-plan-status').textContent='Choose up to '+limits.maxGroupOffices+' offices from the directory. No imports will start.';return;}
 try{
  const candidate=await reviewedPlan(selection,directory,limits);if(generation!==planGeneration)return;plan=candidate;
  $('queue-plan-status').textContent=selection.length+' offices in this browser draft · not submitted or approved.';
  $('queue-plan-hash').textContent='Plan fingerprint: '+plan.sha256;$('queue-plan-hash').className='queue-fingerprint';$('queue-export').disabled=false;
 }catch(error){if(generation===planGeneration)$('queue-plan-status').textContent=error.message;}
}
$('queue-clear').onclick=()=>{selection=[];saveDraft();refreshPlan();renderDirectory();};
$('queue-export').onclick=()=>{
 if(!plan)return;const blob=new Blob([JSON.stringify(plan,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='contractintel-office-plan-'+plan.sha256.slice(0,12)+'.json';document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
};
