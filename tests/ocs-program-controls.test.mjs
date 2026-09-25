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
  } finally {
    globalThis.document = prior;
  }
});
