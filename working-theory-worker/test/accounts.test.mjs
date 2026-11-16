import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

class KV {
  data = new Map();
  async get(key, type) { const value = this.data.get(key); return value === undefined ? null : type === 'json' ? JSON.parse(value) : value; }
  async delete(key) { this.data.delete(key); }
  async put(key, value) { this.data.set(key, value); }
  async list({ prefix, cursor, limit }) {
    const names = [...this.data.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0);
    return { keys: names.slice(start, start + limit).map(name => ({ name })), list_complete: start + limit >= names.length, cursor: String(start + limit) };
  }
}
function fixture(t) {
  const env = { SITE_ORIGIN: 'https://kthq.org', SUPABASE_URL: 'https://localtest.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_localtest', PUBLISHED_TOPICS: '["ownership"]', SUBMISSIONS_ENABLED: 'true', ADMIN_TOKEN: 'local-admin-token-for-tests-only-12345', IDENTITY_SECRET: 'local-identity-secret-for-tests-only-12345', TURNSTILE_SECRET_KEY: 'local-turnstile', mentors: new KV(), takes: new KV(), SUBMISSION_LIMITER: { limit: async () => ({ success: true }) } };
  const external = { turnstile: { success: true, hostname: 'kthq.org', action: 'turnstile-spin-v1' }, user: { id: '11111111-2222-4333-8444-555555555555', email: 'private@example.test', email_confirmed_at: '2026-11-09', is_anonymous: false, user_metadata: { display_name: 'Forum Pseudonym' } }, authStatus: 200, mail: [], mailStatus: 200, mailThrows: false };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      external.mail.push({ headers: options.headers, body: JSON.parse(options.body) });
      if (external.mailThrows) throw new Error('timeout');
      return Response.json({ id: 'local-email-id' }, { status: external.mailStatus });
    }
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
test('approved mentors publish immediately; verified identity stays private', async t => {
  const f = fixture(t); const mentor = await f.apply();
  assert.equal(mentor.email, f.external.user.email);
  assert.equal(mentor.accountId, f.external.user.id);
  assert.notEqual(mentor.id, f.external.user.id);
  assert.equal((await f.request('/admin/queue', 'GET', undefined, null)).status, 401);
  assert.equal((await f.request('/mentors/' + mentor.id)).status, 404);
  assert.equal((await f.request('/takes/submit', 'POST', f.take)).status, 403);
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  const take = await f.submit();
  assert.equal((await (await f.request('/topics/ownership/takes')).json()).takes.length, 1);
  assert.equal(take.status, 'approved');
  const queue = await (await f.request('/admin/queue', 'GET', undefined, 'admin')).json();
  assert.equal(queue.takes.length, 0);
  assert.equal((await f.request('/admin/approve', 'POST', { kind: 'take', id: take.id, topicSlug: 'ownership', body: 'Cannot edit' }, 'admin')).status, 409);
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
  take.status = 'pending'; await f.env.takes.put('take:ownership:' + take.id, JSON.stringify(take)); // legacy pending record
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

test('private mentor status returns only the verified caller profile and status', async t => {
  const f = fixture(t);
  assert.equal((await f.request('/me/mentor', 'GET', undefined, null)).status, 401);
  assert.equal((await (await f.request('/me/mentor')).json()).mentor, null);
  await f.apply();
  let data = await (await f.request('/me/mentor')).json();
  assert.equal(data.mentor.status, 'pending');
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: data.mentor.id }, 'admin');
  data = await (await f.request('/me/mentor')).json();
  assert.equal(data.mentor.status, 'approved');
  assert.ok(!JSON.stringify(data).includes(f.external.user.email));
  assert.ok(!JSON.stringify(data).includes(f.external.user.id));
  assert.ok(!JSON.stringify(data).includes('accountId'));
  f.external.user.id = 'another-verified-user';
  assert.equal((await (await f.request('/me/mentor')).json()).mentor, null);
  f.external.user.email_confirmed_at = null;
  assert.equal((await f.request('/me/mentor')).status, 403);
});
function enableMail(f) {
  Object.assign(f.env, { RESEND_API_KEY: 'local-send-secret', NOTIFY_FROM: 'KTHQ <approvals@example.test>', NOTIFY_TO: 'admin@example.test' });
}
function notice(f) {
  const entry = [...f.env.mentors.data.entries()].find(([key]) => key.startsWith('notice:'));
  return entry && { key: entry[0], value: JSON.parse(entry[1]) };
}
test('alerts go only to the configured admin for newly pending applications and takes', async t => {
  const f = fixture(t); enableMail(f);
  const mentor = await f.apply();
  await f.apply(); // already pending, no duplicate mail
  assert.equal(f.external.mail.length, 1);
  const mail = f.external.mail[0];
  assert.deepEqual(mail.body.to, ['admin@example.test']);
  assert.match(mail.body.text, /https:\/\/kthq.org\/working-theory\/admin.html/);
  for (const privateValue of [f.external.user.email, f.external.user.id, f.env.ADMIN_TOKEN, mentor.name, mentor.bio]) assert.ok(!JSON.stringify(mail.body).includes(privateValue));
  assert.equal(notice(f), undefined);
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  await f.submit();
  assert.equal(f.external.mail.length, 2);
  assert.match(f.external.mail[1].body.subject, /mentor take/);
});
test('transient mail errors save the application and retry with the same idempotency key', async t => {
  const f = fixture(t); enableMail(f); f.external.mailStatus = 503;
  const mentor = await f.apply(); assert.equal(mentor.status, 'pending');
  const job = notice(f); assert.equal(job.value.state, 'pending');
  assert.ok(!JSON.stringify(job.value).includes(f.env.RESEND_API_KEY));
  job.value.nextAttemptAt = 0;
  await f.env.mentors.put(job.key, JSON.stringify(job.value));
  f.external.mailStatus = 200;
  await worker.scheduled({}, f.env, {});
  assert.equal(f.external.mail.length, 2);
  assert.equal(f.external.mail[0].headers['Idempotency-Key'], f.external.mail[1].headers['Idempotency-Key']);
  assert.deepEqual(f.external.mail[0].body, f.external.mail[1].body);
  assert.equal(notice(f), undefined);
});
test('permanent mail errors do not prevent submission or send repeatedly', async t => {
  const f = fixture(t); enableMail(f); f.external.mailStatus = 403;
  await f.apply(); assert.equal(notice(f).value.state, 'failed');
  await worker.scheduled({}, f.env, {});
  assert.equal(f.external.mail.length, 1);
});
test('an approval before a scheduled retry cancels the now obsolete alert', async t => {
  const f = fixture(t); enableMail(f); f.external.mailThrows = true;
  const mentor = await f.apply();
  await f.request('/admin/approve', 'POST', { kind: 'mentor', id: mentor.id }, 'admin');
  const job = notice(f); job.value.nextAttemptAt = 0;
  await f.env.mentors.put(job.key, JSON.stringify(job.value));
  f.external.mailThrows = false;
  await worker.scheduled({}, f.env, {});
  assert.equal(f.external.mail.length, 1); assert.equal(notice(f), undefined);
});
test('outbox storage failure leaves the real application safely saved', async t => {
  const f = fixture(t); enableMail(f);
  const originalPut = f.env.mentors.put.bind(f.env.mentors);
  t.mock.method(f.env.mentors, 'put', async (key, value) => { if (key.startsWith('notice:')) throw new Error('outbox unavailable'); return originalPut(key,value); });
  const mentor = await f.apply(); assert.equal(mentor.status, 'pending');
  assert.equal(f.external.mail.length, 0);
});

