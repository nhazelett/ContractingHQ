/* ==========================================================================
   CCO CAPSTONE — EXERCISE ENGINE v0.2
   Clock, scheduler, state, cross-window sync via localStorage
   ========================================================================== */

const Engine = (function () {
  // v0.2.11: session-scoped storage keys. Every exercise run is bound to a
  // short session code (e.g. "X7K2QM") so multiple exercises can coexist on
  // one machine (and eventually one shared relay). The code is read from the
  // URL hash on init (?session=CODE or #session=CODE), or defaults to
  // "default" so legacy single-laptop use keeps working.
  const STATE_KEY_PREFIX = 'cco-capstone-state';
  const OUTBOX_KEY_PREFIX = 'cco-capstone-student-outbox';
  const PRESENCE_KEY_PREFIX = 'cco-capstone-presence';
  const CONFIG_KEY = 'cco-capstone-config';
  // v0.2.12: non-session-scoped pointer to "the active session on this
  // machine". Written when startex.html launches an exercise; read by any
  // view that was opened without a #session=XYZ URL hash. Lets late joiners
  // (and crash-recovery re-opens) auto-bind to the live session.
  const ACTIVE_SESSION_KEY = 'cco-capstone-active-session';

  let currentSession = 'default';
  function stateKey()   { return `${STATE_KEY_PREFIX}:${currentSession}`; }
  function outboxKey()  { return `${OUTBOX_KEY_PREFIX}:${currentSession}`; }

  // v0.2.13: network hooks for Firebase relay (or any future backend).
  // firebase-storage.js installs callbacks here. When set, every saveState /
  // outbox / presence write is mirrored to the relay. Inbound relay updates
  // call applyRemoteState/applyRemoteOutbox which write to localStorage AND
  // re-trigger the engine's sync, with _skipNetPush set so the write doesn't
  // echo back to the relay.
  let _netHooks = null;   // { onStateWrite, onOutboxWrite, onPresenceWrite, onPresenceStop }
  let _skipNetPush = false;
  function setNetworkHooks(hooks) { _netHooks = hooks; }
  function isNetworked() { return !!_netHooks; }
  function presenceKey(clientId) {
    return `${PRESENCE_KEY_PREFIX}:${currentSession}:${clientId}`;
  }
  function presencePrefix() {
    return `${PRESENCE_KEY_PREFIX}:${currentSession}:`;
  }

  // Parse session code from URL hash or query. Supports:
  //   #session=X7K2QM    ?session=X7K2QM    #X7K2QM (bare)
  function readSessionFromLocation() {
    try {
      const hash = (location.hash || '').replace(/^#/, '');
      if (hash) {
        const m = hash.match(/session=([A-Za-z0-9]+)/);
        if (m) return m[1].toUpperCase();
        // bare #X7K2QM shorthand
        if (/^[A-Z0-9]{4,12}$/i.test(hash)) return hash.toUpperCase();
      }
      const qp = new URLSearchParams(location.search);
      const q = qp.get('session');
      if (q) return q.toUpperCase();
    } catch (e) { /* ignore */ }
    return null;
  }

  // Generate a new 6-char session code. Avoids ambiguous chars (0/O, 1/I/L).
  function generateSessionCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  function setSession(code) {
    if (!code) return;
    currentSession = String(code).toUpperCase();
  }
  function getSession() { return currentSession; }

  // v0.2.12: active-session pointer helpers. Single source of truth for
  // "what session should a freshly-opened view default to?" when no URL
  // hash is present. Not session-scoped — one pointer per machine.
  function writeActiveSessionPointer(code) {
    try {
      if (code) localStorage.setItem(ACTIVE_SESSION_KEY, String(code).toUpperCase());
    } catch (e) { /* ignore */ }
  }
  function readActiveSessionPointer() {
    try { return localStorage.getItem(ACTIVE_SESSION_KEY); }
    catch (e) { return null; }
  }
  function clearActiveSessionPointer() {
    try { localStorage.removeItem(ACTIVE_SESSION_KEY); }
    catch (e) { /* ignore */ }
  }

  // Helpers for callers (student.js, mobile.js, debug panels) that want to
  // peek at the raw state blob without hardcoding the storage key.
  function getRawStateString() {
    try { return localStorage.getItem(stateKey()); }
    catch (e) { return null; }
  }
  function getStateKeyName() { return stateKey(); }

  // Parse the "as=TYPE:ID" identity hint from the URL hash so role views can
  // pre-select a persona on launch. Returns { type, id } or null.
  // Example: student.html#session=X7K2QM&as=student:stu-1 → {type:'student', id:'stu-1'}
  function readIdentityFromLocation() {
    try {
      const hash = (location.hash || '').replace(/^#/, '');
      const parts = hash.split('&');
      for (const p of parts) {
        const m = p.match(/^as=([^:]+):(.+)$/);
        if (m) return { type: decodeURIComponent(m[1]), id: decodeURIComponent(m[2]) };
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // Initialize from URL on module load. Views that want a specific session
  // can still call Engine.setSession(...) before loadState() to override.
  // v0.2.12: if no URL hash, fall back to the active-session pointer so
  // bare opens of student.html / trainer.html / etc. auto-join the live
  // session. Late joiners and crash-recovery re-opens land in the right
  // place without the user having to paste a link.
  {
    const fromUrl = readSessionFromLocation();
    if (fromUrl) {
      currentSession = fromUrl;
    } else {
      const fromPointer = readActiveSessionPointer();
      if (fromPointer) currentSession = String(fromPointer).toUpperCase();
    }
  }

  const state = {
    config: null,
    injects: [],
    phoneScripts: {},
    contacts: [],
    clock: {
      running: false,
      exerciseStart: null,
      exerciseMs: 0,
      dayStart: 8 * 60,
      wallToExerciseRatio: 10,
      interval: null,
      // v0.2.10: wall-clock sync mode.
      //   mode: 'sim'  — simulated clock. exerciseMs accumulates at
      //                  (1s real) * wallToExerciseRatio each tick. Default.
      //   mode: 'wall' — exerciseMs tracks real wall-clock elapsed from
      //                  wallStartRealTime (minus paused time). dayStart is
      //                  set at startExercise() to the current local HH:MM,
      //                  so D1 0930 fires when the real wall clock says 0930.
      mode: 'sim',
      wallStartRealTime: 0,
      pausedAccumMs: 0,
      pausedAt: 0
    },
    fired: new Set(),
    firedSms: new Set(),
    flagged: [],
    inbox: [],
    smsThreads: {},
    paused: false,
    // v0.2.6: resolved per-inject fire times (totalMinutes from exercise start).
    // Populated once at startExercise() so randomness is stable across ticks
    // and persists across page reloads via saveState/loadState.
    _resolvedTriggers: {},
    // v0.2.8: fixed-role assignments for inject routing.
    //   assignments — studentId -> role key. Role keys are one of:
    //     'cco'           — Contingency Contracting Officer (worker, default)
    //     'aco'           — Administrative CO (worker, gets cco + extra injects)
    //     'team_lead'     — Team Lead (leadership, minimum floor)
    //     'commander'     — Commander (top of leadership fall-through)
    //     'sel'           — Senior Enlisted Leader
    //     'flight_chief'  — Flight Chief
    //
    //   Each student holds ONE role. Leadership fall-through order for
    //   "who's primary on a leadership inject" is:
    //     commander -> sel -> flight_chief -> team_lead
    //   If none are assigned at fire time, leadership items land as broadcast
    //   (assigned_to = null) and all leaders will still see them once filled.
    //
    //   Filtering rules (applied client-side in student.js):
    //     role=cco           -> sees broadcast + role_tag:'cco'
    //     role=aco           -> sees broadcast + cco + aco
    //     role=team_lead/... -> sees EVERYTHING (leadership has full visibility)
    //
    //   Delegation (v0.2.9) lets leaders forward an item to a subordinate by
    //   stamping item.delegated_to. That bypasses the role_tag filter.
    team_roles: { assignments: {} },

    // v0.2.9: trainer_queue holds student-initiated asks waiting for a
    // trainer response. Shape:
    //   { id, personaId, personaName, injectId, threadId, body, time,
    //     handled: false, handledAt: null }
    // trainerReply() either consumes an entry (setting handled=true) and
    // pushes a reply inbox item back to that student, or the trainer can
    // fire a "canned" reply tied to a specific inject quick_fire template.
    trainer_queue: [],

    // v0.2.9: inject_status — trainer's per-inject complete/incomplete flag.
    // Shape: { [injectId]: 'complete' | 'incomplete' }
    // Unset = not yet flagged. Synchronizes to the observer (inspector) view
    // through the same localStorage channel as the rest of state.
    inject_status: {},

    // v0.2.11: exercise phase state. Drives the "launch moment" — trainer
    // launches from startex (phase: 'pre-exercise'), other views land on
    // their role dashboards but show a "WAITING FOR KICKOFF" banner. Trainer
    // hits "Start Exercise" and phase flips to 'cold-open'; banners clear,
    // clock starts, the Day 1 arc begins. Phases:
    //   'pre-exercise' — launched but clock not running; roster locked in;
    //                    clients join and wait
    //   'cold-open'    — exercise running; Day 1 first 60-90min (turnover,
    //                    doc pile, team formation)
    //   'operational'  — Day 1 mid-day (requirements wave etc.)
    //   'crisis'       — Day 1 evening (missile drill)
    //   'day2-grind'   — Day 2 with consequences
    //   'day3-turnover'— Day 3 wrap-up
    //   'endex'        — exercise complete
    // For the prototype we only actively use 'pre-exercise' vs 'cold-open'
    // vs 'endex'. The other values are documented placeholders.
    session: {
      phase: 'pre-exercise',
      phaseStartedAt: null,
      launchedAt: null
    },

    // v0.2.12: unclaimed injects tray. When a leadership-tagged inject fires
    // and there is no team lead / commander / SEL / flight chief assigned,
    // the item still lands in the inbox with assigned_to=null (existing
    // retroactiveRouteRefresh path), but we ALSO push a tray entry here so
    // the whole team sees a loud "NOBODY OWNS THIS" warning until a role
    // gets filled. When retroactiveRouteRefresh() re-stamps the inbox item,
    // we mark the matching tray entry resolved (but keep it in state for
    // inspector grading — gap duration shows up in the observation log).
    // Shape: [{ injectId, inboxItemId, role_tag, firedAtMinutes,
    //           firedAtDisplay, resolvedAtMinutes, resolvedAtDisplay,
    //           resolvedByStudentId }]
    unclaimedInjects: [],

    // v0.2.14: alarm response tracking + KIA system.
    // alarm_responses — per-alarm, per-player acknowledgement log.
    // Shape: { [alarmInjectId]: { firedAtWall: ms, responses: {
    //   [playerId]: { acked: bool, ackedAtWall: ms, ackedAtExercise: str,
    //                 deadAtWall: ms (set after 4min unack) } } } }
    alarm_responses: {},

    // kia_roster — players marked killed-in-action by white cell.
    // Shape: { [playerId]: { markedAt: ms, markedAtExercise: str,
    //   alarmId: str|null, replacedBy: str|null, replacedAt: ms|null } }
    kia_roster: {}
  };

  // ----- Content loaders -----
  // Order of preference:
  //   1. window.__CCO_DATA (inline bundle, loaded via <script> — works from file://)
  //   2. fetch() of JSON files (works from local server)
  // Chrome blocks fetch() on file:// URLs, so the inline bundle is the only
  // path that works when users double-click index.html. Errors get logged to
  // state._loadErrors so the mobile debug drawer can display them.

  state._loadErrors = [];
  state._contentSource = null;

  function _recordErr(where, err) {
    const msg = err && err.message ? err.message : String(err);
    state._loadErrors.push({ where, msg, time: new Date().toISOString() });
    console.error('[CCO loader]', where, err);
  }

  async function loadInjects(injectIds) {
    const bundle = (window.__CCO_DATA && window.__CCO_DATA.injects) || null;
    if (bundle) {
      state.injects = injectIds.map((id) => bundle[id]).filter(Boolean);
      const missing = injectIds.filter((id) => !bundle[id]);
      if (missing.length) _recordErr('loadInjects', `missing in bundle: ${missing.join(',')}`);
      state._contentSource = state._contentSource || 'inline';
      return state.injects;
    }
    const results = await Promise.all(
      injectIds.map(async (id) => {
        try {
          const r = await fetch(`content/injects/${id}.json`);
          if (!r.ok) throw new Error(id);
          return await r.json();
        } catch (e) {
          _recordErr(`loadInjects:${id}`, e);
          return null;
        }
      })
    );
    state.injects = results.filter(Boolean);
    state._contentSource = state._contentSource || 'fetch';
    return state.injects;
  }

  async function loadPhoneScript(id) {
    if (state.phoneScripts[id]) return state.phoneScripts[id];
    const bundle = (window.__CCO_DATA && window.__CCO_DATA.phoneScripts) || null;
    if (bundle && bundle[id]) {
      state.phoneScripts[id] = bundle[id];
      state._contentSource = state._contentSource || 'inline';
      return bundle[id];
    }
    try {
      const r = await fetch(`content/phone-scripts/${id}.json`);
      if (!r.ok) throw new Error(id);
      const data = await r.json();
      state.phoneScripts[id] = data;
      state._contentSource = state._contentSource || 'fetch';
      return data;
    } catch (e) {
      _recordErr(`loadPhoneScript:${id}`, e);
      return null;
    }
  }

  async function loadContacts() {
    const bundle = (window.__CCO_DATA && window.__CCO_DATA.contacts) || null;
    if (bundle) {
      state.contacts = bundle.contacts || [];
      state.contacts.forEach((c) => {
        if (!state.smsThreads[c.id]) state.smsThreads[c.id] = [];
      });
      state._contentSource = state._contentSource || 'inline';
      return state.contacts;
    }
    try {
      const r = await fetch('content/contacts/contacts.json');
      if (!r.ok) throw new Error('contacts HTTP ' + r.status);
      const data = await r.json();
      state.contacts = data.contacts || [];
      state.contacts.forEach((c) => {
        if (!state.smsThreads[c.id]) state.smsThreads[c.id] = [];
      });
      state._contentSource = state._contentSource || 'fetch';
      return state.contacts;
    } catch (e) {
      _recordErr('loadContacts', e);
      return [];
    }
  }

  // ----- Clock -----

  // v0.2.11: startExercise is split into two phases to support the launch
  // moment. prelaunchExercise initializes everything (config, injects,
  // triggers, fresh state) but leaves the clock paused and phase='pre-exercise'.
  // It is called from startex.html at launch time. Then the trainer clicks
  // "Start Exercise" on trainer.html which calls beginExerciseNow() to flip
  // the clock on and move phase='cold-open'. Legacy startExercise() stays
  // around as a single-call convenience that does both steps at once.

  function prelaunchExercise(config) {
    state.config = config;
    state.clock.running = false;
    state.clock.exerciseStart = null;
    state.clock.exerciseMs = 0;

    const scenarioMode = (window.__CCO_DATA && window.__CCO_DATA.meta && window.__CCO_DATA.meta.clock_mode) || null;
    const mode = (config && config.clock_mode) || scenarioMode || 'sim';
    state.clock.mode = (mode === 'wall') ? 'wall' : 'sim';

    if (state.clock.mode === 'wall') {
      // Wall mode anchor happens at beginExerciseNow() — not here.
      state.clock.dayStart = 8 * 60;
      state.clock.wallStartRealTime = 0;
    } else {
      state.clock.dayStart = (config && config.day_start_hour != null ? config.day_start_hour : 8) * 60;
      if (config && config.wall_to_exercise_ratio) {
        state.clock.wallToExerciseRatio = config.wall_to_exercise_ratio;
      }
    }

    state.fired.clear();
    state.firedSms.clear();
    state.flagged = [];
    state.inbox = [];
    state.smsThreads = {};
    state.contacts.forEach((c) => { state.smsThreads[c.id] = []; });
    state.paused = false;
    state.team_roles = { assignments: {} };
    state.trainer_queue = [];
    state.inject_status = {};
    state.session = {
      phase: 'pre-exercise',
      phaseStartedAt: Date.now(),
      launchedAt: Date.now()
    };
    state.unclaimedInjects = [];
    resolveTriggers();
    saveState();
    dispatch('engine:prelaunch', { config });
  }

  function beginExerciseNow() {
    // Trainer clicked "Start Exercise" on the trainer dashboard. The state is
    // already populated by prelaunchExercise; we just flip the clock on and
    // move phase to 'cold-open' to broadcast kickoff to every connected view.
    state.clock.running = true;
    state.clock.exerciseStart = new Date();
    state.clock.exerciseMs = 0;

    if (state.clock.mode === 'wall') {
      const now = new Date();
      state.clock.dayStart = now.getHours() * 60 + now.getMinutes();
      state.clock.wallStartRealTime = Date.now();
      state.clock.pausedAccumMs = 0;
      state.clock.pausedAt = 0;
      state.clock.wallToExerciseRatio = 1;
    }

    if (state.session) {
      state.session.phase = 'cold-open';
      state.session.phaseStartedAt = Date.now();
    } else {
      state.session = { phase: 'cold-open', phaseStartedAt: Date.now(), launchedAt: Date.now() };
    }
    saveState();
    if (state.clock.interval) clearInterval(state.clock.interval);
    state.clock.interval = setInterval(tick, 1000);
    processInjects();
    dispatch('engine:phase-changed', { phase: 'cold-open' });
  }

  function startExercise(config) {
    // Legacy one-shot: initializes AND starts immediately. Kept for back-compat
    // with any caller that doesn't want the two-phase launch flow.
    state.config = config;
    state.clock.running = true;
    state.clock.exerciseStart = new Date();
    state.clock.exerciseMs = 0;

    // v0.2.10: clock mode. Read from config.clock_mode first, then from the
    // active scenario meta (if window.__CCO_DATA.meta.clock_mode was set by
    // scenario-loader.js). Default 'sim'.
    const scenarioMode = (window.__CCO_DATA && window.__CCO_DATA.meta && window.__CCO_DATA.meta.clock_mode) || null;
    const mode = (config && config.clock_mode) || scenarioMode || 'sim';
    state.clock.mode = (mode === 'wall') ? 'wall' : 'sim';

    if (state.clock.mode === 'wall') {
      // Anchor: current local wall time becomes "D1 now". dayStart is the
      // real HH:MM right now so getExerciseTime() reads back the wall clock.
      const now = new Date();
      state.clock.dayStart = now.getHours() * 60 + now.getMinutes();
      state.clock.wallStartRealTime = Date.now();
      state.clock.pausedAccumMs = 0;
      state.clock.pausedAt = 0;
      state.clock.wallToExerciseRatio = 1;
    } else {
      // Simulated clock: same as pre-v0.2.10 behavior. Honor a ratio from
      // config if present (lets STARTEX pick 1x / 5x / 10x / 20x).
      state.clock.dayStart = (config && config.day_start_hour != null ? config.day_start_hour : 8) * 60;
      if (config && config.wall_to_exercise_ratio) {
        state.clock.wallToExerciseRatio = config.wall_to_exercise_ratio;
      }
    }

    state.fired.clear();
    state.firedSms.clear();
    state.flagged = [];
    state.inbox = [];
    state.smsThreads = {};
    state.contacts.forEach((c) => { state.smsThreads[c.id] = []; });
    state.paused = false;
    state.team_roles = { assignments: {} };
    state.trainer_queue = [];
    state.inject_status = {};
    state.unclaimedInjects = [];
    resolveTriggers();
    saveState();
    if (state.clock.interval) clearInterval(state.clock.interval);
    state.clock.interval = setInterval(tick, 1000);
    processInjects();
  }

  // v0.2.6: random inject timing.
  // Each inject declares either:
  //   trigger.type === 'absolute'  + day/hour/minute (+ optional jitter in min)
  //   trigger.type === 'window'    + day + earliest_hour..latest_hour
  // Both resolve to a concrete totalMinutes for this exercise run, stored in
  // state._resolvedTriggers. Called at startExercise(). Results persist so
  // reloading doesn't reshuffle the schedule mid-exercise.
  function resolveTriggers() {
    state._resolvedTriggers = {};
    state.injects.forEach((inj) => {
      const t = inj.trigger;
      if (!t) return;
      let minutes;
      if (t.type === 'window') {
        const eh = t.earliest_hour   != null ? t.earliest_hour   : 8;
        const em = t.earliest_minute != null ? t.earliest_minute : 0;
        const lh = t.latest_hour     != null ? t.latest_hour     : 17;
        const lm = t.latest_minute   != null ? t.latest_minute   : 0;
        const earliest = (t.day - 1) * 1440 + eh * 60 + em;
        const latest   = (t.day - 1) * 1440 + lh * 60 + lm;
        const range = Math.max(1, latest - earliest);
        minutes = earliest + Math.floor(Math.random() * range);
      } else {
        const base = (t.day - 1) * 1440 + (t.hour || 0) * 60 + (t.minute || 0);
        const jitter = t.jitter_minutes || 0;
        const offset = jitter
          ? (Math.floor(Math.random() * (2 * jitter + 1)) - jitter)
          : 0;
        minutes = Math.max(0, base + offset);
      }
      state._resolvedTriggers[inj.id] = minutes;
    });
  }

  function tick() {
    if (state.paused) return;
    if (state.clock.mode === 'wall') {
      // exerciseMs tracks real elapsed minus time spent paused
      state.clock.exerciseMs = Date.now() - state.clock.wallStartRealTime - state.clock.pausedAccumMs;
    } else {
      state.clock.exerciseMs += 1000 * state.clock.wallToExerciseRatio;
    }
    processInjects();
    processSmsDelays();
    saveState();
    dispatch('engine:tick', getExerciseTime());
  }

  function getExerciseTime() {
    const elapsedMin = Math.floor(state.clock.exerciseMs / 60000);
    const total = state.clock.dayStart + elapsedMin;
    const day = Math.floor(total / (24 * 60)) + 1;
    const minInDay = total % (24 * 60);
    const hour = Math.floor(minInDay / 60);
    const minute = minInDay % 60;
    return {
      day, hour, minute, totalMinutes: total,
      displayString: `D${day} ${pad(hour)}:${pad(minute)}`,
      shortTime: `${pad(hour)}:${pad(minute)}`
    };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ----- Inject firing -----

  function processInjects() {
    const now = getExerciseTime();
    state.injects.forEach((inj) => {
      if (state.fired.has(inj.id)) return;
      if (shouldFire(inj, now)) fireInject(inj);
    });
  }

  function shouldFire(inj, now) {
    const resolved = state._resolvedTriggers && state._resolvedTriggers[inj.id];
    if (resolved == null) {
      // Fallback: compute from absolute trigger (handles injects added after
      // startExercise or loaded from state that predates _resolvedTriggers).
      if (!inj.trigger || inj.trigger.type === 'window') return false;
      const t = inj.trigger;
      const base = (t.day - 1) * 1440 + (t.hour || 0) * 60 + (t.minute || 0);
      return now.totalMinutes >= base;
    }
    return now.totalMinutes >= resolved;
  }

  function fireInject(inj) {
    state.fired.add(inj.id);

    // v0.2.8: resolve who this inject's inbox items should land on.
    //   role_tag unset / 'broadcast'  -> assigned_to = null (everyone sees)
    //   role_tag 'cco' / 'aco'        -> assigned_to = null, filtered at render
    //                                    (CCOs/ACOs both see cco; only ACO sees aco)
    //   role_tag 'leadership'         -> assigned_to = top of fall-through chain
    //                                    (commander -> sel -> flight_chief -> team_lead)
    //                                    All leaders still SEE it; primary is the
    //                                    one who's "on point."
    const routing = resolveRouting(inj);

    // v0.2.12: detect "nobody owns this" state for leadership injects.
    // If the inject is tagged 'leadership' but resolveRouting() couldn't find
    // anyone to assign it to (team hasn't named a commander/SEL/flight chief/
    // team lead yet), push a tray entry so the whole team sees a red flag
    // and the inspector auto-logs a ROLE_GAP observation. The inbox item
    // still gets created with assigned_to=null — retroactiveRouteRefresh()
    // will re-stamp it when a role fills, and at that moment we'll also mark
    // the matching tray entry resolved (gap duration stays for grading).
    const isUnclaimedLeadership =
      inj.role_tag === 'leadership' &&
      routing.role_tag === 'leadership' &&
      !routing.assigned_to;

    // Inbox items -> student mail
    if (inj.inbox_items) {
      inj.inbox_items.forEach((item) => {
        const inboxItemId = `${inj.id}-${item.id}`;
        state.inbox.unshift({
          id: inboxItemId,
          injectId: inj.id,
          from: item.from,
          fromEmail: item.from_email || '',
          subject: item.subject,
          body: item.body,
          time: getExerciseTime().displayString,
          unread: true,
          // v0.2.8 routing fields
          role_tag: routing.role_tag,         // 'cco'|'aco'|'leadership'|null
          assigned_to: routing.assigned_to    // studentId (leadership primary) or null
        });

        if (isUnclaimedLeadership) {
          const entry = {
            injectId: inj.id,
            inboxItemId,
            subject: item.subject,
            role_tag: 'leadership',
            firedAtMinutes: getExerciseTime().totalMinutes,
            firedAtDisplay: getExerciseTime().displayString,
            resolvedAtMinutes: null,
            resolvedAtDisplay: null,
            resolvedByStudentId: null
          };
          if (!state.unclaimedInjects) state.unclaimedInjects = [];
          state.unclaimedInjects.push(entry);
          dispatch('engine:unclaimed-inject', entry);
        }
      });
    }

    // SMS items -> scheduled for later delivery
    if (inj.sms_items) {
      inj.sms_items.forEach((sms) => {
        const fireAt = getExerciseTime().totalMinutes + (sms.delay_minutes || 0);
        sms.messages.forEach((text, idx) => {
          state.firedSms.add(`${inj.id}-${sms.id}-${idx}-pending`);
        });
        // Store pending SMS with scheduled delivery time
        if (!state._pendingSms) state._pendingSms = [];
        sms.messages.forEach((text, idx) => {
          state._pendingSms.push({
            id: `${inj.id}-${sms.id}-${idx}`,
            contactId: sms.contact_id,
            text: text,
            fireAt: fireAt + (idx * 0.5) // small stagger between messages in a burst
          });
        });
      });
    }

    dispatch('engine:inject-fired', inj);
  }

  function processSmsDelays() {
    if (!state._pendingSms || state._pendingSms.length === 0) return;
    const nowMin = getExerciseTime().totalMinutes;
    const ready = state._pendingSms.filter((m) => nowMin >= m.fireAt);
    if (ready.length === 0) return;
    ready.forEach((msg) => {
      if (!state.smsThreads[msg.contactId]) state.smsThreads[msg.contactId] = [];
      state.smsThreads[msg.contactId].push({
        id: msg.id,
        direction: 'in',
        text: msg.text,
        time: getExerciseTime().displayString,
        unread: true
      });
      dispatch('engine:sms-received', { contactId: msg.contactId, text: msg.text });
    });
    state._pendingSms = state._pendingSms.filter((m) => nowMin < m.fireAt);
  }

  function fireNextInject() {
    const now = getExerciseTime();
    const queued = state.injects
      .filter((i) => !state.fired.has(i.id))
      .sort((a, b) => triggerMinutes(a) - triggerMinutes(b));
    if (queued.length > 0) fireInject(queued[0]);
  }

  // v0.2.16: fire a specific inject by ID (used by bomb button, etc.)
  function fireInjectById(id) {
    const inj = state.injects.find(i => i.id === id);
    if (!inj) { console.warn('fireInjectById: unknown inject', id); return false; }
    if (state.fired.has(id)) { console.warn('fireInjectById: already fired', id); return false; }
    fireInject(inj);
    return true;
  }

  function triggerMinutes(inj) {
    const resolved = state._resolvedTriggers && state._resolvedTriggers[inj.id];
    if (resolved != null) return resolved;
    const t = inj.trigger || {};
    return (t.day - 1) * 1440 + (t.hour || 0) * 60 + (t.minute || 0);
  }

  // ----- v0.2.8: role-based routing -----
  //
  // Each student holds exactly one role. Role keys:
  //   'cco'          — Contingency CO (default worker)
  //   'aco'          — Administrative CO (worker + extras)
  //   'team_lead'    — Team Lead (leadership floor — at least one required)
  //   'commander'    — Commander
  //   'sel'          — Senior Enlisted Leader
  //   'flight_chief' — Flight Chief
  //
  // Leadership fall-through order (for leadership-tagged injects):
  //   commander -> sel -> flight_chief -> team_lead
  //
  // Inject routing at fire time (resolveRouting reads inj.role_tag):
  //
  //   inj.role_tag        outcome
  //   ──────────────      ─────────────────────────────────────────────────
  //   unset/'broadcast'   { assigned_to: null, role_tag: null }
  //                       Everyone sees it.
  //   'cco'               { assigned_to: null, role_tag: 'cco' }
  //                       CCOs, ACOs, and leaders see it. Filtered at render.
  //   'aco'               { assigned_to: null, role_tag: 'aco' }
  //                       ACOs and leaders see it. CCOs do NOT.
  //   'leadership'        { assigned_to: <primary>, role_tag: 'leadership' }
  //                       All leaders see it; <primary> is the fall-through
  //                       top (whoever the team currently expects to own it).
  //                       If no leader is assigned at fire time, assigned_to
  //                       is null and retroactiveRouteRefresh() will re-stamp
  //                       it once a leader takes a slot.
  //
  // Delegation (v0.2.9): a leader will be able to forward a specific inbox
  // item to a CCO/ACO. That will stamp item.delegated_to on top of the
  // role_tag filter so the subordinate sees it even though the role_tag
  // wouldn't normally route to them.

  const LEADERSHIP_ROLES = ['commander', 'sel', 'flight_chief', 'team_lead'];

  function getRoleOf(studentId) {
    if (!studentId) return null;
    return (state.team_roles.assignments || {})[studentId] || null;
  }

  function getStudentsWithRole(role) {
    const out = [];
    const a = state.team_roles.assignments || {};
    Object.keys(a).forEach((id) => { if (a[id] === role) out.push(id); });
    return out;
  }

  function getLeadershipPrimary() {
    // Walk the fall-through chain: commander -> sel -> flight_chief -> team_lead
    // Return the studentId of the first role that has at least one holder.
    for (const role of LEADERSHIP_ROLES) {
      const holders = getStudentsWithRole(role);
      if (holders.length > 0) return holders[0];
    }
    return null;
  }

  function resolveRouting(inj) {
    const tag = inj.role_tag || null;
    if (!tag || tag === 'broadcast') {
      return { assigned_to: null, role_tag: null };
    }
    if (tag === 'leadership') {
      return { assigned_to: getLeadershipPrimary(), role_tag: 'leadership' };
    }
    // 'cco' or 'aco' — no single primary; filter at render time
    return { assigned_to: null, role_tag: tag };
  }

  function assignRole(studentId, roleKey) {
    if (!studentId) return;
    if (!state.team_roles.assignments) state.team_roles.assignments = {};
    if (!roleKey) {
      delete state.team_roles.assignments[studentId];
    } else {
      state.team_roles.assignments[studentId] = roleKey;
    }
    retroactiveRouteRefresh();
    saveState();
    dispatch('engine:team-roles-updated', { team_roles: state.team_roles });
  }

  function retroactiveRouteRefresh() {
    // Re-stamp leadership-tagged inbox items to reflect the current
    // fall-through top. Forward-only: if an item is already assigned and
    // the primary shifts, we move it; but broadcasts and cco/aco-tagged
    // items are filtered client-side and don't need re-stamping here.
    const primary = getLeadershipPrimary();
    state.inbox.forEach((m) => {
      if (m.role_tag === 'leadership') {
        m.assigned_to = primary;
      }
    });

    // v0.2.12: if we just installed a leadership primary, resolve any
    // unclaimed-tray entries that had been waiting. We keep them in the
    // array (marked resolved) rather than deleting — the inspector uses the
    // gap duration for grading, and the UI filters resolved entries out.
    if (primary && Array.isArray(state.unclaimedInjects)) {
      const nowMin = (() => {
        try { return getExerciseTime().totalMinutes; } catch (e) { return null; }
      })();
      const nowDisplay = (() => {
        try { return getExerciseTime().displayString; } catch (e) { return ''; }
      })();
      state.unclaimedInjects.forEach((entry) => {
        if (!entry.resolvedAtMinutes) {
          entry.resolvedAtMinutes = nowMin;
          entry.resolvedAtDisplay = nowDisplay;
          entry.resolvedByStudentId = primary;
          dispatch('engine:unclaimed-resolved', entry);
        }
      });
    }
  }

  function getTeamRoles() {
    return state.team_roles;
  }

  function getAssignedPlayer(inj) {
    // helper for UI: "if this inject fired right now, who would be primary?"
    return resolveRouting(inj).assigned_to;
  }

  // v0.2.12: unclaimed tray accessors.
  // listUnclaimedInjects() returns only unresolved entries (for the student
  // tray widget). listUnclaimedHistory() returns all entries including
  // resolved ones (for the inspector grade log).
  function listUnclaimedInjects() {
    return (state.unclaimedInjects || []).filter(e => !e.resolvedAtMinutes);
  }
  function listUnclaimedHistory() {
    return (state.unclaimedInjects || []).slice();
  }

  // ----- v0.2.9: delegation + trainer queue + two-way replies -----
  //
  // Three new mechanics layered on top of the role system:
  //
  // 1. Delegation. A leader forwards a specific inbox item to a subordinate
  //    by stamping item.delegated_to = targetStudentId. The subordinate's
  //    client-side filter (student.js itemVisibleToMe) already honors this
  //    field. Delegation is additive — it doesn't hide the item from its
  //    original recipients, it just extends visibility to one more person.
  //
  // 2. Student -> Trainer asks. A student hits "Ask trainer" on a mail and
  //    studentAsk() pushes an entry onto state.trainer_queue. The trainer
  //    panel (renderActionQueue in trainer.js) surfaces pending asks with
  //    a Reply button. Asks have a threadId so replies chain under the same
  //    conversation.
  //
  // 3. Trainer -> Student replies. trainerReply() handles both custom
  //    responses to a queue entry AND canned "quick_fire" template sends
  //    that aren't tied to a queue entry (e.g. the trainer proactively
  //    pushes a PWS template to a student who just asked). Either way the
  //    result is a new inbox item stamped with the reply metadata so the
  //    student sees it in their feed.

  function delegateItem(itemId, targetStudentId) {
    if (!itemId || !targetStudentId) return false;
    const item = state.inbox.find((m) => m.id === itemId);
    if (!item) return false;
    // Resolve "who is delegating" — first leader we find holding the
    // fall-through primary spot is the best stand-in for UI labeling.
    const fromId = getLeadershipPrimary();
    item.delegated_to = targetStudentId;
    item.delegated_from = fromId || null;
    item.delegated_at = getExerciseTime().displayString;
    saveState();
    dispatch('engine:inbox-updated');
    dispatch('engine:delegation', { itemId, targetStudentId, fromId });
    return true;
  }

  function studentAsk(payload) {
    // payload: { personaId, personaName, injectId, threadId, body, subject }
    if (!payload || !payload.body) return null;
    const id = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      personaId: payload.personaId || null,
      personaName: payload.personaName || 'Student',
      injectId: payload.injectId || null,
      threadId: payload.threadId || `thread-${id}`,
      subject: payload.subject || '(no subject)',
      body: payload.body,
      time: getExerciseTime().displayString,
      handled: false,
      handledAt: null
    };
    if (!state.trainer_queue) state.trainer_queue = [];
    state.trainer_queue.unshift(entry);
    saveState();
    dispatch('engine:trainer-queue-updated', { entry });
    return entry;
  }

  function getTrainerQueue() {
    return state.trainer_queue || [];
  }

  // v0.2.9: Per-inject completion status. Trainer toggles this from the
  // Active Feed card; observer/inspector picks it up via cross-window sync.
  function markInjectStatus(injectId, status) {
    if (!injectId) return false;
    if (!state.inject_status) state.inject_status = {};
    if (status === null || status === undefined || status === '') {
      delete state.inject_status[injectId];
    } else if (status === 'complete' || status === 'incomplete') {
      state.inject_status[injectId] = status;
    } else {
      return false;
    }
    saveState();
    dispatch('engine:inject-status', { injectId, status: state.inject_status[injectId] || null });
    return true;
  }

  function getInjectStatus(injectId) {
    return (state.inject_status && state.inject_status[injectId]) || null;
  }

  function markQueueHandled(queueEntryId) {
    const q = state.trainer_queue || [];
    const e = q.find((x) => x.id === queueEntryId);
    if (!e) return false;
    e.handled = true;
    e.handledAt = getExerciseTime().displayString;
    saveState();
    dispatch('engine:trainer-queue-updated', { entry: e });
    return true;
  }

  function trainerReply(payload) {
    // payload: {
    //   queueEntryId?   — if replying to a specific ask, marks it handled
    //   toPersonaId     — who receives the reply (required unless queueEntryId given)
    //   subject         — email subject on the reply
    //   body            — email body
    //   from            — sender display name (defaults to 'White Cell')
    //   injectId        — for threading to an inject context (optional)
    //   threadId        — for chaining under an existing thread (optional)
    //   kind            — 'email' (default) | 'sms' — routes to correct channel
    //   contactId       — required for kind:'sms' — the contact thread to push into
    // }
    if (!payload) return null;

    let queueEntry = null;
    if (payload.queueEntryId) {
      queueEntry = (state.trainer_queue || []).find((q) => q.id === payload.queueEntryId);
    }

    const toPersonaId = payload.toPersonaId || (queueEntry && queueEntry.personaId) || null;
    if (!toPersonaId) {
      console.warn('[trainerReply] no toPersonaId, dropping');
      return null;
    }
    const injectId = payload.injectId || (queueEntry && queueEntry.injectId) || null;
    const threadId = payload.threadId || (queueEntry && queueEntry.threadId) || `reply-${Date.now()}`;
    const from = payload.from || 'White Cell';
    const body = payload.body || '';

    // Detect SMS: explicit kind:'sms', or threadId starts with 'sms-'
    const isSms = payload.kind === 'sms' || (threadId && threadId.startsWith('sms-'));
    const contactId = payload.contactId || (isSms && threadId ? threadId.replace(/^sms-/, '') : null);

    if (queueEntry) {
      queueEntry.handled = true;
      queueEntry.handledAt = getExerciseTime().displayString;
    }

    if (isSms && contactId) {
      // Route reply into the SMS thread so it shows up on the phone
      const id = `sms-reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (!state.smsThreads[contactId]) state.smsThreads[contactId] = [];
      const msg = {
        id,
        direction: 'in',
        text: body,
        time: getExerciseTime().displayString,
        unread: true,
        is_trainer_reply: true,
        fromName: from
      };
      state.smsThreads[contactId].push(msg);
      saveState();
      dispatch('engine:sms-updated', { contactId });
      dispatch('engine:trainer-queue-updated', { entry: queueEntry });
      return msg;
    }

    // Default: email reply into inbox
    const subject = payload.subject || (queueEntry ? `Re: ${queueEntry.subject}` : 'White Cell reply');
    const id = `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item = {
      id,
      injectId: injectId,
      from: from,
      fromEmail: '',
      subject: subject,
      body: body,
      time: getExerciseTime().displayString,
      unread: true,
      // Replies are always delegated directly at the asker — they bypass
      // the role_tag filter via delegated_to so a CCO sees their own reply.
      role_tag: null,
      assigned_to: null,
      delegated_to: toPersonaId,
      delegated_from: null,
      thread_id: threadId,
      is_trainer_reply: true
    };
    state.inbox.unshift(item);

    saveState();
    dispatch('engine:inbox-updated');
    dispatch('engine:trainer-queue-updated', { entry: queueEntry });
    return item;
  }

  // ----- State controls -----

  function pause() {
    if (state.paused) return;
    state.paused = true;
    if (state.clock.mode === 'wall') state.clock.pausedAt = Date.now();
    saveState();
    dispatch('engine:paused');
  }
  function resume() {
    if (!state.paused) return;
    state.paused = false;
    if (state.clock.mode === 'wall' && state.clock.pausedAt) {
      state.clock.pausedAccumMs += Date.now() - state.clock.pausedAt;
      state.clock.pausedAt = 0;
    }
    saveState();
    dispatch('engine:resumed');
  }

  function endExercise() {
    state.clock.running = false;
    if (state.clock.interval) { clearInterval(state.clock.interval); state.clock.interval = null; }
    saveState();
    dispatch('engine:endex');
  }

  function flagForHotwash(injectId, note) {
    state.flagged.push({ injectId, note: note || '', time: getExerciseTime().displayString });
    saveState();
  }

  function markInboxRead(itemId) {
    const item = state.inbox.find((i) => i.id === itemId);
    if (item) { item.unread = false; saveState(); dispatch('engine:inbox-updated'); }
  }

  function markSmsRead(contactId) {
    if (state.smsThreads[contactId]) {
      state.smsThreads[contactId].forEach((m) => { m.unread = false; });
      saveState();
      dispatch('engine:sms-updated');
    }
  }

  function sendCustomSms(contactId, text) {
    if (!state.smsThreads[contactId]) state.smsThreads[contactId] = [];
    state.smsThreads[contactId].push({
      id: `custom-${Date.now()}`,
      direction: 'in',
      text: text,
      time: getExerciseTime().displayString,
      unread: true
    });
    saveState();
    dispatch('engine:sms-received', { contactId, text });
  }

  // ----- Persistence -----

  function saveState() {
    // In read-only mode (phone, student) we never write state back to
    // localStorage. This prevents races where the consumer clobbers the
    // producer's (trainer's) latest updates.
    if (state.readOnly) return;
    try {
      const snap = {
        config: state.config,
        clock: {
          running: state.clock.running,
          exerciseStart: state.clock.exerciseStart ? state.clock.exerciseStart.toISOString() : null,
          exerciseMs: state.clock.exerciseMs,
          dayStart: state.clock.dayStart,
          wallToExerciseRatio: state.clock.wallToExerciseRatio,
          mode: state.clock.mode || 'sim',
          wallStartRealTime: state.clock.wallStartRealTime || 0,
          pausedAccumMs: state.clock.pausedAccumMs || 0,
          pausedAt: state.clock.pausedAt || 0
        },
        fired: Array.from(state.fired),
        firedSms: Array.from(state.firedSms),
        flagged: state.flagged,
        inbox: state.inbox,
        smsThreads: state.smsThreads,
        _pendingSms: state._pendingSms || [],
        _resolvedTriggers: state._resolvedTriggers || {},
        team_roles: state.team_roles || { assignments: {} },
        trainer_queue: state.trainer_queue || [],
        inject_status: state.inject_status || {},
        paused: state.paused,
        session: state.session || { phase: 'pre-exercise', phaseStartedAt: null, launchedAt: null },
        unclaimedInjects: state.unclaimedInjects || [],
        alarm_responses: state.alarm_responses || {},
        kia_roster: state.kia_roster || {},
        _lastUpdate: Date.now()
      };
      localStorage.setItem(stateKey(), JSON.stringify(snap));
      // v0.2.13: relay to network backend if connected (and not already
      // processing an inbound remote update — prevents echo loops).
      if (_netHooks && _netHooks.onStateWrite && !_skipNetPush) {
        try { _netHooks.onStateWrite(currentSession, snap); } catch (e) { console.warn('[net] state relay:', e); }
      }
    } catch (e) { console.error('Save fail:', e); }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(stateKey());
      if (!raw) return false;
      const s = JSON.parse(raw);
      state.config = s.config;
      state.clock.running = s.clock.running;
      state.clock.exerciseStart = s.clock.exerciseStart ? new Date(s.clock.exerciseStart) : null;
      state.clock.exerciseMs = s.clock.exerciseMs;
      state.clock.dayStart = s.clock.dayStart;
      state.clock.wallToExerciseRatio = s.clock.wallToExerciseRatio;
      state.clock.mode = s.clock.mode || 'sim';
      state.clock.wallStartRealTime = s.clock.wallStartRealTime || 0;
      state.clock.pausedAccumMs = s.clock.pausedAccumMs || 0;
      state.clock.pausedAt = s.clock.pausedAt || 0;
      state.fired = new Set(s.fired || []);
      state.firedSms = new Set(s.firedSms || []);
      state.flagged = s.flagged || [];
      state.inbox = s.inbox || [];
      state.smsThreads = s.smsThreads || {};
      state._pendingSms = s._pendingSms || [];
      state._resolvedTriggers = s._resolvedTriggers || {};
      // v0.2.8: accept both new shape and legacy {lead,duties} shape
      // (legacy state is silently discarded — roles must be re-assigned).
      const incoming = s.team_roles || {};
      state.team_roles = incoming.assignments
        ? { assignments: incoming.assignments }
        : { assignments: {} };
      state.trainer_queue = Array.isArray(s.trainer_queue) ? s.trainer_queue : [];
      state.inject_status = (s.inject_status && typeof s.inject_status === 'object') ? s.inject_status : {};
      state.paused = s.paused || false;
      // v0.2.11: session phase. Default to 'pre-exercise' if missing for
      // backward compat with legacy state blobs from before the launch flow.
      state.session = s.session && typeof s.session === 'object'
        ? {
            phase: s.session.phase || 'pre-exercise',
            phaseStartedAt: s.session.phaseStartedAt || null,
            launchedAt: s.session.launchedAt || null
          }
        : { phase: 'pre-exercise', phaseStartedAt: null, launchedAt: null };
      // v0.2.12: unclaimed injects tray (empty on legacy state blobs)
      state.unclaimedInjects = Array.isArray(s.unclaimedInjects) ? s.unclaimedInjects : [];
      // v0.2.14: alarm response tracking + KIA roster
      state.alarm_responses = (s.alarm_responses && typeof s.alarm_responses === 'object') ? s.alarm_responses : {};
      state.kia_roster = (s.kia_roster && typeof s.kia_roster === 'object') ? s.kia_roster : {};

      // Only start a local tick interval if NOT in read-only mode.
      // Read-only consumers (phone, student) should never run the clock
      // themselves — they only observe state that the trainer writes.
      if (state.clock.running && !state.paused && !state.readOnly) {
        if (state.clock.interval) clearInterval(state.clock.interval);
        state.clock.interval = setInterval(tick, 1000);
      }
      return true;
    } catch (e) { console.error('Load fail:', e); return false; }
  }

  function setReadOnly(v) {
    state.readOnly = !!v;
    if (state.readOnly && state.clock.interval) {
      clearInterval(state.clock.interval);
      state.clock.interval = null;
    }
  }

  function resetState() {
    localStorage.removeItem(stateKey());
    localStorage.removeItem(outboxKey());
    localStorage.removeItem(CONFIG_KEY);
    if (state.clock.interval) clearInterval(state.clock.interval);
    state.config = null;
    state.clock = { running: false, exerciseStart: null, exerciseMs: 0, dayStart: 8*60, wallToExerciseRatio: 10, interval: null, mode: 'sim', wallStartRealTime: 0, pausedAccumMs: 0, pausedAt: 0 };
    state.fired.clear();
    state.firedSms.clear();
    state.flagged = [];
    state.inbox = [];
    state.smsThreads = {};
    state._pendingSms = [];
    state.team_roles = { assignments: {} };
    state.trainer_queue = [];
    state.inject_status = {};
    state.paused = false;
    state.session = { phase: 'pre-exercise', phaseStartedAt: null, launchedAt: null };
    state.unclaimedInjects = [];
  }

  // ----- Student outbox (read-only-safe side channel) -----
  // Student/Mobile views run with setReadOnly(true), so their saveState is
  // a no-op. That means studentAsk() can't persist to state.trainer_queue
  // and the trainer never sees student messages. To fix that, we write
  // student-originated messages to a SEPARATE localStorage key as an
  // append-log. The trainer drains this key into its own state.trainer_queue
  // on each storage event. This keeps the read-only invariant intact
  // (students never touch the state key) while still letting them send
  // things upstream. v0.2.11: outbox is now session-scoped.

  function outboxAppend(entry) {
    try {
      const raw = localStorage.getItem(outboxKey());
      const list = raw ? JSON.parse(raw) : [];
      list.push(entry);
      localStorage.setItem(outboxKey(), JSON.stringify(list));
      // v0.2.13: relay outbox writes to network backend
      if (_netHooks && _netHooks.onOutboxWrite && !_skipNetPush) {
        try { _netHooks.onOutboxWrite(currentSession, list); } catch (e) { console.warn('[net] outbox relay:', e); }
      }
      return true;
    } catch (e) {
      console.error('[outbox] append fail:', e);
      return false;
    }
  }

  function outboxDrain() {
    // Called by the trainer. Pulls every queued entry, applies it to the
    // in-memory state, clears the queue, and saves.
    if (state.readOnly) return 0;
    let list;
    try {
      const raw = localStorage.getItem(outboxKey());
      list = raw ? JSON.parse(raw) : [];
    } catch (e) { return 0; }
    if (!Array.isArray(list) || list.length === 0) return 0;

    let appliedCount = 0;
    list.forEach(entry => {
      if (!entry || !entry.kind) return;
      if (entry.kind === 'ask') {
        // Route into state.trainer_queue the same way studentAsk() would.
        if (!state.trainer_queue) state.trainer_queue = [];
        // Dedup by id in case an entry somehow drained twice.
        if (!state.trainer_queue.find(q => q.id === entry.id)) {
          state.trainer_queue.unshift({
            id: entry.id,
            personaId: entry.personaId || null,
            personaName: entry.personaName || 'Student',
            injectId: entry.injectId || null,
            threadId: entry.threadId || `thread-${entry.id}`,
            subject: entry.subject || '(no subject)',
            body: entry.body || '',
            time: entry.time || getExerciseTime().displayString,
            handled: false,
            handledAt: null
          });
          appliedCount++;
          dispatch('engine:trainer-queue-updated', { entry: state.trainer_queue[0] });
        }
      } else if (entry.kind === 'alarm-ack') {
        // Student/mobile reporting alarm acknowledgement (or 4-min death)
        const aId = entry.alarmInjectId;
        const pId = entry.playerId;
        if (aId && pId) {
          if (!state.alarm_responses[aId]) {
            state.alarm_responses[aId] = { firedAtWall: entry.firedAtWall || Date.now(), responses: {} };
          }
          const resp = state.alarm_responses[aId].responses;
          if (!resp[pId]) resp[pId] = {};
          if (entry.acked) {
            resp[pId].acked = true;
            resp[pId].ackedAtWall = entry.ackedAtWall || Date.now();
            resp[pId].ackedAtExercise = entry.ackedAtExercise || '';
          }
          if (entry.dead) {
            resp[pId].dead = true;
            resp[pId].deadAtWall = entry.deadAtWall || Date.now();
          }
          appliedCount++;
          dispatch('engine:alarm-response', { alarmInjectId: aId, playerId: pId });
        }
      } else if (entry.kind === 'sms-out') {
        // Student replying to a text thread. Push as an outbound bubble on
        // the right side of the thread so both the student (read-only) and
        // the trainer (writable) see the same bubble.
        const contactId = entry.contactId;
        if (!contactId) return;
        if (!state.smsThreads[contactId]) state.smsThreads[contactId] = [];
        if (!state.smsThreads[contactId].find(m => m.id === entry.id)) {
          state.smsThreads[contactId].push({
            id: entry.id,
            direction: 'out',
            text: entry.text || '',
            time: entry.time || getExerciseTime().displayString,
            unread: false,
            fromPersonaId: entry.personaId || null,
            fromPersonaName: entry.personaName || null
          });
          appliedCount++;
          dispatch('engine:sms-updated', { contactId });
          // Also surface it on the trainer_queue so the white cell notices
          // that a student is asking something via SMS.
          if (!state.trainer_queue) state.trainer_queue = [];
          const q = {
            id: 'q-' + entry.id,
            personaId: entry.personaId || null,
            personaName: entry.personaName || 'Student',
            injectId: null,
            threadId: `sms-${contactId}`,
            subject: `SMS to ${entry.contactName || contactId}`,
            body: entry.text || '',
            time: entry.time || getExerciseTime().displayString,
            handled: false,
            handledAt: null
          };
          state.trainer_queue.unshift(q);
          dispatch('engine:trainer-queue-updated', { entry: q });
        }
      }
    });

    if (appliedCount > 0) {
      // Clear the outbox so the next drain starts fresh.
      try { localStorage.setItem(outboxKey(), JSON.stringify([])); } catch (e) {}
      saveState();
      dispatch('engine:inbox-updated');
    }
    return appliedCount;
  }

  // Read-only-safe equivalent of studentAsk. Students call this; it always
  // writes to OUTBOX_KEY (NOT the main state key) regardless of read-only.
  function studentAskOut(payload) {
    if (!payload || !payload.body) return null;
    const id = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      kind: 'ask',
      id,
      personaId: payload.personaId || null,
      personaName: payload.personaName || 'Student',
      injectId: payload.injectId || null,
      threadId: payload.threadId || null,
      subject: payload.subject || '(no subject)',
      body: payload.body,
      time: (state.clock && state.clock.running ? getExerciseTime().displayString : '')
    };
    outboxAppend(entry);
    return entry;
  }

  // Student sending an SMS reply back on an existing thread. Queued via
  // the outbox so the trainer picks it up on the next storage tick.
  function studentSmsOut(payload) {
    if (!payload || !payload.contactId || !payload.text) return null;
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      kind: 'sms-out',
      id,
      contactId: payload.contactId,
      contactName: payload.contactName || '',
      text: payload.text,
      personaId: payload.personaId || null,
      personaName: payload.personaName || 'Student',
      time: (state.clock && state.clock.running ? getExerciseTime().displayString : '')
    };
    outboxAppend(entry);
    return entry;
  }

  // ----- v0.2.13: remote state application (inbound from network) -----
  // Called by firebase-storage.js when it receives a remote state update.
  // Writes to localStorage (so the local sync path + polling also see the
  // new state), reloads engine state, and dispatches sync — all with
  // _skipNetPush set so the write doesn't echo back to the relay.

  function applyRemoteState(snapJson) {
    _skipNetPush = true;
    try {
      const raw = typeof snapJson === 'string' ? snapJson : JSON.stringify(snapJson);
      localStorage.setItem(stateKey(), raw);
      loadState();
      dispatch('engine:sync', null);
    } finally {
      _skipNetPush = false;
    }
  }

  function applyRemoteOutbox(listJson) {
    _skipNetPush = true;
    try {
      const raw = typeof listJson === 'string' ? listJson : JSON.stringify(listJson);
      localStorage.setItem(outboxKey(), raw);
      if (!state.readOnly) {
        outboxDrain();
      }
    } finally {
      _skipNetPush = false;
    }
  }

  function applyRemotePresence(clientId, payload) {
    // Write the remote client's presence entry to localStorage so
    // listPresence() picks it up without changes.
    try {
      localStorage.setItem(presenceKey(clientId), JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }

  function removeRemotePresence(clientId) {
    try {
      localStorage.removeItem(presenceKey(clientId));
    } catch (e) { /* ignore */ }
  }

  // ----- Cross-window sync -----
  // When one window writes state, other windows receive a 'storage' event
  // and reload the state. This is how the trainer, student, and mobile
  // views stay in sync without a server.

  function enableSync() {
    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      // v0.2.11: compare against session-scoped keys. Each view only reacts
      // to events matching its own currentSession, so multiple simultaneous
      // sessions on one machine don't stomp each other.
      if (e.key === stateKey() && e.newValue) {
        const wasRunning = state.clock.running;
        loadState();
        dispatch('engine:sync', null);
        return;
      }
      if (e.key === outboxKey() && !state.readOnly) {
        outboxDrain();
        return;
      }
    });
  }

  // ----- Event dispatching -----

  function dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ----- v0.2.11: session phase control -----
  // The launch moment is a two-step flow:
  //   1. Trainer clicks "Launch Exercise" in startex.html → calls
  //      launchSession(code, config). This writes phase='pre-exercise' to
  //      the session-scoped state key. Other views joining with the same
  //      session code land on their role dashboards but show a "Waiting for
  //      kickoff" banner. The roster is locked in.
  //   2. Trainer clicks "Start Exercise" on trainer.html → calls
  //      startExerciseNow(). Phase flips to 'cold-open', the clock kicks on,
  //      and every connected client gets the sync event and drops its
  //      waiting banner. Day 1 begins.

  function getPhase() {
    return (state.session && state.session.phase) || 'pre-exercise';
  }

  function setPhase(newPhase) {
    if (!state.session) {
      state.session = { phase: 'pre-exercise', phaseStartedAt: null, launchedAt: null };
    }
    state.session.phase = newPhase;
    state.session.phaseStartedAt = Date.now();
    saveState();
    dispatch('engine:phase-changed', { phase: newPhase });
  }

  function markLaunched() {
    if (!state.session) {
      state.session = { phase: 'pre-exercise', phaseStartedAt: Date.now(), launchedAt: Date.now() };
    } else {
      state.session.phase = 'pre-exercise';
      state.session.launchedAt = Date.now();
      state.session.phaseStartedAt = Date.now();
    }
    saveState();
  }

  // ----- v0.2.11: presence heartbeat -----
  // Each role view writes to a presence key every ~5s so the trainer can
  // see who's joined the session. Trainer reads all keys matching the
  // current session's prefix.
  let _presenceTimer = null;
  let _presenceClientId = null;
  let _presenceInfo = null;

  function startPresence(clientId, info) {
    _presenceClientId = clientId || ('c-' + Math.random().toString(36).slice(2, 8));
    _presenceInfo = info || {};
    const write = () => {
      try {
        const payload = Object.assign({}, _presenceInfo, {
          clientId: _presenceClientId,
          lastSeen: Date.now()
        });
        localStorage.setItem(presenceKey(_presenceClientId), JSON.stringify(payload));
        // v0.2.13: relay presence to network backend
        if (_netHooks && _netHooks.onPresenceWrite && !_skipNetPush) {
          try { _netHooks.onPresenceWrite(currentSession, _presenceClientId, payload); }
          catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    };
    write();
    if (_presenceTimer) clearInterval(_presenceTimer);
    _presenceTimer = setInterval(write, 5000);
    // Best-effort cleanup on window close.
    window.addEventListener('beforeunload', () => {
      try { localStorage.removeItem(presenceKey(_presenceClientId)); } catch (e) {}
      if (_netHooks && _netHooks.onPresenceStop) {
        try { _netHooks.onPresenceStop(currentSession, _presenceClientId); } catch (e) {}
      }
    });
    return _presenceClientId;
  }

  function updatePresenceInfo(info) {
    _presenceInfo = Object.assign({}, _presenceInfo || {}, info || {});
  }

  function listPresence(maxAgeMs) {
    // Returns all presence entries for the current session, filtered to
    // entries fresher than maxAgeMs (default 12s — clients heartbeat every 5s).
    const max = maxAgeMs || 12000;
    const now = Date.now();
    const prefix = presencePrefix();
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        try {
          const entry = JSON.parse(localStorage.getItem(k) || '{}');
          if (entry && entry.lastSeen && (now - entry.lastSeen) <= max) {
            out.push(entry);
          }
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  // ----- v0.2.14: Alarm response + KIA management -----

  // Write an alarm-ack entry to the outbox (safe from read-only student/mobile).
  function alarmAckOut(payload) {
    if (!payload || !payload.alarmInjectId || !payload.playerId) return;
    const entry = {
      kind: 'alarm-ack',
      alarmInjectId: payload.alarmInjectId,
      playerId: payload.playerId,
      acked: !!payload.acked,
      dead: !!payload.dead,
      ackedAtWall: payload.ackedAtWall || Date.now(),
      ackedAtExercise: payload.ackedAtExercise || '',
      firedAtWall: payload.firedAtWall || Date.now(),
      deadAtWall: payload.deadAtWall || null
    };
    try {
      const raw = localStorage.getItem(outboxKey());
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      localStorage.setItem(outboxKey(), JSON.stringify(arr));
    } catch (e) { console.warn('alarmAckOut write fail:', e); }
    // If we happen to be the trainer (not read-only), drain immediately.
    if (!state.readOnly) outboxDrain();
  }

  // Register that an alarm inject has fired (trainer calls this so the
  // response tracker knows when the clock started).
  function registerAlarmFired(alarmInjectId) {
    if (state.readOnly) return;
    if (!state.alarm_responses[alarmInjectId]) {
      state.alarm_responses[alarmInjectId] = {
        firedAtWall: Date.now(),
        responses: {}
      };
    }
    saveState();
  }

  // Trainer marks a player as KIA.
  function markKIA(playerId, alarmId) {
    if (state.readOnly) return;
    if (!state.kia_roster) state.kia_roster = {};
    state.kia_roster[playerId] = {
      markedAt: Date.now(),
      markedAtExercise: getExerciseTime().displayString || '',
      alarmId: alarmId || null,
      replacedBy: null,
      replacedAt: null
    };
    saveState();
    dispatch('engine:kia-updated', { playerId });
  }

  // Trainer revives a KIA'd player (undo).
  function revivePlayer(playerId) {
    if (state.readOnly) return;
    if (state.kia_roster && state.kia_roster[playerId]) {
      delete state.kia_roster[playerId];
      saveState();
      dispatch('engine:kia-updated', { playerId });
    }
  }

  // Trainer replaces a KIA'd player with a new name.
  function replacePlayer(deadPlayerId, replacementName) {
    if (state.readOnly) return;
    if (!state.kia_roster || !state.kia_roster[deadPlayerId]) return;
    state.kia_roster[deadPlayerId].replacedBy = replacementName;
    state.kia_roster[deadPlayerId].replacedAt = Date.now();
    saveState();
    dispatch('engine:kia-updated', { playerId: deadPlayerId, replacedBy: replacementName });
  }

  function getAlarmResponses() { return state.alarm_responses || {}; }
  function getKIARoster() { return state.kia_roster || {}; }
  function isPlayerKIA(playerId) { return !!(state.kia_roster && state.kia_roster[playerId]); }

  // ----- Public API -----
  return {
    loadInjects, loadPhoneScript, loadContacts,
    startExercise, prelaunchExercise, beginExerciseNow,
    pause, resume, endExercise,
    flagForHotwash, fireNextInject, fireInjectById,
    markInboxRead, markSmsRead, sendCustomSms,
    getExerciseTime, loadState, resetState, enableSync,
    setReadOnly,
    // v0.2.8 role-based routing
    assignRole, getRoleOf, getStudentsWithRole,
    getLeadershipPrimary, getTeamRoles, getAssignedPlayer,
    LEADERSHIP_ROLES,
    // v0.2.12 unclaimed inject tray
    listUnclaimedInjects, listUnclaimedHistory,
    // v0.2.9 delegation + two-way messaging
    delegateItem, studentAsk, getTrainerQueue,
    markQueueHandled, trainerReply,
    // v0.2.10 student outbox (read-only-safe side channel)
    studentAskOut, studentSmsOut, outboxDrain,
    // v0.2.9 per-inject completion flag (synced to observer)
    markInjectStatus, getInjectStatus,
    // v0.2.11 session code + phase + presence
    setSession, getSession, generateSessionCode, readSessionFromLocation,
    readIdentityFromLocation,
    // v0.2.12 active-session pointer (for bare-load late joiners)
    writeActiveSessionPointer, readActiveSessionPointer, clearActiveSessionPointer,
    getRawStateString, getStateKeyName,
    getPhase, setPhase, markLaunched,
    startPresence, updatePresenceInfo, listPresence,
    // v0.2.13 network relay hooks (firebase-storage.js)
    setNetworkHooks, isNetworked,
    applyRemoteState, applyRemoteOutbox,
    applyRemotePresence, removeRemotePresence,
    // v0.2.14 alarm response + KIA system
    alarmAckOut, registerAlarmFired,
    markKIA, revivePlayer, replacePlayer,
    getAlarmResponses, getKIARoster, isPlayerKIA,
    getState: () => state,
    getContacts: () => state.contacts,
    getContact: (id) => state.contacts.find((c) => c.id === id),
    getResolvedTriggerMinutes: (id) => state._resolvedTriggers[id],
    resolveTriggers
  };
})();

// Expose on window so dynamically-loaded scripts (firebase-storage.js) can find it.
if (typeof window !== 'undefined') window.Engine = Engine;
