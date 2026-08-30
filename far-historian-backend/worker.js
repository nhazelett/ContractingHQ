/**
 * FAR Historian backend (KTHQ)
 *
 * Serves three things to the front end:
 *   GET /api/recent                          -> auto-updated "recently amended" FAR feed
 *   GET /api/annual/years?section=15.404      -> which annual editions (1996-2016) hold a section
 *   GET /api/annual?section=15.404&year=1996  -> that section's text from an annual edition
 *   GET /api/annual/part?part=15&year=1996    -> list a part's sections in one annual edition
 *   GET /api/ecfr/<path>                      -> CORS+cache proxy to the eCFR API (for filtered nets)
 *
 * The daily cron rebuilds /api/recent from the eCFR. The annual snapshots are
 * loaded once by ingest.mjs (run locally); the Worker only reads them here.
 */

const ECFR = "https://www.ecfr.gov/api/versioner/v1";
const ECFR_RENDERER = "https://www.ecfr.gov/api/renderer/v1/content/enhanced";

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      if (p === "/api/recent")        return cors(await getRecent(env));
      if (p === "/api/annual/years")  return cors(await annualYears(url, env));
      if (p === "/api/annual/part")   return cors(await annualPart(url, env));
      if (p === "/api/annual")        return cors(await annualSection(url, env));
      if (p.startsWith("/api/ecfr-renderer/")) return cors(await proxyEcfr(p, url, ctx, ECFR_RENDERER, "/api/ecfr-renderer/"));
      if (p.startsWith("/api/ecfr/")) return cors(await proxyEcfr(p, url, ctx, ECFR, "/api/ecfr/"));
      if (p === "/api/ingest")        return cors(await ingestGuard(url, env)); // see ingest.mjs
      return cors(json({ error: "not found" }, 404));
    } catch (e) {
      console.error(JSON.stringify({
        message: "FAR Historian request failed",
        path: p,
        error: String(e && e.message || e),
      }));
      return cors(json({ error: String(e && e.message || e) }, 500));
    }
  },

  // Daily auto-update: refresh the recent-changes feed.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(rebuildRecent(env));
  },
};

/* ----------------------- recent-changes feed ----------------------- */

async function getRecent(env) {
  let feed = await env.FAR_KV.get("feed:recent", "json");
  if (!feed) feed = await rebuildRecent(env); // cold start fallback
  return json(feed);
}

async function rebuildRecent(env) {
  const base = parseInt(env.RECENT_WINDOW_DAYS || "730", 10);
  // FAR core changes in bursts; widen automatically until we have content.
  let items = [], since = "";
  for (const days of [base, base * 3, 3650]) {
    since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    items = await farChangesSince(since);
    if (items.length) break;
  }
  const feed = {
    generated: new Date().toISOString(), since, count: items.length,
    items: items.slice(0, 120),
  };
  await env.FAR_KV.put("feed:recent", JSON.stringify(feed));
  return feed;
}

async function farChangesSince(since) {
  const r = await fetch(`${ECFR}/versions/title-48.json?issue_date%5Bgte%5D=${since}`);
  if (!r.ok) throw new Error("eCFR versions " + r.status);
  const recs = (await r.json()).content_versions || [];
  // FAR is 48 CFR chapter 1: parts 1-53. Agency supplements (DFARS 2xx, etc.) excluded.
  const byKey = new Map();
  for (const v of recs) {
    const lead = parseInt(v.part, 10);
    if (!(lead >= 1 && lead <= 53)) continue;
    const k = v.identifier + "|" + v.issue_date;
    const cur = byKey.get(k) || {
      section: v.identifier, name: clean(v.name), date: v.issue_date,
      part: v.part, substantive: false, removed: false,
    };
    if (v.substantive) cur.substantive = true;
    if (v.removed) cur.removed = true;
    byKey.set(k, cur);
  }
  return [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ----------------------- annual tier (read-only) ------------------- */

async function annualYears(url, env) {
  const sec = need(url, "section");
  const years = (await env.FAR_KV.get(`far:hist:${sec}`, "json")) || [];
  return json({ section: sec, years });
}

async function annualSection(url, env) {
  const sec = need(url, "section");
  const year = need(url, "year");
  const rec = await env.FAR_KV.get(`far:sec:${year}:${sec}`, "json");
  if (!rec) return json({ section: sec, year, found: false }, 404);
  return json({ found: true, ...rec });
}

async function annualPart(url, env) {
  const part = need(url, "part");
  const year = need(url, "year");
  const idx = (await env.FAR_KV.get(`far:idx:${year}`, "json")) || [];
  const lead = String(parseInt(part, 10));
  const sections = idx.filter((s) => String(parseInt(s, 10)) === lead);
  return json({ part, year, sections });
}

/* ----------------------- eCFR proxy (CORS + edge cache) ------------ */

async function proxyEcfr(pathname, url, ctx, upstreamBase, routePrefix) {
  const target = `${upstreamBase}/${pathname.slice(routePrefix.length)}${url.search}`;
  const cache = caches.default;
  const cacheKey = new Request(target);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("x-kthq-cache", "hit");
    return new Response(hit.body, { status: hit.status, headers });
  }

  const upstream = await fetchEcfrWithRetry(target);
  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("x-kthq-cache", "miss");
  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  // Point-in-time snapshots are immutable. Cache successful responses after
  // returning the streaming body so users do not wait on the cache write.
  if (response.ok) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch((error) => {
      console.error(JSON.stringify({
        message: "FAR Historian cache write failed",
        target,
        error: String(error && error.message || error),
      }));
    }));
  }
  return response;
}

async function fetchEcfrWithRetry(target) {
  let lastStatus;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(target, {
        headers: { accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8" },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok || ![429, 502, 503, 504].includes(response.status)) return response;
      lastStatus = response.status;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw lastError || new Error(`eCFR returned HTTP ${lastStatus || 503}`);
}

/* ----------------------- ingest route guard ------------------------ */
// Heavy backfill runs in ingest.mjs locally (KV bulk put). This route only
// reports status so you can confirm a year loaded.
async function ingestGuard(url, env) {
  if (env.INGEST_KEY && url.searchParams.get("key") !== env.INGEST_KEY)
    return json({ error: "unauthorized" }, 401);
  const year = url.searchParams.get("year");
  if (!year) return json({ error: "pass ?year=YYYY to check load status" }, 400);
  const idx = (await env.FAR_KV.get(`far:idx:${year}`, "json")) || [];
  return json({ year, loaded: idx.length, hint: idx.length ? "ready" : "run ingest.mjs for this year" });
}

/* ----------------------- helpers ----------------------------------- */

function need(url, k) {
  const v = url.searchParams.get(k);
  if (!v) throw new Error(`missing ?${k}`);
  return v;
}
function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET, OPTIONS");
  h.set("access-control-allow-headers", "*");
  return new Response(res.body, { status: res.status, headers: h });
}
