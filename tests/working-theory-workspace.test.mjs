import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../working-theory/mentors.js',import.meta.url),'utf8');
const code = source.slice(source.indexOf("  var workspace = document.getElementById('mentor-workspace');"), source.indexOf('  async function loadProfile()'));
function el(tag, text='') { return {tag,textContent:text,children:[],isConnected:true,hidden:false,append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},addEventListener(){}}; }
function fixture(status, options={}) {
  const workspace=el('section'), application=el('section'), badge=el('p'), workspaceLink=el('a');
  let user=options.signedOut?null:{email_confirmed_at:'verified'};
  const document={getElementById:id=>({'mentor-workspace':workspace,'mentor-application-section':application,'mentor-session-status':badge,'mentor-workspace-link':workspaceLink}[id]||null),addEventListener(){}};
  let studioCalls=0;const window={KTHQWritingStudio:()=>{studioCalls++;},KTHQAccount:{user:()=>user,accessToken:async()=> 'test-token'},addEventListener(){}};
  const api=options.api || (async(path,request)=>{ assert.equal(path,'/me/mentor');assert.equal(request.headers.Authorization,'Bearer test-token');return {mentor:status?{status,name:'Mentor Name',id:'profile-id'}:null}; });
  const context={document,window,api,node:el,config:{publishedTopics:['blame']},topicTitles:{blame:'Blame'}};
  vm.createContext(context);vm.runInContext(code,context);
  return {workspace,application,badge,workspaceLink,context,get studioCalls(){return studioCalls;},logout(){user=null;return context.refreshMentorWorkspace();}};
}
function text(element){return [element.textContent,...element.children.map(text)].join(' ');}
function links(element){return [element,...element.children.flatMap(links)].filter(x=>x.tag==='a');}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('approved mentors see posting links and no duplicate application',async()=>{
  const f=fixture('approved');await settle();assert.equal(f.application.hidden,true);assert.equal(f.workspace.hidden,false);
  assert.equal(f.studioCalls,1);
  assert.equal(f.badge.textContent,'Signed in as an approved KTHQ mentor');
  assert.equal(f.badge.hidden,false);
  assert.equal(f.workspaceLink.hidden,false);
  assert.ok(links(f.workspace).some(link=>link.href==='/working-theory/mentor.html?id=profile-id'));
});
test('pending applicants see their status without another application',async()=>{
  const f=fixture('pending');await settle();assert.equal(f.application.hidden,true);assert.match(text(f.workspace),/awaiting review/);
});
test('new and rejected applicants can use the application',async()=>{
  for(const status of [null,'rejected']){const f=fixture(status);await settle();assert.equal(f.application.hidden,false);}
});
test('logout restores signup and clears the previous mentor workspace',async()=>{
  const f=fixture('approved');await settle();await f.logout();assert.equal(f.application.hidden,false);assert.equal(f.workspace.hidden,true);assert.equal(f.workspace.children.length,0);assert.equal(f.badge.hidden,true);assert.equal(f.workspaceLink.hidden,true);
});
test('a delayed response cannot reveal the previous user profile after logout',async()=>{
  let finish;const f=fixture('approved',{api:()=>new Promise(resolve=>finish=resolve)});await settle();await f.logout();finish({mentor:{status:'approved',name:'Old user'}});await settle();assert.equal(f.workspace.hidden,true);assert.ok(!text(f.workspace).includes('Old user'));assert.equal(f.badge.hidden,true);
});
test('status errors offer retry instead of another application',async()=>{
  const f=fixture(null,{api:async()=>{throw new Error('offline');}});await settle();assert.equal(f.application.hidden,true);assert.match(text(f.workspace),/could not be loaded/);assert.match(text(f.workspace),/Refresh mentor status/);assert.match(f.badge.textContent,/Mentor status unavailable/);
});

test('pending and new accounts never claim an approved mentor session',async()=>{
  for(const status of [null,'pending','rejected']){const f=fixture(status);await settle();assert.ok(!f.badge.textContent.includes('as an approved'));}
});

test('a status refresh preserves the open editor for the same approved mentor',async()=>{const f=fixture('approved');await settle();await f.context.refreshMentorWorkspace();assert.equal(f.studioCalls,1);});
