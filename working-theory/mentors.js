(function () {
  'use strict';
  var config = window.KTHQ_WORKING_THEORY || {};
  var base = String(config.apiBase || '').replace(/\/$/, '');
  var topic = document.body.dataset.topic || '';
  function node(tag, text, className) {
    var el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  async function api(path, options) {
    if (!base) throw new Error('Mentor’s Corner is not connected yet.');
    if (options && options.method === 'POST' && !path.startsWith('/admin/')) {
      var token = window.KTHQAccount ? await window.KTHQAccount.accessToken() : '';
      if (!token) throw new Error('Sign in with your KTHQ account before contributing.');
      options.headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + token });
    }
    var response = await fetch(base + path, Object.assign({ cache: 'no-store', credentials: 'omit' }, options));
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }
  var topicTitles = {"what-ive-learned-over-the-years": "What I’ve learned over the years that you can learn right now", "leadership-for-people-who-just-got-handed-it": "Leadership for People Who Just Got Handed It", "stop-controlling-people": "Stop Controlling People, Change the Culture", "nobody-dropped-the-hammer": "Dropping the Hammer", "blame": "Blame", "everything-is-priority-one": "Everything Is Priority One", "the-new-rule-after-one-mistake": "The New Rule After One Mistake", "were-not-curing-cancer": "We’re Not Curing Cancer", "creativity": "Why the Air Force Is Bad at Creativity", "make-rank-because-of-the-work": "Make Rank Because of the Work"};
  function headerExtras() { return Array.from(document.querySelectorAll('.wt-header .wt-lede, .wt-header .wt-meta')); }
  // Every contribution is rendered as text. No HTML or markdown interpreter.
  function showTake(take, button) {
    var viewUrl = new URL(location.href);
    viewUrl.searchParams.set('mentor', take.mentor.id);
    history.replaceState(history.state, '', viewUrl);
    document.getElementById('nick-piece').hidden = true;
    document.getElementById('mentor-piece').hidden = false;
    var piece = document.getElementById('mentor-piece');
    var label = document.getElementById('mentor-take-label');
    if (!label) { label = node('p', undefined, 'wt-kicker'); label.id = 'mentor-take-label'; piece.insertBefore(label, document.getElementById('mentor-take-name')); }
    var titleEl = document.getElementById('topic-title');
    label.textContent = 'A mentor’s take on “' + (titleEl ? titleEl.textContent : (topicTitles[take.topicSlug] || 'this piece')) + '”';
    headerExtras().forEach(function (el) { el.hidden = true; });
    document.getElementById('mentor-take-name').textContent = take.mentor.name;
    document.getElementById('mentor-take-role').textContent = [take.mentor.rank, take.mentor.role].filter(Boolean).join(' · ');
    document.getElementById('mentor-take-philosophy').textContent = take.mentor.philosophy;
    document.getElementById('mentor-take-body').textContent = take.body;
    document.getElementById('mentor-profile-link').href = '/working-theory/mentor.html?id=' + encodeURIComponent(take.mentor.id);
    document.getElementById('mentor-take-name').focus();
    document.getElementById('back-to-nick').onclick = function () {
      document.getElementById('nick-piece').hidden = false;
      document.getElementById('mentor-piece').hidden = true;
      headerExtras().forEach(function (el) { el.hidden = false; });
      var originalUrl = new URL(location.href); originalUrl.searchParams.delete('mentor');
      history.replaceState(history.state, '', originalUrl);
      button.focus();
    };
  }
  async function loadTakes() {
    if (!base || !topic) return;
    var cards = document.getElementById('mentor-cards');
    if (!cards) return;
    try {
      var cursor = '';
      var allTakes = [];
      do {
        var data = await api('/topics/' + encodeURIComponent(topic) + '/takes' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
        allTakes.push.apply(allTakes, data.takes);
        cursor = data.cursor || '';
      } while (cursor);
      var seen = new Set();
      allTakes.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).forEach(function (take) {
          if (seen.has(take.mentor.id)) return;
          seen.add(take.mentor.id);
          var button = node('button', undefined, 'wt-take');
          button.type = 'button';
          button.append(node('strong', take.mentor.name), node('span', [take.mentor.rank, take.mentor.role].filter(Boolean).join(' · ')), node('span', take.mentor.philosophy));
          button.addEventListener('click', function () { showTake(take, button); });
          cards.append(button);
          if (new URLSearchParams(location.search).get('mentor') === take.mentor.id) showTake(take, button);
        });
    } catch (error) {
      document.getElementById('rail-status').textContent = 'Mentor takes could not be loaded. Nick’s piece is still available.';
    }
  }
  var forms = Array.from(document.querySelectorAll('form[data-route]'));
  var ready = !!(base && config.turnstileSiteKey);
  var enabledForms = forms.filter(function (form) {
    return ready && !form.dataset.template && (form.dataset.route !== '/takes/submit' || (config.publishedTopics || []).includes(topic));
  });
  if (enabledForms.length) {
    document.querySelectorAll('[data-form-availability]').forEach(function (el) { el.textContent = 'Sign in with your KTHQ account before contributing. Submissions need Nick’s approval.'; });
    window.KTHQ_initMentorTurnstile = function () {
      enabledForms.forEach(function (form) {
        if (!form.isConnected) return;
        function updateAccess() {
          if (!form.isConnected) return;
          var user = window.KTHQAccount && window.KTHQAccount.user();
          form.querySelector('fieldset').disabled = !(user && user.email_confirmed_at);
        }
        updateAccess();
        document.addEventListener('kthq-account-changed', updateAccess);
        var widget = window.turnstile.render(form.querySelector('[data-turnstile]'), {
          sitekey: config.turnstileSiteKey,
          action: 'turnstile-spin-v1'
        });
        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          var message = form.querySelector('[role=status]');
          var payload = Object.fromEntries(new FormData(form).entries());
          payload.terms = form.elements.terms ? form.elements.terms.checked : undefined;
          payload.topicSlug = topic;
          payload.turnstileToken = window.turnstile.getResponse(widget);
          if (!payload.turnstileToken) { message.textContent = 'Please complete the bot check.'; return; }
          var button = form.querySelector('button[type=submit]');
          button.disabled = true;
          message.textContent = 'Sending…';
          try {
            var data = await api(form.dataset.route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            message.textContent = data.message;
            form.reset();
          } catch (error) { message.textContent = error.message; }
          finally { button.disabled = false; window.turnstile.reset(widget); }
        });
      });
    };
    if (window.turnstile) window.KTHQ_initMentorTurnstile();
    else {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=KTHQ_initMentorTurnstile&render=explicit';
      script.async = true;
      script.onerror = function () { document.querySelectorAll('[data-form-availability]').forEach(function (el) { el.textContent = 'The bot check could not load. Please refresh to try again.'; }); };
      document.head.append(script);
    }
  }
  async function loadProfile() {
    if (!document.getElementById('profile-content')) return;
    var id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    if (id === 'nick') {
      document.getElementById('profile-name').textContent = 'Nick Hazelett';
      var own = document.getElementById('profile-content');
      own.replaceChildren(node('p', 'KTHQ · Contracting', 'wt-note'));
      var essays = node('a', 'Nick’s pieces'); essays.href = '/working-theory/'; own.append(essays);
      return;
    }
    if (!base) return;
    try {
      var data = await api('/mentors/' + encodeURIComponent(id));
      var mentor = data.mentor;
      document.getElementById('profile-name').textContent = mentor.name;
      var content = document.getElementById('profile-content');
      content.replaceChildren(node('p', [mentor.rank, mentor.field, mentor.role].filter(Boolean).join(' · '), 'wt-note'), node('h2', 'About'), node('p', mentor.bio, 'wt-prose wt-plain'), node('h2', 'Leadership philosophy'), node('p', mentor.philosophy, 'wt-prose wt-plain'), node('h2', 'Approved takes'));
      var list = node('ul');
      content.append(list);
      var cursor = '';
      do {
        var takes = await api('/mentors/' + encodeURIComponent(id) + '/takes' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
        takes.takes.forEach(function (take) {
          var li = node('li');
          var link = node('a', topicTitles[take.topicSlug] || take.topicSlug.replace(/-/g, ' '));
          link.href = '/working-theory/' + encodeURIComponent(take.topicSlug) + '.html?mentor=' + encodeURIComponent(mentor.id);
          li.append(link); list.append(li);
        });
        cursor = takes.cursor || '';
      } while (cursor);
      if (!list.children.length) content.append(node('p', 'No approved takes yet.', 'wt-note'));
    } catch (error) { document.getElementById('profile-content').replaceChildren(node('p', error.message, 'wt-note')); }
  }
  var login = document.getElementById('admin-login');
  if (login) {
    var tokenInput = document.getElementById('admin-token');
    var queue = document.getElementById('admin-queue');
    var status = document.getElementById('admin-status');
    var storageKey = 'kthq-mentor-admin-token';
    var queueGeneration = 0;
    try { tokenInput.value = sessionStorage.getItem(storageKey) || ''; } catch (_) {}
    async function loadQueue() {
      var generation = ++queueGeneration;
      var token = tokenInput.value.trim();
      queue.replaceChildren();
      status.textContent = 'Loading…';
      try {
        var cursors = { mentors: '', takes: '' };
        do {
          var query = new URLSearchParams(cursors);
          var data = await api('/admin/queue?' + query, { headers: { Authorization: 'Bearer ' + token } });
          if (generation !== queueGeneration) return;
          try { sessionStorage.setItem(storageKey, token); } catch (_) {}
          data.mentors.forEach(function (record) { addQueueCard(record, 'mentor', token); });
          data.takes.forEach(function (record) { addQueueCard(record, 'take', token); });
          cursors = data.cursors;
        } while (cursors.mentors !== 'done' || cursors.takes !== 'done');
        status.textContent = queue.children.length ? 'Pending submissions loaded.' : 'Nothing pending.';
      } catch (error) { queue.replaceChildren(); status.textContent = error.message; }
    }
    function addQueueCard(record, kind, token) {
      var card = node('article', undefined, 'wt-box');
      card.append(node('h2', kind === 'mentor' ? record.name : record.mentor.name + ' · ' + (topicTitles[record.topicSlug] || record.topicSlug)));
      var fields = kind === 'mentor' ? ['rank', 'field', 'role', 'email', 'bio', 'philosophy'] : ['body'];
      fields.forEach(function (key) { card.append(node('p', key + ': ' + record[key], 'wt-plain')); });
      ['approve', 'reject'].forEach(function (action) {
        var button = node('button', action === 'approve' ? 'Approve' : 'Reject', 'wt-button');
        button.type = 'button';
        button.addEventListener('click', async function () {
          card.querySelectorAll('button').forEach(function (el) { el.disabled = true; });
          try {
            var result = await api('/admin/' + action, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kind, id: record.id, topicSlug: record.topicSlug }) });
            card.remove(); status.textContent = 'Submission ' + (action === 'approve' ? 'approved.' : 'rejected.') + (result.notificationFailed ? ' Saved, but the notification email could not be sent.' : '');
          } catch (error) { status.textContent = error.message; card.querySelectorAll('button').forEach(function (el) { el.disabled = false; }); }
        });
        card.append(button);
      });
      queue.append(card);
    }
    login.addEventListener('submit', function (event) { event.preventDefault(); void loadQueue(); });
    document.getElementById('admin-logout').addEventListener('click', function () {
      queueGeneration++;
      tokenInput.value = ''; queue.replaceChildren();
      try { sessionStorage.removeItem(storageKey); } catch (_) {}
      status.textContent = 'Token forgotten.';
    });
  }
  void loadTakes();
  void loadProfile();
})();
