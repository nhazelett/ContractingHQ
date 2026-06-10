/* FAR-CADE global leaderboard — Cloudflare Worker
   Deploy as: farcade-leaderboard (see FARCADE-LEADERBOARD-SETUP.md)
   Requires a KV namespace bound as: LB
*/
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const MAX_SCORE = 12000; // theoretical max is ~11,400 (15 questions x 760)
const MAX_NAME = 18;
const KEEP = 100; // scores stored per sector

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS, extra || {})
  });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const s = parseInt(url.searchParams.get('sector') || '0', 10);
      if (![0, 1, 2].includes(s)) return json({ error: 'bad sector' }, 400);
      const list = JSON.parse((await env.LB.get('sector' + s)) || '[]');
      return json({ scores: list.slice(0, 25) });
    }

    if (req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const s = parseInt(b.sector, 10);
      const score = Math.floor(Number(b.score));
      const name = String(b.name || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ._\-]/g, '')
        .replace(/ +/g, ' ')
        .trim()
        .slice(0, MAX_NAME);
      if (![0, 1, 2].includes(s) || !name || !Number.isFinite(score) || score < 1 || score > MAX_SCORE) {
        return json({ error: 'invalid' }, 400);
      }
      const key = 'sector' + s;
      const list = JSON.parse((await env.LB.get(key)) || '[]');
      const entry = { name, score, ts: Date.now() };
      list.push(entry);
      list.sort((a, b2) => b2.score - a.score);
      const trimmed = list.slice(0, KEEP);
      await env.LB.put(key, JSON.stringify(trimmed));
      const rank = trimmed.findIndex(e => e.ts === entry.ts && e.name === name && e.score === score) + 1;
      return json({ ok: true, rank: rank || null, scores: trimmed.slice(0, 25) });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};
