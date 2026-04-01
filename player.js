/* ================================================================
   ContractingFM — Persistent Audio Player
   kthq.org | player.js
   ================================================================ */

(function () {
  'use strict';

  // ── PLAYLIST ────────────────────────────────────────────────────
  var TRACKS = [
    { id: 1, title: '52.217-8',                          subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-01.mp3', color: '#4a9eff' },
    { id: 2, title: 'FAR Part 1 Guiding Principals',     subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-02.mp3', color: '#8b5cf6' },
    { id: 3, title: "FAR Part 6 Doesn't Apply to SAP",   subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-03.mp3', color: '#059669' },
    { id: 4, title: 'Start at Zero',                     subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-04.mp3', color: '#d97706' },
    { id: 5, title: 'Stop Putting Ceilings on your BPAs!', subtitle: 'ContractingFM', genre: 'ContractingFM', file: 'audio/track-05.mp3', color: '#dc2626' }
  ];

  // ── STATE ────────────────────────────────────────────────────────
  var SK = 'cfm_v1';
  var state = { idx: 0, time: 0, vol: 0.75, shuffle: false, favs: [], wasPlaying: false };

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(SK));
      if (s) {
        if (typeof s.idx === 'number')   state.idx     = Math.min(s.idx, TRACKS.length - 1);
        if (typeof s.time === 'number')  state.time    = s.time;
        if (typeof s.vol === 'number')   state.vol     = s.vol;
        if (typeof s.shuffle === 'boolean') state.shuffle = s.shuffle;
        if (Array.isArray(s.favs))       state.favs    = s.favs;
        if (typeof s.wasPlaying === 'boolean') state.wasPlaying = s.wasPlaying;
      }
    } catch (e) {}
  }

  function saveState() {
    try { localStorage.setItem(SK, JSON.stringify(state)); } catch (e) {}
  }

  // ── AUDIO ENGINE ─────────────────────────────────────────────────
  var aud = new Audio();
  var isPlaying = false;
  var playerReady = false;
  loadState();
  aud.volume = state.vol;

  function trackUrl(idx) {
    var origin = window.location.origin;
    return origin + '/' + TRACKS[idx].file;
  }

  function loadTrack(idx, autoplay) {
    if (idx < 0 || idx >= TRACKS.length) return;
    state.idx = idx;
    state.time = 0;
    aud.src = trackUrl(idx);
    aud.load();
    updateAll();
    saveState();
    if (autoplay) aud.play().catch(function () {});
  }

  function togglePlay() {
    if (!playerReady) { loadTrack(state.idx, true); playerReady = true; return; }
    if (isPlaying) { aud.pause(); }
    else { aud.play().catch(function () {}); }
  }

  function nextTrack() {
    var next;
    if (state.shuffle) {
      do { next = Math.floor(Math.random() * TRACKS.length); }
      while (TRACKS.length > 1 && next === state.idx);
    } else {
      next = (state.idx + 1) % TRACKS.length;
    }
    loadTrack(next, isPlaying);
  }

  function prevTrack() {
    if (aud.currentTime > 3) { aud.currentTime = 0; return; }
    loadTrack((state.idx - 1 + TRACKS.length) % TRACKS.length, isPlaying);
  }

  function isFav(idx) { return state.favs.indexOf(idx) > -1; }

  function toggleFav(idx) {
    var i = state.favs.indexOf(idx);
    if (i > -1) state.favs.splice(i, 1); else state.favs.push(idx);
    saveState();
    updateAll();
  }

  function fmt(s) {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // Audio event listeners
  aud.addEventListener('play',   function () { isPlaying = true;  updatePlayBtns(); });
  aud.addEventListener('pause',  function () { isPlaying = false; updatePlayBtns(); saveState(); });
  aud.addEventListener('ended',  nextTrack);
  var lastSave = 0;
  aud.addEventListener('timeupdate', function () {
    state.time = aud.currentTime;
    updateProgress();
    // Save to localStorage every 5 seconds so navigation never loses more than 5s
    var now = Date.now();
    if (now - lastSave > 5000) { saveState(); lastSave = now; }
  });
  aud.addEventListener('error',  function () { setTimeout(nextTrack, 1200); });

  window.addEventListener('beforeunload', function () { state.time = aud.currentTime; state.wasPlaying = isPlaying; saveState(); });

  // ── DETECT PAGE ──────────────────────────────────────────────────
  var path = window.location.pathname;
  var isHome = path === '/' || path.endsWith('/index.html') || path.endsWith('/');

  // ── CSS ──────────────────────────────────────────────────────────
  var css = `
/* ── ContractingFM floating player ── */
#cfm-float {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
  background: rgba(6,3,16,0.97);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255,255,255,0.07);
  height: 68px;
  display: flex; align-items: center; gap: 0;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 -4px 40px rgba(0,0,0,0.6);
  transition: transform 0.3s ease;
}
#cfm-float.cfm-hidden { transform: translateY(100%); }

.cfm-brand {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0 1.1rem; border-right: 1px solid rgba(255,255,255,0.06);
  min-width: 130px; flex-shrink: 0;
}
.cfm-brand-logo {
  font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 700;
  color: #fff; letter-spacing: 0.5px; white-space: nowrap;
}
.cfm-brand-logo span { color: var(--cfm-accent, #4a9eff); }
.cfm-on-air {
  font-size: 0.55rem; font-weight: 700; letter-spacing: 1.5px;
  text-transform: uppercase; color: #ef4444;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 3px; padding: 0.1rem 0.35rem;
  animation: cfm-pulse 2s ease-in-out infinite;
}
@keyframes cfm-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

.cfm-song-info {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0 1.1rem; border-right: 1px solid rgba(255,255,255,0.06);
  min-width: 210px; max-width: 260px; flex-shrink: 0;
}
.cfm-art {
  width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  transition: background 0.3s;
}
.cfm-meta { flex: 1; min-width: 0; }
.cfm-meta-title {
  font-size: 0.8rem; font-weight: 600; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-meta-sub {
  font-size: 0.68rem; color: #556; margin-top: 0.1rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-meta-genre {
  display: inline-block; font-size: 0.6rem; font-weight: 700;
  color: var(--cfm-accent, #4a9eff);
  background: rgba(74,158,255,0.1); border-radius: 3px;
  padding: 0.1rem 0.35rem; margin-top: 0.15rem; letter-spacing: 0.5px;
}
.cfm-heart {
  background: none; border: none; cursor: pointer; font-size: 1rem;
  color: #445; transition: color 0.2s, transform 0.15s; flex-shrink: 0; padding: 0.2rem;
}
.cfm-heart.active { color: #ef4444; }
.cfm-heart:hover { transform: scale(1.2); }

.cfm-controls {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0 1.25rem; border-right: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.cfm-btn {
  background: none; border: none; cursor: pointer;
  color: #8a9bb0; font-size: 0.85rem; padding: 0.4rem;
  border-radius: 50%; transition: color 0.18s, background 0.18s, transform 0.15s;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
}
.cfm-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.cfm-btn.cfm-play-btn {
  width: 38px; height: 38px; font-size: 1rem;
  background: var(--cfm-accent, #4a9eff); color: #040d1f;
  border-radius: 50%; transition: all 0.18s;
}
.cfm-btn.cfm-play-btn:hover { transform: scale(1.08); filter: brightness(1.15); }
.cfm-btn.cfm-active { color: var(--cfm-accent, #4a9eff); }

.cfm-progress-zone {
  flex: 1; display: flex; align-items: center; gap: 0.6rem;
  padding: 0 1.1rem; min-width: 0;
}
.cfm-time { font-size: 0.68rem; color: #445; flex-shrink: 0; min-width: 32px; }
.cfm-time.right { text-align: right; }
.cfm-bar-wrap { flex: 1; position: relative; height: 4px; cursor: pointer; }
.cfm-bar-bg {
  position: absolute; inset: 0; border-radius: 4px;
  background: rgba(255,255,255,0.08);
}
.cfm-bar-fill {
  position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px;
  background: var(--cfm-accent, #4a9eff); width: 0%; transition: width 0.1s linear;
}
.cfm-bar-thumb {
  position: absolute; top: 50%; width: 12px; height: 12px;
  border-radius: 50%; background: #fff; transform: translate(-50%, -50%);
  opacity: 0; transition: opacity 0.18s; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  left: 0%;
}
.cfm-bar-wrap:hover .cfm-bar-thumb { opacity: 1; }

.cfm-volume-zone {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0 1rem; border-left: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.cfm-vol-icon { font-size: 0.75rem; color: #445; cursor: pointer; }
input[type=range].cfm-vol-slider {
  -webkit-appearance: none; appearance: none;
  width: 70px; height: 3px; border-radius: 3px;
  background: rgba(255,255,255,0.12); outline: none; cursor: pointer;
  touch-action: pan-y;
}
input[type=range].cfm-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; cursor: pointer;
}
input[type=range].cfm-vol-slider::-moz-range-thumb {
  width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; border: none;
}

.cfm-playlist-btn {
  background: none; border: none; cursor: pointer;
  color: #445; font-size: 0.85rem; padding: 0 1rem;
  transition: color 0.18s; flex-shrink: 0; height: 100%;
  display: flex; align-items: center; gap: 0.35rem; font-family: 'Inter', sans-serif;
  border-left: 1px solid rgba(255,255,255,0.06);
}
.cfm-playlist-btn:hover { color: #fff; }
.cfm-playlist-btn.open { color: var(--cfm-accent, #4a9eff); }

/* Playlist drawer */
#cfm-drawer {
  position: fixed; bottom: 68px; right: 0;
  width: 320px; max-height: 400px;
  background: rgba(8,4,20,0.98);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px 0 0 0;
  overflow-y: auto; z-index: 9998;
  display: none;
  box-shadow: -4px -4px 30px rgba(0,0,0,0.5);
}
#cfm-drawer.open { display: block; }
.cfm-drawer-hdr {
  padding: 0.9rem 1.1rem 0.6rem;
  font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; font-weight: 700;
  color: #8a9bb0; text-transform: uppercase; letter-spacing: 1.5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cfm-track-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 1.1rem; cursor: pointer;
  transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.cfm-track-item:hover { background: rgba(255,255,255,0.04); }
.cfm-track-item.active { background: rgba(74,158,255,0.07); }
.cfm-track-num {
  font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; color: #334;
  min-width: 18px; text-align: center;
}
.cfm-track-item.active .cfm-track-num { color: var(--cfm-accent, #4a9eff); }
.cfm-track-dot {
  width: 8px; height: 8px; border-radius: 50%;
  animation: cfm-pulse 1s ease-in-out infinite; flex-shrink: 0;
  display: none;
}
.cfm-track-item.playing .cfm-track-dot { display: block; }
.cfm-track-item.playing .cfm-track-num { display: none; }
.cfm-track-info { flex: 1; min-width: 0; }
.cfm-track-name {
  font-size: 0.82rem; font-weight: 600; color: #c0cdd8;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-track-item.active .cfm-track-name { color: #fff; }
.cfm-track-genre { font-size: 0.67rem; color: #445; margin-top: 0.1rem; }
.cfm-track-fav {
  background: none; border: none; cursor: pointer; font-size: 0.85rem;
  color: #334; transition: color 0.18s; padding: 0.2rem;
}
.cfm-track-fav.active { color: #ef4444; }

/* Scrollbar styling for drawer */
#cfm-drawer::-webkit-scrollbar { width: 4px; }
#cfm-drawer::-webkit-scrollbar-track { background: transparent; }
#cfm-drawer::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* Body padding to account for player */
body.has-cfm-player { padding-bottom: 68px; }

/* ── Homepage sidebar player ── */
#cfm-home {
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(74,158,255,0.18);
  border-radius: 14px;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}
.cfm-sb-header {
  padding: 0.7rem 1rem;
  background: rgba(74,158,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: space-between;
}
.cfm-sb-name {
  font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 700;
  color: #fff; letter-spacing: 0.5px;
}
.cfm-sb-name span { color: #4a9eff; }
.cfm-sb-art-wrap {
  width: 100%; padding-top: 58%; position: relative;
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.cfm-sb-art {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 3.5rem;
  transition: background 0.4s, box-shadow 0.4s;
}
.cfm-sb-art.playing {
  animation: cfm-sb-glow 3s ease-in-out infinite;
}
@keyframes cfm-sb-glow { 0%,100% { box-shadow: inset 0 0 40px rgba(74,158,255,0.07); } 50% { box-shadow: inset 0 0 80px rgba(74,158,255,0.14); } }
.cfm-sb-now {
  padding: 0.7rem 1rem 0.2rem; text-align: center;
}
.cfm-sb-title {
  font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 700;
  color: #fff; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-sb-sub {
  font-size: 0.7rem; color: #445; margin-top: 0.12rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-sb-genre-tag {
  display: inline-block; font-size: 0.58rem; font-weight: 700;
  letter-spacing: 0.5px; text-transform: uppercase;
  padding: 0.1rem 0.4rem; border-radius: 3px; margin-top: 0.25rem;
  background: rgba(74,158,255,0.1); color: #4a9eff; border: 1px solid rgba(74,158,255,0.2);
}
.cfm-sb-controls {
  display: flex; align-items: center; justify-content: center;
  gap: 0.35rem; padding: 0.55rem 1rem;
}
.cfm-sb-btn {
  background: none; border: none; cursor: pointer;
  color: #8a9bb0; font-size: 0.85rem;
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.18s, background 0.18s, transform 0.15s;
}
.cfm-sb-btn:hover { color: #fff; background: rgba(255,255,255,0.07); }
.cfm-sb-btn.cfm-active { color: #4a9eff; }
.cfm-sb-play-btn {
  width: 42px; height: 42px; font-size: 1.05rem;
  background: #4a9eff; color: #040d1f; border-radius: 50%;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s;
  box-shadow: 0 4px 16px rgba(74,158,255,0.25);
}
.cfm-sb-play-btn:hover { transform: scale(1.06); filter: brightness(1.12); }
.cfm-sb-heart {
  background: none; border: none; cursor: pointer;
  font-size: 1rem; color: #334;
  transition: color 0.2s, transform 0.15s; padding: 0.2rem;
}
.cfm-sb-heart.active { color: #ef4444; }
.cfm-sb-heart:hover { transform: scale(1.2); }
.cfm-sb-progress {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0 1rem 0.3rem;
}
.cfm-sb-time { font-size: 0.64rem; color: #334; min-width: 26px; }
.cfm-sb-bar-wrap {
  flex: 1; height: 3px; background: rgba(255,255,255,0.08); border-radius: 3px;
  position: relative; cursor: pointer;
}
.cfm-sb-bar-fill {
  position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px;
  background: #4a9eff; width: 0%; transition: width 0.1s linear;
}
.cfm-sb-vol {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0 1rem 0.7rem;
}
.cfm-sb-vol-icon { font-size: 0.7rem; color: #334; }
input[type=range].cfm-sb-vol-slider {
  -webkit-appearance: none; appearance: none; flex: 1;
  height: 3px; border-radius: 3px;
  background: rgba(255,255,255,0.12); outline: none; cursor: pointer;
  touch-action: pan-y;
}
input[type=range].cfm-sb-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; cursor: pointer;
}
.cfm-sb-playlist {
  border-top: 1px solid rgba(255,255,255,0.06);
  max-height: 190px; overflow-y: auto;
}
.cfm-sb-playlist::-webkit-scrollbar { width: 3px; }
.cfm-sb-playlist::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.cfm-sb-playlist-hdr {
  font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; font-weight: 700;
  color: #334; text-transform: uppercase; letter-spacing: 1.5px;
  padding: 0.5rem 1rem 0.3rem;
}
.cfm-sb-track {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.38rem 1rem; cursor: pointer;
  transition: background 0.15s;
}
.cfm-sb-track:hover { background: rgba(255,255,255,0.04); }
.cfm-sb-track.active { background: rgba(74,158,255,0.07); }
.cfm-sb-track-num {
  font-family: 'Rajdhani', sans-serif; font-size: 0.72rem;
  color: #334; min-width: 14px; text-align: center; flex-shrink: 0;
}
.cfm-sb-track.active .cfm-sb-track-num { color: #4a9eff; }
.cfm-sb-track.playing .cfm-sb-track-num { display: none; }
.cfm-sb-track-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  animation: cfm-pulse 1s ease-in-out infinite; display: none;
}
.cfm-sb-track.playing .cfm-sb-track-dot { display: block; }
.cfm-sb-track-info { flex: 1; min-width: 0; }
.cfm-sb-track-name {
  font-size: 0.79rem; font-weight: 600; color: #c0cdd8;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-sb-track.active .cfm-sb-track-name { color: #fff; }
.cfm-sb-track-genre { font-size: 0.62rem; color: #334; margin-top: 0.04rem; }
.cfm-sb-track-fav {
  background: none; border: none; cursor: pointer;
  font-size: 0.8rem; color: #334; padding: 0.15rem; flex-shrink: 0;
  transition: color 0.18s;
}
.cfm-sb-track-fav.active { color: #ef4444; }

/* Mobile: art hidden, layout compressed */
@media (max-width: 860px) {
  #cfm-home { border-radius: 10px; }
  .cfm-sb-art-wrap { display: none; }
  .cfm-sb-playlist { max-height: 140px; }
  .cfm-sb-controls { padding: 0.4rem 1rem; }
}
@media (max-width: 600px) {
  .cfm-brand { min-width: 90px; }
  .cfm-song-info { min-width: 140px; max-width: 170px; }
  .cfm-volume-zone { display: none; }
  .cfm-progress-zone { padding: 0 0.5rem; }
}
`;

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── ACCENT COLOR UPDATER ─────────────────────────────────────────
  function setAccent(color) {
    document.documentElement.style.setProperty('--cfm-accent', color);
  }

  // ── FLOATING PLAYER BUILD ────────────────────────────────────────
  var floatEl, drawerEl;
  var drawerOpen = false;

  function buildFloat() {
    if (isHome) return; // home page uses static player
    document.body.classList.add('has-cfm-player');

    floatEl = document.createElement('div');
    floatEl.id = 'cfm-float';
    floatEl.innerHTML = [
      '<div class="cfm-brand">',
        '<div>',
          '<div class="cfm-brand-logo">Contracting<span>FM</span></div>',
          '<div class="cfm-on-air">ON AIR</div>',
        '</div>',
      '</div>',
      '<div class="cfm-song-info">',
        '<div class="cfm-art" id="cfm-art">&#127911;</div>',
        '<div class="cfm-meta">',
          '<div class="cfm-meta-title" id="cfm-title">Select a track</div>',
          '<div class="cfm-meta-sub" id="cfm-sub"></div>',
          '<div class="cfm-meta-genre" id="cfm-genre"></div>',
        '</div>',
        '<button class="cfm-heart" id="cfm-heart" title="Favorite">&#9825;</button>',
      '</div>',
      '<div class="cfm-controls">',
        '<button class="cfm-btn" id="cfm-prev" title="Previous">&#9664;&#9664;</button>',
        '<button class="cfm-btn cfm-play-btn" id="cfm-play" title="Play / Pause">&#9654;</button>',
        '<button class="cfm-btn" id="cfm-next" title="Next">&#9654;&#9654;</button>',
        '<button class="cfm-btn" id="cfm-shuffle" title="Shuffle">&#8695;</button>',
      '</div>',
      '<div class="cfm-progress-zone">',
        '<span class="cfm-time" id="cfm-cur">0:00</span>',
        '<div class="cfm-bar-wrap" id="cfm-bar">',
          '<div class="cfm-bar-bg"></div>',
          '<div class="cfm-bar-fill" id="cfm-fill"></div>',
          '<div class="cfm-bar-thumb" id="cfm-thumb"></div>',
        '</div>',
        '<span class="cfm-time right" id="cfm-dur">0:00</span>',
      '</div>',
      '<div class="cfm-volume-zone">',
        '<span class="cfm-vol-icon" id="cfm-vol-icon">&#128266;</span>',
        '<input type="range" class="cfm-vol-slider" id="cfm-vol" min="0" max="1" step="0.01" value="' + state.vol + '">',
      '</div>',
      '<button class="cfm-playlist-btn" id="cfm-list-btn" title="Playlist">',
        '&#9776; <span style="font-size:0.72rem;font-weight:600;">Playlist</span>',
      '</button>'
    ].join('');

    drawerEl = document.createElement('div');
    drawerEl.id = 'cfm-drawer';

    document.body.appendChild(floatEl);
    document.body.appendChild(drawerEl);

    bindFloat();
    renderDrawer();
    updateAll();
  }

  function bindFloat() {
    document.getElementById('cfm-play').addEventListener('click', function () {
      if (!playerReady) { playerReady = true; loadTrack(state.idx, true); return; }
      togglePlay();
    });
    document.getElementById('cfm-prev').addEventListener('click', prevTrack);
    document.getElementById('cfm-next').addEventListener('click', nextTrack);
    document.getElementById('cfm-shuffle').addEventListener('click', function () {
      state.shuffle = !state.shuffle; saveState(); updateShuffleBtns();
    });
    document.getElementById('cfm-heart').addEventListener('click', function () {
      toggleFav(state.idx);
    });
    document.getElementById('cfm-vol').addEventListener('input', function () {
      state.vol = parseFloat(this.value); aud.volume = state.vol; saveState(); updateVolIcon();
    });
    document.getElementById('cfm-bar').addEventListener('click', function (e) {
      var rect = this.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      if (aud.duration) aud.currentTime = pct * aud.duration;
    });
    document.getElementById('cfm-list-btn').addEventListener('click', function () {
      drawerOpen = !drawerOpen;
      drawerEl.classList.toggle('open', drawerOpen);
      this.classList.toggle('open', drawerOpen);
    });
    document.addEventListener('click', function (e) {
      if (drawerOpen && !drawerEl.contains(e.target) && !document.getElementById('cfm-list-btn').contains(e.target)) {
        drawerOpen = false;
        drawerEl.classList.remove('open');
        document.getElementById('cfm-list-btn').classList.remove('open');
      }
    });
  }

  function renderDrawer() {
    if (!drawerEl) return;
    var html = '<div class="cfm-drawer-hdr">&#127911; ContractingFM Playlist</div>';
    TRACKS.forEach(function (t, i) {
      var active = i === state.idx;
      var fav = isFav(i);
      html += [
        '<div class="cfm-track-item' + (active ? ' active' : '') + (active && isPlaying ? ' playing' : '') + '" data-idx="' + i + '">',
          '<div class="cfm-track-dot" style="background:' + t.color + '"></div>',
          '<div class="cfm-track-num">' + (i + 1) + '</div>',
          '<div class="cfm-track-info">',
            '<div class="cfm-track-name">' + t.title + '</div>',
            '<div class="cfm-track-genre">' + t.genre + '</div>',
          '</div>',
          '<button class="cfm-track-fav' + (fav ? ' active' : '') + '" data-idx="' + i + '" title="Favorite">',
            fav ? '&#10084;' : '&#9825;',
          '</button>',
        '</div>'
      ].join('');
    });
    drawerEl.innerHTML = html;

    drawerEl.querySelectorAll('.cfm-track-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('cfm-track-fav')) return;
        var idx = parseInt(this.getAttribute('data-idx'));
        loadTrack(idx, true);
        playerReady = true;
      });
    });
    drawerEl.querySelectorAll('.cfm-track-fav').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        toggleFav(idx);
      });
    });
  }

  // ── HOME PLAYER BUILD ────────────────────────────────────────────
  var homeSection;

  function buildHome() {
    if (!isHome) return;
    var target = document.getElementById('cfm-home-section');
    if (!target) return;

    homeSection = target;
    homeSection.innerHTML = [
      '<div id="cfm-home">',
        '<div class="cfm-sb-header">',
          '<div class="cfm-sb-name">Contracting<span>FM</span></div>',
          '<span class="cfm-on-air">On Air</span>',
        '</div>',
        '<div class="cfm-sb-art-wrap">',
          '<div class="cfm-sb-art" id="cfm-sb-art">&#127911;</div>',
        '</div>',
        '<div class="cfm-sb-now">',
          '<div class="cfm-sb-title" id="cfm-sb-title">Select a track</div>',
          '<div class="cfm-sb-sub" id="cfm-sb-sub"></div>',
          '<span class="cfm-sb-genre-tag" id="cfm-sb-genre"></span>',
        '</div>',
        '<div class="cfm-sb-controls">',
          '<button class="cfm-sb-btn" id="cfm-sb-shuffle" title="Shuffle">&#8695;</button>',
          '<button class="cfm-sb-btn" id="cfm-sb-prev" title="Previous">&#9664;&#9664;</button>',
          '<button class="cfm-sb-play-btn" id="cfm-sb-play" title="Play / Pause">&#9654;</button>',
          '<button class="cfm-sb-btn" id="cfm-sb-next" title="Next">&#9654;&#9654;</button>',
          '<button class="cfm-sb-heart" id="cfm-sb-heart" title="Favorite">&#9825;</button>',
        '</div>',
        '<div class="cfm-sb-progress">',
          '<span class="cfm-sb-time" id="cfm-sb-cur">0:00</span>',
          '<div class="cfm-sb-bar-wrap" id="cfm-sb-bar">',
            '<div class="cfm-sb-bar-fill" id="cfm-sb-fill"></div>',
          '</div>',
          '<span class="cfm-sb-time" id="cfm-sb-dur">0:00</span>',
        '</div>',
        '<div class="cfm-sb-vol">',
          '<span class="cfm-sb-vol-icon">&#128266;</span>',
          '<input type="range" class="cfm-sb-vol-slider" id="cfm-sb-vol" min="0" max="1" step="0.01" value="' + state.vol + '">',
        '</div>',
        '<div class="cfm-sb-playlist">',
          '<div class="cfm-sb-playlist-hdr">Playlist</div>',
          '<div id="cfm-sb-list"></div>',
        '</div>',
      '</div>'
    ].join('');

    renderHomeList();
    bindHome();
    updateAll();
  }

  function renderHomeList() {
    var listEl = document.getElementById('cfm-sb-list');
    if (!listEl) return;
    var html = '';
    TRACKS.forEach(function (t, i) {
      var active = i === state.idx;
      var fav = isFav(i);
      html += [
        '<div class="cfm-sb-track' + (active ? ' active' : '') + (active && isPlaying ? ' playing' : '') + '" data-idx="' + i + '">',
          '<div class="cfm-sb-track-dot" style="background:' + t.color + '"></div>',
          '<div class="cfm-sb-track-num">' + (i + 1) + '</div>',
          '<div class="cfm-sb-track-info">',
            '<div class="cfm-sb-track-name">' + t.title + '</div>',
            '<div class="cfm-sb-track-genre">' + t.genre + '</div>',
          '</div>',
          '<button class="cfm-sb-track-fav' + (fav ? ' active' : '') + '" data-idx="' + i + '">',
            fav ? '&#10084;' : '&#9825;',
          '</button>',
        '</div>'
      ].join('');
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.cfm-sb-track').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('cfm-sb-track-fav')) return;
        var idx = parseInt(this.getAttribute('data-idx'));
        loadTrack(idx, true);
        playerReady = true;
      });
    });
    listEl.querySelectorAll('.cfm-sb-track-fav').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFav(parseInt(this.getAttribute('data-idx')));
      });
    });
  }

  function bindHome() {
    document.getElementById('cfm-sb-play').addEventListener('click', function () {
      if (!playerReady) { playerReady = true; loadTrack(state.idx, true); return; }
      togglePlay();
    });
    document.getElementById('cfm-sb-prev').addEventListener('click', prevTrack);
    document.getElementById('cfm-sb-next').addEventListener('click', nextTrack);
    document.getElementById('cfm-sb-shuffle').addEventListener('click', function () {
      state.shuffle = !state.shuffle; saveState(); updateShuffleBtns();
    });
    document.getElementById('cfm-sb-heart').addEventListener('click', function () {
      toggleFav(state.idx);
    });
    document.getElementById('cfm-sb-vol').addEventListener('input', function () {
      state.vol = parseFloat(this.value); aud.volume = state.vol; saveState();
    });
    document.getElementById('cfm-sb-bar').addEventListener('click', function (e) {
      var rect = this.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      if (aud.duration) aud.currentTime = pct * aud.duration;
    });
  }

  // ── UPDATE FUNCTIONS ─────────────────────────────────────────────
  function updateAll() {
    var t = TRACKS[state.idx];
    setAccent(t.color);
    updateSongInfo(t);
    updatePlayBtns();
    updateShuffleBtns();
    updateHearts();
    renderDrawer();
    renderHomeList();
    updateProgress();
  }

  function updateSongInfo(t) {
    // Float
    var ti = document.getElementById('cfm-title');
    var su = document.getElementById('cfm-sub');
    var ge = document.getElementById('cfm-genre');
    var ar = document.getElementById('cfm-art');
    if (ti) ti.textContent = t.title;
    if (su) su.textContent = t.subtitle;
    if (ge) ge.textContent = t.genre;
    if (ar) ar.style.background = t.color + '22';
    // Sidebar home
    var hti = document.getElementById('cfm-sb-title');
    var hsu = document.getElementById('cfm-sb-sub');
    var hge = document.getElementById('cfm-sb-genre');
    var har = document.getElementById('cfm-sb-art');
    if (hti) hti.textContent = t.title;
    if (hsu) hsu.textContent = t.subtitle;
    if (hge) hge.textContent = t.genre;
    if (har) { har.style.background = t.color + '18'; }
  }

  function updatePlayBtns() {
    var icon = isPlaying ? '&#9646;&#9646;' : '&#9654;';
    var p1 = document.getElementById('cfm-play');
    var p2 = document.getElementById('cfm-sb-play');
    if (p1) p1.innerHTML = icon;
    if (p2) p2.innerHTML = icon;
    var ar = document.getElementById('cfm-sb-art');
    if (ar) { if (isPlaying) ar.classList.add('playing'); else ar.classList.remove('playing'); }
  }

  function updateShuffleBtns() {
    var s1 = document.getElementById('cfm-shuffle');
    var s2 = document.getElementById('cfm-sb-shuffle');
    if (s1) s1.classList.toggle('cfm-active', state.shuffle);
    if (s2) s2.classList.toggle('cfm-active', state.shuffle);
  }

  function updateHearts() {
    var fav = isFav(state.idx);
    var h1 = document.getElementById('cfm-heart');
    var h2 = document.getElementById('cfm-sb-heart');
    if (h1) { h1.classList.toggle('active', fav); h1.innerHTML = fav ? '&#10084;' : '&#9825;'; }
    if (h2) { h2.classList.toggle('active', fav); h2.innerHTML = fav ? '&#10084;' : '&#9825;'; }
  }

  function updateProgress() {
    var cur = aud.currentTime || 0;
    var dur = aud.duration || 0;
    var pct = dur > 0 ? (cur / dur * 100).toFixed(2) + '%' : '0%';
    var c1 = document.getElementById('cfm-cur');
    var d1 = document.getElementById('cfm-dur');
    var f1 = document.getElementById('cfm-fill');
    var th = document.getElementById('cfm-thumb');
    if (c1) c1.textContent = fmt(cur);
    if (d1) d1.textContent = fmt(dur);
    if (f1) f1.style.width = pct;
    if (th) th.style.left = pct;
    var c2 = document.getElementById('cfm-sb-cur');
    var d2 = document.getElementById('cfm-sb-dur');
    var f2 = document.getElementById('cfm-sb-fill');
    if (c2) c2.textContent = fmt(cur);
    if (d2) d2.textContent = fmt(dur);
    if (f2) f2.style.width = pct;
  }

  function updateVolIcon() {
    var icon = document.getElementById('cfm-vol-icon');
    if (!icon) return;
    if (state.vol === 0) icon.innerHTML = '&#128263;';
    else if (state.vol < 0.4) icon.innerHTML = '&#128264;';
    else icon.innerHTML = '&#128266;';
  }

  // ── INIT ─────────────────────────────────────────────────────────
  function resumeAudio() {
    var targetTime = state.time;
    var shouldPlay = state.wasPlaying;
    aud.src = trackUrl(state.idx);
    aud.load();
    aud.addEventListener('loadedmetadata', function () {
      if (targetTime > 0) aud.currentTime = targetTime;
      if (shouldPlay) {
        aud.play().catch(function () {});
        playerReady = true;
      }
    }, { once: true });
    updateAll();
  }

  function init() {
    // If nothing was actively playing, start on a random track
    if (!state.wasPlaying) {
      state.idx = Math.floor(Math.random() * TRACKS.length);
      state.time = 0;
    }
    if (isHome) {
      buildHome();
      if (state.wasPlaying) resumeAudio();
    } else {
      buildFloat();
      if (state.wasPlaying) resumeAudio();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
