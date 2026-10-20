const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'pnm.html'), 'utf8');
const helpers = html.slice(html.indexOf('function getPricingRule()'), html.indexOf('function generatePNM()'));
const generator = html.slice(html.indexOf('function generatePNM()'), html.indexOf('function renderSection('));

function setup(scope, custom = '', band = 'tina', competition = 'solesource') {
  const elements = Object.fromEntries(['pricingRule','customThreshold','customThresholdField','midThresholdTitle','highThresholdTitle','contractNum','contractType','govObjective','contractorProposal','finalPrice','profitPct','keyIssues','genOutput'].map(id => [id, {value:'',classList:{add(){}},scrollIntoView(){}}]));
  elements.pricingRule.value = scope;
  elements.customThreshold.value = custom;
  elements.contractType.value = 'FFP';
  const output = {};
  const ctx = vm.createContext({document:{getElementById:id=>elements[id],querySelectorAll:()=>[]},
    fmtDollar:n=>'$'+n.toLocaleString('en-US'),fmtPct:n=>n+'%',Number,Math,
    getSelected:k=>({dollarRange:band,competition,actionType:'mod',priceBasis:'costanalysis',outcome:'negotiated'}[k]),
    getMultiSelected:()=>[],renderSection:(id,s)=>output[id]=s,setTimeout:()=>{},
    alert:()=>ctx.blocked=true});
  vm.runInContext(helpers+generator,ctx);
  return {ctx,elements,output};
}

test('DoD award-date and FAR baseline thresholds remain distinct in generated drafts',()=>{
  for (const [scope,amount,cite] of [['dod-new',10000000,'DFARS 215.403-3(a)'],['dod-prior',2500000,'DFARS 215.403-3(a)'],['far',2500000,'FAR 15.403-3(a)']]) {
    const {ctx,output}=setup(scope);
    assert.equal(vm.runInContext('getPricingRule().amount',ctx),amount);
    vm.runInContext('generatePNM()',ctx);
    assert.ok(output['out-s4'].includes('$'+amount.toLocaleString('en-US')));
    assert.ok(output['out-s4'].includes(cite));
    assert.match(output['out-s4'],/nontraditional defense contractor exemption/);
    assert.doesNotMatch(output['out-s4'],/was required to submit|\$2,000,000/);
  }
});

test('missing or invalid contract-specific threshold cannot generate a determination',()=>{
  for (const [scope,amount] of [['',''],['contract',''],['contract','0'],['contract','-1'],['contract','Infinity']]) {
    const {ctx,output}=setup(scope,amount);
    vm.runInContext('generatePNM()',ctx);
    assert.equal(ctx.blocked,true);
    assert.deepEqual(output,{});
  }
  const {ctx,output}=setup('contract','950000');
  vm.runInContext('generatePNM()',ctx);
  assert.match(output['out-s4'],/\$950,000/);
  assert.match(output['out-s4'],/prime-contract clause/);
});

test('changing the threshold clears the previously selected value band',()=>{
  const {ctx,elements}=setup('dod-new');let cleared=0;
  ctx.document.querySelectorAll=()=>[{classList:{remove:name=>{assert.equal(name,'selected');cleared++;}}}];
  vm.runInContext('updatePricingRule()',ctx);
  assert.equal(cleared,1);
  assert.match(elements.highThresholdTitle.textContent,/10,000,000/);
  elements.pricingRule.value='dod-prior';
  vm.runInContext('updatePricingRule()',ctx);
  assert.equal(cleared,2);
  assert.match(elements.midThresholdTitle.textContent,/2,500,000/);
});

test('full-and-open selection alone does not assert adequate price competition',()=>{
  const {ctx,output}=setup('dod-new','','tina','full');
  vm.runInContext('generatePNM()',ctx);
  assert.doesNotMatch(output['out-s4'],/exception.*applies under|Two or more responsible offerors/);
  assert.match(output['out-s4'],/Check all applicable exceptions/);
});
