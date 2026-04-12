/* ==========================================================================
   TRAINER VIEW
   ========================================================================== */

// v0.2.7: load every inject present in the bundle rather than a hardcoded pair.
// Previously this was ['IM-01', 'IM-02'] which meant IM-03..IM-50 silently
// never loaded. The bundle is the source of truth for what ships.
function bundleInjectIds() {
  return (window.__CCO_DATA && window.__CCO_DATA.injects)
    ? Object.keys(window.__CCO_DATA.injects)
    : ['IM-01', 'IM-02'];
}

// v0.2.9: which inject is currently "focused" in the Inject Focus panel.
// Clicking a timeline row or active-feed card sets this. The focus panel
// reads inj.quick_fires (an array of {label, kind, subject, body, to}) and
// renders a button per entry.
let focusedInjectId = null;

// v0.2.9: default quick-fire templates for any inject that doesn't ship
// with its own. Gives the trainer something useful to click on day one
// while the content library grows. Per-inject authored quick_fires
// always take precedence over these.
const DEFAULT_QUICK_FIRES = [
  {
    label: 'FIRE — PWS draft',
    from: 'A2 Plans · Lt Huang',
    subject: 'PWS outline you asked for',
    body: 'Attaching the PWS outline template. Fill in the performance standards and inspection methods; route through Legal before signing. Section C is the SOW proper, Section L is instructions to offerors, Section M is evaluation criteria. Ping me if you hit a blocker.'
  },
  {
    label: 'FIRE — Market research',
    from: 'SBA Procurement Center Rep',
    subject: 'Market research summary',
    body: 'SAM search returned 4 vendors in the area with current SAM registration and no exclusions. Two are WOSB, one is SDVOSB, one is 8(a). Attaching the capability questionnaire responses — all 4 claim they can meet the delivery window. Recommend full and open with small business set-aside evaluation.'
  },
  {
    label: 'FIRE — J&A memo template',
    from: 'Chief of Contracting · MSgt Alvarez',
    subject: 'J&A template + citation reminders',
    body: 'Attaching the Justification and Approval template. Cite the specific FAR 6.302 authority (likely 6.302-2 "unusual and compelling urgency" for this one). Document the market research that narrowed it to one source and why other sources were unreasonable. Approval authority depends on dollar value — check FAR 6.304 Table.'
  },
  {
    label: 'FIRE — Quote / proposal',
    from: 'Vendor rep · Crescent Star Logistics',
    subject: 'Firm quote — attached',
    body: 'Per your RFQ, pricing is attached. Delivery 7 days ARO. Payment terms Net 30. Price good for 14 days. Note: we cannot meet the warranty terms in clause 52.246-2 as written; we propose substitution with our standard 12-month warranty.'
  },
  {
    label: 'FIRE — Legal review needed',
    from: 'Staff Judge Advocate · Capt Reyes',
    subject: 'Hold for legal review',
    body: 'Noting this for legal review before you proceed. Flag the ethics angle (is anyone in your chain connected to the vendor?) and the appropriation year question (O&M vs. OCO funding?). Do not sign anything until I clear it — walk it down to my office.'
  }
];

function quickFiresFor(inj) {
  if (inj && Array.isArray(inj.quick_fires) && inj.quick_fires.length > 0) {
    return inj.quick_fires;
  }
  return DEFAULT_QUICK_FIRES;
}

