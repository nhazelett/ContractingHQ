/* KTHQ annual theme controller. Also supports player.js soft page navigation. */
(function () {
  'use strict';
  if (typeof window.KTHQSeasonCleanup === 'function') window.KTHQSeasonCleanup();
  if (typeof window.KTHQHarvestCleanup === 'function') window.KTHQHarvestCleanup();
  var calendar = window.KTHQSeasonCalendar;
  if (!calendar) return; // The unthemed page is the safe fallback.

  function start() {
    var hero = document.querySelector('[data-season-surface]');
    if (!hero) return;
    var root = document.documentElement;
    var body = document.body;
    var config = window.KTHQSeasonConfig || {};
    var query = new URLSearchParams(window.location.search);
    var preview = query.get('theme');
    var previewDate = query.get('theme-date');
    var validDate = false;
    try {
      validDate = /^\d{4}-\d{2}-\d{2}$/.test(previewDate || '') &&
        new Date(previewDate + 'T12:00:00Z').toISOString().slice(0, 10) === previewDate &&
        Number(previewDate.slice(0, 4)) > 0;
    } catch (_) { /* Ignore malformed preview dates. */ }
    var isPreview = calendar.themes.indexOf(preview) !== -1 || validDate;
    var standardKey = 'kthq-season-standard';
    var motionKey = 'kthq-season-motion-paused';
    function readPreference(key) { try { return localStorage.getItem(key) === '1'; } catch (_) { return false; } }
    function savePreference(key, value) { try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) { /* Optional preference. */ } }
    var preferStandard = readPreference(standardKey);
    var paused = readPreference(motionKey);
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var season = '';
    var celebrationYear = null;
    var disposed = false;
    var frame = 0;
    var clockTimer = 0;
    var lastDraw = 0;
    var width = 0;
    var height = 0;
    var particles = [];
    var visible = true;
    var cleanupListeners = [];
    var resizeObserver;
    var visibilityObserver;
    var pageObserver;
    var canvas = document.getElementById('seasonal-particles');
    var ctx = null;
    try { ctx = canvas && canvas.getContext('2d'); } catch (_) { /* Static theme remains available. */ }
    var fireworks = null;
    try { if (ctx && window.KTHQSeasonFireworks) fireworks = window.KTHQSeasonFireworks.create(ctx); } catch (_) { /* Keep the static New Year artwork. */ }
    var effects = { thanksgiving: 'leaves', christmas: 'snow', winter: fireworks ? 'fireworks' : null, independence: 'sparkles', halloween: 'embers' };
    var labels = { standard: 'Standard KTHQ', winter: 'New Year', valentine: 'Valentine’s', independence: 'Fourth of July', fiscal: 'End of Fiscal Year', halloween: 'Halloween', thanksgiving: 'Thanksgiving', christmas: 'Christmas' };
    var copy = {
      standard: { eyebrow: 'Built by practitioners. For practitioners.', greeting: '', message: '', action: 'Explore Training' },
      thanksgiving: {
        eyebrow: 'A season of gratitude', greeting: 'Thankful for the people who make the mission happen.',
        message: 'To the COs, specialists, CORs, customers, finance teams, and industry partners: thank you for everything you bring to the table.', action: 'Gobble up some knowledge'
      },
      christmas: {
        eyebrow: 'Christmas at KTHQ', greeting: 'Good people. A little Christmas magic.',
        message: 'For everyone who keeps the mission moving: may this season bring good company, a little peace, and time for what matters.', action: 'Unwrap some knowledge',
        title: 'A little brighter, together.', card: 'Shared knowledge is a gift that keeps on giving. Merry Christmas from your KTHQ community.',
        communityLabel: 'From our community to yours', communityTitle: 'Make room for the good stuff.',
        community: 'The people beside you. The families behind you. The little moments that make a long year worthwhile. Wherever this season finds you, you have a place here.'
      },
      winter: {
        eyebrow: 'Happy New Year', greeting: 'A new year deserves a little noise.',
        message: 'Here’s to good people, shared wins, and a few more reasons to celebrate. Happy New Year from KTHQ.', action: 'Start something new',
        title: 'Here’s to a good one.', card: 'May the new year bring good company and plenty worth celebrating.',
        communityLabel: 'Another year together', communityTitle: 'Glad you’re here.', community: 'Whether you’ve been here from the start or just found us, thanks for being part of KTHQ. Here’s to another year of figuring things out together.'
      },
      valentine: {
        eyebrow: 'A little appreciation goes a long way', greeting: 'For the people who care about getting it right.',
        message: 'Here’s to the teammates, mentors, and families who make the hard days easier and the good days better.', action: 'Find something to love',
        title: 'Better with good people.', card: 'Share a useful resource. Thank a mentor. Make someone’s day a little easier.',
        communityLabel: 'Pass it on', communityTitle: 'Good work has people behind it.', community: 'A patient explanation, a second set of eyes, a little encouragement. The small things add up. Thank you for bringing them to this community.'
      },
      independence: {
        eyebrow: 'An American summer', greeting: 'A shared purpose. A little summer spirit.',
        message: 'Celebrating Independence Day and the people who bring dedication, care, and good judgment to public service.', action: 'Explore Training',
        title: 'Celebrate the Fourth.', card: 'Here’s to the communities we serve and the people who make them stronger.',
        communityLabel: 'July at KTHQ', communityTitle: 'Good company. Shared purpose.', community: 'However you spend the summer, take a little time for the people and places that make the work matter.'
      },
      fiscal: {
        eyebrow: 'September · Fiscal year close', greeting: 'Finish strong. Keep your judgment.',
        message: 'A busy September calls for clear priorities, complete requirements, and a team that looks out for each other.', action: 'Sharpen your toolkit',
        title: 'One thoughtful decision at a time.', card: 'Stay steady. Ask the next good question. Take care of your people.',
        communityLabel: 'The September stretch', communityTitle: 'There are people behind every deadline.', community: 'Share what you know. Ask for help early. Bring a little patience to the next conversation. The mission needs good judgment all the way through.'
      },
      halloween: {
        eyebrow: 'October after dark', greeting: 'A little spooky. Still mission ready.',
        message: 'The season for crisp evenings, strange stories, and finally tackling that topic that’s been haunting you.', action: 'Unearth some knowledge',
        title: 'Curiosity after dark.', card: 'A good question can make even the unfamiliar feel a little less frightening.',
        communityLabel: 'An October invitation', communityTitle: 'Go looking for something new.', community: 'A lesson you have not tried. A tool you have not opened. A conversation worth having. There is always another corner of KTHQ to explore.'
      }
    };

    function listen(target, event, handler, options) {
      if (!target) return;
      target.addEventListener(event, handler, options);
      cleanupListeners.push(function () { target.removeEventListener(event, handler, options); });
    }
    function text(selector, value) {
      var el = document.querySelector(selector);
      if (el) { el.textContent = value || ''; el.hidden = !value; }
    }
    function configuredSeason() {
      return calendar.resolveSeason({ now: new Date(), timeZone: config.timeZone, mode: config.mode, preview: preview, previewDate: previewDate });
    }
    function newYearArt(year) {
      // Editable vector artwork keeps the celebration visible with motion disabled.
      function burst(x, y, radius, count, color) {
        var rays = '';
        for (var i = 0; i < count; i++) {
          var angle = i * Math.PI * 2 / count;
          var start = radius * (.25 + (i % 3) * .05);
          var end = radius * (i % 2 ? .82 : 1);
          var sx = (x + Math.cos(angle) * start).toFixed(2);
          var sy = (y + Math.sin(angle) * start).toFixed(2);
          var ex = (x + Math.cos(angle) * end).toFixed(2);
          var ey = (y + Math.sin(angle) * end).toFixed(2);
          rays += '<path d="M' + sx + ' ' + sy + 'L' + ex + ' ' + ey + '"/>';
          rays += '<circle cx="' + (x + Math.cos(angle) * end * 1.13).toFixed(2) + '" cy="' + (y + Math.sin(angle) * end * 1.13).toFixed(2) + '" r="1.35" fill="' + color + '" stroke="none"/>';
        }
        return '<g fill="none" stroke="' + color + '" stroke-width="1.2" stroke-linecap="round">' + rays + '</g>';
      }
      return '<div class="new-year-art" role="img" aria-label="Happy New Year ' + year + '. Gold and blue fireworks in a midnight sky.">' +
        '<svg viewBox="0 0 400 300" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
        burst(225, 83, 62, 28, '#f4d18b') + burst(72, 120, 43, 22, '#b3ceff') + burst(337, 139, 37, 20, '#c6a9ff') +
        '<g fill="#f6dda2"><path d="m147 64 2 7 7 2-7 2-2 7-2-7-7-2 7-2m154 13 1 5 5 1-5 1-1 5-1-5-5-1 5-1"/><circle cx="42" cy="200" r="2"/><circle cx="357" cy="76" r="1.5"/><circle cx="299" cy="207" r="1.5"/></g>' +
        '<path d="M51 267q149 32 298 0M101 278q99 14 198 0" fill="none" stroke="#f0cb80" stroke-width="1" opacity=".5"/></svg>' +
        '<span class="new-year-art-kicker" aria-hidden="true">Oh, hello.</span>' +
        '<span class="new-year-number" aria-hidden="true">' + year + '</span>' +
        '<span class="new-year-art-footer" aria-hidden="true">Let’s make it a good one</span></div>';
    }
    function emblem(name) {
      // Small native vector ornaments; content and colors remain editable in source.
      var svg = '<svg viewBox="0 0 300 270" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">';
      var base = '<ellipse cx="150" cy="242" rx="88" ry="10" fill="currentColor" opacity=".07"/>';
      var art = {
        valentine: '<g transform="rotate(-8 150 146)"><rect x="54" y="83" width="192" height="132" rx="9" fill="var(--season-surface-raised)" stroke="currentColor" stroke-opacity=".6"/><path d="m57 89 93 72 93-72M57 209l70-64m116 64-70-64" fill="none" stroke="currentColor" stroke-opacity=".4"/><circle cx="150" cy="154" r="27" fill="var(--season-bg)" stroke="currentColor"/><path d="M150 168c-30-18-16-37 0-24 16-13 30 6 0 24Z" fill="currentColor"/></g><path d="m75 46 2 8 8 2-8 2-2 8-2-8-8-2 8-2m151-18 2 9 9 2-9 2-2 9-2-9-9-2 9-2" fill="currentColor" opacity=".6"/>',
        independence: '<circle cx="150" cy="130" r="94" fill="none" stroke="currentColor" stroke-opacity=".2"/><circle cx="150" cy="130" r="82" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="1 9"/><path d="m150 52 23 48 53 8-38 37 9 53-47-25-47 25 9-53-38-37 53-8Z" fill="var(--season-surface-raised)" stroke="currentColor" stroke-width="2"/><path d="m150 52 0 78 76-22m-76 22 47 68m-47-68-47 68m47-68-76-22" fill="none" stroke="currentColor" stroke-opacity=".35"/><path d="M69 218h162" stroke="var(--season-secondary)" stroke-width="4"/><path d="M93 229h114" stroke="currentColor" stroke-width="2"/>',
        fiscal: '<g transform="rotate(-5 150 135)"><rect x="65" y="48" width="170" height="172" rx="12" fill="var(--season-surface-raised)" stroke="currentColor" stroke-opacity=".65"/><path d="M65 89h170M108 36v27m84-27v27" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><text x="150" y="143" text-anchor="middle" fill="currentColor" font-family="Georgia,serif" font-size="49">30</text><text x="150" y="175" text-anchor="middle" fill="currentColor" font-family="Inter,Arial,sans-serif" font-size="16" letter-spacing="5">SEP</text><path d="m130 193 11 10 27-23" stroke="var(--season-secondary)" stroke-width="3" fill="none" stroke-linecap="round"/></g>',
        halloween: '<path d="M217 46c-20 2-32 22-21 40-27-5-34-38-14-55 8-7 19-10 30-6-8 3-13 11-13 19 6 3 12 3 18 2Z" fill="var(--season-secondary)" opacity=".65"/><path d="M149 106c-2-22 6-34 20-37" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><ellipse cx="111" cy="162" rx="42" ry="56" fill="var(--season-surface-raised)" stroke="currentColor"/><ellipse cx="189" cy="162" rx="42" ry="56" fill="var(--season-surface-raised)" stroke="currentColor"/><ellipse cx="150" cy="163" rx="47" ry="59" fill="var(--season-surface-raised)" stroke="currentColor"/><ellipse cx="150" cy="163" rx="23" ry="59" fill="none" stroke="currentColor" stroke-opacity=".5"/><path d="m114 150 16-16 10 19Zm72 0-16-16-10 19ZM123 179q27 28 54 0" fill="currentColor"/><path d="m67 71 2 7 7 2-7 2-2 7-2-7-7-2 7-2" fill="currentColor" opacity=".6"/>'
      };
      return svg + base + (art[name] || '') + '</svg>';
    }
    var controls = document.querySelector('[data-season-controls]');
    var motionButton;
    var themeButton;
    if (controls) {
      controls.replaceChildren();
      motionButton = document.createElement('button'); motionButton.type = 'button';
      themeButton = document.createElement('button'); themeButton.type = 'button';
      controls.append(motionButton, themeButton);
      listen(motionButton, 'click', function () { paused = !paused; savePreference(motionKey, paused); syncMotion(); });
      listen(themeButton, 'click', function () { preferStandard = !preferStandard; savePreference(standardKey, preferStandard); apply(); });
    }
    if (isPreview) {
      var notice = document.createElement('div');
      notice.className = 'season-preview-notice'; notice.setAttribute('data-season-preview', '');
      var label = document.createElement('strong');
      label.textContent = 'Preview: ' + labels[configuredSeason()] + (validDate ? ' · ' + previewDate : '') + ' — only this visit';
      var exit = document.createElement('a');
      var cleanURL = new URL(window.location.href); cleanURL.searchParams.delete('theme'); cleanURL.searchParams.delete('theme-date');
      exit.href = cleanURL.pathname + cleanURL.search + cleanURL.hash; exit.textContent = 'Exit preview';
      notice.append(label, exit);
      hero.parentNode.insertBefore(notice, hero);
    }

    function apply() {
      if (disposed) return;
      var chosen = configuredSeason();
      var next = !isPreview && preferStandard ? 'standard' : chosen;
      var nextYear = next === 'winter' && typeof calendar.getNewYear === 'function'
        ? calendar.getNewYear(new Date(), config.timeZone, previewDate) : null;
      if (next === 'winter' && !nextYear) {
        var fallbackDate = new Date();
        nextYear = fallbackDate.getUTCFullYear() + (fallbackDate.getUTCMonth() === 0 ? 0 : 1);
      }
      body.setAttribute('data-kthq-seasonal', '');
      root.setAttribute('data-season', next);
      if (themeButton) {
        themeButton.hidden = isPreview || (chosen === 'standard' && !preferStandard);
        themeButton.textContent = preferStandard ? 'Use seasonal theme' : 'Use standard theme';
        themeButton.setAttribute('aria-label', themeButton.textContent + ' on this device');
      }
      if (season === next && celebrationYear === nextYear) { syncMotion(); return; }
      if (fireworks) fireworks.reset();
      season = next;
      celebrationYear = nextYear;
      var harvestStyle = document.getElementById('thanksgiving-theme');
      if (harvestStyle) harvestStyle.media = season === 'thanksgiving' ? 'all' : 'not all';
      document.querySelectorAll('[data-season-only]').forEach(function (el) {
        el.hidden = el.getAttribute('data-season-only').split(/\s+/).indexOf(season) === -1;
      });
      var words = copy[season] || copy.standard;
      text('[data-season-eyebrow]', season === 'winter' && celebrationYear ? 'Hello, ' + celebrationYear + '.' : words.eyebrow);
      text('[data-season-greeting]', words.greeting);
      text('[data-season-message]', words.message);
      text('[data-season-action]', words.action);
      text('[data-season-label]', labels[season] + ' at KTHQ');
      text('[data-season-title]', words.title);
      text('[data-season-card-copy]', words.card);
      text('[data-season-community-label]', words.communityLabel);
      text('[data-season-community-title]', words.communityTitle);
      text('[data-season-community-copy]', words.community);
      document.querySelectorAll('[data-season-src]').forEach(function (img) {
        var parent = img.closest('[data-season-only]');
        if (parent && !parent.hidden && !img.getAttribute('src')) img.src = img.getAttribute('data-season-src');
      });
      var art = document.querySelector('[data-season-art]');
      if (art) {
        if (season === 'christmas') {
          var tree = document.createElement('img');
          tree.src = 'images/kthq-christmas-tree.png'; tree.width = 1254; tree.height = 1254;
          tree.alt = 'An evergreen Christmas tree with warm lights, gold and cranberry ornaments, and three wrapped gifts.';
          art.replaceChildren(tree);
        } else art.innerHTML = season === 'winter' ? newYearArt(celebrationYear) : emblem(season);
      }
      resize();
      syncMotion();
      if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver.observe(season === 'winter' && canvas && !canvas.hidden ? canvas : hero);
      }
    }

    function makeParticle(scatter) {
      return { x: Math.random() * width, y: scatter ? Math.random() * height : -30,
        size: 1 + Math.random() * 2, speed: 10 + Math.random() * 17,
        phase: Math.random() * Math.PI * 2, rotation: Math.random() * 6.28,
        alpha: .18 + Math.random() * .4, tone: Math.floor(Math.random() * 4) };
    }
    function resize() {
      if (!ctx || !canvas) return;
      width = hero.clientWidth;
      height = effects[season] === 'fireworks' ? Math.min(hero.clientHeight, 800) : hero.clientHeight;
      canvas.style.height = height + 'px';
      var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (fireworks) fireworks.resize(width, height);
      var count = hero.id === 'trainingSeason' ? 12 : width < 680 ? 16 : 32;
      particles = Array.from({ length: count }, function () { return makeParticle(true); });
    }
    function draw(now) {
      if (disposed || !hero.isConnected) return;
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < 1000 / 24) return;
      var dt = lastDraw ? Math.min((now - lastDraw) / 1000, .06) : 0;
      lastDraw = now;
      ctx.clearRect(0, 0, width, height);
      var type = effects[season];
      if (type === 'fireworks') { fireworks.draw(now, dt); return; }
      particles.forEach(function (p) {
        p.y += p.speed * dt; p.x += Math.sin(now * .0004 + p.phase) * 10 * dt; p.rotation += .3 * dt;
        if (p.y > height + 30) Object.assign(p, makeParticle(false));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha * (p.x > width * .1 && p.x < width * .65 ? .35 : 1);
        if (type === 'leaves') {
          ctx.fillStyle = ['#cb8747','#c25b34','#d8ad64','#9b5831'][p.tone];
          var s = p.size * 2.4;
          ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.lineTo(s * .4, -s * .5); ctx.lineTo(s, -s);
          ctx.lineTo(s * .8, 0); ctx.lineTo(s * 1.2, s * .2); ctx.lineTo(s * .2, s); ctx.lineTo(0, s * .8);
          ctx.lineTo(-s * .2, s); ctx.lineTo(-s * 1.2, s * .2); ctx.lineTo(-s * .8, 0); ctx.lineTo(-s, -s);
          ctx.lineTo(-s * .4, -s * .5); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#f1cca0'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(0,s*1.5); ctx.stroke();
        } else {
          ctx.fillStyle = type === 'snow' ? '#fff7e6' : type === 'embers' ? '#efb182' : '#f0d3a1';
          if (type === 'sparkles') {
            ctx.globalAlpha *= .35 + .65 * Math.abs(Math.sin(now * .0008 + p.phase));
            ctx.fillRect(-p.size * 1.7,-.5,p.size * 3.4,1); ctx.fillRect(-.5,-p.size * 1.7,1,p.size * 3.4);
          } else { ctx.beginPath(); ctx.arc(0,0,p.size,0,Math.PI*2); ctx.fill(); }
        }
        ctx.restore();
      });
    }
    function syncMotion() {
      cancelAnimationFrame(frame); frame = 0; lastDraw = 0;
      var hasEffect = config.effects !== false && !!effects[season] && !!ctx;
      var allowed = hasEffect && !paused && !reduced.matches;
      if (canvas) canvas.hidden = !allowed;
      if (motionButton) {
        motionButton.hidden = !hasEffect;
        motionButton.disabled = reduced.matches;
        motionButton.textContent = reduced.matches ? 'Motion off' : paused ? 'Resume effects' : 'Pause effects';
        motionButton.setAttribute('aria-pressed', String(allowed));
        motionButton.setAttribute('aria-label', reduced.matches ? 'Decorative motion disabled by your device preference' : paused ? 'Resume decorative effects' : 'Pause decorative effects');
      }
      if (allowed && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function checkClock() {
      clearTimeout(clockTimer);
      if (disposed) return;
      if (!hero.isConnected) { cleanup(); return; }
      if (!document.hidden) {
        apply();
        // Align to wall-clock minute boundaries; DST never needs a 24-hour assumption.
        clockTimer = setTimeout(checkClock, 60000 - (Date.now() % 60000) + 30);
      } else syncMotion();
    }
    function cleanup() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); clearTimeout(clockTimer);
      if (fireworks) fireworks.reset();
      cleanupListeners.forEach(function (remove) { remove(); });
      if (resizeObserver) resizeObserver.disconnect();
      if (visibilityObserver) visibilityObserver.disconnect();
      if (pageObserver) pageObserver.disconnect();
      if (notice && notice.isConnected) notice.remove();
      if (canvas) canvas.hidden = true;
      if (window.KTHQSeasonCleanup === cleanup) {
        delete window.KTHQSeasonCleanup;
        root.removeAttribute('data-season'); body.removeAttribute('data-kthq-seasonal');
      }
    }
    window.KTHQSeasonCleanup = cleanup;
    listen(document, 'visibilitychange', checkClock);
    listen(window, 'pageshow', checkClock);
    listen(reduced, 'change', syncMotion);
    listen(window, 'storage', function (event) {
      if (event.key === standardKey || event.key === motionKey) {
        preferStandard = readPreference(standardKey); paused = readPreference(motionKey); apply();
      }
    });
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(hero); }
    else listen(window, 'resize', resize, { passive: true });
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; syncMotion(); });
      visibilityObserver.observe(hero);
    }
    pageObserver = new MutationObserver(function () { if (!hero.isConnected) cleanup(); });
    pageObserver.observe(body, { childList: true });
    checkClock();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
