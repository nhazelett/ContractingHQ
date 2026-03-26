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
      '<div class="gao-bottom-line">' +
        '<div class="gao-bl-label">Bottom Line (GAO\'s Words)</div>' +
        '<p>' + d.bottomLine + '</p>' +
      '</div>' +
      '<div class="gao-takeaway">' +
        '<div class="gao-takeaway-label">CO Takeaway</div>' +
        '<p>' + d.takeaway + '</p>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Render the current week on gao-decisions.html
document.addEventListener('DOMContentLoaded', function () {
  var container = document.getElementById('gaoCurrentWeek');
  if (!container || !window.GAO_UPDATES || GAO_UPDATES.length === 0) return;

  var week = GAO_UPDATES[0];
  container.innerHTML =
    '<div class="gao-week-header">' +
      '<span class="gao-week-label">Week of ' + week.weekOf + '</span>' +
      '<span class="gao-week-date">Current</span>' +
    '</div>' +
    '<div class="gao-cards">' + renderGaoCards(week.decisions) + '</div>';
});
