import test from "node:test";
import assert from "node:assert/strict";
import { initSAM } from "../ocs-atlas/sam-client.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(t) {
  const previous = { document: globalThis.document, fetch: globalThis.fetch };
  const nodes = new Map();
  const el = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        value: "",
        checked: false,
        hidden: false,
        disabled: false,
        textContent: "",
        checkValidity: () => true,
      });
    return nodes.get(id);
  };
  globalThis.document = { getElementById: el };
  el("samMode").value = "sam";
  const requests = [],
    results = [],
    errors = [],
    loading = [];
  let active = false,
    country = "SAU";
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/status"))
      return {
        ok: true,
        json: async () => ({
          configured: true,
          remaining: 10,
          dailyBudget: 10,
        }),
      };
    return new Promise((resolve) =>
      requests.push({ url, query: JSON.parse(options.body), resolve }),
    );
  };
  t.after(() => Object.assign(globalThis, previous));
  const scheduled = new Map();
  let timerId = 0;
  const client = initSAM({
    schedulePage: (run) => { scheduled.set(++timerId, run); return timerId; },
    cancelPage: (id) => scheduled.delete(id),
    getCountry: () => ({ code: country, name: country }),
    isActive: () => active,
    onLoading: (kind) => loading.push(kind),
    onError: (...args) => errors.push(args),
    onResults: (r) => results.push(r),
  });
  const reply = (n, options = {}) => {
    const request = requests[n];
    request.resolve({
      ok: !options.error,
      json: async () =>
        options.error
          ? { error: options.error }
          : {
              source: "SAM.gov",
              sensitivity: "PUBLIC",
              retrievedAt: "2026-09-25T00:00:00Z",
              page: request.query.page,
              query: request.query,
              rows: [
                {
                  id: request.query.country + request.query.page,
                  layer: request.url.endsWith("exclusions")
                    ? "exclusions"
                    : "sam",
                },
              ],
              queryTotal: 20,
              withheldRecords: 0,
              hasNext: true,
              ...options,
            },
    });
  };
  return {
    el,
    advance: () => {
      const next = scheduled.entries().next().value;
      if (next) { scheduled.delete(next[0]); next[1](); }
    },
    scheduled,
    client,
    requests,
    results,
    errors,
    loading,
    reply,
    activate: () => (active = true),
    hide: () => (active = false),
    country: (c) => (country = c),
  };
}
test("automatic first page, optional expired and exclusions, cache reuse and explicit pagination", async (t) => {
  const s = setup(t);
  s.client.sync();
  assert.equal(s.requests.length, 0);
  s.activate();
  s.client.sync();
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].query.status, "A");
  s.reply(0);
  await tick();
  assert.equal(s.results.at(-1).rows.length, 1);
  s.client.sync();
  assert.equal(s.requests.length, 1);
  s.el("samMore").onclick();
  assert.equal(s.requests[1].query.page, 1);
  s.reply(1);
  await tick();
  assert.equal(s.results.at(-1).rows.length, 2);
  s.el("samExpired").checked = true;
  s.el("samExpired").onchange();
  assert.equal(s.requests[2].query.status, "");
  assert.equal(s.requests[2].query.page, 0);
  s.reply(2);
  await tick();
  s.el("samMode").value = "exclusions";
  s.el("samMode").onchange();
  assert.equal(s.requests[3].url, "/api/sam/exclusions");
  assert.deepEqual(s.requests[3].query, { country: "SAU", name: "", page: 0 });
  s.reply(3);
  await tick();
  assert.equal(s.results.at(-1).kind, "exclusions");
  assert.equal(s.el("samRegistrationFilters").hidden, true);
});
test("rapid country changes serialize and coalesce, discarding old replies and hidden-source updates", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.country("USA");
  s.client.countryChanged();
  s.country("DEU");
  s.client.countryChanged();
  assert.equal(s.requests.length, 1);
  s.reply(0);
  await tick();
  assert.equal(s.results.length, 0);
  assert.equal(s.requests[1].query.country, "DEU");
  s.hide();
  s.client.sync();
  s.reply(1);
  await tick();
  assert.equal(s.results.length, 0);
  s.activate();
  s.client.sync();
  assert.equal(s.requests.length, 2);
  assert.equal(s.results.at(-1).query.country, "DEU");
});
test("A to B to A reuses the in-flight A reply without an unnecessary B request", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.country("USA");
  s.client.sync();
  s.country("SAU");
  s.client.sync();
  s.reply(0);
  await tick();
  assert.equal(s.requests.length, 1);
  assert.equal(s.results.at(-1).query.country, "SAU");
});
test("invalid incomplete codes spend no request and failures expose retry without showing stale results", async (t) => {
  const s = setup(t);
  s.activate();
  s.el("samSearchForm").checkValidity = () => false;
  s.client.sync();
  assert.equal(s.requests.length, 0);
  s.el("samSearchForm").checkValidity = () => true;
  s.client.sync();
  s.reply(0, { error: "Daily budget reached" });
  await tick();
  assert.equal(s.results.length, 0);
  assert.equal(s.el("samRetry").hidden, false);
  assert.match(
    s.el("samSearchStatus").textContent,
    /No results loaded.*budget/,
  );
  s.el("samRetry").onclick();
  assert.equal(s.requests.length, 2);
  s.reply(1);
  await tick();
  assert.equal(s.el("samRetry").hidden, true);
});


