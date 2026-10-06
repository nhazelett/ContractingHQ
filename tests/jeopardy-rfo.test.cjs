const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..') + path.sep;
const read = name => fs.readFileSync(root + name, 'utf8');
const bank = JSON.parse(read('data/jeopardy-clues.json'));
const audit = JSON.parse(read('data/jeopardy-clues-audit.json'));
const embedded = {window: {}};
vm.runInNewContext(read('data/jeopardy-clues.js'), embedded);
assert.equal(JSON.stringify(embedded.window.CLUE_BANK_DATA), JSON.stringify(bank), 'Embedded and fallback data must match');
const all = [];
for (const round of ['single', 'double']) {
  assert.equal(Object.keys(bank[round]).length, 6);
  for (const tiers of Object.values(bank[round])) {
    assert.deepEqual(Object.keys(tiers), ['1', '2', '3', '4', '5']);
    for (const pool of Object.values(tiers)) {assert.equal(pool.length, 4); all.push(...pool);}
  }
}
assert.equal(bank.final.length, 60);
all.push(...bank.final);
assert.equal(all.length, 300);
assert.equal(new Set(all.map(c => c.id)).size, 300);
assert.equal(audit.reviews.length, 300);
for (const clue of all) {
  assert(clue.clue && clue.answer && clue.sources.length, clue.id);
  const review = audit.reviews.find(r => r.id === clue.id);
  assert.equal(review.after.clue, clue.clue);
  assert.equal(review.after.answer, clue.answer);
  assert.equal(JSON.stringify(review.sources), JSON.stringify(clue.sources));
  for (const ref of clue.sources) {
    const url = new URL(ref.url);
    assert(['www.acquisition.gov', 'www.ecfr.gov'].includes(url.hostname));
    assert(ref.label);
  }
}

// Exercise the real game functions with a small DOM adapter. Timers do not run.
const ids = new Map();
class Element {
  constructor(tag) {this.tagName = tag;this.children = [];this.attributes = {};this.style = {};this.listeners = {};}
  appendChild(node) {node.parentNode = this;this.children.push(node);return node;}
  insertBefore(node, before) {node.parentNode = this;const i = this.children.indexOf(before);assert(i >= 0);this.children.splice(i, 0, node);}
  removeChild(node) {this.children.splice(this.children.indexOf(node), 1);}
  setAttribute(k, v) {this.attributes[k] = v;if(k === 'id') ids.set(v,this);}
  addEventListener(k, f) {this.listeners[k] = f;}
  set innerHTML(value) {this.children=[];this.html=value;}
  get textContent() {return this.children.map(c => c.textContent).join('');}
  focus() {}
}
const stage = new Element('div');ids.set('jStage',stage);
const document = {body: new Element('body'),createElement: tag => new Element(tag),createTextNode: text => ({textContent: text}),getElementById: id => ids.get(id),querySelector: () => null};
const context = {window: {CLUE_BANK_DATA: bank},document,console,setTimeout: () => 1,clearTimeout(){},setInterval: () => 1,clearInterval(){},Date,Math};
vm.createContext(context);
vm.runInContext(read('scripts/jeopardy.js') + '\nthis.testApi={state,buildBoard,appendClueSources,revealAnswer,judgeFinal,renderBoard,resolveSolo,resolveMulti,resolveDD};',context);
const api = context.testApi;
api.buildBoard('single'); // loadBank assigns synchronously before the boot await yields.
for (const round of ['single','double']) {
  for (let i=0;i<100;i++) {
    api.buildBoard(round);
    assert.equal(api.state.board.flat().length,30);
    assert.equal(api.state.ddCells.length,round === 'single' ? 1 : 2);
    for(const cell of api.state.board.flat()) {
      assert(cell.id && cell.sources?.length && cell.clue && cell.answer);
      assert(all.some(c => c.id === cell.id && c.answer === cell.answer));
    }
    assert(api.state.ddCells.every(([,row]) => row > 0));
  }
}
for (const clue of all) {
  const node = new Element('div');api.appendClueSources(node,clue);
  assert.equal(node.children[0].className,'clue-sources');
  const anchors=node.children[0].children.filter(n => n.tagName==='a');
  assert.equal(anchors.length,clue.sources.length);
  assert.equal(anchors[0].attributes.href,clue.sources[0].url);
  assert.equal(anchors[0].attributes.rel,'noopener noreferrer');
}
function answerElements() {
  const card=new Element('div'),footer=new Element('div'),buttons=new Element('div');card.appendChild(footer);return {card,footer,buttons};
}
for (const mode of ['solo','multi']) {
  api.state.playMode=mode;
  api.state.players=[{name:'Test',score:100,finalWager:0,finalCorrect:null}];
  for (const clue of all.filter(c => !c.category)) {
    api.state.currentClue={...clue,value:200};
    const {card,footer,buttons}=answerElements();api.revealAnswer(card,footer,buttons);
    assert(card.children[0].textContent.includes(clue.answer));
    assert(card.children[0].textContent.includes('Check the rule:'));
  }
}
api.state.playMode='solo';
api.state.currentClue={...all[0],isDD:true,ddPlayerIdx:0};
let els=answerElements();api.revealAnswer(els.card,els.footer,els.buttons);
assert.equal(els.buttons.children.length,2);
for (const clue of bank.final) {
  api.state.finalClue=clue;
  api.state.players=[{name:'Test',score:100,finalWager:50,finalCorrect:null}];
  els=answerElements();api.judgeFinal(els.card,els.footer,els.buttons);
  assert(els.card.children[0].textContent.includes(clue.answer));
  assert(els.card.children[0].textContent.includes('Check the rule:'));
}
// A scored clue still updates the board and score.
api.buildBoard('single');api.state.players=[{name:'Test',score:0}];api.state.currentClue={...api.state.board[0][0],colIdx:0,rowIdx:0};
api.resolveSolo(true);assert.equal(api.state.players[0].score,200);assert.equal(api.state.cluesLeft,29);assert(api.state.board[0][0].used);
console.log(JSON.stringify({clues:300,auditCoverage:300,boardGenerations:200,answerReveals:541,embeddedMatchesJson:true,counts:audit.counts}));
