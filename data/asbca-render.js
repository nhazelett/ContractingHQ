/* ============================================================
   ASBCA Decisions — Shared Rendering Module
   Loaded by asbca.html and asbca-archive.html
   ============================================================ */

function renderAsbcaCards(decisions) {
  if (!decisions || decisions.length === 0) {
    return '<div class="fr-empty">No ASBCA decisions to report this period.</div>';
  }
  return decisions.map(function (d) {
    var outcomeClass = 'outcome-' + d.outcome;
    var outcomeLabel = d.outcome.charAt(0).toUpperCase() + d.outcome.slice(1);
    return '<div class="gao-card">' +
      '<div class="gao-card-header">' +
        '<div>' +
          '<div class="gao-case">' + d.caseName + '</div>' +
          '<div class="gao-case-meta">' +
            '<span>' + d.caseNumber + '</span>' +
            '<span>' + d.date + '</span>' +
            '<span>Judge ' + d.judge + '</span>' +
            (d.decisionType ? '<span class="asbca-type-tag">' + d.decisionType + '</span>' : '') +
            (d.link ? '<a href="' + d.link + '" target="_blank" rel="noopener" class="gao-case-link">ASBCA Decisions &rarr;</a>' : '') +
          '</div>' +
        '</div>' +
        '<span class="gao-outcome ' + outcomeClass + '">' + outcomeLabel + '</span>' +
      '</div>' +
      '<p class="gao-summary">' + d.summary + '</p>' +
      (d.bottomLine ? '<div class="gao-bottom-line"><div class="gao-bl-label">Board\'s Holding</div><p>' + d.bottomLine + '</p></div>' : '') +
      (d.takeaway ? '<div class="gao-takeaway"><div class="gao-takeaway-label">CO Takeaway</div><p>' + d.takeaway + '</p></div>' : '') +
    '</div>';
  }).join('');
}

/* Populate the current-month container on asbca.html */
function initAsbcaCurrentWeek() {
  var container = document.getElementById('asbcaCurrentWeek');
  if (!container || !window.ASBCA_DECISIONS || ASBCA_DECISIONS.length === 0) return;
  if (container.innerHTML.trim() !== '') return;

  var period = ASBCA_DECISIONS[0];
  container.innerHTML =
    '<div class="gao-week-header">' +
      '<span class="gao-week-label">' + period.weekOf + '</span>' +
      '<span class="gao-week-date">Current</span>' +
    '</div>' +
    (period.intro ? '<p class="fr-digest-intro">' + period.intro + '</p>' : '') +
    '<div class="gao-cards">' + renderAsbcaCards(period.decisions) + '</div>';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAsbcaCurrentWeek);
} else {
  initAsbcaCurrentWeek();
}
