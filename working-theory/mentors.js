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
  function markVoice(id) {
    document.querySelectorAll('#wt-voices .wt-voice').forEach(function (el) { el.setAttribute('aria-pressed', String(el.dataset.voice === id)); });
  }
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
    markVoice(take.mentor.id);
    document.getElementById('back-to-nick').onclick = function () {
      document.getElementById('nick-piece').hidden = false;
      document.getElementById('mentor-piece').hidden = true;
      headerExtras().forEach(function (el) { el.hidden = false; });
      var originalUrl = new URL(location.href); originalUrl.searchParams.delete('mentor');
      history.replaceState(history.state, '', originalUrl);
      markVoice('');
      if (button && button.isConnected) button.focus();
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
      var voices = allTakes.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).filter(function (take) {
        if (seen.has(take.mentor.id)) return false;
        seen.add(take.mentor.id); return true;
      });
      var stale = document.getElementById('wt-voices');
      if (stale) stale.remove();
      document.body.classList.remove('wt-has-voices');
      if (!voices.length) return;
      // With more than one voice, every voice sits in one picker above the piece.
      var layout = document.querySelector('.wt-layout');
      var picker = node('section', undefined, 'wt-voices');
      picker.id = 'wt-voices';
      picker.setAttribute('aria-labelledby', 'wt-voices-heading');
      var heading = node('h2', 'Select a mentor'); heading.id = 'wt-voices-heading';
      var row = node('div', undefined, 'wt-voices-row');
      picker.append(heading, row);
      var original = node('button', undefined, 'wt-take wt-voice');
      original.type = 'button'; original.dataset.voice = '';
      original.append(node('strong', 'KTHQ'), node('span', 'Original piece'));
      original.addEventListener('click', function () {
        if (!document.getElementById('mentor-piece').hidden) document.getElementById('back-to-nick').click();
        original.focus();
      });
      row.append(original);
      var wanted = new URLSearchParams(location.search).get('mentor');
      var opened = false;
      voices.forEach(function (take) {
        var button = node('button', undefined, 'wt-take wt-voice');
        button.type = 'button'; button.dataset.voice = take.mentor.id;
        button.append(node('strong', take.mentor.name), node('span', [take.mentor.rank, take.mentor.role].filter(Boolean).join(' · ')));
        button.addEventListener('click', function () { showTake(take, button); });
        row.append(button);
        if (wanted === take.mentor.id) { opened = true; setTimeout(function () { showTake(take, button); }, 0); }
      });
      layout.parentNode.insertBefore(picker, layout);
      document.body.classList.add('wt-has-voices');
      if (!opened) markVoice('');
    } catch (error) {
      document.getElementById('rail-status').textContent = 'Mentor takes could not be loaded. The piece is still available.';
    }
  }
  var forms = Array.from(document.querySelectorAll('form[data-route]'));
  var ready = !!(base && config.turnstileSiteKey);
  var enabledForms = forms.filter(function (form) {
    return ready && !form.dataset.template && (form.dataset.route !== '/takes/submit' || (config.publishedTopics || []).includes(topic));
  });
  if (enabledForms.length) {
    enabledForms.forEach(function (form) {
      var fieldset = form.querySelector('fieldset');
      var button = form.querySelector('button[type=submit]');
      var message = form.querySelector('[role=status]');
      var availability = form.parentNode.querySelector('[data-form-availability]');
      var application = form.dataset.route === '/mentors/apply';
      var credentials = application && document.getElementById('mentor-credentials');
      var mode = application && document.getElementById('mentor-account-mode');
      var emailInput = application && document.getElementById('mentor-email');
      var password = application && document.getElementById('mentor-password');
      var confirm = application && document.getElementById('mentor-confirm');
      var username = application && document.getElementById('mentor-username');
      var draftNotice = application && document.getElementById('mentor-draft-notice');
      var clearDraft = application && document.getElementById('mentor-clear-draft');
      var draftKey = 'kthq-mentor-application-v1';
      var profileFields = ['name', 'rank', 'field', 'role', 'bio', 'philosophy'];
      var savedEmail = '';
      var widget = null;
      var sending = false;
      function currentUser() { return window.KTHQAccount && window.KTHQAccount.user(); }
      function profile() {
        var values = {};
        profileFields.forEach(function (key) { values[key] = form.elements[key].value; });
        return values;
      }
      function forgetDraft() {
        try { localStorage.removeItem(draftKey); } catch (_) {}
        savedEmail = '';
        if (draftNotice) draftNotice.textContent = '';
        if (clearDraft) clearDraft.hidden = true;
      }
      function saveDraft(address) {
        // Deliberate whitelist: passwords, tokens, username and accepted terms
        // never enter draft storage or the mentor application API payload.
        localStorage.setItem(draftKey, JSON.stringify({ email: address.toLowerCase(), profile: profile(), savedAt: Date.now() }));
        savedEmail = address.toLowerCase();
        draftNotice.textContent = 'Application draft saved on this browser for up to 24 hours. After verifying your email, return here with the same account, review the draft, and send it.';
        clearDraft.hidden = false;
      }
      if (credentials) {
        try {
          var draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
          if (draft && typeof draft.email === 'string' && draft.profile && Date.now() - draft.savedAt < 86400000 && draft.savedAt <= Date.now()) {
            savedEmail = draft.email.toLowerCase();
            emailInput.value = draft.email;
            mode.value = 'existing';
            profileFields.forEach(function (key) {
              var input = form.elements[key];
              if (typeof draft.profile[key] === 'string') input.value = draft.profile[key].slice(0, input.maxLength > 0 ? input.maxLength : 24000);
            });
            draftNotice.textContent = 'Your saved application draft has been restored. Sign in with the same account, review it, accept the contributor terms, and send it.';
            clearDraft.hidden = false;
          } else if (draft) forgetDraft();
        } catch (_) { forgetDraft(); }
        mode.addEventListener('change', updateAccess);
        clearDraft.addEventListener('click', function () {
          forgetDraft(); form.reset(); message.textContent = 'Saved application discarded.'; updateAccess();
        });
        form.addEventListener('input', function () {
          if (!savedEmail) return;
          var user = currentUser();
          if (user && user.email.toLowerCase() !== savedEmail) return;
          try { saveDraft(savedEmail); } catch (_) { draftNotice.textContent = 'Draft changes could not be saved. Keep this page open or copy your writing before leaving.'; }
        });
      }
      function updateAccess() {
        if (!form.isConnected) return;
        var user = currentUser();
        var verified = !!(user && user.email_confirmed_at);
        fieldset.disabled = application ? false : !verified;
        // The application button stays actionable so it can explain a missing
        // sign-in, verification or bot check instead of silently ignoring clicks.
        button.disabled = sending || (!application && (!verified || widget === null));
        if (credentials) {
          credentials.hidden = !!user;
          credentials.disabled = !!user || sending;
          var isNew = mode.value === 'new';
          document.getElementById('mentor-new-account').hidden = !isNew;
          username.disabled = !!user || !isNew || sending;
          confirm.disabled = !!user || !isNew || sending;
          password.minLength = isNew ? 12 : 1;
          password.autocomplete = isNew ? 'new-password' : 'current-password';
          button.textContent = sending ? 'Please wait…' : user ? 'Send my application' : isNew ? 'Create account & continue application' : 'Sign in & send my application';
        }
        if (availability) {
          availability.textContent = !user
            ? 'New here? This application creates your shared KTHQ account. Already have a KTHQ or forum account? Select that option below—no second account needed.'
            : !verified
              ? 'Verify your KTHQ account email, then return here to send your application. Your mentor profile still needs review.'
              : 'Signed in with your shared KTHQ account. Complete the bot check and send your mentor profile for review. No second account is needed.';
        }
      }
      updateAccess();
      document.addEventListener('kthq-account-changed', updateAccess);
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (sending) return;
        sending = true;
        // Read credentials before disabling their fieldset during the request.
        var input = credentials ? { email: emailInput.value.trim(), password: password.value, username: username.value.trim() } : null;
        var creating = credentials && mode.value === 'new';
        updateAccess();
        try {
          var account = window.KTHQAccount;
          var user = currentUser();
          if (credentials && !user) {
            if (!account || !account.register) throw new Error('Account services could not load. Copy your writing before refreshing to try again.');
            if (creating && input.password !== confirm.value) throw new Error('The passwords do not match. Please enter them again.');
            try { saveDraft(input.email); }
            catch (_) { throw new Error('Your browser could not save this application draft. Copy your writing before verifying your email, or allow browser storage and try again.'); }
            message.textContent = creating ? 'Creating your shared KTHQ account…' : 'Signing in…';
            var result = creating
              ? await account.register(input)
              : await account.client.auth.signInWithPassword({ email: input.email, password: input.password });
            if (result.error) throw new Error(result.error.message);
            await account.refresh();
            user = currentUser();
            if (!user || !user.email_confirmed_at) {
              if (creating) mode.value = 'existing';
              message.textContent = creating
                ? 'Check your email to verify your shared KTHQ account, then return here to review and send your saved application. It has not been sent yet. If you already have an account, sign in or use password help above.'
                : 'Verify your account email before sending. Your application draft is saved.';
              return;
            }
          }
          if (!(user && user.email_confirmed_at)) throw new Error('Sign in with a verified KTHQ account before sending. Your draft is still here.');
          if (application && savedEmail && user.email.toLowerCase() !== savedEmail) throw new Error('This saved application belongs to a different account. Sign in with its email, or discard the saved application to start a new one.');
          if (widget === null) throw new Error('The bot check has not loaded. Your account is ready; keep your draft and retry the check before sending.');
          var token = window.turnstile.getResponse(widget);
          if (!token) throw new Error('Please complete the bot check, then click Send my application again.');
          // Never serialize account fields into the Worker request.
          var payload = application ? profile() : Object.fromEntries(new FormData(form).entries());
          payload.terms = form.elements.terms ? form.elements.terms.checked : undefined;
          payload.topicSlug = topic;
          payload.turnstileToken = token;
          message.textContent = 'Sending…';
          var data = await api(form.dataset.route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          message.textContent = data.message;
          if (application) forgetDraft();
          form.reset();
          if (application) document.dispatchEvent(new CustomEvent('kthq-mentor-profile-changed'));
        } catch (error) { message.textContent = error.message || 'The request could not complete. Your draft is still here.'; }
        finally {
          if (credentials) { password.value = ''; confirm.value = ''; }
          sending = false; updateAccess();
          if (widget !== null) window.turnstile.reset(widget);
        }
      });
      form.initMentorTurnstile = function () {
        if (!form.isConnected || widget !== null) return;
        try {
          widget = window.turnstile.render(form.querySelector('[data-turnstile]'), {
            sitekey: config.turnstileSiteKey,
            action: 'turnstile-spin-v1',
            'error-callback': function () { message.textContent = 'The bot check could not complete. Please retry the check before sending.'; }
          });
          updateAccess();
        } catch (error) { message.textContent = 'The bot check could not load. Your draft is still editable.'; }
      };
    });
    window.KTHQ_initMentorTurnstile = function () {
      enabledForms.forEach(function (form) { form.initMentorTurnstile(); });
    };
    if (window.turnstile) window.KTHQ_initMentorTurnstile();
    else {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=KTHQ_initMentorTurnstile&render=explicit';
      script.async = true;
      script.onerror = function () {
        enabledForms.forEach(function (form) {
          form.querySelector('[role=status]').textContent = 'The bot check could not load. Your draft is still editable; refresh to retry before sending.';
        });
      };
      document.head.append(script);
    }
  }
  var workspace = document.getElementById('mentor-workspace');
  var applicationSection = document.getElementById('mentor-application-section');
  var workspaceGeneration = 0;
  var mentorSessionStatus = document.getElementById('mentor-session-status');
  var mentorWorkspaceLink = document.getElementById('mentor-workspace-link');
  function showMentorSession(text, linkVisible) {
    if (mentorSessionStatus) { mentorSessionStatus.textContent = text; mentorSessionStatus.hidden = !text; }
    if (mentorWorkspaceLink) mentorWorkspaceLink.hidden = !linkVisible;
  }
  async function refreshMentorWorkspace() {
    if (!workspace || !workspace.isConnected || !applicationSection) return;
    var generation = ++workspaceGeneration;
    var user = window.KTHQAccount && window.KTHQAccount.user();
    if (!user || !user.email_confirmed_at) {
      showMentorSession('', false);
      workspace.hidden = true;
      workspace.replaceChildren();
      applicationSection.hidden = false;
      return;
    }
    showMentorSession('Signed in to KTHQ · Checking your mentor status…', false);
    workspace.hidden = false;
    applicationSection.hidden = true;
    workspace.replaceChildren(node('h2', 'Your mentor workspace'), node('p', 'Checking your mentor status…', 'wt-note'));
    try {
      var token = await window.KTHQAccount.accessToken();
      var data = await api('/me/mentor', { headers: { Authorization: 'Bearer ' + token } });
      if (generation !== workspaceGeneration || !workspace.isConnected) return;
      var mentor = data.mentor;
      workspace.replaceChildren(node('h2', 'Your mentor workspace'));
      if (!mentor) {
        showMentorSession('Signed in to KTHQ · No mentor profile yet', false);
        workspace.hidden = true;
        applicationSection.hidden = false;
        return;
      }
      workspace.append(node('p', mentor.name, 'wt-kicker'));
      if (mentor.status === 'approved') {
        showMentorSession('Signed in as an approved KTHQ mentor', true);
        workspace.append(node('p', 'Your mentor profile is approved. You can submit a take on any of the pieces below.'));
        workspace.append(node('p', 'Choose a piece, read it, then write in the “Your take” box at the bottom. Submit your take for review; each take needs approval before it appears.', 'wt-note'));
        var profileLink = node('a', 'View your public mentor profile', 'wt-button');
        profileLink.href = '/working-theory/mentor.html?id=' + encodeURIComponent(mentor.id);
        workspace.append(profileLink, node('h3', 'Write a take'));
        var list = node('ul');
        (config.publishedTopics || []).forEach(function (slug) {
          var item = node('li');
          var link = node('a', topicTitles[slug] || slug.replace(/-/g, ' '));
          link.href = '/working-theory/' + encodeURIComponent(slug) + '.html#mentor-take';
          item.append(link); list.append(item);
        });
        workspace.append(list);
      } else if (mentor.status === 'pending') {
        showMentorSession('Signed in to KTHQ · Mentor application pending review', true);
        workspace.append(node('p', 'Your mentor application is awaiting review. You have already applied; there is no need to apply again.'));
        workspace.append(node('p', 'Once approved, this workspace will show where to write and submit your takes.', 'wt-note'));
      } else {
        showMentorSession('Signed in to KTHQ · Mentor application not approved', true);
        workspace.append(node('p', 'Your previous mentor application was not approved. You can update the application below and submit it for another review.'));
        applicationSection.hidden = false;
      }
    } catch (_) {
      if (generation !== workspaceGeneration || !workspace.isConnected) return;
      showMentorSession('Signed in to KTHQ · Mentor status unavailable', true);
      workspace.replaceChildren(node('h2', 'Your mentor workspace'), node('p', 'Your mentor status could not be loaded. Try refreshing your status below. Your existing profile is unchanged.', 'wt-note'));
    }
    if (generation === workspaceGeneration && workspace.isConnected) {
      var refreshButton = node('button', 'Refresh mentor status', 'wt-button');
      refreshButton.type = 'button';
      refreshButton.addEventListener('click', function () { void refreshMentorWorkspace(); });
      workspace.append(refreshButton);
    }
  }
  if (workspace) {
    document.addEventListener('kthq-account-changed', function () { void refreshMentorWorkspace(); });
    document.addEventListener('kthq-mentor-profile-changed', function () { void refreshMentorWorkspace(); });
    window.addEventListener('focus', function () { void refreshMentorWorkspace(); });
    void refreshMentorWorkspace();
  }
  async function loadProfile() {
    if (!document.getElementById('profile-content')) return;
    var id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    if (id === 'nick') { location.replace('/working-theory/'); return; }
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
