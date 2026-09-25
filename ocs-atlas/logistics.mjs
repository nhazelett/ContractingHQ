import { esc } from "./core.mjs";
const $ = (id) => document.getElementById(id);
function portFunctions(value) {
  const names = {
    1: "Maritime port",
    2: "Rail",
    3: "Road",
    4: "Air / space transport",
    5: "International mail",
    6: "Multimodal facilities",
    7: "Fixed transport installation",
    8: "Inland water port",
  };
  return (
    [...(value || "")]
      .filter((c) => names[c])
      .map((c) => names[c])
      .join(", ") + ` (${value || "unknown"})`
  );
}
function portStatus(value) {
  const names = {
    AM: "Location code approved by maintenance team",
    RL: "Location name recognized; trade relevance not confirmed",
    RQ: "Code request under consideration",
    XX: "Entry marked for removal",
    AA: "Code approved by national government agency",
    AC: "Code approved by customs authority",
    AF: "Code approved by national facilitation body",
    AI: "Code adopted by international organization",
    AS: "Code approved by national standards body",
    AQ: "Code approved; functions unverified",
    RN: "Request from credible national source",
  };
  return `${value || "Not reported"} · ${names[value] || "Legacy or unspecified status; verify in the source directory"}. This is code status, not facility permission.`;
}
export function logisticsRows(
  data,
  { country = "", kind = "airfields", type = "airports", query = "" } = {},
) {
  const q = query.trim().toLowerCase();
  return (data?.rows || []).filter(
    (r) =>
      (!country || r.country === country) &&
      (kind !== "airfields" ||
        type === "all" ||
        (type === "airports"
          ? ["large_airport", "medium_airport", "small_airport"].includes(
              r.type,
            )
          : r.type === type)) &&
      (!q ||
        [r.id, r.name, r.city, r.iata, r.icao].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  );
}
export function featureCollection(rows) {
  return {
    type: "FeatureCollection",
    features: rows
      .filter(
        (r) =>
          Array.isArray(r.point) &&
          r.point.length === 2 &&
          r.point.every(Number.isFinite) &&
          Math.abs(r.point[0]) <= 180 &&
          Math.abs(r.point[1]) <= 90,
      )
      .map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: r.point },
        properties: { id: r.id },
      })),
  };
}
// Group nearby points in world-pixel cells before sending them to the map.
// Source coordinates remain untouched; grouped dots are explicitly count markers.
export function clusteredFeatures(rows, zoom) {
  const data = featureCollection(rows);
  if (zoom >= 8) return data;
  const size = 512 * 2 ** Math.floor(zoom),
    cells = new Map();
  for (const f of data.features) {
    const [lon, lat] = f.geometry.coordinates;
    const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
    const x = ((lon + 180) / 360) * size;
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
    const key = Math.floor(x / 36) + ":" + Math.floor(y / 36);
    const cell = cells.get(key) || { first: f, count: 0, lon: 0, lat: 0 };
    cell.count++;
    cell.lon += lon;
    cell.lat += lat;
    cells.set(key, cell);
  }
  return {
    type: "FeatureCollection",
    features: [...cells.values()].map((c) =>
      c.count === 1
        ? c.first
        : {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [c.lon / c.count, c.lat / c.count],
            },
            properties: {
              cluster: true,
              point_count: c.count,
              point_count_abbreviated:
                c.count >= 1000
                  ? (c.count / 1000).toFixed(1) + "k"
                  : String(c.count),
            },
          },
    ),
  };
}
export function initLogistics({ getCountry, getMap, exportFile, onExplore }) {
  const datasets = {},
    pending = {},
    errors = {};
  let map;
  function rows(kind) {
    return logisticsRows(datasets[kind], {
      kind,
      country:
        $("logisticsScope").value === "country" ? getCountry()?.iso2 : "",
      type: $("airfieldType").value,
      query: $("logisticsFilter").value,
    });
  }
  function details(kind, r) {
    const data = datasets[kind];
    const sourceURL =
      kind === "airfields"
        ? `https://ourairports.com/airports/${encodeURIComponent(r.id)}/`
        : `https://unlocode.unece.org/directory/locodes?country=${encodeURIComponent(r.country)}`;
    const fields =
      kind === "airfields"
        ? {
            "Directory type": r.type.replaceAll("_", " "),
            "IATA / ICAO":
              [r.iata, r.icao].filter(Boolean).join(" / ") || "Not reported",
            "Served municipality": r.city || "Not reported",
            "Scheduled airline service": r.scheduled || "Not reported",
            "Longest reported non-closed runway": r.runway
              ? `${r.runway.lengthFt.toLocaleString()} ft · ${r.runway.surface || "surface unknown"}`
              : "Not reported",
          }
        : {
            "UN/LOCODE": r.id,
            "Reported functions": portFunctions(r.functions),
            "Directory status": portStatus(r.status),
            "Source update (YYMM)": r.sourceDate || "Not reported",
            Remarks: r.remarks || "None reported",
          };
    $("logisticsDetail").innerHTML =
      `<h2>${esc(r.name)}</h2><p>${esc(r.id)} · ${esc(r.country)}</p><dl class="facts">${Object.entries(
        fields,
      )
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join(
          "",
        )}</dl><p class="muted small">${kind === "airfields" ? "Community directory. Runway length and scheduled service do not establish cargo handling, aircraft suitability, or permission to use the airfield." : "A port trade location may represent a town or port area, not a terminal. Coordinates have one-minute resolution; berth, depth, and cargo handling are not established."}</p><p class="muted small">${esc(data.source)} · ${esc(data.version)} · retrieved ${esc(data.retrievedAt.slice(0, 10))} · ${r.point ? "Reported coordinates" : "No coordinates; retained in directory"}</p><a href="${sourceURL}" target="_blank" rel="noopener">Review source entry ↗</a>`;
    if (r.point && onExplore) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Explore transport around this facility";
      button.onclick = () => {
        $("logisticsDialog").close();
        onExplore(r.point);
      };
      $("logisticsDetail").append(document.createElement("br"), button);
    }
    $("logisticsDialog").showModal();
  }
  function render() {
    const counts = [],
      listing = [];
    for (const kind of ["airfields", "ports"]) {
      const on = $(kind + "Toggle").checked;
      const selected = on ? rows(kind) : [];
      if (map?.getSource("logistics-" + kind)) {
        map
          .getSource("logistics-" + kind)
          .setData(clusteredFeatures(selected, map.getZoom()));
      }
      if (!on) continue;
      if (pending[kind]) counts.push(`Loading ${kind}…`);
      else if (errors[kind])
        counts.push(`${kind}: unavailable; toggle to retry`);
      else if (datasets[kind]) {
        const mapped = selected.filter((r) => r.point).length;
        counts.push(
          `${selected.length.toLocaleString()} ${kind} · ${mapped.toLocaleString()} mapped · ${(selected.length - mapped).toLocaleString()} missing coordinates`,
        );
        listing.push(...selected.map((r) => ({ kind, r })));
      }
    }
    $("logisticsStatus").textContent =
      counts.join(" | ") ||
      "Enable a directory to explore logistics locations.";
    $("logisticsList").innerHTML = listing
      .slice(0, 80)
      .map(
        ({ kind, r }, i) =>
          `<button class="logistics-result" data-logistics="${i}"><span>${kind === "airfields" ? "✈" : "⚓"} ${esc(r.name)}</span><small>${esc(r.id)} · ${esc(r.country)}${r.point ? "" : " · no coordinates"}</small></button>`,
      )
      .join("");
    $("logisticsListNote").textContent =
      listing.length > 80
        ? `Showing the first 80 of ${listing.length.toLocaleString()} matches. Narrow by name or code; export includes all matches.`
        : "";
    $("logisticsList")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const { kind, r } = listing[Number(b.dataset.logistics)];
            details(kind, r);
          }),
      );
    $("exportLogistics").disabled = !listing.length;
    $("logisticsAttribution").innerHTML = Object.entries(datasets)
      .map(
        ([kind, d]) =>
          `<a href="${esc(d.sourcePage)}" target="_blank" rel="noopener">${esc(d.source)}</a> · ${esc(d.license)} · ${esc(d.version)} · ${d.rows.length.toLocaleString()} global records · retrieved ${esc(d.retrievedAt.slice(0, 10))}`,
      )
      .join("<br>");
  }
  async function load(kind) {
    if (datasets[kind] || pending[kind]) return render();
    pending[kind] = true;
    delete errors[kind];
    render();
    try {
      const res = await fetch(`ocs-atlas/data/logistics/${kind}.json`);
      if (!res.ok) throw new Error("Source unavailable");
      const d = await res.json();
      if (d.schemaVersion !== 1 || !Array.isArray(d.rows))
        throw new Error("Invalid snapshot");
      datasets[kind] = d;
    } catch (e) {
      errors[kind] = e.message;
    } finally {
      pending[kind] = false;
      render();
    }
  }
  for (const kind of ["airfields", "ports"])
    $(kind + "Toggle").onchange = () =>
      $(kind + "Toggle").checked ? load(kind) : render();
  for (const id of ["logisticsScope", "airfieldType"]) $(id).onchange = render;
  $("logisticsFilter").oninput = render;
  $("logisticsBrowse").onclick = () => {
    $("logisticsDirectory").hidden = !$("logisticsDirectory").hidden;
  };
  $("fitLogistics").onclick = () => {
    if (!map) return;
    const points = ["airfields", "ports"].flatMap((k) =>
      $(k + "Toggle").checked
        ? rows(k)
            .filter((r) => r.point)
            .map((r) => r.point)
        : [],
    );
    if (!points.length) return;
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding: 60, maxZoom: 9 });
  };
  $("exportLogistics").onclick = () =>
    exportFile(
      "ocs-logistics.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          scope: $("logisticsScope").value,
          country: getCountry()?.iso2,
          type: $("airfieldType").value,
          query: $("logisticsFilter").value,
          sources: Object.fromEntries(
            ["airfields", "ports"]
              .filter((k) => $(k + "Toggle").checked && datasets[k])
              .map((k) => [
                k,
                {
                  ...datasets[k],
                  sourceRecordCount: datasets[k].rows.length,
                  sourceMappedCount: datasets[k].mapped,
                  mapped: rows(k).filter((r) => r.point).length,
                  rows: rows(k),
                },
              ]),
          ),
        },
        null,
        2,
      ),
      "application/json",
    );
  return {
    render,
    capture() {
      return ["airfields", "ports"]
        .filter((k) => $(k + "Toggle").checked && datasets[k])
        .map((k) => {
          const d = datasets[k],
            selected = rows(k);
          return {
            kind: k,
            source: d.source,
            sourcePage: d.sourcePage,
            license: d.license,
            version: d.version,
            retrievedAt: d.retrievedAt,
            sha256: d.sha256,
            filters: {
              area: $("logisticsScope").value,
              country: getCountry()?.iso2,
              type: $("airfieldType").value,
              query: $("logisticsFilter").value,
            },
            totalMatches: selected.length,
            mappedMatches: selected.filter((r) => r.point).length,
            truncated: selected.length > 250,
            rows: structuredClone(selected.slice(0, 250)),
          };
        });
    },
    attachMap() {
      map = getMap();
      for (const [kind, color] of [
        ["airfields", "#145eaf"],
        ["ports", "#a04512"],
      ]) {
        const id = "logistics-" + kind;
        map.addSource(id, {
          type: "geojson",
          data: featureCollection([]),

          attribution:
            kind === "airfields"
              ? "OurAirports (public domain)"
              : "UNECE UN/LOCODE (CC BY 4.0)",
        });
        map.addLayer({
          id,
          type: "circle",
          source: id,
          paint: {
            "circle-radius": ["case", ["has", "point_count"], 13, 5],
            "circle-color": color,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#fff",
            "circle-opacity": 0.85,
          },
        });
        map.addLayer({
          id: id + "-counts",
          type: "symbol",
          source: id,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": map
              .getStyle()
              .layers.find(
                (l) =>
                  Array.isArray(l.layout?.["text-font"]) &&
                  typeof l.layout["text-font"][0] === "string",
              )?.layout["text-font"] || ["Noto Sans Regular"],
            "text-size": 11,
          },
          paint: { "text-color": "#fff" },
        });
        map.on("click", id, async (e) => {
          const f = e.features[0];
          if (f.properties.cluster) {
            map.easeTo({
              center: f.geometry.coordinates,
              zoom: Math.min(8, map.getZoom() + 2),
            });
            return;
          }
          const r = datasets[kind]?.rows.find((r) => r.id === f.properties.id);
          if (r) details(kind, r);
        });
        map.on("mouseenter", id, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", id, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      map.on("zoomend", render);
      render();
    },
  };
}
