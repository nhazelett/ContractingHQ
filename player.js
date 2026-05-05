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
    { id: 5, title: 'Stop Putting Ceilings on your BPAs!', subtitle: 'ContractingFM', genre: 'ContractingFM', file: 'audio/track-05.mp3', color: '#dc2626' },
    { id: 6, title: '7 Exceptions to Full & Open Competition', subtitle: 'ContractingFM', genre: 'ContractingFM', file: 'audio/track-06.mp3', color: '#0891b2' },
    { id: 7, title: 'Personal or Non-Personal',           subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-07.mp3', color: '#7c3aed' },
    { id: 8, title: 'Two Five Seven Nine',                subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-08.mp3', color: '#e11d48' },
    { id: 9, title: 'Build the Lane with a BPA',          subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-09.mp3', color: '#f59e0b' },
    { id: 10, title: 'Evaluate What They Wrote',           subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-10.mp3', color: '#10b981' },
    { id: 11, title: 'Government Purchase Card',            subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-11.mp3', color: '#6366f1' },
    { id: 12, title: 'Let the Record Speak',                subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-12.mp3', color: '#ec4899' },
    { id: 13, title: 'Market Research',                     subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-13.mp3', color: '#14b8a6' },
    { id: 14, title: '39 CONS Aşkı',                        subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-14.mp3', color: '#f97316' },
    { id: 15, title: 'Begründ es sauber',                   subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-15.mp3', color: '#84cc16' },
    { id: 16, title: 'Cure Notices',                        subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-16.mp3', color: '#06b6d4' },
    { id: 17, title: 'Lo Que Cotizaste',                    subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-17.mp3', color: '#a855f7' },
    { id: 18, title: "Price Ain't Cost",                    subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-18.mp3', color: '#f43f5e' },
    { id: 19, title: 'Quello Che Hai Scritto',              subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-19.mp3', color: '#22c55e' },
    { id: 20, title: 'Roll that Record',                    subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-20.mp3', color: '#3b82f6' },
    { id: 21, title: 'Roll that Record (Alt)',              subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-21.mp3', color: '#eab308' },
    { id: 22, title: "The Quotation Doesn't Lie",           subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-22.mp3', color: '#8b5cf6' },
    { id: 23, title: 'Write It Clean',                      subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-23.mp3', color: '#0ea5e9' },
    { id: 24, title: 'Хто це все придумав',                 subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-24.mp3', color: '#ef4444' },
    { id: 25, title: '견적 더 줘',                           subtitle: 'ContractingFM',  genre: 'ContractingFM', file: 'audio/track-25.mp3', color: '#10b981' }
  ];

  // ── STATE ────────────────────────────────────────────────────────
  var SK = 'cfm_v1';
  var state = { idx: 0, time: 0, vol: 0.5, shuffle: false, favs: [], skips: [], wasPlaying: false, favsOnly: false };

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(SK));
      if (s) {
        if (typeof s.idx === 'number')   state.idx     = Math.min(s.idx, TRACKS.length - 1);
        if (typeof s.time === 'number')  state.time    = s.time;
        // vol intentionally not restored - always starts at 0.5 to avoid surprising the user
        if (typeof s.shuffle === 'boolean') state.shuffle = s.shuffle;
        if (Array.isArray(s.favs))       state.favs    = sanitizeIndexes(s.favs);
        if (Array.isArray(s.skips))      state.skips   = sanitizeIndexes(s.skips);
        if (typeof s.wasPlaying === 'boolean') state.wasPlaying = s.wasPlaying;
        if (typeof s.favsOnly === 'boolean')   state.favsOnly   = s.favsOnly;
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

  function sanitizeIndexes(values) {
    return values.filter(function (idx, pos, arr) {
      return typeof idx === 'number' && idx >= 0 && idx < TRACKS.length && arr.indexOf(idx) === pos;
    });
  }

  function allTrackIndexes() {
    return TRACKS.map(function (_, i) { return i; });
  }

  function getPool() {
    var base = state.favsOnly && state.favs.length > 0 ? state.favs : allTrackIndexes();
    var playable = base.filter(function (idx) { return state.skips.indexOf(idx) === -1; });
    return playable.length > 0 ? playable : base;
  }

  function nextTrack(force) {
    var pool = getPool();
    var cur = pool.indexOf(state.idx);
    var next;
    if (state.shuffle) {
      do { next = pool[Math.floor(Math.random() * pool.length)]; }
      while (pool.length > 1 && next === state.idx);
    } else {
      next = pool[(cur + 1) % pool.length];
    }
    loadTrack(next, force || isPlaying);
  }

  function prevTrack() {
    if (aud.currentTime > 3) { aud.currentTime = 0; return; }
    var pool = getPool();
    var cur = pool.indexOf(state.idx);
    loadTrack(pool[(cur - 1 + pool.length) % pool.length], isPlaying);
  }

  function isFav(idx) { return state.favs.indexOf(idx) > -1; }
  function isSkipped(idx) { return state.skips.indexOf(idx) > -1; }

  function toggleFav(idx) {
    var i = state.favs.indexOf(idx);
    if (i > -1) state.favs.splice(i, 1); else state.favs.push(idx);
    saveState();
    updateAll();
  }

  function toggleSkip(idx) {
    var i = state.skips.indexOf(idx);
    var nowSkipped = i === -1;
    if (i > -1) state.skips.splice(i, 1); else state.skips.push(idx);
    saveState();
    if (nowSkipped && idx === state.idx) {
      nextTrack(true);
    } else {
      updateAll();
    }
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(s) {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // Audio event listeners
  aud.addEventListener('play',   function () { isPlaying = true;  state.wasPlaying = true; updatePlayBtns(); saveState(); });
  aud.addEventListener('pause',  function () { isPlaying = false; state.wasPlaying = false; updatePlayBtns(); saveState(); });
  aud.addEventListener('ended',  function () { nextTrack(true); });
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

  // Mobile browsers (especially iOS Safari) often skip beforeunload entirely.
  // pagehide fires reliably on mobile navigation, and visibilitychange catches
  // app-switching / tab-switching. Both ensure state is saved before the page dies.
  window.addEventListener('pagehide', function () { state.time = aud.currentTime; state.wasPlaying = isPlaying; saveState(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { state.time = aud.currentTime; state.wasPlaying = isPlaying; saveState(); }
  });

  // ── DETECT PAGE / PLATFORM ───────────────────────────────────────
  var path = window.location.pathname;
  function isHomePath(value) {
    return value === '/' || value.endsWith('/index.html') || value.endsWith('/');
  }
  var isHome = isHomePath(path);
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
  transition: color 0.3s, background 0.3s, border-color 0.3s;
}
.cfm-on-air.off-air {
  color: #445; background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1);
  animation: none;
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
  color: #8a9bb0; font-size: 0.85rem; padding: 0 1rem;
  transition: color 0.18s; flex-shrink: 0; height: 100%;
  display: flex; align-items: center; gap: 0.35rem; font-family: 'Inter', sans-serif;
  border-left: 1px solid rgba(255,255,255,0.06);
}
.cfm-playlist-btn:hover { color: #fff; }
.cfm-playlist-btn.open { color: var(--cfm-accent, #4a9eff); }
.cfm-playlist-text { font-size: 0.72rem; font-weight: 700; }

/* Playlist drawer */
#cfm-drawer {
  position: fixed; bottom: 68px; right: 0;
  width: 380px; max-height: min(560px, calc(100vh - 92px));
  background: #080414;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px 0 0 0;
  overflow-y: auto; z-index: 9998;
  display: none;
  box-shadow: -4px -4px 30px rgba(0,0,0,0.5);
}
#cfm-drawer.open { display: block; }
.cfm-drawer-hdr {
  position: sticky; top: 0; z-index: 1;
  padding: 0.85rem 1rem 0.75rem;
  background: #080414;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cfm-drawer-title-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
}
.cfm-drawer-title {
  font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 700;
  color: #fff; text-transform: uppercase; letter-spacing: 1.2px;
}
.cfm-drawer-count { color: #556; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
.cfm-drawer-actions {
  display: flex; align-items: center; gap: 0.45rem; margin-top: 0.65rem;
}
.cfm-drawer-toggle {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: rgba(255,255,255,0.035);
  color: #8a9bb0;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.35rem 0.65rem;
}
.cfm-drawer-toggle:hover { color: #fff; background: rgba(255,255,255,0.06); }
.cfm-drawer-toggle.active { color: #ef4444; border-color: rgba(239,68,68,0.34); background: rgba(239,68,68,0.08); }
.cfm-drawer-toggle.disabled { opacity: 0.45; cursor: default; }
.cfm-track-item {
  display: grid; grid-template-columns: 22px minmax(0, 1fr) auto auto; align-items: center; gap: 0.65rem;
  padding: 0.65rem 1rem; cursor: pointer;
  background: #080414;
  transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.cfm-track-item:hover { background: rgba(255,255,255,0.04); }
.cfm-track-item.active { background: #11172d; }
.cfm-track-item.skipped { opacity: 0.58; }
.cfm-track-item.skipped .cfm-track-name { text-decoration: line-through; }
.cfm-track-marker {
  display: grid; place-items: center;
  width: 22px; min-width: 22px;
}
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
.cfm-track-skip {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: rgba(255,255,255,0.035);
  color: #66758a;
  cursor: pointer;
  font: inherit;
  font-size: 0.64rem;
  font-weight: 800;
  line-height: 1;
  padding: 0.32rem 0.48rem;
  text-transform: uppercase;
}
.cfm-track-skip:hover { color: #fff; background: rgba(255,255,255,0.07); }
.cfm-track-skip.active { color: #f59e0b; border-color: rgba(245,158,11,0.34); background: rgba(245,158,11,0.08); }

/* Scrollbar styling for drawer */
#cfm-drawer::-webkit-scrollbar { width: 4px; }
#cfm-drawer::-webkit-scrollbar-track { background: transparent; }
#cfm-drawer::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* Body padding to account for player */
body.has-cfm-player { padding-bottom: 68px; }

/* ── Homepage sidebar player ── */
#cfm-home {
  background: linear-gradient(160deg, #0a0e20 0%, #060912 100%);
  border: 1px solid rgba(74,158,255,0.28);
  border-top: 1px solid rgba(74,158,255,0.5);
  border-radius: 14px;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(74,158,255,0.08);
}
.cfm-sb-header {
  padding: 0.7rem 1rem;
  background: rgba(74,158,255,0.08);
  border-bottom: 1px solid rgba(74,158,255,0.12);
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem;
}
.cfm-sb-name {
  font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 700;
  color: #fff; letter-spacing: 0.5px;
}
.cfm-sb-name span { color: #4a9eff; }
.cfm-sb-header-actions {
  display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;
}
.cfm-sb-list-btn {
  border: 1px solid rgba(74,158,255,0.26);
  border-radius: 999px;
  background: rgba(74,158,255,0.08);
  color: #8a9bb0;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  padding: 0.32rem 0.48rem;
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  transition: color 0.18s, background 0.18s, border-color 0.18s;
}
.cfm-sb-list-btn:hover,
.cfm-sb-list-btn.open {
  color: #fff;
  border-color: rgba(74,158,255,0.52);
  background: rgba(74,158,255,0.14);
}
.cfm-sb-art-wrap {
  width: 100%; padding-top: 62%; position: relative;
  background:
    linear-gradient(180deg, rgba(10,30,50,0.85), rgba(12,21,43,0.78)),
    radial-gradient(circle at center, rgba(86,167,255,0.1), transparent 60%);
  border-bottom: 1px solid rgba(74,158,255,0.14);
  overflow: hidden;
}
.cfm-sb-art {
  position: absolute; inset: 0;
  display: block;
  transition: box-shadow 0.4s;
}
.cfm-sb-art.playing {
  animation: cfm-sb-glow 3s ease-in-out infinite;
}
.cfm-sb-art-grid {
  position: absolute; inset: 0;
  background:
    linear-gradient(rgba(146,181,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(146,181,255,0.06) 1px, transparent 1px);
  background-size: 20px 20px;
  -webkit-mask-image: radial-gradient(circle at center, black 22%, transparent 78%);
          mask-image: radial-gradient(circle at center, black 22%, transparent 78%);
  pointer-events: none;
}
.cfm-sb-art-arc {
  position: absolute; left: 50%; top: 50%;
  border: 1px solid rgba(115,151,237,0.18);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.cfm-sb-art-arc.cfm-sb-arc-a { width: 120px; height: 120px; }
.cfm-sb-art-arc.cfm-sb-arc-b { width: 172px; height: 172px; border-style: dashed; border-color: rgba(115,151,237,0.14); }
.cfm-sb-art-arc.cfm-sb-arc-c { width: 88px; height: 88px; border-color: rgba(68,224,211,0.22); }
.cfm-sb-art-orbital {
  position: absolute;
  width: 8px; height: 8px; border-radius: 50%;
  box-shadow: 0 0 14px currentColor;
  pointer-events: none;
}
.cfm-sb-art-orbital.cfm-sb-orbital-a {
  top: 22px; left: 30px;
  color: #44e0d3;
  background: radial-gradient(circle at 30% 30%, #defffb, #44e0d3);
}
.cfm-sb-art-orbital.cfm-sb-orbital-b {
  right: 30px; bottom: 22px;
  color: #ff9a5f;
  background: radial-gradient(circle at 30% 30%, #ffe5d7, #ff9a5f);
}
.cfm-sb-art-core {
  position: absolute; inset: 0;
  display: grid; place-items: center;
}
.cfm-sb-art-eq {
  position: absolute; inset: 0;
  display: flex; align-items: flex-end; justify-content: center;
  gap: 6px;
  padding: 22px 18px 16px;
  pointer-events: none;
}
.cfm-sb-art-eq span {
  width: 7px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(68,224,211,0.95), rgba(86,167,255,0.22));
  box-shadow: 0 0 12px rgba(68,224,211,0.2);
  transform-origin: bottom;
}
.cfm-sb-art-eq span:nth-child(1) { height: 18px; }
.cfm-sb-art-eq span:nth-child(2) { height: 38px; }
.cfm-sb-art-eq span:nth-child(3) { height: 26px; }
.cfm-sb-art-eq span:nth-child(4) { height: 48px; }
.cfm-sb-art-eq span:nth-child(5) { height: 32px; }
.cfm-sb-art-eq span:nth-child(6) { height: 44px; }
.cfm-sb-art-eq span:nth-child(7) { height: 24px; }
.cfm-sb-art-eq span:nth-child(8) { height: 36px; }
.cfm-sb-art-disc {
  position: relative;
  width: 74px; height: 74px;
  display: grid; place-items: center;
}
.cfm-sb-art-ring {
  position: absolute; inset: 0;
  border: 1px solid rgba(86,167,255,0.22);
  border-radius: 50%;
  box-shadow: inset 0 0 22px rgba(86,167,255,0.1);
}
.cfm-sb-art-ring.cfm-sb-art-ring-b {
  inset: 10px;
  border-color: rgba(68,224,211,0.22);
  box-shadow: inset 0 0 16px rgba(68,224,211,0.08);
}
.cfm-sb-art-center {
  position: absolute; inset: 20px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), rgba(86,167,255,0.18)),
    linear-gradient(180deg, rgba(34,74,149,0.95), rgba(12,29,73,0.95));
  border: 1px solid rgba(126,168,243,0.22);
  box-shadow:
    0 8px 18px rgba(6,14,36,0.32),
    inset 0 1px 0 rgba(255,255,255,0.14);
}
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(1) { animation: cfm-sb-eq 1.1s ease-in-out infinite; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(2) { animation: cfm-sb-eq 0.9s ease-in-out infinite 0.1s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(3) { animation: cfm-sb-eq 1.2s ease-in-out infinite 0.16s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(4) { animation: cfm-sb-eq 0.84s ease-in-out infinite 0.08s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(5) { animation: cfm-sb-eq 1.15s ease-in-out infinite 0.18s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(6) { animation: cfm-sb-eq 0.96s ease-in-out infinite 0.14s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(7) { animation: cfm-sb-eq 1.18s ease-in-out infinite 0.06s; }
.cfm-sb-art.playing .cfm-sb-art-eq span:nth-child(8) { animation: cfm-sb-eq 1.02s ease-in-out infinite 0.12s; }
.cfm-sb-art.playing .cfm-sb-art-ring { animation: cfm-sb-spin 7s linear infinite; }
.cfm-sb-art.playing .cfm-sb-art-ring.cfm-sb-art-ring-b { animation-duration: 4.4s; animation-direction: reverse; }
.cfm-sb-art.playing .cfm-sb-art-orbital.cfm-sb-orbital-a { animation: cfm-sb-orbit-a 6s linear infinite; }
.cfm-sb-art.playing .cfm-sb-art-orbital.cfm-sb-orbital-b { animation: cfm-sb-orbit-b 7.4s linear infinite reverse; }
@keyframes cfm-sb-glow { 0%,100% { box-shadow: inset 0 0 40px rgba(74,158,255,0.07); } 50% { box-shadow: inset 0 0 80px rgba(74,158,255,0.14); } }
@keyframes cfm-sb-eq { 0%,100% { transform: scaleY(0.6); } 50% { transform: scaleY(1.12); } }
@keyframes cfm-sb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes cfm-sb-orbit-a {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(14px, 8px); }
  50%  { transform: translate(32px, 26px); }
  75%  { transform: translate(10px, 46px); }
  100% { transform: translate(0, 0); }
}
@keyframes cfm-sb-orbit-b {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(-12px, -8px); }
  50%  { transform: translate(-28px, -22px); }
  75%  { transform: translate(-8px, -42px); }
  100% { transform: translate(0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .cfm-sb-art.playing,
  .cfm-sb-art.playing .cfm-sb-art-eq span,
  .cfm-sb-art.playing .cfm-sb-art-ring,
  .cfm-sb-art.playing .cfm-sb-art-orbital {
    animation: none !important;
  }
}
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
  gap: 0.6rem; padding: 0.55rem 1rem;
}
.cfm-sb-btn {
  background: none; border: none; cursor: pointer;
  color: #8a9bb0; font-size: 0.75rem; line-height: 1;
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
  transition: color 0.18s, background 0.18s, transform 0.15s;
}
.cfm-sb-btn:hover { color: #fff; background: rgba(255,255,255,0.07); }
.cfm-sb-btn.cfm-active { color: #4a9eff; }
.cfm-sb-play-btn {
  width: 42px; height: 42px; font-size: 0.95rem; line-height: 1;
  background: #4a9eff; color: #040d1f; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
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
}
input[type=range].cfm-sb-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; cursor: pointer;
}
.cfm-sb-now-playing {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 0.65rem 1rem;
  display: flex; align-items: center; gap: 0.6rem;
}
.cfm-sb-np-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  background: var(--cfm-accent, #4a9eff);
  animation: cfm-pulse 1.4s ease-in-out infinite;
}
.cfm-sb-np-dot.paused { animation: none; background: #334; }
.cfm-sb-np-info { flex: 1; min-width: 0; }
.cfm-sb-np-title {
  font-size: 0.8rem; font-weight: 600; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cfm-sb-np-label { font-size: 0.62rem; color: #445; margin-bottom: 0.1rem; letter-spacing: 0.5px; }
.cfm-sb-np-heart {
  background: none; border: none; cursor: pointer;
  font-size: 1.1rem; color: #334; padding: 0.2rem; flex-shrink: 0;
  transition: color 0.2s, transform 0.15s;
}
.cfm-sb-np-heart.active { color: #ef4444; }
.cfm-sb-np-heart:hover { transform: scale(1.2); }
.cfm-sb-favs-btn {
  width: 100%; padding: 0.6rem 1rem;
  background: none; border: none; border-top: 1px solid rgba(255,255,255,0.05);
  cursor: pointer; font-family: 'Inter', sans-serif;
  font-size: 0.78rem; font-weight: 600; letter-spacing: 0.3px;
  color: #445; transition: color 0.2s, background 0.2s;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
}
.cfm-sb-favs-btn:hover { color: #8a9bb0; background: rgba(255,255,255,0.03); }
.cfm-sb-favs-btn.active { color: #ef4444; background: rgba(239,68,68,0.06); }
.cfm-sb-favs-btn.disabled { opacity: 0.35; cursor: default; }
.cfm-sb-song-panel {
  display: none;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: #080414;
  max-height: 360px;
  overflow-y: auto;
}
.cfm-sb-song-panel.open { display: block; }
.cfm-sb-song-panel::-webkit-scrollbar { width: 4px; }
.cfm-sb-song-panel::-webkit-scrollbar-track { background: transparent; }
.cfm-sb-song-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.cfm-sb-song-panel-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.72rem 0.8rem;
  background: #080414;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cfm-sb-song-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}
.cfm-sb-song-panel-title {
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.cfm-sb-song-panel-count {
  color: #556;
  font-size: 0.68rem;
  font-weight: 800;
  white-space: nowrap;
}
.cfm-sb-song-panel-note {
  margin-left: 0.45rem;
}
.cfm-sb-song-filter {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: rgba(255,255,255,0.035);
  color: #8a9bb0;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 800;
  margin-top: 0.55rem;
  padding: 0.32rem 0.6rem;
}
.cfm-sb-song-filter:hover { color: #fff; background: rgba(255,255,255,0.06); }
.cfm-sb-song-filter.active { color: #ef4444; border-color: rgba(239,68,68,0.34); background: rgba(239,68,68,0.08); }
.cfm-sb-song-filter.disabled { opacity: 0.45; cursor: default; }
.cfm-sb-track-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.58rem 0.8rem;
  background: #080414;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: pointer;
}
.cfm-sb-track-item:hover { background: rgba(255,255,255,0.04); }
.cfm-sb-track-item.active { background: #11172d; }
.cfm-sb-track-item.skipped { opacity: 0.58; }
.cfm-sb-track-item.skipped .cfm-sb-track-name { text-decoration: line-through; }
.cfm-sb-track-num {
  color: #334;
  font-family: 'Rajdhani', sans-serif;
  font-size: 0.8rem;
  text-align: center;
}
.cfm-sb-track-item.active .cfm-sb-track-num { color: #4a9eff; }
.cfm-sb-track-info { min-width: 0; }
.cfm-sb-track-name {
  color: #c0cdd8;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.22;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cfm-sb-track-item.active .cfm-sb-track-name { color: #fff; }
.cfm-sb-track-genre {
  color: #445;
  font-size: 0.62rem;
  margin-top: 0.08rem;
}
.cfm-sb-track-fav {
  background: none;
  border: none;
  color: #334;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0.2rem;
}
.cfm-sb-track-fav.active { color: #ef4444; }
.cfm-sb-track-skip {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  background: rgba(255,255,255,0.035);
  color: #66758a;
  cursor: pointer;
  font: inherit;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1;
  padding: 0.28rem 0.42rem;
  text-transform: uppercase;
}
.cfm-sb-track-skip:hover { color: #fff; background: rgba(255,255,255,0.07); }
.cfm-sb-track-skip.active { color: #f59e0b; border-color: rgba(245,158,11,0.34); background: rgba(245,158,11,0.08); }

/* Mobile: art hidden, layout compressed */
@media (max-width: 860px) {
  #cfm-home { border-radius: 10px; }
  .cfm-sb-art-wrap { display: none; }
  .cfm-sb-controls { padding: 0.4rem 1rem; }
}
@media (max-width: 600px) {
  .cfm-brand { display: none; }
  .cfm-song-info {
    flex: 1 1 auto;
    min-width: 0;
    max-width: none;
    padding: 0 0.7rem;
  }
  .cfm-controls { gap: 0.25rem; padding: 0 0.45rem; }
  .cfm-progress-zone,
  .cfm-volume-zone { display: none; }
  .cfm-playlist-text { display: none; }
  .cfm-playlist-btn { width: 48px; padding: 0; justify-content: center; }
  #cfm-drawer {
    left: 8px; right: 8px; width: auto;
    border-radius: 14px 14px 0 0;
  }
}
`;

  var styleEl = document.createElement('style');
  styleEl.id = 'cfm-player-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // iOS controls volume via hardware only - hide the slider so it's not confusing
  if (isIOS) {
    var iosStyle = document.createElement('style');
    iosStyle.textContent = '.cfm-volume-zone, .cfm-sb-vol { display: none !important; }';
    document.head.appendChild(iosStyle);
  }

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
      '<button class="cfm-playlist-btn" id="cfm-list-btn" type="button" title="Song list" aria-controls="cfm-drawer" aria-expanded="false">',
        '&#9776; <span class="cfm-playlist-text">Songs</span>',
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

  function unmountPlayerDom() {
    var currentFloat = document.getElementById('cfm-float');
    var currentDrawer = document.getElementById('cfm-drawer');
    if (currentFloat && currentFloat.parentNode) currentFloat.parentNode.removeChild(currentFloat);
    if (currentDrawer && currentDrawer.parentNode) currentDrawer.parentNode.removeChild(currentDrawer);
    document.body.classList.remove('has-cfm-player');
    floatEl = null;
    drawerEl = null;
    drawerOpen = false;
  }

  function mountPlayerForCurrentPage() {
    path = window.location.pathname;
    isHome = isHomePath(path);
    unmountPlayerDom();
    if (isHome) buildHome();
    else buildFloat();
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
    var fVol = document.getElementById('cfm-vol');
    updateSliderFill(fVol);
    fVol.addEventListener('input', function () {
      state.vol = parseFloat(this.value); aud.volume = state.vol; saveState(); updateVolIcon(); updateSliderFill(this);
    });
    bindPointerSlider(fVol, function (v) { state.vol = v; aud.volume = v; saveState(); updateVolIcon(); updateSliderFill(fVol); });
    document.getElementById('cfm-bar').addEventListener('pointerdown', function (e) {
      var rect = this.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      if (aud.duration) aud.currentTime = pct * aud.duration;
    });
    document.getElementById('cfm-list-btn').addEventListener('click', function () {
      setDrawerOpen(!drawerOpen);
    });
    document.addEventListener('click', function (e) {
      var listBtn = document.getElementById('cfm-list-btn');
      if (drawerOpen && !drawerEl.contains(e.target) && listBtn && !listBtn.contains(e.target)) setDrawerOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (drawerOpen && e.key === 'Escape') setDrawerOpen(false);
    });
  }

  function setDrawerOpen(open) {
    var listBtn = document.getElementById('cfm-list-btn');
    drawerOpen = open;
    if (drawerEl) drawerEl.classList.toggle('open', drawerOpen);
    if (listBtn) {
      listBtn.classList.toggle('open', drawerOpen);
      listBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
    }
  }

  function renderDrawer() {
    if (!drawerEl) return;
    var favCount = state.favs.length;
    var skipCount = state.skips.length;
    var html = [
      '<div class="cfm-drawer-hdr">',
        '<div class="cfm-drawer-title-row">',
          '<div class="cfm-drawer-title">Song List</div>',
          '<div class="cfm-drawer-count">' + TRACKS.length + ' tracks</div>',
        '</div>',
        '<div class="cfm-drawer-actions">',
          '<button class="cfm-drawer-toggle' + (state.favsOnly ? ' active' : '') + (!favCount && !state.favsOnly ? ' disabled' : '') + '" id="cfm-drawer-favs" type="button">',
            'Liked only' + (favCount ? ' (' + favCount + ')' : ''),
          '</button>',
          '<div class="cfm-drawer-count">' + (skipCount ? skipCount + ' skipped' : 'Skip removes tracks from rotation') + '</div>',
        '</div>',
      '</div>'
    ].join('');
    TRACKS.forEach(function (t, i) {
      var active = i === state.idx;
      var fav = isFav(i);
      var skipped = isSkipped(i);
      html += [
        '<div class="cfm-track-item' + (active ? ' active' : '') + (active && isPlaying ? ' playing' : '') + (skipped ? ' skipped' : '') + '" data-idx="' + i + '">',
          '<div class="cfm-track-marker">',
            '<div class="cfm-track-dot" style="background:' + esc(t.color) + '"></div>',
            '<div class="cfm-track-num">' + (i + 1) + '</div>',
          '</div>',
          '<div class="cfm-track-info">',
            '<div class="cfm-track-name">' + esc(t.title) + '</div>',
            '<div class="cfm-track-genre">' + esc(t.genre) + '</div>',
          '</div>',
          '<button class="cfm-track-fav' + (fav ? ' active' : '') + '" type="button" data-idx="' + i + '" title="' + (fav ? 'Remove favorite' : 'Favorite') + '" aria-label="' + (fav ? 'Remove favorite' : 'Favorite') + ' ' + esc(t.title) + '">',
            fav ? '&#10084;' : '&#9825;',
          '</button>',
          '<button class="cfm-track-skip' + (skipped ? ' active' : '') + '" type="button" data-idx="' + i + '" title="' + (skipped ? 'Include in rotation' : 'Skip in rotation') + '" aria-label="' + (skipped ? 'Include in rotation' : 'Skip in rotation') + ' ' + esc(t.title) + '">',
            skipped ? 'Undo' : 'Skip',
          '</button>',
        '</div>'
      ].join('');
    });
    drawerEl.innerHTML = html;

    var favsToggle = document.getElementById('cfm-drawer-favs');
    if (favsToggle) {
      favsToggle.addEventListener('click', function () {
        if (state.favs.length === 0 && !state.favsOnly) return;
        state.favsOnly = !state.favsOnly;
        saveState();
        updateAll();
      });
    }

    drawerEl.querySelectorAll('.cfm-track-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('cfm-track-fav') || e.target.classList.contains('cfm-track-skip')) return;
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
    drawerEl.querySelectorAll('.cfm-track-skip').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        toggleSkip(idx);
      });
    });
  }

  // ── HOME PLAYER BUILD ────────────────────────────────────────────
  var homeSection;
  var homeListOpen = false;

  function buildHome() {
    if (!isHome) return;
    var target = document.getElementById('cfm-home-section');
    if (!target) return;

    homeSection = target;
    homeSection.innerHTML = [
      '<div id="cfm-home">',
        '<div class="cfm-sb-header">',
          '<div class="cfm-sb-name">Contracting<span>FM</span></div>',
          '<div class="cfm-sb-header-actions">',
            '<span class="cfm-on-air">On Air</span>',
            '<button class="cfm-sb-list-btn" id="cfm-sb-list-btn" type="button" aria-controls="cfm-sb-song-panel" aria-expanded="false" title="Song list">&#9776; Songs</button>',
          '</div>',
        '</div>',
        '<div class="cfm-sb-art-wrap">',
          '<div class="cfm-sb-art" id="cfm-sb-art">',
            '<div class="cfm-sb-art-grid"></div>',
            '<div class="cfm-sb-art-arc cfm-sb-arc-a"></div>',
            '<div class="cfm-sb-art-arc cfm-sb-arc-b"></div>',
            '<div class="cfm-sb-art-arc cfm-sb-arc-c"></div>',
            '<div class="cfm-sb-art-orbital cfm-sb-orbital-a"></div>',
            '<div class="cfm-sb-art-orbital cfm-sb-orbital-b"></div>',
            '<div class="cfm-sb-art-core">',
              '<div class="cfm-sb-art-eq">',
                '<span></span><span></span><span></span><span></span>',
                '<span></span><span></span><span></span><span></span>',
              '</div>',
              '<div class="cfm-sb-art-disc">',
                '<span class="cfm-sb-art-ring"></span>',
                '<span class="cfm-sb-art-ring cfm-sb-art-ring-b"></span>',
                '<span class="cfm-sb-art-center"></span>',
              '</div>',
            '</div>',
          '</div>',
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
        '<div class="cfm-sb-now-playing">',
          '<div class="cfm-sb-np-dot" id="cfm-sb-np-dot"></div>',
          '<div class="cfm-sb-np-info">',
            '<div class="cfm-sb-np-label">Now Playing</div>',
            '<div class="cfm-sb-np-title" id="cfm-sb-np-title">-</div>',
          '</div>',
          '<button class="cfm-sb-np-heart" id="cfm-sb-heart" title="Like this track">&#9825;</button>',
        '</div>',
        '<button class="cfm-sb-favs-btn" id="cfm-sb-favs-btn">&#10084; Play Liked Songs Only</button>',
        '<div class="cfm-sb-song-panel" id="cfm-sb-song-panel"></div>',
      '</div>'
    ].join('');

    renderHomeList();
    bindHome();
    updateAll();
  }

  function renderHomeList() {
    // Update now-playing strip and favs button
    var npTitle = document.getElementById('cfm-sb-np-title');
    var npDot   = document.getElementById('cfm-sb-np-dot');
    var heart   = document.getElementById('cfm-sb-heart');
    var favsBtn = document.getElementById('cfm-sb-favs-btn');
    var listBtn = document.getElementById('cfm-sb-list-btn');
    var songPanel = document.getElementById('cfm-sb-song-panel');
    var t = TRACKS[state.idx];
    if (npTitle) npTitle.textContent = t ? t.title : '-';
    if (npDot)   npDot.classList.toggle('paused', !isPlaying);
    if (heart) {
      var fav = isFav(state.idx);
      heart.classList.toggle('active', fav);
      heart.innerHTML = fav ? '&#10084;' : '&#9825;';
    }
    if (favsBtn) {
      var hasFavs = state.favs.length > 0;
      favsBtn.classList.toggle('active', state.favsOnly);
      favsBtn.classList.toggle('disabled', !hasFavs && !state.favsOnly);
      favsBtn.title = hasFavs ? '' : 'Like a song first';
    }
    if (listBtn) {
      listBtn.classList.toggle('open', homeListOpen);
      listBtn.setAttribute('aria-expanded', homeListOpen ? 'true' : 'false');
    }
    if (songPanel) {
      songPanel.classList.toggle('open', homeListOpen);
      renderHomeSongPanel(songPanel);
    }
  }

  function renderHomeSongPanel(panel) {
    var favCount = state.favs.length;
    var skipCount = state.skips.length;
    var html = [
      '<div class="cfm-sb-song-panel-head">',
        '<div class="cfm-sb-song-panel-row">',
          '<div class="cfm-sb-song-panel-title">Song List</div>',
          '<div class="cfm-sb-song-panel-count">' + TRACKS.length + ' tracks</div>',
        '</div>',
        '<button class="cfm-sb-song-filter' + (state.favsOnly ? ' active' : '') + (!favCount && !state.favsOnly ? ' disabled' : '') + '" id="cfm-sb-song-filter" type="button">',
          'Liked only' + (favCount ? ' (' + favCount + ')' : ''),
        '</button>',
        '<span class="cfm-sb-song-panel-count cfm-sb-song-panel-note">' + (skipCount ? skipCount + ' skipped' : 'Skip removes tracks from rotation') + '</span>',
      '</div>'
    ].join('');

    TRACKS.forEach(function (track, idx) {
      var active = idx === state.idx;
      var fav = isFav(idx);
      var skipped = isSkipped(idx);
      html += [
        '<div class="cfm-sb-track-item' + (active ? ' active' : '') + (skipped ? ' skipped' : '') + '" data-idx="' + idx + '">',
          '<div class="cfm-sb-track-num">' + (idx + 1) + '</div>',
          '<div class="cfm-sb-track-info">',
            '<div class="cfm-sb-track-name">' + esc(track.title) + '</div>',
            '<div class="cfm-sb-track-genre">' + esc(track.genre) + '</div>',
          '</div>',
          '<button class="cfm-sb-track-fav' + (fav ? ' active' : '') + '" type="button" data-idx="' + idx + '" aria-label="' + (fav ? 'Remove favorite' : 'Favorite') + ' ' + esc(track.title) + '">',
            fav ? '&#10084;' : '&#9825;',
          '</button>',
          '<button class="cfm-sb-track-skip' + (skipped ? ' active' : '') + '" type="button" data-idx="' + idx + '" aria-label="' + (skipped ? 'Include in rotation' : 'Skip in rotation') + ' ' + esc(track.title) + '">',
            skipped ? 'Undo' : 'Skip',
          '</button>',
        '</div>'
      ].join('');
    });

    panel.innerHTML = html;

    var filterBtn = document.getElementById('cfm-sb-song-filter');
    if (filterBtn) {
      filterBtn.addEventListener('click', function () {
        if (state.favs.length === 0 && !state.favsOnly) return;
        state.favsOnly = !state.favsOnly;
        saveState();
        updateAll();
      });
    }
    panel.querySelectorAll('.cfm-sb-track-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('cfm-sb-track-fav') || e.target.classList.contains('cfm-sb-track-skip')) return;
        var idx = parseInt(this.getAttribute('data-idx'));
        loadTrack(idx, true);
        playerReady = true;
      });
    });
    panel.querySelectorAll('.cfm-sb-track-fav').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        toggleFav(idx);
      });
    });
    panel.querySelectorAll('.cfm-sb-track-skip').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        toggleSkip(idx);
      });
    });
  }

  // Update range slider track fill to visually reflect current value
  function updateSliderFill(el) {
    if (!el) return;
    var pct = ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1);
    el.style.background = 'linear-gradient(to right, var(--cfm-accent, #4a9eff) 0%, var(--cfm-accent, #4a9eff) ' + pct + '%, rgba(255,255,255,0.12) ' + pct + '%, rgba(255,255,255,0.12) 100%)';
  }

  // Pointer event slider - works reliably on iOS, Android, and desktop
  function bindPointerSlider(el, onChange) {
    if (!el) return;
    var active = false;
    function calc(e) {
      var rect = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }
    el.addEventListener('pointerdown', function (e) {
      active = true;
      el.setPointerCapture(e.pointerId);
      var v = calc(e); el.value = v; onChange(v);
    });
    el.addEventListener('pointermove', function (e) {
      if (!active) return;
      var v = calc(e); el.value = v; onChange(v);
    });
    el.addEventListener('pointerup',     function () { active = false; });
    el.addEventListener('pointercancel', function () { active = false; });
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
      toggleFav(state.idx); renderHomeList();
    });
    document.getElementById('cfm-sb-favs-btn').addEventListener('click', function () {
      if (state.favs.length === 0 && !state.favsOnly) return;
      state.favsOnly = !state.favsOnly; saveState(); renderHomeList();
    });
    document.getElementById('cfm-sb-list-btn').addEventListener('click', function () {
      homeListOpen = !homeListOpen;
      renderHomeList();
    });
    var sbVol = document.getElementById('cfm-sb-vol');
    updateSliderFill(sbVol);
    sbVol.addEventListener('input', function () {
      state.vol = parseFloat(this.value); aud.volume = state.vol; saveState(); updateSliderFill(this);
    });
    bindPointerSlider(sbVol, function (v) { state.vol = v; aud.volume = v; saveState(); updateSliderFill(sbVol); });
    document.getElementById('cfm-sb-bar').addEventListener('pointerdown', function (e) {
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
    var ar  = document.getElementById('cfm-sb-art');
    var dot = document.getElementById('cfm-sb-np-dot');
    if (ar)  { if (isPlaying) ar.classList.add('playing');    else ar.classList.remove('playing'); }
    if (dot) { if (isPlaying) dot.classList.remove('paused'); else dot.classList.add('paused'); }
    document.querySelectorAll('.cfm-on-air').forEach(function (el) {
      el.textContent = isPlaying ? 'On Air' : 'Off Air';
      el.classList.toggle('off-air', !isPlaying);
    });
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
    renderHomeList();
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

  // Soft navigation keeps this Audio object alive while simple site pages swap.
  var softNavReady = false;
  var softNavBusy = false;
  var softHeadMarked = false;
  var softChromeBound = false;
  var SOFT_NAV_PAGES = [
    'index.html',
    'tools.html',
    'training.html',
    'links.html',
    'about.html',
    'contact.html',
    'customer-education.html',
    'ai-acquisitions.html',
    'ai-introduction.html',
    'ai-types.html',
    'ai-building.html',
    'ai-not-using.html',
    'ai-usage.html',
    'cco-training-tools.html',
    'udm-role-overview.html',
    'unit-deployment-manager.html',
    'why-behind-the-buy.html',
    'subcontracting-trap.html',
    'set-asides.html',
    'industry.html',
    'federal-register.html',
    'gao-decisions.html',
    'asbca.html',
    'far-overhaul.html'
  ];

  function softPageName(url) {
    var name = (url.pathname.split('/').pop() || 'index.html').toLowerCase();
    return name || 'index.html';
  }

  function isSoftPage(url) {
    return SOFT_NAV_PAGES.indexOf(softPageName(url)) > -1;
  }

  function canSoftNavigate(link, url) {
    if (!link || !url) return false;
    if (window.location.protocol === 'file:') return false;
    if (link.hasAttribute('download') || link.hasAttribute('data-full-reload')) return false;
    if (link.target && link.target !== '_self') return false;
    if (url.origin !== window.location.origin) return false;
    if (!/^https?:$/.test(url.protocol)) return false;
    if (!isSoftPage(url)) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return true;
  }

  function markCurrentSoftHead() {
    if (softHeadMarked) return;
    softHeadMarked = true;
    document.querySelectorAll('head style, head meta[name="description"], head meta[property^="og:"], head meta[name^="twitter:"], head link[rel="canonical"]').forEach(function (node) {
      if (node.id === 'cfm-player-styles') return;
      node.setAttribute('data-kthq-soft-head', 'true');
    });
  }

  function updateSoftHead(doc) {
    document.title = doc.title || document.title;
    document.querySelectorAll('[data-kthq-soft-head]').forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    doc.querySelectorAll('head style, head meta[name="description"], head meta[property^="og:"], head meta[name^="twitter:"], head link[rel="canonical"]').forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute('data-kthq-soft-head', 'true');
      document.head.appendChild(clone);
    });
  }

  function shouldSkipSoftScript(script) {
    var rawSrc = script.getAttribute('src') || '';
    if (!rawSrc) return false;
    var src = rawSrc.toLowerCase();
    return src.indexOf('main.js') > -1 ||
      src.indexOf('player.js') > -1 ||
      src.indexOf('googletagmanager.com') > -1 ||
      src.indexOf('gc.zgo.at') > -1;
  }

  function runSoftScript(script, pageUrl) {
    return new Promise(function (resolve) {
      if (shouldSkipSoftScript(script)) { resolve(); return; }
      var src = script.getAttribute('src');
      var next = document.createElement('script');
      Array.prototype.forEach.call(script.attributes, function (attr) {
        if (attr.name !== 'src') next.setAttribute(attr.name, attr.value);
      });
      next.setAttribute('data-kthq-soft-script', 'true');
      if (src) {
        next.async = false;
        next.src = new URL(src, pageUrl.href).href;
        next.onload = function () { resolve(); };
        next.onerror = function () { resolve(); };
        document.body.appendChild(next);
      } else {
        next.text = script.textContent || '';
        document.body.appendChild(next);
        if (next.parentNode) next.parentNode.removeChild(next);
        resolve();
      }
    });
  }

  async function runSoftPageScripts(scripts, pageUrl) {
    for (var i = 0; i < scripts.length; i += 1) {
      await runSoftScript(scripts[i], pageUrl);
    }
  }

  function initSoftPageChrome() {
    var navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 10);

    if (!window.__kthqSoftScrollBound) {
      window.__kthqSoftScrollBound = true;
      window.addEventListener('scroll', function () {
        var currentNavbar = document.getElementById('navbar');
        if (currentNavbar) currentNavbar.classList.toggle('scrolled', window.scrollY > 10);
      });
    }

    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    if (toggle && links && !toggle.getAttribute('data-kthq-soft-bound')) {
      toggle.setAttribute('data-kthq-soft-bound', 'true');
      toggle.addEventListener('click', function () {
        links.classList.toggle('open');
      });
    }

    document.querySelectorAll('.nav-more-toggle').forEach(function (btn) {
      if (btn.getAttribute('data-kthq-soft-bound')) return;
      btn.setAttribute('data-kthq-soft-bound', 'true');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var parent = btn.closest('.nav-more');
        if (parent) parent.classList.toggle('open');
      });
    });

    if (!softChromeBound) {
      softChromeBound = true;
      document.addEventListener('click', function (e) {
        var currentLinks = document.getElementById('navLinks');
        if (!e.target.closest('.nav-more')) {
          document.querySelectorAll('.nav-more.open').forEach(function (el) {
            el.classList.remove('open');
          });
        }
        if (!e.target.closest('.navbar') && currentLinks) {
          currentLinks.classList.remove('open');
        }
      });
    }
  }

  function updateSoftAnalytics() {
    var pagePath = window.location.pathname + window.location.search;
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('config', 'G-X2RXS78N7K', {
          page_path: pagePath,
          page_title: document.title
        });
      }
    } catch (e) {}
    try {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: pagePath, title: document.title });
      }
    } catch (e) {}
  }

  async function softNavigateTo(url, push) {
    if (softNavBusy) return;
    softNavBusy = true;
    try {
      markCurrentSoftHead();
      var res = await fetch(url.href, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Soft navigation failed: ' + res.status);
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var scripts = Array.prototype.slice.call(doc.body.querySelectorAll('script'));
      scripts.forEach(function (script) {
        if (script.parentNode) script.parentNode.removeChild(script);
      });

      updateSoftHead(doc);
      document.body.className = doc.body.className || '';
      document.body.innerHTML = doc.body.innerHTML;
      if (push) window.history.pushState({ kthqSoftNav: true }, '', url.href);

      initSoftPageChrome();
      mountPlayerForCurrentPage();
      await runSoftPageScripts(scripts, url);
      updateSoftAnalytics();

      if (url.hash) {
        var target = document.getElementById(url.hash.slice(1));
        if (target) target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    } catch (err) {
      window.location.href = url.href;
    } finally {
      softNavBusy = false;
    }
  }

  function initSoftNavigation() {
    if (softNavReady || !window.history || !window.fetch || !window.DOMParser) return;
    if (!isSoftPage(new URL(window.location.href))) return;
    softNavReady = true;
    initSoftPageChrome();
    if (window.location.protocol !== 'file:') {
      try { window.history.replaceState({ kthqSoftNav: true }, '', window.location.href); } catch (e) {}
    }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      var url;
      try { url = new URL(link.getAttribute('href'), window.location.href); } catch (err) { return; }
      if (!canSoftNavigate(link, url)) return;
      e.preventDefault();
      softNavigateTo(url, true);
    });

    window.addEventListener('popstate', function () {
      var url = new URL(window.location.href);
      if (isSoftPage(url)) softNavigateTo(url, false);
      else window.location.reload();
    });
  }

  // ── INIT ─────────────────────────────────────────────────────────
  function resumeAudio() {
    var targetTime = state.time;
    var shouldPlay = state.wasPlaying;
    // #t= fragment tells the browser to buffer from this position immediately
    aud.src = trackUrl(state.idx) + (targetTime > 0 ? '#t=' + targetTime.toFixed(1) : '');
    aud.preload = 'auto';
    aud.load();
    aud.addEventListener('canplay', function onReady() {
      aud.removeEventListener('canplay', onReady);
      // Correct position if browser ignored the fragment
      if (targetTime > 0 && Math.abs(aud.currentTime - targetTime) > 2) {
        aud.currentTime = targetTime;
      }
      if (shouldPlay) {
        aud.play().then(function () {
          playerReady = true;
        }).catch(function () {
          // Mobile browser blocked autoplay. Mark that we *wanted* to play so
          // the very first user tap anywhere on the page will resume playback.
          playerReady = true;
          isPlaying = false;
          updatePlayBtns();
          function resumeOnTap() {
            aud.play().catch(function () {});
            document.removeEventListener('pointerdown', resumeOnTap, true);
          }
          document.addEventListener('pointerdown', resumeOnTap, true);
        });
      }
    });
    updateAll();
  }

  function init() {
    // sessionStorage lives only for the current tab session.
    // If it's empty, this is a brand new visit - pick a random track.
    // If it has the key, we're just navigating between pages - resume normally.
    var freshVisit = !sessionStorage.getItem('cfm_session');
    if (freshVisit) {
      sessionStorage.setItem('cfm_session', '1');
      var startPool = getPool();
      state.idx = startPool[Math.floor(Math.random() * startPool.length)];
      state.time = 0;
      state.wasPlaying = false;
    }
    if (isHome) {
      buildHome();
      if (state.wasPlaying) resumeAudio();
    } else {
      buildFloat();
      if (state.wasPlaying) resumeAudio();
    }
    initSoftNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