test("automatically loads every page, reports source total and reuses the complete cache", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.reply(0, { sourcePageRecords: 10 });
  await tick();
  assert.match(s.el("samLoadProgress").textContent, /1 of 20 matching registrations/);
  assert.match(s.el("samLoadProgress").textContent, /up to 1 more SAM call/);
  assert.equal(s.el("samStop").hidden, false);
  s.advance();
  assert.equal(s.requests[1].query.page, 1);
  s.reply(1, { hasNext: false, sourcePageRecords: 10 });
  await tick();
  assert.equal(s.results.at(-1).sourceRecordsLoaded, 20);
  assert.equal(s.results.at(-1).rows.length, 2);
  assert.match(s.el("samLoadProgress").textContent, /All matching query pages loaded/);
  assert.equal(s.el("samStop").hidden, true);
  assert.equal(s.scheduled.size, 0);
  s.client.sync();
  s.advance();
  assert.equal(s.requests.length, 2);
});

test("stop retains an in-flight page, resume continues, and a failed later page never restarts at zero", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.reply(0);
  await tick();
  s.el("samStop").onclick();
  s.advance();
  assert.equal(s.requests.length, 1);
  assert.match(s.el("samLoadProgress").textContent, /Paused/);
  s.el("samResume").onclick();
  assert.equal(s.requests[1].query.page, 1);
  s.el("samStop").onclick();
  s.reply(1);
  await tick();
  assert.equal(s.results.at(-1).rows.length, 2);
  assert.equal(s.scheduled.size, 0);
  s.el("samResume").onclick();
  assert.equal(s.requests[2].query.page, 2);
  s.reply(2, { error: "Daily budget reached" });
  await tick();
  assert.match(s.el("samLoadProgress").textContent, /2 of 20.*retained.*budget/);
  assert.equal(s.scheduled.size, 0);
  s.el("samRetry").onclick();
  assert.equal(s.requests[3].query.page, 2);
  s.reply(3, { hasNext: false });
  await tick();
  assert.equal(s.results.at(-1).rows.length, 3);
});

test("country changes cancel scheduled pages; hiding the source stops automatic work", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.reply(0);
  await tick();
  s.country("DEU");
  s.client.sync();
  s.advance();
  assert.equal(s.requests.length, 2);
  assert.equal(s.requests[1].query.country, "DEU");
  s.reply(1);
  await tick();
  s.hide();
  s.client.sync();
  s.advance();
  assert.equal(s.requests.length, 2);
  assert.equal(s.el("samLoadPanel").hidden, true);
});

test("exclusions stay paged and an API result ceiling does not trigger another call", async (t) => {
  const s = setup(t);
  s.activate();
  s.el("samMode").value = "exclusions";
  s.client.sync();
  s.reply(0);
  await tick();
  s.advance();
  assert.equal(s.requests.length, 1);
  s.el("samMore").onclick();
  s.reply(1, { hasNext: false, capped: true, queryTotal: 12000 });
  await tick();
  assert.match(s.el("samLoadProgress").textContent, /API result ceiling reached/);
  assert.equal(s.scheduled.size, 0);
});


test("a stopped queued country can resume even before its first page exists", async (t) => {
  const s = setup(t);
  s.activate();
  s.client.sync();
  s.country("DEU");
  s.client.sync();
  s.el("samStop").onclick();
  assert.equal(s.el("samResume").hidden, false);
  s.el("samResume").onclick();
  s.reply(0);
  await tick();
  assert.equal(s.results.length, 0);
  assert.equal(s.requests[1].query.country, "DEU");
  s.reply(1, { hasNext: false });
  await tick();
  assert.equal(s.results.at(-1).query.country, "DEU");
});
