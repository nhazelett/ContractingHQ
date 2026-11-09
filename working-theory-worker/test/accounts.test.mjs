import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

class KV {
  data = new Map();
  async get(key, type) { const value = this.data.get(key); return value === undefined ? null : type === 'json' ? JSON.parse(value) : value; }
  async put(key, value) { this.data.set(key, value); }
  async list({ prefix, cursor, limit }) {
    const names = [...this.data.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0);
    return { keys: names.slice(start, start + limit).map(name => ({ name })), list_complete: start + limit >= names.length, cursor: String(start + limit) };
  }
}
function fixture(t) {
  const env = { SITE_ORIGIN: 'https://kthq.org', SUPABASE_URL: 'https://localtest.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_localtest', PUBLISHED_TOPICS: '["ownership"]', SUBMISSIONS_ENABLED: 'true', ADMIN_TOKEN: 'local-admin-token-for-tests-only-12345', IDENTITY_SECRET: 'local-identity-secret-for-tests-only-12345', TURNSTILE_SECRET_KEY: 'local-turnstile', mentors: new KV(), takes: new KV(), SUBMISSION_LIMITER: { limit: async () => ({ success: true }) } };
  const external = { turnstile: { success: true, hostname: 'kthq.org', action: 'turnstile-spin-v1' }, user: { id: '11111111-2222-4333-8444-555555555555', email: 'private@example.test', email_confirmed_at: '2026-11-09', is_anonymous: false, user_metadata: { display_name: 'Forum Pseudonym' } }, authStatus: 200 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('siteverify')) return Response.json(external.turnstile);
    assert.equal(url, env.SUPABASE_URL + '/auth/v1/user');
    assert.equal(options.headers.Authorization, 'Bearer local-session');
    return Response.json(external.user, { status: external.authStatus });
  });
  async function request(path, method = 'GET', data, auth = 'user', origin = env.SITE_ORIGIN) {
    const headers = { 'CF-Connecting-IP': '192.0.2.1' };
    if (origin) headers.Origin = origin;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + (auth === 'admin' ? env.ADMIN_TOKEN : 'local-session');
    return worker.fetch(new Request('https://mentors.example.test' + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) }), env);
  }
  const application = { email: 'spoofed@example.test', name: 'Mentor Real Name', rank: 'SSgt', field: 'Contracting', role: 'Supervisor', bio: 'Test bio.', philosophy: 'Test philosophy.', terms: true, turnstileToken: 'local-token' };
  const take = { email: 'spoofed@example.test', body: Array(150).fill('word').join(' '), topicSlug: 'ownership', turnstileToken: 'local-token' };
  async function apply() { assert.equal((await request('/mentors/apply', 'POST', application)).status, 200); const key = [...env.mentors.data.keys()][0]; return env.mentors.get(key, 'json'); }
  async function approveMentor() { const mentor = await apply(); assert.equal((await request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin')).status, 200); return mentor; }
  async function submit() { assert.equal((await request('/takes/submit', 'POST', take)).status, 200); const key = [...env.takes.data.keys()].find(key => key.startsWith('take:')); return env.takes.get(key, 'json'); }
  return { env, external, request, application, take, apply, approveMentor, submit };
}
test('both gates hold; verified account identity overrides supplied email and stays private', async t => {
  const f = fixture(t); const mentor = await f.apply();
  assert.equal(mentor.email, f.external.user.email);
  assert.equal(mentor.accountId, f.external.user.id);
  assert.notEqual(mentor.id, f.external.user.id);
  assert.equal((await f.request('/admin/queue', 'GET', undefined, null)).status, 401);
  assert.equal((await f.request('/mentors/' + mentor.id)).status, 404);
  assert.equal((await f.request('/takes/submit', 'POST', f.take)).status, 403);
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  const take = await f.submit();
  assert.deepEqual((await (await f.request('/topics/ownership/takes')).json()).takes, []);
  const queue = await (await f.request('/admin/queue', 'GET', undefined, 'admin')).json();
  assert.equal(queue.takes.length, 1);
  await f.request('/admin/approve', 'POST', { kind: 'take', id: take.id, topicSlug: 'ownership', body: 'Cannot edit' }, 'admin');
  const publicData = await (await f.request('/topics/ownership/takes')).json();
  assert.equal(publicData.takes[0].body, f.take.body);
  assert.equal(publicData.takes[0].mentor.name, 'Mentor Real Name');
  const profile = await (await f.request('/mentors/' + mentor.id)).json();
  for (const data of [publicData, profile]) for (const privateValue of [f.external.user.email, f.external.user.id, 'Forum Pseudonym', f.env.ADMIN_TOKEN, f.env.IDENTITY_SECRET, 'accountId']) assert.ok(!JSON.stringify(data).includes(privateValue));
});
test('authentication is checked remotely; absent, expired, unverified and anonymous accounts cannot contribute', async t => {
  const f = fixture(t);
  assert.equal((await f.request('/mentors/apply', 'POST', f.application, null)).status, 401);
  f.external.authStatus = 401;
  assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 401);
  f.external.authStatus = 200; f.external.user.email_confirmed_at = null;
  assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 403);
  f.external.user.email_confirmed_at = '2026-11-09'; f.external.user.is_anonymous = true;
  assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 403);
  assert.equal(f.env.mentors.data.size, 0);
});
test('another account cannot submit as an approved mentor by sending that mentor email', async t => {
  const f = fixture(t); await f.approveMentor();
  f.external.user.id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert.equal((await f.request('/takes/submit', 'POST', f.take)).status, 403);
});
test('rejected mentors can resubmit; public forms cannot overwrite approved profiles', async t => {
  const f = fixture(t); const mentor = await f.apply();
  await f.request('/admin/reject', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  f.application.bio = 'New draft.'; await f.apply();
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  f.application.bio = 'Cannot overwrite.'; await f.apply();
  assert.equal((await f.env.mentors.get('mentor:' + mentor.id, 'json')).bio, 'New draft.');
});
test('rejected takes stay private and contributors may resubmit', async t => {
  const f = fixture(t); await f.approveMentor(); const take = await f.submit();
  await f.request('/admin/reject', 'POST', { kind: 'take', id: take.id, topicSlug: 'ownership' }, 'admin');
  assert.equal((await (await f.request('/topics/ownership/takes')).json()).takes.length, 0);
  await f.submit(); assert.equal(f.env.takes.data.size, 2);
});
test('Turnstile verifies success, hostname and action; rate limits and missing bindings fail closed', async t => {
  const f = fixture(t);
  for (const check of [{ success: false }, { success: true, hostname: 'elsewhere.test', action: 'turnstile-spin-v1' }, { success: true, hostname: 'kthq.org', action: 'other' }]) {
    f.external.turnstile = check;
    assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 400);
  }
  f.env.SUBMISSION_LIMITER.limit = async () => ({ success: false });
  assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 429);
  delete f.env.SUBMISSION_LIMITER;
  assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 503);
});
test('terms, HTML, oversized data, CORS and unpublished topics are enforced', async t => {
  const f = fixture(t);
  assert.equal((await f.request('/mentors/apply', 'POST', { ...f.application, terms: false })).status, 400);
  assert.equal((await f.request('/mentors/apply', 'POST', { ...f.application, bio: '<script>alert(1)</script>' })).status, 400);
  assert.equal((await f.request('/mentors/apply', 'POST', { ...f.application, bio: 'x'.repeat(25000) })).status, 413);
  assert.equal((await f.request('/mentors/apply', 'POST', f.application, 'user', 'https://elsewhere.test')).status, 403);
  assert.equal((await f.request('/takes/submit', 'POST', { ...f.take, topicSlug: 'unpublished' })).status, 404);
  f.env.SUBMISSIONS_ENABLED = 'false'; assert.equal((await f.request('/mentors/apply', 'POST', f.application)).status, 503);
});
test('takes accept short and long writing without editorial word limits', async t => {
  const f = fixture(t); await f.approveMentor();
  for (const count of [1, 149, 501, 2500]) {
    const body = Array(count).fill('word').join(' ');
    const response = await f.request('/takes/submit', 'POST', { ...f.take, body });
    assert.equal(response.status, 200, count + ' words');
    assert.ok([...f.env.takes.data.values()].some(value => JSON.parse(value).body === body));
  }
  assert.equal((await f.request('/takes/submit', 'POST', { ...f.take, body: '   ' })).status, 400);
});
test('queue pagination skips finished collections; pending bodies require admin auth', async t => {
  const f = fixture(t);
  for (let i = 0; i < 105; i++) await f.env.mentors.put('mentor:' + i, JSON.stringify({ id: String(i), status: i % 2 ? 'pending' : 'approved' }));
  const first = await (await f.request('/admin/queue', 'GET', undefined, 'admin')).json();
  const last = await (await f.request('/admin/queue?mentors=' + first.cursors.mentors + '&takes=done', 'GET', undefined, 'admin')).json();
  assert.equal(first.mentors.length + last.mentors.length, 52);
  assert.deepEqual(last.cursors, { mentors: 'done', takes: 'done' });
  const noAuth = await f.request('/admin/queue', 'GET', undefined, null);
  assert.equal(noAuth.status, 401); assert.equal(noAuth.headers.get('Cache-Control'), 'no-store');
  assert.equal((await f.request('/takes/confirm?token=old')).status, 410);
});
