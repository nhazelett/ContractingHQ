/* ==========================================================================
   AFICC / KQ EXERCISE BUILDER
   v0.2.9 (post-pivot)

   A non-coder tool for building custom CCO Capstone scenarios. Produces a
   scenario JSON file with three sections:
       meta     — scenario_title, intent, days, day_start_hour, day_end_hour
       phases   — [{id, title, focus, day, hour, color}]
       injects  — [{id, title, character, method, day, hour, minute,
                    problem, expected_outcome, documents, whitecell_needed,
                    role_tag, phase_id}]

   The scenario is persisted to localStorage under 'cco-builder-scenario'
   so work isn't lost between refreshes. Export/import uses JSON files so
   units can share scenarios with each other without standing up a server.

   Drag & drop:  inject palette rows are draggable; timeline slots accept
                 drops and update the dropped inject's day/hour/minute.
                 Double-click a timeline inject to edit it.

   Notes:
   - No dependency on Engine — this page is purely a content authoring tool.
   - The trainer can later "Load from scenario" (future wiring) to run the
     authored content as an actual exercise.
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'cco-builder-scenario';

  // Default empty scenario
  function emptyScenario() {
    return {
      meta: {
        scenario_title: 'Untitled Operation',
        intent: '',
        days: 4,
        day_start_hour: 8,
        day_end_hour: 18,
        clock_mode: 'sim'
      },
      phases: [],
      injects: []
    };
  }

  let scenario = emptyScenario();
  let editingInjectId = null;
  let editingPhaseId = null;
  let currentView = 'timeline'; // 'timeline' | 'msel'
  let mselSort = { key: 'time', dir: 'asc' };
  let mselFilter = '';

  // ---------- Utilities ----------
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  function totalMinutes(day, hour, minute) {
    return (day - 1) * 1440 + hour * 60 + minute;
  }

  // ---------- Persistence ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
      showToast('Saved locally');
    } catch (e) { console.error(e); showToast('Save failed'); }
    renderAll();
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      scenario = JSON.parse(raw);
      if (!scenario.meta) scenario = emptyScenario();
      if (!Array.isArray(scenario.phases)) scenario.phases = [];
      if (!Array.isArray(scenario.injects)) scenario.injects = [];
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // ---------- Import from stock bundle ----------
  // Translates the shipped __CCO_DATA injects (authored for the trainer) into
  // the flatter builder schema. We pull id, title, the earliest or absolute
  // trigger, the first inbox_item (for character/subject), scenario body for
  // problem text, expected_actions for expected_outcome, and role_tag.
  function importFromBundle() {
    const bundle = window.__CCO_DATA && window.__CCO_DATA.injects;
    if (!bundle) { showToast('No bundle loaded'); return; }

    if (scenario.injects.length > 0 &&
      !confirm('This will replace the current scenario. Continue?')) return;

    const injects = [];
    Object.values(bundle).forEach(src => {
      const trig = src.trigger || {};
      const day = trig.day || 1;
      const hour = trig.hour != null ? trig.hour
                 : (trig.earliest_hour != null ? trig.earliest_hour : 9);
      const minute = trig.minute != null ? trig.minute
                   : (trig.earliest_minute != null ? trig.earliest_minute : 0);
      const firstItem = (src.inbox_items && src.inbox_items[0]) || {};
      const method = firstItem.channel === 'sms' ? 'text'
                   : (src.phone_script_id ? 'call' : 'email');
      const expected = (src.expected_actions || [])
        .map(a => a.description || '').filter(Boolean).join('\n');
      injects.push({
        id: src.id,
        title: src.title || '(untitled)',
        character: firstItem.from || 'White Cell',
        method,
        day, hour, minute,
        problem: src.scenario_for_students || src.description || '',
        expected_outcome: expected,
        documents: '',
        whitecell_needed: !!src.phone_script_id,
        role_tag: src.role_tag || '',
        phase_id: null
      });
    });

    scenario = emptyScenario();
    scenario.meta.scenario_title = 'Operation Iron Meridian (imported)';
    scenario.meta.intent = 'Imported from shipped __CCO_DATA bundle — edit freely';
    scenario.injects = injects;
    save();
    showToast(`Imported ${injects.length} injects from bundle`);
  }

  // ---------- Export / import JSON ----------
  function exportJson() {
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (scenario.meta.scenario_title || 'scenario')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${slug || 'scenario'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast('Exported JSON');
  }
  function openImportModal() {
    document.getElementById('import-text').value = '';
    document.getElementById('import-modal').classList.remove('hidden');
  }
  function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
  }
  function confirmImport() {
    const text = document.getElementById('import-text').value.trim();
    if (!text) { showToast('Paste something first'); return; }
    try {
      const parsed = JSON.parse(text);
      if (!parsed.meta || !parsed.injects) throw new Error('Missing meta/injects');
      scenario = parsed;
      if (!Array.isArray(scenario.phases)) scenario.phases = [];
      save();
      closeImportModal();
      showToast('Scenario imported');
    } catch (e) {
      alert('Invalid JSON: ' + e.message);
    }
  }

  // ---------- Meta fields ----------
  function bindMetaInputs() {
    const m = scenario.meta;
    document.getElementById('scenario-title').value = m.scenario_title || '';
    document.getElementById('scenario-days').value = m.days;
    document.getElementById('scenario-day-start').value = m.day_start_hour;
    document.getElementById('scenario-day-end').value = m.day_end_hour;
    document.getElementById('scenario-intent').value = m.intent || '';
    const cm = document.getElementById('scenario-clock-mode');
    if (cm) cm.value = m.clock_mode || 'sim';
    document.getElementById('scenario-name-pill').textContent = m.scenario_title || 'Untitled';

    const onChange = () => {
      scenario.meta.scenario_title = document.getElementById('scenario-title').value;
      scenario.meta.days = parseInt(document.getElementById('scenario-days').value, 10) || 4;
      scenario.meta.day_start_hour = parseInt(document.getElementById('scenario-day-start').value, 10) || 8;
      scenario.meta.day_end_hour = parseInt(document.getElementById('scenario-day-end').value, 10) || 18;
      scenario.meta.intent = document.getElementById('scenario-intent').value;
      const cmEl = document.getElementById('scenario-clock-mode');
      scenario.meta.clock_mode = cmEl ? (cmEl.value === 'wall' ? 'wall' : 'sim') : 'sim';
      document.getElementById('scenario-name-pill').textContent = scenario.meta.scenario_title || 'Untitled';
      renderTimeline();
      renderSummary();
    };
    ['scenario-title','scenario-days','scenario-day-start','scenario-day-end','scenario-intent','scenario-clock-mode']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', onChange);
      });
    const cmSel = document.getElementById('scenario-clock-mode');
    if (cmSel) cmSel.addEventListener('change', onChange);
  }

  // ---------- Active scenario readout (Publish pipeline) ----------
  function refreshActiveScenarioReadout() {
    const el = document.getElementById('active-scenario-readout');
    if (!el || !window.CCOScenario) return;
    const p = window.CCOScenario.getActive();
    if (p.mode === 'builder') {
      el.textContent = `${p.title} (custom)`;
      el.style.color = 'var(--accent-bright)';
    } else {
      el.textContent = 'Iron Meridian (stock)';
      el.style.color = '';
    }
  }

  // ---------- Phase list ----------
  function renderPhaseList() {
    const list = document.getElementById('phase-list');
    const phases = (scenario.phases || []).slice()
      .sort((a, b) => totalMinutes(a.day || 1, a.hour || 0, 0) - totalMinutes(b.day || 1, b.hour || 0, 0));

    if (phases.length === 0) {
      list.innerHTML = '<div class="muted text-center" style="padding: 20px;">No phases yet. Add Phase I (e.g. "First day on the job"), Phase II ("Marines arrive — bare-base standup"), Phase III ("Closeouts / redeployment")…</div>';
      return;
    }
    list.innerHTML = phases.map(p => `
      <div class="phase-chip" data-id="${esc(p.id)}" style="border-color: ${esc(p.color || '#4FC3D7')};">
        <div class="phase-chip-bar" style="background: ${esc(p.color || '#4FC3D7')};"></div>
        <div class="phase-chip-body">
          <div class="phase-chip-head">
            <strong>${esc(p.title || 'Untitled phase')}</strong>
            <span class="muted mono">D${p.day || 1} · ${pad(p.hour || 0)}:00</span>
          </div>
          <div class="phase-chip-focus">${esc(p.focus || '(no focus text)')}</div>
        </div>
        <button class="btn btn-sm phase-edit" data-id="${esc(p.id)}">Edit</button>
      </div>
    `).join('');

    list.querySelectorAll('.phase-edit').forEach(btn => {
      btn.addEventListener('click', () => openPhaseEditor(btn.dataset.id));
    });
  }

  // ---------- Phase editor ----------
  function openPhaseEditor(phaseId) {
    editingPhaseId = phaseId || null;
    const p = phaseId ? scenario.phases.find(x => x.id === phaseId) : null;
    document.getElementById('phase-modal-title').textContent = p ? 'Edit phase' : 'New phase';
    document.getElementById('ph-title').value = p ? (p.title || '') : '';
    document.getElementById('ph-focus').value = p ? (p.focus || '') : '';
    document.getElementById('ph-day').value = p ? (p.day || 1) : 1;
    document.getElementById('ph-hour').value = p ? (p.hour || 8) : 8;
    document.getElementById('ph-color').value = p ? (p.color || '#4FC3D7') : '#4FC3D7';
    document.getElementById('ph-delete').style.display = p ? '' : 'none';
    document.getElementById('phase-modal').classList.remove('hidden');
  }
  function closePhaseEditor() {
    document.getElementById('phase-modal').classList.add('hidden');
    editingPhaseId = null;
  }
  function savePhase() {
    const title = document.getElementById('ph-title').value.trim();
    if (!title) { showToast('Phase needs a title'); return; }
    const data = {
      id: editingPhaseId || uid('ph'),
      title,
      focus: document.getElementById('ph-focus').value,
      day: parseInt(document.getElementById('ph-day').value, 10) || 1,
      hour: parseInt(document.getElementById('ph-hour').value, 10) || 0,
      color: document.getElementById('ph-color').value || '#4FC3D7'
    };
    if (editingPhaseId) {
      const i = scenario.phases.findIndex(x => x.id === editingPhaseId);
      if (i >= 0) scenario.phases[i] = data;
    } else {
      scenario.phases.push(data);
    }
    closePhaseEditor();
    save();
  }
  function deletePhase() {
    if (!editingPhaseId) return;
    if (!confirm('Delete this phase? Injects tagged to it keep their time but lose the phase link.')) return;
    scenario.phases = scenario.phases.filter(p => p.id !== editingPhaseId);
    scenario.injects.forEach(i => { if (i.phase_id === editingPhaseId) i.phase_id = null; });
    closePhaseEditor();
    save();
  }

  // ---------- Inject editor ----------
  function openInjectEditor(injectId, prefillTime) {
    editingInjectId = injectId || null;
    const inj = injectId ? scenario.injects.find(x => x.id === injectId) : null;
    document.getElementById('inject-modal-title').textContent = inj ? 'Edit inject' : 'New inject';
    document.getElementById('inj-id').value = inj ? inj.id : uid('BLD');
    document.getElementById('inj-title').value = inj ? (inj.title || '') : '';
    document.getElementById('inj-character').value = inj ? (inj.character || '') : '';
    document.getElementById('inj-method').value = inj ? (inj.method || 'email') : 'email';
    document.getElementById('inj-day').value = inj ? (inj.day || 1) : (prefillTime ? prefillTime.day : 1);
    document.getElementById('inj-hour').value = inj ? (inj.hour != null ? inj.hour : 9) : (prefillTime ? prefillTime.hour : 9);
    document.getElementById('inj-minute').value = inj ? (inj.minute || 0) : (prefillTime ? prefillTime.minute : 0);
    document.getElementById('inj-problem').value = inj ? (inj.problem || '') : '';
    document.getElementById('inj-expected').value = inj ? (inj.expected_outcome || '') : '';
    document.getElementById('inj-docs').value = inj ? (inj.documents || '') : '';
    document.getElementById('inj-whitecell').checked = inj ? !!inj.whitecell_needed : false;
    document.getElementById('inj-role').value = inj ? (inj.role_tag || '') : '';
    // Populate phase dropdown
    const sel = document.getElementById('inj-phase');
    sel.innerHTML = '<option value="">— none —</option>' +
      scenario.phases.map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
    sel.value = inj ? (inj.phase_id || '') : '';
    document.getElementById('inj-delete').style.display = inj ? '' : 'none';
    document.getElementById('inject-modal').classList.remove('hidden');
  }
  function closeInjectEditor() {
    document.getElementById('inject-modal').classList.add('hidden');
    editingInjectId = null;
  }
  function saveInject() {
    const title = document.getElementById('inj-title').value.trim();
    if (!title) { showToast('Inject needs a title'); return; }
    const data = {
      id: document.getElementById('inj-id').value.trim() || uid('BLD'),
      title,
      character: document.getElementById('inj-character').value,
      method: document.getElementById('inj-method').value,
      day: parseInt(document.getElementById('inj-day').value, 10) || 1,
      hour: parseInt(document.getElementById('inj-hour').value, 10) || 0,
      minute: parseInt(document.getElementById('inj-minute').value, 10) || 0,
      problem: document.getElementById('inj-problem').value,
      expected_outcome: document.getElementById('inj-expected').value,
      documents: document.getElementById('inj-docs').value,
      whitecell_needed: document.getElementById('inj-whitecell').checked,
      role_tag: document.getElementById('inj-role').value,
      phase_id: document.getElementById('inj-phase').value || null
    };
    if (editingInjectId) {
      const i = scenario.injects.findIndex(x => x.id === editingInjectId);
      if (i >= 0) scenario.injects[i] = data;
      else scenario.injects.push(data);
    } else {
      if (scenario.injects.find(x => x.id === data.id)) {
        data.id = uid('BLD');
      }
      scenario.injects.push(data);
    }
    closeInjectEditor();
    save();
  }
  function deleteInject() {
    if (!editingInjectId) return;
    if (!confirm('Delete this inject?')) return;
    scenario.injects = scenario.injects.filter(i => i.id !== editingInjectId);
    closeInjectEditor();
    save();
  }

  // ---------- Palette ----------
  function renderPalette() {
    const el = document.getElementById('inject-palette');
    if (scenario.injects.length === 0) {
      el.innerHTML = '<div class="muted text-center" style="padding: 20px;">No injects yet. Click "+ New inject" or "Import stock injects".</div>';
      return;
    }
    // Sort by time
    const sorted = scenario.injects.slice().sort((a, b) =>
      totalMinutes(a.day, a.hour, a.minute) - totalMinutes(b.day, b.hour, b.minute)
    );
    el.innerHTML = sorted.map(inj => `
      <div class="palette-row method-${esc(inj.method)} ${inj.whitecell_needed ? 'wc-needed' : ''}"
           draggable="true" data-id="${esc(inj.id)}">
        <div class="palette-row-time mono">D${inj.day} ${pad(inj.hour)}:${pad(inj.minute)}</div>
        <div class="palette-row-body">
          <div class="palette-row-title">${esc(inj.title)}</div>
          <div class="palette-row-meta">
            <span class="method-tag">${esc(inj.method || 'email')}</span>
            <span>${esc(inj.character || '—')}</span>
            ${inj.whitecell_needed ? '<span class="wc-tag">★ WC</span>' : ''}
            ${inj.role_tag ? `<span class="role-tag">${esc(inj.role_tag)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.palette-row').forEach(row => {
      row.addEventListener('dblclick', () => openInjectEditor(row.dataset.id));
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', row.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    });
  }

  // ---------- Timeline ----------
  // Grid layout: one row per day, columns = hours from day_start..day_end,
  // each column subdivided into 4 quarter-hour drop slots.
  function renderTimeline() {
    const tl = document.getElementById('builder-timeline');
    const { days, day_start_hour, day_end_hour } = scenario.meta;
    const hoursPerDay = Math.max(1, day_end_hour - day_start_hour);

    let html = '';
    // Header row — hours
    html += '<div class="tl-grid">';
    html += '<div class="tl-row tl-header"><div class="tl-rowlabel"></div>';
    for (let h = day_start_hour; h < day_end_hour; h++) {
      html += `<div class="tl-hour-header mono">${pad(h)}:00</div>`;
    }
    html += '</div>';

    // Day rows
    for (let d = 1; d <= days; d++) {
      html += `<div class="tl-row" data-day="${d}">`;
      html += `<div class="tl-rowlabel mono">D${d}</div>`;
      for (let h = day_start_hour; h < day_end_hour; h++) {
        html += `<div class="tl-hourcell" data-day="${d}" data-hour="${h}">`;
        // 4 x 15-min drop slots
        for (let q = 0; q < 4; q++) {
          html += `<div class="tl-slot" data-day="${d}" data-hour="${h}" data-min="${q*15}"></div>`;
        }
        // Overlay injects that land in this hour
        const hits = scenario.injects.filter(i => i.day === d && i.hour === h);
        hits.forEach(inj => {
          const leftPct = (inj.minute / 60) * 100;
          html += `
            <div class="tl-inject method-${esc(inj.method)} ${inj.whitecell_needed ? 'wc-needed' : ''}"
                 style="left: ${leftPct}%;"
                 data-id="${esc(inj.id)}"
                 draggable="true"
                 title="${esc(inj.title)} — D${d} ${pad(h)}:${pad(inj.minute)} — ${esc(inj.method)}${inj.whitecell_needed ? ' ★ White Cell' : ''}">
              <span class="tl-inject-dot"></span>
              <span class="tl-inject-label">${esc(inj.title)}</span>
            </div>`;
        });
        html += `</div>`;
      }
      // Phase overlay bands — drawn as absolutely-positioned divs over this day row
      const dayPhases = (scenario.phases || []).filter(p => p.day === d);
      dayPhases.forEach(p => {
        const startHour = Math.max(day_start_hour, Math.min(day_end_hour, p.hour || day_start_hour));
        const offsetHours = startHour - day_start_hour;
        const leftPct = (offsetHours / hoursPerDay) * 100;
        html += `<div class="tl-phase-band" style="left: calc(${leftPct}% + 60px); background: ${esc(p.color)}22; border-left: 3px solid ${esc(p.color)};">
          <span class="tl-phase-label" style="color: ${esc(p.color)};">${esc(p.title)}</span>
        </div>`;
      });
      html += `</div>`;
    }
    html += '</div>';
    tl.innerHTML = html;

    // Slot clicks → new inject at that slot
    tl.querySelectorAll('.tl-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        openInjectEditor(null, {
          day: parseInt(slot.dataset.day, 10),
          hour: parseInt(slot.dataset.hour, 10),
          minute: parseInt(slot.dataset.min, 10)
        });
      });
    });

    // Existing inject dblclick → edit
    tl.querySelectorAll('.tl-inject').forEach(el => {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openInjectEditor(el.dataset.id);
      });
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', el.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });
    });

    // Drop handlers on every hour cell (drop = change day/hour/minute)
    tl.querySelectorAll('.tl-hourcell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('drop-target');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drop-target');
        const id = e.dataTransfer.getData('text/plain');
        const inj = scenario.injects.find(x => x.id === id);
        if (!inj) return;
        // Compute minute within the hour from X-offset
        const rect = cell.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        inj.day = parseInt(cell.dataset.day, 10);
        inj.hour = parseInt(cell.dataset.hour, 10);
        // Snap to nearest 5 minutes
        inj.minute = Math.round((pct * 60) / 5) * 5;
        if (inj.minute >= 60) { inj.minute = 0; inj.hour = Math.min(23, inj.hour + 1); }
        save();
      });
    });
  }

  // ---------- Summary ----------
  function renderSummary() {
    const count = scenario.injects.length;
    document.getElementById('summary-count').textContent =
      `${count} inject${count === 1 ? '' : 's'}`;

    const byMethod = {};
    let wcCount = 0;
    scenario.injects.forEach(i => {
      byMethod[i.method || 'email'] = (byMethod[i.method || 'email'] || 0) + 1;
      if (i.whitecell_needed) wcCount += 1;
    });

    const byDay = {};
    scenario.injects.forEach(i => {
      byDay[i.day] = (byDay[i.day] || 0) + 1;
    });

    const sum = document.getElementById('scenario-summary');
    if (count === 0) {
      sum.innerHTML = '<div class="muted text-center" style="padding: 20px;">Add an inject to see scenario metrics.</div>';
      return;
    }

    const methodRows = Object.keys(byMethod).sort()
      .map(m => `<div class="sum-row"><span>${esc(m)}</span><span class="mono">${byMethod[m]}</span></div>`).join('');
    const dayRows = Object.keys(byDay).sort((a, b) => a - b)
      .map(d => `<div class="sum-row"><span>Day ${d}</span><span class="mono">${byDay[d]}</span></div>`).join('');

    sum.innerHTML = `
      <div class="sum-section">
        <div class="micro">By method</div>
        ${methodRows}
      </div>
      <div class="sum-section">
        <div class="micro">By day</div>
        ${dayRows}
      </div>
      <div class="sum-section">
        <div class="micro">White Cell support</div>
        <div class="sum-row"><span>Injects needing role-player</span><span class="mono">${wcCount} / ${count}</span></div>
      </div>
      <div class="sum-section">
        <div class="micro">Phases</div>
        <div class="sum-row"><span>Defined</span><span class="mono">${scenario.phases.length}</span></div>
      </div>
    `;
  }

  // ---------- Helpers shared by MSEL table + print ----------
  function methodLabel(m) {
    switch (m) {
      case 'email':   return 'Email';
      case 'text':    return 'Text / SMS';
      case 'call':    return 'Phone call';
      case 'walk_in': return 'Walk-in';
      case 'doc':     return 'Document drop';
      default:        return m || '—';
    }
  }
  function roleLabel(r) {
    if (!r) return 'Broadcast';
    if (r === 'cco') return 'CCO';
    if (r === 'aco') return 'ACO';
    if (r === 'leadership') return 'Leadership';
    return r;
  }
  function phaseLookup() {
    const m = {};
    (scenario.phases || []).forEach(p => { m[p.id] = p; });
    return m;
  }
  function sortedInjectsByTime() {
    return scenario.injects.slice().sort((a, b) =>
      totalMinutes(a.day, a.hour, a.minute) - totalMinutes(b.day, b.hour, b.minute)
    );
  }

  // ---------- View toggle (Timeline <-> MSEL table) ----------
  function setView(view) {
    currentView = view === 'msel' ? 'msel' : 'timeline';
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === currentView);
    });
    document.getElementById('view-timeline').classList.toggle('hidden', currentView !== 'timeline');
    document.getElementById('view-msel').classList.toggle('hidden', currentView !== 'msel');
    const titleEl = document.getElementById('view-title');
    if (titleEl) {
      titleEl.innerHTML = currentView === 'timeline'
        ? 'Timeline <span class="muted">— STARTEX → ENDEX</span>'
        : 'MSEL Table <span class="muted">— master scenario events list</span>';
    }
    if (currentView === 'msel') renderMselTable();
  }

  // ---------- MSEL table ----------
  function renderMselTable() {
    const wrap = document.getElementById('msel-table-wrap');
    const countEl = document.getElementById('msel-count');
    if (!wrap) return;

    const phases = phaseLookup();
    let rows = scenario.injects.map((inj, idx) => ({
      inj,
      idx,
      time: totalMinutes(inj.day, inj.hour, inj.minute),
      phase: inj.phase_id ? (phases[inj.phase_id] ? phases[inj.phase_id].title : '—') : '—'
    }));

    // Filter
    const q = (mselFilter || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter(r => {
        const inj = r.inj;
        const hay = [
          inj.id, inj.title, inj.character, inj.method, inj.problem,
          inj.expected_outcome, inj.documents, inj.role_tag, r.phase
        ].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      const ai = a.inj, bi = b.inj;
      switch (mselSort.key) {
        case 'id':      cmp = (ai.id || '').localeCompare(bi.id || ''); break;
        case 'from':    cmp = (ai.character || '').localeCompare(bi.character || ''); break;
        case 'to':      cmp = roleLabel(ai.role_tag).localeCompare(roleLabel(bi.role_tag)); break;
        case 'method':  cmp = (ai.method || '').localeCompare(bi.method || ''); break;
        case 'title':   cmp = (ai.title || '').localeCompare(bi.title || ''); break;
        case 'phase':   cmp = a.phase.localeCompare(b.phase); break;
        case 'wc':      cmp = (ai.whitecell_needed ? 1 : 0) - (bi.whitecell_needed ? 1 : 0); break;
        case 'time':
        default:        cmp = a.time - b.time; break;
      }
      return mselSort.dir === 'desc' ? -cmp : cmp;
    });

    if (countEl) countEl.textContent = `${rows.length} event${rows.length === 1 ? '' : 's'}${q ? ` (filtered)` : ''}`;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="muted text-center" style="padding: 28px;">No events match. Clear the filter or add an inject.</div>';
      return;
    }

    const arrow = (key) => mselSort.key !== key ? '' :
      (mselSort.dir === 'asc' ? ' ▲' : ' ▼');

    let html = '<table class="msel-table"><thead><tr>';
    html += `<th class="sortable" data-sort="id">Event #${arrow('id')}</th>`;
    html += `<th class="sortable" data-sort="time">Day / Time${arrow('time')}</th>`;
    html += `<th class="sortable" data-sort="from">From (role player)${arrow('from')}</th>`;
    html += `<th class="sortable" data-sort="to">To (role tag)${arrow('to')}</th>`;
    html += `<th class="sortable" data-sort="method">Method${arrow('method')}</th>`;
    html += `<th class="sortable" data-sort="title">Event${arrow('title')}</th>`;
    html += `<th>Expected action</th>`;
    html += `<th class="sortable" data-sort="phase">Phase${arrow('phase')}</th>`;
    html += `<th class="sortable" data-sort="wc">WC${arrow('wc')}</th>`;
    html += '</tr></thead><tbody>';

    rows.forEach(r => {
      const inj = r.inj;
      html += `<tr data-id="${esc(inj.id)}" class="msel-row ${inj.whitecell_needed ? 'wc-row' : ''}">`;
      html += `<td class="mono nowrap">${esc(inj.id || '—')}</td>`;
      html += `<td class="mono nowrap">D${inj.day} ${pad(inj.hour)}:${pad(inj.minute || 0)}</td>`;
      html += `<td>${esc(inj.character || '—')}</td>`;
      html += `<td><span class="role-tag">${esc(roleLabel(inj.role_tag))}</span></td>`;
      html += `<td class="nowrap"><span class="method-tag method-${esc(inj.method || 'email')}">${esc(methodLabel(inj.method))}</span></td>`;
      html += `<td><strong>${esc(inj.title || '(untitled)')}</strong><div class="msel-desc muted">${esc((inj.problem || '').slice(0, 140))}${(inj.problem || '').length > 140 ? '…' : ''}</div></td>`;
      html += `<td class="msel-expected muted">${esc((inj.expected_outcome || '').slice(0, 120))}${(inj.expected_outcome || '').length > 120 ? '…' : ''}</td>`;
      html += `<td class="nowrap">${esc(r.phase)}</td>`;
      html += `<td class="center">${inj.whitecell_needed ? '<span class="wc-tag">★</span>' : ''}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Sort header clicks
    wrap.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (mselSort.key === key) {
          mselSort.dir = mselSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          mselSort.key = key;
          mselSort.dir = 'asc';
        }
        renderMselTable();
      });
    });
    // Row click → edit
    wrap.querySelectorAll('tr.msel-row').forEach(tr => {
      tr.addEventListener('click', () => openInjectEditor(tr.dataset.id));
    });
  }

  // ---------- Author's Guide ----------
  function openGuide() {
    document.getElementById('guide-modal').classList.remove('hidden');
    // Reset to first section
    const first = document.querySelector('.guide-nav-link');
    if (first) {
      document.querySelectorAll('.guide-nav-link').forEach(a => a.classList.remove('active'));
      first.classList.add('active');
      const target = document.querySelector(first.getAttribute('href'));
      const content = document.getElementById('guide-content');
      if (target && content) content.scrollTop = 0;
    }
  }
  function closeGuide() {
    document.getElementById('guide-modal').classList.add('hidden');
  }
  function wireGuideNav() {
    document.querySelectorAll('.guide-nav-link').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const href = a.getAttribute('href');
        document.querySelectorAll('.guide-nav-link').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        const target = document.querySelector(href);
        const content = document.getElementById('guide-content');
        if (target && content) {
          content.scrollTo({ top: target.offsetTop - content.offsetTop - 8, behavior: 'smooth' });
        }
      });
    });
  }

  // ---------- MSEL print / PDF export ----------
  function printMsel() {
    renderPrintMsel();
    document.body.classList.add('printing-msel');
    // Give the browser a beat to lay out the print container
    setTimeout(() => {
      window.print();
    }, 50);
  }
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-msel');
  });

  function renderPrintMsel() {
    const el = document.getElementById('msel-print');
    if (!el) return;
    const m = scenario.meta;
    const injects = sortedInjectsByTime();
    const phases = (scenario.phases || []).slice()
      .sort((a, b) => totalMinutes(a.day || 1, a.hour || 0, 0) - totalMinutes(b.day || 1, b.hour || 0, 0));
    const phaseMap = phaseLookup();
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const byMethod = {};
    let wcCount = 0;
    injects.forEach(i => {
      byMethod[i.method || 'email'] = (byMethod[i.method || 'email'] || 0) + 1;
      if (i.whitecell_needed) wcCount += 1;
    });

    let html = '';

    // ---- Cover sheet ----
    html += '<section class="print-cover">';
    html += '<div class="print-classification">UNCLASSIFIED // FOR TRAINING USE ONLY</div>';
    html += '<h1 class="print-title">Master Scenario Events List</h1>';
    html += `<h2 class="print-subtitle">${esc(m.scenario_title || 'Untitled scenario')}</h2>`;
    html += `<p class="print-intent">${esc(m.intent || '')}</p>`;
    html += '<table class="print-meta-table">';
    html += `<tr><th>Exercise duration</th><td>${m.days} day${m.days === 1 ? '' : 's'} (${pad(m.day_start_hour)}:00 – ${pad(m.day_end_hour)}:00)</td></tr>`;
    html += `<tr><th>Total events</th><td>${injects.length}</td></tr>`;
    html += `<tr><th>Phases</th><td>${phases.length}</td></tr>`;
    html += `<tr><th>White Cell events</th><td>${wcCount} (${injects.length ? Math.round(100 * wcCount / injects.length) : 0}%)</td></tr>`;
    html += `<tr><th>Document prepared</th><td>${esc(dateStr)}</td></tr>`;
    html += '</table>';
    html += '<div class="print-classification">UNCLASSIFIED // FOR TRAINING USE ONLY</div>';
    html += '</section>';

    // ---- Phase summary ----
    if (phases.length > 0) {
      html += '<section class="print-section">';
      html += '<h2>Phase Summary</h2>';
      html += '<table class="print-table">';
      html += '<thead><tr><th>#</th><th>Phase</th><th>Starts</th><th>Focus</th></tr></thead><tbody>';
      phases.forEach((p, idx) => {
        html += `<tr>`;
        html += `<td class="mono">${idx + 1}</td>`;
        html += `<td><strong>${esc(p.title || '—')}</strong></td>`;
        html += `<td class="mono nowrap">D${p.day || 1} ${pad(p.hour || 0)}:00</td>`;
        html += `<td>${esc(p.focus || '')}</td>`;
        html += `</tr>`;
      });
      html += '</tbody></table>';
      html += '</section>';
    }

    // ---- Full MSEL table ----
    html += '<section class="print-section">';
    html += '<h2>Master Scenario Events List</h2>';
    html += '<table class="print-table print-msel">';
    html += '<thead><tr>';
    html += '<th>#</th><th>Day/Time</th><th>From</th><th>To</th><th>Method</th><th>Event</th><th>Expected action</th><th>WC</th>';
    html += '</tr></thead><tbody>';
    injects.forEach((inj, idx) => {
      const expected = (inj.expected_outcome || '').split('\n').filter(Boolean);
      const expectedHtml = expected.length > 1
        ? '<ul>' + expected.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
        : esc(expected[0] || '');
      html += '<tr>';
      html += `<td class="mono">${idx + 1}</td>`;
      html += `<td class="mono nowrap">D${inj.day} ${pad(inj.hour)}:${pad(inj.minute || 0)}</td>`;
      html += `<td>${esc(inj.character || '—')}</td>`;
      html += `<td class="nowrap">${esc(roleLabel(inj.role_tag))}</td>`;
      html += `<td class="nowrap">${esc(methodLabel(inj.method))}</td>`;
      html += `<td><strong>${esc(inj.title || '(untitled)')}</strong><br><span class="print-event-body">${esc(inj.problem || '')}</span></td>`;
      html += `<td>${expectedHtml}</td>`;
      html += `<td class="center">${inj.whitecell_needed ? '★' : ''}</td>`;
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</section>';

    // ---- Per-inject appendix ----
    html += '<section class="print-section">';
    html += '<h2>Appendix A — Event Detail</h2>';
    injects.forEach((inj, idx) => {
      const phase = inj.phase_id && phaseMap[inj.phase_id] ? phaseMap[inj.phase_id].title : null;
      html += '<div class="print-event-card">';
      html += `<h3>${idx + 1}. ${esc(inj.title || '(untitled)')} <span class="mono muted">[${esc(inj.id || '')}]</span></h3>`;
      html += '<table class="print-kv">';
      html += `<tr><th>Fires</th><td>D${inj.day} ${pad(inj.hour)}:${pad(inj.minute || 0)}</td></tr>`;
      html += `<tr><th>From</th><td>${esc(inj.character || '—')}</td></tr>`;
      html += `<tr><th>Method</th><td>${esc(methodLabel(inj.method))}</td></tr>`;
      html += `<tr><th>Routed to</th><td>${esc(roleLabel(inj.role_tag))}</td></tr>`;
      if (phase) html += `<tr><th>Phase</th><td>${esc(phase)}</td></tr>`;
      if (inj.whitecell_needed) html += `<tr><th>White Cell</th><td><strong>Required — live role-player must be available</strong></td></tr>`;
      html += '</table>';
      if (inj.problem) {
        html += '<h4>Event description</h4>';
        html += `<p>${esc(inj.problem).replace(/\n/g, '<br>')}</p>`;
      }
      if (inj.expected_outcome) {
        html += '<h4>Expected action</h4>';
        const lines = inj.expected_outcome.split('\n').filter(Boolean);
        if (lines.length > 1) {
          html += '<ul>' + lines.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>';
        } else {
          html += `<p>${esc(lines[0] || '')}</p>`;
        }
      }
      if (inj.documents) {
        html += '<h4>Documents</h4>';
        const docs = inj.documents.split('\n').filter(Boolean);
        html += '<ul>' + docs.map(x => `<li class="mono">${esc(x)}</li>`).join('') + '</ul>';
      }
      html += '</div>';
    });
    html += '</section>';

    el.innerHTML = html;
  }

  // ---------- Full re-render ----------
  function renderAll() {
    renderPhaseList();
    renderPalette();
    renderTimeline();
    renderSummary();
    if (currentView === 'msel') renderMselTable();
  }

  // ---------- Toast ----------
  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid var(--accent-line);color:var(--accent);padding:12px 20px;border-radius:6px;font-size:13px;z-index:200;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------- Builder → __CCO_DATA translator ----------
  // Converts the flat Builder schema into the rich shape the engine expects.
  //
  // Builder inject (flat):
  //   { id, title, character, method, day, hour, minute, problem,
  //     expected_outcome, documents, whitecell_needed, role_tag, phase_id }
  //
  // Engine inject (rich, from content-bundle.js):
  //   { id, title, trigger: {type,day,hour,minute},
  //     description, scenario_for_students,
  //     role_tag, inbox_items: [...], sms_items: [...], phone_script_id,
  //     expected_actions: [...], trainer_prompts: [...],
  //     observer_note, teaching_point, quick_fires: [...] }
  function toBundle() {
    const injects = {};
    const contacts = [];
    const phoneScripts = {};
    const seenContactIds = new Set();

    // --- character → synthesized contact --- (for text / call methods)
    function contactIdFor(name) {
      if (!name) return 'bld-unknown';
      return 'bld-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'bld-unknown';
    }
    function addContact(name) {
      const id = contactIdFor(name);
      if (seenContactIds.has(id)) return id;
      const palette = ['#F56565','#F5B845','#4FC3D7','#5BC98E','#8B97A8','#be96e6','#d96cb4'];
      const color = palette[contacts.length % palette.length];
      const ini = String(name || '??').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
      contacts.push({
        id,
        name: name || 'Unknown',
        title: 'Role-player (custom)',
        initials: ini || '??',
        color,
        tone: '',
        example_messages: []
      });
      seenContactIds.add(id);
      return id;
    }

    scenario.injects.forEach((src, idx) => {
      const method = src.method || 'email';
      const character = src.character || 'White Cell';
      const cid = (method === 'text' || method === 'call') ? addContact(character) : null;

      const expectedActions = (src.expected_outcome || '')
        .split('\n').map(s => s.trim()).filter(Boolean)
        .map((desc, i) => ({
          id: `a${i + 1}`,
          description: desc,
          objective: true,
          priority: 'medium'
        }));

      // Inbox items only fire for email / doc / walk_in. SMS uses sms_items.
      const inboxItems = [];
      if (method === 'email' || method === 'doc' || method === 'walk_in') {
        inboxItems.push({
          id: 'msg1',
          from: character,
          from_email: character.toLowerCase().replace(/[^a-z0-9]+/g, '.') + '@mail.mil',
          subject: src.title || '(no subject)',
          body: src.problem || ''
        });
      }

      // SMS items for text method
      const smsItems = [];
      if (method === 'text' && cid) {
        smsItems.push({
          id: 'sms1',
          contact_id: cid,
          delay_minutes: 0,
          messages: (src.problem || '').split('\n').filter(Boolean)
        });
      }

      // Minimal phone script stub for 'call' method — trainer can see it
      // under the call panel. Real scripts still have to be authored, but
      // this gives the engine something to load without erroring.
      let phoneScriptId = null;
      if (method === 'call') {
        phoneScriptId = `bld-${src.id}`;
        phoneScripts[phoneScriptId] = {
          id: phoneScriptId,
          contact_id: cid,
          trigger_inject: src.id,
          opening_line: src.problem || '(no opening line)',
          beats: [
            { id: 'b1', line: 'Just picked up — what do you need?', expected_response: 'Listen and clarify' }
          ]
        };
      }

      // Default trainer prompt for white-cell injects
      const trainerPrompts = [];
      if (src.whitecell_needed) {
        trainerPrompts.push('WHITE CELL: a live role-player must deliver this inject. Stay in character; do not improvise outside the event description.');
      }

      const docsList = (src.documents || '').split('\n').map(s => s.trim()).filter(Boolean);

      injects[src.id] = {
        id: src.id,
        title: src.title || '(untitled)',
        trigger: {
          type: 'absolute',
          day: src.day || 1,
          hour: src.hour || 9,
          minute: src.minute || 0
        },
        description: src.problem || '',
        scenario_for_students: src.problem || '',
        role_tag: src.role_tag || null,
        phase_id: src.phase_id || null,
        inbox_items: inboxItems,
        sms_items: smsItems,
        phone_script_id: phoneScriptId,
        expected_actions: expectedActions,
        trainer_prompts: trainerPrompts,
        observer_note: '',
        teaching_point: '',
        quick_fires: [],
        documents: docsList,
        whitecell_needed: !!src.whitecell_needed,
        _origin: 'builder'
      };
    });

    return {
      meta: {
        scenario_title: scenario.meta.scenario_title,
        intent: scenario.meta.intent,
        days: scenario.meta.days,
        day_start_hour: scenario.meta.day_start_hour,
        day_end_hour: scenario.meta.day_end_hour,
        clock_mode: scenario.meta.clock_mode || 'sim'
      },
      injects,
      contacts,
      phoneScripts,
      phases: scenario.phases || []
    };
  }

  function publishToApp() {
    if (!window.CCOScenario) {
      showToast('Scenario loader not available');
      return;
    }
    if (scenario.injects.length === 0) {
      if (!confirm('This scenario has 0 injects. Publish anyway?')) return;
    }
    const bundle = toBundle();
    const ok = window.CCOScenario.publishBundle(bundle, scenario.meta.scenario_title || 'Custom scenario');
    if (ok) {
      refreshActiveScenarioReadout();
      const injectCount = Object.keys(bundle.injects).length;
      showToast(`Published to app (${injectCount} inject${injectCount === 1 ? '' : 's'}) — open STARTEX to run it`);
    } else {
      showToast('Publish failed — check console');
    }
  }

  function useStockScenario() {
    if (!window.CCOScenario) return;
    if (!confirm('Switch the Trainer / Student / Inspector dashboards back to the stock Iron Meridian scenario? (Your Builder scenario is kept and can be re-published.)')) return;
    window.CCOScenario.useStock();
    refreshActiveScenarioReadout();
    showToast('Switched to stock Iron Meridian');
  }

  // ---------- Wire up ----------
  function init() {
    load();
    bindMetaInputs();
    renderAll();

    document.getElementById('btn-new').addEventListener('click', () => {
      if (scenario.injects.length > 0 && !confirm('Discard the current scenario?')) return;
      scenario = emptyScenario();
      save();
      bindMetaInputs();
    });
    document.getElementById('btn-import-bundle').addEventListener('click', importFromBundle);
    document.getElementById('btn-import-json').addEventListener('click', openImportModal);
    document.getElementById('btn-export-json').addEventListener('click', exportJson);
    document.getElementById('btn-save').addEventListener('click', save);

    // Guide + print MSEL
    const btnGuide = document.getElementById('btn-guide');
    if (btnGuide) btnGuide.addEventListener('click', openGuide);
    const btnPrint = document.getElementById('btn-print-msel');
    if (btnPrint) btnPrint.addEventListener('click', printMsel);
    const btnGuideClose = document.getElementById('guide-modal-close');
    if (btnGuideClose) btnGuideClose.addEventListener('click', closeGuide);
    wireGuideNav();

    // Publish to app + use stock
    const btnPublish = document.getElementById('btn-publish');
    if (btnPublish) btnPublish.addEventListener('click', publishToApp);
    const btnStock = document.getElementById('btn-use-stock');
    if (btnStock) btnStock.addEventListener('click', useStockScenario);
    refreshActiveScenarioReadout();

    // View toggle (Timeline / MSEL Table)
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });
    const mselFilterEl = document.getElementById('msel-filter');
    if (mselFilterEl) {
      mselFilterEl.addEventListener('input', (e) => {
        mselFilter = e.target.value;
        renderMselTable();
      });
    }

    document.getElementById('btn-add-phase').addEventListener('click', () => openPhaseEditor(null));
    document.getElementById('btn-add-inject').addEventListener('click', () => openInjectEditor(null));

    // Inject modal wiring
    document.getElementById('inject-modal-close').addEventListener('click', closeInjectEditor);
    document.getElementById('inj-cancel').addEventListener('click', closeInjectEditor);
    document.getElementById('inj-save').addEventListener('click', saveInject);
    document.getElementById('inj-delete').addEventListener('click', deleteInject);

    // Phase modal wiring
    document.getElementById('phase-modal-close').addEventListener('click', closePhaseEditor);
    document.getElementById('ph-cancel').addEventListener('click', closePhaseEditor);
    document.getElementById('ph-save').addEventListener('click', savePhase);
    document.getElementById('ph-delete').addEventListener('click', deletePhase);

    // Import modal wiring
    document.getElementById('import-modal-close').addEventListener('click', closeImportModal);
    document.getElementById('import-cancel').addEventListener('click', closeImportModal);
    document.getElementById('import-confirm').addEventListener('click', confirmImport);

    // Click-outside-to-close modal backdrops
    ['inject-modal', 'phase-modal', 'import-modal', 'guide-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e.target.id === id) el.classList.add('hidden');
      });
    });
  }

  // Kick off once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
