/* ============================================================
   Federal Register Digest — Shared Rendering Module
   Loaded by federal-register.html and federal-register-archive.html
   ============================================================ */

function renderFrCards(entries) {
  if (!entries || entries.length === 0) {
    return '<div class="fr-empty">No FAR or DFARS activity to report this period.</div>';
  }
  return entries.map(function (e) {
    var typeClass = 'fr-type-' + (e.type || 'rule').toLowerCase().replace(/\s+/g, '-');
    return '<div class="fr-card">' +
      '<div class="fr-card-header">' +
        '<div>' +
          '<div class="fr-title">' + e.title + '</div>' +
          '<div class="fr-meta">' +
            '<span class="fr-type-badge ' + typeClass + '">' + e.type + '</span>' +
            '<span>' + e.published + '</span>' +
            (e.citation ? '<span>' + e.citation + '</span>' : '') +
            (e.farParts ? '<span>' + e.farParts + '</span>' : '') +
            '<a href="' + e.frLink + '" target="_blank" rel="noopener" class="fr-link">Read full rule &rarr;</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="fr-summary">' + e.summary + '</p>' +
      (e.coImpact ? '<div class="fr-impact">' +
        '<div class="fr-impact-label">CO Impact</div>' +
        '<p>' + e.coImpact + '</p>' +
      '</div>' : '') +
    '</div>';
  }).join('');
}

/* Populate the current-week container on federal-register.html */
function initFrCurrentDigest() {
  var container = document.getElementById('frCurrentDigest');
  if (!container || !window.FR_DIGESTS || FR_DIGESTS.length === 0) return;
  if (container.innerHTML.trim() !== '') return;

  var digest = FR_DIGESTS[0];
  container.innerHTML =
    '<div class="fr-digest-header">' +
      '<span class="fr-digest-label">Week of ' + digest.weekOf + '</span>' +
      '<span class="fr-digest-date">Current</span>' +
    '</div>' +
    (digest.intro ? '<p class="fr-digest-intro">' + digest.intro + '</p>' : '') +
    '<div class="fr-cards">' + renderFrCards(digest.entries) + '</div>';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFrCurrentDigest);
} else {
  initFrCurrentDigest();
}
