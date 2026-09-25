import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  contractorFlows,
  endpoint,
  facilityReferences,
  connectionCoordinates,
} from "../ocs-atlas/flows.mjs";
import { suppliers } from "../ocs-atlas/core.mjs";
const countries = [
  { code: "USA", iso2: "US", name: "United States", latlng: [38, -97] },
  { code: "SAU", iso2: "SA", name: "Saudi Arabia", latlng: [25, 45] },
  { code: "GBR", iso2: "GB", name: "United Kingdom", latlng: [54, -2] },
];
const facilities = [
  {
    id: "TEST",
    name: "Example Air Base",
    country: "SA",
    point: [46, 24],
    type: "medium_airport",
  },
];
const row = {
  id: "1",
  layer: "awards",
  name: "Example contractor",
  uei: "EXAMPLE",
  origin: "USA",
  performanceCountry: "SAU",
  description: "Services at Example Air Base (EAB)",
  url: "https://www.usaspending.gov/award/example",
  identifier: "ORDER1",
};
test("flows require award work evidence and never infer country work from SAM or parent vehicles", () => {
  const list = [
    {
      key: "a",
      name: "Example",
      rows: [
        { ...row, layer: "sam" },
        { ...row, layer: "vehicles" },
        { ...row, id: "2", performanceCountry: "" },
      ],
    },
  ];
  const result = contractorFlows(list, countries, new Map(), facilities);
  assert.equal(result.groups.length, 0);
  assert.equal(result.missing, 1);
});
test("country-only endpoints stay explicitly coarse and connections keep row-level address identity", () => {
  const records = [
    row,
    { ...row, id: "2", origin: "SAU" },
    { ...row, id: "3", origin: "GBR" },
  ];
  const result = contractorFlows(
    [{ key: "a", name: "Example", rows: records }],
    countries,
    new Map(),
    [],
  );
  assert.deepEqual(
    result.groups.map((g) => g.segment),
    ["us", "local", "third"],
  );
  assert.equal(result.groups[0].work.reference, "country:SAU");
  assert.match(result.groups[0].work.precision, /Country only/);
  assert.equal(endpoint({ country: "UNKNOWN" }, countries, null), null);
});
test("named facility and abbreviation matches require country and explicit expansion evidence", () => {
  const resolver = facilityReferences([row], facilities, countries);
  assert.equal(resolver(row).reference, "OurAirports:TEST");
  assert.equal(
    resolver({ ...row, description: "Support at EAB" }).proofIdentifier,
    "ORDER1",
  );
  assert.equal(
    facilityReferences(
      [],
      facilities,
      countries,
    )({ ...row, description: "Support at EAB" }),
    null,
  );
  assert.equal(resolver({ ...row, performanceCountry: "USA" }), null);
  const multi = [
    ...facilities,
    { ...facilities[0], id: "TWO", name: "Another Air Base" },
  ];
  assert.equal(
    facilityReferences(
      [row],
      multi,
      countries,
    )({ ...row, description: "Example Air Base and Another Air Base" }),
    null,
  );
  assert.equal(
    facilityReferences(
      [row, { ...row, description: "Another Air Base (EAB)" }],
      multi,
      countries,
    )({ ...row, description: "Services at EAB" }),
    null,
  );
});
test("city precision is preferred over country fallback and international lines wrap correctly", () => {
  const d = { cities: [["42", ["Jeddah"], 21.5, 39.2, []]], postal: [] };
  assert.equal(
    endpoint({ country: "SAU", city: "Jeddah" }, countries, d).reference,
    "geoname:42",
  );
  assert.deepEqual(connectionCoordinates([170, 10], [-170, 20]), [
    [170, 10],
    [190, 20],
  ]);
});
test("real dated AFCAP country snapshot produces KBR Houston to PSAB with five exact-parent orders", () => {
  const read = (path) =>
    JSON.parse(
      readFileSync(new URL("../ocs-atlas/data/" + path, import.meta.url)),
    );
  const cc = read("countries.json");
  const snapshot = read("program-orders-sau.json");
  const rows = snapshot.pages.flatMap((p) => p.rows);
  const us = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../ocs-atlas/data/places/US.json.gz", import.meta.url),
      ),
    ),
  );
  const result = contractorFlows(
    suppliers(rows, cc, "SAU"),
    cc,
    new Map([["USA", us]]),
    read("logistics/airfields.json").rows,
  );
  const kbr = result.groups.filter((g) => g.name === "KBR SERVICES, LLC");
  assert.equal(kbr.length, 1);
  assert.equal(kbr[0].rows.length, 5);
  assert.match(kbr[0].origin.label, /Houston/);
  assert.equal(kbr[0].work.reference, "OurAirports:OEPS");
  assert.equal(kbr[0].segment, "us");
  assert.ok(
    kbr[0].rows.every(
      (r) => r.parentAwardKey === "CONT_IDV_FA805120D0005_9700",
    ),
  );
  assert.ok(
    snapshot.pages.every((p) => p.page === 1 && !p.hasNext && !p.error),
  );
});
