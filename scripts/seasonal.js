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
    var sweepPhase = 0;
    var inboxTimer;
    var inboxStep = 0;
    var inboxCounts = [1, 2, 13, 47, 186, 437, 999];
    var replies = ['Me too, please.', 'Everyone, please stop replying all.', 'Who owns this distro?', 'I think you meant to send this just to the sender.'];
    var inbox;
    var skyY = 0;
    var horizonY = 0;
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
    var effects = { thanksgiving: 'leaves', christmas: 'snow', winter: fireworks ? 'fireworks' : null, valentine: 'hearts', independence: fireworks ? 'fireworks' : 'sparkles', fiscal: 'searchlights', halloween: 'inbox' };
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
        eyebrow: 'A love letter to our contracting community', greeting: 'Dear contracting people, we have a crush on you.',
        message: 'You slid a chair over for the new specialist. You picked up on the third ring during closeout. We remember those things. If we could leave roses on every one of your desks, we would.', action: 'Find something to love',
        title: 'Darling, these are yours.', card: 'All our love, KTHQ',
        communityLabel: 'P.S. One more thing', communityTitle: 'Tell your work valentine.', community: 'You know the one. Their name pops up on Teams and your shoulders drop an inch. Send them the sappy message. “My first year would have been so much harder without you” is a pretty good place to start.'
      },
      independence: {
        eyebrow: 'Independence Day · July 4', greeting: 'Let freedom ring.',
        message: 'From a flag raised at first light to the last firework over the water, happy Independence Day from KTHQ.', action: 'Explore Training',
        title: 'The American Bald Eagle', card: 'Independence Day · July 4, 1776',
        communityLabel: 'From all of us at KTHQ', communityTitle: 'Save a seat at the picnic.', community: 'For the crew on duty tonight, the families watching from a thousand miles away, and the neighbor who brought enough food for the whole block, happy Independence Day. This country is lucky to have you.'
      },
      fiscal: {
        eyebrow: 'September · Fiscal year close', greeting: 'Bring it home.',
        message: 'To the specialist working their first fiscal year end and the CO who pulled up a chair beside them: this place is for you.', action: 'Open the Contract File Checklist',
        title: 'September 30', card: 'The last light on the contracting floor.',
        communityLabel: 'The September stretch', communityTitle: 'There are people behind every deadline.', community: 'Share what you know. Ask for help early. Bring a little patience to the next conversation. The mission needs good judgment all the way through.'
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
      return calendar.resolveSeason({ now: new Date(), timeZone: config.timeZone, localFiscalMonth: true, mode: config.mode, preview: preview, previewDate: previewDate });
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
        valentine: '<img src="/images/valentine-roses.webp" width="1200" height="800" alt="Deep red roses and a love letter closed with a heart-shaped wax seal.">',
        independence: '<img src="/images/independence-eagle-portrait.webp" width="1200" height="800" alt="A bald eagle fixes its golden eye on the viewer, its white feathers edged with light.">',
        fiscal: '<img src="/images/eofy-calendar.webp" alt="A September 30 desk calendar beside a brass pen in lamplight.">',
        halloween: ''
      };
      return name === 'valentine' || name === 'independence' || name === 'fiscal' || name === 'halloween' ? art[name] : svg + base + (art[name] || '') + '</svg>';
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

    var fiscalTimer;
    var fiscalYear;
    var previewOffset = 0;
    var stationBody = document.querySelector('[data-fiscal-stations]');
    var zonePicker = document.querySelector('[data-fiscal-picker]');
    var stationRows = [];
    var boardYear;
    var stations = [
      ['Zulu', 'UTC'], ['Los Angeles', 'America/Los_Angeles'],
      ['Washington, DC', 'America/New_York'], ['Ramstein', 'Europe/Berlin']
    ];
    var actionLink = document.querySelector('[data-season-action]')?.closest('a');
    var originalHref = actionLink && actionLink.getAttribute('href');
    if (validDate) {
      var actual = new Date();
      var simulated = new Date(actual);
      var parts = previewDate.split('-').map(Number);
      simulated.setFullYear(parts[0], parts[1] - 1, parts[2]);
      previewOffset = simulated - actual;
    }

    function addStation(name, zone) {
      var row = stationBody.insertRow();
      var label = document.createElement('th');
      label.scope = 'row';
      label.textContent = name;
      label.title = zone;
      row.appendChild(label);
      stationRows.push({
        row: row, time: row.insertCell(), left: row.insertCell(),
        format: new Intl.DateTimeFormat('en-GB', {timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit'}),
        close: calendar.fiscalCloseInZone(fiscalYear, zone)
      });
    }

    function addComparisonStation() {
      var zone = zonePicker.value || 'Asia/Tokyo';
      addStation(zone === 'Asia/Tokyo' ? 'Yokota' : zone.replace(/_/g, ' '), zone);
    }

    function syncFiscalClock() {
      if (season !== 'fiscal' || !stationBody) return;
      if (boardYear !== fiscalYear) {
        boardYear = fiscalYear;
        stationBody.replaceChildren();
        stationRows = [];
        stations.forEach(function (station) { addStation(station[0], station[1]); });
        addComparisonStation();
        text('[data-fiscal-zone]', 'Time until October 1, ' + fiscalYear + ' at midnight in each zone.');
      }
      if (zonePicker.options.length === 1) {
        var zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') :
          ['Pacific/Honolulu','America/Denver','America/Chicago','Europe/London','Asia/Qatar','Pacific/Guam','America/Anchorage','America/Phoenix','America/Puerto_Rico','Africa/Nairobi','Asia/Kolkata','Asia/Kathmandu','Asia/Seoul','Australia/Adelaide','Pacific/Auckland'];
        zones.filter(zone => zone !== 'Asia/Tokyo' && !stations.some(station => station[1] === zone)).forEach(function (zone) {
          zonePicker.add(new Option(zone.replace(/_/g, ' '), zone));
        });
      }
      tickFiscalClock();
    }

    listen(zonePicker, 'change', function () {
      if (stationRows.length > stations.length) stationRows.pop().row.remove();
      addComparisonStation();
      tickFiscalClock();
    });

    function tickFiscalClock() {
      clearTimeout(fiscalTimer);
      if (disposed || document.hidden || season !== 'fiscal' || !stationBody) return;
      var now = new Date(Date.now() + previewOffset);
      var pad = value => String(value).padStart(2, '0');
      stationRows.forEach(function (station) {
        var seconds = Math.max(0, Math.ceil((station.close - now) / 1000));
        var days = Math.floor(seconds / 86400);
        var time = station.format.format(now);
        if (station.time.textContent !== time) station.time.textContent = time;
        station.left.textContent = seconds ? days + 'd ' + pad(Math.floor(seconds / 3600) % 24) + ':' +
          pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60) : 'Closed';
      });
      var caption = document.querySelector('[data-season-card-copy]');
      var finalDay = now.getMonth() === 8 && now.getDate() === 30;
      var note = finalDay ? 'For everyone still at their desk.' : copy.fiscal.card;
      if (caption && caption.textContent !== note) caption.textContent = note;
      fiscalTimer = setTimeout(tickFiscalClock, 1000 - now.getMilliseconds() + 5);
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
      if (season === next && celebrationYear === nextYear) { syncFiscalClock(); syncMotion(); return; }
      if (fireworks) fireworks.reset(next);
      clearTimeout(fiscalTimer);
      clearTimeout(inboxTimer); inboxTimer = 0; inbox = null;
      season = next;
      if (season === 'fiscal') {
        var fiscalNow = new Date(Date.now() + previewOffset);
        fiscalYear = validDate ? Number(previewDate.slice(0, 4)) : fiscalNow.getUTCFullYear();
        // Keep one target year worldwide until even the last UTC-12 zone has closed.
        if (!validDate && fiscalNow >= calendar.fiscalCloseInZone(fiscalYear, 'Etc/GMT+12')) fiscalYear++;
      }
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
      if (actionLink) actionLink.setAttribute('href', season === 'fiscal' ? 'contract-file-checklist.html' : originalHref);
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
      if (season === 'halloween') {
        var host = art || document.querySelector('[data-training-inbox]');
        if (host) mountInbox(host);
      }
      syncFiscalClock();
      resize();
      syncMotion();
      if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver.observe(inbox || ((effects[season] === 'fireworks' || season === 'valentine' || season === 'fiscal' || season === 'halloween') && canvas && !canvas.hidden ? canvas : hero));
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
      height = (effects[season] === 'fireworks' || season === 'valentine' || season === 'fiscal' || season === 'halloween') ? Math.min(hero.clientHeight, 800) : hero.clientHeight;
      if (season === 'fiscal') {
        // The office photo is 2:1. Follow its rendered crop from the ceiling to the runway.
        var training = hero.id === 'trainingSeason';
        var photoHeight = training ? Math.max(width, 760) / 2 : Math.max(hero.clientHeight, width / 2);
        var photoTop = training ? 0 : (hero.clientHeight - photoHeight) / 2;
        skyY = photoTop + photoHeight * .245;
        horizonY = photoTop + photoHeight * .51;
      }
      canvas.style.height = height + 'px';
      var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (fireworks) fireworks.resize(width, height);
      var count = hero.id === 'trainingSeason' ? 12 : width < 680 ? 16 : 32;
      particles = Array.from({ length: count }, function () { return makeParticle(true); });
    }
    function drawSpotlight(baseX, baseY, targetX, targetY, radius, signal) {
      var dx = targetX - baseX;
      var dy = targetY - baseY;
      var length = Math.hypot(dx, dy);
      var tint = signal === 'CO' ? '255,220,153' : '174,212,248';
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(Math.atan2(dx, -dy));
      var wash = ctx.createLinearGradient(-radius, 0, radius, 0);
      wash.addColorStop(0, 'rgba(' + tint + ',0)');
      wash.addColorStop(.5, 'rgba(' + tint + ',.40)');
      wash.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-radius, -length);
      ctx.quadraticCurveTo(0, -length - radius * .27, radius, -length);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(targetX, targetY);
      ctx.scale(1, .66);
      var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.45);
      glow.addColorStop(0, 'rgba(' + tint + ',.94)');
      glow.addColorStop(.58, 'rgba(' + tint + ',.81)');
      glow.addColorStop(.71, 'rgba(' + tint + ',.26)');
      glow.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-radius * 1.5, -radius * 1.5, radius * 3, radius * 3);
      ctx.fillStyle = '#273342';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(radius * .95) + 'px Georgia, serif';
      ctx.fillText(signal, 0, radius * .04);
      ctx.restore();
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
      if (type === 'searchlights') {
        sweepPhase = (sweepPhase + dt * Math.PI / 8) % (Math.PI * 2);
        // Keep both moving signals clear of the calendar panel on wider layouts.
        var reach = Math.min(56, width * .085);
        var aim = Math.sin(sweepPhase);
        drawSpotlight(width * .47, horizonY, width * (.46 + .065 * aim), skyY, reach, 'CO');
        drawSpotlight(width * .32, horizonY, width * (.24 - .065 * aim), skyY + reach * .22, reach * .87, 'CS');
        return;
      }
      particles.forEach(function (p) {
        p.y += p.speed * dt; p.x += Math.sin(now * .0004 + p.phase) * 10 * dt; p.rotation += .3 * dt;
        if (p.y > height + 30) Object.assign(p, makeParticle(false));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(type === 'hearts' ? Math.sin(p.rotation) * .45 : p.rotation);
        ctx.globalAlpha = p.alpha * (p.x > width * .1 && p.x < width * .65 ? .35 : 1);
        if (type === 'hearts') {
          ctx.fillStyle = ['#f3adbe', '#cf738e', '#efccac', '#e68c9e'][p.tone];
          ctx.scale(p.size * 1.6, p.size * 1.6);
          ctx.beginPath(); ctx.moveTo(0, 1);
          ctx.bezierCurveTo(-2, -.25, -.9, -1.7, 0, -.7);
          ctx.bezierCurveTo(.9, -1.7, 2, -.25, 0, 1);
          ctx.fill();
        } else if (type === 'leaves') {
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
    function mountInbox(host) {
      host.innerHTML = '<div class="distro-monitor" role="group" aria-label="Halloween reply-all thread">' +
        '<div class="distro-screen"><div class="distro-bar"><b>Inbox</b><span data-unread></span></div>' +
        '<small>To: All personnel</small><h2>PLEASE REMOVE ME FROM THIS DISTRO</h2>' +
        '<ol aria-label="Replies to everyone"></ol></div></div>';
      inbox = host.querySelector('.distro-monitor');
      var list = inbox.querySelector('ol');
      replies.forEach(function (reply) {
        var item = document.createElement('li');
        item.textContent = reply;
        list.appendChild(item);
      });
      inboxStep = 0;
      renderInbox();
    }

    function renderInbox() {
      inbox.querySelector('[data-unread]').textContent = inboxCounts[inboxStep] + ' unread';
      Array.from(inbox.querySelectorAll('li')).forEach(function (item, index) {
        item.hidden = index >= inboxStep;
      });
    }

    function advanceInbox() {
      inboxTimer = 0;
      if (disposed || !inbox || !hero.isConnected || document.hidden || !visible || paused || reduced.matches) return;
      inboxStep++;
      renderInbox();
      if (inboxStep < inboxCounts.length - 1) inboxTimer = setTimeout(advanceInbox, 3000);
    }

    function syncMotion() {
      cancelAnimationFrame(frame); frame = 0; lastDraw = 0;
      var hasEffect = config.effects !== false && !!effects[season] && (!!inbox || !!ctx);
      var allowed = hasEffect && !paused && !reduced.matches;
      hero.toggleAttribute('data-shadow-running', season === 'halloween' && allowed && !document.hidden);
      if (canvas) canvas.hidden = !allowed || !!inbox;
      if (motionButton) {
        motionButton.hidden = !hasEffect;
        motionButton.disabled = reduced.matches;
        motionButton.textContent = reduced.matches ? 'Motion off' : paused ? 'Resume effects' : 'Pause effects';
        motionButton.setAttribute('aria-pressed', String(allowed));
        motionButton.setAttribute('aria-label', reduced.matches ? 'Decorative motion disabled by your device preference' : paused ? 'Resume decorative effects' : 'Pause decorative effects');
      }
      if (inbox) {
        if (reduced.matches || config.effects === false) { inboxStep = inboxCounts.length - 1; renderInbox(); }
        if (!allowed || !visible || document.hidden) { clearTimeout(inboxTimer); inboxTimer = 0; }
        else if (!inboxTimer && inboxStep < inboxCounts.length - 1) inboxTimer = setTimeout(advanceInbox, 3000);
      } else if (allowed && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function checkClock() {
      clearTimeout(clockTimer);
      if (disposed) return;
      if (!hero.isConnected) { cleanup(); return; }
      if (!document.hidden) {
        apply();
        // Align to wall-clock minute boundaries; DST never needs a 24-hour assumption.
        clockTimer = setTimeout(checkClock, 60000 - (Date.now() % 60000) + 30);
      } else { clearTimeout(fiscalTimer); syncMotion(); }
    }
    function cleanup() {
      if (disposed) return;
      disposed = true; clearTimeout(inboxTimer); clearTimeout(fiscalTimer); cancelAnimationFrame(frame); clearTimeout(clockTimer);
      if (fireworks) fireworks.reset();
      cleanupListeners.forEach(function (remove) { remove(); });
      if (resizeObserver) resizeObserver.disconnect();
      if (visibilityObserver) visibilityObserver.disconnect();
      hero.removeAttribute('data-shadow-running');
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
