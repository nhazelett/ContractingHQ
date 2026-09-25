export const TRANSPORT_API = "https://overpass-api.de/api/interpreter";
export const TRANSPORT_LIMIT = 1500;
export const TRANSPORT_KINDS = ["roads", "rail", "borders"];
export function transportLabels(row) {
  const tags = row.tags || {};
  const name = String(tags["name:en"] || tags.name || "").trim();
  const reference = String(tags.ref || "").trim();
  const type =
    {
      roads: "Road segment",
      rail: "Rail segment",
      borders: "Border-control point",
    }[row.kind] || "Mapped feature";
  const sourceClass = String(
    tags.highway || tags.railway || tags.barrier || "",
  ).replaceAll("_", " ");
  const title =
    name ||
    (reference
      ? (row.kind === "roads" ? "Route " : "Reference ") + reference
      : type + " — name not recorded");
  return { title, name, reference, type, sourceClass };
}
export function groupTransportSegments(rows) {
  const groups = new Map();
  for (const row of rows.filter((r) => r.kind !== "borders")) {
    const labels = transportLabels(row);
    // Shared labels summarize source segments; they do not establish a continuous route.
    const key = JSON.stringify([
      row.kind,
      labels.name,
      labels.reference,
      labels.sourceClass,
    ]);
    if (!groups.has(key)) groups.set(key, { ...labels, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}
export function transportBounds(values) {
  if (
    !Array.isArray(values) ||
    values.length !== 4 ||
    !values.every(Number.isFinite)
  )
    throw new Error("Map bounds unavailable.");
  const [s, w, n, e] = values;
  if (
    s >= n ||
    w >= e ||
    s < -85 ||
    n > 85 ||
    w < -180 ||
    e > 180 ||
    n - s > 2 ||
    e - w > 2
  )
    throw new Error(
      "Zoom in to an area no more than 2° wide and high. Move away from the date line if needed.",
    );
  const rounded = values.map((v) => Number(v.toFixed(5)));
  if (rounded[0] >= rounded[2] || rounded[1] >= rounded[3])
    throw new Error("Map area is too small. Zoom out slightly.");
  return rounded;
}
export function transportQuery(values) {
  const box = transportBounds(values).join(",");
  return `[out:json][timeout:25][maxsize:33554432];(way["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"](${box});way["railway"~"^(rail|narrow_gauge)$"](${box});node["barrier"="border_control"](${box}););out geom ${TRANSPORT_LIMIT + 1};`;
}
export function normalizeTransport(
  data,
  bbox,
  retrievedAt = new Date().toISOString(),
) {
  if (
    !Array.isArray(data?.elements) ||
    data.remark ||
    !data.osm3s?.timestamp_osm_base
  )
    throw new Error(
      "The map source returned incomplete or unexpected data. Retry a smaller area.",
    );
  const validPoint = (p) =>
    p &&
    Number.isFinite(p.lon) &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lon) <= 180 &&
    Math.abs(p.lat) <= 90;
  const seen = new Set(),
    rows = [];
  let skipped = 0;
  for (const e of data.elements.slice(0, TRANSPORT_LIMIT)) {
    const tags = e.tags || {},
      id = e.type + "/" + e.id;
    if (
      !["node", "way"].includes(e.type) ||
      !Number.isSafeInteger(e.id) ||
      e.id <= 0 ||
      seen.has(id)
    ) {
      skipped++;
      continue;
    }
    seen.add(id);
    const kind =
      e.type === "node" && tags.barrier === "border_control"
        ? "borders"
        : e.type === "way" && /^(rail|narrow_gauge)$/.test(tags.railway)
          ? "rail"
          : e.type === "way" &&
              /^(motorway|trunk|primary|secondary)(_link)?$/.test(tags.highway)
            ? "roads"
            : "";
    if (
      !kind ||
      (kind === "borders"
        ? !validPoint(e)
        : !Array.isArray(e.geometry) ||
          e.geometry.length < 2 ||
          !e.geometry.every(validPoint))
    ) {
      skipped++;
      continue;
    }
    rows.push({
      id,
      kind,
      name: String(
        tags["name:en"] ||
          tags.name ||
          tags.ref ||
          (kind === "borders" ? "Mapped border control" : "Unnamed " + kind),
      ).slice(0, 400),
      geometry:
        kind === "borders"
          ? { type: "Point", coordinates: [e.lon, e.lat] }
          : {
              type: "LineString",
              coordinates: e.geometry.map((p) => [p.lon, p.lat]),
            },
      tags: Object.fromEntries(
        [
          "name",
          "name:en",
          "ref",
          "highway",
          "railway",
          "barrier",
          "access",
          "hgv",
          "maxweight",
          "maxheight",
          "surface",
          "bridge",
          "tunnel",
          "operator",
          "opening_hours",
          "gauge",
          "electrified",
        ]
          .filter((k) => tags[k] !== undefined)
          .map((k) => [k, String(tags[k]).slice(0, 1000)]),
      ),
      url: "https://www.openstreetmap.org/" + id,
      source: "OpenStreetMap contributors",
      retrievedAt,
    });
  }
  rows.forEach((row) => {
    row.name = transportLabels(row).title;
  });
  return {
    schemaVersion: 1,
    source: "OpenStreetMap contributors",
    license: "ODbL 1.0",
    sourceURL: "https://www.openstreetmap.org/copyright",
    endpoint: TRANSPORT_API,
    bbox: transportBounds(bbox),
    query: transportQuery(bbox),
    retrievedAt,
    sourceAsOf: data.osm3s.timestamp_osm_base,
    truncated: data.elements.length > TRANSPORT_LIMIT,
    skipped,
    rows,
  };
}
export function transportFeatures(snapshot, kinds = TRANSPORT_KINDS) {
  return {
    type: "FeatureCollection",
    features: (snapshot?.rows || [])
      .filter((r) => kinds.includes(r.kind))
      .map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          ...r.tags,
          id: r.id,
          kind: r.kind,
          name: r.name,
          url: r.url,
          source: r.source,
          retrievedAt: r.retrievedAt,
        },
      })),
  };
}