// v0.2.11: The kickoff overlay sits on top of the trainer dashboard when the
// session is in 'pre-exercise' phase. It shows the session code, a roster
// of who's joined via presence heartbeats, and a big Start Exercise button.
// When the button is clicked, we call Engine.beginExerciseNow() which flips
// phase to 'cold-open' — every connected view drops its waiting banner
// and the clock starts. The overlay hides automatically on phase change.
function renderKickoffOverlay() {
  const phase = Engine.getPhase ? Engine.getPhase() : 'cold-open';
  let overlay = document.getElementById('kickoff-overlay');
  if (phase !== 'pre-exercise') {
    if (overlay) overlay.remove();
    if (_presenceTickInterval) {
      clearInterval(_presenceTickInterval);
      _presenceTickInterval = null;
    }
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'kickoff-overlay';
    overlay.className = 'kickoff-overlay';
    document.body.appendChild(overlay);
  }
  const code = (Engine.getSession && Engine.getSession()) || 'default';
  const cfg = Engine.getState().config || {};
  const rosterCount =
    ((cfg.students || []).length) +
    ((cfg.whitecell || []).length) +
    ((cfg.inspectors || []).length) +
    1; // trainer
  const joined = Engine.listPresence ? Engine.listPresence() : [];
  const joinedCount = joined.length;

  const rosterRows = [
    ...(cfg.students || []).map(s => ({ id: 'student:' + s.id, name: s.name, role: 'Student · ' + (s.shop || 'CONS'), color: s.color || '#F5B845' })),
    ...(cfg.whitecell || []).map(w => ({ id: 'whitecell:' + w.id, name: w.name, role: 'White Cell', color: w.color || '#8A7AB0' })),
    ...(cfg.inspectors || []).map(ob => ({ id: 'inspector:' + ob.id, name: ob.name, role: 'Observer', color: ob.color || '#4FC3D7' })),
    { id: 'trainer:main', name: 'Trainer', role: 'Trainer', color: '#4FC3D7' }
  ];

  overlay.innerHTML = `
    <div class="kickoff-card">
      <div class="kickoff-head">
        <div class="micro micro-accent">Pre-exercise · waiting for kickoff</div>
        <h1 class="kickoff-title">Session <span class="session-code mono">${code}</span></h1>
        <p class="kickoff-sub">${joinedCount} of ${rosterCount} joined. When you're ready, click <strong>Start Exercise</strong> below to kick off Day 1. Every connected dashboard will move to the cold open at the same moment.</p>
      </div>

      <div class="kickoff-roster">
        ${rosterRows.map(r => {
          const match = joined.find(j => j.clientId === r.id || j.identity === r.id);
          const isHere = !!match;
          return `
            <div class="kickoff-row ${isHere ? 'here' : 'waiting'}">
              <span class="kickoff-dot" style="background:${r.color};"></span>
              <span class="kickoff-name">${r.name || '—'}</span>
              <span class="kickoff-role">${r.role}</span>
              <span class="kickoff-status">${isHere ? 'joined' : 'waiting…'}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="kickoff-foot">
        <div class="kickoff-hint">Share the session code above with every participant. Each person opens their role view from the STARTEX launch page, or types the code into student/inspector/mobile at the home screen.</div>
        <button class="btn btn-primary btn-xl" id="kickoff-start-btn">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
          Start Exercise
        </button>
      </div>
    </div>
  `;

  const btn = document.getElementById('kickoff-start-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (Engine.beginExerciseNow) {
        Engine.beginExerciseNow();
      } else {
        // Fallback for legacy single-phase flow
        Engine.startExercise(Engine.getState().config);
      }
      overlay.remove();
    });
  }

  // Refresh the presence list every 3s while the overlay is up so new joiners
  // populate without having to click anything.
  if (!_presenceTickInterval) {
    _presenceTickInterval = setInterval(renderKickoffOverlay, 3000);
  }
}
let _presenceTickInterval = null;

(async function init() {
  // v0.2.11: prefer session-scoped config if we're on a real session (URL
  // hash carries #session=CODE). The engine auto-bound currentSession at
  // module load; read the code back and try the session-scoped key first.
  const sessionCode = (window.Engine && Engine.getSession) ? Engine.getSession() : 'default';
  let configRaw = localStorage.getItem('cco-capstone-config:' + sessionCode);
  if (!configRaw) configRaw = localStorage.getItem('cco-capstone-config');
  if (!configRaw) {
    window.location.href = 'startex.html';
    return;
  }
  const config = JSON.parse(configRaw);

  // v0.2.11: difficulty panel was removed in Phase C. Keep label updating
  // defensive so legacy configs don't crash the trainer.
  const diffLabel = document.getElementById('difficulty-label');
  if (diffLabel) {
    const d = config.difficulty || config.scenario_title || 'Custom';
    diffLabel.textContent = typeof d === 'string' ? (d.charAt(0).toUpperCase() + d.slice(1)) : 'Custom';
  }

  // Load content
  await Engine.loadContacts();
  await Engine.loadInjects(bundleInjectIds());

  // Resume or start. v0.2.11 flow:
  //   - state exists + phase='pre-exercise' → show Start Exercise button,
  //     don't run clock, present "waiting for kickoff"
  //   - state exists + phase='cold-open'/later → normal resume
  //   - no state → legacy one-shot path: call startExercise(config)
  const hadState = Engine.loadState();
  if (!hadState) {
    Engine.startExercise(config);
  }
  Engine.enableSync();

  // Presence: announce ourselves to the session so the presence panel sees us.
  if (Engine.startPresence) {
    Engine.startPresence('trainer-main', { role: 'trainer', name: 'Trainer' });
  }

  // Render the kickoff overlay if we're still in pre-exercise.
  renderKickoffOverlay();
  document.addEventListener('engine:phase-changed', renderKickoffOverlay);
  document.addEventListener('engine:sync', renderKickoffOverlay);

  // Initial render
  renderAll();

  // Event hooks
  document.addEventListener('engine:tick', () => {
    renderClock();
    renderCountdown();
  });
  document.addEventListener('engine:inject-fired', () => renderAll());
  document.addEventListener('engine:sync', () => renderAll());
  document.addEventListener('engine:paused', () => updateStatusPill('paused'));
  document.addEventListener('engine:resumed', () => updateStatusPill('live'));
  document.addEventListener('engine:endex', () => {
    updateStatusPill('endex');
    alert('ENDEX. Hotwash mode coming in v0.3.');
  });

  // Buttons
  document.getElementById('pause-btn').addEventListener('click', () => {
    const s = Engine.getState();
    if (s.paused) {
      Engine.resume();
      document.getElementById('pause-btn').innerHTML = '<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg> Pause';
    } else {
      Engine.pause();
      document.getElementById('pause-btn').innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 4l14 8-14 8z" fill="currentColor"/></svg> Resume';
    }
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset the exercise? This clears all fired injects and returns to STARTEX config.')) {
      Engine.resetState();
      window.location.href = 'startex.html';
    }
  });

  document.getElementById('endex-btn').addEventListener('click', () => {
    if (confirm('Call ENDEX? The clock will stop and the exercise will end.')) {
      Engine.endExercise();
    }
  });

  document.getElementById('fire-next-btn').addEventListener('click', () => {
    Engine.fireNextInject();
  });

  // ===== BOMB BUTTON — ALARM RED instant launch =====
  // 3-hour cooldown after each manual launch (scheduled alarm injects bypass cooldown).
  // Scoped to the active session so a new STARTEX resets it automatically.
  const BOMB_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours in ms
  const bombSession = (Engine.getSession && Engine.getSession()) || 'default';
  const BOMB_COOLDOWN_KEY = `cco-capstone-bomb-cooldown:${bombSession}`;
  const bombBtn = document.getElementById('bomb-btn');

  function getBombCooldownEnd() {
    try { return parseInt(localStorage.getItem(BOMB_COOLDOWN_KEY) || '0', 10); } catch (_) { return 0; }
  }
  function setBombCooldown() {
    try { localStorage.setItem(BOMB_COOLDOWN_KEY, String(Date.now() + BOMB_COOLDOWN_MS)); } catch (_) {}
  }
  function isBombOnCooldown() {
    return Date.now() < getBombCooldownEnd();
  }

  function updateBombBtn() {
    if (!bombBtn) return;
    if (isBombOnCooldown()) {
      bombBtn.classList.add('on-cooldown');
      const remaining = Math.ceil((getBombCooldownEnd() - Date.now()) / 60000);
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      const label = bombBtn.querySelector('.bomb-label');
      if (label) label.innerHTML = `COOLDOWN <span class="bomb-cooldown-label">${h}h ${m}m</span>`;
      bombBtn.title = `Cooldown active — ${h}h ${m}m remaining`;
    } else {
      bombBtn.classList.remove('on-cooldown');
      const label = bombBtn.querySelector('.bomb-label');
      if (label) label.textContent = 'ALARM RED';
      bombBtn.title = 'Launch alarm — triggers ALARM RED on all student screens';
    }
  }

  // Update cooldown display every 30 seconds
  setInterval(updateBombBtn, 30000);
  updateBombBtn();

  if (bombBtn) {
    bombBtn.addEventListener('click', () => {
      if (isBombOnCooldown()) {
        const remaining = Math.ceil((getBombCooldownEnd() - Date.now()) / 60000);
        const h = Math.floor(remaining / 60);
        const m = remaining % 60;
        showModal('Cooldown Active', `<p>The ALARM RED button is on cooldown for ${h}h ${m}m. This prevents alarm fatigue during the exercise.</p><p class="muted" style="font-size:12px;margin-top:12px;">Scheduled alarm injects (like IM-29) fire normally regardless of cooldown.</p>`);
        return;
      }

      // Show confirmation modal
      const overlay = document.createElement('div');
      overlay.className = 'bomb-confirm-overlay';
      overlay.id = 'bomb-confirm-overlay';
      overlay.innerHTML = `
        <div class="bomb-confirm-card">
          <div class="bomb-confirm-icon">
            <svg viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="55" r="30" stroke="#FF1744" stroke-width="3" fill="rgba(255,23,68,0.08)"/>
              <path d="M50 25V15" stroke="#FF1744" stroke-width="3" stroke-linecap="round"/>
              <path d="M50 15L60 5" stroke="#FF6B35" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M58 8L65 11" stroke="#FF6B35" stroke-width="2" stroke-linecap="round"/>
              <path d="M57 3L62 6" stroke="#FF6B35" stroke-width="2" stroke-linecap="round"/>
              <circle cx="42" cy="50" r="4" fill="rgba(255,23,68,0.15)"/>
            </svg>
          </div>
          <div class="bomb-confirm-title">Launch ALARM RED?</div>
          <div class="bomb-confirm-desc">
            This will immediately trigger a base-wide alarm on every student workstation and connected phone.
            Sirens will blare. Screens will flash red. Students must shelter in place.<br><br>
            <strong>3-hour cooldown</strong> starts after launch.
          </div>
          <div class="bomb-confirm-actions">
            <button class="bomb-confirm-launch" id="bomb-confirm-yes">LAUNCH</button>
            <button class="bomb-confirm-cancel" id="bomb-confirm-no">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('bomb-confirm-yes').addEventListener('click', () => {
        overlay.remove();
        const s = Engine.getState();

        // Find any unfired inject with an alarm field (IM-29 is the primary)
        const alarmInject = s.injects.find(i => i.alarm && !s.fired.has(i.id));
        let firedId;
        if (alarmInject) {
          firedId = alarmInject.id;
          Engine.fireInjectById(firedId);
        } else {
          // All alarm injects already fired — create an ad-hoc one
          firedId = 'ADHOC-ALARM-' + Date.now();
          s.injects.push({
            id: firedId,
            title: 'Ad-hoc ALARM RED',
            alarm: {
              title: 'ALARM RED',
              message: 'INCOMING — TAKE COVER IMMEDIATELY\nI SAY AGAIN — ALARM RED — TAKE COVER',
              source: 'GIANT VOICE',
              sound: 'siren',
              duration_seconds: 25
            },
            inbox_items: [],
            sms_items: [],
            expected_actions: []
          });
          Engine.fireInjectById(firedId);
        }

        // Register alarm fired for response tracking
        Engine.registerAlarmFired(firedId);

        // Start cooldown
        setBombCooldown();
        updateBombBtn();
        renderAll();
        renderKIAPanel();
      });

      document.getElementById('bomb-confirm-no').addEventListener('click', () => {
        overlay.remove();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
    });
  }

  // White cell controls
  document.querySelectorAll('.wc-btn').forEach(btn => {
    btn.addEventListener('click', () => handleWhiteCellAction(btn.dataset.wc));
  });

  // Observer strip collapse toggle
  const stripDismiss = document.getElementById('observer-strip-dismiss');
  if (stripDismiss) {
    stripDismiss.addEventListener('click', () => {
      observerStripCollapsed = !observerStripCollapsed;
      stripDismiss.textContent = observerStripCollapsed ? '+' : '−';
      renderObserverStrip();
    });
  }

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  // v0.2.8: re-render when any role assignment changes
  document.addEventListener('engine:team-roles-updated', () => renderAll());

  // v0.2.9: re-render when a student posts to the trainer queue or when a
  // delegation event fires. A NEW student ask also triggers an in-your-face
  // notification: a toast, a count badge flash, and a yellow pulse on the
  // Action Queue panel — because the original silent re-render was too
  // easy to miss during a busy exercise.
  document.addEventListener('engine:trainer-queue-updated', (e) => {
    renderActionQueue();
    // Only notify on newly-posted asks, not when we mark one handled.
    const detail = e && e.detail && e.detail.entry;
    if (detail && !detail.handled) {
      flashActionQueue(detail);
    }
  });
  document.addEventListener('engine:inbox-updated', () => {
    renderInboxMirror();
  });
  document.addEventListener('engine:delegation', () => {
    renderInboxMirror();
    renderActionQueue();
  });
  // v0.2.9 (post-pivot): re-render the observer strip + active feed when
  // the trainer toggles an inject's complete/incomplete flag, and when a
  // cross-window sync event brings in a remote toggle.
  document.addEventListener('engine:inject-status', () => {
    renderActiveFeed();
    renderObserverStrip();
  });

  // v0.2.10: drain the student outbox on load + on every sync. Student and
  // mobile views run Engine.setReadOnly(true) so they can't write to the
  // main state key — instead they append to a separate outbox key, and the
  // trainer pulls from it. The storage listener in engine.js already calls
  // outboxDrain on the live 'storage' event, but we also drain on startup
  // and on engine:sync to catch anything that was queued before the trainer
  // tab opened or while the trainer was in another tab.
  if (Engine.outboxDrain) Engine.outboxDrain();
  document.addEventListener('engine:sync', () => {
    if (Engine.outboxDrain) Engine.outboxDrain();
  });
})();

