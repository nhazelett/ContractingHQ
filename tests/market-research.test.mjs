import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSearch,
  validateSearch,
  spendBody,
  samWindow,
  normalize,
  safeURL,
  newProject,
  importProject,
  record,
  reportText,
  evidenceCSV,
  suppliers,
  sourceRequest,
} from "../market-research/core.mjs";
import worker, { boundedJSON } from "../market-research-backend/worker.mjs";
const search = () => ({
  ...defaultSearch(),
  q: "diesel generator",
  from: "2023-09-09",
  to: "2026-09-09",
});
test("award searches retain scope; supplier searches target recipients, not requirement keywords", () => {
  const s = { ...search(), naics: "335312", psc: "6115", state: "OH" };
  const a = spendBody(validateSearch(s));
  assert.deepEqual(a.filters.keywords, ["diesel generator"]);
  assert.deepEqual(a.filters.naics_codes, ["335312"]);
  assert.deepEqual(a.filters.psc_codes, ["6115"]);
  assert.deepEqual(a.filters.place_of_performance_locations, [
    { country: "USA", state: "OH" },
  ]);
  const b = spendBody({ ...s, q: "Example Company", mode: "supplier" });
  assert.equal(b.filters.keywords, undefined);
  assert.deepEqual(b.filters.recipient_search_text, ["Example Company"]);
});
test("small-business history stays a distinct filter, without inventing a certification", () => {
  const b = spendBody(search(), "small-business");
  assert.deepEqual(b.filters.recipient_type_names, ["small_business"]);
  assert.equal("business_status" in b.filters, false);
});
test("vehicle fields use the IDV contract and valid ordering date", () => {
  const b = spendBody(search(), "vehicles");
  assert.ok(b.filters.award_type_codes.includes("IDV_B"));
  assert.ok(b.fields.includes("Last Date to Order"));
  assert.ok(!b.fields.includes("End Date"));
});
test("SAM date window narrows to 360 days and preserves a shorter requested window", () => {
  const w = samWindow(search());
  assert.equal(w.to, "09/09/2026");
  assert.match(w.note, /2025-09-14/);
  const short = samWindow({ ...search(), from: "2026-09-01" });
  assert.equal(short.from, "09/01/2026");
});
test("invalid dates, filters, and empty queries fail before calling a source", () => {
  for (const changed of [
    { q: "", naics: "", psc: "" },
    { from: "2026-02-30" },
    { from: "2026-09-10" },
    { to: "2100-01-01" },
    { naics: "ABCDE1" },
    { naics: "5617209" },
    { psc: "D3019" },
    { state: "OHIO" },
    { state: "XX" },
    { page: 6 },
    { mode: "supplier", q: "" },
  ])
    assert.throws(() => validateSearch({ ...search(), ...changed }));
});
test("failed SAM authentication cannot be reported as an empty result or clearance", () => {
  assert.throws(
    () =>
      normalize("exclusions", {
        ok: false,
        error: "Upstream 401: API_KEY_INVALID",
      }),
    /connection renewed/,
  );
  assert.deepEqual(
    normalize("exclusions", { ok: true, results: [] }).records,
    [],
  );
});
test("unexpected API shape fails instead of fabricating a successful empty search", () => {
  assert.throws(() => normalize("awards", {}));
  assert.throws(() => normalize("calc", { error: "not found" }));
  assert.throws(() => normalize("bls", { status: "REQUEST_FAILED" }));
});
test("award normalizer preserves zero dollars and nested NAICS/PSC, without converting totals into prices", () => {
  const n = normalize("awards", {
    results: [
      {
        "Award ID": "A001",
        "Recipient Name": "EXAMPLE",
        "Recipient UEI": "UEI123",
        "Award Amount": 0,
        NAICS: { code: "335312" },
        PSC: { code: "6115" },
        generated_internal_id: "CONT_AWD_A001",
        Description: "Generator lease",
      },
    ],
    page_metadata: { hasNext: true },
  });
  assert.equal(n.records[0].amount, 0);
  assert.equal(n.records[0].facts.NAICS, "335312");
  assert.equal(n.records[0].facts["Reported award amount"], "$0.00");
  assert.equal(n.hasNext, true);
  assert.equal(n.total, null);
  assert.equal(n.records[0].facts["Unit price"], undefined);
});
test("CALC values remain ceiling rates and preserve category-comparison fields", () => {
  const n = normalize("calc", {
    hits: {
      total: { value: 10000, relation: "gte" },
      hits: [
        {
          _id: "1",
          _source: {
            labor_category: "Engineer",
            vendor_name: "Example",
            current_price: 125.5,
            min_years_experience: 5,
            education_level: "Bachelors",
            worksite: "Customer",
            idv_piid: "GS-EXAMPLE",
            business_size: "S",
          },
        },
      ],
    },
  });
  assert.equal(n.records[0].facts["Hourly ceiling"], "$125.50");
  assert.equal(n.records[0].facts["Minimum experience (years)"], "5");
  assert.match(n.note, /lower bound/);
  assert.equal(n.records[0].facts["Price paid"], undefined);
});
test("BLS unavailable observations stay visibly unavailable instead of becoming zero", () => {
  const n = normalize("bls", {
    status: "REQUEST_SUCCEEDED",
    Results: {
      series: [
        {
          data: [
            {
              year: "2025",
              period: "M10",
              periodName: "October",
              value: "-",
              footnotes: [{ text: "Data unavailable" }],
            },
          ],
        },
      ],
    },
  });
  assert.equal(n.records[0].facts["Index (1982–84=100)"], "-");
  assert.match(n.records[0].description, /unavailable/);
  assert.equal(n.records[0].amount, null);
});
test("unsafe URLs and credential-bearing links are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///C:/test",
    "https://user:secret@example.com",
  ])
    assert.equal(safeURL(url), "");
  assert.equal(
    safeURL("https://example.com/source"),
    "https://example.com/source",
  );
});
test("project round trip preserves citation gaps and researcher references", () => {
  const p = newProject();
  p.evidence = [
    {
      ...record("manual", {
        key: "a",
        title: "Manufacturer source",
        url: "https://example.com",
        company: "Example",
      }),
      citation: "E007",
      note: "See E007",
      verification: "Source reviewed",
    },
  ];
  p.conclusions.commercial = "Supported by [E007].";
  const restored = importProject(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.evidence[0].citation, "E007");
  assert.equal(restored.evidence[0].id, p.evidence[0].id);
  assert.match(reportText(restored), /\[E007\]/);
  assert.equal(restored.evidence[0].verification, "Source reviewed");
});
test("duplicate citations cannot silently corrupt an imported evidence register", () => {
  const p = newProject();
  p.evidence = [
    { ...record("manual", { title: "A" }), citation: "E001" },
    { ...record("manual", { title: "B" }), citation: "E001" },
  ];
  assert.throws(() => importProject(p), /unique/);
});
test("supplier grouping uses identifiers and excludes unresolved exclusion name matches", () => {
  const a = record("entities", {
      title: "Acme",
      company: "Acme",
      uei: "UEI1",
      kind: "supplier",
    }),
    b = record("awards", { title: "Award", company: "Acme LLC", uei: "UEI1" }),
    c = record("exclusions", {
      title: "Acme",
      company: "Acme",
      kind: "screening",
    });
  const s = suppliers([a, b, c]);
  assert.equal(s.length, 1);
  assert.equal(s[0].evidence.length, 2);
});
test("report marks missing assessment and includes failed source searches", () => {
  const p = newProject();
  p.runs = [
    {
      date: "2026-09-09",
      query: "generator",
      sources: [
        {
          id: "entities",
          status: "unavailable",
          count: 0,
          scope: "Name search",
        },
      ],
    },
  ];
  const report = reportText(p);
  assert.match(report, /unavailable/);
  assert.match(report, /Not yet documented/);
  assert.match(report, /No generative AI was used/);
  assert.doesNotMatch(report, /rule of two satisfied/i);
});
test("CSV escapes quotes, multiline data, and spreadsheet formulas", () => {
  const csv = evidenceCSV([
    {
      citation: "E001",
      title: '=HYPERLINK("bad")',
      description: "line 1\nline 2",
      facts: {},
    },
  ]);
  assert.match(csv, /'=HYPERLINK\(""bad""\)/);
  assert.match(csv, /"line 1\nline 2"/);
});
test("bounded response reader stops oversized upstream content", async () => {
  await assert.rejects(
    boundedJSON(new Response("x".repeat(20)), 10),
    /too large/,
  );
  assert.deepEqual(await boundedJSON(new Response('{"ok":true}')), {
    ok: true,
  });
});
test("Worker rejects arbitrary origins and sources before making upstream calls", async () => {
  let r = await worker.fetch(
    new Request("https://desk.test/search?source=awards&q=test", {
      headers: { Origin: "https://unknown.test" },
    }),
    {},
    {},
  );
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
  r = await worker.fetch(
    new Request("https://desk.test/search?source=https://evil.test&q=test"),
    {},
    {},
  );
  assert.equal(r.status, 400);
});
test("Worker rate limiting returns a clear retry state", async () => {
  const r = await worker.fetch(
    new Request("https://desk.test/search?source=awards&q=test"),
    { SEARCH_LIMIT: { limit: async () => ({ success: false }) } },
    {},
  );
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /wait a minute/);
});
test("optional commercial web connection remains explicit when not configured", async () => {
  const r = await worker.fetch(
    new Request("https://desk.test/search?source=web&q=generators"),
    {},
    {},
  );
  const d = await r.json();
  assert.equal(d.status, "not_connected");
  assert.deepEqual(d.records, []);
});
test("Worker normalizes legacy authentication failures without leaking upstream HTML or key strings", async () => {
  const r = await worker.fetch(
    new Request(
      "https://desk.test/search?source=entities&q=test&mode=supplier",
    ),
    {
      LEGACY: {
        fetch: async () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: "401 API_KEY_INVALID <html>secret-token</html>",
            }),
          ),
      },
    },
    {},
  );
  const data = await r.json();
  assert.equal(data.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(data), /secret-token|<html>/);
});

test("Worker rejects prototype property names as sources", async () => {
  for (const id of ["__proto__", "constructor", "toString"]) {
    const r = await worker.fetch(
      new Request(`https://desk.test/search?source=${id}&q=test`),
      {},
      {},
    );
    assert.equal(r.status, 400);
  }
});
