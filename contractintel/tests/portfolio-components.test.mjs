import test from 'node:test';
import assert from 'node:assert/strict';
import {drawContracts,drawSetAsides} from '../web/presentation.mjs';
import {createDocument} from './fixtures/minimal-dom.mjs';
import {datePresentation,simpleContractCells,renderSimpleRegister,settingsChips,wirePanel,revealOffice,welcomeOffice,compactLoading} from '../web/portfolio-ui.mjs';
const date=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
const row={award_id:'CONT_AWD_FA480024C0001_9700_-NONE-_-NONE-',piid:'FA480024C0001',description:'Ventilation maintenance',recipient:'Example vendor',start_date:date(-100),current_end_date:date(30),potential_end_date:date(300),award_amount_cents:'1234500'};
const countdown=days=>document.createElement('span');

test('Contract rows retain source identity and actions while presenting four fields and subordinate alternative dates',()=>{
 globalThis.document=createDocument();let opened;const cells=simpleContractCells({...row,source_refresh_pending:true},'current',r=>opened=r,countdown);
 assert.equal(cells.length,4);assert.equal(cells[0].dataset.label,'Requirement');assert.match(cells[0].textContent,/Ventilation/);assert.match(cells[0].textContent,/Updating/);assert.equal(cells[1].textContent,row.recipient);assert.match(cells[3].textContent,/12,345/);
 cells[0].querySelector('a').click();assert.equal(opened.award_id,row.award_id);assert.ok(cells[0].querySelector('a').href.includes(encodeURIComponent(row.award_id)));
 const current=datePresentation(row,'current',countdown),potential=datePresentation(row,'potential',countdown);
 assert.match(current.querySelector('.secondary-date').textContent,/^Could run to /);assert.match(potential.querySelector('.secondary-date').textContent,/^Current period ends /);assert.match(potential.querySelector('.primary-date').children[0].title,/unexercised options/);
 assert.equal(datePresentation({...row,potential_end_date:row.current_end_date},'current',countdown).querySelector('.secondary-date'),null);
});

test('Simplified register keeps all matches, 50-row paging, selected rows, empty states and source callbacks',()=>{
 globalThis.document=createDocument(['dataset-empty','table-head','virtual-table','table-space','table-rows','award-count','register-summary','table-state','page-number','previous-page','next-page']);
 const rows=Array.from({length:65},(_,i)=>({...row,award_id:row.award_id+'_'+i,piid:row.piid+i})),state={rows,scope:'all',busy:false},ui={page:0,pageSize:50,selected:rows[0].award_id};let opened;
 const options={state,ui,total:65,basis:'current',onOpen:r=>opened=r,countdown};renderSimpleRegister(options);
 assert.equal(document.getElementById('table-rows').children.length,50);assert.equal(document.getElementById('table-head').children.length,4);assert.match(document.getElementById('table-state').textContent,/^1–50 of 65/);assert.equal(document.getElementById('previous-page').disabled,true);assert.equal(document.getElementById('next-page').disabled,false);
 document.getElementById('table-rows').querySelector('a').click();assert.equal(opened.award_id,rows[0].award_id);assert.match(document.getElementById('table-rows').children[0].className,/selected/);
 ui.page=1;renderSimpleRegister(options);assert.equal(document.getElementById('table-rows').children.length,15);assert.equal(document.getElementById('next-page').disabled,true);assert.match(document.getElementById('table-state').textContent,/^51–65/);
 state.rows=[];renderSimpleRegister(options);assert.equal(ui.page,0);assert.equal(document.getElementById('dataset-empty').hidden,false);assert.match(document.getElementById('table-state').textContent,/0 results/);
});

test('Settings chips expose active source values and clear only nondefault choices through existing change events',()=>{
 globalThis.document=createDocument(['active-settings','dataset','window','date-basis']);const $=id=>document.getElementById(id);$('dataset').value='completed';$('window').value='2021-10-01';$('window').selectedOptions=[{textContent:'FY22 onward'}];$('date-basis').value='potential';let changed=0;$('dataset').addEventListener('change',()=>changed++);
 settingsChips();assert.match($('active-settings').textContent,/Potentially completed/);assert.match($('active-settings').textContent,/Could end as late as/);const chips=$('active-settings').children;assert.equal(chips[1].querySelector('button'),null);chips[0].querySelector('button').click();assert.equal($('dataset').value,'active');assert.equal(changed,1);
});

