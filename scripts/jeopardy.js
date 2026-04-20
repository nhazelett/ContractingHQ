/* ======================================================================
   Contracting Jeopardy — game engine
   ======================================================================
   State machine: start -> board -> clue (or ddWager -> clue) -> board ...
                  -> transition -> board (double) -> transition
                  -> finalWager -> finalClue -> finalJudge -> gameover
   ====================================================================== */

const SINGLE_VALUES = [200, 400, 600, 800, 1000];
const DOUBLE_VALUES = [400, 800, 1200, 1600, 2000];
const CLUE_TIMER_SECONDS = 25;
const FINAL_TIMER_SECONDS = 30;

let CLUE_BANK = null;

const state = {
  screen: 'start',
  playMode: 'solo',
  players: [{ name: 'Player 1', score: 0, finalWager: 0, finalCorrect: null }],
  round: 'single',
  categories: [],            // 6 category names for current round
  board: [],                 // 6x5 cells
  ddCells: [],               // [[colIdx, rowIdx], ...]
  currentClue: null,         // { colIdx, rowIdx, value, clue, answer, dd }
  cluesLeft: 30,
  finalCat: '',
  finalClue: null,
  finalPlayerIdx: 0,         // for wager/judge walk-through
  timerHandle: null,
};

const stage = document.getElementById('jStage');

