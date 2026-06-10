/* FAR-CADE global leaderboard — Cloudflare Worker (v2)
   v2 adds: weekly season boards per sector + daily drill boards.
   Deploy as: farcade-leaderboard (see FARCADE-LEADERBOARD-SETUP.md)
   Requires a KV namespace bound as: LB
   Backward compatible with v1 requests (?sector= and {sector} bodies).

   KV keys:
     sector0 / sector1 / sector2        all-time boards
     week:<YYYY-Www>:<0|1|2>            weekly season boards (UTC ISO week)
     daily:<YYYY-MM-DD>                 daily drill board (UTC date)
*/
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const MAX_SCORE = 12000; // theoretical max is ~11,400 (15 questions x 760)
const MAX_NAME = 18;
const KEEP = 100; // scores stored per board

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
  });
}

function isoWeek(d) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const y = dt.getUTCFullYear();
  const w = Math.ceil((((dt - Date.UTC(y, 0, 1)) / 86400000) + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}

function todayUTC() { return new Date().toISOString().slice(0, 10); }

function keyFor(board, scope) {
  if (board === 'daily') return 'daily:' + todayUTC();
  return scope === 'week' ? 'week:' + isoWeek(new Date()) + ':' + board : 'sector' + board;
}

async function getList(env, key) {
  return JSON.parse((await env.LB.get(key)) || '[]');
}

async function addTo(env, key, entry) {
  const list = await getList(env, key);
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, KEEP);
  await env.LB.put(key, JSON.stringify(trimmed));
  const rank = trimmed.findIndex(e => e.ts === entry.ts && e.name === entry.name && e.score === entry.score) + 1;
  return { rank: rank || null, scores: trimmed.slice(0, 25) };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const board = url.searchParams.get('board') ?? url.searchParams.get('sector') ?? '0';
      const scope = url.searchParams.get('scope') || 'all';
      if (!['0', '1', '2', 'daily'].includes(board)) return json({ error: 'bad board' }, 400);
      const list = await getList(env, keyFor(board, scope));
      return json({ scores: list.slice(0, 25) });
    }

    if (req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const board = String(b.board ?? b.sector ?? '');
      const score = Math.floor(Number(b.score));
      const name = String(b.name || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ._\-]/g, '')
        .replace(/ +/g, ' ')
        .trim()
        .slice(0, MAX_NAME);
      if (!['0', '1', '2', 'daily'].includes(board) || !name || !Number.isFinite(score) || score < 1 || score > MAX_SCORE) {
        return json({ error: 'invalid' }, 400);
      }
      const entry = { name, score, ts: Date.now() };
      if (board === 'daily') {
        const r = await addTo(env, keyFor('daily'), entry);
        return json({ ok: true, rank: r.rank, scores: r.scores });
      }
      // sectors: write all-time AND this week's season board; rank reported from the week
      await addTo(env, keyFor(board, 'all'), entry);
      const wk = await addTo(env, keyFor(board, 'week'), entry);
      return json({ ok: true, rank: wk.rank, scores: wk.scores });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};
