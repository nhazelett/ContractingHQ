// Network-free DOM checks; these do not claim pixel-layout/browser verification.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {Window}=await import(process.env.CONTRACTINTEL_DOM_MODULE||'happy-dom');
const html=readFileSync(new URL('../web/coverage.html',import.meta.url),'utf8');
for(const width of [390,1280]){
 const win=new Window({width,height:844,url:'https://qa.invalid/coverage.html',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 win.document.write(html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
 let calls=0,fail=false;const directory=Array.from({length:65},(_,i)=>({code:i===0?'FA4800':'AA'+String(i).padStart(4,'0'),name:i===0?'<img src=x onerror=alert(1)> Langley':'Office '+i,location:'Virginia'}));
 Object.assign(globalThis,{document:win.document,localStorage:win.localStorage,fetch:async path=>{calls++;if(fail)return new Response('',{status:503});return Response.json(String(path).endsWith('/details')?{directory_count:65,generated_at:'2026-10-26T20:00:00Z',offices:[{office:'FA4800',status:'importing',phase:'hydrate',progress:{kind:'import',prepared:2092,discovered:7968,requests:4307,saved_at:'2026-10-26T20:00:00Z'},storage:{bytes:12000000,objects:3,complete:true,measured_at:'2026-10-26T20:00:00Z'},limits:{bytes:33554432,objects:160},workflow_url:'https://github.com/nhazelett/ContractingHQ/actions'}]}:{offices:directory});}});
 await import(new URL('../web/coverage.mjs?width='+width,import.meta.url));
 const $=id=>win.document.getElementById(id);await new Promise(r=>setTimeout(r,20));
 assert.equal(calls,2);assert.equal($('directory-results').children.length,30);assert.equal($('office-cards').querySelector('progress').value,2092);assert.equal(win.document.querySelectorAll('img').length,0);
 $('next').click();assert.match($('page-status').textContent,/Page 2/);
 $('office-search').value='Langley';$('office-search').dispatchEvent(new win.Event('input'));assert.equal($('directory-results').children.length,1);assert.equal($('previous').disabled,true);
 $('theme').click();assert.equal(win.document.documentElement.dataset.theme,'dark');
 fail=true;$('refresh').click();await new Promise(r=>setTimeout(r,20));assert.equal($('coverage-error').hidden,false);assert.equal($('refresh').disabled,false);assert.equal($('office-cards').children.length,1);
 await win.happyDOM.close();
 console.log('Coverage DOM controls passed at '+width+'px: search, pagination, progress, theme, text escaping, retry and retained results.');
}
