// ContractingHQ — Main JS

// ===== NAV SCROLL =====
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ===== MOBILE NAV =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ===== RENDER VIDEOS =====
function renderVideos() {
  const grid = document.getElementById('videoGrid');
  if (!grid || !window.VIDEOS) return;
  grid.innerHTML = VIDEOS.map(v => `
    <div class="video-card">
      <div class="video-thumb">
        ${v.youtubeId
          ? `<iframe src="https://www.youtube.com/embed/${v.youtubeId}" allowfullscreen loading="lazy"></iframe>`
          : `<div class="video-thumb-placeholder">
               <span class="play-icon">&#9654;</span>
               <span class="coming-soon-badge">Coming Soon</span>
             </div>`
        }
      </div>
      <div class="video-info">
        <div class="video-category">${v.category}</div>
        <h3>${v.title}</h3>
        <p>${v.description}</p>
      </div>
    </div>
  `).join('');
}

// ===== RENDER GAO =====
function renderGaoCards(decisions) {
  return decisions.map(d => `
    <div class="gao-card">
      <div class="gao-card-header">
        <div>
          <div class="gao-case">${d.caseName}</div>
          <div class="gao-case-meta">
            ${d.caseNumber} · ${d.date}
            ${d.link ? `<a href="${d.link}" target="_blank" rel="noopener" class="gao-case-link">View Decision →</a>` : ''}
          </div>
        </div>
        <span class="gao-outcome outcome-${d.outcome}">${d.outcome}</span>
      </div>
      <p class="gao-summary">${d.summary}</p>
      ${d.bottomLine ? `
      <div class="gao-bottom-line">
        <div class="gao-bl-label">GAO's Words</div>
        <p>"${d.bottomLine}"</p>
      </div>
      ` : ''}
    </div>
  `).join('');
}

function renderGAO() {
  const currentEl = document.getElementById('gaoCurrentWeek');
  const archiveEl = document.getElementById('gaoArchive');
  if (!currentEl || !window.GAO_UPDATES || GAO_UPDATES.length === 0) return;

  const current = GAO_UPDATES[0];
  currentEl.innerHTML = `
    <div class="gao-week-header">
      <span class="gao-week-label">Week of ${current.weekOf}</span>
      <span class="gao-week-date">Current</span>
    </div>
    <div class="gao-cards">${renderGaoCards(current.decisions)}</div>
  `;

  // Archive section (used on gao-archive.html — optional on index)
  if (archiveEl) {
    archiveEl.innerHTML = GAO_UPDATES.slice(1).map((week, i) => `
      <div class="archive-item">
        <button class="archive-toggle" onclick="toggleArchive(this)">
          <span>Week of ${week.weekOf} &mdash; ${week.decisions.length} decision${week.decisions.length !== 1 ? 's' : ''}</span>
          <span class="chevron">&#9660;</span>
        </button>
        <div class="archive-body">
          <div class="gao-cards">${renderGaoCards(week.decisions)}</div>
        </div>
      </div>
    `).join('');
  }
}

function toggleArchive(btn) {
  btn.classList.toggle('open');
  const body = btn.nextElementSibling;
  body.classList.toggle('open');
}

// ===== RENDER TOOLS =====
function renderTools() {
  const grid = document.getElementById('toolsGrid');
  if (!grid || !window.TOOLS) return;
  grid.innerHTML = TOOLS.map(t => `
    <div class="tool-card">
      <div class="tool-icon">${t.icon}</div>
      <h3>${t.title}</h3>
      <p>${t.description}</p>
      ${t.comingSoon
        ? '<span class="tool-link coming">Coming Soon</span>'
        : `<a href="${t.url}" target="_blank" rel="noopener" class="tool-link">Open resource &#8594;</a>`
      }
    </div>
  `).join('');
}

// ===== RENDER FAR =====
function statusBadgeClass(status) {
  const map = { 'final': 'badge-final', 'proposed': 'badge-proposed', 'interim': 'badge-interim' };
  return map[status] || 'badge-proposed';
}

function renderFAR() {
  const list = document.getElementById('farList');
  if (!list || !window.FAR_UPDATES) return;
  list.innerHTML = FAR_UPDATES.map(f => `
    <div class="far-card">
      <div class="far-header" onclick="toggleFAR(this)">
        <div class="far-header-left">
          <div class="far-date">${f.date} &middot; ${f.farCase}</div>
          <div class="far-title">${f.title}</div>
        </div>
        <div class="far-badges">
          <span class="far-badge ${statusBadgeClass(f.status)}">${f.status}</span>
          <span style="color:#8a9bb0;font-size:0.8rem;align-self:center;">&#9660;</span>
        </div>
      </div>
      <div class="far-body">
        <p>${f.summary}</p>
        <div class="far-practitioner">
          <div class="far-practitioner-label">&#9993; Practitioner Note</div>
          <p>${f.practitionerNote}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleFAR(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderVideos();
  renderGAO();
  renderTools();
  renderFAR();
});