/* ─── Utilities ─── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids) {
    if (kid == null) continue;
    n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return n;
}
function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString();
}

/* ─── Load clue bank ─── */
async function loadBank() {
  // Prefer embedded JS data (works on file:// and http(s)://)
  if (window.CLUE_BANK_DATA) {
    CLUE_BANK = window.CLUE_BANK_DATA;
    return true;
  }
  // Fallback: fetch JSON (works only over http(s)://)
  try {
    const res = await fetch('data/jeopardy-clues.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    CLUE_BANK = await res.json();
  } catch (e) {
    stage.innerHTML = '<div class="start-card"><h2>Clue bank failed to load</h2><p style="color:#f87171;text-align:center">' +
      e.message + '</p><p style="color:#c8d4e0;text-align:center;font-size:0.85rem">Make sure data/jeopardy-clues.js (or .json) is deployed.</p></div>';
    return false;
  }
  return true;
}

/* ─── Start screen ─── */
function renderStart() {
  state.screen = 'start';
  state.round = 'single';
  state.players.forEach(p => { p.score = 0; p.finalWager = 0; p.finalCorrect = null; });

  const card = el('div', { class: 'start-card' });
  card.appendChild(el('h2', {}, 'New Game'));

  // Play mode
  const modeStep = el('div', { class: 'start-step' });
  modeStep.appendChild(el('label', {}, 'Play Mode'));
  const modeToggle = el('div', { class: 'mode-toggle' });
  const soloBtn = el('button', {
    class: 'mode-btn' + (state.playMode === 'solo' ? ' active' : ''),
    onclick: () => { state.playMode = 'solo'; renderStart(); }
  }, 'Solo');
  const multiBtn = el('button', {
    class: 'mode-btn' + (state.playMode === 'multi' ? ' active' : ''),
    onclick: () => { state.playMode = 'multi'; renderStart(); }
  }, 'Multiplayer');
  modeToggle.appendChild(soloBtn);
  modeToggle.appendChild(multiBtn);
  modeStep.appendChild(modeToggle);
  card.appendChild(modeStep);

  // Players
  if (state.playMode === 'multi') {
    if (state.players.length < 2) {
      state.players = [
        { name: 'Player 1', score: 0, finalWager: 0, finalCorrect: null },
        { name: 'Player 2', score: 0, finalWager: 0, finalCorrect: null }
      ];
    }
  } else {
    state.players = [{ name: state.players[0]?.name || 'You', score: 0, finalWager: 0, finalCorrect: null }];
  }

  const pStep = el('div', { class: 'start-step' });
  pStep.appendChild(el('label', {}, state.playMode === 'solo' ? 'Your name' : 'Players'));
  const rows = el('div', { class: 'player-rows' });
  state.players.forEach((p, i) => {
    const row = el('div', { class: 'player-row' });
    const input = el('input', { type: 'text', value: p.name, placeholder: 'Name', maxlength: '20' });
    input.addEventListener('input', e => { state.players[i].name = e.target.value; });
    row.appendChild(input);
    if (state.playMode === 'multi' && state.players.length > 2) {
      const rm = el('button', {
        class: 'remove-player',
        onclick: () => { state.players.splice(i, 1); renderStart(); }
      }, '×');
      row.appendChild(rm);
    }
    rows.appendChild(row);
  });
  pStep.appendChild(rows);
  if (state.playMode === 'multi' && state.players.length < 4) {
    const addBtn = el('button', {
      class: 'add-player-btn',
      onclick: () => {
        state.players.push({ name: 'Player ' + (state.players.length + 1), score: 0, finalWager: 0, finalCorrect: null });
        renderStart();
      }
    }, '+ Add player');
    pStep.appendChild(addBtn);
  }
  card.appendChild(pStep);

  // Sound toggle
  if (window.Sounds) {
    const soundStep = el('div', { class: 'start-step' });
    soundStep.appendChild(el('label', {}, 'Sound Effects'));
    const soundToggle = el('div', { class: 'mode-toggle' });
    const soundOnBtn = el('button', {
      class: 'mode-btn' + (Sounds.enabled() ? ' active' : ''),
      onclick: () => { Sounds.setEnabled(true); Sounds.select(); renderStart(); }
    }, 'On');
    const soundOffBtn = el('button', {
      class: 'mode-btn' + (!Sounds.enabled() ? ' active' : ''),
      onclick: () => { Sounds.setEnabled(false); renderStart(); }
    }, 'Off');
    soundToggle.appendChild(soundOnBtn);
    soundToggle.appendChild(soundOffBtn);
    soundStep.appendChild(soundToggle);
    card.appendChild(soundStep);
  }

  const goBtn = el('button', {
    class: 'start-go',
    onclick: startGame
  }, 'Start Game');
  card.appendChild(goBtn);

  stage.innerHTML = '';
  stage.appendChild(card);
}

/* ─── Build a round's board from the bank ─── */
function buildBoard(roundKey) {
  const roundBank = CLUE_BANK[roundKey];
  const catNames = Object.keys(roundBank);
  const chosen = shuffle(catNames).slice(0, 6);
  const values = roundKey === 'single' ? SINGLE_VALUES : DOUBLE_VALUES;

  const board = chosen.map((cat, colIdx) => {
    return values.map((val, rowIdx) => {
      const diffKey = String(rowIdx + 1);
      const pool = roundBank[cat][diffKey] || [];
      if (!pool.length) {
        return { cat, value: val, clue: '(clue missing)', answer: '?', used: false, dd: false };
      }
      const chosenClue = pick(pool);
      return {
        cat,
        value: val,
        clue: chosenClue.clue,
        answer: chosenClue.answer,
        used: false,
        dd: false
      };
    });
  });

  // Daily Doubles: 1 for single, 2 for double, never on top row
  const ddCount = roundKey === 'single' ? 1 : 2;
  const ddCells = [];
  while (ddCells.length < ddCount) {
    const col = Math.floor(Math.random() * 6);
    const row = 1 + Math.floor(Math.random() * 4);   // rows 1-4 (skip $200/$400 top row)
    if (!ddCells.some(c => c[0] === col && c[1] === row)) {
      ddCells.push([col, row]);
      board[col][row].dd = true;
    }
  }

  state.categories = chosen;
  state.board = board;
  state.ddCells = ddCells;
  state.cluesLeft = 30;
}

/* ─── Start game ─── */
function startGame() {
  state.round = 'single';
  state.players.forEach(p => { p.score = 0; p.finalWager = 0; p.finalCorrect = null; });
  buildBoard('single');
  renderBoard();
}

/* ─── Board screen ─── */
function renderBoard() {
  state.screen = 'board';
  const wrap = el('div');

  // Round bar + scoreboard
  wrap.appendChild(renderRoundBar());

  // Board grid
  const board = el('div', { class: 'j-board' });
  // Category headers (top row)
  state.categories.forEach(cat => {
    board.appendChild(el('div', { class: 'j-cat' }, cat));
  });
  // Value cells (5 rows, each row = one value across all categories)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const cell = state.board[c][r];
      const cls = 'j-cell' + (cell.used ? ' used' : '');
      const cellEl = el('div', {
        class: cls,
        onclick: () => { if (!cell.used) openClue(c, r); }
      }, cell.used ? '' : fmtMoney(cell.value));
      board.appendChild(cellEl);
    }
  }
  wrap.appendChild(board);

  stage.innerHTML = '';
  stage.appendChild(wrap);

  if (state.cluesLeft === 0) {
    setTimeout(() => advanceRound(), 500);
  }
}

