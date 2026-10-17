import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../execution-lab/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // The complete inline program must parse, not just the engine.
const context=vm.createContext({console,setTimeout,URLSearchParams});
vm.runInContext(script.split('/* RENDERER:')[0]+ '\nglobalThis.lab={SCENARIO,CARD,stateFor,playChoice,advance,ending,restore,simulateSync,fastChoice,walkFast,setupText,wording,matches,orderedChoices,choiceOutcome};',context);
const L=context.lab,S=L.SCENARIO;
assert.equal(S.cards.length,15);assert.equal(S.images&&Object.keys(S.images).length,32);
assert.equal(S.cards.filter(c=>c.id!=='D7-SS').length,14);
assert(S.cards.every(c=>c.reference===''&&!c.referenceValidated));
assert(S.cards.every(c=>c.choices.length===3&&c.choices.every(x=>x.outcomes.some(o=>!o.if))));
const allFlags=new Set(S.flags),setFlags=new Set();
for(const c of S.cards)for(const ch of c.choices)for(const o of ch.outcomes)for(const f of o.flags){assert(allFlags.has(f),f);setFlags.add(f)}
for(const f of S.flags)assert(S.flagReview[f],f+' has no review explanation');
assert.equal(S.start.mission,60);assert.equal(S.start.file,50);
function ready(s){let guard=0;while(s.screen==='event'){assert(guard++<40,'event loop');s=L.advance(s);}return s;}
function run(setting,answers){let s=L.stateFor(setting,78);while(s.screen!=='outcome'){s=ready(s);if(s.screen==='outcome')break;const id=S.route[s.cursor];s=L.playChoice(s,answers[id]||'B');}return s;}
const balanced={D1:'B',D2:'B',D3:'B',D4:'A',D5:'C',D6:'A',D7:'B',D8:'B',D9:'C',D10:'A',D12:'B',D13:'A',D14:'A'};
for(const setting of ['dep','st']){
 const s=run(setting,balanced);assert.equal(L.ending(s),'advisor');assert.equal(s.awardClock,setting==='dep'?2:4);assert.equal(s.history.filter(r=>r.cardId==='D11').length,1);assert.equal(s.history.find(r=>r.cardId==='D11').kind,'callback');assert.equal(s.history.length,14);assert.equal(s.flags.has('UC_DEFERRED'),true);assert(L.setupText(s,L.CARD.D13)[0].includes('bill'));assert.equal(s.seen.filter(x=>x==='lowClock').length,1);
 const restored=L.restore(JSON.stringify({...s,flags:[...s.flags]}));assert.equal(restored.mission,s.mission);assert.equal(restored.file,s.file);assert.equal(restored.history.length,s.history.length);
 const severe=run(setting,{...balanced,D9:'A'});assert.equal(L.ending(severe),'review');assert(severe.history.some(h=>h.cardId==='D14'));
 const buried=run(setting,{...balanced,D3:'C'});assert.equal(L.ending(buried),'review');
 const paid=run(setting,{...balanced,D6:'C',D11:'B'});assert.equal(L.ending(paid),'review');
 const sole=run(setting,{...balanced,D4:'C',D5:'B','D7-SS':'B',D2:'A'});assert(sole.flags.has('WEAK_JA'));assert(!sole.history.some(h=>h.cardId==='D7'||h.cardId==='D8'));assert.equal(sole.history.find(h=>h.cardId==='D7-SS').effectsApplied.file,0);
 const protest=run(setting,{...balanced,D7:'A',D8:'C'});assert.equal(protest.events.filter(e=>e.id==='protest').length,1);assert.equal(protest.events.find(e=>e.id==='protest').clock,-5);assert.equal(protest.events[0].id,'protest');assert.equal(protest.events[1].id,'award');
 const slow=run(setting,Object.fromEntries(S.route.map(id=>[id,'A'])));assert(slow.screen==='outcome');
}
// Probe the conditional D12/D13 table at its boundaries.
for(const [flags,choice,m,f] of [
 [['GOOD_PWS','RISKY_VENDOR'],'A',8,8],[['GOOD_PWS'],'A',-5,3],[['GOOD_PWS','NO_COR'],'A',-10,-3],
 [['RISKY_VENDOR'],'B',-3,3],[[],'B',10,5],[['RISKY_VENDOR','NO_COR'],'C',-8,-5],[['RISKY_VENDOR'],'C',-8,3],[[],'C',-15,-10]
]){const s=L.stateFor();s.flags=new Set(flags);const {out}=L.choiceOutcome(s,L.CARD.D12,choice);assert.equal(out.effects.mission,m);assert.equal(out.effects.file,f);}
for(const [flags,choice,m,f] of [[['UC_DEFERRED'],'A',0,8],[[],'A',0,8],[['CLAIM_BAIT'],'B',-5,-11],[[],'B',0,-3],[[],'C',3,-10]]){const s=L.stateFor();s.flags=new Set(flags);const {out}=L.choiceOutcome(s,L.CARD.D13,choice);assert.equal(out.effects.mission||0,m);assert.equal(out.effects.file,f);}
// Every rendered event position survives a reload; reactions and callbacks cannot double-apply.
let s=L.stateFor('dep',123),positions=0;
while(s.screen!=='outcome'){
 const restored=L.restore(JSON.stringify({...s,flags:[...s.flags]}));assert.equal(restored.screen,s.screen);assert.equal(restored.cursor,s.cursor);assert.equal(restored.mission,s.mission);assert.equal(restored.file,s.file);assert.equal(restored.clock,s.clock);positions++;
 if(s.screen==='event')s=L.advance(s);else s=L.playChoice(s,balanced[S.route[s.cursor]]||'B');
}
assert(positions>30);assert.equal(L.playChoice(s,'A'),s,'terminal state ignores choices');
// Headless and UI reducers agree across diverse routes (fixed pseudo-random seed).
let seed=3861;
for(let t=0;t<150;t++){
 let ui=L.stateFor(t%2?'dep':'st'),fast=L.stateFor(ui.setting);
 while(ui.screen!=='outcome'){
  ui=ready(ui);const c=L.walkFast(fast);if(!c){assert.equal(ui.screen,'outcome');break;}
  assert.equal(S.route[ui.cursor],c.id);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const id=['A','B','C'][seed%3];ui=L.playChoice(ui,id);fast=L.fastChoice(fast,c,id);
 }
 for(const k of ['clock','mission','file'])assert.equal(ui[k],fast[k]);assert.deepEqual([...ui.flags].sort(),[...fast.flags].sort());
}
const ids=L.orderedChoices(L.stateFor('dep',1),L.CARD.D1).map(x=>x.id).sort();assert.equal(ids.join(''),'ABC');
assert(!/<script[^>]+src=|<link[^>]+stylesheet|@import|fetch\(|XMLHttpRequest/.test(html),'Must have no network dependencies');
console.log('PASS: exact conditional effects, both routes, all severe endings, protest ordering, delayed callbacks, full event-position restore, and UI/headless parity.');
if(process.argv.includes('--balance')){
 const results=['dep','st'].map(L.simulateSync);fs.writeFileSync(new URL('../execution-lab/balance-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
}
// Render the real screens with storage blocked; this is not a browser/layout test.
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',open:false,addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
const doc={querySelector:node,querySelectorAll(){return []},addEventListener(){},documentElement:{dataset:{}}};
const win={addEventListener(){},scrollTo(){},matchMedia(){return {matches:true}},print(){}};
const ui=vm.createContext({document:doc,window:win,location:{search:''},localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},console,setTimeout,URLSearchParams,requestAnimationFrame:fn=>fn()});
vm.runInContext(script+'\nglobalThis.renderTest={start:begin,render,set(s){state=s},get(){return state},handle};',ui);
assert(node('#app').innerHTML.includes('Cradle to Grave'));assert(node('#app').innerHTML.includes('Progress cannot be saved'));
ui.renderTest.start('st');assert(node('#app').innerHTML.includes('The thin package'));
const completed=run('st',balanced);
for(const screen of ['outcome','review','replay']){ui.renderTest.set({...completed,screen});ui.renderTest.render();assert(!node('#app').innerHTML.includes('undefined'));assert(!/\{(customer|awardee|vendor[A-C]|clock)\}/.test(node('#app').innerHTML));}
assert(node('#app').innerHTML.includes('Try the other setting'));
let early=L.stateFor('dep');early=L.playChoice(early,'C');ui.renderTest.set(early);ui.renderTest.render();assert(node('#app').innerHTML.includes('WHAT HAPPENS NEXT'));
console.log('PASS: real screen rendering, token replacement, and storage-blocked startup.');
