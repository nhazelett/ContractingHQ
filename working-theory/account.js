(function () {
  'use strict';
  // One account client survives ContractingFM navigation. Tokens never enter HTML,
  // links, mentor records, or the public profile response.
  var config = window.KTHQ_WORKING_THEORY || {};
  if (!window.KTHQAccount && window.supabase && config.accountUrl && config.accountPublishableKey) {
    var db = window.supabase.createClient(config.accountUrl, config.accountPublishableKey);
    var user = null;
    async function refresh() {
      try {
        var result = await db.auth.getUser();
        user = result.error ? null : result.data.user;
      } catch (_) { user = null; }
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
  // Both signup entry points create the same identity. Only a chosen pseudonym
  // is shared with the forum; mentor profile details never enter auth metadata.
  account.register = function (input) {
    return account.client.auth.signUp({
      email: input.email.trim(), password: input.password,
      options: {
        emailRedirectTo: 'https://kthq.org/working-theory/mentors.html',
        data: { username: input.username.trim(), display_name: (input.display || input.username).trim() }
      }
    });
  };
  function update() {
    if (!panel || !panel.isConnected) return;
    var user = account.user();
    document.getElementById('account-state').textContent = user ? 'Signed in with your KTHQ account. Your forum name and mentor name stay separate.' : 'Already have a KTHQ or forum account? Sign in here or in the application below. New mentors can create their shared account as part of applying.';
    document.getElementById('account-signout').hidden = !user;
    document.getElementById('account-signin').hidden = !!user;
    document.getElementById('account-signup-details').hidden = !!user;
  }
  if (panel) {
    document.addEventListener('kthq-account-changed', update);
    document.getElementById('account-signin').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = event.target.querySelector('button'); button.disabled = true;
      try {
        var result = await account.client.auth.signInWithPassword({ email: event.target.elements.email.value.trim(), password: event.target.elements.password.value });
        document.getElementById('account-message').textContent = result.error ? result.error.message : 'Signed in with your shared KTHQ account. No second mentor account is needed.';
        await account.refresh();
      } catch (error) { document.getElementById('account-message').textContent = 'Sign-in could not complete. Please try again.'; }
      finally { event.target.elements.password.value = ''; button.disabled = false; }
    });
    document.getElementById('account-signup').addEventListener('submit', async function (event) {
      event.preventDefault();
      var fields = event.target.elements;
      if (fields.password.value !== fields.confirm.value) { document.getElementById('account-message').textContent = 'The passwords do not match.'; return; }
      var button = event.target.querySelector('button'); button.disabled = true;
      // Only the chosen forum pseudonym goes into account metadata. The mentor
      // real name is submitted separately to the private Worker application.
      try {
        var result = await account.register({ email: fields.email.value, password: fields.password.value, username: fields.username.value, display: fields.display.value });
        document.getElementById('account-message').textContent = result.error ? result.error.message : 'Check your email to verify your shared KTHQ account. If you already have an account, sign in or use password help. A mentor application is optional.';
        await account.refresh();
      } catch (error) { document.getElementById('account-message').textContent = 'Account creation could not complete. Please try again.'; }
      finally { fields.password.value = ''; fields.confirm.value = ''; button.disabled = false; }
    });
    document.getElementById('account-signout').addEventListener('click', async function () {
      await account.client.auth.signOut({ scope: 'local' }); await account.refresh();
    });
  }
  void account.refresh();
  update();
})();