const original = { title: 'A mentor original', summary: 'An introduction to the original essay.', category: 'Moment', body: 'First paragraph.\n\nSecond paragraph.', sources: 'Author, title, 2026.', terms: true, turnstileToken: 'local-token', submissionId: '8a55746c-1656-40f0-b6ee-ff2c7837d991' };
async function publishOriginal(f, changes = {}) {
  const response = await f.request('/essays/submit', 'POST', { ...original, ...changes });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  return (await response.json());
}
function adminAccount(f) { f.env.ADMIN_EMAIL = 'hazelett.nicholas@gmail.com'; f.external.user.email = f.env.ADMIN_EMAIL; }
test('approved mentors publish originals immediately with accurate reading time and private identities', async t => {
  const f = fixture(t); await f.approveMentor();
  const result = await publishOriginal(f, { body: Array(1000).fill('word').join(' '), status: 'pending', mentorId: 'spoofed' });
  assert.equal(result.url, '/working-theory/essay.html?id=' + original.submissionId);
  const listed = await (await f.request('/essays')).json();
  assert.equal(listed.essays.length, 1); assert.equal(listed.essays[0].readMinutes, 5);
  assert.ok(!('body' in listed.essays[0]));
  const full = await (await f.request('/essays/' + original.submissionId)).json();
  assert.equal(full.essay.body.split(' ').length, 1000);
  assert.equal(full.essay.mentor.name, 'Mentor Real Name');
  for (const value of [f.external.user.id, f.external.user.email, 'accountId', 'Forum Pseudonym']) assert.ok(!JSON.stringify(full).includes(value));
  const mentor = await f.env.mentors.get([...f.env.mentors.data.keys()].find(k => k.startsWith('mentor:')), 'json');
  const profile = await (await f.request('/mentors/' + mentor.id + '/essays')).json(); assert.equal(profile.essays.length, 1);
});
test('original essay retries do not publish duplicates or silently edit earlier work', async t => {
  const f = fixture(t); await f.approveMentor(); await publishOriginal(f); await publishOriginal(f);
  assert.equal((await (await f.request('/essays')).json()).essays.length, 1);
  assert.equal((await f.request('/essays/submit','POST',{...original,body:'Different draft'})).status,409);
});
test('unapproved, unverified and anonymous accounts cannot publish originals', async t => {
  const f=fixture(t);
  assert.equal((await f.request('/essays/submit','POST',original,null)).status,401);
  await f.apply(); assert.equal((await f.request('/essays/submit','POST',original)).status,403);
  f.external.user.email_confirmed_at=null; assert.equal((await f.request('/essays/submit','POST',original)).status,403);
  f.external.user.email_confirmed_at='verified';f.external.user.is_anonymous=true;assert.equal((await f.request('/essays/submit','POST',original)).status,403);
});
test('originals accept long writing but reject missing terms, HTML, invalid IDs and oversized transport', async t => {
  const f=fixture(t);await f.approveMentor();
  for(const changes of [{terms:false},{body:'<script>alert(1)</script>'},{submissionId:'../../path'},{title:''}]) assert.equal((await f.request('/essays/submit','POST',{...original,...changes})).status,400);
  assert.equal((await f.request('/essays/submit','POST',{...original,body:'x'.repeat(250000)})).status,413);
  await publishOriginal(f,{body:Array(8000).fill('word').join(' ')});
});
test('takes on new originals publish immediately and link back to the correct essay', async t => {
  const f=fixture(t);await f.approveMentor();await publishOriginal(f);
  const slug='essay-'+original.submissionId;
  assert.equal((await f.request('/takes/submit','POST',{...f.take,topicSlug:slug})).status,200);
  const takes=await (await f.request('/topics/'+slug+'/takes')).json();assert.equal(takes.takes.length,1);assert.equal(takes.takes[0].topicTitle,original.title);assert.equal(takes.takes[0].topicUrl,'/working-theory/essay.html?id='+original.submissionId);
});
test('account administration checks the actual verified email, never mentor approval or metadata', async t => {
  const f=fixture(t);await f.approveMentor();f.env.ADMIN_EMAIL='hazelett.nicholas@gmail.com';f.external.user.user_metadata={admin:true,email:f.env.ADMIN_EMAIL};
  for(const path of ['/admin/dashboard','/admin/mentors/update','/admin/posts/edit','/admin/posts/remove','/admin/posts/restore']) assert.equal((await f.request(path,path.endsWith('dashboard')?'GET':'POST',path.endsWith('dashboard')?undefined:{})).status,403,path);
  adminAccount(f);assert.equal((await f.request('/admin/dashboard')).status,200);
  f.external.user.email_confirmed_at=null;assert.equal((await f.request('/admin/dashboard')).status,403);
});
test('admin accounts edit and reversibly remove mentor writing without reassigning authorship', async t => {
  const f=fixture(t);const mentor=await f.approveMentor();await publishOriginal(f);const take=await f.submit();adminAccount(f);
  let response=await f.request('/admin/posts/edit','POST',{...original,title:'Edited title',body:'Edited essay.',kind:'essay',id:original.submissionId,mentorId:'spoofed'});assert.equal(response.status,200);
  let full=await (await f.request('/essays/'+original.submissionId)).json();assert.equal(full.essay.title,'Edited title');assert.equal(full.essay.mentor.id,mentor.id);
  assert.equal((await f.request('/admin/posts/remove','POST',{kind:'essay',id:original.submissionId})).status,200);
  assert.equal((await f.request('/essays/'+original.submissionId)).status,404);assert.equal((await (await f.request('/essays')).json()).essays.length,0);
  assert.equal((await f.request('/admin/posts/restore','POST',{kind:'essay',id:original.submissionId})).status,200);
  response=await f.request('/admin/posts/edit','POST',{kind:'take',id:take.id,topicSlug:'ownership',body:'Edited take.'});assert.equal(response.status,200);
  assert.equal((await (await f.request('/topics/ownership/takes')).json()).takes[0].body,'Edited take.');
  await f.request('/admin/posts/remove','POST',{kind:'take',id:take.id,topicSlug:'ownership'});assert.equal((await (await f.request('/topics/ownership/takes')).json()).takes.length,0);
});
test('removing a mentor hides their writing and blocks publishing; restoring reopens access', async t => {
  const f=fixture(t);const mentor=await f.approveMentor();await publishOriginal(f);await f.submit();adminAccount(f);
  assert.equal((await f.request('/admin/mentors/update','POST',{id:mentor.id,status:'removed'})).status,200);
  assert.equal((await f.request('/essays/'+original.submissionId)).status,404);assert.equal((await f.request('/mentors/'+mentor.id)).status,404);assert.equal((await (await f.request('/topics/ownership/takes')).json()).takes.length,0);
  assert.equal((await f.request('/takes/submit','POST',f.take)).status,403);
  assert.equal((await f.request('/admin/posts/restore','POST',{kind:'essay',id:original.submissionId})).status,409);
  await f.request('/admin/mentors/update','POST',{id:mentor.id,status:'approved'});assert.equal((await f.request('/essays/'+original.submissionId)).status,200);
});
test('published-original alerts include the new page link rather than an approval request', async t => {
  const f=fixture(t);enableMail(f);await f.approveMentor();await publishOriginal(f);
  assert.match(f.external.mail.at(-1).body.subject,/essay published/);assert.match(f.external.mail.at(-1).body.text,/essay.html\?id=/);
  assert.ok(!f.external.mail.at(-1).body.text.includes(original.body));
});