function renderRoundBar() {
  const bar = el('div', { class: 'round-bar' });

  const left = el('div');
  const label = state.round === 'single' ? 'Jeopardy Round' :
                state.round === 'double' ? 'Double Jeopardy' : 'Final Jeopardy';
  left.appendChild(el('div', { class: 'round-label' }, label));
  left.appendChild(el('div', { class: 'round-sub' }, state.cluesLeft + ' clue' + (state.cluesLeft === 1 ? '' : 's') + ' remaining'));
  bar.appendChild(left);

  const board = el('div', { class: 'scoreboard' });
  state.players.forEach((p, i) => {
    const active = state.playMode === 'multi' && false;  // no fixed active turn; we pick on correct
    const pill = el('div', { class: 'score-pill' + (active ? ' active' : '') });
    pill.appendChild(el('div', { class: 'score-name' }, p.name));
    const v = el('div', { class: 'score-value' + (p.score < 0 ? ' negative' : '') }, fmtMoney(p.score));
    pill.appendChild(v);
    board.appendChild(pill);
  });
  bar.appendChild(board);

  const quit = el('button', {
    class: 'quit-btn',
    onclick: () => { if (confirm('Quit game and return to start?')) renderStart(); }
  }, 'Quit');
  bar.appendChild(quit);

  return bar;
}

/* ─── Open a clue ─── */
function openClue(colIdx, rowIdx) {
  const cell = state.board[colIdx][rowIdx];
  state.currentClue = { colIdx, rowIdx, ...cell };

  if (cell.dd) {
    if (window.Sounds) Sounds.dailyDouble();
    openDailyDoubleWager();
  } else {
    if (window.Sounds) Sounds.select();
    renderClueOverlay(cell.value);
  }
}

function openDailyDoubleWager() {
  state.screen = 'ddWager';
  // In multi, whoever picked theoretically wagers. We keep this simple: the first player with the top score picks up the DD.
  // Better: if solo, just wager. If multi, ask "who found the Daily Double?" then wager.
  if (state.playMode === 'multi') {
    // Ask who selected
    const overlay = el('div', { class: 'overlay' });
    const card = el('div', { class: 'wager-card' });
    card.appendChild(el('h2', {}, 'Daily Double!'));
    card.appendChild(el('p', {}, 'Who selected this clue?'));
    const who = el('div', { class: 'who-players' });
    state.players.forEach((p, i) => {
      who.appendChild(el('button', {
        class: 'who-btn',
        onclick: () => {
          document.body.removeChild(overlay);
          openDailyDoubleWagerFor(i);
        }
      }, p.name));
    });
    card.appendChild(who);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  } else {
    openDailyDoubleWagerFor(0);
  }
}