function renderAll() {
  renderClock();
  renderTimeline();
  renderActiveFeed();
  renderInboxMirror();
  renderStats();
  renderCountdown();
  renderTeamRoles();
  renderActionQueue();
  renderInjectFocus();
  renderObserverStrip();
  renderKIAPanel();
}

// v0.2.9: Observer strip — a persistent reminder at the top of the trainer
// screen that shows which inject the observer is grading right now and
// what they're watching for. Falls back to the most recently fired inject
// if nothing is explicitly focused. Hidden if the strip is collapsed.
let observerStripCollapsed = false;

function observerStripPickInject() {
  const s = Engine.getState();
  // 1. Explicit focus wins
  if (focusedInjectId) {
    const inj = s.injects.find(i => i.id === focusedInjectId);
    if (inj) return inj;
  }
  // 2. Otherwise: most recently fired inject (by schedule order)
  const fired = s.injects.filter(i => s.fired.has(i.id));
  if (fired.length > 0) {
    return fired[fired.length - 1];
  }
  // 3. Nothing fired yet — show the next upcoming inject as a heads-up
  const upcoming = s.injects.find(i => !s.fired.has(i.id));
  return upcoming || null;
}

function renderObserverStrip() {
  const strip = document.getElementById('observer-strip');
  const injectLabel = document.getElementById('observer-strip-inject');
  const noteLabel = document.getElementById('observer-strip-note');
  if (!strip || !injectLabel || !noteLabel) return;

  if (observerStripCollapsed) {
    strip.classList.add('collapsed');
    return;
  }
  strip.classList.remove('collapsed');

  const inj = observerStripPickInject();
  if (!inj) {
    injectLabel.textContent = '—';
    noteLabel.textContent = 'Pick an inject or wait for the next fire to see what the observer is grading.';
    strip.classList.remove('focused', 'live', 'upcoming');
    strip.classList.add('quiet');
    return;
  }

  const s = Engine.getState();
  const isLive = s.fired.has(inj.id);
  const isFocused = inj.id === focusedInjectId;
  const status = Engine.getInjectStatus ? Engine.getInjectStatus(inj.id) : null;
  strip.classList.remove('quiet', 'focused', 'live', 'upcoming', 'status-complete', 'status-incomplete');
  if (isFocused) strip.classList.add('focused');
  else if (isLive) strip.classList.add('live');
  else strip.classList.add('upcoming');
  if (status === 'complete') strip.classList.add('status-complete');
  else if (status === 'incomplete') strip.classList.add('status-incomplete');

  const stateTag = isFocused ? 'FOCUS' : (isLive ? 'LIVE' : 'NEXT');
  const statusBadge = status
    ? `<span class="observer-strip-status ${status}">${status === 'complete' ? '✓ COMPLETE' : '✗ INCOMPLETE'}</span>`
    : '';
  injectLabel.innerHTML = `<span class="observer-strip-state">${stateTag}</span> ${esc(inj.id)} · ${esc(inj.title || '')} ${statusBadge}`;
  noteLabel.textContent = inj.observer_note || 'No observer note authored for this inject yet.';
}

// v0.2.8: Role assignments panel — shows every roster member with a role
// dropdown so the trainer can tag each student as CCO / ACO / Team Lead /
// Commander / SEL / Flight Chief. Role changes dispatch engine events so
// student + inspector views re-render and leadership-tagged inbox items get
// re-stamped to reflect the new fall-through primary.
function rosterStudents() {
  const s = Engine.getState();
  return (s.config && (s.config.students || s.config.roster)) || [];
}

function findStudent(id) {
  return rosterStudents().find(s => s.id === id);
}

// Role key -> display label
const ROLE_LABELS = {
  cco:          'CCO',
  aco:          'ACO',
  team_lead:    'Team Lead',
  commander:    'Commander',
  sel:          'SEL',
  flight_chief: 'Flight Chief'
};
// Display order for the dropdown (workers first, then leadership top-down)
const ROLE_ORDER = ['cco', 'aco', 'team_lead', 'flight_chief', 'sel', 'commander'];

function renderTeamRoles() {
  const container = document.getElementById('team-roles-list');
  if (!container) return;
  const tr = Engine.getTeamRoles();
  const assignments = (tr && tr.assignments) || {};
  const students = rosterStudents();

  // Leadership coverage summary — which leadership slots are filled?
  const leadershipCoverage = Engine.LEADERSHIP_ROLES.map(role => {
    const holders = Engine.getStudentsWithRole(role);
    return { role, filled: holders.length > 0, holders };
  });
  const primary = Engine.getLeadershipPrimary();
  const primaryStudent = primary ? findStudent(primary) : null;

  const teamLeadHolders = Engine.getStudentsWithRole('team_lead');
  const teamLeadMissing = teamLeadHolders.length === 0;

  const coverageHtml = `
    <div class="leadership-summary">
      <div class="leadership-summary-head">
        Leadership fall-through
        ${primaryStudent
          ? `<span class="leadership-primary">→ <strong>${esc(primaryStudent.name)}</strong> (${esc(ROLE_LABELS[assignments[primary]] || '')})</span>`
          : `<span class="leadership-primary none">→ none — leadership injects will broadcast</span>`}
      </div>
      <div class="leadership-chain">
        ${leadershipCoverage.map(c => `
          <span class="chain-link ${c.filled ? 'filled' : 'empty'}">
            ${c.filled ? '●' : '○'} ${esc(ROLE_LABELS[c.role])}
          </span>
        `).join('<span class="chain-sep">›</span>')}
      </div>
      ${teamLeadMissing
        ? `<div class="leadership-warn">⚠ Team Lead not assigned — minimum floor not met.</div>`
        : ''}
    </div>
  `;

  // Per-student rows
  const optionsHtml = ['<option value="">— unassigned —</option>']
    .concat(ROLE_ORDER.map(r => `<option value="${r}">${esc(ROLE_LABELS[r])}</option>`))
    .join('');

  const rowHtml = students.length === 0
    ? `<div class="muted text-center" style="padding: 14px 8px; font-size: 11px;">
         No roster loaded. Run STARTEX first.
       </div>`
    : students.map(st => {
        const current = assignments[st.id] || '';
        const selectOpts = optionsHtml.replace(
          `value="${current}"`,
          `value="${current}" selected`
        );
        const roleLabel = current ? ROLE_LABELS[current] : 'Unassigned';
        const isLeader = current && Engine.LEADERSHIP_ROLES.indexOf(current) !== -1;
        const isPrimary = primary === st.id;
        return `
          <div class="role-row ${current ? '' : 'unfilled'} ${isLeader ? 'leader' : ''} ${isPrimary ? 'primary' : ''}">
            <div class="role-row-label">${esc(st.name)}</div>
            <div class="role-row-body">
              ${current
                ? `<div class="role-name">${esc(roleLabel)}${isPrimary ? ' · <strong>primary</strong>' : ''}</div>`
                : `<div class="role-unassigned">Pick a role</div>`}
            </div>
            <select data-student="${esc(st.id)}">${selectOpts}</select>
          </div>
        `;
      }).join('');

  container.innerHTML = coverageHtml + rowHtml;

  // Wire change handlers
  container.querySelectorAll('select[data-student]').forEach(sel => {
    sel.addEventListener('change', () => {
      Engine.assignRole(sel.dataset.student, sel.value || null);
      renderAll();
    });
  });
}

