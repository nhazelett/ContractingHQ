/* ==========================================================================
   CCO CAPSTONE — Network mode loader  v0.2.14
   Checks if the URL contains ?net=1 (or &net=1). If yes, dynamically loads
   the Firebase SDK + config + storage adapter. If no, does nothing — the
   prototype runs in local-only mode exactly as before.

   Include this script tag on every HTML page AFTER engine.js:
     <script src="js/net-loader.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  // Check for net=1 in query string OR hash
  var search = location.search || '';
  var hash   = location.hash   || '';
  var netOn  = /[?&]net=1/.test(search) || /[?&]net=1/.test(hash);

  if (!netOn) return;

  console.log('[net-loader] Network mode requested. Loading Firebase...');

  // -- Badge: visible immediately so we know net-loader ran --
  var badge = document.createElement('div');
  badge.id = 'cco-net-badge';
  badge.style.cssText = [
    'position:fixed', 'bottom:8px', 'right:8px', 'z-index:99999',
    'background:rgba(79,195,215,0.18)', 'border:1px solid rgba(79,195,215,0.5)',
    'color:#4FC3D7', 'font-size:10px', 'font-family:monospace',
    'padding:3px 8px', 'border-radius:4px', 'letter-spacing:1px',
    'pointer-events:none', 'opacity:0.5'
  ].join(';');
  badge.textContent = '● NET loading…';
  document.body.appendChild(badge);

  function badgeOk(msg)   {
    badge.textContent = msg;
    badge.style.opacity = '0.5';
    badge.style.color = '#4FC3D7';
    badge.style.borderColor = 'rgba(79,195,215,0.5)';
    badge.style.background = 'rgba(79,195,215,0.18)';
  }
  function badgeLive(msg)  {
    badge.textContent = msg;
    badge.style.opacity = '1';
    badge.style.color = '#4FC3D7';
    badge.style.borderColor = 'rgba(79,195,215,0.5)';
    badge.style.background = 'rgba(79,195,215,0.18)';
  }
  function badgeFail(msg) {
    badge.textContent = '✗ ' + msg;
    badge.style.opacity = '1';
    badge.style.color = '#D9552A';
    badge.style.borderColor = 'rgba(217,85,42,0.7)';
    badge.style.background = 'rgba(217,85,42,0.15)';
  }

  // Expose badge helpers globally so firebase-storage.js can use them
  window._ccoNetBadge = { ok: badgeOk, live: badgeLive, fail: badgeFail };

  // Firebase compat SDK v10
  var CDN = 'https://www.gstatic.com/firebasejs/10.12.2';

  var scripts = [
    { src: CDN + '/firebase-app-compat.js',      label: 'firebase-app' },
    { src: CDN + '/firebase-database-compat.js',  label: 'firebase-db' },
    { src: 'js/firebase-config.js',               label: 'config' },
    { src: 'js/firebase-storage.js',              label: 'adapter' }
  ];

  function loadNext(i) {
    if (i >= scripts.length) {
      console.log('[net-loader] All scripts loaded.');

      // Verify firebase-storage.js actually ran by checking for its flag
      setTimeout(function () {
        if (!window._ccoFirebaseAdapterReady) {
          // Adapter script loaded but IIFE didn't finish — something crashed.
          // Try to diagnose what's available:
          var diag = [];
          if (!window.firebase)                   diag.push('no firebase global');
          else if (!window.firebase.database)     diag.push('no firebase.database');
          if (!window.CCOFirebaseConfig)           diag.push('no config');
          if (!window.Engine)                      diag.push('no Engine');
          else if (!Engine.setNetworkHooks)        diag.push('Engine missing hooks');
          if (diag.length === 0)                   diag.push('unknown — check console');
          badgeFail('adapter init failed: ' + diag.join(', '));
        }
      }, 500);

      return;
    }

    badgeOk('● NET ' + scripts[i].label + '…');

    var s = document.createElement('script');
    s.src = scripts[i].src;
    s.onload = function () {
      console.log('[net-loader] Loaded: ' + scripts[i].label);
      loadNext(i + 1);
    };
    s.onerror = function () {
      console.error('[net-loader] FAILED: ' + scripts[i].src);
      badgeFail('NET fail: ' + scripts[i].label);
    };
    document.head.appendChild(s);
  }

  // Wait for Engine
  if (window.Engine) {
    loadNext(0);
  } else {
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (window.Engine || tries > 50) {
        clearInterval(poll);
        if (!window.Engine) {
          console.error('[net-loader] Engine not found after 2.5s.');
          badgeFail('NET: Engine not found');
          return;
        }
        loadNext(0);
      }
    }, 50);
  }
})();
