/* Ollie Music — background shuffle player for Ollie-themed tools.
   Scoped: ONLY on pages that opt in with <script src="ollie-music.js" defer>.
   Does NOT touch the ContractingFM radio (cfm_v1) or its player.js.

   Behavior:
   - 8 Axolotl tracks, Fisher-Yates shuffle, reshuffle when deck depletes.
   - Base volume is low; ducks lower while Ollie is speaking so his
     talking beeps stay clearly on top.
   - Resumes across Ollie-page navigation via localStorage (ollie_music_v1).
   - Stays silent on load if ContractingFM (cfm_v1) is currently playing,
     so the two systems never collide.
   - Respects browser autoplay: on first load, waits for a user gesture
     before starting. After that, remembers state and auto-resumes.
*/
(function () {
  'use strict';

  var STATE_KEY = 'ollie_music_v1';
  var CFM_KEY   = 'cfm_v1';

  // Target volumes. Music is quiet on purpose so Ollie's beeps ride on top.
  var VOL_BASE = 0.22;
  var VOL_DUCK = 0.05;

  var AUDIO_DIR = 'audio/ollie/';
  var TRACKS = [
    'axolotl-01.mp3',
    'axolotl-02.mp3',
    'axolotl-03.mp3',
    'axolotl-04.mp3',
    'axolotl-05.mp3',
    'axolotl-06.mp3',
    'axolotl-07.mp3',
    'axolotl-08.mp3'
  ];

  /* ──────────── State ──────────── */
  var state = loadState();
  var audio = null;
  var mutedByUser = false;       // toggled by the button
  var currentTargetVol = VOL_BASE;
  var userHasInteracted = false; // set on first gesture; enables autoplay
  var hasStartedOnce = state && state.hasStartedOnce === true;
  // NOTE: we intentionally no longer mutex against ContractingFM via
  // localStorage. That check produced stale blocks because cfm_v1.wasPlaying
  // persists across sessions. If both players end up running at once, the
  // user can just pause one.
  var cfmBlocked = false;

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return fresh();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.deck) || parsed.deck.length === 0) {
        return fresh();
      }
      return parsed;
    } catch (e) { return fresh(); }
  }
  function fresh() {
    return {
      deck: shuffle(TRACKS.slice()),
      idx: 0,
      time: 0,
      wasPlaying: false,
      hasStartedOnce: false
    };
  }
  function saveState() {
    try {
      if (audio && !audio.paused) {
        state.time = audio.currentTime || 0;
        state.wasPlaying = true;
      } else if (audio) {
        state.time = audio.currentTime || 0;
        state.wasPlaying = false;
      }
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function cfmIsPlaying() {
    try {
      var raw = localStorage.getItem(CFM_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && (parsed.wasPlaying || parsed.isPlaying));
    } catch (e) { return false; }
  }

  /* ──────────── Audio element ──────────── */
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.volume = VOL_BASE;
    audio.addEventListener('ended', nextTrack);
    audio.addEventListener('error', function () {
      // Skip unplayable track after a short beat so we don't thrash.
      setTimeout(nextTrack, 400);
    });
    audio.src = AUDIO_DIR + state.deck[state.idx];
    return audio;
  }

  function nextTrack() {
    state.idx++;
    if (state.idx >= state.deck.length) {
      state.deck = shuffle(TRACKS.slice());
      state.idx = 0;
    }
    state.time = 0;
    if (audio) {
      audio.src = AUDIO_DIR + state.deck[state.idx];
      if (!mutedByUser) {
        audio.play().catch(function () { /* autoplay blocked */ });
      }
    }
    saveState();
    updateButton();
  }

  function play() {
    ensureAudio();
    if (cfmBlocked) return; // Don't fight ContractingFM.
    if (state.time && audio.currentTime < 0.1) {
      try { audio.currentTime = state.time; } catch (e) { /* seek may fail pre-metadata */ }
    }
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { /* autoplay blocked; wait for gesture */ });
    }
    hasStartedOnce = true;
    state.hasStartedOnce = true;
    state.wasPlaying = true;
    saveState();
    updateButton();
  }

  function pause() {
    if (!audio) return;
    audio.pause();
    state.time = audio.currentTime || 0;
    state.wasPlaying = false;
    saveState();
    updateButton();
  }

  /* ──────────── Ducking ──────────── */
  // Smoothly ramp audio.volume toward currentTargetVol.
  function rampStep() {
    if (!audio) return;
    var cur = audio.volume;
    var target = mutedByUser ? 0 : currentTargetVol;
    if (cfmBlocked) target = 0;
    var diff = target - cur;
    if (Math.abs(diff) < 0.005) {
      audio.volume = target;
    } else {
      audio.volume = Math.max(0, Math.min(1, cur + diff * 0.2));
    }
  }
  setInterval(rampStep, 40);

  // Poll for Ollie's talking state.
  setInterval(function () {
    var talking = !!(window.ollie && window.ollie.isTalking);
    currentTargetVol = talking ? VOL_DUCK : VOL_BASE;
  }, 80);

  // (Previously repolled cfm_v1; disabled — stale localStorage was causing
  // the Ollie player to refuse to start.)

  /* ──────────── UI button ──────────── */
  var btn = null;
  function buildButton() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'ollie-music-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle Ollie background music');
    btn.innerHTML = iconNote() + '<span class="ollie-music-label">MUSIC: OFF</span>';
    btn.addEventListener('click', onToggle);
    document.body.appendChild(btn);
    injectStyles();
    updateButton();
    return btn;
  }

  function iconNote() {
    // Simple pixel-style note glyph in SVG.
    return '<svg class="ollie-music-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<rect x="9" y="2" width="2" height="9" fill="currentColor"/>' +
      '<rect x="11" y="2" width="3" height="2" fill="currentColor"/>' +
      '<rect x="5" y="9" width="5" height="2" fill="currentColor"/>' +
      '<rect x="5" y="11" width="2" height="3" fill="currentColor"/>' +
      '<rect x="3" y="13" width="4" height="2" fill="currentColor"/>' +
      '</svg>';
  }

  function updateButton() {
    if (!btn) return;
    var label = btn.querySelector('.ollie-music-label');
    var playing = audio && !audio.paused && !audio.ended && !mutedByUser && !cfmBlocked;
    if (cfmBlocked) {
      label.textContent = 'MUSIC: CFM ON';
      btn.classList.remove('is-playing');
      btn.classList.add('is-blocked');
      btn.title = 'Ollie music is paused while ContractingFM is playing.';
    } else if (playing) {
      label.textContent = 'MUSIC: ON';
      btn.classList.add('is-playing');
      btn.classList.remove('is-blocked');
      btn.title = 'Click to mute Ollie background music.';
    } else {
      label.textContent = 'MUSIC: OFF';
      btn.classList.remove('is-playing');
      btn.classList.remove('is-blocked');
      btn.title = 'Click to play Ollie background music.';
    }
  }

  function onToggle() {
    userHasInteracted = true;
    if (cfmBlocked) {
      // User explicitly wants Ollie music; override CFM check for this click.
      // (If CFM is truly still playing, its own tab will keep going.)
      cfmBlocked = false;
    }
    if (!audio || audio.paused) {
      mutedByUser = false;
      play();
    } else {
      mutedByUser = true;
      pause();
    }
  }

  function injectStyles() {
    if (document.getElementById('ollie-music-styles')) return;
    var css = '' +
      '#ollie-music-toggle{' +
        'position:fixed;top:12px;right:12px;z-index:9999;' +
        'font-family:"Press Start 2P","VT323",monospace;font-size:10px;' +
        'line-height:1;letter-spacing:.5px;' +
        'padding:8px 10px 7px 8px;' +
        'background:#1a1f2b;color:#b8c4d8;' +
        'border:2px solid #2d3a52;border-radius:2px;' +
        'box-shadow:0 2px 0 #0a0e16;' +
        'cursor:pointer;display:inline-flex;align-items:center;gap:6px;' +
        'image-rendering:pixelated;' +
      '}' +
      '#ollie-music-toggle:hover{background:#232a3a;color:#e0e8f5;border-color:#3a4a66;}' +
      '#ollie-music-toggle.is-playing{color:#9de0a9;border-color:#3a6d4a;background:#1a2a20;}' +
      '#ollie-music-toggle.is-playing:hover{background:#22342a;}' +
      '#ollie-music-toggle.is-blocked{color:#6d7a8e;border-style:dashed;cursor:help;}' +
      '#ollie-music-toggle .ollie-music-icon{width:12px;height:12px;display:block;}' +
      '@media (max-width: 540px){' +
        '#ollie-music-toggle{top:8px;right:8px;font-size:9px;padding:6px 8px;}' +
      '}';
    var s = document.createElement('style');
    s.id = 'ollie-music-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ──────────── Wiring ──────────── */
  function firstGestureHandler() {
    userHasInteracted = true;
    if (!mutedByUser) play();
    window.removeEventListener('pointerdown', firstGestureHandler, true);
    window.removeEventListener('keydown', firstGestureHandler, true);
    window.removeEventListener('touchstart', firstGestureHandler, true);
  }

  function armGestureListeners() {
    window.addEventListener('pointerdown', firstGestureHandler, true);
    window.addEventListener('keydown', firstGestureHandler, true);
    window.addEventListener('touchstart', firstGestureHandler, true);
  }

  function init() {
    buildButton();
    ensureAudio();
    // Always try to play on load. Browsers commonly block autoplay without
    // a user gesture; in that case we arm listeners so the very next click
    // anywhere on the page starts the music.
    if (!mutedByUser) {
      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.then(function () {
          state.wasPlaying = true;
          saveState();
          updateButton();
        }).catch(function () {
          armGestureListeners();
        });
      }
    }
    updateButton();

    // Persist state often enough to survive nav / tab close.
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveState();
    });

    // Expose a tiny API in case other scripts want to duck / mute.
    window.OllieMusic = {
      play: function () { mutedByUser = false; play(); },
      pause: function () { mutedByUser = true; pause(); },
      toggle: onToggle,
      duckTo: function (v) { currentTargetVol = v; },
      resetDuck: function () { currentTargetVol = VOL_BASE; },
      isPlaying: function () { return !!(audio && !audio.paused); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