function renderClock() {
  const now = Engine.getExerciseTime();
  document.getElementById('exercise-clock').textContent = now.displayString;
  document.getElementById('stat-day').textContent = `${now.day} / 4`;
}

function renderStats() {
  const s = Engine.getState();
  const now = Engine.getExerciseTime();
  document.getElementById('stat-fired').textContent = `${s.fired.size} / ${s.injects.length}`;
  document.getElementById('stat-flagged').textContent = s.flagged.length;

  // Active count
  const active = s.injects.filter(i => {
    if (!s.fired.has(i.id)) return false;
    const tMin = triggerMin(i);
    const end = tMin + (i.duration_minutes || 30);
    return now.totalMinutes < end;
  });
  document.getElementById('stat-active').textContent = active.length;

  // Pace
  const paceEl = document.getElementById('stat-pace');
  if (s.paused) {
    paceEl.textContent = 'Paused';
    paceEl.style.color = 'var(--warn)';
  } else {
    paceEl.textContent = 'On track';
    paceEl.style.color = 'var(--good)';
  }
}

function renderTimeline() {
  const s = Engine.getState();
  const now = Engine.getExerciseTime();
  const container = document.getElementById('timeline');

  if (s.injects.length === 0) {
    container.innerHTML = '<div class="muted text-center" style="padding: 32px 16px; font-size: 12px;">No injects loaded</div>';
    return;
  }

  const sorted = [...s.injects].sort((a, b) => triggerMin(a) - triggerMin(b));

  container.innerHTML = sorted.map(inj => {
    const tMin = triggerMin(inj);
    const fired = s.fired.has(inj.id);
    const endMin = tMin + (inj.duration_minutes || 30);
    const isActive = fired && now.totalMinutes < endMin;
    const isPast = fired && now.totalMinutes >= endMin;
    const diff = tMin - now.totalMinutes;

    let cls = 'queued';
    if (isPast) cls = 'past';
    else if (isActive) cls = 'live';
    else if (diff >= 0 && diff <= 30) cls = 'next';

    const tMinForDisplay = tMin;
    const dispDay = Math.floor(tMinForDisplay / 1440) + 1;
    const dispMin = tMinForDisplay % 1440;
    const dispHour = Math.floor(dispMin / 60);
    const dispMinute = dispMin % 60;
    return `
      <div class="timeline-item ${cls}" data-id="${inj.id}">
        <div class="timeline-time">${pad(dispHour)}:${pad(dispMinute)}</div>
        <div class="timeline-content">
          <div class="timeline-id">${inj.id} · D${dispDay}</div>
          <div class="timeline-title">${esc(inj.title)}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.timeline-item').forEach(el => {
    el.addEventListener('click', () => {
      const inj = s.injects.find(i => i.id === el.dataset.id);
      if (inj) {
        setFocusedInject(inj.id);
      }
    });
    el.addEventListener('dblclick', () => {
      const inj = s.injects.find(i => i.id === el.dataset.id);
      if (inj) showInjectDetail(inj);
    });
  });
}

function renderActiveFeed() {
  const s = Engine.getState();
  const now = Engine.getExerciseTime();
  const container = document.getElementById('active-feed');

  const active = s.injects.filter(i => {
    if (!s.fired.has(i.id)) return false;
    const tMin = triggerMin(i);
    const end = tMin + (i.duration_minutes || 30);
    return now.totalMinutes < end;
  });

  document.getElementById('active-count').textContent =
    active.length === 0 ? 'No active injects' :
    active.length === 1 ? '1 inject active' :
    `${active.length} injects active`;

  if (active.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5"/><path d="M24 14v10l6 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div class="empty-state-title">No active injects</div>
        <div class="empty-state-desc">The next inject will fire on schedule.</div>
      </div>
    `;
    return;
  }

  // v0.2.9 (post-pivot): the Active Feed card is now a minimal strip —
  // just the inject ID + title and a two-state Complete / Incomplete flag.
  // The detailed content (expected actions, teaching point, wrong answers,
  // what-really-happened, flag-for-hotwash) is still reachable from the
  // Inject Focus panel and the modal launched by double-clicking a
  // timeline row. Keeping the active feed terse frees the trainer to
  // focus on the *conversation*, not the card. The status toggle syncs
  // via Engine.markInjectStatus so the observer view sees it too.
  container.innerHTML = active.map(inj => {
    const status = Engine.getInjectStatus ? Engine.getInjectStatus(inj.id) : null;
    const cardCls = status ? `inject-card inject-card-slim status-${status}` : 'inject-card inject-card-slim';
    return `
    <div class="${cardCls}" data-id="${esc(inj.id)}">
      <div class="inject-card-slim-row">
        <div class="inject-card-slim-meta">
          <span class="inject-card-slim-id">${esc(inj.id)}</span>
          <span class="inject-card-slim-title">${esc(inj.title)}</span>
        </div>
        <div class="inject-card-slim-actions">
          <button class="status-btn complete ${status === 'complete' ? 'active' : ''}"
                  data-status-id="${esc(inj.id)}" data-status-val="complete"
                  title="Mark complete">
            ✓ Complete
          </button>
          <button class="status-btn incomplete ${status === 'incomplete' ? 'active' : ''}"
                  data-status-id="${esc(inj.id)}" data-status-val="incomplete"
                  title="Mark incomplete">
            ✗ Incomplete
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  // Clicking a status button toggles the state on the engine, which
  // persists + dispatches engine:inject-status (observer listens).
  container.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.statusId;
      const val = btn.dataset.statusVal;
      const cur = Engine.getInjectStatus(id);
      // Click the already-active button to clear the flag.
      Engine.markInjectStatus(id, cur === val ? null : val);
      renderActiveFeed();
      renderObserverStrip();
    });
  });

  // Clicking the card body (anywhere that isn't a status button) focuses
  // this inject in the Inject Focus panel so the quick-fire buttons update.
  container.querySelectorAll('.inject-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.status-btn')) return;
      if (card.dataset.id) setFocusedInject(card.dataset.id);
    });
  });
}

function renderCountdown() {
  const s = Engine.getState();
  const now = Engine.getExerciseTime();
  const box = document.getElementById('countdown-box');

  const upcoming = s.injects
    .filter(i => !s.fired.has(i.id))
    .sort((a, b) => triggerMin(a) - triggerMin(b));

  if (upcoming.length === 0) {
    box.classList.add('hidden');
    return;
  }

  const next = upcoming[0];
  const tMin = triggerMin(next);
  const diffMin = tMin - now.totalMinutes;

  if (diffMin <= 0) {
    box.classList.add('hidden');
    return;
  }

  box.classList.remove('hidden');
  const totalSec = diffMin * 60 - Math.floor((s.clock.exerciseMs % 60000) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  document.getElementById('countdown-value').textContent =
    `${pad(h)}:${pad(m)}:${pad(sec)}`;
  document.getElementById('countdown-next').textContent = `${next.id} · ${next.title}`;
}

function renderInboxMirror() {
  const s = Engine.getState();
  const container = document.getElementById('inbox-mirror');
  document.getElementById('inbox-count').textContent = s.inbox.length;

  if (s.inbox.length === 0) {
    container.innerHTML = '<div class="muted text-center" style="padding: 20px; font-size: 11px;">Empty</div>';
    return;
  }

  container.innerHTML = s.inbox.slice(0, 5).map(m => `
    <div class="inbox-mirror-item ${m.unread ? 'unread' : ''}" data-id="${m.id}">
      <div class="inbox-mirror-from">${esc(m.from)}</div>
      <div class="inbox-mirror-subject">${esc(m.subject)}</div>
    </div>
  `).join('');
}

// ----- Action handlers -----

function handleInjectAction(action, inj) {
  switch (action) {
    case 'expected': showExpectedActions(inj); break;
    case 'phone': showPhoneScript(inj); break;
    case 'teaching': showTeachingPoint(inj); break;
    case 'wrong': showWrongAnswers(inj); break;
    case 'real': showWhatReallyHappened(inj); break;
    case 'flag':
      Engine.flagForHotwash(inj.id, '');
      renderStats();
      showToast(`Flagged ${inj.id}`);
      break;
  }
}

function handleWhiteCellAction(action) {
  switch (action) {
    case 'sms':
      showCustomSmsModal();
      break;
    case 'email':
      showModal('Send email', '<p class="muted">Custom email composer coming in v0.3. For now, emails fire from scheduled injects.</p>');
      break;
    case 'call':
      showModal('Place customer call', '<p class="muted">Placeholder. In the full version this fires a scripted phone call inject.</p>');
      break;
    case 'doc':
      showModal('Push supporting document', '<p class="muted">Supporting document library coming in v0.3.</p>');
      break;
    case 'curveball':
      showModal('Fire curveball', '<p class="muted">Curveball inject library coming in v0.3.</p>');
      break;
    case 'flag':
      showModal('Flag for hotwash', '<p class="muted">Use the Flag button on an active inject card. This general flag is for atmospheric moments not tied to an inject.</p>');
      break;
  }
}

function showCustomSmsModal() {
  const contacts = Engine.getContacts().filter(c => !c.is_group);
  const html = `
    <h4>Send a custom SMS to the student phone</h4>
    <p>Tap a contact below, type your message, hit Send. The message lands on the phone immediately.</p>

    <div style="margin-top: 18px;">
      <label class="field-label" style="margin-bottom: 10px; display: block;">From — tap to select</label>
      <div class="contact-picker" id="contact-picker">
        ${contacts.map(c => `
          <button type="button" class="contact-card" data-value="${esc(c.id)}">
            <div class="contact-card-avatar" style="background: ${c.color};">${esc(c.initials)}</div>
            <div class="contact-card-text">
              <div class="contact-card-name">${esc(c.name)}</div>
              <div class="contact-card-title">${esc(c.title)}</div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>

    <div style="margin-top: 18px;">
      <label class="field-label" style="margin-bottom: 8px; display: block;">Message</label>
      <textarea id="sms-text" rows="3" placeholder="Type the message..." style="height: auto; padding: 12px;"></textarea>
    </div>

    <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: space-between; align-items: center;">
      <button class="btn btn-sm" id="sms-quick-test" title="Send a canned test message from Col Ramsey to verify the phone is receiving">
        ⚡ Quick test (Ramsey)
      </button>
      <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="send-sms-btn">Send SMS</button>
      </div>
    </div>
  `;
  showModal('White cell · Custom SMS', html);

  setTimeout(() => {
    let selectedContactId = null;

    document.querySelectorAll('.contact-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.contact-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedContactId = card.dataset.value;
      });
    });

    document.getElementById('send-sms-btn').addEventListener('click', () => {
      if (!selectedContactId) {
        showToast('Pick a contact first');
        return;
      }
      const msg = document.getElementById('sms-text').value.trim();
      if (!msg) {
        showToast('Type a message first');
        return;
      }
      Engine.sendCustomSms(selectedContactId, msg);
      closeModal();
      showToast('SMS sent to student phone');
    });

    document.getElementById('sms-quick-test').addEventListener('click', () => {
      Engine.sendCustomSms('ramsey', 'Where are you on that runway status?');
      closeModal();
      showToast('Test SMS sent — check the phone window');
    });
  }, 50);
}

// ----- v0.2.9: Action Queue + Inject Focus -----

// Pending student asks. An ask is any time a student hits "Send to trainer"
// from their mail detail reply box. Entries live in state.trainer_queue.
// This panel surfaces unhandled entries with a Reply button that opens
// the trainer reply composer.

// v0.2.9 (post-pivot): visible alert when a new student ask lands.
// Strategy:
//   1. Bump a count badge on the panel header (data-unread).
//   2. Add a .pulse class to the panel for ~2.5s (yellow flash in CSS).
//   3. Show a toast: "[Student name] is asking about [inject id]".
//   4. Play a short 'beep' via WebAudio so the trainer hears it even if
//      their attention is elsewhere — opt-in via <body data-sound="on">
//      so it can be silenced during demo capture.
// Badge is cleared when the trainer acts on the queue (reply or dismiss).
let actionQueueUnreadCount = 0;

function flashActionQueue(entry) {
  actionQueueUnreadCount += 1;
  // Find the panel that wraps the action queue so we can pulse it.
  const queue = document.getElementById('action-queue');
  const panel = queue ? queue.closest('.panel') : null;
  if (panel) {
    panel.classList.add('queue-pulse');
    setTimeout(() => panel.classList.remove('queue-pulse'), 2500);
  }
  // Update the unread badge on the count span.
  const countEl = document.getElementById('queue-count');
  if (countEl) {
    countEl.classList.add('has-unread');
    countEl.dataset.unread = actionQueueUnreadCount;
  }
  // Toast.
  const who = (entry && entry.personaName) || 'A student';
  const inj = entry && entry.injectId ? ` · ${entry.injectId}` : '';
  showToast(`📬 ${who} just sent you a message${inj}`);
  // Optional beep.
  try {
    if (document.body && document.body.dataset.sound === 'on') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 120);
    }
  } catch (_) { /* silent */ }
}

