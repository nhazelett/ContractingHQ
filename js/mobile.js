/* ==========================================================================
   MOBILE VIEW — phone PWA
   ========================================================================== */

// v0.2.7: load every inject present in the bundle (was hardcoded 2).
const MOBILE_INJECT_IDS = (window.__CCO_DATA && window.__CCO_DATA.injects)
  ? Object.keys(window.__CCO_DATA.injects)
  : ['IM-01', 'IM-02'];
let currentView = 'home';
let currentThreadContact = null;
let currentMailItem = null;

// v0.2.11: mobile kickoff waiting overlay. Sits over the phone screen until
// the trainer clicks Start Exercise.
function renderMobileKickoffBanner() {
  const phase = Engine.getPhase ? Engine.getPhase() : 'cold-open';
  let overlay = document.getElementById('mobile-kickoff-overlay');
  if (phase !== 'pre-exercise') {
    if (overlay) overlay.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-kickoff-overlay';
    overlay.className = 'mobile-kickoff-overlay';
    document.body.appendChild(overlay);
  }
  const code = (Engine.getSession && Engine.getSession()) || 'default';
  overlay.innerHTML = `
    <div class="mobile-kickoff-card">
      <div class="micro micro-accent">Waiting for kickoff</div>
      <div class="mobile-kickoff-title">Session ${code}</div>
      <div class="mobile-kickoff-sub">Stand by. Phone goes live when the trainer hits Start.</div>
      <div class="mobile-kickoff-pulse">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

(async function init() {
  const syncDot = document.getElementById('sync-dot');

  // Phone is a READ-ONLY consumer of state. Only the trainer ticks the clock.
  // This prevents races where the phone saves its own state over the trainer's.
  Engine.setReadOnly(true);

  // Load content — safe even if exercise not running yet
  await Engine.loadContacts();
  await Engine.loadInjects(MOBILE_INJECT_IDS);

  // Attempt to load existing state
  const hadState = Engine.loadState();
  Engine.enableSync();

  // v0.2.11: presence heartbeat so the trainer sees the phone joined.
  if (Engine.startPresence) {
    Engine.startPresence('phone:main', { role: 'phone', name: 'Phone' });
  }

  // v0.2.11: kickoff waiting overlay renders if phase === 'pre-exercise'.
  renderMobileKickoffBanner();
  document.addEventListener('engine:phase-changed', renderMobileKickoffBanner);

  // Set initial sync dot state
  if (syncDot) {
    if (hadState) {
      syncDot.classList.add('connected');
      syncDot.title = 'Connected to exercise (state loaded)';
    } else {
      syncDot.classList.add('error');
      syncDot.title = 'No exercise state found — start STARTEX on the trainer view first';
    }
  }

  // Initial render
  renderAll();

  // Listen to engine events
  document.addEventListener('engine:tick', renderClock);
  document.addEventListener('engine:sync', () => {
    if (syncDot) {
      syncDot.classList.remove('error');
      syncDot.classList.add('connected');
    }
    renderMobileKickoffBanner();
    renderAll();
  });
  document.addEventListener('engine:sms-received', (e) => {
    pulseSyncDot();
    renderAll();
    const contact = Engine.getContact(e.detail.contactId);
    if (contact) showPhoneToast(contact, e.detail.text);
  });
  document.addEventListener('engine:inject-fired', renderAll);
  document.addEventListener('engine:inbox-updated', renderAll);
  document.addEventListener('engine:sms-updated', renderAll);

  // Wire navigation
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
  document.querySelectorAll('[data-back]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.back));
  });

  // Safety poll: re-read state every 1.5s as a backup to the storage event.
  // Track IDs of SMS we've already seen so we only toast for GENUINELY new ones.
  let lastSnapshot = '';
  const seenSmsIds = new Set();
  // Seed with whatever's already in state on load (don't toast for pre-existing messages)
  Object.values(Engine.getState().smsThreads || {}).forEach((arr) => {
    (arr || []).forEach((m) => seenSmsIds.add(m.id));
  });
  let lastInboxCount = (Engine.getState().inbox || []).length;

  setInterval(() => {
    try {
      const raw = Engine.getRawStateString ? Engine.getRawStateString() : null;
      if (!raw) return;
      if (raw === lastSnapshot) return;
      lastSnapshot = raw;
      Engine.loadState();

      // Find any SMS we haven't seen before
      const threads = Engine.getState().smsThreads || {};
      const newMessages = []; // { contactId, message }
      Object.entries(threads).forEach(([cid, msgs]) => {
        (msgs || []).forEach((m) => {
          if (m.direction === 'in' && !seenSmsIds.has(m.id)) {
            newMessages.push({ contactId: cid, message: m });
            seenSmsIds.add(m.id);
          }
        });
      });

      // Show a toast for the most recent new one
      if (newMessages.length > 0) {
        const latest = newMessages[newMessages.length - 1];
        const c = Engine.getContact(latest.contactId);
        if (c && latest.message && latest.message.text) {
          showPhoneToast(c, latest.message.text);
        }
        pulseSyncDot();
      }

      const newInboxCount = (Engine.getState().inbox || []).length;
      if (newInboxCount > lastInboxCount) {
        pulseSyncDot();
        lastInboxCount = newInboxCount;
      }

      if (syncDot) {
        syncDot.classList.remove('error');
        syncDot.classList.add('connected');
      }

      renderAll();
    } catch (e) { console.error('Poll error', e); }
  }, 1500);
})();

function countSms(threads) {
  let n = 0;
  Object.values(threads || {}).forEach((arr) => { n += (arr || []).length; });
  return n;
}

function pulseSyncDot() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  dot.classList.add('pulse');
  setTimeout(() => dot.classList.remove('pulse'), 400);
}

// ----- View switching -----

function switchView(view) {
  currentView = view;
  ['home', 'messages', 'thread', 'mail', 'mail-detail'].forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === view) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
  // Reset scroll to top of the visible view
  document.getElementById('phone-screen').scrollTop = 0;
  renderAll();
}

function openThread(contactId) {
  currentThreadContact = contactId;
  Engine.markSmsRead(contactId);
  renderAll();
  switchView('thread');
}

function openMail(itemId) {
  currentMailItem = itemId;
  Engine.markInboxRead(itemId);
  renderAll();
  switchView('mail-detail');
}

// ----- Rendering -----

function renderAll() {
  renderClock();
  renderBadges();
  renderNotifications();
  // Always render everything — cheap, and ensures we never show stale data
  // regardless of what view was current when the state changed.
  renderThreadList();
  if (currentView === 'thread') renderThread();
  renderMailList();
  if (currentView === 'mail-detail') renderMailDetail();
}

function renderClock() {
  const now = Engine.getExerciseTime();
  const s = Engine.getState();
  if (!s.clock.running) {
    document.getElementById('phone-time').textContent = '--:--';
    document.getElementById('home-day').textContent = 'Standby';
    return;
  }
  document.getElementById('phone-time').textContent = now.shortTime;
  document.getElementById('home-day').textContent = `Day ${now.day}`;
}

function renderBadges() {
  const s = Engine.getState();

  // SMS unread count across all threads
  let smsUnread = 0;
  Object.values(s.smsThreads || {}).forEach((arr) => {
    smsUnread += arr.filter((m) => m.unread && m.direction === 'in').length;
  });
  const smsBadge = document.getElementById('badge-messages');
  if (smsUnread > 0) {
    smsBadge.textContent = smsUnread;
    smsBadge.classList.remove('hidden');
  } else {
    smsBadge.classList.add('hidden');
  }

  // Mail unread
  const mailUnread = (s.inbox || []).filter((m) => m.unread).length;
  const mailBadge = document.getElementById('badge-mail');
  if (mailUnread > 0) {
    mailBadge.textContent = mailUnread;
    mailBadge.classList.remove('hidden');
  } else {
    mailBadge.classList.add('hidden');
  }
}

function renderNotifications() {
  const s = Engine.getState();
  const container = document.getElementById('notif-list');

  // Build flat list of recent activity: SMS + mail, sorted by time (approximate via order)
  const items = [];

  // Mail items (already ordered newest first by the engine)
  (s.inbox || []).slice(0, 4).forEach((m) => {
    items.push({
      type: 'mail',
      id: m.id,
      name: m.from,
      time: m.time,
      text: m.subject,
      color: '#4FC3D7',
      initials: initialsFromName(m.from),
    });
  });

  // SMS items — take the latest 1 per thread
  Object.entries(s.smsThreads || {}).forEach(([contactId, msgs]) => {
    if (!msgs || msgs.length === 0) return;
    const contact = Engine.getContact(contactId);
    if (!contact) return;
    const latest = msgs[msgs.length - 1];
    items.push({
      type: 'sms',
      id: `thread-${contactId}`,
      contactId: contactId,
      name: contact.name,
      time: latest.time,
      text: latest.text,
      color: contact.color,
      initials: contact.initials,
    });
  });

  if (items.length === 0) {
    container.innerHTML = '<div class="notif-empty">No notifications yet.<br>Exercise will push here as it runs.</div>';
    return;
  }

  // Show most recent first — SMS first since it's more urgent/immediate
  const sms = items.filter((i) => i.type === 'sms');
  const mail = items.filter((i) => i.type === 'mail');
  const ordered = [...sms, ...mail].slice(0, 6);

  container.innerHTML = ordered
    .map(
      (n) => `
    <div class="notif-card" data-type="${n.type}" data-id="${esc(n.id)}" data-contact="${esc(n.contactId || '')}">
      <div class="notif-card-icon" style="background: ${n.color};">${esc(n.initials)}</div>
      <div class="notif-card-content">
        <div class="notif-card-head">
          <div class="notif-card-name">${esc(n.name)}</div>
          <div class="notif-card-time">${esc(n.time)}</div>
        </div>
        <div class="notif-card-text">${esc(n.text)}</div>
      </div>
    </div>
  `
    )
    .join('');

  container.querySelectorAll('.notif-card').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.type === 'sms') {
        openThread(el.dataset.contact);
      } else if (el.dataset.type === 'mail') {
        openMail(el.dataset.id);
      }
    });
  });
}

function renderThreadList() {
  const s = Engine.getState();
  const contacts = Engine.getContacts();
  const container = document.getElementById('thread-list');

  // Count total SMS across all threads for debug visibility
  let totalSms = 0;
  Object.values(s.smsThreads || {}).forEach((arr) => { totalSms += (arr || []).length; });

  // Only show contacts with at least one message
  const withMessages = contacts.filter((c) => s.smsThreads[c.id] && s.smsThreads[c.id].length > 0);

  const debugLine = `<div style="padding: 6px 16px; font-family: var(--font-mono); font-size: 9px; color: var(--text-tertiary); background: var(--bg-raised); border-bottom: 1px solid var(--line-faint);">DBG: ${totalSms} total SMS · ${withMessages.length} threads · ${contacts.length} contacts loaded</div>`;

  if (withMessages.length === 0) {
    container.innerHTML = debugLine + '<div class="thread-empty">No messages yet.<br>The phone will buzz when someone texts.</div>';
    return;
  }

  container.innerHTML = debugLine + withMessages
    .map((c) => {
      const msgs = s.smsThreads[c.id];
      const latest = msgs[msgs.length - 1];
      const unread = msgs.some((m) => m.unread && m.direction === 'in');
      return `
        <div class="thread-row ${unread ? 'unread' : ''}" data-contact="${c.id}">
          <div class="avatar-sm" style="background: ${c.color};">${esc(c.initials)}</div>
          <div class="thread-row-content">
            <div class="thread-row-head">
              <div class="thread-row-name">${esc(c.name)}</div>
              <div class="thread-row-time">${esc(latest.time)}</div>
            </div>
            <div class="thread-row-preview">${esc(latest.text)}</div>
          </div>
          <div class="thread-row-indicator"></div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.thread-row').forEach((el) => {
    el.addEventListener('click', () => openThread(el.dataset.contact));
  });
}

