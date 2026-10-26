import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {whoCanBid,endName,endHelp,dateText} from '../web/portfolio-ui.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8').replaceAll('\r\n','\n'),baseline=JSON.parse(read('tests/fixtures/portfolio-presentation-baseline.json'));
function functionBody(source,name){const re=new RegExp('^(?:export )?(?:async )?function '+name+'\\(','m'),m=re.exec(source);assert.ok(m,name);const rest=source.slice(m.index+1),next=/\n(?:export )?(?:async )?function /.exec(rest);return source.slice(m.index,next?m.index+1+next.index:source.length).trim();}

test('Presentation rebuild preserves all data, API, cache, pacing, parsing and Opportunities modules',()=>{
 // D1 adds routing and the explicitly approved NY calendar; compare the original live code underneath.
 for(const [file,hash]of Object.entries(baseline.files)){
  let source=read(file);
  if(['web/format.mjs','web/lifecycle.mjs','web/overview.mjs','web/register.mjs'].includes(file))source=source.replace("import {currentDate} from './calendar.mjs';\n",'').replaceAll('currentDate()',"new Date().toISOString().slice(0,10)");
  if(file==='worker/api.mjs'){
   source=source.replace("import {portfolioRoute} from '../portfolio/http.mjs';\nimport {dispatchIngest} from '../portfolio/dispatch.mjs';\nimport {PortfolioError} from '../portfolio/read.mjs';\n",'');
   const begin=source.indexOf(" if(url.pathname.startsWith('/api/office/')"),end=source.indexOf(" if(request.method==='OPTIONS')");source=source.slice(0,begin)+source.slice(end);
   source=source.replace("export async function scheduled(controller,env){return dispatchIngest(env,{mode:'nightly',origin:'cron'});}\nexport default {fetch:handle,scheduled};","export default {fetch:handle};");
  }
  assert.equal(createHash('sha256').update(source.trimEnd()+'\n').digest('hex'),hash,file);
 }
 let app=read('web/app.mjs');
 app=app.replace("if(state.fromD1){const stored=await tryStoredEvidence({path,params,office:state.office,signal,base:API});if(stored)return stored;}",'');
 app=app.replace(' state.fromD1=false;state.d1Fiscal=null;\n','');
 const begin=app.indexOf(' const sourceURL=new URL(location.href);'),end=app.indexOf(' browserMemory.get(state.office,state.window)');app=app.slice(0,begin)+app.slice(end);
 for(const [name,body]of Object.entries(baseline.functions))assert.equal(functionBody(app,name),body,name);
});

test('Every original control ID, select option value, methodology paragraph and footer remains available',()=>{
 const html=read('web/index.html'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'unique IDs');for(const id of baseline.ids)assert.ok(ids.includes(id),id);
 for(const [id,values]of Object.entries(baseline.selects)){const re=new RegExp('<select\\b[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</select>'),m=html.match(re);assert.ok(m,id);assert.deepEqual([...m[1].matchAll(/<option\b[^>]*value="([^"]*)"/g)].map(x=>x[1]),values,id);}
 assert.ok(html.includes(baseline.methodology),'verbatim methodology');assert.ok(html.includes('<footer>'+baseline.footer+'</footer>'),'verbatim footer');
});

test('The new Portfolio surface keeps the office gate, visible office sections, drawers and direct anchors',()=>{
 const html=read('web/index.html');for(const id of ['welcome-office-form','welcome-title','office-title','ending-year-count','advanced-drawer','register-options','detailed-layout'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const id of ['office-more','office-buying']){assert.match(html,new RegExp('<section id="'+id+'"[^>]*>'));assert.ok(!html.includes('<details id="'+id+'"'));}assert.match(html,/<details id="ending-breakdown"(?![^>]*\bopen\b)[^>]*>/);
 for(const hash of ['overview','expiring','register','set-asides'])assert.ok(html.includes('href="#'+hash+'"'));
 assert.ok(html.includes('data-office-ready="false"'));assert.ok(!html.includes('role="tabpanel"'),'linked sections use native navigation');
});

test('Plain labels preserve source distinctions and never infer eligibility or an option schedule',()=>{
 assert.equal(whoCanBid('TOTAL SMALL BUSINESS SET ASIDE'),'Small businesses only');assert.equal(whoCanBid('NO SET ASIDE USED'),'No set-aside listed');assert.equal(whoCanBid('Not reported'),'Not reported');assert.equal(whoCanBid('Other'),'Other');assert.notEqual(whoCanBid('NO SET ASIDE USED'),'Anyone');
 assert.equal(endName('current'),'Contract ends');assert.equal(endName('potential'),'Could end as late as');assert.match(endHelp('potential'),/unexercised options/);assert.equal(dateText('2027-03-04'),'Mar 4, 2027');assert.equal(dateText('2027-03-04',true),'Mar 2027');
});


test('390px presentation has stacked default/detailed/evidence rows, full-width drawers and a count-preserving loading rail',()=>{
 const css=read('web/portfolio.css');assert.ok(css.includes('@media(max-width:639px)'));assert.ok(css.includes('.contracts-table,.contracts-table tbody{display:block}'));assert.ok(css.includes(':root[data-register-layout=detailed] .data-row'));assert.ok(css.includes('.evidence-table,.evidence-table tbody{display:block'));assert.ok(css.includes('.portfolio-drawer{width:100vw'));assert.ok(css.includes('#freshness .loading-count{flex-shrink:0'));assert.ok(!css.includes('linear-gradient'));
 assert.ok(read('web/app.mjs').includes('if(data?.history)detail.append'),'Pending inline history is guarded');
});


test('Expiration classification, category colors, countdowns, money totals and original CSV field definitions are unchanged',()=>{
 const presentation=read('web/presentation.mjs');for(const [name,body]of Object.entries(baseline.presentation_functions))assert.equal(functionBody(presentation,name),body,name);
 const app=read('web/app.mjs');assert.equal(app.slice(app.indexOf('const fields='),app.indexOf('const visible=')),baseline.field_definitions);
});
