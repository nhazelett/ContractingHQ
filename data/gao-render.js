// ContractingHQ — GAO Rendering Functions
// Shared between gao-decisions.html and gao-archive.html

function renderGaoCards(decisions) {
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
            '<a href="' + d.link + '" target="_blank" rel="noopener" class="gao-case-link">Read full decision &rarr;</a>' +
          '</div>' +
        '</div>' +
        '<span class="gao-outcome ' + outcomeClass + '">' + outcomeLabel + '</span>' +
      '</div>' +
      '<p class="gao-summary">' + d.summary + '</p>' +
      (d.bottomLine ? '<div class="gao-bottom-line">' +
        '<div class="gao-bl-label">Bottom Line (GAO\'s Words)</div>' +
        '<p>' + d.bottomLine + '</p>' +
      '</div>' : '') +
      (d.takeaway ? '<div class="gao-takeaway">' +
        '<div class="gao-takeaway-label">CO Takeaway</div>' +
        '<p>' + d.takeaway + '</p>' +
      '</div>' : '') +
    '</div>';
  }).join('');
}

// Render the current week on gao-decisions.html
function initGaoCurrentWeek() {
  var container = document.getElementById('gaoCurrentWeek');
  if (!container || !window.GAO_UPDATES || GAO_UPDATES.length === 0) return;
  if (container.innerHTML.trim() !== '') return; // already rendered

  var week = GAO_UPDATES[0];
  container.innerHTML =
    '<div class="gao-week-header">' +
      '<span class="gao-week-label">Week of ' + week.weekOf + '</span>' +
      '<span class="gao-week-date">Current</span>' +
    '</div>' +
    '<div class="gao-cards">' + renderGaoCards(week.decisions) + '</div>';
}

// Run on DOMContentLoaded, or immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGaoCurrentWeek);
} else {
  initGaoCurrentWeek();
}
