import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { searchCacheKey } from "../ocs-atlas/research.mjs";
import { requestJSON, sourceFailureMessage } from "../ocs-atlas/source-request.mjs";

const ok = () => new Response('{"results":[{"id":"UAE-hotel"}]}');
test("read-only source query retries a temporary failure with identical country and keyword", async () => {
  const calls = [];
  const body = JSON.stringify({ country: "ARE", keywords: ["hotel"] });
  let progress = 0;
  const data = await requestJSON("https://example.test", { method: "POST", body }, {
    retries: 1, retryDelayMs: 0, onRetry: () => progress++,
    fetchImpl: async (url, opts) => {
      calls.push(opts.body);
      return calls.length === 1 ? new Response("", { status: 503 }) : ok();
    },
  });
  assert.deepEqual(calls, [body, body]);
  assert.equal(progress, 1);
  assert.equal(data.results[0].id, "UAE-hotel");
});

test("timeouts retry only once and remain a failure, never empty results", async () => {
  let calls = 0;
  await assert.rejects(requestJSON("https://example.test", {}, {
    retries: 1, timeoutMs: 5, retryDelayMs: 0,
    fetchImpl: (url, { signal }) => {
      calls++;
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    },
  }), (error) => error.kind === "timeout" && /too long/.test(sourceFailureMessage(error)));
  assert.equal(calls, 2);
});

test("invalid criteria and long rate-limit waits are not retried", async () => {
  for (const status of [400, 429]) {
    let calls = 0;
    await assert.rejects(requestJSON("https://example.test", {}, {
      retries: 1, retryDelayMs: 0,
      fetchImpl: async () => { calls++; return new Response("", { status, headers: { "Retry-After": "60" } }); },
    }), (error) => error.status === status && sourceFailureMessage(error).includes(String(status)));
    assert.equal(calls, 1);
  }
});

test("switching countries cancels the old request without retrying", async () => {
  const controller = new AbortController();
  let calls = 0, retries = 0;
  const result = requestJSON("https://example.test", { signal: controller.signal }, {
    retries: 1, onRetry: () => retries++,
    fetchImpl: (url, { signal }) => {
      calls++;
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    },
  });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(calls, 1);
  assert.equal(retries, 0);
});

test("cancelling during retry backoff prevents a second source request", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestJSON("https://example.test", { signal: controller.signal }, {
    retries: 1, onRetry: () => controller.abort(),
    fetchImpl: async () => { calls++; throw new TypeError("Network failure"); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("default JSON loads do not automatically retry; malformed responses are not retried", async () => {
  for (const malformed of [false, true]) {
    let calls = 0;
    await assert.rejects(requestJSON("https://example.test", {}, {
      retries: malformed ? 1 : 0,
      fetchImpl: async () => { calls++; return new Response(malformed ? "not JSON" : "", { status: malformed ? 200 : 503 }); },
    }));
    assert.equal(calls, 1);
  }
});

test("failed additional pages retain evidence; late country responses cannot overwrite new results", async () => {
  const app = readFileSync(new URL("../ocs-atlas/app.mjs", import.meta.url), "utf8");
  const loadLayer = app.slice(app.indexOf("async function loadLayer("), app.indexOf("async function search()"));
  let rejectOld;
  const oldRows = [{ id: "prior-page" }];
  const ctx = vm.createContext({
    generation: 1, layerData: { awards: { rows: oldRows, page: 1, hasNext: true } },
    render() {}, API: "test", scope: { country: "SAU" }, controller: new AbortController(),
    spendingBody: (scope) => scope, sourceFailureMessage,
    $: () => ({ open: false }),
    json: () => new Promise((resolve, reject) => { rejectOld = reject; }),
  });
  vm.runInContext(loadLayer, ctx);
  const first = ctx.loadLayer("awards", 2, 1);
  rejectOld(new TypeError("offline"));
  await first;
  assert.equal(ctx.layerData.awards.status, "error");
  assert.equal(ctx.layerData.awards.failedPage, 2);
  assert.equal(ctx.layerData.awards.rows, oldRows);
  const stale = ctx.loadLayer("awards", 2, 1);
  ctx.generation = 2;
  const fresh = { awards: { status: "ready", rows: [{ id: "UAE-hotel" }] } };
  ctx.layerData = fresh;
  rejectOld(new TypeError("late failure"));
  await stale;
  assert.equal(ctx.layerData, fresh);
});

test("Search preserves an identical in-flight country query but starts changed criteria", async () => {
  const app = readFileSync(new URL("../ocs-atlas/app.mjs", import.meta.url), "utf8");
  const search = app.slice(app.indexOf("async function search()"), app.indexOf("async function loadHostedSAM("));
  let next = { country: "ARE", q: "hotel" }, starts = 0, aborted = 0;
  const nodes = {};
  const ctx = vm.createContext({
    scope: { ...next }, formScope: () => next, searchCacheKey, generation: 1,
    enabled: new Set(["awards"]), layerData: { awards: { status: "loading" } },
    historyRun: null, controller: { abort() { aborted++; } }, AbortController,
    profileController: new AbortController(), $: (id) => nodes[id] ||= {},
    transport: { clear() {} }, programs: null, logistics: { render() {} },
    onlySaved: false, originFilter: "", segment: "all", globalData: null, globalOn: false,
    samIsImported: false, samSnapshot: null, samClient: null,
    notify() {}, setURL() {}, updateCacheButton() {}, render() {}, focusCountry() {},
    loadLayer: async () => { starts++; },
  });
  vm.runInContext(search, ctx);
  await ctx.search();
  assert.equal(starts, 0);
  assert.equal(aborted, 0);
  next = { country: "SAU", q: "hotel" };
  await ctx.search();
  assert.equal(starts, 1);
  assert.equal(aborted, 1);
  assert.equal(ctx.scope.country, "SAU");
  ctx.layerData = { awards: { status: "loading" } };
  next = { country: "SAU", q: "lodging" };
  await ctx.search();
  assert.equal(starts, 2);
  assert.equal(ctx.scope.q, "lodging");
});
