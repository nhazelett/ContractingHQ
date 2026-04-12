/* ==========================================================================
   CCO CAPSTONE — Inspector Whiteboard controller
   Read-only consumer of engine state + local inspector notes persistence
   ========================================================================== */

(function () {
  const NOTES_KEY = 'cco-capstone-inspector-notes';
  const CONFIG_KEY = 'cco-capstone-config';
  // v0.2.7: inspector reads (never writes) the student's response log.
  const STUDENT_RESPONSES_KEY = 'cco-capstone-student-responses';

  function loadStudentResponses() {
    try {
      const raw = localStorage.getItem(STUDENT_RESPONSES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function studentResponseFor(injectId) {
    const all = loadStudentResponses();
    return all[injectId] || null;
  }

  // Generic observations that apply to any inject. Specific inject checklists
  // come from inj.expected_actions automatically.
  const GENERIC_OBSERVATIONS = [
    { id: 'gen-comms',  text: 'Team communicated clearly and delegated effectively' },
    { id: 'gen-urg',    text: 'Student recognized urgency and prioritized correctly' },
    { id: 'gen-verify', text: 'Student verified information rather than trusting verbally' },
    { id: 'gen-far',    text: 'Appropriate FAR / DFARS authority was cited or applied' },
    { id: 'gen-ethics', text: 'Ethics or fiscal red flags were caught and addressed' },
    { id: 'gen-esc',    text: 'Student escalated to CCO / KO when required' },
    { id: 'gen-doc',    text: 'Decision was documented in the contract file' },
  ];

  // ---------- State ----------
  const ui = {
    stream:        document.getElementById('inject-stream'),
    filterBtns:    document.querySelectorAll('.chip-btn'),
    gradeBody:     document.getElementById('grade-body'),
    gradeTitle:    document.getElementById('grade-title'),
    gradeStatus:   document.getElementById('grade-status'),
    clock:         document.getElementById('ih-clock'),
    firedCount:    document.getElementById('ih-fired-count'),
    totalCount:    document.getElementById('ih-total-count'),
    gradedCount:   document.getElementById('ih-graded-count'),
    flagCount:     document.getElementById('ih-flag-count'),
    exerciseStat:  document.getElementById('exercise-status'),
    inspectorSel:  document.getElementById('inspector-select'),
    btnExport:     document.getElementById('btn-export'),
    btnReset:      document.getElementById('btn-reset'),
  };

  let notes = loadNotes();
  let selectedInjectId = null;
  let streamFilter = 'all';
  let currentInspectorId = notes.currentInspectorId || '';

  // ---------- Notes persistence ----------
  // v0.2.10: notes are now KEYED BY OBSERVER. Each inspector gets their own
  // notes per inject so two observers at the same exercise can grade
  // independently without overwriting each other's observations. The
  // on-disk shape is:
  //   { currentInspectorId: '...', entries: { [injectId]: { [observerId]: note } } }
  // Legacy single-note entries (pre-v0.2.10) are migrated into the 'legacy'
  // observer slot so nothing is lost.
  const LEGACY_OBSERVER_ID = 'legacy';

  function loadNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (!raw) return { currentInspectorId: '', entries: {} };
      const parsed = JSON.parse(raw);
      const entries = parsed.entries || {};
      // Migrate: old shape was entries[injectId] = { checked, comment, ... }.
      // New shape is entries[injectId][observerId] = { checked, comment, ... }.
      // We detect the old shape by looking for a top-level `checked` key.
      Object.keys(entries).forEach(k => {
        const v = entries[k];
        if (v && typeof v === 'object' && (v.checked !== undefined || v.score !== undefined || v.comment !== undefined)) {
          const legacyObserver = v.inspector || LEGACY_OBSERVER_ID;
          entries[k] = { [legacyObserver]: v };
        }
      });
      return { currentInspectorId: parsed.currentInspectorId || '', entries };
    } catch (e) {
      return { currentInspectorId: '', entries: {} };
    }
  }

  function saveNotes() {
    try {
      notes.currentInspectorId = currentInspectorId;
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (e) { console.error('[inspector] save fail:', e); }
  }

  // All notes for an inject keyed by observer id.
  function notesForInject(injectId) {
    if (!notes.entries[injectId]) notes.entries[injectId] = {};
    return notes.entries[injectId];
  }

  // The current observer's note for an inject — the one this session can
  // edit. If no inspector is selected we fall back to a shared 'unassigned'
  // bucket so the UI is still usable during dev.
  function noteFor(injectId) {
    const byObs = notesForInject(injectId);
    const obs = currentInspectorId || 'unassigned';
    if (!byObs[obs]) {
      byObs[obs] = {
        checked: {},
        comment: '',
        flagged: false,
        score: '',
        inspector: obs,
        updatedAt: null,
      };
    }
    return byObs[obs];
  }

  // Aggregate state across all observers for a given inject — used by the
  // stream view so the list still reflects "has anyone graded/flagged this
  // yet?" even when multiple observers are working in parallel.
  function aggregateFor(injectId) {
    const byObs = notesForInject(injectId);
    const observers = Object.values(byObs);
    if (observers.length === 0) return { score: '', flagged: false, graded: false, count: 0 };
    return {
      score: (observers.find(o => o.score) || {}).score || '',
      flagged: observers.some(o => o.flagged),
      graded: observers.some(o => o.score || (o.comment && o.comment.trim()) || Object.keys(o.checked || {}).some(k => o.checked[k])),
      count: observers.length
    };
  }

  // ---------- Inspector selector ----------
  function loadInspectorsFromConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return [];
      const cfg = JSON.parse(raw);
      return cfg.inspectors || [];
    } catch (e) { return []; }
  }

  function populateInspectorSelect() {
    const inspectors = loadInspectorsFromConfig();
    ui.inspectorSel.innerHTML = '<option value="">Pick inspector…</option>';
    inspectors.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      // v0.2.10: inspector roster no longer carries a role/title field —
      // just the name. Fall back to the id suffix if no name is set.
      opt.textContent = i.name || i.id;
      ui.inspectorSel.appendChild(opt);
    });
    if (currentInspectorId) ui.inspectorSel.value = currentInspectorId;
  }

  ui.inspectorSel.addEventListener('change', () => {
    currentInspectorId = ui.inspectorSel.value;
    saveNotes();
    // v0.2.10: switching observers swaps the whole editing surface to that
    // person's notes for the currently-selected inject.
    render();
  });

  // ---------- Engine hookup ----------
  function initEngine() {
    Engine.setReadOnly(true);
    Engine.enableSync();

    // v0.2.11: prefer session-scoped config (launched via new flow). Fall
    // back to the legacy shared key for backward compat.
    const sessionCode = (Engine.getSession && Engine.getSession()) || 'default';
    let configRaw = localStorage.getItem(CONFIG_KEY + ':' + sessionCode);
    if (!configRaw) configRaw = localStorage.getItem(CONFIG_KEY);
    if (!configRaw) {
      ui.exerciseStat.textContent = 'No config — launch STARTEX first';
      return;
    }
    const cfg = JSON.parse(configRaw);

    // v0.2.11: identity hint from URL hash → pre-select this observer.
    if (Engine.readIdentityFromLocation) {
      const ident = Engine.readIdentityFromLocation();
      if (ident && ident.type === 'inspector' && ident.id) {
        currentInspectorId = ident.id;
      }
    }

    // v0.2.11: start presence heartbeat.
    if (Engine.startPresence) {
      const identObj = (cfg.inspectors || []).find(o => o.id === currentInspectorId);
      const pid = 'inspector:' + (currentInspectorId || 'unassigned');
      Engine.startPresence(pid, {
        role: 'inspector',
        name: identObj ? identObj.name : 'Observer',
        identity: pid
      });
    }

    // Load all injects in the bundle (not just scenario-scoped), because
    // when new injects fire we want their metadata available.
    const bundleIds = (window.__CCO_DATA && window.__CCO_DATA.injects)
      ? Object.keys(window.__CCO_DATA.injects)
      : ['IM-01', 'IM-02'];

    Promise.all([
      Engine.loadInjects(bundleIds),
      Engine.loadContacts(),
    ]).then(() => {
      Engine.loadState();
      renderInspectorKickoffBanner();
      document.addEventListener('engine:phase-changed', renderInspectorKickoffBanner);
      document.addEventListener('engine:sync', () => {
        renderInspectorKickoffBanner();
        render();
      });
      render();
    });
  }

  function renderInspectorKickoffBanner() {
    const phase = Engine.getPhase ? Engine.getPhase() : 'cold-open';
    let overlay = document.getElementById('inspector-kickoff-overlay');
    if (phase !== 'pre-exercise') {
      if (overlay) overlay.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'inspector-kickoff-overlay';
      overlay.className = 'kickoff-overlay kickoff-overlay-student';
      document.body.appendChild(overlay);
    }
    const code = (Engine.getSession && Engine.getSession()) || 'default';
    overlay.innerHTML = `
      <div class="kickoff-card kickoff-card-student">
        <div class="kickoff-head">
          <div class="micro micro-accent">Waiting for kickoff</div>
          <h1 class="kickoff-title">Observer dashboard — standing by.</h1>
          <p class="kickoff-sub">Session <span class="session-code mono">${code}</span>. Once the trainer hits Start, injects will begin streaming and you'll see students' activity live.</p>
        </div>
        <div class="kickoff-student-spinner">
          <div class="kickoff-pulse"></div>
          <div class="kickoff-pulse"></div>
          <div class="kickoff-pulse"></div>
        </div>
      </div>
    `;
  }

  // ---------- Rendering ----------
  function render() {
    renderStream();
    renderHeader();
    renderGrade();
    renderRoleGapLog();
  }

  // v0.2.12: ROLE_GAP observation log. Reads state.unclaimedInjects and
  // renders a compact bar below the inspector header strip. Each row shows
  // the fired inject subject, the time it fired, and either "UNRESOLVED (Xm
  // and counting)" in red or "resolved after Xm by <student>" in amber.
  // Persists for grading even after gaps close — inspectors need the gap
  // duration at debrief.
  function renderRoleGapLog() {
    if (!Engine.listUnclaimedHistory) return;
    const history = Engine.listUnclaimedHistory();
    let bar = document.getElementById('inspector-role-gap-log');
    if (!history || history.length === 0) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      const main = document.querySelector('.inspector-main');
      const strip = document.querySelector('.inspector-header-strip');
      if (!main || !strip) return;
      bar = document.createElement('div');
      bar.id = 'inspector-role-gap-log';
      bar.className = 'role-gap-log';
      if (strip.nextSibling) {
        main.insertBefore(bar, strip.nextSibling);
      } else {
        main.appendChild(bar);
      }
    }

    // Current exercise minutes, used to compute "and counting" for live gaps.
    let nowMin = null;
    try { nowMin = Engine.getExerciseTime().totalMinutes; } catch (e) {}

    const state = Engine.getState();
    const cfg = state.config || {};
    const studentName = (id) => {
      const s = (cfg.students || []).find(x => x.id === id);
      return s ? s.name : id || '?';
    };

    const unresolvedCount = history.filter(e => !e.resolvedAtMinutes).length;
    const rows = history
      .slice()
      .sort((a, b) => (a.firedAtMinutes || 0) - (b.firedAtMinutes || 0))
      .map(e => {
        const subj = escHtml(e.subject || 'Leadership action');
        const fired = escHtml(e.firedAtDisplay || '—');
        let statusHtml;
        if (e.resolvedAtMinutes) {
          const dur = Math.max(0, (e.resolvedAtMinutes - (e.firedAtMinutes || 0)));
          statusHtml = `<span class="role-gap-status role-gap-resolved">resolved after ${dur}m by ${escHtml(studentName(e.resolvedByStudentId))}</span>`;
        } else if (nowMin != null && e.firedAtMinutes != null) {
          const dur = Math.max(0, nowMin - e.firedAtMinutes);
          statusHtml = `<span class="role-gap-status role-gap-open">UNRESOLVED — ${dur}m and counting</span>`;
        } else {
          statusHtml = `<span class="role-gap-status role-gap-open">UNRESOLVED</span>`;
        }
        return `
          <li class="role-gap-row">
            <span class="role-gap-tag">ROLE_GAP</span>
            <span class="role-gap-subject">${subj}</span>
            <span class="role-gap-time mono">${fired}</span>
            ${statusHtml}
          </li>
        `;
      }).join('');

    const headCount = unresolvedCount > 0
      ? `<strong class="role-gap-open">${unresolvedCount} live</strong> · ${history.length} total`
      : `${history.length} total · all resolved`;

    bar.innerHTML = `
      <div class="role-gap-head">
        <div class="role-gap-flag">⚠</div>
        <div class="role-gap-head-text">
          <div class="role-gap-title">Role gap log</div>
          <div class="role-gap-sub mono">${headCount}</div>
        </div>
      </div>
      <ul class="role-gap-list">${rows}</ul>
    `;
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function renderHeader() {
    const state = Engine.getState();
    const time = Engine.getExerciseTime();
    ui.clock.textContent = state.clock.running ? time.displayString : '—';
    ui.totalCount.textContent = state.injects.length;
    ui.firedCount.textContent = state.fired.size;
    ui.gradedCount.textContent = countGraded();
    ui.flagCount.textContent  = countFlagged();
    ui.exerciseStat.textContent = state.clock.running
      ? (state.paused ? 'Exercise paused' : 'Exercise live')
      : 'Exercise not running';
  }

  function countGraded() {
    // An inject is "graded" if at least one observer left any trace on it.
    return Object.keys(notes.entries).filter(id => aggregateFor(id).graded).length;
  }

  function countFlagged() {
    return Object.keys(notes.entries).filter(id => aggregateFor(id).flagged).length;
  }

  function firedInjects() {
    const state = Engine.getState();
    return state.injects
      .filter(i => state.fired.has(i.id))
      .sort((a, b) => {
        // Fired order roughly matches trigger order in absolute-trigger mode
        const at = a.trigger ? (a.trigger.day * 1440 + a.trigger.hour * 60 + a.trigger.minute) : 0;
        const bt = b.trigger ? (b.trigger.day * 1440 + b.trigger.hour * 60 + b.trigger.minute) : 0;
        return at - bt;
      });
  }

  function renderStream() {
    const list = firedInjects();
    const filtered = list.filter(inj => {
      const agg = aggregateFor(inj.id);
      if (streamFilter === 'ungraded') return !agg.score;
      if (streamFilter === 'flagged')  return agg.flagged;
      return true;
    });

    if (list.length === 0) {
      ui.stream.innerHTML = `
        <div class="stream-empty">
          <div class="micro">No injects yet</div>
          <p>When the trainer fires an inject, it'll show up here for grading.</p>
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      ui.stream.innerHTML = `
        <div class="stream-empty">
          <div class="micro">Nothing matches this filter</div>
        </div>`;
      return;
    }

    ui.stream.innerHTML = '';
    filtered.forEach(inj => {
      const agg = aggregateFor(inj.id);
      const myNote = currentInspectorId ? (notesForInject(inj.id)[currentInspectorId] || null) : null;
      const item = document.createElement('div');
      item.className = 'stream-item' + (inj.id === selectedInjectId ? ' active' : '');
      item.dataset.injectId = inj.id;

      const head = document.createElement('div');
      head.className = 'stream-item-head';
      head.innerHTML = `
        <span class="stream-id">${escapeHtml(inj.id)}</span>
        <span class="stream-time">${triggerLabel(inj)}</span>`;
      item.appendChild(head);

      const title = document.createElement('div');
      title.className = 'stream-title';
      title.textContent = inj.title || '(untitled)';
      item.appendChild(title);

      const status = document.createElement('div');
      status.className = 'stream-status';
      // Show MY score first (so this observer sees their own state clearly);
      // fall back to ungraded if I haven't touched it yet.
      if (myNote && myNote.score) {
        const scoreBadge = document.createElement('span');
        scoreBadge.className = 'stream-badge graded';
        scoreBadge.textContent = myNote.score;
        status.appendChild(scoreBadge);
      } else {
        const un = document.createElement('span');
        un.className = 'stream-badge ungraded';
        un.textContent = 'Ungraded';
        status.appendChild(un);
      }
      if (myNote && myNote.flagged) {
        const flg = document.createElement('span');
        flg.className = 'stream-badge flagged';
        flg.textContent = 'Flagged';
        status.appendChild(flg);
      }
      // v0.2.10: how many OTHER observers have weighed in on this inject?
      const otherCount = Object.keys(notesForInject(inj.id)).filter(id => id !== currentInspectorId && id !== 'unassigned').length;
      if (otherCount > 0) {
        const co = document.createElement('span');
        co.className = 'stream-badge co-observed';
        co.textContent = `+${otherCount} other${otherCount === 1 ? '' : 's'}`;
        co.title = 'Other observers have also logged notes on this inject';
        status.appendChild(co);
      }
      // v0.2.9 (post-pivot): the trainer flags each inject complete or
      // incomplete from the Active Feed card; the observer sees that
      // flag right next to their own grading state so the two views
      // stay in agreement on "did this inject get handled?"
      const injStatus = Engine.getInjectStatus ? Engine.getInjectStatus(inj.id) : null;
      if (injStatus) {
        const s2 = document.createElement('span');
        s2.className = 'stream-badge trainer-' + injStatus;
        s2.textContent = injStatus === 'complete' ? 'Trainer ✓' : 'Trainer ✗';
        status.appendChild(s2);
      }
      item.appendChild(status);

      item.addEventListener('click', () => {
        selectedInjectId = inj.id;
        render();
      });
      ui.stream.appendChild(item);
    });
  }

  function triggerLabel(inj) {
    // Prefer resolved time (set at startExercise with jitter/window), fall
    // back to the declared absolute trigger for injects that haven't fired yet.
    const resolved = Engine.getResolvedTriggerMinutes
      ? Engine.getResolvedTriggerMinutes(inj.id)
      : null;
    if (resolved != null) {
      const day = Math.floor(resolved / 1440) + 1;
      const mid = resolved % 1440;
      return `D${day} ${pad(Math.floor(mid / 60))}:${pad(mid % 60)}`;
    }
    if (!inj.trigger) return '';
    const t = inj.trigger;
    if (t.type === 'window') {
      return `D${t.day} ${pad(t.earliest_hour || 8)}–${pad(t.latest_hour || 17)}`;
    }
    return `D${t.day} ${pad(t.hour || 0)}:${pad(t.minute || 0)}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function renderGrade() {
    if (!selectedInjectId) {
      ui.gradeBody.innerHTML = `
        <div class="grade-empty">
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="6" y="8" width="36" height="32" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M14 18h20M14 26h20M14 34h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <div class="micro">Whiteboard ready</div>
          <p>Pick a fired inject on the left to start grading. You can mark observations, flag incidents, and leave comments that appear in the hotwash export.</p>
        </div>`;
      ui.gradeTitle.textContent = 'Select an inject';
      ui.gradeStatus.innerHTML = '';
      return;
    }

    // v0.2.10: refuse to show the editing surface until an observer has been
    // picked — otherwise their comments would land in the shared 'unassigned'
    // bucket and get mixed with everyone else's work.
    if (!currentInspectorId) {
      ui.gradeBody.innerHTML = `
        <div class="grade-empty">
          <div class="micro">Who's observing?</div>
          <p>Pick your name from the <strong>Pick inspector…</strong> dropdown in the header. Your notes and scores will be stamped with your id so co-observers don't overwrite each other.</p>
        </div>`;
      ui.gradeTitle.textContent = 'Pick an observer first';
      ui.gradeStatus.innerHTML = '';
      return;
    }

    const state = Engine.getState();
    const inj = state.injects.find(i => i.id === selectedInjectId);
    if (!inj) {
      ui.gradeBody.innerHTML = `<div class="grade-empty"><p>Inject not found in current bundle.</p></div>`;
      return;
    }

    const n = noteFor(inj.id);
    const allForInj = notesForInject(inj.id);
    const otherObservers = Object.keys(allForInj).filter(id => id !== currentInspectorId && id !== 'unassigned');
    const meName = (loadInspectorsFromConfig().find(i => i.id === currentInspectorId) || {}).name || currentInspectorId;
    ui.gradeTitle.textContent = `${inj.id} · ${inj.title || ''}`;
    const otherPill = otherObservers.length > 0
      ? ` <span class="grade-status-pill co-observed">${otherObservers.length} co-observer${otherObservers.length === 1 ? '' : 's'}</span>`
      : '';
    ui.gradeStatus.innerHTML = (n.score
      ? `<span class="grade-status-pill graded">${escapeHtml(n.score)}</span>`
      : `<span class="grade-status-pill">Ungraded</span>`) +
      ` <span class="grade-status-pill observer-label">${escapeHtml(meName)}</span>` +
      otherPill;

    ui.gradeBody.innerHTML = '';

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'grade-meta';
    meta.innerHTML = `
      <div class="grade-meta-block">
        <div class="field-label">Trigger</div>
        <div class="value">${triggerLabel(inj)}</div>
      </div>
      <div class="grade-meta-block">
        <div class="field-label">Duration</div>
        <div class="value">${inj.duration_minutes || '—'} min</div>
      </div>
      <div class="grade-meta-block">
        <div class="field-label">TLO</div>
        <div class="value">${(inj.tlo || []).join(' · ') || '—'}</div>
      </div>
      <div class="grade-meta-block">
        <div class="field-label">Difficulty</div>
        <div class="value">${(inj.difficulty || []).join('/') || '—'}</div>
      </div>`;
    ui.gradeBody.appendChild(meta);

    // Description
    if (inj.description) {
      const desc = document.createElement('div');
      desc.className = 'inject-description';
      desc.textContent = inj.description;
      ui.gradeBody.appendChild(desc);
    }

    // v0.2.7: student's self-reported response to this inject.
    // Read-only here; grader uses this to anchor their observations.
    const sr = studentResponseFor(inj.id);
    const srBlock = document.createElement('div');
    srBlock.className = 'student-response-block' + (sr ? '' : ' empty');
    if (!sr || (!sr.action && !sr.authority && !sr.rationale)) {
      srBlock.innerHTML = `
        <div class="sr-head">
          <div class="micro">Student response</div>
          <div class="sr-status empty">Not logged</div>
        </div>
        <div class="sr-empty">Student has not recorded a response for this inject yet.</div>`;
    } else {
      srBlock.innerHTML = `
        <div class="sr-head">
          <div class="micro">Student response${sr.locked ? ' · SUBMITTED' : ' · DRAFT'}</div>
          <div class="sr-status ${sr.locked ? 'locked' : 'draft'}">${sr.locked ? 'Submitted' : 'Draft'}</div>
        </div>
        <div class="sr-grid">
          <div class="sr-row">
            <div class="sr-label">Action taken</div>
            <div class="sr-value">${escapeHtml(sr.action || '—')}</div>
          </div>
          <div class="sr-row">
            <div class="sr-label">Authority cited</div>
            <div class="sr-value mono">${escapeHtml(sr.authority || '—')}</div>
          </div>
          <div class="sr-row">
            <div class="sr-label">Rationale</div>
            <div class="sr-value">${escapeHtml(sr.rationale || '—')}</div>
          </div>
        </div>`;
    }
    ui.gradeBody.appendChild(srBlock);

    // Toolbar: flag + score
    const toolbar = document.createElement('div');
    toolbar.className = 'grade-toolbar';
    toolbar.innerHTML = `
      <label class="flag-toggle ${n.flagged ? 'on' : ''}">
        <input type="checkbox" ${n.flagged ? 'checked' : ''} />
        <span>Flag for hotwash</span>
      </label>
      <div class="score-group">
        <div class="field-label">Score</div>
        <button type="button" class="score-btn" data-score="GO"    >GO</button>
        <button type="button" class="score-btn" data-score="NO-GO" >NO-GO</button>
      </div>`;
    ui.gradeBody.appendChild(toolbar);

    toolbar.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      n.flagged = e.target.checked;
      toolbar.querySelector('.flag-toggle').classList.toggle('on', n.flagged);
      touch(n);
      renderHeader();
      renderStream();
    });

    toolbar.querySelectorAll('.score-btn').forEach(btn => {
      if (btn.dataset.score === n.score) btn.classList.add('active');
      btn.addEventListener('click', () => {
        n.score = (n.score === btn.dataset.score) ? '' : btn.dataset.score;
        touch(n);
        renderGrade();
        renderHeader();
        renderStream();
      });
    });

    // Section: per-inject expected actions
    const specific = inj.expected_actions || [];
    if (specific.length) {
      ui.gradeBody.appendChild(sectionHeader(
        'Scenario-specific observations',
        `${Object.keys(n.checked).filter(k => n.checked[k] && k.startsWith('sp-')).length} / ${specific.length}`
      ));
      const list = document.createElement('div');
      list.className = 'obs-list';
      specific.forEach(a => {
        const key = 'sp-' + a.id;
        list.appendChild(obsItem(key, a.description, a.priority, !!n.checked[key], (val) => {
          if (val) n.checked[key] = true; else delete n.checked[key];
          touch(n);
        }));
      });
      ui.gradeBody.appendChild(list);
    }

    // Section: generic observations
    ui.gradeBody.appendChild(sectionHeader(
      'General observations',
      `${Object.keys(n.checked).filter(k => n.checked[k] && k.startsWith('gen-')).length} / ${GENERIC_OBSERVATIONS.length}`
    ));
    const glist = document.createElement('div');
    glist.className = 'obs-list';
    GENERIC_OBSERVATIONS.forEach(a => {
      const key = a.id;
      glist.appendChild(obsItem(key, a.text, null, !!n.checked[key], (val) => {
        if (val) n.checked[key] = true; else delete n.checked[key];
        touch(n);
      }));
    });
    ui.gradeBody.appendChild(glist);

    // Section: comments
    const cwrap = document.createElement('div');
    cwrap.className = 'grade-section';
    const chead = document.createElement('div');
    chead.className = 'grade-section-head';
    chead.innerHTML = `
      <div class="micro">Inspector comments</div>
      <div class="autosave-hint" id="autosave-hint">Autosaving</div>`;
    cwrap.appendChild(chead);
    const ta = document.createElement('textarea');
    ta.className = 'comment-field';
    ta.placeholder = 'What did the student actually do? What was the moment? What would you say in the hotwash?';
    ta.value = n.comment || '';
    ta.addEventListener('input', () => {
      n.comment = ta.value;
      touch(n);
      const hint = document.getElementById('autosave-hint');
      if (hint) { hint.textContent = 'Saved ✓'; setTimeout(() => { hint.textContent = 'Autosaving'; }, 900); }
      renderHeader();
    });
    cwrap.appendChild(ta);
    ui.gradeBody.appendChild(cwrap);
  }

  function sectionHeader(label, countText) {
    const wrap = document.createElement('div');
    wrap.className = 'grade-section';
    wrap.innerHTML = `
      <div class="grade-section-head">
        <div class="micro">${escapeHtml(label)}</div>
        <div class="section-count">${escapeHtml(countText)}</div>
      </div>`;
    return wrap;
  }

  function obsItem(key, text, priority, checked, onChange) {
    const label = document.createElement('label');
    label.className = 'obs-item' + (checked ? ' checked' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.addEventListener('change', () => {
      onChange(cb.checked);
      label.classList.toggle('checked', cb.checked);
      renderHeader();
      renderStream();
    });
    label.appendChild(cb);
    const body = document.createElement('div');
    body.className = 'obs-item-body';
    const txt = document.createElement('div');
    txt.className = 'obs-item-text';
    txt.textContent = text;
    body.appendChild(txt);
    label.appendChild(body);
    if (priority) {
      const tag = document.createElement('span');
      tag.className = 'obs-item-tag ' + priority;
      tag.textContent = priority;
      label.appendChild(tag);
    }
    return label;
  }

  function touch(n) {
    n.updatedAt = new Date().toISOString();
    n.inspector = currentInspectorId;
    saveNotes();
  }

  // ---------- Filter + actions ----------
  ui.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ui.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      streamFilter = btn.dataset.filter;
      renderStream();
    });
  });

  ui.btnReset.addEventListener('click', () => {
    // v0.2.10: reset only clears the CURRENT observer's notes by default,
    // so one observer resetting doesn't nuke their co-observers' work.
    if (!currentInspectorId) {
      if (confirm('No observer selected — clear ALL inspector notes across ALL observers? This cannot be undone.')) {
        notes = { currentInspectorId: currentInspectorId, entries: {} };
        saveNotes();
        selectedInjectId = null;
        render();
      }
      return;
    }
    const meName = (loadInspectorsFromConfig().find(i => i.id === currentInspectorId) || {}).name || currentInspectorId;
    if (confirm(`Clear only ${meName}'s notes? Other observers' notes will be preserved.`)) {
      Object.keys(notes.entries).forEach(injId => {
        if (notes.entries[injId] && notes.entries[injId][currentInspectorId]) {
          delete notes.entries[injId][currentInspectorId];
        }
        if (notes.entries[injId] && Object.keys(notes.entries[injId]).length === 0) {
          delete notes.entries[injId];
        }
      });
      saveNotes();
      render();
    }
  });

  ui.btnExport.addEventListener('click', exportNotes);

  function exportNotes() {
    const lines = [];
    const inspectorsCfg = loadInspectorsFromConfig();
    const nameOf = (id) => (inspectorsCfg.find(i => i.id === id) || {}).name || id;

    lines.push('CCO CAPSTONE — Inspector notes export');
    lines.push('Generated: ' + new Date().toLocaleString());
    if (currentInspectorId) {
      lines.push('Exported by: ' + nameOf(currentInspectorId));
    }
    lines.push('');
    lines.push('='.repeat(60));
    const fired = firedInjects();
    fired.forEach(inj => {
      const byObs = notesForInject(inj.id);
      const observerIds = Object.keys(byObs);
      if (observerIds.length === 0) return;
      lines.push('');
      lines.push(`[${inj.id}] ${inj.title || ''}`);
      // v0.2.7: fold the student's self-reported response into the export
      const sr = studentResponseFor(inj.id);
      if (sr && (sr.action || sr.authority || sr.rationale)) {
        lines.push(`  Student response${sr.locked ? ' (submitted)' : ' (draft)'}:`);
        if (sr.action)    lines.push(`    Action: ${sr.action.replace(/\n/g, ' ')}`);
        if (sr.authority) lines.push(`    Authority: ${sr.authority}`);
        if (sr.rationale) lines.push(`    Rationale: ${sr.rationale.replace(/\n/g, ' ')}`);
      }

      // v0.2.10: export each observer's notes under their name so the
      // hotwash document preserves whose observation is whose.
      observerIds.forEach(obs => {
        const n = byObs[obs];
        lines.push(`  — ${nameOf(obs)} —`);
        lines.push(`    Score: ${n.score || 'Ungraded'}${n.flagged ? ' · FLAGGED' : ''}`);
        const checks = [];
        Object.keys(n.checked || {}).forEach(k => {
          if (!n.checked[k]) return;
          if (k.startsWith('sp-')) {
            const id = k.slice(3);
            const a = (inj.expected_actions || []).find(x => x.id === id);
            checks.push('    ✓ ' + (a ? a.description : k));
          } else {
            const g = GENERIC_OBSERVATIONS.find(x => x.id === k);
            checks.push('    ✓ ' + (g ? g.text : k));
          }
        });
        if (checks.length) lines.push(...checks);
        if (n.comment && n.comment.trim()) {
          lines.push('    Comment:');
          n.comment.split('\n').forEach(l => lines.push('      ' + l));
        }
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspector-notes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  // ---------- Event subscriptions ----------
  document.addEventListener('engine:sync',         render);
  document.addEventListener('engine:inject-fired', render);
  document.addEventListener('engine:inject-status', render);
  document.addEventListener('engine:tick',         renderHeader);
  // v0.2.12: re-render the ROLE_GAP log on each tick so "and counting"
  // durations stay live, and immediately when an unclaimed inject fires
  // or resolves so the panel appears/updates without a storage event.
  document.addEventListener('engine:tick',         renderRoleGapLog);
  document.addEventListener('engine:unclaimed-inject',   renderRoleGapLog);
  document.addEventListener('engine:unclaimed-resolved', renderRoleGapLog);

  // Also repopulate inspector select on sync (roster may have changed on relaunch)
  document.addEventListener('engine:sync', populateInspectorSelect);

  // v0.2.7: watch the student-response key directly so inspector sees new
  // writes from the student window without waiting on engine:sync.
  window.addEventListener('storage', (e) => {
    if (e.key === STUDENT_RESPONSES_KEY && selectedInjectId) {
      renderGrade();
    }
  });

  // ---------- Boot ----------
  populateInspectorSelect();
  initEngine();
})();
