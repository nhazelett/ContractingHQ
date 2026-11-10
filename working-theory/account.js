(function () {
  'use strict';
  // One account client survives ContractingFM navigation. Tokens never enter HTML,
  // links, mentor records, or the public profile response.
  var config = window.KTHQ_WORKING_THEORY || {};
  if (!window.KTHQAccount && window.supabase && config.accountUrl && config.accountPublishableKey) {
    var db = window.supabase.createClient(config.accountUrl, config.accountPublishableKey);
    var user = null;
    async function refresh() {
      var result = await db.auth.getUser();
      user = result.error ? null : result.data.user;
      document.dispatchEvent(new CustomEvent('kthq-account-changed'));
    }
    window.KTHQAccount = {
      client: db,
      user: function () { return user; },
      accessToken: async function () {
        var result = await db.auth.getSession();
        return result.data.session ? result.data.session.access_token : '';
      },
      refresh: refresh
    };
    db.auth.onAuthStateChange(function () { setTimeout(function () { void refresh(); }, 0); });
  }
  var account = window.KTHQAccount;
  var panel = document.getElementById('kthq-account');
  if (!account) return;
  function update() {
    if (!panel || !panel.isConnected) return;
    var user = account.user();
    document.getElementById('account-state').textContent = user ? 'Signed in with your KTHQ account. Your forum name and mentor name stay separate.' : 'One account works here and on the KTHQ forum.';
    document.getElementById('account-signout').hidden = !user;
    document.getElementById('account-signin').hidden = !!user;
    document.getElementById('account-signup-details').hidden = !!user;
  }
  if (panel) {
    document.addEventListener('kthq-account-changed', update);
    document.getElementById('account-signin').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = event.target.querySelector('button'); button.disabled = true;
      var result = await account.client.auth.signInWithPassword({ email: event.target.elements.email.value.trim(), password: event.target.elements.password.value });
      event.target.elements.password.value = '';
      document.getElementById('account-message').textContent = result.error ? result.error.message : 'Signed in. Your mentor application is separate from your public forum profile.';
      button.disabled = false;
      await account.refresh();
    });
    document.getElementById('account-signup').addEventListener('submit', async function (event) {
      event.preventDefault();
      var fields = event.target.elements;
      if (fields.password.value !== fields.confirm.value) { document.getElementById('account-message').textContent = 'The passwords do not match.'; return; }
      var button = event.target.querySelector('button'); button.disabled = true;
      // Only the chosen forum pseudonym goes into account metadata. The mentor
      // real name is submitted separately to the private Worker application.
      var result = await account.client.auth.signUp({ email: fields.email.value.trim(), password: fields.password.value, options: { emailRedirectTo: 'https://kthq.org/working-theory/mentors.html', data: { username: fields.username.value.trim(), display_name: fields.display.value.trim() || fields.username.value.trim() } } });
      fields.password.value = ''; fields.confirm.value = '';
      document.getElementById('account-message').textContent = result.error ? result.error.message : 'Check your email to verify the account, then come back to this page and sign in with the same email and password.';
      button.disabled = false;
      await account.refresh();
    });
    document.getElementById('account-signout').addEventListener('click', async function () {
      await account.client.auth.signOut({ scope: 'local' }); await account.refresh();
    });
  }
  void account.refresh();
  update();
})();