function clearActionQueueUnread() {
  actionQueueUnreadCount = 0;
  const countEl = document.getElementById('queue-count');
  if (countEl) {
    countEl.classList.remove('has-unread');
    delete countEl.dataset.unread;
  }
}

function renderActionQueue() {
  const container = document.getElementById('action-queue');
  if (!container) return;
  const queue = (Engine.getTrainerQueue ? Engine.getTrainerQueue() : []) || [];
  const pending = queue.filter(q => !q.handled);

  const countEl = document.getElementById('queue-count');
  if (countEl) countEl.textContent = pending.length;

  if (queue.length === 0) {
    container.innerHTML = '<div class="muted text-center" style="padding: 16px 8px; font-size: 11px;">Quiet. Student questions will land here.</div>';
    return;
  }

  // Render all, but collapse handled entries.
  container.innerHTML = queue.slice(0, 8).map(q => {
    const inj = Engine.getState().injects.find(i => i.id === q.injectId);
    const injLabel = inj ? `${inj.id} · ${inj.title}` : (q.injectId || '—');
    return `
      <div class="queue-item ${q.handled ? 'handled' : 'pending'}" data-id="${esc(q.id)}">
        <div class="queue-head">
          <div class="queue-from">${esc(q.personaName)}</div>
          <div class="queue-time">${esc(q.time)}</div>
        </div>
        <div class="queue-inject">${esc(injLabel)}</div>
        <div class="queue-body">${esc(q.body)}</div>
        ${q.handled
          ? `<div class="queue-handled-strip">✓ Handled ${q.handledAt ? `· ${esc(q.handledAt)}` : ''}</div>`
          : `<div class="queue-actions">
              <button class="btn btn-sm" data-queue-reply="${esc(q.id)}">Reply</button>
              <button class="btn btn-sm" data-queue-dismiss="${esc(q.id)}">Dismiss</button>
            </div>`}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-queue-reply]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearActionQueueUnread();
      openReplyComposer(btn.dataset.queueReply);
    });
  });
  container.querySelectorAll('[data-queue-dismiss]').forEach(btn => {
    btn.addEventListener('click', () => {
      Engine.markQueueHandled(btn.dataset.queueDismiss);
      clearActionQueueUnread();
      renderActionQueue();
    });
  });
}

function openReplyComposer(queueEntryId) {
  const queue = Engine.getTrainerQueue();
  const entry = queue.find(q => q.id === queueEntryId);
  if (!entry) return;
  const s = Engine.getState();
  const inj = s.injects.find(i => i.id === entry.injectId);

  // Detect if this is an SMS thread
  const isSms = entry.threadId && entry.threadId.startsWith('sms-');
  const smsContactId = isSms ? entry.threadId.replace(/^sms-/, '') : null;

  if (isSms) {
    // SMS-style composer — simple text reply that goes back into the phone thread
    const contact = smsContactId ? Engine.getContact(smsContactId) : null;
    const contactName = contact ? contact.name : smsContactId;

    // Build recent thread preview
    const thread = (s.smsThreads && s.smsThreads[smsContactId]) || [];
    const recent = thread.slice(-5);
    const threadHtml = recent.map(m => {
      const isOut = m.direction === 'out';
      const align = isOut ? 'right' : 'left';
      const bg = isOut ? '#DCF8C6' : '#e8e8e8';
      const color = '#222';
      return `<div style="text-align:${align};margin:4px 0;">
        <span style="display:inline-block;max-width:85%;padding:6px 10px;border-radius:12px;background:${bg};color:${color};font-size:12px;line-height:1.4;">${esc(m.text)}</span>
        <div style="font-size:9px;color:#999;margin-top:1px;">${m.time || ''}</div>
      </div>`;
    }).join('');

    const html = `
      <div class="reply-composer">
        <div class="reply-ctx">
          <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">SMS thread with ${esc(contactName)}</div>
          <div style="background:#f5f5f5;border-radius:8px;padding:10px;max-height:200px;overflow-y:auto;margin-bottom:12px;">
            ${threadHtml || '<div style="color:#999;font-size:11px;text-align:center;">No messages yet</div>'}
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:8px;"><strong>${esc(entry.personaName)}</strong> texted: "${esc(entry.body)}"</div>
        </div>
        <div class="reply-field">
          <label class="field-label">Reply as</label>
          <input type="text" id="reply-from" value="${esc(contactName)}" />
        </div>
        <div class="reply-field">
          <label class="field-label">Message</label>
          <textarea id="reply-body" rows="3" placeholder="Type a text message back..." style="font-size:14px;"></textarea>
        </div>
        <div class="reply-actions">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" id="reply-send">Send SMS</button>
        </div>
      </div>
    `;
    showModal('Text ' + contactName, html);

    setTimeout(() => {
      document.getElementById('reply-send').addEventListener('click', () => {
        const from = document.getElementById('reply-from').value;
        const body = document.getElementById('reply-body').value;
        if (!body.trim()) { showToast('Message is empty'); return; }
        Engine.trainerReply({
          queueEntryId: entry.id,
          toPersonaId: entry.personaId,
          kind: 'sms',
          contactId: smsContactId,
          from, body,
          threadId: entry.threadId
        });
        closeModal();
        showToast('SMS sent as ' + from);
        renderAll();
      });
    }, 50);
    return;
  }

  // Email composer (original path)
  // Preload quick-fire templates for this inject (authored or default fallback).
  const templates = quickFiresFor(inj);

  const html = `
    <div class="reply-composer">
      <div class="reply-ctx">
        <div><strong>${esc(entry.personaName)}</strong> asked:</div>
        <div class="reply-ctx-body">${esc(entry.body)}</div>
        ${inj ? `<div class="reply-ctx-inject">${esc(inj.id)} · ${esc(inj.title)}</div>` : ''}
      </div>

      ${templates.length > 0 ? `
        <div class="reply-templates">
          <div class="micro">Quick-fire templates</div>
          ${templates.map((t, idx) => `
            <button class="btn btn-sm reply-tpl-btn" data-idx="${idx}">${esc(t.label || ('Template ' + (idx+1)))}</button>
          `).join('')}
        </div>
      ` : ''}

      <div class="reply-field">
        <label class="field-label">Subject</label>
        <input type="text" id="reply-subject" value="Re: ${esc(entry.subject)}" />
      </div>
      <div class="reply-field">
        <label class="field-label">From</label>
        <input type="text" id="reply-from" value="White Cell" />
      </div>
      <div class="reply-field">
        <label class="field-label">Body</label>
        <textarea id="reply-body" rows="6" placeholder="Type the reply that lands in ${esc(entry.personaName)}'s inbox..."></textarea>
      </div>
      <div class="reply-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="reply-send">Send to ${esc(entry.personaName)}</button>
      </div>
    </div>
  `;
  showModal('Reply to ' + entry.personaName, html);

  // Wire template buttons
  setTimeout(() => {
    document.querySelectorAll('.reply-tpl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = templates[parseInt(btn.dataset.idx, 10)];
        if (!t) return;
        const subjEl = document.getElementById('reply-subject');
        const fromEl = document.getElementById('reply-from');
        const bodyEl = document.getElementById('reply-body');
        if (t.subject && subjEl) subjEl.value = t.subject;
        if (t.from && fromEl) fromEl.value = t.from;
        if (t.body && bodyEl) bodyEl.value = t.body;
      });
    });

    document.getElementById('reply-send').addEventListener('click', () => {
      const subject = document.getElementById('reply-subject').value;
      const from = document.getElementById('reply-from').value;
      const body = document.getElementById('reply-body').value;
      if (!body.trim()) { showToast('Body is empty'); return; }
      Engine.trainerReply({
        queueEntryId: entry.id,
        toPersonaId: entry.personaId,
        subject, from, body,
        injectId: entry.injectId,
        threadId: entry.threadId
      });
      closeModal();
      showToast('Reply sent to ' + entry.personaName);
      renderAll();
    });
  }, 50);
}

// Inject Focus panel — shows the currently-focused inject's quick-fire
// template buttons. Clicking a button opens a broadcast-reply composer
// that lets the trainer pick a recipient (any persona) and fire the
// template. For un-focused state, shows a prompt.
function setFocusedInject(injectId) {
  focusedInjectId = injectId;
  renderInjectFocus();
  renderObserverStrip();
}

function renderInjectFocus() {
  const body = document.getElementById('focus-body');
  const title = document.getElementById('focus-title');
  if (!body || !title) return;

  if (!focusedInjectId) {
    title.textContent = 'Pick an inject';
    body.innerHTML = '<div class="muted text-center" style="padding: 16px 8px; font-size: 11px;">Click an inject in the timeline or active feed to load its quick-fire options here.</div>';
    return;
  }
  const s = Engine.getState();
  const inj = s.injects.find(i => i.id === focusedInjectId);
  if (!inj) {
    title.textContent = 'Inject not found';
    body.innerHTML = '';
    return;
  }
  title.textContent = `${inj.id} · ${inj.title}`;

  const fires = quickFiresFor(inj);
  const observerNote = inj.observer_note || null;
  const tagLabel = inj.role_tag ? inj.role_tag.toUpperCase() : 'BROADCAST';

  body.innerHTML = `
    <div class="focus-meta">
      <span class="focus-tag">${esc(tagLabel)}</span>
      ${s.fired.has(inj.id) ? '<span class="focus-live">● LIVE</span>' : '<span class="focus-queued">queued</span>'}
    </div>
    ${fires.length > 0 ? `
      <div class="focus-fires">
        ${fires.map((t, idx) => `
          <button class="btn fire-btn" data-fire-idx="${idx}">
            ${esc(t.label || 'Template ' + (idx+1))}
          </button>
        `).join('')}
      </div>
    ` : `
      <div class="muted" style="padding: 8px 4px; font-size: 11px;">
        No quick-fire templates defined for this inject. Add <code>quick_fires</code> to the inject in the content bundle.
      </div>
    `}
    <div class="focus-expected">
      <div class="micro">Expected actions</div>
      <ul>
        ${(inj.expected_actions || []).slice(0,4).map(a => `<li>${esc(a.description || '')}</li>`).join('')}
        ${(inj.expected_actions || []).length === 0 ? '<li class="muted">—</li>' : ''}
      </ul>
    </div>
    ${observerNote ? `
      <div class="focus-observer">
        <div class="micro">Observer watch-for</div>
        <p>${esc(observerNote)}</p>
      </div>
    ` : ''}
  `;

  body.querySelectorAll('.fire-btn').forEach(btn => {
    btn.addEventListener('click', () => openFireTemplate(inj, fires[parseInt(btn.dataset.fireIdx, 10)]));
  });
}

function openFireTemplate(inj, tpl) {
  if (!tpl) return;
  const roster = rosterStudents();
  const html = `
    <div class="reply-composer">
      <div class="reply-ctx">
        <div><strong>${esc(inj.id)}</strong> — fire: <em>${esc(tpl.label || '')}</em></div>
      </div>
      <div class="reply-field">
        <label class="field-label">Send to</label>
        <select id="fire-recipient">
          <option value="">— pick a student —</option>
          ${roster.map(st => `<option value="${esc(st.id)}">${esc(st.name)}</option>`).join('')}
        </select>
      </div>
      <div class="reply-field">
        <label class="field-label">Subject</label>
        <input type="text" id="fire-subject" value="${esc(tpl.subject || inj.title || '')}" />
      </div>
      <div class="reply-field">
        <label class="field-label">From</label>
        <input type="text" id="fire-from" value="${esc(tpl.from || 'White Cell')}" />
      </div>
      <div class="reply-field">
        <label class="field-label">Body</label>
        <textarea id="fire-body" rows="6">${esc(tpl.body || '')}</textarea>
      </div>
      <div class="reply-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="fire-send">Fire</button>
      </div>
    </div>
  `;
  showModal(`Fire: ${tpl.label || 'template'}`, html);
  setTimeout(() => {
    document.getElementById('fire-send').addEventListener('click', () => {
      const to = document.getElementById('fire-recipient').value;
      if (!to) { showToast('Pick a recipient'); return; }
      Engine.trainerReply({
        toPersonaId: to,
        subject: document.getElementById('fire-subject').value,
        from: document.getElementById('fire-from').value,
        body: document.getElementById('fire-body').value,
        injectId: inj.id
      });
      closeModal();
      showToast('Fired');
      renderAll();
    });
  }, 50);
}

// ----- Modal content builders -----

function showInjectDetail(inj) {
  showModal(`${inj.id} · ${inj.title}`, `
    <h4>Description</h4>
    <p>${esc(inj.description)}</p>
    <h4>Scenario for students</h4>
    <p>${esc(inj.scenario_for_students || '—')}</p>
    <h4>Duration</h4>
    <p class="mono">${inj.duration_minutes || 30} min window</p>
    <h4>TLOs covered</h4>
    <ul>${(inj.tlo || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
  `);
}

function showExpectedActions(inj) {
  const actions = inj.expected_actions || [];
  showModal(`${inj.id} · Expected actions`, `
    <h4>What a competent CCO should do</h4>
    <ul>
      ${actions.map(a => `
        <li>
          <strong>${esc(a.description)}</strong>
          ${a.priority ? `<div class="mono" style="font-size: 10px; color: var(--text-tertiary); margin-top: 4px; letter-spacing: 0.1em; text-transform: uppercase;">${esc(a.priority)} · ${a.objective ? 'objective' : 'subjective'}</div>` : ''}
          ${a.notes ? `<div style="margin-top: 6px; font-size: 12px; color: var(--warn);">${esc(a.notes)}</div>` : ''}
        </li>
      `).join('')}
    </ul>
    ${inj.trainer_prompts ? `
      <h4>Trainer prompts</h4>
      <ul>${inj.trainer_prompts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    ` : ''}
  `);
}

async function showPhoneScript(inj) {
  const script = await Engine.loadPhoneScript(inj.phone_script_id);
  if (!script) {
    showModal('Phone script', '<p class="muted">Not found.</p>');
    return;
  }

  let html = `
    <h4>Caller</h4>
    <p><strong>${esc(script.caller)}</strong></p>
    <p style="font-size: 12px; color: var(--text-secondary);">${esc(script.caller_context)}</p>

    <h4>Delivery notes</h4>
    <div class="script-note">${esc(script.delivery_notes)}</div>

    <h4>Opening</h4>
    <div class="script-block">
      <div class="script-speaker">${esc(script.opening.speaker)}</div>
      <div class="script-line">"${esc(script.opening.line)}"</div>
    </div>

    <h4>Main brief — read in order</h4>
    ${script.main_brief.map(b => `
      <div class="script-block">
        <div class="script-speaker">${esc(b.speaker)}</div>
        <div class="script-line">"${esc(b.line)}"</div>
      </div>
    `).join('')}
  `;

  if (script.branches && script.branches.length > 0) {
    html += `<h4>Branching responses</h4>`;
    script.branches.forEach(b => {
      html += `
        <div class="script-note">IF: ${esc(b.trigger)}</div>
        <div class="script-block">
          <div class="script-speaker">${esc(b.response.speaker)}</div>
          <div class="script-line">"${esc(b.response.line)}"</div>
        </div>
        ${b.response.post_note ? `<p style="font-size: 11px; color: var(--text-tertiary); margin-top: 6px; padding-left: 14px;">Note: ${esc(b.response.post_note)}</p>` : ''}
      `;
    });
  }

  html += `
    <h4>Closing</h4>
    <div class="script-block">
      <div class="script-speaker">${esc(script.closing.speaker)}</div>
      <div class="script-line">"${esc(script.closing.line)}"</div>
    </div>
  `;

  if (script.post_call_trainer_checklist) {
    html += `
      <h4>After the call — trainer checklist</h4>
      <ul>${script.post_call_trainer_checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    `;
  }

  showModal(`${inj.id} · Phone script`, html);
}

function showTeachingPoint(inj) {
  showModal(`${inj.id} · Teaching point`, `
    <h4>The core lesson</h4>
    <p>${esc(inj.teaching_point || '—')}</p>
  `);
}

function showWrongAnswers(inj) {
  const wrongs = inj.wrong_answer_walkthroughs || [];
  showModal(`${inj.id} · Common wrong answers`, `
    <h4>Watch for these failure patterns</h4>
    ${wrongs.map(w => `
      <div style="margin-bottom: 16px; padding: 14px 16px; background: var(--alert-bg); border: 1px solid var(--alert-line); border-radius: var(--r-md);">
        <div style="color: var(--alert); font-weight: 600; font-size: 13px; margin-bottom: 8px;">${esc(w.answer)}</div>
        <div style="font-size: 12px; color: var(--text-primary); margin-bottom: 6px;"><strong class="muted" style="font-weight: 500;">Consequence:</strong> ${esc(w.consequence)}</div>
        <div style="font-size: 12px; color: var(--good);"><strong class="muted" style="font-weight: 500; color: var(--text-tertiary);">Teaching moment:</strong> ${esc(w.teaching_moment)}</div>
      </div>
    `).join('')}
  `);
}

function showWhatReallyHappened(inj) {
  showModal(`${inj.id} · What really happened`, `
    <h4>The real-world basis for this inject</h4>
    <p>${esc(inj.what_really_happened || '—')}</p>
    <p style="margin-top: 20px; font-size: 12px; color: var(--text-tertiary); padding-top: 16px; border-top: 1px solid var(--line-faint);">Read this aloud to students during hotwash. This is the moment the training lands.</p>
  `);
}

// ----- Helpers -----

function showModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function updateStatusPill(status) {
  const pill = document.getElementById('status-pill');
  const text = document.getElementById('exercise-status');
  pill.classList.remove('live', 'active', 'ready');
  if (status === 'live') { pill.classList.add('live'); text.textContent = 'Exercise live'; }
  else if (status === 'paused') { pill.classList.add('active'); text.textContent = 'Paused'; }
  else if (status === 'endex') { text.textContent = 'ENDEX'; }
}

function showToast(msg) {
  console.log('[toast]', msg);
  // simple inline implementation
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid var(--accent-line);color:var(--accent);padding:12px 20px;border-radius:var(--r-md);font-size:13px;z-index:200;box-shadow:var(--shadow-pop);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// v0.2.7: prefer the engine's resolved trigger time (set once at startExercise
// so window-type injects have a concrete minute). Fall back to the declared
// absolute trigger for injects that don't have a resolved slot yet, and to
// the window's earliest edge for un-resolved window triggers.
function triggerMin(inj) {
  const resolved = Engine.getResolvedTriggerMinutes
    ? Engine.getResolvedTriggerMinutes(inj.id)
    : null;
  if (resolved != null) return resolved;
  const t = inj.trigger || {};
  if (t.type === 'window') {
    return (t.day - 1) * 1440 + (t.earliest_hour || 8) * 60 + (t.earliest_minute || 0);
  }
  return (t.day - 1) * 1440 + (t.hour || 0) * 60 + (t.minute || 0);
}

// v0.2.7: human label that handles both trigger types gracefully.
function triggerDisplay(inj) {
  const tm = triggerMin(inj);
  const day = Math.floor(tm / 1440) + 1;
  const minInDay = tm % 1440;
  return `D${day} ${pad(Math.floor(minInDay / 60))}:${pad(minInDay % 60)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// expose for inline onclick
window.closeModal = closeModal;

/* ==========================================================================
   v0.2.14: KIA / ALARM RESPONSE PANEL
   Always-visible personnel status panel. Shows every player with a KILL
   button so white cell / observer can remove anyone at any time (e.g.
   someone carrying the team). Also shows alarm response tracking when
   an alarm is active.
   ========================================================================== */

let _kiaRefreshTimer = null;

function renderKIAPanel() {
  const panel = document.getElementById('kia-panel');
  const body = document.getElementById('kia-panel-body');
  if (!panel || !body) return;

  const s = Engine.getState();
  const responses = s.alarm_responses || {};
  const kiaRoster = s.kia_roster || {};
  const students = (s.config && s.config.students) || [];

  // Always show the panel once the exercise has students
  if (students.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  // Find the most recent alarm (if any)
  const alarmIds = Object.keys(responses);
  let latestAlarmId = null;
  let latestFired = 0;
  alarmIds.forEach(id => {
    const r = responses[id];
    if (r.firedAtWall > latestFired) { latestFired = r.firedAtWall; latestAlarmId = id; }
  });

  const nowWall = Date.now();
  const DEATH_MS = 240000; // 4 minutes

  let html = '';

  // Alarm banner (only if an alarm is active)
  if (latestAlarmId) {
    const alarm = responses[latestAlarmId];
    const elapsed = nowWall - alarm.firedAtWall;
    const elapsedStr = formatElapsed(elapsed);

    html += `<div style="padding:8px 12px;border-bottom:1px solid #2a0a0a;font-size:11px;color:#FF6B6B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:flex;justify-content:space-between;align-items:center;">
      <span>ALARM RED ACTIVE</span>
      <span style="font-family:monospace;color:#FFCDD2;">${elapsedStr} elapsed</span>
    </div>`;
  }

  // Build player rows — always shown
  students.forEach(st => {
    const isKIA = !!kiaRoster[st.id];
    const kiaInfo = kiaRoster[st.id];

    // Check alarm response if alarm is active
    const alarmResp = latestAlarmId && responses[latestAlarmId].responses
      ? responses[latestAlarmId].responses[st.id]
      : null;

    let statusColor, statusText, statusIcon, actions;

    if (isKIA) {
      if (kiaInfo.replacedBy) {
        statusColor = '#666';
        statusIcon = '&#x1F480;';
        statusText = `KIA — replaced by ${esc(kiaInfo.replacedBy)}`;
        actions = `<button class="kia-action-btn kia-revive" data-player="${esc(st.id)}" title="Undo KIA">Revive</button>`;
      } else {
        statusColor = '#FF1744';
        statusIcon = '&#x1F480;';
        statusText = 'KIA — awaiting replacement';
        actions = `
          <button class="kia-action-btn kia-replace" data-player="${esc(st.id)}" title="Assign replacement">Replace</button>
          <button class="kia-action-btn kia-revive" data-player="${esc(st.id)}" title="Undo KIA">Revive</button>
        `;
      }
    } else if (alarmResp && alarmResp.acked) {
      statusColor = '#4CAF50';
      statusIcon = '&#x2713;';
      statusText = `Ack'd alarm${alarmResp.ackedAtExercise ? ' @ ' + alarmResp.ackedAtExercise : ''}`;
      actions = `<button class="kia-action-btn kia-kill" data-player="${esc(st.id)}" title="Kill this player">Kill</button>`;
    } else if (alarmResp && alarmResp.dead) {
      statusColor = '#FF6B35';
      statusIcon = '&#x26A0;';
      statusText = 'Failed alarm response (4min)';
      actions = `<button class="kia-action-btn kia-mark" data-player="${esc(st.id)}" data-alarm="${esc(latestAlarmId)}" title="Mark as KIA">Mark KIA</button>`;
    } else if (latestAlarmId) {
      // Alarm active, no response yet
      const alarm = responses[latestAlarmId];
      const remaining = Math.max(0, DEATH_MS - (nowWall - alarm.firedAtWall));
      if (remaining > 0) {
        const remainStr = formatElapsed(remaining);
        statusColor = remaining < 60000 ? '#FF6B35' : '#FFC107';
        statusIcon = '&#x23F3;';
        statusText = `No response — ${remainStr} to KIA`;
      } else {
        statusColor = '#FF6B35';
        statusIcon = '&#x26A0;';
        statusText = 'Failed alarm response (4min)';
      }
      actions = `<button class="kia-action-btn kia-mark" data-player="${esc(st.id)}" data-alarm="${esc(latestAlarmId)}" title="Mark as KIA">Mark KIA</button>`;
    } else {
      // No alarm — normal state, just show a kill button
      statusColor = '#4CAF50';
      statusIcon = '&#x25CF;';
      statusText = 'Active';
      actions = `<button class="kia-action-btn kia-kill" data-player="${esc(st.id)}" title="Kill this player">Kill</button>`;
    }

    html += `
      <div class="kia-player-row" style="border-bottom:1px solid #1a0808;">
        <div class="kia-player-info">
          <span class="kia-player-dot" style="background:${st.color || '#888'};"></span>
          <span class="kia-player-name">${esc(st.name)}</span>
        </div>
        <div class="kia-player-status" style="color:${statusColor};">
          <span class="kia-status-icon">${statusIcon}</span>
          <span class="kia-status-text">${statusText}</span>
        </div>
        <div class="kia-player-actions">${actions || ''}</div>
      </div>
    `;
  });

  body.innerHTML = html;

  // Wire event handlers
  body.querySelectorAll('.kia-mark').forEach(btn => {
    btn.addEventListener('click', () => {
      Engine.markKIA(btn.dataset.player, btn.dataset.alarm);
      renderKIAPanel();
    });
  });

  body.querySelectorAll('.kia-kill').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.player;
      const st = students.find(s => s.id === pid);
      const confirmed = confirm(`Kill ${st ? st.name : pid}? Their screen will go black.`);
      if (confirmed) {
        Engine.markKIA(pid, null);
        renderKIAPanel();
      }
    });
  });

  body.querySelectorAll('.kia-revive').forEach(btn => {
    btn.addEventListener('click', () => {
      Engine.revivePlayer(btn.dataset.player);
      renderKIAPanel();
    });
  });

  body.querySelectorAll('.kia-replace').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.player;
      const st = students.find(s => s.id === pid);
      const name = prompt(`Enter replacement name for ${st ? st.name : pid}:`);
      if (name && name.trim()) {
        Engine.replacePlayer(pid, name.trim());
        renderKIAPanel();
      }
    });
  });

  // Auto-refresh every second while an alarm is active (for live countdown)
  if (latestAlarmId && !_kiaRefreshTimer) {
    _kiaRefreshTimer = setInterval(() => {
      const s2 = Engine.getState();
      const r2 = s2.alarm_responses || {};
      if (Object.keys(r2).length > 0) {
        renderKIAPanel();
      } else {
        clearInterval(_kiaRefreshTimer);
        _kiaRefreshTimer = null;
      }
    }, 1000);
  }
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Wire alarm response events
document.addEventListener('engine:alarm-response', renderKIAPanel);
document.addEventListener('engine:kia-updated', renderKIAPanel);
document.addEventListener('engine:sync', () => {
  Engine.outboxDrain();
  renderKIAPanel();
});