function renderThread() {
  if (!currentThreadContact) return;
  const s = Engine.getState();
  const contact = Engine.getContact(currentThreadContact);
  if (!contact) return;

  document.getElementById('thread-name').textContent = contact.name;
  document.getElementById('thread-title').textContent = contact.title || '';
  const avatar = document.getElementById('thread-avatar');
  avatar.textContent = contact.initials;
  avatar.style.background = contact.color;

  const msgs = s.smsThreads[currentThreadContact] || [];
  const body = document.getElementById('thread-body');

  if (msgs.length === 0) {
    body.innerHTML = '<div class="thread-empty">No messages yet.</div>';
    return;
  }

  // Group consecutive messages from the same direction
  let html = '';
  let lastTime = '';
  let groupOpen = false;

  msgs.forEach((m, idx) => {
    if (m.time !== lastTime) {
      if (groupOpen) {
        html += '</div>';
        groupOpen = false;
      }
      html += `<div class="bubble-time">${esc(m.time)}</div>`;
      lastTime = m.time;
    }
    if (!groupOpen) {
      html += `<div class="bubble-group">`;
      groupOpen = true;
    }
    html += `<div class="bubble ${m.direction}">${esc(m.text)}</div>`;
  });

  if (groupOpen) html += '</div>';

  body.innerHTML = html;

  // Scroll to bottom of thread
  setTimeout(() => {
    const screen = document.getElementById('phone-screen');
    screen.scrollTop = screen.scrollHeight;
  }, 50);

  // Wire reply composer (once). Routes through the outbox side channel.
  const sendBtn = document.getElementById('thread-reply-send');
  const input = document.getElementById('thread-reply-text');
  if (sendBtn && input && !sendBtn.dataset.wired) {
    sendBtn.dataset.wired = '1';
    const sendSms = () => {
      const text = (input.value || '').trim();
      if (!text) return;
      const c = Engine.getContact(currentThreadContact);
      if (!c) return;
      const out = Engine.studentSmsOut;
      if (!out) return;
      out({
        contactId: c.id,
        contactName: c.name,
        text,
        personaId: (typeof currentPersona !== 'undefined' && currentPersona) ? currentPersona.id : null,
        personaName: (typeof currentPersona !== 'undefined' && currentPersona) ? currentPersona.name : null
      });
      input.value = '';
      // Quick optimistic refresh — the engine will also fire engine:sync
      setTimeout(renderThread, 50);
    };
    sendBtn.addEventListener('click', sendSms);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        sendSms();
      }
    });
  }
}

