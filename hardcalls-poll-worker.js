/* HARD CALLS anonymous poll - Cloudflare Worker (v1)
   Deploy as: hardcalls-poll (see HARDCALLS-SETUP.md)
   The scenario pages point at: https://hardcalls-poll.nickhazelett.workers.dev
   Requires a KV namespace bound as: VOTES

   Endpoints:
     POST /vote
       body: { "scenario_id": "001-parking-spaces", "choice": "A" }
       returns the updated counts: { "counts": { "A": 12, "B": 30, "C": 5 }, "total": 47 }
     GET /results/<scenario_id>
       returns: { "counts": { "A": 12, "B": 30, "C": 5 }, "total": 47 }

   No auth, no PII, no cookies, no IP logging. Repeat-vote discouragement is a
   localStorage flag on the client, best effort only, by design.

   KV keys: votes:<scenario_id>:<A|B|C>   one integer counter per choice.
   Note: increments are read-then-write, so two truly simultaneous votes can
   occasionally collapse into one. For an anonymous gut-check poll that is fine.
   To wipe or fix a count, edit the key directly in the KV dashboard.
*/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const CHOICES = ['A', 'B', 'C'];
// scenario ids look like "001-parking-spaces": digits/lowercase/hyphens, sane length
const ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS)
  });
}

async function readCounts(env, id) {
  const values = await Promise.all(
    CHOICES.map(c => env.VOTES.get('votes:' + id + ':' + c))
  );
  const counts = {};
  let total = 0;
  CHOICES.forEach((c, i) => {
    const n = parseInt(values[i], 10) || 0;
    counts[c] = n;
    total += n;
  });
  return { counts: counts, total: total };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // GET /results/<scenario_id>
    if (request.method === 'GET' && url.pathname.startsWith('/results/')) {
      const id = url.pathname.slice('/results/'.length);
      if (!ID_RE.test(id)) return json({ error: 'bad scenario_id' }, 400);
      return json(await readCounts(env, id));
    }

    // POST /vote
    if (request.method === 'POST' && url.pathname === '/vote') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

      const id = String(body.scenario_id || '');
      const choice = String(body.choice || '').toUpperCase();
      if (!ID_RE.test(id)) return json({ error: 'bad scenario_id' }, 400);
      if (CHOICES.indexOf(choice) === -1) return json({ error: 'choice must be A, B, or C' }, 400);

      const key = 'votes:' + id + ':' + choice;
      const current = parseInt(await env.VOTES.get(key), 10) || 0;
      await env.VOTES.put(key, String(current + 1));

      return json(await readCounts(env, id));
    }

    return json({ error: 'not found' }, 404);
  }
};
