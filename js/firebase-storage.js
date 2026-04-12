/* ==========================================================================
   CCO CAPSTONE — Firebase storage adapter  v0.2.14
   Mirrors localStorage state to Firebase Realtime Database so multiple
   devices can share an exercise session. Loaded dynamically by net-loader.js
   when the URL contains ?net=1.

   Data layout in Firebase:
     /sessions/{CODE}/state      — full exercise state blob (JSON)
     /sessions/{CODE}/outbox     — student outbox append-log (JSON array)
     /sessions/{CODE}/presence/{clientId} — heartbeat per connected client
     /sessions/{CODE}/config     — exercise config (roster, scenario, etc.)

   Sync flow:
     Outbound: engine saveState() → localStorage + netHook → Firebase set()
     Inbound:  Firebase on('value') → Engine.applyRemoteState() →
                 writes localStorage → loadState → dispatch engine:sync
     Loop prevention: applyRemoteState sets _skipNetPush so the inbound
                      write doesn't echo back to Firebase.
   ========================================================================== */

(function () {
  'use strict';

  // Badge helpers from net-loader (may not exist if loaded standalone)
  var B = window._ccoNetBadge || {
    ok:   function () {},
    live: function () {},
    fail: function (m) { console.warn('[firebase-storage] ' + m); }
  };

  // ---- Guards ----
  if (!window.firebase || !window.firebase.database) {
    B.fail('NET: no Firebase SDK');
    return;
  }
  if (!window.CCOFirebaseConfig || window.CCOFirebaseConfig.apiKey === 'PASTE_YOUR_API_KEY') {
    B.fail('NET: no config');
    return;
  }
  if (!window.Engine) {
    B.fail('NET: no Engine');
    return;
  }
  if (!Engine.setNetworkHooks) {
    B.fail('NET: Engine missing hooks');
    return;
  }

  // ---- Initialize Firebase ----
  var app, db;
  try {
    app = firebase.initializeApp(window.CCOFirebaseConfig);
    db  = firebase.database();
  } catch (err) {
    B.fail('NET init: ' + (err.message || err));
    return;
  }

  // ---- Session tracking ----
  var _boundSession = null;
  var _listeners = [];

  function stateRef()        { return db.ref('sessions/' + _boundSession + '/state'); }
  function outboxRef()       { return db.ref('sessions/' + _boundSession + '/outbox'); }
  function presenceRef(cid)  { return db.ref('sessions/' + _boundSession + '/presence/' + cid); }
  function presenceRootRef() { return db.ref('sessions/' + _boundSession + '/presence'); }
  function configRef()       { return db.ref('sessions/' + _boundSession + '/config'); }

  // ---- Echo prevention ----
  var _lastWrittenUpdate = 0;

  // ---- Outbound hooks (engine → Firebase) ----
  Engine.setNetworkHooks({
    onStateWrite: function (sessionCode, snap) {
      if (!_boundSession) return;
      _lastWrittenUpdate = snap._lastUpdate || Date.now();
      stateRef().set(snap).catch(function (e) {
        console.warn('[firebase] state write fail:', e);
      });
    },
    onOutboxWrite: function (sessionCode, list) {
      if (!_boundSession) return;
      outboxRef().set(list).catch(function (e) {
        console.warn('[firebase] outbox write fail:', e);
      });
    },
    onPresenceWrite: function (sessionCode, clientId, payload) {
      if (!_boundSession) return;
      var ref = presenceRef(clientId);
      ref.set(payload).catch(function (e) {
        console.warn('[firebase] presence write fail:', e);
      });
      ref.onDisconnect().remove().catch(function () {});
    },
    onPresenceStop: function (sessionCode, clientId) {
      if (!_boundSession) return;
      presenceRef(clientId).remove().catch(function () {});
    }
  });

  // ---- Bind Firebase listeners for a session ----
  function bindSession(code) {
    if (!code || code === 'default') return;
    if (code === _boundSession) return;

    unbindListeners();
    _boundSession = code;
    console.log('[firebase] Binding session: ' + code);
    B.live('● NET · ' + code);

    // Inbound: state
    var stateCb = function (snapshot) {
      var val = snapshot.val();
      if (!val) return;
      if (val._lastUpdate && val._lastUpdate === _lastWrittenUpdate) return;
      Engine.applyRemoteState(val);
    };
    stateRef().on('value', stateCb);
    _listeners.push({ ref: stateRef(), event: 'value', fn: stateCb });

    // Inbound: outbox
    var outboxCb = function (snapshot) {
      var val = snapshot.val();
      if (!val || !Array.isArray(val) || val.length === 0) return;
      Engine.applyRemoteOutbox(val);
      if (!Engine.getState().readOnly) {
        outboxRef().set([]).catch(function () {});
      }
    };
    outboxRef().on('value', outboxCb);
    _listeners.push({ ref: outboxRef(), event: 'value', fn: outboxCb });

    // Inbound: presence
    var pAdd = function (snap) {
      var p = snap.val();
      if (p && p.clientId) Engine.applyRemotePresence(p.clientId, p);
    };
    var pChange = function (snap) {
      var p = snap.val();
      if (p && p.clientId) Engine.applyRemotePresence(p.clientId, p);
    };
    var pRemove = function (snap) {
      var p = snap.val();
      if (p && p.clientId) Engine.removeRemotePresence(p.clientId);
    };
    presenceRootRef().on('child_added', pAdd);
    presenceRootRef().on('child_changed', pChange);
    presenceRootRef().on('child_removed', pRemove);
    _listeners.push({ ref: presenceRootRef(), event: 'child_added', fn: pAdd });
    _listeners.push({ ref: presenceRootRef(), event: 'child_changed', fn: pChange });
    _listeners.push({ ref: presenceRootRef(), event: 'child_removed', fn: pRemove });

    // Inbound: config
    var configCb = function (snapshot) {
      var val = snapshot.val();
      if (!val) return;
      try {
        var json = JSON.stringify(val);
        localStorage.setItem('cco-capstone-config', json);
        localStorage.setItem('cco-capstone-config:' + code, json);
      } catch (e) {}
    };
    configRef().on('value', configCb);
    _listeners.push({ ref: configRef(), event: 'value', fn: configCb });

    // Initial state sync — take newer of local vs remote
    stateRef().once('value').then(function (snapshot) {
      var val = snapshot.val();
      if (val && val._lastUpdate) {
        var localRaw = Engine.getRawStateString ? Engine.getRawStateString() : null;
        var localUpdate = 0;
        if (localRaw) {
          try { localUpdate = JSON.parse(localRaw)._lastUpdate || 0; } catch (e) {}
        }
        if (val._lastUpdate > localUpdate) {
          console.log('[firebase] Remote state is newer — applying.');
          Engine.applyRemoteState(val);
        }
      }
    });

    // Seed config to Firebase
    var localConfig = null;
    try {
      var raw = localStorage.getItem('cco-capstone-config:' + code) ||
                localStorage.getItem('cco-capstone-config');
      if (raw) localConfig = JSON.parse(raw);
    } catch (e) {}
    if (localConfig) {
      configRef().set(localConfig).catch(function (e) {
        console.warn('[firebase] config seed fail:', e);
      });
    }
  }

  function unbindListeners() {
    _listeners.forEach(function (l) {
      try { l.ref.off(l.event, l.fn); } catch (e) {}
    });
    _listeners = [];
  }

  // ---- Show standby badge ----
  B.ok('● NET (standby)');

  // ---- Auto-bind if session already known ----
  var currentSession = Engine.getSession();
  if (currentSession && currentSession !== 'default') {
    bindSession(currentSession);
  }

  // ---- Watch for session changes ----
  if (!_boundSession) {
    var pollCount = 0;
    var pollTimer = setInterval(function () {
      pollCount++;
      var s = Engine.getSession();
      if (s && s !== 'default' && s !== _boundSession) {
        bindSession(s);
        clearInterval(pollTimer);
      }
      if (pollCount > 300) clearInterval(pollTimer);
    }, 1000);

    document.addEventListener('engine:prelaunch', function () {
      var s = Engine.getSession();
      if (s && s !== 'default' && s !== _boundSession) {
        bindSession(s);
        clearInterval(pollTimer);
      }
    });
  }

  // ---- Expose for manual binding ----
  window.CCOFirebaseBind = bindSession;

  // ---- Signal to net-loader that we finished OK ----
  window._ccoFirebaseAdapterReady = true;

  console.log('[firebase] Adapter ready.' +
    (_boundSession ? ' Bound to ' + _boundSession + '.' : ' Waiting for session.'));

})();
