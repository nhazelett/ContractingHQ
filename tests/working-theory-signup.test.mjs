import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const mentorSource = readFileSync(new URL('../working-theory/mentors.js', import.meta.url), 'utf8');
const accountSource = readFileSync(new URL('../working-theory/account.js', import.meta.url), 'utf8');
function element(value = '') { return { value, disabled: false, hidden: false, maxLength: 1500, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } }; }
function fixture({ user = null, storage = new Map(), authError = null, signupSession = false, widget = true, storageFails = false } = {}) {
  const calls = { signup: [], signin: [], posts: [] };
  const nodes = Object.fromEntries(['mentor-credentials','mentor-account-mode','mentor-email','mentor-password','mentor-confirm','mentor-username','mentor-new-account','mentor-draft-notice','mentor-clear-draft'].map(id => [id, element()]));
  nodes['mentor-account-mode'].value = 'new';
  nodes['mentor-email'].value = 'pseudonym@example.test';
  nodes['mentor-password'].value = nodes['mentor-confirm'].value = 'test-password-12345';
  nodes['mentor-username'].value = 'ForumAlias';
  const fields = Object.fromEntries(['name','rank','field','role','bio','philosophy'].map(key => [key,element('Mentor ' + key)]));
  fields.terms = {checked: true};
  const button = element(), message = element(), fieldset = element(), availability = element();
  const form = { isConnected: true, dataset:{route:'/mentors/apply'}, elements:fields, handlers:{},
    querySelector(s) { return s === 'fieldset' ? fieldset : s === 'button[type=submit]' ? button : s === '[role=status]' ? message : {}; },
    parentNode:{querySelector:()=>availability}, addEventListener(k,fn){this.handlers[k]=fn;}, reset(){ for (const input of Object.values(fields)) input.value = ''; fields.terms.checked=false; } };
  const listeners = {};
  const account = { user:()=>user, refresh:async()=>{}, accessToken:async()=> 'test-access-token', client:{auth:{
    async signUp(input) { calls.signup.push(input); if (authError === 'throw') throw new Error('Network offline'); if (signupSession) user={email:input.email,email_confirmed_at:'verified'}; return {error: authError && {message:authError}}; },
    async signInWithPassword(input) { calls.signin.push(input); if (authError) return {error:{message:authError}}; user={email:input.email,email_confirmed_at:'verified'}; return {error:null}; }
  }} };
  const window = {KTHQAccount:account,KTHQ_WORKING_THEORY:{apiBase:'https://worker.example.test',turnstileSiteKey:'test'}};
  if(widget) window.turnstile={render:()=>0,getResponse:()=> 'test-bot-token',reset:()=>{}};
  const localStorage={getItem:k=>storage.get(k)||null,setItem(k,v){if(storageFails) throw new Error('No storage');storage.set(k,v);},removeItem:k=>storage.delete(k)};
  const document={body:{dataset:{}}, getElementById:id=>nodes[id]||null,
    querySelectorAll:s=>s==='form[data-route]'?[form]:[], addEventListener:(k,fn)=>listeners[k]=fn,createElement:()=>({}),head:{append(){}}};
  const context = {window,document,localStorage,fetch:async(url,options)=>{calls.posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({message:'Application queued'})};},FormData:class {constructor(){throw new Error('Account fields must never be serialized');}}};
  vm.runInNewContext(accountSource, context);
  vm.runInNewContext(mentorSource, context);
  return {calls,nodes,fields,button,message,fieldset,storage,account,submit:()=>form.handlers.submit({preventDefault(){}}),change:()=>nodes['mentor-account-mode'].handlers.change(),user(next){user=next;listeners['kthq-account-changed']();}};
}
test('mentor signup uses the shared account and saves only profile draft while awaiting verification', async()=>{
  const f=fixture(); assert.equal(f.button.disabled,false);
  await f.submit();
  assert.equal(f.calls.signup.length,1);assert.equal(f.calls.posts.length,0);
  const signup=f.calls.signup[0];
  assert.deepEqual(JSON.parse(JSON.stringify(signup.options.data)),{username:'ForumAlias',display_name:'ForumAlias'});
  assert.equal(signup.options.emailRedirectTo,'https://kthq.org/working-theory/mentors.html');
  assert.match(f.message.textContent,/not been sent yet/);
  const stored=[...f.storage.values()][0];
  for(const secret of ['test-password','test-access-token','test-bot-token','ForumAlias','terms']) assert.ok(!stored.includes(secret));
  assert.ok(stored.includes('Mentor name'));assert.equal(f.nodes['mentor-password'].value,'');assert.equal(f.button.disabled,false);
});
test('verified return restores draft and submits it using existing account without another signup',async()=>{
  const first=fixture();await first.submit();
  const f=fixture({storage:first.storage,user:{email:'pseudonym@example.test',email_confirmed_at:'verified'}});
  assert.equal(f.nodes['mentor-credentials'].hidden,true);assert.equal(f.fields.bio.value,'Mentor bio');
  await f.submit();
  assert.equal(f.calls.signup.length,0);assert.equal(f.calls.signin.length,0);assert.equal(f.calls.posts.length,1);assert.equal(f.storage.size,0);
  assert.deepEqual(Object.keys(f.calls.posts[0]).sort(),['bio','field','name','philosophy','rank','role','terms','topicSlug','turnstileToken'].sort());
});
test('existing users sign in and apply without registering a second identity',async()=>{
  const f=fixture();f.nodes['mentor-account-mode'].value='existing';f.change();
  assert.equal(f.nodes['mentor-username'].disabled,true);assert.equal(f.nodes['mentor-confirm'].disabled,true);assert.equal(f.nodes['mentor-password'].minLength,1);
  await f.submit();assert.equal(f.calls.signup.length,0);assert.equal(f.calls.signin.length,1);assert.equal(f.calls.posts.length,1);
});
test('signup with an immediate verified session can submit in the same action',async()=>{
  const f=fixture({signupSession:true});await f.submit();assert.equal(f.calls.signup.length,1);assert.equal(f.calls.posts.length,1);
});
test('verification remains required and drafts cannot be submitted under another identity',async()=>{
  const first=fixture();await first.submit();
  const f=fixture({storage:first.storage,user:{email:'other@example.test',email_confirmed_at:'verified'}});
  await f.submit();assert.equal(f.calls.posts.length,0);assert.match(f.message.textContent,/different account/);
  f.user({email:'pseudonym@example.test'});await f.submit();assert.equal(f.calls.posts.length,0);assert.match(f.message.textContent,/verified KTHQ account/);
});
test('missing bot script explains the issue without leaving a silently disabled application button',async()=>{
  const f=fixture({widget:false,user:{email:'pseudonym@example.test',email_confirmed_at:'verified'}});
  await f.submit();assert.equal(f.calls.posts.length,0);assert.match(f.message.textContent,/bot check has not loaded/);assert.equal(f.button.disabled,false);
});
test('network errors and storage failures preserve text and recover the button',async()=>{
  for (const options of [{authError:'throw'},{authError:'Email already registered'},{storageFails:true}]) {
    const f=fixture(options);await f.submit();assert.equal(f.calls.posts.length,0);assert.equal(f.button.disabled,false);assert.equal(f.fields.bio.value,'Mentor bio');assert.equal(f.nodes['mentor-password'].value,'');
  }
});
test('expired drafts are removed and discarding a draft clears its profile',async()=>{
  const first=fixture();await first.submit();
  const key=[...first.storage.keys()][0], draft=JSON.parse(first.storage.get(key));draft.savedAt=Date.now()-86400001;first.storage.set(key,JSON.stringify(draft));
  const expired=fixture({storage:first.storage});assert.equal(expired.storage.size,0);
  const f=fixture();await f.submit();f.nodes['mentor-clear-draft'].handlers.click();assert.equal(f.storage.size,0);assert.equal(f.fields.bio.value,'');
});
