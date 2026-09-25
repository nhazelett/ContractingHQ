import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initPrograms } from "../ocs-atlas/programs.mjs";
import { IDV_ORDERS_API } from "../ocs-atlas/programs-core.mjs";
const catalog = JSON.parse(
  readFileSync(new URL("../ocs-atlas/data/programs.json", import.meta.url)),
);
const snapshot = JSON.parse(
  readFileSync(
    new URL("../ocs-atlas/data/program-orders-sau.json", import.meta.url),
  ),
);
const parent = catalog.rows.find((r) => r.identifier === "FA805120D0005");
const entry = snapshot.pages.find((p) => p.parentAwardKey === parent.awardKey);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const settle = async (programs) => {
  for (let i = 0; i < 30 && programs.isBusy(); i++) await tick();
  assert.equal(programs.isBusy(), false);
};
function dom() {
  const elements = new Map();
  return {
    getElementById(id) {
      if (!elements.has(id))
        elements.set(id, {
          value: id === "programMode" ? "country" : "",
          innerHTML: "",
          textContent: "",
          disabled: false,
          hidden: false,
        });
      return elements.get(id);
    },
  };
}
test("failed refresh retains existing linked orders, and a subsequent refresh can retry completed pages", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let fail = true,
      network = 0;
    const programs = initPrograms({
      getScope: () => ({ country: "SAU" }),
      onChange() {},
      request: async (url, options) => {
        if (url.endsWith("programs.json"))
          return { ...catalog, rows: [parent] };
        if (url.endsWith("program-orders-sau.json"))
          return { ...snapshot, pages: [entry] };
        network++;
        if (fail) throw new Error("Example source unavailable");
        const pull = entry.pulls.find((p) => p.url === url);
        assert.ok(pull);
        return pull.response;
      },
    });
    await tick();
    programs.select("AFCAP");
    assert.equal(
      programs.rows().filter((r) => r.programRole === "order").length,
      5,
    );
    await document.getElementById("programCheckAll").onclick();
    assert.equal(
      programs.rows().filter((r) => r.programRole === "order").length,
      5,
    );
    assert.match(
      programs.coverage().programCoverage.orders[0].error,
      /unavailable/,
    );
    fail = false;
    await document.getElementById("programCheckAll").onclick();
    assert.ok(network >= 3);
    assert.equal(
      programs.coverage().programCoverage.orders[0].error,
      undefined,
    );
    assert.equal(
      programs.rows().filter((r) => r.programRole === "order").length,
      5,
    );
    programs.select("LOGCAP");
    assert.equal(programs.rows().length, 0);
    assert.equal(programs.coverage().programCoverage.orders.length, 0);
  } finally {
    globalThis.document = prior;
  }
});
test("switching program during a batch discards the in-flight page and stops further requests", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let release,
      calls = 0;
    const programs = initPrograms({
      getScope: () => ({ country: "SAU" }),
      onChange() {},
      request: async (url) => {
        if (url.endsWith("programs.json"))
          return { ...catalog, rows: [parent] };
        if (url.endsWith("program-orders-sau.json"))
          throw new Error("No example snapshot");
        calls++;
        assert.equal(url, IDV_ORDERS_API);
        return new Promise((resolve) => (release = resolve));
      },
    });
    await tick();
    programs.select("AFCAP");
    const run = document.getElementById("programCheckAll").onclick();
    await tick();
    assert.equal(programs.isBusy(), true);
    programs.select("LOGCAP");
    release(entry.pulls[0].response);
    await run;
    assert.equal(calls, 1);
    assert.equal(programs.isBusy(), false);
    assert.equal(programs.rows().length, 0);
    programs.select("AFCAP");
    assert.equal(
      programs.rows().filter((r) => r.programRole === "order").length,
      0,
    );
    programs.select(null);
  } finally {
    globalThis.document = prior;
  }
});

