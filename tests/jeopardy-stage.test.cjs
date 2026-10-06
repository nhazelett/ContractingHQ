const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'data/jeopardy-clues.json'), 'utf8'));

// Exercise actual screen and button handlers, including the dock/dialog boundary.
let document;
class Node {
  constructor(tag, text = '') { this.tagName = tag; this.value = ''; this.children = []; this.attributes = {}; this.style = {}; this.listeners = {}; this.className = ''; this._text = text; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { const index = this.children.indexOf(child); assert(index >= 0); this.children.splice(index, 1); child.parentNode = null; }
  insertBefore(child, before) { child.parentNode = this; const index = this.children.indexOf(before); assert(index >= 0); this.children.splice(index, 0, child); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'value') this.value = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.clear(); this._text = value; }
  set innerHTML(value) { this.clear(); this._text = ''; }
  clear() { for (const child of this.children) child.parentNode = null; this.children = []; }
  get isConnected() { let node = this; while (node) { if (node === document.body) return true; node = node.parentNode; } return false; }
  focus() { document.activeElement = this; }
  scrollIntoView() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { return descendants(this).filter(node => selector.split(',').some(part => matches(node, part.trim()))); }
  click() { assert(!this.disabled); this.listeners.click?.({currentTarget: this}); }
}
function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }
function matches(node, selector) {
  const enabled = selector.includes(':not(:disabled)');
  selector = selector.replace(':not(:disabled)', '');
  if (enabled && node.disabled) return false;
  if (selector.startsWith('.')) return node.className.split(' ').includes(selector.slice(1));
  if (selector === 'a[href]') return node.tagName === 'a' && !!node.attributes.href;
  return node.tagName === selector;
}
document = {body: new Node('body'), activeElement: null, createElement: tag => new Node(tag), createTextNode: text => new Node('#text', text)};
document.body.classList = {toggle() {}};
document.querySelector = selector => document.body.querySelector(selector);
document.getElementById = id => descendants(document.body).find(node => node.attributes.id === id);
function fixed(tag, id, parent) { const node = new Node(tag); node.setAttribute('id', id); parent.appendChild(node); return node; }
const nav = fixed('nav', 'navbar', document.body), main = fixed('main', 'main', document.body);
const stage = fixed('div', 'jStage', main);
for (const id of ['gameSound', 'gameSoundLabel', 'gameHelp', 'gameExit', 'howStrip']) fixed('button', id, main);
document.getElementById('howStrip').hidden = true;
let soundEnabled = true;
const Sounds = {enabled: () => soundEnabled, setEnabled: value => {soundEnabled = value;}, select() {}, correct() {}, wrong() {}, dailyDouble() {}, roundChange() {}, gameOver() {}, startThink() {}, stopThink() {}, timeUp() {}};
const context = {window: {CLUE_BANK_DATA: bank, Sounds, matchMedia: () => ({matches:false})}, Sounds, document, console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, Date, Math, confirm: () => true};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'scripts/jeopardy.js'), 'utf8') + '\nthis.api={state,renderStart,startGame,advanceRound,showGameOver};', context);
const {state} = context.api;
const buttons = node => node.querySelectorAll('button');
const button = (text, scope = stage) => { const found = buttons(scope).find(node => node.textContent === text); assert(found, 'Missing button: ' + text); return found; };
const overlay = () => document.querySelector('.overlay');
const boardButton = (c, r) => buttons(stage).find(node => node.attributes['data-col'] === String(c) && node.attributes['data-row'] === String(r));
context.api.renderStart();
button('Start Game').click();
assert.equal(document.getElementById('gameBoard').querySelectorAll('button').length, 30);
assert.equal(document.getElementById('gameExit').hidden, false);
boardButton(0, 0).click();
assert.equal(overlay().parentNode.attributes.id, 'clueDock');
assert.equal(document.getElementById('gameBoard').inert, true);
assert.equal(overlay().querySelectorAll('a').length, 0, 'Sources must not disclose answers before reveal');
button('Reveal Answer').click();
assert(overlay().querySelectorAll('a').length > 0);
assert.equal(document.activeElement.textContent, 'Correct');
button('Correct').click();
assert.equal(state.players[0].score, 200);
assert.equal(state.cluesLeft, 29);
assert(boardButton(0, 0).disabled);
assert.equal(overlay(), null);
assert.equal(document.activeElement.className, 'j-cell');
boardButton(1, 0).click(); button('Reveal Answer').click(); button('Incorrect').click();
assert.equal(state.players[0].score, 0);
boardButton(2, 0).click(); button('Reveal Answer').click(); button('Skip · no points').click();
assert.equal(state.players[0].score, 0);

