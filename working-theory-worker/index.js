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
function topic(value, env) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,100}$/.test(value) || !topics(env).includes(value)) fail(404, 'This essay is not open for mentor takes yet.');
  return value;
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
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) fail(503, 'Admin access is not configured yet.');
  const value = request.headers.get('Authorization') || '';
  const actual = await digest(value);
  const expected = await digest('Bearer ' + env.ADMIN_TOKEN);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
  if (difference) fail(401, 'Admin token not accepted.');
}
async function body(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) fail(415, 'Send JSON.');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) fail(413, 'Submission too large.');
  if (!request.body) fail(400, 'Missing submission.');
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.length;
    if (total > MAX_BYTES) { await reader.cancel(); fail(413, 'Submission too large.'); }
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
    if (take.status !== 'approved' || (onlyMentor && take.mentorId !== onlyMentor) || !topics(env).includes(take.topicSlug)) continue;
    const mentor = await env.mentors.get('mentor:' + take.mentorId, 'json');
    if (mentor?.status !== 'approved') continue;
    result.push({ id: take.id, topicSlug: take.topicSlug, body: take.body, createdAt: take.createdAt, mentor: summary(mentor) });
  }
  return { takes: result, cursor: page.cursor === 'done' ? null : page.cursor };
}
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/health' && request.method === 'GET') return { ok: true, submissionsEnabled: env.SUBMISSIONS_ENABLED === 'true' };
  if (path.startsWith('/admin/')) {
    await authorized(request, env);
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
      if (data.kind === 'take') topic(data.topicSlug, env);
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

    }
    return { ok: true, message: 'If eligible, your application is now in the review queue. An existing pending or approved profile is kept as submitted.' };
  }
  if (path === '/takes/submit' && request.method === 'POST') {
    const data = await body(request);
    await publicGate(request, env, data);
    const slug = topic(data.topicSlug, env);
    const user = await accountUser(request, env);
    // Nonempty plain text; writing cadence is not an editorial word limit.
    const content = text(data.body, 'take', MAX_BYTES, true);
    const id = await mentorId(user.id, env);
    const mentor = await env.mentors.get('mentor:' + id, 'json');
    if (mentor?.status !== 'approved' || mentor.accountId !== user.id) fail(403, 'Your mentor profile must be approved before you submit a take.');
    const takeId = crypto.randomUUID();
    const record = { id: takeId, topicSlug: slug, mentorId: id, body: content, status: 'pending', createdAt: new Date().toISOString() };
    await env.takes.put('take:' + slug + ':' + takeId, JSON.stringify(record));
    return { ok: true, message: 'Your take is in the review queue. It is not public until approved.' };
  }
  if (path === '/takes/confirm') fail(410, 'Takes now use a verified KTHQ account instead of email confirmation links.');
  const topicMatch = path.match(/^\/topics\/([a-z0-9-]+)\/takes$/);
  if (topicMatch && request.method === 'GET') {
    // Empty unpublished topic is safe for preview rails, but cannot accept takes.
    if (!topics(env).includes(topicMatch[1])) return { takes: [], cursor: null };
    return publicTakes(env, 'take:' + topicMatch[1] + ':', url.searchParams.get('cursor'));
  }
  const profileMatch = path.match(/^\/mentors\/([a-f0-9]{64})(\/takes)?$/);
  if (profileMatch && request.method === 'GET') {
    const mentor = await env.mentors.get('mentor:' + profileMatch[1], 'json');
    if (mentor?.status !== 'approved') fail(404, 'Mentor profile not found.');
    if (profileMatch[2]) return publicTakes(env, 'take:', url.searchParams.get('cursor'), mentor.id);
    return { mentor: summary(mentor) };
  }
  fail(404, 'Route not found.');
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Origin' };
    if (origin && origin === env.SITE_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
    try {
      if (!env.SITE_ORIGIN || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(env.SITE_ORIGIN)) fail(503, 'Site origin is not configured.');
      if (origin && origin !== env.SITE_ORIGIN) fail(403, 'Origin not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } });
      if (request.method === 'POST' && origin !== env.SITE_ORIGIN && !new URL(request.url).pathname.startsWith('/admin/')) fail(403, 'Origin not allowed.');
      const result = await route(request, env);
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      // Do not log request bodies, email addresses, tokens, or confirmation URLs.
      return new Response(JSON.stringify({ error: error instanceof HttpError ? error.message : 'Mentor’s Corner is temporarily unavailable.' }), { status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
    }
  }
};
