import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolvePlace, recordAddress } from "../ocs-atlas/places.mjs";
import { normalizeAwards, defaults } from "../ocs-atlas/core.mjs";
const data = {
  cities: [
    ["1", ["Springfield"], 10, 20, ["AA"]],
    ["2", ["Springfield"], 30, 40, ["BB"]],
    ["3", ["Jeddah", "Jiddah"], 21.5, 39.2, ["02", "Makkah"]],
  ],
  postal: [
    ["12345", "Springfield", 10, 20, ["AA"], "4"],
    ["99999", "Springfield", 10, 20, ["AA"], "4"],
    ["99999", "Springfield", 11, 21, ["AA"], "4"],
  ],
};
test("ambiguous city names need region evidence; unknown locations never use country centroids", () => {
  assert.equal(resolvePlace({ city: "Springfield" }, data), null);
  assert.deepEqual(
    resolvePlace({ city: "Springfield", region: "BB" }, data).coordinates,
    [40, 30],
  );
  assert.equal(resolvePlace({ country: "SAU" }, data), null);
  assert.equal(resolvePlace({ city: "Jeddah", region: "AA" }, data), null);
  assert.equal(resolvePlace({ city: "Jeddha" }, data), null);
});
test("postal points require unique coordinates and compatible city; no false precision from an ambiguous code", () => {
  assert.match(
    resolvePlace({ postal: "12345", city: "Springfield", region: "AA" }, data)
      .precision,
    /Postal/,
  );
  assert.equal(
    resolvePlace({ postal: "12345", city: "Jeddah" }, data).reference,
    "geoname:3",
  );
  assert.equal(resolvePlace({ postal: "99999" }, data), null);
  assert.match(
    resolvePlace({ postal: "99999", city: "Springfield", region: "AA" }, data)
      .precision,
    /City/,
  );
  assert.equal(
    resolvePlace(
      { city: "Invalid" },
      { cities: [["0", ["Invalid"], null, 200, []]], postal: [] },
    ),
    null,
  );
});
test("recipient city and postal fields remain independent from reported work fields", () => {
  const row = normalizeAwards(
    {
      results: [
        {
          "Award ID": "test",
          "Recipient Name": "Example",
          "Recipient Location": {
            location_country_code: "USA",
            city_name: "Springfield",
            state_code: "AA",
            zip5: "12345",
          },
          "Primary Place of Performance": {
            location_country_code: "SAU",
            city_name: "Jeddah",
            foreign_postal_code: "55555",
          },
        },
      ],
      page_metadata: { hasNext: false },
    },
    "awards",
    defaults(),
  ).rows[0];
  assert.deepEqual(recordAddress(row, "vendor"), {
    country: "USA",
    city: "Springfield",
    region: "AA",
    postal: "12345",
  });
  assert.equal(recordAddress(row, "work").city, "Jeddah");
  assert.equal(recordAddress(row, "work").postal, "55555");
  assert.equal(
    recordAddress({ origin: "USA", city: "Springfield" }, "work").city,
    undefined,
  );
});
test("bundled Saudi reference locates Jeddah and explicitly has no postal coverage", () => {
  const sa = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../ocs-atlas/data/places/SA.json.gz", import.meta.url),
      ),
    ),
  );
  const p = resolvePlace({ city: "Jeddah" }, sa);
  assert.ok(
    p &&
      p.coordinates[0] > 39 &&
      p.coordinates[0] < 40 &&
      p.coordinates[1] > 21 &&
      p.coordinates[1] < 22,
  );
  assert.equal(resolvePlace({ city: "JIDDAH" }, sa).reference, p.reference);
  assert.equal(sa.postal.length, 0);
});
