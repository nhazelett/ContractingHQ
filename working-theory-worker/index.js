// Separate from every existing KTHQ Worker. No credentials belong in this source.
const MAX_BYTES = 24000;
const TERMS_VERSION = '2026-11-09';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(status, message) { throw new HttpError(status, message); }
function text(value, name, max, multiline = false) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, 'Check ' + name + '.');
  const clean = value.trim().replace(/\r\n?/g, '\n');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(clean) || (!multiline && /[\r\n]/u.test(clean))) fail(400, 'Check ' + name + '.');
  if (/<\/?[a-z][^>]*>/iu.test(clean)) fail(400, 'Use plain text without HTML.');
  return clean;
}
function email(value) {
  const address = text(value, 'email', 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(address)) fail(400, 'Check the email address.');
  return address;
}
function topics(env) {
  try { const list = JSON.parse(env.PUBLISHED_TOPICS || '[]'); return Array.isArray(list) ? list : []; }
  catch { return []; }
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
async function approvedEssay(id, env) {
  if (!UUID.test(id || '')) return null;
  const essay = await env.takes.get('essay:' + id, 'json');
  if (!essay || essay.status !== 'approved') return null;
  const mentor = await env.mentors.get('mentor:' + essay.mentorId, 'json');
  return mentor?.status === 'approved' ? { essay, mentor } : null;
}
async function topic(value, env) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,100}$/.test(value)) fail(404, 'Essay not found.');
  if (topics(env).includes(value)) return value;
  if (value.startsWith('essay-') && await approvedEssay(value.slice(6), env)) return value;
  fail(404, 'This essay is not open for mentor takes yet.');
}
function readMinutes(body) { return Math.max(1, Math.ceil(body.trim().split(/\s+/u).length / 220)); }
function essaySummary(record, mentor, full = false) {
  const result = { id: record.id, topicSlug: 'essay-' + record.id, title: record.title, summary: record.summary, category: record.category, publishedAt: record.createdAt, readMinutes: readMinutes(record.body), mentor: summary(mentor) };
  if (full) { result.body = record.body; result.sources = record.sources || ''; }
  return result;
}
async function approvedWriter(request, env) {
  const user = await accountUser(request, env);
  const id = await mentorId(user.id, env);
  const mentor = await env.mentors.get('mentor:' + id, 'json');
  if (mentor?.status !== 'approved' || mentor.accountId !== user.id) fail(403, 'Your mentor profile must be approved before you publish.');
  return { user, mentor };
}
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}
function hex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
async function mentorId(address, env) {
  if (!env.IDENTITY_SECRET || env.IDENTITY_SECRET.length < 32) fail(503, 'Mentor’s Corner is not configured yet.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.IDENTITY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(address))));
}
async function authorized(request, env) {
  if (env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32) {
    const actual = await digest(request.headers.get('Authorization') || '');
    const expected = await digest('Bearer ' + env.ADMIN_TOKEN);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
    if (!difference) return;
  }
  const user = await accountUser(request, env);
  if (!env.ADMIN_EMAIL || user.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) fail(403, 'This account does not have administrator access.');
}
async function body(request, maxBytes = MAX_BYTES) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) fail(415, 'Send JSON.');
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) fail(413, 'Submission too large.');
  if (!request.body) fail(400, 'Missing submission.');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.length;
    if (total > maxBytes) { await reader.cancel(); fail(413, 'Submission too large.'); }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Invalid submission.');
    return parsed;
  } catch (error) { if (error instanceof HttpError) throw error; fail(400, 'Invalid JSON.'); }
}
async function accountUser(request, env) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_PUBLISHABLE_KEY) fail(503, 'Account sign-in is not configured.');
  const token = request.headers.get('Authorization') || '';
  if (!/^Bearer [^\s]+$/.test(token)) fail(401, 'Sign in with your KTHQ account.');
  let response;
  try {
    response = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { Authorization: token, apikey: env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) });
  } catch { fail(503, 'Account verification is unavailable. Please try again.'); }
  if (response.status === 401 || response.status === 403) fail(401, 'Please sign in again.');
  if (!response.ok) fail(503, 'Account verification is unavailable. Please try again.');
  const user = await response.json();
  if (!user.id || !user.email || !user.email_confirmed_at || user.is_anonymous) fail(403, 'Verify your KTHQ account email before contributing.');
  return user;
}
async function publicGate(request, env, data) {
  if (env.SUBMISSIONS_ENABLED !== 'true') fail(503, 'Submissions are not open yet.');
  for (const name of ['mentors', 'takes', 'SUBMISSION_LIMITER', 'TURNSTILE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
    if (!env[name]) fail(503, 'Mentor’s Corner is not configured yet.');
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) fail(503, 'Submission protection is unavailable.');
  const limit = await env.SUBMISSION_LIMITER.limit({ key: hex(await digest(ip)) });
  if (!limit.success) fail(429, 'Too many submissions. Please wait a minute.');
  const token = text(data.turnstileToken, 'bot check', 2048);
  let response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000)
    });
  } catch { fail(503, 'Bot check unavailable. Please try again.'); }
  if (!response.ok) fail(503, 'Bot check unavailable. Please try again.');
  const check = await response.json();
  if (!check.success || check.hostname !== new URL(env.SITE_ORIGIN).hostname || check.action !== 'turnstile-spin-v1') fail(400, 'Bot check failed. Please refresh and try again.');
}
function summary(record) {
  return { id: record.id, name: record.name, rank: record.rank, field: record.field, role: record.role, bio: record.bio, philosophy: record.philosophy };
}
async function batch(kv, prefix, cursor) {
  if (cursor === 'done') return { records: [], cursor: 'done' };
  const result = await kv.list({ prefix, limit: 100, ...(cursor ? { cursor } : {}) });
  const records = (await Promise.all(result.keys.map(key => kv.get(key.name, 'json')))).filter(Boolean);
  return { records, cursor: result.list_complete ? 'done' : result.cursor };
}
async function publicTakes(env, prefix, cursor, onlyMentor) {
  const page = await batch(env.takes, prefix, cursor);
  const result = [];
  for (const take of page.records) {
    if (take.status !== 'approved' || (onlyMentor && take.mentorId !== onlyMentor)) continue;
    try { await topic(take.topicSlug, env); } catch (_) { continue; }
    const mentor = await env.mentors.get('mentor:' + take.mentorId, 'json');
    if (mentor?.status !== 'approved') continue;
    const original = take.topicSlug.startsWith('essay-') ? await approvedEssay(take.topicSlug.slice(6), env) : null;
    result.push({ id: take.id, topicSlug: take.topicSlug, topicTitle: original?.essay.title, topicUrl: original ? '/working-theory/essay.html?id=' + original.essay.id : '/working-theory/' + take.topicSlug + '.html', body: take.body, createdAt: take.createdAt, mentor: summary(mentor) });
  }
  return { takes: result, cursor: page.cursor === 'done' ? null : page.cursor };
}
const NOTICE_PREFIX = 'notice:';
const NOTICE_LIFETIME = 12 * 60 * 60 * 1000;
function notificationConfigured(env) {
  return !!(env.RESEND_API_KEY && env.NOTIFY_FROM && env.NOTIFY_TO);
}
async function saveNotice(env, key, job) {
  const ttl = Math.max(60, Math.ceil((job.expiresAt - Date.now()) / 1000));
  await env.mentors.put(key, JSON.stringify(job), { expirationTtl: ttl });
}
async function deliverNotice(env, key, job) {
  if (!notificationConfigured(env) || job.state === 'failed' || job.nextAttemptAt > Date.now()) return;
  if (job.expiresAt <= Date.now()) { await env.mentors.delete(key); return; }
  // Recheck pending status before sending; a quick approval cancels the alert.
  const store = job.kind === 'mentor' ? env.mentors : env.takes;
  const record = await store.get(job.recordKey, 'json');
  if (!record || record.status !== (job.recordStatus || 'pending') || record.createdAt !== job.createdAt) {
    await env.mentors.delete(key); return;
  }
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': job.id },
      body: JSON.stringify({
        from: env.NOTIFY_FROM, to: [env.NOTIFY_TO],
        subject: job.kind === 'mentor' ? 'KTHQ: mentor application awaiting approval' : 'KTHQ: new mentor ' + (job.kind === 'essay' ? 'essay' : 'take') + ' published',
        text: job.kind === 'mentor' ? 'A new mentor application is waiting for review.\n\n' + env.SITE_ORIGIN + '/working-theory/admin.html' : 'An approved mentor has published a new ' + (job.kind === 'essay' ? 'essay' : 'take') + '.\n\n' + env.SITE_ORIGIN + job.publicPath + '\n\nManage posts: ' + env.SITE_ORIGIN + '/working-theory/admin.html'
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) { await env.mentors.delete(key); return; }
  } catch (_) { /* A timeout is retried with the same idempotency key. */ }
  job.attempts++;
  const retryable = !response || response.status === 429 || response.status >= 500;
  job.state = retryable && job.attempts < 10 ? 'pending' : 'failed';
  job.nextAttemptAt = Date.now() + Math.min(3600000, 300000 * Math.pow(2, job.attempts - 1));
  await saveNotice(env, key, job);
  // Only a generic operational marker is logged, never content or credentials.
  console.warn('Mentor approval notification not delivered; outbox status:', job.state);
}
async function queueNotice(env, ctx, kind, recordKey, record) {
  if (!env.NOTIFY_FROM || !env.NOTIFY_TO) return;
  try {
    const id = 'kthq-review-' + hex(await digest(kind + ':' + record.id + ':' + record.createdAt));
    const key = NOTICE_PREFIX + id;
    const job = { id, kind, recordKey, createdAt: record.createdAt, recordStatus: record.status, publicPath: kind === 'essay' ? '/working-theory/essay.html?id=' + record.id : record.topicSlug?.startsWith('essay-') ? '/working-theory/essay.html?id=' + record.topicSlug.slice(6) + '&mentor=' + record.mentorId : '/working-theory/' + record.topicSlug + '.html?mentor=' + record.mentorId, expiresAt: Date.now() + NOTICE_LIFETIME, attempts: 0, nextAttemptAt: 0, state: 'pending' };
    await saveNotice(env, key, job);
    const delivery = deliverNotice(env, key, job).catch(() => { console.warn('Mentor approval notification retained for retry.'); });
    if (ctx && ctx.waitUntil) ctx.waitUntil(delivery);
    else await delivery;
  } catch (_) {
    // Notification failure never changes the success of the saved submission.
    console.warn('Mentor approval notification could not be queued. Submission remains saved.');
  }
}
async function retryNotices(env) {
  if (!notificationConfigured(env)) return;
  let cursor;
  let sent = 0;
  do {
    const page = await env.mentors.list({ prefix: NOTICE_PREFIX, limit: 100, ...(cursor ? { cursor } : {}) });
    for (const entry of page.keys) {
      const job = await env.mentors.get(entry.name, 'json');
      if (!job || job.state !== 'pending' || job.nextAttemptAt > Date.now()) continue;
      await deliverNotice(env, entry.name, job);
      if (++sent >= 25) return;
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}
async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/health' && request.method === 'GET') return { ok: true, submissionsEnabled: env.SUBMISSIONS_ENABLED === 'true', notificationsConfigured: notificationConfigured(env), originalEssaysEnabled: true, autoPublishMentorPosts: true, accountAdminEnabled: !!env.ADMIN_EMAIL };
  if (path.startsWith('/admin/')) {
    await authorized(request, env);
    if (path === '/admin/dashboard' && request.method === 'GET') {
      const mentors = await batch(env.mentors, 'mentor:', url.searchParams.get('mentors'));
      const takes = await batch(env.takes, 'take:', url.searchParams.get('takes'));
      const essays = await batch(env.takes, 'essay:', url.searchParams.get('essays'));
      const records = [];
      for (const [kind, collection] of [['take', takes], ['essay', essays]]) {
        for (const record of collection.records) {
          const mentor = await env.mentors.get('mentor:' + record.mentorId, 'json');
          records.push({ ...record, kind, mentor: mentor ? summary(mentor) : { name: 'Removed mentor' } });
        }
      }
      return { mentors: mentors.records, posts: records, cursors: { mentors: mentors.cursor, takes: takes.cursor, essays: essays.cursor } };
    }
    if (path === '/admin/mentors/update' && request.method === 'POST') {
      const data = await body(request);
      if (!/^[a-f0-9]{64}$/.test(data.id || '') || !['approved', 'rejected', 'removed'].includes(data.status)) fail(400, 'Invalid mentor update.');
      const key = 'mentor:' + data.id;
      const record = await env.mentors.get(key, 'json');
      if (!record) fail(404, 'Mentor not found.');
      record.status = data.status; record.decidedAt = new Date().toISOString();
      await env.mentors.put(key, JSON.stringify(record));
      return { ok: true };
    }
    if (['/admin/posts/edit', '/admin/posts/remove', '/admin/posts/restore'].includes(path) && request.method === 'POST') {
      const data = await body(request, 240000);
      if (!['take', 'essay'].includes(data.kind) || !UUID.test(data.id || '')) fail(400, 'Invalid post.');
      if (data.kind === 'take' && (typeof data.topicSlug !== 'string' || !/^[a-z0-9-]{1,100}$/.test(data.topicSlug))) fail(400, 'Invalid topic.');
      const key = data.kind === 'essay' ? 'essay:' + data.id : 'take:' + data.topicSlug + ':' + data.id;
      const record = await env.takes.get(key, 'json');
      if (!record) fail(404, 'Post not found.');
      if (path.endsWith('/remove')) record.status = 'deleted';
      else if (path.endsWith('/restore')) {
        const mentor = await env.mentors.get('mentor:' + record.mentorId, 'json');
        if (mentor?.status !== 'approved') fail(409, 'Restore the mentor before restoring this post.');
        record.status = 'approved';
      } else {
        record.body = text(data.body, 'post', data.kind === 'essay' ? 200000 : MAX_BYTES, true);
        if (data.kind === 'essay') {
          record.title = text(data.title, 'title', 160); record.summary = text(data.summary, 'summary', 500);
          record.category = data.category === 'Moment' ? 'Moment' : 'Concept';
          record.sources = data.sources?.trim() ? text(data.sources, 'sources', 20000, true) : '';
        }
      }
      record.updatedAt = new Date().toISOString();
      await env.takes.put(key, JSON.stringify(record));
      return { ok: true };
    }
    if (path === '/admin/queue' && request.method === 'GET') {
      const mentors = await batch(env.mentors, 'mentor:', url.searchParams.get('mentors'));
      const takes = await batch(env.takes, 'take:', url.searchParams.get('takes'));
      const pendingTakes = [];
      for (const take of takes.records.filter(record => record.status === 'pending')) {
        const mentor = await env.mentors.get('mentor:' + take.mentorId, 'json');
        pendingTakes.push({ ...take, mentor: mentor ? summary(mentor) : { name: 'Missing mentor' } });
      }
      return { mentors: mentors.records.filter(record => record.status === 'pending'), takes: pendingTakes, cursors: { mentors: mentors.cursor, takes: takes.cursor } };
    }
    if (['/admin/approve', '/admin/reject'].includes(path) && request.method === 'POST') {
      const data = await body(request);
      if (!['mentor', 'take'].includes(data.kind) || !/^[a-f0-9-]{20,64}$/.test(data.id || '')) fail(400, 'Invalid record.');
      const namespace = data.kind === 'mentor' ? env.mentors : env.takes;
      if (data.kind === 'take') await topic(data.topicSlug, env);
      const key = data.kind === 'mentor' ? 'mentor:' + data.id : 'take:' + data.topicSlug + ':' + data.id;
      const record = await namespace.get(key, 'json');
      if (!record) fail(404, 'Submission not found.');
      if (record.status !== 'pending') fail(409, 'This submission has already been decided. Refresh the queue.');
      if (data.kind === 'take') {
        const mentor = await env.mentors.get('mentor:' + record.mentorId, 'json');
        if (mentor?.status !== 'approved') fail(409, 'Approve the mentor before deciding this take.');
      }
      record.status = path.endsWith('/approve') ? 'approved' : 'rejected';
      record.decidedAt = new Date().toISOString();
      await namespace.put(key, JSON.stringify(record));
      return { ok: true };
    }
    fail(404, 'Route not found.');
  }
  if (path === '/me/mentor' && request.method === 'GET') {
    const user = await accountUser(request, env);
    const id = await mentorId(user.id, env);
    const record = await env.mentors.get('mentor:' + id, 'json');
    // Private, bearer-authenticated view of the caller's own status only.
    return { mentor: record && record.accountId === user.id ? { ...summary(record), status: record.status } : null, isAdmin: !!(env.ADMIN_EMAIL && user.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) };
  }
  if (path === '/mentors/apply' && request.method === 'POST') {
    const data = await body(request);
    await publicGate(request, env, data);
    if (data.terms !== true) fail(400, 'Contributor terms must be accepted.');
    const user = await accountUser(request, env);
    const address = email(user.email);
    const id = await mentorId(user.id, env);
    const record = { id, accountId: user.id, email: address, name: text(data.name, 'name', 100), rank: text(data.rank, 'rank', 60), field: text(data.field, 'career field', 100), role: text(data.role, 'role', 140), bio: text(data.bio, 'bio', MAX_BYTES, true), philosophy: text(data.philosophy, 'philosophy', MAX_BYTES, true), status: 'pending', createdAt: new Date().toISOString(), termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() };
    const existing = await env.mentors.get('mentor:' + id, 'json');
    if (!existing || existing.status === 'rejected') {
      await env.mentors.put('mentor:' + id, JSON.stringify(record));
      await queueNotice(env, ctx, 'mentor', 'mentor:' + id, record);
    }
    return { ok: true, message: 'If eligible, your application is now in the review queue. An existing pending or approved profile is kept as submitted.' };
  }
  if (path === '/takes/submit' && request.method === 'POST') {
    const data = await body(request);
    await publicGate(request, env, data);
    const slug = await topic(data.topicSlug, env);
    const user = await accountUser(request, env);
    // Nonempty plain text; writing cadence is not an editorial word limit.
    const content = text(data.body, 'take', MAX_BYTES, true);
    const id = await mentorId(user.id, env);
    const mentor = await env.mentors.get('mentor:' + id, 'json');
    if (mentor?.status !== 'approved' || mentor.accountId !== user.id) fail(403, 'Your mentor profile must be approved before you submit a take.');
    const takeId = crypto.randomUUID();
    const record = { id: takeId, topicSlug: slug, mentorId: id, body: content, status: 'approved', createdAt: new Date().toISOString() };
    await env.takes.put('take:' + slug + ':' + takeId, JSON.stringify(record));
    await queueNotice(env, ctx, 'take', 'take:' + slug + ':' + takeId, record);
    return { ok: true, message: 'Your take is published.', url: (slug.startsWith('essay-') ? '/working-theory/essay.html?id=' + slug.slice(6) + '&mentor=' : '/working-theory/' + slug + '.html?mentor=') + mentor.id };
  }
  if (path === '/essays/submit' && request.method === 'POST') {
    const data = await body(request, 240000);
    await publicGate(request, env, data);
    const { mentor } = await approvedWriter(request, env);
    if (data.terms !== true) fail(400, 'Accept the contributor terms before publishing.');
    const id = data.submissionId || crypto.randomUUID();
    if (!UUID.test(id)) fail(400, 'Invalid submission identifier.');
    const values = { title: text(data.title, 'title', 160), summary: text(data.summary, 'summary', 500), category: data.category === 'Moment' ? 'Moment' : 'Concept', body: text(data.body, 'essay', 200000, true), sources: data.sources?.trim() ? text(data.sources, 'sources', 20000, true) : '' };
    const existing = await env.takes.get('essay:' + id, 'json');
    if (existing) {
      if (existing.mentorId !== mentor.id || existing.status !== 'approved' || Object.keys(values).some(key => values[key] !== existing[key])) fail(409, 'This submission already exists. Start a new draft to publish different writing.');
      return { ok: true, message: 'Your essay is already published.', url: '/working-theory/essay.html?id=' + id };
    }
    const record = { id, mentorId: mentor.id, ...values, status: 'approved', createdAt: new Date().toISOString(), termsVersion: TERMS_VERSION };
    await env.takes.put('essay:' + id, JSON.stringify(record));
    await queueNotice(env, ctx, 'essay', 'essay:' + id, record);
    return { ok: true, message: 'Your essay is published.', url: '/working-theory/essay.html?id=' + id };
  }
  if (path === '/essays' && request.method === 'GET') {
    const page = await batch(env.takes, 'essay:', url.searchParams.get('cursor'));
    const essays = [];
    for (const record of page.records) {
      const entry = await approvedEssay(record.id, env);
      if (entry) essays.push(essaySummary(entry.essay, entry.mentor));
    }
    return { essays, cursor: page.cursor === 'done' ? null : page.cursor };
  }
  const essayMatch = path.match(/^\/essays\/([a-f0-9-]{36})$/);
  if (essayMatch && request.method === 'GET') {
    const entry = await approvedEssay(essayMatch[1], env);
    if (!entry) fail(404, 'Essay not found.');
    return { essay: essaySummary(entry.essay, entry.mentor, true) };
  }
  if (path === '/takes/confirm') fail(410, 'Takes now use a verified KTHQ account instead of email confirmation links.');
  const topicMatch = path.match(/^\/topics\/([a-z0-9-]+)\/takes$/);
  if (topicMatch && request.method === 'GET') {
    // Empty unpublished topic is safe for preview rails, but cannot accept takes.
    try { await topic(topicMatch[1], env); } catch (_) { return { takes: [], cursor: null }; }
    return publicTakes(env, 'take:' + topicMatch[1] + ':', url.searchParams.get('cursor'));
  }
  const profileMatch = path.match(/^\/mentors\/([a-f0-9]{64})(\/(?:takes|essays))?$/);
  if (profileMatch && request.method === 'GET') {
    const mentor = await env.mentors.get('mentor:' + profileMatch[1], 'json');
    if (mentor?.status !== 'approved') fail(404, 'Mentor profile not found.');
    if (profileMatch[2] === '/essays') {
      const page = await batch(env.takes, 'essay:', url.searchParams.get('cursor'));
      return { essays: page.records.filter(record => record.mentorId === mentor.id && record.status === 'approved').map(record => essaySummary(record, mentor)), cursor: page.cursor === 'done' ? null : page.cursor };
    }
    if (profileMatch[2]) return publicTakes(env, 'take:', url.searchParams.get('cursor'), mentor.id);
    return { mentor: summary(mentor) };
  }
  fail(404, 'Route not found.');
}
export default {
  async scheduled(controller, env, ctx) {
    await retryNotices(env);
  },
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Origin' };
    if (origin && origin === env.SITE_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
    try {
      if (!env.SITE_ORIGIN || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(env.SITE_ORIGIN)) fail(503, 'Site origin is not configured.');
      if (origin && origin !== env.SITE_ORIGIN) fail(403, 'Origin not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } });
      if (request.method === 'POST' && origin !== env.SITE_ORIGIN && !new URL(request.url).pathname.startsWith('/admin/')) fail(403, 'Origin not allowed.');
      const result = await route(request, env, ctx);
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      // Do not log request bodies, email addresses, tokens, or confirmation URLs.
      return new Response(JSON.stringify({ error: error instanceof HttpError ? error.message : 'Mentor’s Corner is temporarily unavailable.' }), { status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
    }
  }
};
