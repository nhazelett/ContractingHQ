/* One passive progress listener survives ContractingFM's page swaps. No content changes. */
(function () {
  'use strict';
  if (!window.KTHQWorkingTheoryProgress) {
    var queued = false;
    function update() {
      queued = false;
      var bar = document.getElementById('wt-reading-progress');
      var essay = document.getElementById('essay-body');
      if (!bar || !essay) return;
      var visible = essay.getClientRects().length > 0;
      bar.hidden = !visible;
      if (!visible) return;
      var rect = essay.getBoundingClientRect();
      var start = window.scrollY + rect.top - 96;
      var distance = Math.max(1, rect.height - window.innerHeight + 192);
      var progress = Math.max(0, Math.min(1, (window.scrollY - start) / distance));
      bar.style.transform = 'scaleX(' + progress + ')';
    }
    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }
    window.KTHQWorkingTheoryProgress = schedule;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('click', schedule);
  }
  window.KTHQWorkingTheoryProgress();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(window.KTHQWorkingTheoryProgress);
  }
})();
