import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, capabilityScope } from "../ocs-atlas/capabilities.mjs";
import {
  transportBounds,
  transportQuery,
  normalizeTransport,
  transportFeatures,
  TRANSPORT_LIMIT,
  transportLabels,
  groupTransportSegments,
} from "../ocs-atlas/transport-core.mjs";
import {
  captureSearch,
  packetHTML,
  transportReport,
} from "../ocs-atlas/packet.mjs";
const scope = {
  country: "SAU",
  from: "2023-09-24",
  to: "2026-09-24",
  agency: "dod",
  q: "old",
  naics: "23",
  psc: "1234",
};
const bbox = [21.4, 39.08, 21.42, 39.1];
const geometry = [
  { lon: 39.09, lat: 21.41 },
  { lon: 39.095, lat: 21.415 },
];
const response = (elements) => ({
  osm3s: { timestamp_osm_base: "2026-09-24T00:00:00Z" },
  elements,
});
const road = (id) => ({
  type: "way",
  id,
  tags: { highway: "primary" },
  geometry,
});
const evidence = {
  id: "award:1",
  name: "Research supplier",
  uei: "ABC123DEF456",
  layer: "awards",
  scope: { ...scope },
  description: "Public award",
  url: "https://www.usaspending.gov/award/example",
  retrievedAt: "2026-09-24T00:00:00Z",
};
const input = () => ({
  scope: { ...scope },
  coverage: {
    awards: { status: "ready", loaded: 1, hasMore: true },
    subawards: {
      status: "error",
      loaded: 0,
      hasMore: null,
      error: "Source unavailable",
    },
  },
  rows: [structuredClone(evidence)],
  filters: { text: "", layers: ["awards", "subawards"] },
  capability: "Power & generators",
});
test("all capability recipes preserve country/date/buyer scope and separate keyword from industry filters", () => {
  for (const p of CAPABILITIES)
    for (const [mode, values] of [
      ["keyword", p.terms],
      ["naics", p.industries.map((v) => v[0])],
    ])
      for (const v of values) {
        const s = capabilityScope(scope, p.id, mode, v);
        assert.equal(s.country, scope.country);
        assert.equal(s.from, scope.from);
        assert.equal(s.to, scope.to);
        assert.equal(s.agency, "dod");
        assert.equal(s.psc, "");
        assert.equal(s.q, mode === "keyword" ? v : "");
        assert.equal(s.naics, mode === "naics" ? v : "");
      }
  assert.throws(() => capabilityScope(scope, "power", "keyword", "unlisted"));
  assert.equal(scope.q, "old");
});
test("transport queries enforce bounded local areas and request only specified public feature types", () => {
  for (const b of [
    [0, 0, 3, 1],
    [0, 179, 1, -179],
    [0, 0, 0, 1],
    [0, 0, 1, 181],
    [NaN, 0, 1, 1],
    [0, 0, 0.0000001, 0.0000001],
  ])
    assert.throws(() => transportBounds(b));
  const q = transportQuery(bbox);
  assert.match(q, /node\["barrier"="border_control"\]/);
  assert.match(q, /out geom 1501/);
  assert.match(q, /narrow_gauge/);
  assert.doesNotMatch(q, /relation|military/);
});
test("transport normalization preserves lineage and rejects partial, malformed or unusable source features", () => {
  assert.throws(() =>
    normalizeTransport({ ...response([]), remark: "timed out" }, bbox),
  );
  assert.throws(() => normalizeTransport({ elements: [] }, bbox));
  const t = normalizeTransport(
    response([
      road(1),
      road(1),
      {
        ...road(2),
        geometry: [geometry[0], { lon: 181, lat: 0 }, geometry[1]],
      },
      {
        type: "node",
        id: 3,
        tags: { barrier: "border_control", access: "private" },
        lat: 21.41,
        lon: 39.09,
      },
      { ...road(4), tags: { railway: "rail" } },
      { ...road(5), tags: { highway: "residential" } },
    ]),
    bbox,
    "2026-09-24T01:00:00Z",
  );
  assert.deepEqual(
    t.rows.map((r) => r.kind),
    ["roads", "borders", "rail"],
  );
  assert.equal(t.skipped, 3);
  assert.equal(t.rows[1].tags.access, "private");
  assert.equal(t.rows[0].url, "https://www.openstreetmap.org/way/1");
  assert.equal(t.retrievedAt, "2026-09-24T01:00:00Z");
  assert.equal(t.license, "ODbL 1.0");
  assert.equal(
    transportFeatures(t, ["borders"]).features[0].geometry.type,
    "Point",
  );
  assert.equal(transportFeatures(t, []).features.length, 0);
  assert.equal(
    transportFeatures(t, ["borders"]).features[0].properties.access,
    "private",
  );
  assert.equal(
    transportFeatures(t, ["borders"]).features[0].properties.url,
    "https://www.openstreetmap.org/node/3",
  );
  assert.equal(normalizeTransport(response([]), bbox).truncated, false);
});
test("transport output marks the result cap rather than implying a complete inventory", () => {
  const t = normalizeTransport(
    response(
      Array.from({ length: TRANSPORT_LIMIT + 1 }, (_, i) => road(i + 1)),
    ),
    bbox,
  );
  assert.equal(t.rows.length, 1500);
  assert.equal(t.truncated, true);
});
test("captured searches freeze evidence, gaps and view filters and block unfinished sources", () => {
  const i = input(),
    s = captureSearch(i);
  i.scope.country = "USA";
  i.rows[0].description = "changed";
  i.coverage.awards.loaded = 500;
  i.filters.layers.push("sam");
  assert.equal(s.scope.country, "SAU");
  assert.equal(s.rows[0].description, "Public award");
  assert.equal(s.coverage.awards.loaded, 1);
  assert.equal(s.coverage.subawards.status, "error");
  assert.deepEqual(s.filters.layers, ["awards", "subawards"]);
  assert.throws(() =>
    captureSearch({ ...input(), coverage: { awards: { status: "loading" } } }),
  );
  assert.throws(() =>
    captureSearch({
      ...input(),
      coverage: { sam: { status: "not connected" } },
    }),
  );
});
test("packet capture explicitly marks its evidence cap and deduplicates before counting", () => {
  const rows = Array.from({ length: 2001 }, (_, i) => ({
    ...evidence,
    id: String(i),
  }));
  const s = captureSearch({ ...input(), rows: [...rows, rows[0]] });
  assert.equal(s.rows.length, 2000);
  assert.equal(s.matchingRecords, 2001);
  assert.equal(s.truncated, true);
});
test("standalone packet escapes source content and retains provenance, incomplete coverage and visible print evidence", () => {
  const i = input();
  i.rows[0].name = "<script>alert(1)</script>";
  i.rows[0].url = "javascript:alert(1)";
  const html = packetHTML({
    searches: [captureSearch(i)],
    countryNames: { SAU: "Saudi Arabia" },
    shortlist: [],
    logistics: [],
    transport: null,
    exportedAt: "2026-09-24",
  });
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Source unavailable/);
  assert.match(html, /2026-09-24T00:00:00Z/);
  assert.match(html, /<details open>/);
  assert.match(html, /Saudi Arabia/);
  assert.match(html, /Unknown/);
  assert.match(html, /No transport extract included/);
});

