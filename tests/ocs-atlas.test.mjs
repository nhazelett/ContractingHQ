import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  spendingBody,
  geographyBody,
  normalizeGeography,
  normalizeAwards,
  suppliers,
  dedupe,
  filterSuppliers,
  csv,
  validateSnapshot,
  samRowsForScope,
  validate,
  safeURL,
} from "../ocs-atlas/core.mjs";
import { normalizeEntity } from "../scripts/ocs-sam-public.mjs";
const scope = { ...defaults(new Date("2026-09-24")), country: "SAU" };
const countries = [
  { code: "SAU", iso2: "SA", name: "Saudi Arabia" },
  { code: "USA", iso2: "US", name: "United States" },
  { code: "GBR", iso2: "GB", name: "United Kingdom" },
];
const response = (rows) => ({
  results: rows,
  page_metadata: { hasNext: false },
});
test("country performance filters do not restrict supplier origin; DoD and subaward types are explicit", () => {
  const b = spendingBody({ ...scope, agency: "dod" }, "subawards");
  assert.deepEqual(b.filters.place_of_performance_locations, [
    { country: "SAU" },
  ]);
  assert.equal(b.filters.recipient_locations, undefined);
  assert.equal(b.subawards, true);
  assert.equal(b.filters.agencies[0].name, "Department of Defense");
  assert.ok(b.fields.includes("Sub-Recipient UEI"));
  assert.deepEqual(
    spendingBody({ ...scope, country: "PRI" }).filters
      .place_of_performance_locations,
    [{ country: "USA", state: "PR" }],
  );
});
test("normalization retains actual country codes, non-UEI identity, provenance, and separate subaward geography", () => {
  const rows = normalizeAwards(
    response([
      {
        "Sub-Award ID": "sub1",
        "Sub-Awardee Name": "Vendor",
        "Sub-Recipient UEI": "ABC123",
        "Sub-Award Amount": 0,
        "Sub-Recipient Location": { location_country_code: "GBR" },
        "Sub-Award Primary Place of Performance": {
          location_country_code: "SAU",
          city_name: "Riyadh",
        },
        "Prime Award ID": "p1",
        "Prime Recipient Name": "Prime",
      },
    ]),
    "subawards",
    scope,
    "2026-09-24",
  ).rows;
  assert.equal(rows[0].origin, "GBR");
  assert.equal(rows[0].performanceCountry, "SAU");
  assert.equal(rows[0].performanceCity, "Riyadh");
  assert.equal(rows[0].amount, 0);
  assert.equal(rows[0].scope.country, "SAU");
  assert.equal(rows[0].primeName, "Prime");
  assert.equal(rows[0].retrievedAt, "2026-09-24");
});
test("exact UEI links only; matching names never collapse distinct UEIs or cross-source unknowns", () => {
  const rows = [
    { id: "1", layer: "awards", name: "ACME", uei: "A", origin: "USA" },
    { id: "2", layer: "subawards", name: "ACME LTD", uei: "A", origin: "USA" },
    { id: "3", layer: "awards", name: "ACME", uei: "B", origin: "SAU" },
    { id: "4", layer: "awards", name: "ACME", uei: "", origin: "SAU" },
    { id: "5", layer: "sam", name: "ACME", uei: "", origin: "SAU" },
  ];
  const list = suppliers(rows, countries, "SAU");
  assert.equal(list.length, 4);
  assert.equal(list.find((s) => s.uei === "A").rows.length, 2);
  assert.equal(list.find((s) => s.uei === "A").segment, "us");
  assert.equal(list.find((s) => s.uei === "B").segment, "local");
});
test("conflicting origin evidence stays unknown; sums never mix subaward and prime amounts", () => {
  const list = suppliers(
    [
      { layer: "awards", name: "A", uei: "X", origin: "USA", amount: 100 },
      { layer: "subawards", name: "A", uei: "X", origin: "SAU", amount: 50 },
    ],
    countries,
    "SAU",
  );
  assert.equal(list[0].origin, "");
  assert.equal(list[0].segment, "unknown");
  assert.equal(list[0].primeAmount, 100);
});
test("subawards sharing an identifier but different parents survive; exact duplicates do not", () => {
  const r = {
    "Sub-Award ID": "1",
    "Sub-Awardee Name": "A",
    "Sub-Award Date": "2025-01-01",
    "Prime Award ID": "P",
  };
  const rows = normalizeAwards(
    response([r, r, { ...r, "Prime Award ID": "Q" }]),
    "subawards",
    scope,
  ).rows;
  assert.equal(dedupe(rows).length, 2);
});
test("malformed source response fails instead of returning zero suppliers", () => {
  assert.throws(() => normalizeAwards({ results: [] }, "awards", scope));
  assert.throws(() =>
    normalizeAwards({ error: "rate limited" }, "awards", scope),
  );
});
test("unknown money is null; future performance starts remain reported", () => {
  const [r] = normalizeAwards(
    response([
      {
        "Award ID": "a",
        "Recipient Name": "A",
        "Award Amount": null,
        "Start Date": "2027-01-01",
      },
    ]),
    "awards",
    scope,
  ).rows;
  assert.equal(r.amount, null);
  assert.equal(r.date, "2027-01-01");
});
test("CSV escapes cells and blocks spreadsheet formulas; unsafe links are rejected", () => {
  const result = csv([
    { name: "=cmd()", description: 'hello,"there"\nnext', amount: -3 },
  ]);
  assert.ok(result.includes("'=cmd()"));
  assert.ok(result.includes('""there""'));
  assert.equal(safeURL("javascript:alert(1)"), "");
  assert.equal(safeURL("https://user:password@site.test"), "");
});
test("scope validation rejects malformed dates and unsupported classifications", () => {
  assert.throws(() => validate({ ...scope, from: "2025-02-30" }));
  assert.throws(() => validate({ ...scope, psc: "ABCDE" }));
  assert.throws(() => validate({ ...scope, from: "2027-01-01" }));
});
test("SAM snapshot importer rejects restricted labels and drops non-allowlisted properties", () => {
  assert.throws(() =>
    validateSnapshot({
      schemaVersion: 1,
      source: "SAM.gov",
      sensitivity: "FOUO",
      asOf: "2026-09-24",
      rows: [],
    }),
  );
  const snapshot = validateSnapshot({
    schemaVersion: 1,
    source: "SAM.gov",
    sensitivity: "PUBLIC",
    asOf: "2026-09-24",
    rows: [
      {
        layer: "sam",
        uei: "X",
        name: "Vendor",
        origin: "SAU",
        naics: "541330;238220",
        privateField: "not copied",
      },
    ],
  });
  assert.equal(snapshot.rows[0].privateField, undefined);
  assert.equal(
    samRowsForScope(snapshot, { ...scope, naics: "238" }, countries).length,
    1,
  );
  assert.equal(
    samRowsForScope(snapshot, { ...scope, country: "USA" }, countries).length,
    0,
  );
});
test("public SAM conversion copies only public-display registration and capability fields", () => {
  const r = normalizeEntity(
    {
      entityRegistration: {
        ueiSAM: "X",
        legalBusinessName: "Vendor",
        publicDisplayFlag: "Y",
      },
      coreData: {
        physicalAddress: { countryCode: "SAU", city: "Riyadh" },
        bankInformation: { account: "private" },
      },
      assertions: {
        goodsAndServices: { naicsList: [{ naicsCode: "541330" }] },
      },
    },
    "2026-09-24",
  );
  assert.equal(r.naics, "541330");
  assert.equal(r.origin, "SAU");
  assert.equal(JSON.stringify(r).includes("private"), false);
  assert.equal(
    normalizeEntity(
      {
        entityRegistration: {
          ueiSAM: "X",
          legalBusinessName: "Vendor",
          publicDisplayFlag: "N",
        },
      },
      "2026-09-24",
    ),
    null,
  );
  assert.equal(
    normalizeEntity(
      { entityRegistration: { ueiSAM: "X", legalBusinessName: "Vendor" } },
      "2026-09-24",
    ),
    null,
  );
});
test("origin and loaded text filters remain distinct from source queries", () => {
  const list = suppliers(
    [
      { layer: "awards", name: "HVAC Co", uei: "1", origin: "SAU" },
      { layer: "awards", name: "HVAC Co", uei: "2", origin: "USA" },
    ],
    countries,
    "SAU",
  );
  assert.equal(
    filterSuppliers(list, { query: "hvac", segment: "local" }).length,
    1,
  );
});
test("generic recipients are not represented as companies", () => {
  const rows = normalizeAwards(
    response([
      {
        "Award ID": "1",
        "Recipient Name": "MISCELLANEOUS FOREIGN AWARDEES",
        "Recipient UEI": "X",
      },
    ]),
    "awards",
    scope,
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(suppliers(rows, countries, "SAU").length, 0);
});
test("a search-country match is not rewritten as reported location", () => {
  const [r] = normalizeAwards(
    response([{ "Award ID": "1", "Recipient Name": "A" }]),
    "awards",
    scope,
  ).rows;
  assert.equal(r.performanceCountry, "");
  assert.equal(r.scope.country, "SAU");
});
test("worldwide geography removes the country restriction while preserving capability and buyer scope", () => {
  const b = geographyBody({ ...scope, q: "generator", agency: "dod" });
  assert.equal(b.filters.place_of_performance_locations, undefined);
  assert.deepEqual(b.filters.keywords, ["generator"]);
  assert.equal(b.geo_layer, "country");
  assert.equal(b.scope, "place_of_performance");
  assert.throws(() => geographyBody({ ...scope, agency: "civilian" }));
  assert.deepEqual(
    normalizeGeography({
      results: [{ shape_code: "SAU", aggregated_amount: 0 }],
    }),
    [{ country: "SAU", amount: 0 }],
  );
});