function openDailyDoubleWagerFor(playerIdx) {
  const player = state.players[playerIdx];
  const maxBoardVal = state.round === 'single' ? 1000 : 2000;
  const maxWager = Math.max(maxBoardVal, player.score);
  const minWager = 5;

  const overlay = el('div', { class: 'overlay' });
  const card = el('div', { class: 'wager-card' });
  card.appendChild(el('div', { class: 'clue-dd-flag' }, '★ Daily Double'));
  card.appendChild(el('h2', {}, 'Make your wager'));
  card.appendChild(el('p', {}, 'Category: ' + state.currentClue.cat));
  if (state.playMode === 'multi') card.appendChild(el('div', { class: 'wager-player' }, player.name));
  const input = el('input', { type: 'number', min: String(minWager), max: String(maxWager), value: String(Math.min(maxBoardVal, maxWager)) });
  card.appendChild(input);
  card.appendChild(el('div', { class: 'wager-range' }, 'Min $' + minWager + ' · Max ' + fmtMoney(maxWager)));
  const submit = el('button', {
    class: 'wager-submit',
    onclick: () => {
      let w = parseInt(input.value, 10);
      if (isNaN(w) || w < minWager) w = minWager;
      if (w > maxWager) w = maxWager;
      document.body.removeChild(overlay);
      renderClueOverlay(w, playerIdx, true);
    }
  }, 'Lock it in');
  card.appendChild(submit);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

/* ─── Clue overlay ─── */
function renderClueOverlay(value, ddPlayerIdx = null, isDD = false) {
  state.screen = 'clue';
  state.currentClue.wagerValue = value;
  state.currentClue.ddPlayerIdx = ddPlayerIdx;
  state.currentClue.isDD = isDD;

  const overlay = el('div', { class: 'overlay' });
  const card = el('div', { class: 'clue-card' });

  if (isDD) {
    card.appendChild(el('div', { class: 'clue-dd-flag' }, '★ Daily Double · ' + fmtMoney(value)));
  }

  const head = el('div', { class: 'clue-head' });
  head.appendChild(el('div', { class: 'clue-cat' }, state.currentClue.cat));
  if (!isDD) head.appendChild(el('div', { class: 'clue-val' }, fmtMoney(value)));
  card.appendChild(head);

  const clueText = el('div', { class: 'clue-text' }, state.currentClue.clue);
  card.appendChild(clueText);

  const footer = el('div', { class: 'clue-footer' });

  // Timer
  const timerWrap = el('div', { class: 'clue-timer' });
  timerWrap.innerHTML = '<div>Take your time · <span id="tRem">' + CLUE_TIMER_SECONDS + 's</span></div><div class="clue-timer-bar"><div class="clue-timer-bar-fill" id="tBar" style="width:100%"></div></div>';
  footer.appendChild(timerWrap);

  // Button area
  const btns = el('div', { class: 'clue-buttons' });
  const revealBtn = el('button', {
    class: 'clue-btn clue-btn-reveal',
    onclick: () => revealAnswer(card, footer, btns)
  }, 'Reveal Answer');
  btns.appendChild(revealBtn);
  footer.appendChild(btns);

  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  startTimer(CLUE_TIMER_SECONDS);
}

function startTimer(seconds) {
  clearInterval(state.timerHandle);
  const start = Date.now();
  const rem = document.getElementById('tRem');
  const bar = document.getElementById('tBar');
  let firedTimeUp = false;
  state.timerHandle = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    const left = Math.max(0, seconds - elapsed);
    if (rem) rem.textContent = left.toFixed(0) + 's';
    if (bar) bar.style.width = (100 * left / seconds) + '%';
    if (left <= 0) {
      clearInterval(state.timerHandle);
      if (!firedTimeUp) {
        firedTimeUp = true;
        if (window.Sounds) {
          Sounds.stopThink();
          Sounds.timeUp();
        }
      }
    }
  }, 100);
}

