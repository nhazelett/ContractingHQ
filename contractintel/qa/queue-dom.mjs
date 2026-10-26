// Network-free DOM checks; no graphical/pixel-layout claims.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POLICY} from '../portfolio/queue/model.mjs';
const {Window}=await import(process.env.CONTRACTINTEL_DOM_MODULE||'happy-dom');
const html=readFileSync(new URL('../web/coverage.html',import.meta.url),'utf8');
for(const width of [390,1280]){
 const win=new Window({width,height:844,url:'https://qa.invalid/coverage.html',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 win.document.write(html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
 const directory=Array.from({length:65},(_,i)=>({code:i===0?'FA4800':'AA'+String(i).padStart(4,'0'),name:i===0?'Langley':'Test office '+i,location:'Virginia'}));
 let calls=0,fail=false,download=null;
 win.HTMLAnchorElement.prototype.click=function(){download=this.download;};
 const payload={queue:{available:true,execution_enabled:false,paused:true,groups:[],limits:POLICY},directory_count:65,generated_at:'2026-10-26T20:00:00Z',offices:[{office:'FA4800',status:'importing',phase:'hydrate',progress:{kind:'import',prepared:3050,discovered:7968},storage:{bytes:123,objects:2,complete:true},limits:{bytes:33554432,objects:160},workflow_url:'https://github.com/nhazelett/ContractingHQ/actions'}]};
 Object.assign(globalThis,{document:win.document,localStorage:win.localStorage,fetch:async path=>{calls++;if(fail)return new Response('',{status:503});assert.ok(!String(path).includes('/admin/'),'Browser never writes to shared queue');return Response.json(String(path).endsWith('/details')?payload:{offices:directory});}});
 await import(new URL('../web/coverage.mjs?queue='+width,import.meta.url));
 const $=id=>win.document.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,30));await tick();
 assert.equal(calls,2);assert.match($('queue-mode').textContent,/Execution disabled/);
 const buttons=()=>[...$('directory-results').querySelectorAll('button')];
 assert.equal(buttons()[0].disabled,true,'Existing FA4800 import cannot be selected');
 for(let i=1;i<=5;i++){buttons()[i].click();await tick();}
 assert.equal($('queue-selection').children.length,5);assert.equal(buttons()[6].disabled,true,'Group cap applies before export');
 assert.equal($('queue-export').disabled,false);assert.match($('queue-plan-hash').textContent,/[a-f0-9]{64}/);
 $('queue-export').click();assert.match(download,/contractintel-office-plan-[a-f0-9]+\.json/);assert.equal(calls,2,'Export does not call a source or queue write');
 $('next').click();assert.match($('page-status').textContent,/Page 2/);assert.equal($('queue-selection').children.length,5,'Draft survives directory pages');
 $('office-search').value='office 6';$('office-search').dispatchEvent(new win.Event('input'));assert.ok($('directory-results').children.length>0);
 $('queue-selection').querySelector('button').click();await tick();assert.equal($('queue-selection').children.length,4);
 $('queue-clear').click();await tick();assert.equal($('queue-export').disabled,true);assert.deepEqual(JSON.parse(win.localStorage.getItem('contractintel-queue-draft')),[]);
 $('theme').click();assert.equal(win.document.documentElement.dataset.theme,'dark');
 fail=true;$('refresh').click();await tick();assert.equal($('coverage-error').hidden,false);assert.equal($('refresh').disabled,false);
 assert.ok($('office-cards').children.length>0);await win.happyDOM.close();
 console.log('Queue DOM passed at '+width+'px: existing-office protection, group limit, persistent draft, reviewed export, pagination, search, theme and retry; zero source/admin writes.');
}
