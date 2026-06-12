/* FAR-CADE global leaderboard — Cloudflare Worker (v4)
   v2: weekly season boards per sector + daily drill boards.
   v3: /admin endpoint (requires ADMIN_TOKEN secret) — purge a callsign
       from every board, inspect raw boards, wipe a board.
   v4: CLOSEOUT boards (board id "closeout") — daily / weekly / all-time,
       dollar-scale scores, months+time tiebreak. One POST writes all three.
   Deploy as: farcade-leaderboard (see FARCADE-LEADERBOARD-SETUP.md)
   Requires a KV namespace bound as: LB
   Backward compatible with v1 requests (?sector= and {sector} bodies).

   KV keys:
     sector0 / sector1 / sector2        all-time boards (PART LOCK)
     week:<YYYY-Www>:<0|1|2>            weekly season boards (UTC ISO week)
     daily:<YYYY-MM-DD>                 daily drill board (UTC date)
     closeout                           CLOSEOUT all-time
     week:<YYYY-Www>:closeout           CLOSEOUT weekly (UTC ISO week)
     daily:<YYYY-MM-DD>:closeout        CLOSEOUT daily (UTC date)
*/
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const MAX_SCORE = 12000; // PART LOCK theoretical max is ~11,400 (15 questions x 760)
const BOARD_MAX = { '0': 12000, '1': 12000, '2': 12000, 'daily': 12000, 'closeout': 25000000 };
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
  if (board === 'closeout') {
    if (scope === 'week') return 'week:' + isoWeek(new Date()) + ':closeout';
    if (scope === 'day') return 'daily:' + todayUTC() + ':closeout';
    return 'closeout';
  }
  return scope === 'week' ? 'week:' + isoWeek(new Date()) + ':' + board : 'sector' + board;
}

async function getList(env, key) {
  return JSON.parse((await env.LB.get(key)) || '[]');
}

async function addTo(env, key, entry) {
  const list = await getList(env, key);
  list.push(entry);
  list.sort((a, b) => b.score - a.score || (b.m || 0) - (a.m || 0) || (b.t || 0) - (a.t || 0));
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
      if (!['0', '1', '2', 'daily', 'closeout'].includes(board)) return json({ error: 'bad board' }, 400);
      const list = await getList(env, keyFor(board, scope));
      return json({ scores: list.slice(0, 25) });
    }

    if (req.method === 'POST' && url.pathname === '/admin') {
      let b;
      try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (!env.ADMIN_TOKEN || b.token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
      const action = b.action;
      if (action === 'keys') {
        const l = await env.LB.list();
        return json({ keys: l.keys.map(k => k.name) });
      }
      if (action === 'show') {
        const key = String(b.key || '');
        return json({ key, scores: await getList(env, key) });
      }
      if (action === 'purge_name') {
        const name = String(b.name || '').toUpperCase().trim();
        if (!name) return json({ error: 'name required' }, 400);
        const l = await env.LB.list();
        let removed = 0;
        for (const k of l.keys) {
          const list = await getList(env, k.name);
          const kept = list.filter(e => e.name !== name);
          if (kept.length !== list.length) {
            removed += list.length - kept.length;
            await env.LB.put(k.name, JSON.stringify(kept));
          }
        }
        return json({ ok: true, removed });
      }
      if (action === 'wipe_key') {
        const key = String(b.key || '');
        if (!key) return json({ error: 'key required' }, 400);
        await env.LB.delete(key);
        return json({ ok: true, deleted: key });
      }
      return json({ error: 'unknown action' }, 400);
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
      const maxScore = BOARD_MAX[board] ?? MAX_SCORE;
      if (!['0', '1', '2', 'daily', 'closeout'].includes(board) || !name || !Number.isFinite(score) || score < 1 || score > maxScore) {
        return json({ error: 'invalid' }, 400);
      }
      const entry = { name, score, ts: Date.now() };
      if (board === 'closeout') {
        const m = Math.max(0, Math.min(12, Math.floor(Number(b.m)) || 0));
        const t = Math.max(0, Math.min(1000, Math.floor(Number(b.t)) || 0));
        entry.m = m; entry.t = t;
        // one submit writes daily + weekly + all-time; rank reported from all-time
        await addTo(env, keyFor('closeout', 'day'), entry);
        await addTo(env, keyFor('closeout', 'week'), entry);
        const at = await addTo(env, keyFor('closeout', 'all'), entry);
        return json({ ok: true, rank: at.rank, scores: at.scores });
      }
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