function revealAnswer(card, footer, btns) {
  clearInterval(state.timerHandle);
  // Insert answer
  const ans = el('div', { class: 'clue-answer' });
  ans.appendChild(el('span', { class: 'ans-label' }, 'Answer'));
  ans.appendChild(document.createTextNode(state.currentClue.answer));
  card.insertBefore(ans, footer);

  // Replace buttons
  btns.innerHTML = '';

  if (state.currentClue.isDD) {
    // DD: single player, just right/wrong
    const pIdx = state.currentClue.ddPlayerIdx;
    btns.appendChild(el('button', {
      class: 'clue-btn clue-btn-right',
      onclick: () => resolveDD(pIdx, true)
    }, state.players[pIdx].name + ' got it'));
    btns.appendChild(el('button', {
      class: 'clue-btn clue-btn-wrong',
      onclick: () => resolveDD(pIdx, false)
    }, 'Missed'));
    return;
  }

  if (state.playMode === 'solo') {
    btns.appendChild(el('button', {
      class: 'clue-btn clue-btn-right',
      onclick: () => resolveSolo(true)
    }, 'I got it'));
    btns.appendChild(el('button', {
      class: 'clue-btn clue-btn-wrong',
      onclick: () => resolveSolo(false)
    }, 'Missed it'));
    btns.appendChild(el('button', {
      class: 'clue-btn clue-btn-skip',
      onclick: () => resolveSolo(null)
    }, 'No points'));
  } else {
    // Multi: who got it?
    const label = el('div', { class: 'who-label' }, 'Who got it?');
    const who = el('div', { class: 'who-players' });
    state.players.forEach((p, i) => {
      who.appendChild(el('button', {
        class: 'who-btn',
        onclick: () => resolveMulti(i, true)
      }, p.name + ' ✓'));
    });
    state.players.forEach((p, i) => {
      who.appendChild(el('button', {
        class: 'who-btn',
        style: 'background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#f87171',
        onclick: () => resolveMulti(i, false)
      }, p.name + ' ✗'));
    });
    who.appendChild(el('button', {
      class: 'who-btn no-one',
      onclick: () => resolveMulti(null, null)
    }, 'No one'));
    btns.appendChild(label);
    btns.appendChild(who);
  }
}

function closeOverlay() {
  const overlay = document.querySelector('.overlay');
  if (overlay) document.body.removeChild(overlay);
}

function markCellUsed() {
  const { colIdx, rowIdx } = state.currentClue;
  state.board[colIdx][rowIdx].used = true;
  state.cluesLeft--;
}

function resolveSolo(correct) {
  if (correct === true) {
    state.players[0].score += state.currentClue.value;
    if (window.Sounds) Sounds.correct();
  } else if (correct === false) {
    state.players[0].score -= state.currentClue.value;
    if (window.Sounds) Sounds.wrong();
  }
  markCellUsed();
  closeOverlay();
  renderBoard();
}

function resolveMulti(playerIdx, correct) {
  if (playerIdx != null) {
    const delta = state.currentClue.value * (correct ? 1 : -1);
    state.players[playerIdx].score += delta;
    if (window.Sounds) (correct ? Sounds.correct() : Sounds.wrong());
  }
  markCellUsed();
  closeOverlay();
  renderBoard();
}

function resolveDD(playerIdx, correct) {
  const delta = state.currentClue.wagerValue * (correct ? 1 : -1);
  state.players[playerIdx].score += delta;
  if (window.Sounds) (correct ? Sounds.correct() : Sounds.wrong());
  markCellUsed();
  closeOverlay();
  renderBoard();
}

/* ─── Round transitions ─── */
function advanceRound() {
  if (window.Sounds) Sounds.roundChange();
  if (state.round === 'single') {
    showTransition('Double Jeopardy!', 'Values doubled. Two Daily Doubles live on the board. Continue?', () => {
      state.round = 'double';
      buildBoard('double');
      renderBoard();
    });
  } else if (state.round === 'double') {
    showTransition('Final Jeopardy!', 'One clue. Wager anything from zero up to your current score. Negative scores sit out the final round.', () => {
      startFinal();
    });
  }
}