test("road references remain distinct from names and unnamed segments keep explicit source gaps", () => {
  const r = {
    kind: "roads",
    name: "60",
    tags: { ref: "60", highway: "trunk" },
  };
  assert.equal(transportLabels(r).title, "Route 60");
  assert.equal(transportLabels(r).name, "");
  assert.equal(
    transportLabels({ ...r, tags: { highway: "trunk_link" } }).title,
    "Road segment — name not recorded",
  );
  assert.equal(
    transportLabels({ ...r, tags: { name: "Local road", ref: "60" } }).name,
    "Local road",
  );
  const rows = [
    { ...r, id: "way/1" },
    { ...r, id: "way/2" },
    { ...r, id: "way/3", tags: { ref: "60", highway: "primary" } },
    { kind: "borders", id: "node/4", tags: { barrier: "border_control" } },
  ];
  const groups = groupTransportSegments(rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].rows.map((r) => r.id),
    ["way/1", "way/2"],
  );
  assert.equal(rows.length, 4);
});
test("transport packet explains route identifiers and preserves checkpoint records separately from grouped segments", () => {
  const t = normalizeTransport(
    response([
      { ...road(1), tags: { ref: "60", highway: "trunk" } },
      { ...road(2), tags: { ref: "60", highway: "trunk" } },
      {
        type: "node",
        id: 3,
        tags: { barrier: "border_control", name: "Border <point>" },
        lat: 21.41,
        lon: 39.09,
      },
    ]),
    bbox,
  );
  t.selectedLayers = ["roads", "borders"];
  t.researchCountry = "SAU";
  t.displayStatus = "Source extract";
  const html = transportReport(t);
  assert.match(html, /Route 60/);
  assert.match(html, /not a speed limit/);
  assert.match(html, /2 segments/);
  assert.match(html, /Border-control points · 1/);
  assert.match(html, /Border &lt;point&gt;/);
  assert.match(html, /21.41° latitude/);
  assert.match(html, /way\/1/);
  assert.match(html, /way\/2/);
  assert.match(html, /node\/3/);
  assert.match(html, /Name not recorded by source/);
  assert.equal(t.rows[0].name, "Route 60");
});
