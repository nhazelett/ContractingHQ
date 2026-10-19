// Run with node scripts/test-package-return.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const reqHtml = fs.readFileSync(path.join(root, 'requirements-builder.html'), 'utf8');
const pwsHtml = fs.readFileSync(path.join(root, 'pws-builder.html'), 'utf8');
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing source markers: ${start}`);
  return source.slice(a, b);
}
// Check every inline script's syntax, including code outside the tested helpers.
for (const html of [reqHtml, pwsHtml]) {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/src=|application\/ld\+json/.test(match[1])) new vm.Script(match[2]);
  }
}
const saved = {sessionId:'original', item:'Grounds maintenance', kind:'service',
  mr_knownVendors:'Vendor A', ef_mustHaves:'Weekly mowing', pkg_poc_name:'Customer',
  resumeStep:'svc_handoff'};
function context(raw, unavailable = false) {
  const values = new Map([['kthq_req_v1', raw]]);
  const ctx = vm.createContext({Date, Math, JSON, URLSearchParams,
    localStorage: {getItem:k => {if (unavailable) throw Error('blocked'); return values.get(k);},
      setItem:(k,v)=>values.set(k,v)},
    sceneState:{currentStep:null}, reqBox:{}, SCENE:{groundY:100,scale:1},
    window:{location:{search:'?resume=package'}},
    STEPS:{svc_handoff:{}, pkg_output:{}}, stationX:()=>100,
    runStep:(step)=>ctx.lastStep=step,
    queueDialogue:()=>ctx.freshIntro=true});
  vm.runInContext(between(reqHtml, "const STORAGE_KEY =", 'function computeThreshold()'), ctx);
  vm.runInContext(between(reqHtml, 'function runIntro()', "document.getElementById('btnDownloadPdf').addEventListener"), ctx);
  return {ctx, values};
}
const {ctx, values} = context(JSON.stringify(saved));
vm.runInContext('runIntro()', ctx);
assert.equal(ctx.lastStep, 'pkg_output');
assert.equal(vm.runInContext('req.mr_knownVendors', ctx), 'Vendor A');
assert.equal(vm.runInContext('req.sessionId', ctx), 'original');
ctx.sceneState.currentStep = 'pkg_output';
vm.runInContext('saveReq()', ctx);
assert.equal(JSON.parse(values.get('kthq_req_v1')).resumeStep, 'pkg_output');
ctx.window.location.search = '';
vm.runInContext('runIntro()', ctx);
assert.equal(ctx.lastStep, 'pkg_output');
for (const raw of ['invalid JSON', 'null', '[]', JSON.stringify({item:'No kind'})]) {
  const {ctx} = context(raw);
  vm.runInContext('runIntro()', ctx);
  assert.equal(ctx.freshIntro, true);
}
vm.runInContext('runIntro()', context(null, true).ctx);
const elements = Object.fromEntries(['handoffNote','btnDownloadPdf','btnNextStation'].map(id=>[id,{style:{},dataset:{}}]));
ctx.document = {getElementById:id=>elements[id]};
ctx.ask = ()=>{};
vm.runInContext(between(reqHtml, 'function renderPkgOutput()', '/*'), ctx);
vm.runInContext('renderPkgOutput()', ctx);
assert.equal(elements.btnDownloadPdf.dataset.doc, 'pkg');
assert.equal(elements.btnNextStation.dataset.target, 'pws');
assert.equal(elements.btnNextStation.style.display, '');
vm.runInContext("req.kind = 'product'; renderPkgOutput()", ctx);
assert.equal(elements.btnNextStation.style.display, 'none');
// Pre-fill reset must never remove the package, or reload and re-import it.
const clear = between(pwsHtml, 'function clearOllieData()', '</script>');
const field = {value:'imported', tagName:'INPUT', classList:{remove:()=>{}}, dispatchEvent:()=>{}};
const reset = vm.createContext({confirm:()=>true, Event:class {},
  document:{querySelectorAll:()=>[field]}, dismissOllieBanner:()=>{},
  localStorage:{removeItem:()=>assert.fail('Deleted requirements package')},
  location:{reload:()=>assert.fail('Re-imported pre-fills')}});
vm.runInContext(clear + '\nclearOllieData();', reset);
assert.equal(field.value, '');
assert.match(pwsHtml, /href="requirements-builder\.html\?resume=package" target="_blank" rel="noopener"/);
assert.match(pwsHtml, /id="requirementsReturn"[^>]*hidden/);
assert.match(pwsHtml, /getElementById\('requirementsReturn'\)\.hidden = false/);
console.log('Package return regression checks passed: restore, resume, corrupt/blocked storage, download, product path, pre-fill reset, and inline script syntax.');

