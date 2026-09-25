import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  logisticsRows,
  featureCollection,
  clusteredFeatures,
} from "../ocs-atlas/logistics.mjs";
import {
  companyHistoryBody,
  exactCompanyRows,
  companySummary,
  searchCacheKey,
} from "../ocs-atlas/research.mjs";
import { defaults } from "../ocs-atlas/core.mjs";
test("logistics filters retain unmapped records and keep closed facilities opt-in", () => {
  const data = {
    rows: [
      {
        id: "AAA",
        country: "SA",
        name: "Airfield",
        type: "small_airport",
        point: [0, 0],
      },
      {
        id: "BBB",
        country: "SA",
        name: "Closed",
        type: "closed_airport",
        point: null,
      },
      {
        id: "CCC",
        country: "US",
        name: "Other",
        type: "large_airport",
        point: [1, 1],
      },
    ],
  };
  assert.deepEqual(
    logisticsRows(data, { country: "SA" }).map((r) => r.id),
    ["AAA"],
  );
  assert.equal(logisticsRows(data, { country: "SA", type: "all" }).length, 2);
  assert.equal(
    logisticsRows(data, { kind: "ports", country: "SA", query: "bbb" })[0]
      .point,
    null,
  );
  assert.equal(
    featureCollection([
      ...data.rows,
      { id: "bad", point: [181, 0] },
      { id: "empty", point: ["", 0] },
    ]).features.length,
    2,
  );
});
test("worldwide company query removes capability and country, preserves dates and DoD, then verifies exact returned identity", () => {
  const scope = {
    ...defaults(),
    agency: "dod",
    q: "generators",
    naics: "23",
    psc: "1234",
  };
  const b = companyHistoryBody(scope, "ABC123DEF456", 2);
  assert.equal(b.filters.place_of_performance_locations, undefined);
  assert.equal(b.filters.keywords, undefined);
  assert.equal(b.filters.naics_codes, undefined);
  assert.equal(b.filters.psc_codes, undefined);
  assert.deepEqual(b.filters.recipient_search_text, ["ABC123DEF456"]);
  assert.equal(b.filters.agencies[0].name, "Department of Defense");
  assert.equal(b.filters.time_period[0].start_date, scope.from);
  assert.equal(b.page, 2);
  assert.throws(() => companyHistoryBody(scope, "name"));
  assert.equal(
    exactCompanyRows(
      [
        { uei: "ABC123DEF456" },
        { uei: "OTHERUEI1234" },
        { uei: "ABC123DEF456", aggregate: true },
      ],
      "ABC123DEF456",
    ).length,
    1,
  );
});
test("company summaries use reported work countries and retain distinct query scopes", () => {
  const q = defaults();
  const rows = [
    {
      id: "a",
      layer: "awards",
      scope: q,
      date: "2020-01-01",
      performanceCountry: "SAU",
      agency: "Buyer",
    },
    {
      id: "b",
      layer: "subawards",
      scope: { ...q, country: "ALL", recipientUEI: "ABC123DEF456" },
      date: "2022-01-01",
    },
    { id: "c", layer: "sam", scope: q, date: "2030-01-01", status: "Active" },
  ];
  const s = companySummary([...rows, rows[0]]);
  assert.deepEqual(s.countries, ["SAU"]);
  assert.equal(s.records, 3);
  assert.equal(s.missingWorkCountry, 1);
  assert.equal(s.scopes.length, 2);
  assert.equal(s.latest, "2022-01-01");
  assert.equal(s.counts.awards, 1);
  assert.equal(s.counts.subawards, 1);
  assert.notEqual(searchCacheKey(q), searchCacheKey({ ...q, agency: "dod" }));
});
test("bundled global logistics data retain provenance, unique identifiers and coordinate gaps", async () => {
  for (const kind of ["airfields", "ports"]) {
    const data = JSON.parse(
      await readFile(
        new URL(`../ocs-atlas/data/logistics/${kind}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.equal(data.schemaVersion, 1);
    assert.match(data.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Date.parse(data.retrievedAt));
    assert.ok(data.rows.length > 1000);
    assert.equal(new Set(data.rows.map((r) => r.id)).size, data.rows.length);
    assert.equal(featureCollection(data.rows).features.length, data.mapped);
    if (kind === "ports") {
      assert.ok(data.mapped < data.rows.length);
      assert.ok(
        data.rows.every(
          (r) => r.functions.startsWith("1") || r.functions.endsWith("8"),
        ),
      );
    }
  }
});

test("logistics map clustering preserves counts and restores precise points at close zoom", () => {
  const rows = [
    { id: "a", point: [40, 20] },
    { id: "b", point: [40.001, 20.001] },
    { id: "c", point: [-70, 40] },
  ];
  const small = clusteredFeatures(rows, 2);
  assert.equal(
    small.features.reduce((n, f) => n + (f.properties.point_count || 1), 0),
    3,
  );
  assert.ok(small.features.some((f) => f.properties.cluster));
  assert.deepEqual(clusteredFeatures(rows, 8), featureCollection(rows));
});
