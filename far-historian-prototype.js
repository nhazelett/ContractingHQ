(function () {
  'use strict';

  const DIRECT_BASE = 'https://www.ecfr.gov/api/versioner/v1';
  const DEFAULT_PROXY = 'https://far-historian.nickhazelett.workers.dev/api/ecfr';
  const params = new URLSearchParams(location.search);
  const PROXY_BASE = (params.get('worker') || DEFAULT_PROXY).replace(/\/$/, '');

  const PARTS = [
    [1, 'Federal Acquisition Regulations System'],
    [2, 'Definitions of Words and Terms'],
    [3, 'Improper Business Practices and Personal Conflicts of Interest'],
    [4, 'Administrative and Information Matters'],
    [5, 'Publicizing Contract Actions'],
    [6, 'Competition Requirements'],
    [7, 'Acquisition Planning'],
    [8, 'Required Sources of Supplies and Services'],
    [9, 'Contractor Qualifications'],
    [10, 'Market Research'],
    [11, 'Describing Agency Needs'],
    [12, 'Acquisition of Commercial Products and Commercial Services'],
    [13, 'Simplified Acquisition Procedures'],
    [14, 'Sealed Bidding'],
    [15, 'Contracting by Negotiation'],
    [16, 'Types of Contracts'],
    [17, 'Special Contracting Methods'],
    [18, 'Emergency Acquisitions'],
    [19, 'Small Business Programs'],
    [22, 'Application of Labor Laws to Government Acquisitions'],
    [23, 'Environment, Energy, Water Efficiency, Safety, and Drug-Free Workplace'],
    [24, 'Protection of Privacy and Freedom of Information'],
    [25, 'Foreign Acquisition'],
    [26, 'Other Socioeconomic Programs'],
    [27, 'Patents, Data, and Copyrights'],
    [28, 'Bonds and Insurance'],
    [29, 'Taxes'],
    [30, 'Cost Accounting Standards Administration'],
    [31, 'Contract Cost Principles and Procedures'],
    [32, 'Contract Financing'],
    [33, 'Protests, Disputes, and Appeals'],
    [34, 'Major System Acquisition'],
    [35, 'Research and Development Contracting'],
    [36, 'Construction and Architect-Engineer Contracts'],
    [37, 'Service Contracting'],
    [38, 'Federal Supply Schedule Contracting'],
    [39, 'Acquisition of Information Technology'],
    [40, 'Information Security and Supply Chain Security'],
    [41, 'Acquisition of Utility Services'],
    [42, 'Contract Administration and Audit Services'],
    [43, 'Contract Modifications'],
    [44, 'Subcontracting Policies and Procedures'],
    [45, 'Government Property'],
    [46, 'Quality Assurance'],
    [47, 'Transportation'],
    [48, 'Value Engineering'],
    [49, 'Termination of Contracts'],
    [50, 'Extraordinary Contractual Actions and the Safety Act'],
    [51, 'Use of Government Sources by Contractors'],
    [52, 'Solicitation Provisions and Contract Clauses'],
    [53, 'Forms']
  ];

  const ui = {
    part: document.querySelector('#part-select'),
    subpartWrap: document.querySelector('#subpart-wrap'),
    subpart: document.querySelector('#subpart-select'),
    historical: document.querySelector('#historical-date'),
    current: document.querySelector('#current-date'),
    ledger: document.querySelector('#ledger-summary'),
    health: document.querySelector('#data-health'),
    compare: document.querySelector('#compare-button'),
    loading: document.querySelector('#loading-panel'),
    loadingTitle: document.querySelector('#loading-title'),
    loadingDetail: document.querySelector('#loading-detail'),
    error: document.querySelector('#error-panel'),
    errorMessage: document.querySelector('#error-message'),
    retry: document.querySelector('#retry-button'),
    results: document.querySelector('#comparison'),
    resultsKicker: document.querySelector('#results-kicker'),
    summaryRange: document.querySelector('#summary-range'),
    summaryPart: document.querySelector('#summary-part'),
    changedCount: document.querySelector('#changed-count'),
    addedCount: document.querySelector('#added-count'),
    removedCount: document.querySelector('#removed-count'),
    changedOnly: document.querySelector('#changed-only'),
    sectionList: document.querySelector('#section-list'),
    record: document.querySelector('#record'),
    recordBody: document.querySelector('#record-body'),
    recordEmpty: document.querySelector('#record-empty'),
    newComparison: document.querySelector('#new-comparison'),
    viewButtons: Array.from(document.querySelectorAll('[data-view]'))
  };

  const state = {
    part: params.get('part') || '15',
    subpart: params.get('subpart') || '52.2',
    dates: [],
    records: [],
    from: params.get('from') || null,
    to: null,
    view: params.get('view') === 'split' ? 'split' : 'redline',
    comparison: null,
    sequence: 0,
    lastAction: null
  };

  const snapshotCache = new Map();
  let activeController = null;

  PARTS.forEach(([number, title]) => {
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = `Part ${number} — ${title}`;
    ui.part.appendChild(option);
  });
  if (!PARTS.some(([number]) => String(number) === state.part)) state.part = '15';
  ui.part.value = state.part;
  ui.subpart.value = state.subpart;
  ui.subpartWrap.hidden = state.part !== '52';
  setView(state.view);

  ui.part.addEventListener('change', () => {
    state.part = ui.part.value;
    state.from = null;
    ui.subpartWrap.hidden = state.part !== '52';
    state.lastAction = 'ledger';
    loadLedger();
  });

  ui.subpart.addEventListener('change', () => {
    state.subpart = ui.subpart.value;
    state.from = null;
    state.lastAction = 'ledger';
    loadLedger();
  });

  ui.historical.addEventListener('change', () => {
    state.from = ui.historical.value;
    ui.compare.disabled = !canCompare();
    writeUrl(false);
  });

  ui.compare.addEventListener('click', () => {
    state.lastAction = 'compare';
    compareEditions(true);
  });

  ui.retry.addEventListener('click', () => {
    if (state.lastAction === 'compare' && canCompare()) compareEditions(false);
    else loadLedger();
  });

  ui.newComparison.addEventListener('click', () => {
    document.querySelector('.compare-deck').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    ui.historical.focus({ preventScroll: true });
  });

  ui.changedOnly.addEventListener('change', applyChangedFilter);
  ui.viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

  loadLedger();

  async function loadLedger() {
    const sequence = beginRequest();
    state.lastAction = 'ledger';
    ui.compare.disabled = true;
    ui.historical.disabled = true;
    ui.historical.innerHTML = '<option>Loading amendment dates…</option>';
    ui.current.textContent = 'Checking latest edition…';
    ui.ledger.textContent = 'Reading the official amendment ledger…';
    setHealth('loading', 'Connecting to the FAR archive…');
    hideError();

    try {
      const records = await fetchVersions(state.part, activeController.signal);
      if (sequence !== state.sequence) return;
      state.records = records;
      const scoped = records.filter(inScope);
      state.dates = Array.from(new Set(scoped.map((record) => record.date).filter(Boolean))).sort();
      if (state.dates.length < 2) throw new Error('The archive does not contain two comparable editions for this selection.');

      state.to = state.dates[state.dates.length - 1];
      const requested = state.from && state.dates.includes(state.from) && state.from !== state.to ? state.from : null;
      state.from = requested || state.dates[state.dates.length - 2];
      renderDateOptions();
      ui.current.textContent = formatDate(state.to);
      ui.ledger.innerHTML = `<b>${state.dates.length}</b> recorded amendment dates · ${formatDate(state.dates[0])} through ${formatDate(state.to)}`;
      setHealth('ready', 'Archive ready · newest edition locked for comparison');
      ui.compare.disabled = !canCompare();
      writeUrl(false);
    } catch (error) {
      if (isAbort(error) || sequence !== state.sequence) return;
      setHealth('error', 'The FAR archive could not be reached');
      showError(friendlyError(error));
    }
  }

  async function fetchVersions(part, signal) {
    const records = [];
    let page = 1;
    let totalPages = 1;
    do {
      const text = await requestArchive(`/versions/title-48.json?part=${encodeURIComponent(part)}&page=${page}`, signal, 'amendment ledger');
      const payload = JSON.parse(text);
      records.push(...(payload.content_versions || []).filter((record) => record.type === 'section'));
      totalPages = Number(payload.meta && payload.meta.total_pages) || 1;
      page += 1;
    } while (page <= totalPages);
    return records;
  }

  async function compareEditions(scrollToResults) {
    if (!canCompare()) return;
    const sequence = beginRequest();
    state.lastAction = 'compare';
    hideError();
    ui.results.hidden = true;
    ui.loading.hidden = false;
    ui.loadingTitle.textContent = 'Retrieving both editions';
    ui.loadingDetail.textContent = `${formatDate(state.from)} and ${formatDate(state.to)} · ${partLabel()}`;
    ui.compare.disabled = true;
    setHealth('loading', 'Building a verified point-in-time comparison…');

    try {
      const [older, newer] = await Promise.all([
        getSnapshot(state.from, activeController.signal),
        getSnapshot(state.to, activeController.signal)
      ]);
      if (sequence !== state.sequence) return;
      state.comparison = buildComparison(older, newer);
      renderComparison();
      ui.loading.hidden = true;
      ui.results.hidden = false;
      ui.compare.disabled = false;
      setHealth('ready', 'Comparison complete · both editions verified');
      writeUrl(true);
      if (scrollToResults) ui.results.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (error) {
      if (isAbort(error) || sequence !== state.sequence) return;
      ui.loading.hidden = true;
      ui.compare.disabled = false;
      setHealth('error', 'Comparison interrupted · your selections are preserved');
      showError(friendlyError(error));
    }
  }

  async function getSnapshot(date, signal) {
    const scope = state.part === '52' ? `&subpart=${encodeURIComponent(state.subpart)}` : '';
    const key = `${state.part}|${scope}|${date}`;
    if (snapshotCache.has(key)) return snapshotCache.get(key);
    const xml = await requestArchive(`/full/${date}/title-48.xml?part=${encodeURIComponent(state.part)}${scope}`, signal, `${formatDate(date)} edition`);
    const snapshot = parsePart(xml);
    if (!snapshot.order.length) throw new Error(`The ${formatDate(date)} edition returned no readable sections.`);
    snapshotCache.set(key, snapshot);
    return snapshot;
  }

  async function requestArchive(path, signal, label) {
    const sources = [
      { name: 'KTHQ archive cache', base: PROXY_BASE, timeout: 30000 },
      { name: 'eCFR direct', base: DIRECT_BASE, timeout: 15000 }
    ];
    const errors = [];

    for (const source of sources) {
      if (signal.aborted) throw abortError();
      try {
        const response = await fetchWithTimeout(source.base + path, source.timeout, signal);
        if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        if (isAbort(error) && signal.aborted) throw error;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(`${label} failed through both archive routes. ${errors.join(' · ')}`);
  }

  async function fetchWithTimeout(url, timeout, parentSignal) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new DOMException('Request timed out', 'TimeoutError')), timeout);
    const abortFromParent = () => timeoutController.abort(parentSignal.reason || abortError());
    parentSignal.addEventListener('abort', abortFromParent, { once: true });
    try {
      return await fetch(url, {
        signal: timeoutController.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json, application/xml, text/xml;q=0.9, */*;q=0.8' }
      });
    } finally {
      clearTimeout(timer);
      parentSignal.removeEventListener('abort', abortFromParent);
    }
  }

  function parsePart(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('The archive returned malformed XML.');
    const root = doc.querySelector('DIV5,DIV6');
    const headingNode = root && root.querySelector(':scope > HEAD');
    const nodes = Array.from(doc.querySelectorAll('DIV8,[TYPE="SECTION"]'));
    const order = [];
    const map = new Map();

    nodes.forEach((node) => {
      const id = node.getAttribute('N');
      if (!id || map.has(id)) return;
      const head = node.querySelector('HEAD');
      const paragraphs = Array.from(node.querySelectorAll('P,FP'))
        .map((paragraph) => collapse(paragraph.textContent))
        .filter(Boolean);
      const record = {
        id,
        title: head ? collapse(head.textContent) : `FAR ${id}`,
        paragraphs,
        text: paragraphs.join('\n\n')
      };
      order.push(id);
      map.set(id, record);
    });

    return { heading: headingNode ? collapse(headingNode.textContent) : partLabel(), order, map };
  }

  function buildComparison(older, newer) {
    const ids = mergeOrders(older.order, newer.order);
    const sections = ids.map((id) => {
      const oldSection = older.map.get(id) || null;
      const newSection = newer.map.get(id) || null;
      let status = 'unchanged';
      if (!oldSection && newSection) status = 'added';
      else if (oldSection && !newSection) status = 'removed';
      else if (oldSection.text !== newSection.text || oldSection.title !== newSection.title) status = 'changed';
      return {
        id,
        title: (newSection || oldSection).title,
        oldSection,
        newSection,
        status
      };
    });
    return { sections };
  }

  function renderComparison() {
    const sections = state.comparison.sections;
    const changed = sections.filter((section) => section.status === 'changed').length;
    const added = sections.filter((section) => section.status === 'added').length;
    const removed = sections.filter((section) => section.status === 'removed').length;
    const material = changed + added + removed;

    ui.resultsKicker.textContent = material ? `${material} sections with material differences` : 'No material differences found';
    ui.summaryRange.textContent = `${formatDate(state.from)} → ${formatDate(state.to)}`;
    ui.summaryPart.textContent = partLabel();
    ui.changedCount.textContent = String(changed);
    ui.addedCount.textContent = String(added);
    ui.removedCount.textContent = String(removed);

    ui.sectionList.innerHTML = sections.map((section) => `
      <button type="button" data-target="sec-${cssId(section.id)}" data-status="${section.status}">
        <span>FAR ${escapeHtml(section.id)}</span>
        <span class="nav-state ${section.status}" aria-label="${section.status}"></span>
      </button>`).join('');

    ui.recordBody.innerHTML = sections.map(renderSection).join('');
    ui.sectionList.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }));
    applyChangedFilter();
  }

  function renderSection(section) {
    const oldText = section.oldSection ? section.oldSection.text : '';
    const newText = section.newSection ? section.newSection.text : '';
    let redline;
    if (section.status === 'added') redline = `<p><ins>${escapeHtml(newText || '(Reserved)')}</ins></p>`;
    else if (section.status === 'removed') redline = `<p><del>${escapeHtml(oldText || '(Reserved)')}</del></p>`;
    else if (section.status === 'changed') redline = renderDiff(oldText, newText);
    else redline = paragraphsHtml(section.newSection || section.oldSection);

    return `<section class="far-section" id="sec-${cssId(section.id)}" data-status="${section.status}">
      <div class="section-meta">
        <span class="section-cite">FAR ${escapeHtml(section.id)}</span>
        <span class="section-state ${section.status}">${statusLabel(section.status)}</span>
      </div>
      <h3>${escapeHtml(section.title)}</h3>
      <div class="redline-body">${redline}</div>
      <div class="split-body">
        <div class="split-column old">
          <div class="edition-heading">Historical · ${formatDate(state.from)}</div>
          <div class="edition-copy">${section.oldSection ? paragraphsHtml(section.oldSection) : '<p class="missing-copy">Section did not exist in this edition.</p>'}</div>
        </div>
        <div class="split-column new">
          <div class="edition-heading">Newest · ${formatDate(state.to)}</div>
          <div class="edition-copy">${section.newSection ? paragraphsHtml(section.newSection) : '<p class="missing-copy">Section is no longer present.</p>'}</div>
        </div>
      </div>
    </section>`;
  }

  function renderDiff(oldText, newText) {
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    let prefix = 0;
    while (prefix < oldTokens.length && prefix < newTokens.length && oldTokens[prefix] === newTokens[prefix]) prefix += 1;
    let oldEnd = oldTokens.length;
    let newEnd = newTokens.length;
    while (oldEnd > prefix && newEnd > prefix && oldTokens[oldEnd - 1] === newTokens[newEnd - 1]) {
      oldEnd -= 1;
      newEnd -= 1;
    }

    const oldCore = oldTokens.slice(prefix, oldEnd);
    const newCore = newTokens.slice(prefix, newEnd);
    if (oldCore.length * newCore.length > 1600000) return paragraphDiff(oldText, newText);

    const rows = oldCore.length + 1;
    const columns = newCore.length + 1;
    const matrix = Array.from({ length: rows }, () => new Uint16Array(columns));
    for (let i = oldCore.length - 1; i >= 0; i -= 1) {
      for (let j = newCore.length - 1; j >= 0; j -= 1) {
        matrix[i][j] = oldCore[i] === newCore[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }

    const similarity = matrix[0][0] / Math.max(oldCore.length, newCore.length, 1);
    if (similarity < 0.58) return replacementDiff(oldText, newText);

    const sequence = [];
    oldTokens.slice(0, prefix).forEach((token) => sequence.push(['same', token]));
    let i = 0;
    let j = 0;
    while (i < oldCore.length && j < newCore.length) {
      if (oldCore[i] === newCore[j]) {
        sequence.push(['same', oldCore[i]]); i += 1; j += 1;
      } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
        sequence.push(['removed', oldCore[i]]); i += 1;
      } else {
        sequence.push(['added', newCore[j]]); j += 1;
      }
    }
    while (i < oldCore.length) { sequence.push(['removed', oldCore[i]]); i += 1; }
    while (j < newCore.length) { sequence.push(['added', newCore[j]]); j += 1; }
    oldTokens.slice(oldEnd).forEach((token) => sequence.push(['same', token]));

    let output = '';
    let buffer = '';
    let activeType = null;
    const flush = () => {
      if (!buffer) return;
      const safe = escapeHtml(buffer);
      output += activeType === 'removed' ? `<del>${safe}</del>` : activeType === 'added' ? `<ins>${safe}</ins>` : safe;
      buffer = '';
    };
    sequence.forEach(([type, token]) => {
      if (type !== activeType) { flush(); activeType = type; }
      buffer += token;
    });
    flush();
    return `<p>${output.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, ' ')}</p>`;
  }

  function paragraphDiff(oldText, newText) {
    const oldParagraphs = oldText.split(/\n{2,}/).filter(Boolean);
    const newParagraphs = newText.split(/\n{2,}/).filter(Boolean);
    const oldSet = new Set(oldParagraphs);
    const newSet = new Set(newParagraphs);
    const removed = oldParagraphs.filter((paragraph) => !newSet.has(paragraph)).map((paragraph) => `<p><del>${escapeHtml(paragraph)}</del></p>`);
    const added = newParagraphs.filter((paragraph) => !oldSet.has(paragraph)).map((paragraph) => `<p><ins>${escapeHtml(paragraph)}</ins></p>`);
    const retained = newParagraphs.filter((paragraph) => oldSet.has(paragraph)).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`);
    return [...removed, ...added, ...retained].join('');
  }

  function replacementDiff(oldText, newText) {
    const removed = oldText.split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p><del>${escapeHtml(paragraph)}</del></p>`);
    const added = newText.split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p><ins>${escapeHtml(paragraph)}</ins></p>`);
    return [...removed, ...added].join('');
  }

  function renderDateOptions() {
    const olderDates = state.dates.filter((date) => date !== state.to).reverse();
    ui.historical.innerHTML = olderDates.map((date) => {
      const changes = state.records.filter((record) => inScope(record) && record.date === date).length;
      return `<option value="${date}"${date === state.from ? ' selected' : ''}>${formatDate(date)} · ${changes} changed ${changes === 1 ? 'section' : 'sections'}</option>`;
    }).join('');
    ui.historical.disabled = false;
  }

  function applyChangedFilter() {
    if (!state.comparison) return;
    const changedOnly = ui.changedOnly.checked;
    let visible = 0;
    document.querySelectorAll('.far-section').forEach((section) => {
      const hide = changedOnly && section.dataset.status === 'unchanged';
      section.hidden = hide;
      if (!hide) visible += 1;
    });
    ui.sectionList.querySelectorAll('button').forEach((button) => {
      button.hidden = changedOnly && button.dataset.status === 'unchanged';
    });
    ui.recordEmpty.hidden = visible !== 0;
  }

  function setView(view) {
    state.view = view === 'split' ? 'split' : 'redline';
    ui.record.dataset.view = state.view;
    ui.viewButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    writeUrl(Boolean(state.comparison));
  }

  function beginRequest() {
    state.sequence += 1;
    if (activeController) activeController.abort();
    activeController = new AbortController();
    return state.sequence;
  }

  function canCompare() {
    return Boolean(state.from && state.to && state.from !== state.to);
  }

  function inScope(record) {
    return state.part !== '52' || record.subpart === state.subpart;
  }

  function partLabel() {
    const title = (PARTS.find(([number]) => String(number) === state.part) || [null, ''])[1];
    return state.part === '52' ? `FAR Part 52 · ${state.subpart}` : `FAR Part ${state.part} · ${title}`;
  }

  function mergeOrders(oldOrder, newOrder) {
    const newSet = new Set(newOrder);
    const merged = newOrder.slice();
    let anchor = -1;
    oldOrder.forEach((id) => {
      if (newSet.has(id)) { anchor = merged.indexOf(id); return; }
      merged.splice(anchor + 1, 0, id);
      anchor += 1;
    });
    return merged;
  }

  function paragraphsHtml(section) {
    if (!section || !section.paragraphs.length) return '<p>(Reserved)</p>';
    return section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  }

  function tokenize(value) {
    return String(value || '').match(/\n\n|\s+|[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g) || [];
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function collapse(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cssId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function statusLabel(status) {
    return status === 'changed' ? 'Revised' : status === 'added' ? 'Added' : status === 'removed' ? 'Removed' : 'Unchanged';
  }

  function setHealth(mode, message) {
    ui.health.classList.remove('ready', 'error');
    if (mode === 'ready') ui.health.classList.add('ready');
    if (mode === 'error') ui.health.classList.add('error');
    ui.health.querySelector('span:last-child').textContent = message;
  }

  function showError(message) {
    ui.loading.hidden = true;
    ui.errorMessage.textContent = message;
    ui.error.hidden = false;
  }

  function hideError() {
    ui.error.hidden = true;
  }

  function friendlyError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|timeout/i.test(message)) return 'The official FAR archive took too long to respond. Your selections are preserved; try again in a moment.';
    if (/Failed to fetch|NetworkError|both archive routes/i.test(message)) return 'Neither the KTHQ archive cache nor the direct eCFR connection completed the request. Your selections are preserved.';
    return message;
  }

  function isAbort(error) {
    return Boolean(error && (error.name === 'AbortError' || error.name === 'TimeoutError'));
  }

  function abortError() {
    return new DOMException('Request cancelled', 'AbortError');
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function writeUrl(includeComparison) {
    const query = new URLSearchParams();
    query.set('part', state.part);
    if (state.part === '52') query.set('subpart', state.subpart);
    if (state.from) query.set('from', state.from);
    if (includeComparison) query.set('view', state.view);
    if (params.get('worker')) query.set('worker', params.get('worker'));
    history.replaceState(null, '', `${location.pathname}?${query.toString()}${location.hash}`);
  }
})();
