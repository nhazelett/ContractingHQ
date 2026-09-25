import { samEndpoint } from "../ocs-atlas/service-config.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { SharedSamGateway, boundedJSON } from "../ocs-backend/gateway.mjs";
import { handleRequest } from "../ocs-backend/http.mjs";
const countries = [
  { code: "SAU", iso2: "SA" },
  { code: "USA", iso2: "US" },
];
function fixture(options = {}) {
  const memory = new Map();
  const store = {
    get: (k) => structuredClone(memory.get(k)),
    set: (k, v) => memory.set(k, structuredClone(v)),
    pruneCache: () => {},
  };
  let calls = 0,
    time = Date.parse("2026-09-25T12:00:00Z");
  const args = {
    store,
    key: "FAKE_TEST_KEY",
    countries,
    budget: 12,
    seedDay: "2026-09-25",
    seedUsed: 10,
    now: () => time,
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ totalRecords: 0, entityData: [] }));
    },
    ...options,
  };
  return {
    gateway: new SharedSamGateway(args),
    store,
    args,
    calls: () => calls,
    time: (t) => (time = Date.parse(t)),
  };
}
test("shared SAM budget carries local usage, survives eviction, serves cached pages at cap and resets at UTC midnight", async () => {
  const f = fixture();
  assert.equal(f.gateway.status().remaining, 2);
  assert.equal(f.gateway.status().resetsAt, "2026-09-26T00:00:00.000Z");
  await f.gateway.search("entities", { country: "SAU" });
  const revived = new SharedSamGateway(f.args);
  assert.equal(revived.status().remaining, 1);
  await revived.search("entities", { country: "USA" });
  assert.equal(
    (await revived.search("entities", { country: "SAU" })).cached,
    true,
  );
  assert.equal(f.calls(), 2);
  await assert.rejects(
    revived.search("entities", { country: "USA", name: "other" }),
    /allowance reached/,
  );
  f.time("2026-09-26T00:00:01Z");
  assert.equal(revived.status().remaining, 12);
});
test("concurrent callers cannot overspend a shared budget and a persisted lease blocks overlapping upstream fetches", async () => {
  let resolve;
  const f = fixture({ fetchImpl: () => new Promise((r) => (resolve = r)) });
  const first = f.gateway.search("entities", { country: "SAU" });
  await assert.rejects(
    new SharedSamGateway(f.args).search("entities", { country: "USA" }),
    /running/,
  );
  assert.equal(f.gateway.status().used, 11);
  resolve(new Response(JSON.stringify({ totalRecords: 0, entityData: [] })));
  await first;
  assert.equal(f.gateway.status().busy, false);
});
test("upstream failures are counted, sensitive bodies are never returned, rate limiting persists, invalid queries spend nothing", async () => {
  const f = fixture({
    fetchImpl: async () =>
      new Response("FAKE_TEST_KEY secret url", { status: 429 }),
  });
  await assert.rejects(
    f.gateway.search("entities", { country: "SAU" }),
    (e) => !e.message.includes("FAKE_TEST_KEY") && e.status === 429,
  );
  assert.equal(f.gateway.status().used, 11);
  assert.equal(f.gateway.status().retryAfter, 60);
  await assert.rejects(
    new SharedSamGateway(f.args).search("entities", { country: "USA" }),
    /pause/,
  );
  await assert.rejects(
    f.gateway.search("entities", { country: "SAU", api_key: "injected" }),
    /Unsupported/,
  );
  assert.equal(f.gateway.status().used, 11);
  const diagnostic = fixture({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          message: "includeSections invalid FAKE_TEST_KEY https://example.com",
        }),
        { status: 400 },
      ),
  });
  await assert.rejects(
    diagnostic.gateway.search("exclusions", { country: "SAU" }),
    (e) =>
      /response sections/.test(e.message) &&
      !e.message.includes("FAKE_TEST_KEY"),
  );
});
test("public worker restricts browser origins, methods, body size and headers before queries reach SAM", async () => {
  let queries = 0;
  const env = {
    SEARCH_LIMIT: { limit: async () => ({ success: true }) },
    SAM: {
      getByName: () => ({
        status: () => ({ configured: true }),
        search: () => {
          queries++;
          return { status: 200, body: { rows: [] } };
        },
      }),
    },
  };
  const url = "https://worker.example/api/sam/entities";
  assert.equal(
    (
      await handleRequest(
        new Request(url, {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleRequest(
        new Request(url, {
          method: "POST",
          headers: { Origin: "https://kthq.org" },
        }),
        env,
      )
    ).status,
    415,
  );
  const preflight = await handleRequest(
    new Request(url, {
      method: "OPTIONS",
      headers: { Origin: "https://kthq.org" },
    }),
    env,
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Origin"),
    "https://kthq.org",
  );
  const headers = {
    Origin: "https://kthq.org",
    "Content-Type": "application/json",
    "X-OCS-Request": "1",
  };
  assert.equal(
    (
      await handleRequest(
        new Request(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ country: "SAU" }),
        }),
        env,
      )
    ).status,
    200,
  );
  assert.equal(queries, 1);
  assert.equal(
    (
      await handleRequest(
        new Request(url, { method: "POST", headers, body: "x".repeat(5000) }),
        env,
      )
    ).status,
    413,
  );
  assert.equal(queries, 1);
  await assert.rejects(
    boundedJSON(new Response("x".repeat(100)).body, 50),
    /large/,
  );
});

test("hosted browsers use the secret-free service URL while localhost uses its shared-service proxy", () => {
  assert.equal(
    samEndpoint("/api/sam/status", "kthq.org"),
    "https://kthq-ocs-sam.nickhazelett.workers.dev/api/sam/status",
  );
  assert.equal(samEndpoint("/api/sam/status", "127.0.0.1"), "/api/sam/status");
});
test("edge fetches reject redirects without using Cloudflare's unsupported redirect-error option", async () => {
  const f = fixture({
    fetchImpl: async (url, options) => {
      assert.equal(options.redirect, "manual");
      return new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.example/" },
      });
    },
  });
  await assert.rejects(
    f.gateway.search("entities", { country: "SAU" }),
    /HTTP 302/,
  );
});