test("changing countries automatically loads verified program orders and reuses completed country checks", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let country = "SAU";
    const queries = [];
    const child = entry.pulls[0].response.results.find((r) => r.piid === entry.rows[0].identifier);
    const raw = entry.pulls[1].response.results.find((r) => r["Award ID"] === child.piid);
    const programs = initPrograms({
      getScope: () => ({ country, q: "hotel", agency: "dod" }), onChange() {},
      request: async (url, options, policy) => {
        if (url.endsWith("programs.json")) return { ...catalog, rows: [parent] };
        if (url.endsWith("program-orders-sau.json")) return { ...snapshot, pages: [entry] };
        assert.equal(policy.retries, 1);
        assert.ok(options.signal);
        const query = JSON.parse(options.body);
        queries.push(query);
        if (url === IDV_ORDERS_API) return { results: [child], page_metadata: { hasNext: false } };
        assert.equal(query.filters.place_of_performance_locations[0].country, "DEU");
        assert.equal(query.filters.keywords, undefined);
        return { results: [{ ...raw, "Primary Place of Performance": { location_country_code: "DEU", country_name: "GERMANY" } }], page_metadata: { hasNext: false } };
      },
    });
    await tick();
    programs.select("AFCAP");
    assert.equal(queries.length, 0);
    country = "DEU";
    programs.countryChanged();
    assert.equal(programs.discovery().state, "loading");
    await settle(programs);
    assert.equal(programs.discovery().state, "complete");
    assert.equal(programs.discovery().loaded, 1);
    assert.equal(programs.rows().filter((r) => r.programRole === "order")[0].performanceCountry, "DEU");
    country = "SAU"; programs.countryChanged();
    assert.equal(programs.discovery().loaded, 5);
    country = "DEU"; programs.countryChanged();
    assert.equal(programs.discovery().loaded, 1);
    assert.equal(queries.length, 2);
  } finally { globalThis.document = prior; }
});

test("a country switch aborts old program requests and late results cannot replace the new country", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let country = "DEU", releaseOld, oldSignal;
    const programs = initPrograms({
      getScope: () => ({ country }), onChange() {},
      request: async (url, options) => {
        if (url.endsWith("programs.json")) return { ...catalog, rows: [parent] };
        if (url.endsWith("program-orders-sau.json")) return { ...snapshot, pages: [] };
        if (country === "DEU") {
          oldSignal = options.signal;
          return new Promise((resolve) => { releaseOld = resolve; });
        }
        return { results: [], page_metadata: { hasNext: false } };
      },
    });
    await tick();
    programs.select("AFCAP");
    assert.equal(programs.discovery().state, "loading");
    country = "ARE"; programs.countryChanged();
    assert.equal(oldSignal.aborted, true);
    await settle(programs);
    releaseOld(entry.pulls[0].response);
    await tick();
    assert.equal(programs.discovery().state, "complete");
    assert.equal(programs.discovery().loaded, 0);
    assert.equal(programs.coverage().programCoverage.orders[0].country, "ARE");
  } finally { globalThis.document = prior; }
});

test("source errors are incomplete checks; retry recovers without a false zero-result state", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let fail = true;
    const programs = initPrograms({
      getScope: () => ({ country: "DEU" }), onChange() {},
      request: async (url) => {
        if (url.endsWith("programs.json")) return { ...catalog, rows: [parent] };
        if (url.endsWith("program-orders-sau.json")) return { ...snapshot, pages: [] };
        if (fail) throw Object.assign(new Error("Unavailable"), { kind: "http", status: 503 });
        return { results: [], page_metadata: { hasNext: false } };
      },
    });
    await tick(); programs.select("AFCAP"); await settle(programs);
    assert.equal(programs.discovery().state, "error");
    assert.match(programs.discovery().message, /HTTP 503/);
    assert.equal(programs.discovery().pending, 1);
    fail = false; await programs.check();
    assert.equal(programs.discovery().state, "complete");
  } finally { globalThis.document = prior; }
});

test("a program selected before catalog arrival starts automatically; missing catalog reports failure", async () => {
  const prior = globalThis.document;
  globalThis.document = dom();
  try {
    let resolveCatalog, calls = 0;
    const programs = initPrograms({
      getScope: () => ({ country: "DEU" }), onChange() {},
      request: async (url) => {
        if (url.endsWith("programs.json")) return new Promise((resolve) => { resolveCatalog = resolve; });
        if (url.endsWith("program-orders-sau.json")) return { ...snapshot, pages: [] };
        calls++; return { results: [], page_metadata: { hasNext: false } };
      },
    });
    programs.select("AFCAP");
    assert.equal(programs.discovery().state, "loading");
    resolveCatalog({ ...catalog, rows: [parent] });
    await tick(); await settle(programs);
    assert.equal(calls, 1);
    const unavailable = initPrograms({ getScope: () => ({ country: "DEU" }), onChange() {}, request: async () => { throw new Error("offline"); } });
    unavailable.select("AFCAP"); await tick();
    assert.equal(unavailable.discovery().state, "error");
    assert.match(unavailable.discovery().message, /catalog unavailable/i);
  } finally { globalThis.document = prior; }
});