const [dc, dr] = state.ddCells[0];
boardButton(dc, dr).click();
assert.equal(overlay().parentNode, document.body);
assert.equal(main.inert, true);
const wager = overlay().querySelector('input'); wager.value = '150';
button('Lock it in', overlay()).click();
assert.equal(main.inert, false);
assert.equal(overlay().parentNode.attributes.id, 'clueDock');
button('Reveal Answer').click();
buttons(overlay()).find(node => node.textContent.endsWith(' got it')).click();
assert.equal(state.players[0].score, 150);
assert.equal(state.cluesLeft, 26);

document.getElementById('gameSound').click();
assert.equal(soundEnabled, false);
assert.equal(document.getElementById('gameSoundLabel').textContent, 'Sound Off');
assert.equal(document.getElementById('gameSound').attributes['aria-pressed'], 'false');
document.getElementById('gameHelp').click();
assert.equal(document.getElementById('howStrip').hidden, false);
assert.equal(document.getElementById('gameHelp').attributes['aria-expanded'], 'true');
document.getElementById('gameHelp').click();
assert.equal(document.getElementById('howStrip').hidden, true);
document.getElementById('gameExit').click();
assert.equal(state.screen, 'start');
assert.equal(document.getElementById('gameExit').hidden, true);

button('Multiplayer').click();
button('+ Add player').click();
assert.equal(state.players.length, 3);
button('×').click();
assert.equal(state.players.length, 2);
button('Start Game').click();
boardButton(0, 0).click(); button('Reveal Answer').click();
buttons(overlay()).find(node => node.textContent === state.players[1].name + ' ✓').click();
assert.equal(state.players[1].score, 200);
// Resolve every remaining clue in both rounds through the controls users see.
let completed = 1, dailyDoubles = 0;
function finishBoard() {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
    const cell = state.board[c][r]; if (cell.used) continue;
    boardButton(c, r).click();
    if (cell.dd) {
      button(state.players[0].name, overlay()).click();
      assert.equal(main.inert, true);
      overlay().querySelector('input').value = '100';
      button('Lock it in', overlay()).click();
      assert.equal(main.inert, false);
      dailyDoubles++;
    }
    button('Reveal Answer').click();
    if (cell.dd) buttons(overlay()).find(node => node.textContent.endsWith(' got it')).click();
    else buttons(overlay()).find(node => node.textContent === state.players[0].name + ' ✓').click();
    completed++;
  }
  assert.equal(state.cluesLeft, 0);
}
finishBoard(); context.api.advanceRound();
assert.equal(overlay().attributes.role, 'dialog');
button('Continue', overlay()).click();
assert.equal(state.round, 'double'); assert.equal(main.inert, false);
assert.equal(state.board[0][4].value, 2000);
finishBoard(); context.api.advanceRound(); button('Continue', overlay()).click();
assert.equal(state.round, 'final');
assert.equal(main.inert, true);
overlay().querySelector('input').value = '500'; button('Lock wager', overlay()).click();
overlay().querySelector('input').value = '0'; button('Lock wager', overlay()).click();
assert.equal(state.screen, 'finalClue');
assert.equal(overlay().parentNode, document.body);
button('Reveal Answer', overlay()).click();
assert(overlay().querySelectorAll('a').length > 0);
const scoresBefore = state.players.map(player => player.score);
document.getElementById('final-right-0').click(); document.getElementById('final-wrong-1').click();
assert.equal(state.players[0].score, scoresBefore[0] + 500);
assert.equal(state.players[1].score, scoresBefore[1]);
// Completion timer is disabled in this adapter; invoke the same next screen.
overlay().parentNode.removeChild(overlay()); main.inert = false; nav.inert = false;
context.api.showGameOver(); button('Play again').click();
assert.equal(state.screen, 'start');
assert(state.players.every(player => player.score === 0));
assert.equal(completed, 60); assert.equal(dailyDoubles, 3);
console.log(JSON.stringify({roundsCompleted:3,boardCluesPlayed:60,dailyDoubles:3,dockAndDialogMounting:true,keyboardFocus:true,sourcesOnReveal:true,soundAndHelpControls:true,soloAndMultiplayer:true,zeroFinalWager:true}));