function renderMailList() {
  const s = Engine.getState();
  const container = document.getElementById('mail-list');

  if (!s.inbox || s.inbox.length === 0) {
    container.innerHTML = '<div class="mail-empty">Inbox is empty.<br>Messages will arrive as the exercise runs.</div>';
    return;
  }

  container.innerHTML = s.inbox
    .map((m) => {
      const preview = (m.body || '').split('\n')[0].slice(0, 80);
      return `
        <div class="mail-row ${m.unread ? 'unread' : ''}" data-id="${esc(m.id)}">
          <div class="mail-row-head">
            <div class="mail-row-from">${esc(m.from)}</div>
            <div class="mail-row-time">${esc(m.time)}</div>
          </div>
          <div class="mail-row-subject">${esc(m.subject)}</div>
          <div class="mail-row-preview">${esc(preview)}</div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.mail-row').forEach((el) => {
    el.addEventListener('click', () => openMail(el.dataset.id));
  });
}

function renderMailDetail() {
  if (!currentMailItem) return;
  const s = Engine.getState();
  const m = (s.inbox || []).find((x) => x.id === currentMailItem);
  if (!m) return;

  document.getElementById('mail-detail').innerHTML = `
    <div class="mail-detail-subject">${esc(m.subject)}</div>
    <div class="mail-detail-meta">
      <div>
        <div class="mail-detail-from">${esc(m.from)}</div>
        ${m.fromEmail ? `<div class="mail-detail-from-email">${esc(m.fromEmail)}</div>` : ''}
      </div>
      <div class="mail-detail-time">${esc(m.time)}</div>
    </div>
    <div class="mail-detail-body">${esc(m.body)}</div>
  `;
}

// ----- Phone toast notification -----

let toastTimeout = null;

function showPhoneToast(contact, text) {
  const toast = document.getElementById('phone-toast');
  toast.classList.remove('hidden');
  document.getElementById('toast-name').textContent = contact.name;
  document.getElementById('toast-text').textContent = text;
  const icon = document.getElementById('toast-icon');
  icon.textContent = contact.initials;
  icon.style.background = contact.color;

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 4000);

  // Click toast opens the thread
  toast.onclick = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
    openThread(contact.id);
  };
  toast.style.pointerEvents = 'auto';
}

// ----- Helpers -----

function initialsFromName(name) {
  if (!name) return '?';
  const parts = name.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   DEBUG DRAWER — diagnostic panel for v0.2.5
   ========================================================================== */

const DebugDrawer = (function () {
  const MAX_LOG = 20;
  const eventLog = [];
  let visible = false;
  let autoRefreshTimer = null;

  function wallTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function logEvent(type, detail) {
    eventLog.unshift({ time: wallTime(), type, detail });
    if (eventLog.length > MAX_LOG) eventLog.pop();
    if (visible) renderLog();
  }

  function attach() {
    const fab = document.getElementById('debug-fab');
    const drawer = document.getElementById('debug-drawer');
    if (!fab || !drawer) return;

    fab.addEventListener('click', toggle);
    document.getElementById('debug-close').addEventListener('click', hide);
    document.getElementById('debug-reload').addEventListener('click', () => {
      Engine.loadState();
      renderAll();
      render();
      logEvent('manual:reload', 'operator tapped Reload state');
    });
    document.getElementById('debug-copy').addEventListener('click', copyJson);

    // Triple-tap the sync dot to toggle as an alt trigger
    const dot = document.getElementById('sync-dot');
    if (dot) {
      let taps = 0;
      let tapTimer = null;
      dot.addEventListener('click', () => {
        taps++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { taps = 0; }, 600);
        if (taps >= 3) { taps = 0; toggle(); }
      });
    }

    // Hook engine events for the log
    const hooks = [
      ['engine:tick', 'tick'],
      ['engine:sync', 'sync'],
      ['engine:sms-received', 'sms-received'],
      ['engine:sms-updated', 'sms-updated'],
      ['engine:inbox-updated', 'inbox-updated'],
      ['engine:inject-fired', 'inject-fired'],
    ];
    hooks.forEach(([evt, label]) => {
      document.addEventListener(evt, (e) => {
        // Skip tick noise in the log — it fires every second
        if (label === 'tick') return;
        let desc = '';
        if (e.detail) {
          if (e.detail.text) desc = `"${e.detail.text.slice(0, 60)}"`;
          else if (e.detail.id) desc = `id=${e.detail.id}`;
          else if (e.detail.contactId) desc = `contact=${e.detail.contactId}`;
          else if (typeof e.detail === 'object') desc = JSON.stringify(e.detail).slice(0, 80);
        }
        logEvent(label, desc);
      });
    });

    logEvent('init', `readOnly=${Engine.getState().readOnly === true}`);
  }

  function toggle() { visible ? hide() : show(); }
  function show() {
    document.getElementById('debug-drawer').classList.remove('hidden');
    visible = true;
    render();
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(render, 1000);
  }
  function hide() {
    document.getElementById('debug-drawer').classList.add('hidden');
    visible = false;
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  }

  function render() {
    const s = Engine.getState();
    const now = Engine.getExerciseTime();

    // Flags
    const ro = s.readOnly === true;
    const src = s._contentSource || 'none';
    const srcCls = src === 'inline' ? 'ok' : (src === 'fetch' ? 'v' : 'warn');
    const errCount = (s._loadErrors || []).length;
    document.getElementById('debug-flags').innerHTML =
      `<span class="k">readOnly</span>: <span class="${ro ? 'ok' : 'warn'}">${ro}</span>  ` +
      `<span class="k">running</span>: <span class="${s.clock.running ? 'ok' : 'warn'}">${s.clock.running}</span>  ` +
      `<span class="k">paused</span>: <span class="v">${s.paused}</span><br>` +
      `<span class="k">content source</span>: <span class="${srcCls}">${src}</span>  ` +
      `<span class="k">load errors</span>: <span class="${errCount ? 'warn' : 'ok'}">${errCount}</span>` +
      (errCount ? `<br><span class="warn">${esc((s._loadErrors[0] || {}).where)}: ${esc((s._loadErrors[0] || {}).msg)}</span>` : '');

    // Clock
    document.getElementById('debug-clock').innerHTML =
      `<span class="k">exercise</span>: <span class="v">${now.displayString}</span>  ` +
      `<span class="k">exerciseMs</span>: <span class="v">${s.clock.exerciseMs}</span><br>` +
      `<span class="k">ratio</span>: <span class="v">${s.clock.wallToExerciseRatio}x</span>  ` +
      `<span class="k">currentView</span>: <span class="v">${currentView}</span>`;

    // Counts
    let totalSms = 0;
    const threadCounts = {};
    Object.entries(s.smsThreads || {}).forEach(([cid, arr]) => {
      const n = (arr || []).length;
      totalSms += n;
      if (n > 0) threadCounts[cid] = n;
    });
    const contacts = Engine.getContacts() || [];
    const pending = (s._pendingSms || []).length;
    document.getElementById('debug-counts').innerHTML =
      `<span class="k">contacts</span>: <span class="v">${contacts.length}</span>  ` +
      `<span class="k">inbox</span>: <span class="v">${(s.inbox || []).length}</span>  ` +
      `<span class="k">sms total</span>: <span class="v">${totalSms}</span>  ` +
      `<span class="k">sms pending</span>: <span class="v">${pending}</span><br>` +
      `<span class="k">threads with msgs</span>: <span class="v">${JSON.stringify(threadCounts)}</span>  ` +
      `<span class="k">fired</span>: <span class="v">${s.fired.size || 0}</span>`;

    // Raw dumps
    document.getElementById('debug-sms').textContent =
      JSON.stringify(s.smsThreads || {}, null, 2);
    document.getElementById('debug-inbox').textContent =
      JSON.stringify(s.inbox || [], null, 2);

    // localStorage snapshot
    try {
      const raw = Engine.getRawStateString ? Engine.getRawStateString() : null;
      if (!raw) {
        document.getElementById('debug-ls').innerHTML =
          `<span class="warn">empty — trainer has not started STARTEX</span>`;
      } else {
        const parsed = JSON.parse(raw);
        const ts = parsed._lastUpdate ? new Date(parsed._lastUpdate) : null;
        const lsSms = parsed.smsThreads ? Object.values(parsed.smsThreads).reduce((n, a) => n + (a || []).length, 0) : 0;
        const lsInbox = (parsed.inbox || []).length;
        const age = ts ? ((Date.now() - ts.getTime()) / 1000).toFixed(1) + 's ago' : 'unknown';
        document.getElementById('debug-ls').innerHTML =
          `<span class="k">bytes</span>: <span class="v">${raw.length}</span>  ` +
          `<span class="k">last update</span>: <span class="v">${age}</span><br>` +
          `<span class="k">ls.smsThreads total</span>: <span class="v">${lsSms}</span>  ` +
          `<span class="k">ls.inbox</span>: <span class="v">${lsInbox}</span>  ` +
          `<span class="k">ls.fired</span>: <span class="v">${(parsed.fired || []).length}</span>`;
      }
    } catch (e) {
      document.getElementById('debug-ls').innerHTML = `<span class="warn">parse error: ${esc(String(e))}</span>`;
    }

    renderLog();
  }

  function renderLog() {
    const container = document.getElementById('debug-log');
    if (!container) return;
    if (eventLog.length === 0) {
      container.innerHTML = '<div class="debug-log-row"><div class="d" style="color:#7A8699;">(no events yet)</div></div>';
      return;
    }
    container.innerHTML = eventLog.map((e) => {
      const cls = e.type.startsWith('sms') ? 'evt-sms'
        : e.type.startsWith('inject') ? 'evt-inject'
        : e.type.startsWith('inbox') ? 'evt-inbox'
        : '';
      return `<div class="debug-log-row ${cls}">
        <div class="t">${esc(e.time)}</div>
        <div class="e">${esc(e.type)}</div>
        <div class="d">${esc(e.detail || '')}</div>
      </div>`;
    }).join('');
  }

  function copyJson() {
    const s = Engine.getState();
    const payload = {
      flags: { readOnly: s.readOnly === true, running: s.clock.running, paused: s.paused },
      clock: { exerciseMs: s.clock.exerciseMs, display: Engine.getExerciseTime().displayString },
      counts: {
        contacts: (Engine.getContacts() || []).length,
        inbox: (s.inbox || []).length,
        sms: Object.values(s.smsThreads || {}).reduce((n, a) => n + (a || []).length, 0),
        pending: (s._pendingSms || []).length,
      },
      inbox: s.inbox || [],
      smsThreads: s.smsThreads || {},
      eventLog: eventLog,
    };
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => logEvent('manual:copy', `${text.length} chars copied`))
        .catch((err) => logEvent('manual:copy', `failed: ${err.message}`));
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); logEvent('manual:copy', `${text.length} chars (legacy)`); }
      catch (e) { logEvent('manual:copy', 'failed'); }
      document.body.removeChild(ta);
    }
  }

  return { attach, logEvent, show, hide, toggle };
})();

// Attach on next tick so the Engine init above has finished
setTimeout(() => { try { DebugDrawer.attach(); } catch (e) { console.error('Debug drawer attach failed', e); } }, 0);

/* ==========================================================================
   ALARM SYSTEM (Mobile) — Giant Voice / kinetic inject fullscreen takeover
   Mirrors student.js alarm but takes over the phone PWA screen directly.
   ========================================================================== */
const mobileAlarmFired = new Set();
let mobileAlarmActive = false;
let mobileAlarmSirenPlaying = false;
let mobileAlarmCtx = null;
let mobileAlarmOsc = [];
let mobileAlarmSnoozeTimer = null;
let mobileAlarmCountdownTimer = null;
let mobileAlarmDeathTimer = null;
let mobileAlarmFiredAtWall = null;
const MOBILE_ALARM_SNOOZE_SEC = 60;  // silence between siren bursts
const MOBILE_ALARM_DEATH_SEC = 240;  // 4 minutes → KIA

function mobileStartSiren() {
  try {
    mobileAlarmCtx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = mobileAlarmCtx.createGain();
    gain.gain.setValueAtTime(0.55, mobileAlarmCtx.currentTime);
    gain.connect(mobileAlarmCtx.destination);

    const osc1 = mobileAlarmCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, mobileAlarmCtx.currentTime);
    osc1.connect(gain);
    osc1.start();

    const osc2 = mobileAlarmCtx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(444, mobileAlarmCtx.currentTime);
    const g2 = mobileAlarmCtx.createGain();
    g2.gain.setValueAtTime(0.15, mobileAlarmCtx.currentTime);
    osc2.connect(g2);
    g2.connect(gain);
    osc2.start();

    mobileAlarmOsc = [osc1, osc2];
    mobileAlarmSirenPlaying = true;

    function sweep() {
      if (!mobileAlarmSirenPlaying || !mobileAlarmCtx) return;
      const t = mobileAlarmCtx.currentTime;
      osc1.frequency.linearRampToValueAtTime(880, t + 1.5);
      osc1.frequency.linearRampToValueAtTime(440, t + 3.0);
      osc2.frequency.linearRampToValueAtTime(660, t + 1.5);
      osc2.frequency.linearRampToValueAtTime(444, t + 3.0);
      setTimeout(sweep, 3000);
    }
    sweep();

    // Vibrate on real phones — long pattern for siren duration
    try { if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500]); } catch (_) {}
  } catch (e) { console.warn('Mobile siren error:', e); }
}

function mobileStopSiren() {
  mobileAlarmSirenPlaying = false;
  mobileAlarmOsc.forEach(o => { try { o.stop(); } catch (_) {} });
  mobileAlarmOsc = [];
  if (mobileAlarmCtx) { try { mobileAlarmCtx.close(); } catch (_) {} mobileAlarmCtx = null; }
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (_) {}
}

function mobileAlarmIconSVG() {
  return `<svg viewBox="0 0 100 100" fill="none" style="width:80px;height:80px;">
    <polygon points="50,8 95,88 5,88" stroke="#FF1744" stroke-width="4" fill="rgba(255,23,68,0.15)"/>
    <text x="50" y="72" text-anchor="middle" fill="#FF1744" font-size="42" font-weight="900" font-family="sans-serif">!</text>
  </svg>`;
}

// Kick off the alarm loop for a given inject
function mobileShowAlarm(alarm, injectId) {
  if (mobileAlarmActive) return;
  mobileAlarmActive = true;

  // Stash config for snooze replays
  window._mobileAlarmConfig = { alarm, injectId };

  // Start the 4-minute death countdown
  mobileAlarmFiredAtWall = Date.now();
  if (mobileAlarmDeathTimer) clearTimeout(mobileAlarmDeathTimer);
  mobileAlarmDeathTimer = setTimeout(() => {
    if (!mobileAlarmActive) return;
    // Player dead — report via outbox
    const identity = Engine.readIdentityFromLocation ? Engine.readIdentityFromLocation() : null;
    const playerId = identity || 'unknown-mobile';
    Engine.alarmAckOut({
      alarmInjectId: injectId,
      playerId: playerId,
      acked: false,
      dead: true,
      firedAtWall: mobileAlarmFiredAtWall,
      deadAtWall: Date.now()
    });
    mobileShowKIAOverlay();
  }, MOBILE_ALARM_DEATH_SEC * 1000);

  // Start the first siren burst
  mobileAlarmStartBurst();
}

// Play one burst of siren + overlay, then snooze and repeat
function mobileAlarmStartBurst() {
  if (!mobileAlarmActive) return;
  const cfg = window._mobileAlarmConfig;
  if (!cfg) return;
  const { alarm } = cfg;

  const title = alarm.title || 'ALARM RED';
  const message = alarm.message || 'TAKE COVER IMMEDIATELY';
  const source = alarm.source || 'GIANT VOICE';
  const durationSec = alarm.duration_seconds || 20;

  // Remove any leftover overlay
  mobileAlarmClearVisuals();

  const overlay = document.createElement('div');
  overlay.id = 'mobile-alarm-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #1a0000; animation: mAlarmPulse 1s ease-in-out infinite;
    user-select: none; text-align: center; padding: 24px;
  `;
  overlay.innerHTML = `
    <style>
      @keyframes mAlarmPulse { 0%,100%{background:#1a0000} 50%{background:#4a0000} }
      @keyframes mAlarmFlash { 0%,100%{opacity:1} 50%{opacity:0.2} }
      @keyframes mAlarmText { 0%,100%{color:#FF1744} 50%{color:#FF6B6B} }
      @keyframes mBtnGlow { 0%,100%{box-shadow:0 0 15px rgba(255,23,68,0.3)} 50%{box-shadow:0 0 30px rgba(255,23,68,0.6)} }
    </style>
    ${mobileAlarmIconSVG().replace('style="width:80px;height:80px;"', 'style="width:80px;height:80px;margin-bottom:20px;animation:mAlarmFlash 0.6s step-end infinite;"')}
    <div style="font-size:32px;font-weight:900;color:#FF1744;letter-spacing:0.06em;text-transform:uppercase;text-shadow:0 0 40px rgba(255,23,68,0.6);margin-bottom:12px;animation:mAlarmText 0.8s step-end infinite;">${esc(title)}</div>
    <div style="font-size:16px;font-weight:600;color:#FFCDD2;line-height:1.5;margin-bottom:24px;white-space:pre-line;">${esc(message)}</div>
    <div style="font-size:11px;font-weight:700;color:rgba(255,205,210,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:28px;">${esc(source)}</div>
    <button id="mobile-alarm-ack" style="padding:14px 36px;background:rgba(255,23,68,0.2);border:2px solid #FF1744;border-radius:6px;color:#FFCDD2;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;animation:mBtnGlow 1.5s ease-in-out infinite;">&#x2714; Acknowledge</button>
    <div id="mobile-alarm-cd" style="margin-top:12px;font-family:monospace;font-size:12px;color:rgba(255,205,210,0.4);">Snooze in ${durationSec}s</div>
  `;
  document.body.appendChild(overlay);

  // Start audio + vibration
  mobileStartSiren();

  // Countdown → snooze (NOT dismiss)
  let remaining = durationSec;
  const cdEl = overlay.querySelector('#mobile-alarm-cd');
  mobileAlarmCountdownTimer = setInterval(() => {
    remaining--;
    if (cdEl) cdEl.textContent = `Snooze in ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(mobileAlarmCountdownTimer);
      mobileAlarmCountdownTimer = null;
      mobileAlarmEnterSnooze();
    }
  }, 1000);

  // Acknowledge = full stop
  overlay.querySelector('#mobile-alarm-ack').addEventListener('click', () => {
    mobileAcknowledgeAlarm();
  });
}

// Go quiet for MOBILE_ALARM_SNOOZE_SEC, then replay
function mobileAlarmEnterSnooze() {
  mobileStopSiren();
  mobileAlarmClearVisuals();

  if (!mobileAlarmActive) return;

  // Subdued "snooze" overlay so they know it's coming back
  const snooze = document.createElement('div');
  snooze.id = 'mobile-alarm-overlay';
  snooze.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #0a0a0a;
    user-select: none; text-align: center; padding: 24px;
  `;
  snooze.innerHTML = `
    ${mobileAlarmIconSVG().replace('style="width:80px;height:80px;"', 'style="width:80px;height:80px;margin-bottom:20px;opacity:0.3;"')}
    <div style="font-size:28px;font-weight:900;color:#884444;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">ALARM ACTIVE</div>
    <div style="font-size:14px;font-weight:600;color:#664444;line-height:1.5;margin-bottom:28px;">Siren will sound again in <span id="mobile-alarm-snooze-cd">${MOBILE_ALARM_SNOOZE_SEC}</span>s</div>
    <button id="mobile-alarm-ack" style="padding:14px 36px;background:rgba(255,23,68,0.15);border:2px solid #884444;border-radius:6px;color:#FFCDD2;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;cursor:pointer;">&#x2714; Acknowledge</button>
  `;
  document.body.appendChild(snooze);

  // Acknowledge during snooze
  snooze.querySelector('#mobile-alarm-ack').addEventListener('click', () => mobileAcknowledgeAlarm());

  // Snooze countdown → replay
  let snoozeRemaining = MOBILE_ALARM_SNOOZE_SEC;
  const cdEl = document.getElementById('mobile-alarm-snooze-cd');
  mobileAlarmSnoozeTimer = setInterval(() => {
    snoozeRemaining--;
    if (cdEl) cdEl.textContent = snoozeRemaining;
    if (snoozeRemaining <= 0) {
      clearInterval(mobileAlarmSnoozeTimer);
      mobileAlarmSnoozeTimer = null;
      // Replay the burst
      mobileAlarmStartBurst();
    }
  }, 1000);
}

// Remove all visual alarm elements
function mobileAlarmClearVisuals() {
  const overlay = document.getElementById('mobile-alarm-overlay');
  if (overlay) overlay.remove();
}

// Full acknowledgement — kill everything, no more snoozes
function mobileAcknowledgeAlarm() {
  mobileAlarmActive = false;
  if (mobileAlarmCountdownTimer) { clearInterval(mobileAlarmCountdownTimer); mobileAlarmCountdownTimer = null; }
  if (mobileAlarmSnoozeTimer) { clearInterval(mobileAlarmSnoozeTimer); mobileAlarmSnoozeTimer = null; }
  if (mobileAlarmDeathTimer) { clearTimeout(mobileAlarmDeathTimer); mobileAlarmDeathTimer = null; }
  mobileStopSiren();
  mobileAlarmClearVisuals();

  // Report ack to trainer via outbox
  const cfg = window._mobileAlarmConfig;
  if (cfg) {
    const identity = Engine.readIdentityFromLocation ? Engine.readIdentityFromLocation() : null;
    const playerId = identity || 'unknown-mobile';
    const exTime = Engine.getExerciseTime ? Engine.getExerciseTime() : null;
    Engine.alarmAckOut({
      alarmInjectId: cfg.injectId,
      playerId: playerId,
      acked: true,
      dead: false,
      firedAtWall: mobileAlarmFiredAtWall || Date.now(),
      ackedAtWall: Date.now(),
      ackedAtExercise: exTime ? exTime.displayString : ''
    });
  }

  window._mobileAlarmConfig = null;
  mobileAlarmFiredAtWall = null;

  // Remove KIA overlay if present
  const kiaEl = document.getElementById('mobile-kia-overlay');
  if (kiaEl) kiaEl.remove();
}

// KIA death screen for mobile
function mobileShowKIAOverlay() {
  if (document.getElementById('mobile-kia-overlay')) return;
  mobileStopSiren();
  mobileAlarmClearVisuals();

  const overlay = document.createElement('div');
  overlay.id = 'mobile-kia-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 100000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #000; color: #666;
    user-select: none; text-align: center; padding: 24px;
  `;
  overlay.innerHTML = `
    <svg viewBox="0 0 100 100" fill="none" style="width:80px;height:80px;margin-bottom:20px;opacity:0.4;">
      <line x1="20" y1="20" x2="80" y2="80" stroke="#FF1744" stroke-width="6" stroke-linecap="round"/>
      <line x1="80" y1="20" x2="20" y2="80" stroke="#FF1744" stroke-width="6" stroke-linecap="round"/>
    </svg>
    <div style="font-size:28px;font-weight:900;color:#FF1744;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">KIA</div>
    <div style="font-size:14px;color:#888;max-width:320px;line-height:1.5;margin-bottom:12px;">You failed to acknowledge the alarm within 4 minutes.</div>
    <div style="font-size:12px;color:#555;max-width:320px;line-height:1.5;">Await instructions from White Cell.</div>
  `;
  document.body.appendChild(overlay);
}

// Check if trainer marked us KIA or revived us
function mobileCheckKIA() {
  const s = Engine.getState();
  const identity = Engine.readIdentityFromLocation ? Engine.readIdentityFromLocation() : null;
  if (!identity) return;

  const kia = s.kia_roster && s.kia_roster[identity];
  if (kia && !document.getElementById('mobile-kia-overlay')) {
    mobileShowKIAOverlay();
  }
  if (!kia && document.getElementById('mobile-kia-overlay')) {
    document.getElementById('mobile-kia-overlay').remove();
    mobileAlarmActive = false;
    if (mobileAlarmCountdownTimer) { clearInterval(mobileAlarmCountdownTimer); mobileAlarmCountdownTimer = null; }
    if (mobileAlarmSnoozeTimer) { clearInterval(mobileAlarmSnoozeTimer); mobileAlarmSnoozeTimer = null; }
    if (mobileAlarmDeathTimer) { clearTimeout(mobileAlarmDeathTimer); mobileAlarmDeathTimer = null; }
    mobileStopSiren();
    mobileAlarmClearVisuals();
    window._mobileAlarmConfig = null;
    mobileAlarmFiredAtWall = null;
  }
}

function mobileCheckAlarms() {
  const s = Engine.getState();
  if (!s.clock || !s.clock.running) return;
  (s.injects || []).forEach(inj => {
    if (!inj.alarm) return;
    if (mobileAlarmFired.has(inj.id)) return;
    if (s.fired && s.fired.has(inj.id)) {
      mobileAlarmFired.add(inj.id);
      mobileShowAlarm(inj.alarm, inj.id);
    }
  });
}

// Hook alarm checks into the mobile sync loop
document.addEventListener('engine:sync', mobileCheckAlarms);
document.addEventListener('engine:inject-fired', mobileCheckAlarms);
setInterval(mobileCheckAlarms, 2000);
// Poll for KIA status from trainer
setInterval(mobileCheckKIA, 3000);
