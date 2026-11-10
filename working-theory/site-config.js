// Public settings only. Never put API keys, admin tokens, or Turnstile secrets here.
window.KTHQ_WORKING_THEORY = Object.freeze({
  apiBase: 'https://kthq-mentors.nickhazelett.workers.dev',
  accountUrl: 'https://fsdplcpmflywzoxydyno.supabase.co',
  accountPublishableKey: 'sb_publishable_uJ9FeZYBwSnyiFiH_R67yQ_zi9OudHw',
  turnstileSiteKey: '0x4AAAAAAF6N9xpirwBJdJnX',
  publishedTopics: [
    'what-ive-learned-over-the-years',
    'leadership-for-people-who-just-got-handed-it',
    'stop-controlling-people',
    'nobody-dropped-the-hammer',
    'blame',
    'everything-is-priority-one',
    'the-new-rule-after-one-mistake',
    'were-not-curing-cancer',
    'creativity',
    'make-rank-because-of-the-work'
  ] // Add a topic slug only after its essay is published. Keep in step with PUBLISHED_TOPICS in the worker.
});
