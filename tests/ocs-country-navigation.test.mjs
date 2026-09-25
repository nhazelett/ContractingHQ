import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EVIDENCE_LAYERS,
  navigationCountry,
  missingCountryTargets,
  initCountryNavigation,
} from "../ocs-atlas/country-navigation.mjs";
const read = (p) =>
  JSON.parse(readFileSync(new URL("../ocs-atlas/data/" + p, import.meta.url)));
const countries = read("countries.json"),
  boundaries = read("country-boundaries.json"),
  codes = new Set(countries.map((c) => c.code));
test("evidence overlays take precedence over country areas and ocean clicks select nothing", () => {
  const country = {
    layer: { id: "atlas-countries" },
    properties: { code: "SAU" },
  };
  assert.equal(navigationCountry([country], codes), "SAU");
  for (const id of EVIDENCE_LAYERS)
    assert.equal(navigationCountry([country, { layer: { id } }], codes), null);
  assert.equal(navigationCountry([], codes), null);
  assert.equal(
    navigationCountry(
      [{ ...country, properties: { code: "not-a-country" } }],
      codes,
    ),
    null,
  );
});
test("every dropdown entry has a polygon or a separate labeled reference target", () => {
  const targets = missingCountryTargets(countries, boundaries.features);
  const reachable = new Set(
    [...boundaries.features, ...targets].map((f) => f.properties.code),
  );
  assert.deepEqual([...reachable].sort(), [...codes].sort());
  assert.ok(
    boundaries.features.every((f) =>
      ["Polygon", "MultiPolygon"].includes(f.geometry.type),
    ),
  );
  assert.ok(
    targets.every(
      (f) => f.properties.name && f.geometry.coordinates.every(Number.isFinite),
    ),
  );
  assert.equal(boundaries.license, "Public domain");
});
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function inPolygon(p, rings) {
  return inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r));
}
const at = (p) =>
  boundaries.features
    .filter((f) =>
      (f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates
      ).some((r) => inPolygon(p, r)),
    )
    .map((f) => f.properties.code);
test("real country shapes select mainland and overseas territories without nearest-centroid guessing", () => {
  assert.deepEqual(at([46.7, 24.7]), ["SAU"]);
  assert.deepEqual(at([-95.37, 29.76]), ["USA"]);
  assert.deepEqual(at([2.35, 48.86]), ["FRA"]);
  assert.deepEqual(at([-53, 4]), ["GUF"]);
  assert.deepEqual(at([21.16, 42.66]), ["UNK"]);
  assert.deepEqual(at([-30, 0]), []);
});
test("boundary failure retains dropdown guidance without installing broken map handlers", async () => {
  let status = "";
  const nav = initCountryNavigation({
    map: {},
    countries,
    request: async () => {
      throw new Error("Offline");
    },
    getSelected: () => "SAU",
    onSelect: () => assert.fail(),
    onStatus: (s) => (status = s),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(status, /dropdown/);
  assert.doesNotThrow(() => nav.sync());
});