function showTransition(title, subtitle, onNext) {
  const overlay = el('div', { class: 'overlay' });
  const card = el('div', { class: 'transition-card' });
  card.appendChild(el('h1', {}, title));
  card.appendChild(el('p', {}, subtitle));
  card.appendChild(el('button', {
    class: 'again-btn',
    onclick: () => { document.body.removeChild(overlay); onNext(); }
  }, 'Continue'));
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/* ─── Final Jeopardy ─── */
function startFinal() {
  state.round = 'final';
  const pool = CLUE_BANK.final;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.finalClue = pick;
  state.finalCat = pick.category;
  state.finalPlayerIdx = 0;
  nextFinalWager();
}

function eligiblePlayers() {
  return state.players.map((p, i) => ({ p, i })).filter(x => x.p.score > 0);
}

function nextFinalWager() {
  const eligible = eligiblePlayers();
  if (eligible.length === 0) {
    // No one can wager; go straight to reveal
    revealFinal();
    return;
  }
  if (state.finalPlayerIdx >= state.players.length) {
    showFinalClue();
    return;
  }
  const player = state.players[state.finalPlayerIdx];
  if (player.score <= 0) {
    player.finalWager = 0;
    state.finalPlayerIdx++;
    nextFinalWager();
    return;
  }

  const overlay = el('div', { class: 'overlay' });
  const card = el('div', { class: 'wager-card' });
  card.appendChild(el('h2', {}, 'Final Jeopardy Wager'));
  card.appendChild(el('p', {}, 'Category: ' + state.finalCat));
  if (state.playMode === 'multi') card.appendChild(el('div', { class: 'wager-player' }, player.name));
  card.appendChild(el('p', {}, 'Current score: ' + fmtMoney(player.score)));
  const input = el('input', { type: 'number', min: '0', max: String(player.score), value: '0' });
  card.appendChild(input);
  card.appendChild(el('div', { class: 'wager-range' }, 'Min $0 · Max ' + fmtMoney(player.score)));
  const submit = el('button', {
    class: 'wager-submit',
    onclick: () => {
      let w = parseInt(input.value, 10);
      if (isNaN(w) || w < 0) w = 0;
      if (w > player.score) w = player.score;
      player.finalWager = w;
      state.finalPlayerIdx++;
      document.body.removeChild(overlay);
      nextFinalWager();
    }
  }, 'Lock wager');
  card.appendChild(submit);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

function showFinalClue() {
  state.finalPlayerIdx = 0;

  const overlay = el('div', { class: 'overlay' });
  const card = el('div', { class: 'clue-card' });
  card.appendChild(el('div', { class: 'clue-dd-flag' }, '★ Final Jeopardy'));
  const head = el('div', { class: 'clue-head' });
  head.appendChild(el('div', { class: 'clue-cat' }, state.finalCat));
  card.appendChild(head);
  card.appendChild(el('div', { class: 'clue-text' }, state.finalClue.clue));
  const footer = el('div', { class: 'clue-footer' });
  footer.innerHTML = '<div class="clue-timer"><div>Think music · <span id="tRem">' + FINAL_TIMER_SECONDS + 's</span></div><div class="clue-timer-bar"><div class="clue-timer-bar-fill" id="tBar" style="width:100%"></div></div></div>';
  const btns = el('div', { class: 'clue-buttons' });
  btns.appendChild(el('button', {
    class: 'clue-btn clue-btn-reveal',
    onclick: () => {
      clearInterval(state.timerHandle);
      judgeFinal(card, footer, btns);
    }
  }, 'Reveal Answer'));
  footer.appendChild(btns);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  startTimer(FINAL_TIMER_SECONDS);
  if (window.Sounds) Sounds.startThink();
}

function judgeFinal(card, footer, btns) {
  if (window.Sounds) Sounds.stopThink();
  // Show answer
  const ans = el('div', { class: 'clue-answer' });
  ans.appendChild(el('span', { class: 'ans-label' }, 'Answer'));
  ans.appendChild(document.createTextNode(state.finalClue.answer));
  card.insertBefore(ans, footer);

  btns.innerHTML = '';

  // Walk player by player
  const label = el('div', { class: 'who-label' }, 'Mark each player');
  const who = el('div', { class: 'who-players' });
  state.players.forEach((p, i) => {
    if (p.score <= 0) return;
    const rowDiv = el('div', { style: 'display:flex;gap:0.3rem;align-items:center;margin:0.25rem' });
    rowDiv.appendChild(el('span', { style: 'color:#c8d4e0;font-weight:600;margin-right:0.4rem;min-width:80px;text-align:right' },
      p.name + ' (wagered ' + fmtMoney(p.finalWager) + ')'));
    rowDiv.appendChild(el('button', {
      class: 'who-btn',
      id: 'final-right-' + i,
      onclick: () => {
        p.finalCorrect = true;
        p.score += p.finalWager;
        document.getElementById('final-right-' + i).disabled = true;
        document.getElementById('final-wrong-' + i).disabled = true;
        document.getElementById('final-right-' + i).style.opacity = '0.4';
        document.getElementById('final-wrong-' + i).style.opacity = '0.4';
        checkFinalDone();
      }
    }, '✓'));
    rowDiv.appendChild(el('button', {
      class: 'who-btn',
      id: 'final-wrong-' + i,
      style: 'background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);color:#f87171',
      onclick: () => {
        p.finalCorrect = false;
        p.score -= p.finalWager;
        document.getElementById('final-right-' + i).disabled = true;
        document.getElementById('final-wrong-' + i).disabled = true;
        document.getElementById('final-right-' + i).style.opacity = '0.4';
        document.getElementById('final-wrong-' + i).style.opacity = '0.4';
        checkFinalDone();
      }
    }, '✗'));
    who.appendChild(rowDiv);
  });
  btns.appendChild(label);
  btns.appendChild(who);

  // If no one was eligible, just go to game over
  if (eligiblePlayers().length === 0) {
    setTimeout(() => { closeOverlay(); showGameOver(); }, 1500);
  }
}

function checkFinalDone() {
  const pending = state.players.some(p => p.score > 0 && p.finalCorrect === null && p.finalWager !== 0) ||
    // Also: any eligible player at this point must have finalCorrect set. finalWager of 0 is allowed.
    state.players.some((p, i) => {
      if (p.score <= 0) return false;
      return p.finalCorrect === null;
    });
  // We're done when every eligible player has finalCorrect set
  const unresolved = state.players.filter(p => p.score > -999999 && p.finalCorrect === null && p.finalWager !== 0);
  const anyLeft = state.players.some(p => {
    // eligible meant score > 0 at wager time. We tracked by resetting finalCorrect before round.
    // At this point, finalCorrect is null for players who never wagered (score <=0) AND for unresolved.
    // Use a flag: eligible at wager time stored in finalWager? Good enough: if they have finalWager > 0 OR we set finalCorrect to null only for eligible.
    return false;
  });
  // Simpler: count eligible = those whose finalWager was set and score was >0 at time of wager.
  // We'll track differently: any player with finalCorrect === null after judge phase is unresolved ONLY if they wagered something OR were eligible.
  // Even simpler rule: all buttons disabled = done.
  const allResolved = state.players.every((p, i) => {
    const btn = document.getElementById('final-right-' + i);
    return !btn || btn.disabled;
  });
  if (allResolved) {
    setTimeout(() => { closeOverlay(); showGameOver(); }, 600);
  }
}

function revealFinal() {
  // Edge case: no one eligible
  showFinalClue();
}

/* ─── Game over ─── */
function showGameOver() {
  state.screen = 'gameover';
  if (window.Sounds) { Sounds.stopThink(); Sounds.gameOver(); }
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const card = el('div', { class: 'gameover-card' });
  card.appendChild(el('h1', {}, 'Game Over'));
  const subMsg = state.players.length === 1
    ? 'Final score: ' + fmtMoney(winner.score)
    : (winner.score > 0 ? winner.name + ' wins with ' + fmtMoney(winner.score) : 'No winner — all scores zero or below.');
  card.appendChild(el('div', { class: 'gameover-sub' }, subMsg));

  sorted.forEach((p, idx) => {
    const row = el('div', { class: 'standings-row' + (idx === 0 && p.score > 0 ? ' winner' : '') });
    row.appendChild(el('div', { class: 'standings-rank' }, String(idx + 1)));
    row.appendChild(el('div', { class: 'standings-name' }, p.name));
    const scoreEl = el('div', { class: 'standings-score' + (p.score < 0 ? ' negative' : '') }, fmtMoney(p.score));
    row.appendChild(scoreEl);
    card.appendChild(row);
  });

  card.appendChild(el('button', {
    class: 'again-btn',
    onclick: () => renderStart()
  }, 'Play again'));

  stage.innerHTML = '';
  stage.appendChild(card);
}

/* ─── Boot ─── */
(async function boot() {
  stage.innerHTML = '<div class="start-card"><h2>Loading clue bank…</h2></div>';
  const ok = await loadBank();
  if (ok) renderStart();
})();
