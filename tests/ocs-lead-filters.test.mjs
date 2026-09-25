import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilityEvidence,
  distanceKm,
  radiusPolygon,
  filterLeads,
  locationEvidence,
  leadEvidenceHTML,
  leadSelectionText,
  initLeadFilters,
} from "../ocs-atlas/lead-filters.mjs";
import { csv } from "../ocs-atlas/core.mjs";
const center = {
  coordinates: [39.2, 21.5],
  label: "Jeddah",
  precision: "City center (approximate)",
};
const row = (id, extra = {}) => ({
  id,
  layer: "sam",
  naics: "721110;238210",
  psc: "V231;Y1AA",
  origin: "SAU",
  city: "Jeddah",
  url: "https://sam.gov/search/",
  ...extra,
});
const company = (...rows) => ({ key: rows[0].id, rows });
const point = { ...center, reference: "geoname:1" };

test("code matching uses complete tokens and distinguishes declarations from awards", () => {
  const evidence = capabilityEvidence(row("a"), "lodging");
  assert.deepEqual(
    evidence.map((e) => e.system + " " + e.code),
    ["NAICS 721110", "PSC V231"],
  );
  assert.equal(evidence[0].basis, "Declared in SAM");
  assert.equal(
    capabilityEvidence(row("a", { layer: "awards" }), "lodging")[0].basis,
    "Reported award code",
  );
  assert.equal(
    capabilityEvidence(
      row("a", {
        naics: "1721110;7211;foo721110",
        psc: "XV231;V231X",
        description: "hotel",
      }),
      "lodging",
    ).length,
    0,
  );
  assert.equal(
    capabilityEvidence(row("a", { layer: "exclusions" }), "lodging").length,
    0,
  );
  assert.equal(
    capabilityEvidence(
      row("a", { naics: "", primaryNaics: "721110", psc: "" }),
      "lodging",
    ).length,
    1,
  );
});

test("distance handles datelines, rejects invalid coordinates, and draws a closed radius", () => {
  assert.equal(distanceKm([0, 0], [0, 0]), 0);
  assert.ok(Math.abs(distanceKm([0, 0], [1, 0]) - 111.195) < 0.001);
  assert.ok(distanceKm([179.9, 0], [-179.9, 0]) < 23);
  assert.equal(distanceKm([0, 91], [0, 0]), null);
  const polygon = radiusPolygon(center.coordinates, 50);
  const ring = polygon.geometry.coordinates[0];
  assert.deepEqual(ring[0], ring.at(-1));
  for (const p of ring)
    assert.ok(Math.abs(distanceKm(center.coordinates, p) - 50) < 0.001);
});

test("radius excludes country-only, missing and distant locations and never turns a SAM address into award work", () => {
  const rows = [row("near"), row("far"), row("country"), row("missing")];
  const points = {
    near: point,
    far: { ...point, coordinates: [46.7, 24.7] },
    country: { ...point, reference: "country:SAU" },
  };
  const getPoint = (r) => points[r.id];
  const result = filterLeads(
    rows.map((r) => company(r)),
    { center, radiusKm: 50, role: "vendor", capability: "lodging" },
    getPoint,
  );
  assert.deepEqual(
    result.matches.map((c) => c.key),
    ["near"],
  );
  assert.equal(result.unlocated, 2);
  assert.equal(result.outside, 1);
  assert.equal(locationEvidence(rows[0], "work", center, getPoint), null);
  assert.ok(
    locationEvidence({ ...rows[0], layer: "awards" }, "work", center, getPoint),
  );
});

test("combined company filters preserve separate evidence and export the applied criteria", () => {
  const a = row("capability", { city: "Riyadh" }),
    b = row("near", { naics: "", psc: "" });
  const selection = {
    capability: "lodging",
    role: "vendor",
    center,
    radiusKm: 50,
  };
  const result = filterLeads([company(a, b)], selection, (r) =>
    r.id === "near" ? point : null,
  );
  assert.equal(result.matches.length, 1);
  const html = leadEvidenceHTML(result.matches[0]);
  assert.match(html, /different records/);
  assert.match(html, /NAICS 721110/);
  assert.match(leadSelectionText(selection), /50 km of Jeddah/);
  const out = csv([
    {
      ...a,
      leadFilter: selection,
      capabilityMatches: capabilityEvidence(a, "lodging"),
      radiusMatch: null,
    },
  ]);
  assert.match(out, /leadFilter/);
  assert.match(out, /Jeddah/);
  assert.match(out, /Declared in SAM/);
});

test("matching evidence escapes names and blocks unsafe source links", () => {
  const s = filterLeads(
    [company(row("x", { url: "javascript:alert(1)" }))],
    { capability: "lodging", center, radiusKm: 50, role: "vendor" },
    () => ({ ...point, label: '<img src=x onerror="bad">' }),
  ).matches[0];
  const html = leadEvidenceHTML(s);
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img/);
});

test("changing country during an asynchronous lookup cannot apply an old center", async (t) => {
  const original = globalThis.document,
    nodes = new Map();
  const el = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: "", textContent: "" });
    return nodes.get(id);
  };
  globalThis.document = { getElementById: el };
  t.after(() => {
    globalThis.document = original;
  });
  let country = "SAU",
    finish,
    changes = 0;
  const client = initLeadFilters({
    getCountry: () => country,
    getRows: () => [],
    normalizeCountry: (c) => c,
    loadPlaces: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    onChange: () => changes++,
    focus: () => {},
  });
  el("leadPlace").value = "Jeddah";
  const pending = el("leadLocate").onclick();
  country = "DEU";
  finish({ cities: [[1, ["Jeddah"], 21.5, 39.2, []]], postal: [] });
  await pending;
  assert.equal(client.selection().center, null);
  assert.equal(changes, 0);
});