test('Advanced drawers retain explicit Close, Escape, expanded state and focus restoration',()=>{
 globalThis.document=createDocument(['trigger','drawer','close']);wirePanel('trigger','drawer','close');const $=id=>document.getElementById(id);
 $('trigger').click();assert.equal($('drawer').open,true);assert.equal($('trigger').getAttribute('aria-expanded'),'true');$('close').click();assert.equal($('drawer').open,false);assert.equal(document.activeElement,$('trigger'));
 $('trigger').click();$('drawer').dispatchEvent(new Event('cancel',{cancelable:true}));assert.equal($('drawer').open,false);assert.equal($('trigger').getAttribute('aria-expanded'),'false');
});

test('New-visitor gate reuses the existing office controls and reveals views only after a valid submit',async()=>{
 globalThis.document=createDocument(['header-office-slot','office-controls','office-welcome','portfolio-workspace','primary-navigation','office-dropdown','loading-rail','welcome-office-slot','welcome-office-go','office-search','welcome-office-form','office']);const $=id=>document.getElementById(id);
 $('header-office-slot').append($('office-controls'));let chosen=false;const choice=welcomeOffice().then(()=>chosen=true);assert.equal($('office-controls').parentElement,$('welcome-office-slot'));
 $('welcome-office-form').dispatchEvent(new Event('submit',{cancelable:true}));await Promise.resolve();assert.equal(chosen,false);
 $('office').value='FA4800';$('welcome-office-form').dispatchEvent(new Event('submit',{cancelable:true}));await choice;assert.equal(chosen,true);assert.equal($('office-controls').parentElement,$('header-office-slot'));assert.equal($('office-welcome').hidden,true);assert.equal($('portfolio-workspace').hidden,false);assert.equal(document.documentElement.dataset.officeReady,'true');
});

test('One-line progress retains the full accessible message and pins contract counts separately',()=>{
 globalThis.document=createDocument(['freshness']);const status=document.getElementById('freshness');status.textContent='Loading JB Langley-Eustis from USAspending, 1,240 contracts so far';const original=status.textContent;compactLoading();assert.equal(status.textContent,original);assert.equal(status.title,original);assert.equal(status.querySelector('.loading-count').textContent,', 1,240 contracts so far');
 status.textContent='Search complete · 65 contracts loaded';compactLoading();assert.equal(status.querySelector('.loading-count').textContent,' · 65 contracts loaded');
});


test('Ending-soon renderer retains expandable rows, source IDs, four visible fields and full-evidence callbacks',()=>{
 globalThis.document=createDocument();const container=document.createElement('div');let opened;const expanded=new Set([row.award_id]);
 drawContracts(container,[{row,days:30}],'current',r=>opened=r,false,{expanded,detailFor:r=>{const note=document.createElement('p');note.textContent='Pending evidence for '+r.piid;return note;}});
 assert.equal(container.querySelectorAll('th').length,4);assert.match(container.textContent,/Could run to/);const button=container.querySelector('button');assert.equal(button.dataset.award,row.award_id);assert.equal(button.getAttribute('aria-expanded'),'true');button.click();assert.equal(opened.award_id,row.award_id);assert.match(container.querySelector('.expanded-evidence').textContent,/Pending evidence/);
});

test('Who-can-bid charts retain source group counts and filter callbacks while showing plain labels',()=>{
 globalThis.document=createDocument();const container=document.createElement('div');let selected;
 drawSetAsides(container,[{...row,set_aside:'TOTAL SMALL BUSINESS SET ASIDE'},{...row,award_id:row.award_id+'x',set_aside:'NO SET ASIDE USED'}],label=>selected=label,false);
 assert.match(container.textContent,/Small businesses only/);assert.match(container.textContent,/No set-aside listed/);assert.ok(!container.textContent.includes('Anyone'));const buttons=container.querySelectorAll('button');assert.equal(buttons.length,4);buttons[0].click();assert.ok(['TOTAL SMALL BUSINESS SET ASIDE','NO SET ASIDE USED'].includes(selected));
});
