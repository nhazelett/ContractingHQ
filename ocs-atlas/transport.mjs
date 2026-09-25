import { esc } from "./core.mjs";
import {
  TRANSPORT_API,
  TRANSPORT_KINDS,
  transportBounds,
  transportQuery,
  normalizeTransport,
  transportFeatures,
  transportLabels,
} from "./transport-core.mjs";
const $ = (id) => document.getElementById(id);
export function initTransport({ getMap, getCountry, exportFile }) {
  let map,
    snapshot = null,
    busy = false,
    request = null,
    generation = 0,
    retryAfter = 0,
    message = "Zoom into a city or port, then load the map area.";
  const cache = new Map();
  const selected = () =>
    TRANSPORT_KINDS.filter((k) => $("transport-" + k).checked);
  function render() {
    $("transportStatus").textContent = message;
    $("loadTransport").disabled = busy || !map;
    $("exportTransport").disabled = !snapshot;
    if (!map) return;
    map
      .getSource("transport-data")
      .setData(transportFeatures(snapshot, selected()));
    const [s, w, n, e] = snapshot?.bbox || [];
    map.getSource("transport-bounds").setData({
      type: "FeatureCollection",
      features:
        snapshot && selected().length
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [w, s],
                      [e, s],
                      [e, n],
                      [w, n],
                      [w, s],
                    ],
                  ],
                },
              },
            ]
          : [],
    });
  }
  function describe(prefix = "") {
    return `${prefix}${TRANSPORT_KINDS.map((k) => snapshot.rows.filter((r) => r.kind === k).length + " " + k).join(" · ")}. ${snapshot.truncated ? "Result limit reached; this is a partial extract. Zoom in and reload. " : "Selected query returned within the record limit; mapping gaps may remain. "}${snapshot.skipped ? snapshot.skipped + " unusable records skipped. " : ""}Source ${snapshot.sourceAsOf} · retrieved ${snapshot.retrievedAt.slice(0, 10)}. Loaded area is outlined; panning does not refresh it.`;
  }
  async function load() {
    if (!map || busy) return;
    let bbox;
    try {
      const b = map.getBounds();
      bbox = transportBounds([
        b.getSouth(),
        b.getWest(),
        b.getNorth(),
        b.getEast(),
      ]);
    } catch (e) {
      message = e.message;
      render();
      return;
    }
    const key = JSON.stringify(bbox),
      found = cache.get(key);
    if (!selected().length)
      TRANSPORT_KINDS.forEach((k) => ($("transport-" + k).checked = true));
    if (found) {
      snapshot = { ...found, researchCountry: getCountry()?.code };
      message = describe("Session cache · ");
      render();
      return;
    }
    if (Date.now() < retryAfter) {
      message =
        "Source rate limit: wait " +
        Math.ceil((retryAfter - Date.now()) / 1000) +
        " seconds before retrying.";
      render();
      return;
    }
    const token = ++generation;
    request = new AbortController();
    const ac = request;
    const timer = setTimeout(() => ac.abort(), 40000);
    busy = true;
    message =
      "Loading roads, rail and mapped border-control points for this area…";
    render();
    try {
      const res = await fetch(TRANSPORT_API, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: transportQuery(bbox) }),
        signal: ac.signal,
      });
      if ([429, 406].includes(res.status)) retryAfter = Date.now() + 30000;
      if (!res.ok) throw new Error("Source returned HTTP " + res.status + ".");
      const data = await res.json();
      if (token !== generation) return;
      snapshot = {
        ...normalizeTransport(data, bbox),
        researchCountry: getCountry()?.code,
      };
      cache.set(key, snapshot);
      if (cache.size > 3) cache.delete(cache.keys().next().value);
      message = describe();
    } catch (e) {
      if (token === generation)
        message =
          (snapshot ? "Previous outlined area retained. " : "") +
          "Transport source unavailable. " +
          (e.name === "AbortError" ? "Request timed out." : e.message) +
          " Retry a smaller area.";
    } finally {
      clearTimeout(timer);
      if (token === generation) {
        busy = false;
        render();
      }
    }
  }
  $("loadTransport").onclick = load;
  $("zoomTransport").onclick = () => map?.easeTo({ zoom: 11 });
  TRANSPORT_KINDS.forEach((k) => ($("transport-" + k).onchange = render));
  $("exportTransport").onclick = () =>
    exportFile(
      "ocs-transport.geojson",
      JSON.stringify(
        {
          type: "FeatureCollection",
          ...transportFeatures(snapshot, selected()),
          metadata: {
            ...snapshot,
            rows: undefined,
            selectedLayers: selected(),
          },
        },
        null,
        2,
      ),
      "application/geo+json",
    );
  return {
    capture: () =>
      snapshot
        ? { ...snapshot, selectedLayers: selected(), displayStatus: message }
        : null,
    clear() {
      generation++;
      request?.abort();
      busy = false;
      snapshot = null;
      message = "Zoom into a city or port, then load the map area.";
      render();
    },
    explore(point) {
      if (!map) return;
      TRANSPORT_KINDS.forEach((k) => ($("transport-" + k).checked = true));
      map.jumpTo({ center: point, zoom: 11 });
      load();
    },
    attachMap() {
      map = getMap();
      map.addSource("transport-data", {
        type: "geojson",
        data: transportFeatures(null),
        attribution: "© OpenStreetMap contributors (ODbL)",
      });
      map.addSource("transport-bounds", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      const before = "atlas-flow";
      map.addLayer(
        {
          id: "transport-roads",
          type: "line",
          source: "transport-data",
          filter: ["==", ["get", "kind"], "roads"],
          paint: {
            "line-color": "#bd7917",
            "line-width": 3,
            "line-opacity": 0.85,
          },
        },
        before,
      );
      map.addLayer(
        {
          id: "transport-rail",
          type: "line",
          source: "transport-data",
          filter: ["==", ["get", "kind"], "rail"],
          paint: {
            "line-color": "#752b8f",
            "line-width": 3,
            "line-dasharray": [2, 1],
          },
        },
        before,
      );
      map.addLayer({
        id: "transport-borders",
        type: "circle",
        source: "transport-data",
        filter: ["==", ["get", "kind"], "borders"],
        paint: {
          "circle-color": "#ba2454",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer(
        {
          id: "transport-outline",
          type: "line",
          source: "transport-bounds",
          paint: {
            "line-color": "#405666",
            "line-width": 1.5,
            "line-dasharray": [4, 3],
          },
        },
        before,
      );
      for (const id of [
        "transport-roads",
        "transport-rail",
        "transport-borders",
      ]) {
        map.on("click", id, (e) => {
          if (
            map.queryRenderedFeatures(e.point, {
              layers: [
                "logistics-airfields",
                "logistics-ports",
                "atlas-origins",
                "atlas-global",
              ],
            }).length
          )
            return;
          const top = map.queryRenderedFeatures(e.point, {
            layers: ["transport-borders", "transport-roads", "transport-rail"],
          })[0];
          if (top?.layer.id !== id) return;
          const r = snapshot?.rows.find(
            (r) => r.id === e.features[0].properties.id,
          );
          if (!r) return;
          const label = transportLabels(r);
          $("transportDetail").innerHTML =
            `<h2>${esc(label.title)}</h2><p>${esc(label.type)} · ${esc(r.id)}</p><p>Reported name: ${esc(label.name || "Not recorded by source")}<br>Route/reference: ${esc(label.reference || "Not recorded")}<br>Map class: ${esc(label.sourceClass || "Not recorded")}</p>${label.reference ? '<p class="muted small">Route/reference is the source’s identifier; it is not a speed limit or distance.</p>' : ""}<details><summary>Original source attributes</summary><dl class="facts">${Object.entries(
              r.tags,
            )
              .map(
                ([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`,
              )
              .join(
                "",
              )}</dl></details><p class="muted small">Mapped characteristics only. Current restrictions, road condition, freight suitability and border/customs availability require verification. Missing attributes mean unknown.</p><p class="muted small">Source ${esc(snapshot.sourceAsOf)} · retrieved ${esc(r.retrievedAt)}</p><a href="${esc(r.url)}" target="_blank" rel="noopener">Review OpenStreetMap feature ↗</a>`;
          $("transportDialog").showModal();
        });
        map.on(
          "mouseenter",
          id,
          () => (map.getCanvas().style.cursor = "pointer"),
        );
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      }
      render();
    },
  };
}
