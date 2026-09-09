import { SOURCE_MAP, LEGACY_ROUTES } from "../market-research/sources.mjs";
import {
  validateSearch,
  sourceURL,
  sourceRequest,
  normalize,
  samWindow,
  queryLabel,
} from "../market-research/core.mjs";

const ORIGINS = new Set([
  "https://kthq.org",
  "https://www.kthq.org",
  "http://127.0.0.1:8766",
  "http://localhost:8766",
]);
const VERSION = "2026-09-09.1";
export async function boundedJSON(response, maxBytes = 3_000_000) {
  if (!response.body) throw new Error("Empty source response.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("The source response is too large. Narrow the search.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function headers(origin) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...(ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers(origin),
  });
}
export async function retrieve(id, s, env, signal) {
  let response;
  if (LEGACY_ROUTES[id]) {
    if (!env.LEGACY) {
      const e = new Error("The existing source connection is unavailable.");
      e.status = "not_connected";
      throw e;
    }
    const legacy = new URL(
      "https://kthq-market-research.nickhazelett.workers.dev" +
        LEGACY_ROUTES[id],
    );
    legacy.searchParams.set("q", s.q);
    if (id === "opportunities") {
      const w = samWindow(s);
      legacy.searchParams.set("from", w.from);
      legacy.searchParams.set("to", w.to);
      if (s.naics) legacy.searchParams.set("naics", s.naics);
      if (s.psc) legacy.searchParams.set("psc", s.psc);
    }
    response = await env.LEGACY.fetch(new Request(legacy, { signal }));
  } else if (id === "web") {
    if (!env.BRAVE_API_KEY) {
      const e = new Error(
        "Commercial web search is not connected. Use the commercial sources in the library or add a manufacturer’s page as evidence.",
      );
      e.status = "not_connected";
      throw e;
    }
    const url =
      "https://api.search.brave.com/res/v1/web/search?" +
      new URLSearchParams({ q: s.q, count: 20 });
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": env.BRAVE_API_KEY,
      },
      signal,
    });
  } else {
    const init = sourceRequest(id, s);
    response = await fetch(sourceURL(id, s), {
      ...init,
      headers: {
        ...init.headers,
        "User-Agent": "KTHQ-MarketResearch/2.0 (+https://kthq.org)",
      },
      signal,
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    const e = new Error(
      response.status === 429
        ? "This source is limiting requests. Try again later."
        : response.status === 401 || response.status === 403
          ? "This source needs its connection renewed."
          : "This source is temporarily unavailable. Try its official search.",
    );
    e.status = "unavailable";
    throw e;
  }
  const data = await boundedJSON(response);
  return normalize(id, data);
}
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !ORIGINS.has(origin))
      return json({ status: "error", error: "Origin not allowed." }, 403, "");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method !== "GET")
      return json(
        { status: "error", error: "Method not allowed." },
        405,
        origin,
      );
    const url = new URL(request.url);
    if (url.pathname === "/health")
      return json(
        {
          ok: true,
          version: VERSION,
          sources: Object.keys(SOURCE_MAP),
          webConnected: !!env.BRAVE_API_KEY,
        },
        200,
        origin,
      );
    if (url.pathname !== "/search")
      return json({ status: "error", error: "Route not found." }, 404, origin);
    const id = url.searchParams.get("source");
    if (!SOURCE_MAP[id])
      return json(
        { status: "error", error: "Unknown research source." },
        400,
        origin,
      );
    let s;
    try {
      s = validateSearch(Object.fromEntries(url.searchParams));
    } catch (e) {
      return json({ status: "error", error: e.message }, 400, origin);
    }
    if (!SOURCE_MAP[id].modes.includes(s.mode))
      return json(
        {
          status: "error",
          error: "This source does not support the selected search type.",
        },
        400,
        origin,
      );
    if (
      !s.q &&
      ![
        "awards",
        "small-business",
        "vehicles",
        "opportunities",
        "bls",
      ].includes(id)
    )
      return json(
        { status: "skipped", error: "Add a search phrase to use this source." },
        200,
        origin,
      );
    if (env.SEARCH_LIMIT) {
      const limit = await env.SEARCH_LIMIT.limit({
        key: request.headers.get("CF-Connecting-IP") || "local",
      });
      if (!limit.success)
        return json(
          {
            status: "unavailable",
            error: "Too many research requests. Please wait a minute.",
          },
          429,
          origin,
        );
    }
    // Cache only normalized, successful public search results, never project notes.
    const keyURL = new URL(request.url);
    keyURL.search = "";
    keyURL.searchParams.set("v", VERSION);
    keyURL.searchParams.set("source", id);
    for (const k of [
      "q",
      "mode",
      "kind",
      "naics",
      "psc",
      "state",
      "from",
      "to",
      "page",
    ])
      keyURL.searchParams.set(k, String(s[k]));
    const cache = globalThis.caches?.default;
    const key = new Request(keyURL);
    const hit = cache ? await cache.match(key) : null;
    if (hit) {
      const payload = await boundedJSON(hit);
      return json({ ...payload, cached: true }, 200, origin);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const data = await retrieve(id, s, env, controller.signal);
      const payload = {
        source: id,
        status: data.records.length ? "success" : "empty",
        ...data,
        retrievedAt: new Date().toISOString(),
        query: queryLabel(s),
        scope:
          SOURCE_MAP[id].scope +
          (id === "opportunities" ? " " + samWindow(s).note : ""),
        cached: false,
      };
      if (cache && ctx)
        ctx.waitUntil(
          cache
            .put(
              key,
              new Response(JSON.stringify(payload), {
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=600",
                },
              }),
            )
            .catch(() => {}),
        );
      return json(payload, 200, origin);
    } catch (e) {
      // Do not echo upstream bodies/URLs; they can include credentials or HTML.
      const error = controller.signal.aborted
        ? "The source took too long to respond. Other research results remain available."
        : e.status
          ? e.message
          : "This source returned an unusable response. Try again or use its official search.";
      console.log(
        JSON.stringify({
          event: "source_unavailable",
          source: id,
          status: e.status || "unavailable",
        }),
      );
      return json(
        {
          source: id,
          status: e.status || "unavailable",
          error,
          records: [],
          retrievedAt: new Date().toISOString(),
          query: queryLabel(s),
          scope: SOURCE_MAP[id].scope,
        },
        200,
        origin,
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
