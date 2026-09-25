import { esc, safeURL } from "./core.mjs";
import { resolvePlace, recordAddress } from "./places.mjs";
import { NAICS_SOURCE } from "./capabilities.mjs";
export const PSC_SOURCE =
  "https://www.acquisition.gov/sites/default/files/manual/PSC%20Manual%20April%202024.pdf";
// Broad research categories, not solicitation classifications or certifications.
export const LEAD_CAPABILITIES = [
  { id: "construction", name: "Construction", naics: ["23"], psc: ["Y"] },
  { id: "lodging", name: "Lodging", naics: ["721"], psc: ["V231"] },
  {
    id: "transport",
    name: "Transportation",
    naics: ["481", "482", "483", "484", "485", "488", "492"],
    psc: ["V0", "V1", "V21", "V22"],
  },
  {
    id: "fuel",
    name: "Fuel & lubricants",
    naics: ["324110", "324191", "424710", "424720"],
    psc: ["9130", "9140", "9150", "S204"],
  },
  { id: "rental", name: "Equipment rental", naics: ["5324"], psc: ["W"] },
  {
    id: "food",
    name: "Food & catering",
    naics: ["7223", "7225"],
    psc: ["S203"],
  },
  {
    id: "maintenance",
    name: "Maintenance & repair",
    naics: ["811"],
    psc: ["J", "Z"],
  },
];
const codes = (value, pattern) => [
  ...new Set(
    String(value || "")
      .toUpperCase()
      .split(/[;,\s]+/)
      .filter((v) => pattern.test(v)),
  ),
];
export function capabilityEvidence(row, id) {
  const category = LEAD_CAPABILITIES.find((c) => c.id === id);
  if (
    !category ||
    !["sam", "awards", "subawards", "vehicles"].includes(row.layer)
  )
    return [];
  const evidence = [];
  for (const [system, field, pattern] of [
    ["NAICS", "naics", /^\d{6}$/],
    ["PSC", "psc", /^[A-Z0-9]{4}$/],
  ]) {
    const values = codes(
      field === "naics"
        ? [row.naics, row.primaryNaics].filter(Boolean).join(";")
        : row[field],
      pattern,
    );
    for (const code of values)
      if (category[field].some((prefix) => code.startsWith(prefix))) {
        evidence.push({
          system,
          code,
          basis:
            row.layer === "sam"
              ? "Declared in SAM"
              : row.layer === "vehicles"
                ? "Contract vehicle code"
                : "Reported award code",
          recordId: row.id,
          url: safeURL(row.url),
          source: row.source,
          retrievedAt: row.retrievedAt,
        });
      }
  }
  return evidence;
}
export function distanceKm(a, b) {
  if (
    ![a, b].every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(Number.isFinite) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90,
    )
  )
    return null;
  const rad = Math.PI / 180,
    dlat = (b[1] - a[1]) * rad,
    dlon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function radiusPolygon(center, km) {
  if (distanceKm(center, center) === null || !(km > 0 && km <= 1000))
    return null;
  const rad = Math.PI / 180,
    lat = center[1] * rad,
    lon = center[0] * rad,
    angular = km / 6371.0088;
  const ring = Array.from({ length: 65 }, (_, i) => {
    const bearing = ((i % 64) * Math.PI) / 32;
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(angular) +
        Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const lon2 =
      lon +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(lat2),
      );
    return [lon2 / rad, lat2 / rad];
  });
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
export function locationEvidence(row, role, center, pointFor) {
  if (role === "work" && !["awards", "subawards"].includes(row.layer))
    return null;
  const point = pointFor(row, role);
  if (!point || String(point.reference || "").startsWith("country:"))
    return null;
  const km = distanceKm(center.coordinates, point.coordinates);
  return km === null
    ? null
    : {
        ...point,
        km,
        role,
        recordId: row.id,
        url: safeURL(row.url),
        retrievedAt: row.retrievedAt,
      };
}
export function filterLeads(list, selection, pointFor = () => null) {
  let unlocated = 0,
    outside = 0,
    capabilityExcluded = 0;
  const matches = [];
  for (const supplier of list) {
    const capability = supplier.rows.flatMap((r) =>
      capabilityEvidence(r, selection.capability),
    );
    if (selection.capability && !capability.length) {
      capabilityExcluded++;
      continue;
    }
    let locations = [];
    if (selection.center && selection.radiusKm) {
      locations = supplier.rows
        .map((r) =>
          locationEvidence(r, selection.role, selection.center, pointFor),
        )
        .filter(Boolean)
        .sort((a, b) => a.km - b.km);
      if (!locations.length) {
        unlocated++;
        continue;
      }
      locations = locations.filter((p) => p.km <= selection.radiusKm);
      if (!locations.length) {
        outside++;
        continue;
      }
    }
    matches.push({ ...supplier, leadEvidence: { capability, locations } });
  }
  if (selection.center && selection.radiusKm)
    matches.sort(
      (a, b) => a.leadEvidence.locations[0].km - b.leadEvidence.locations[0].km,
    );
  return { matches, unlocated, outside, capabilityExcluded };
}
export function leadEvidenceHTML(supplier) {
  const evidence = supplier.leadEvidence;
  if (!evidence || (!evidence.capability.length && !evidence.locations.length))
    return "";
  const sourceLink = (url, label) =>
    safeURL(url)
      ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener">${esc(label)} ↗</a>`
      : esc(label);
  const entries = [
    ...new Map(
      evidence.capability.map((e) => [e.basis + e.system + e.code, e]),
    ).values(),
  ];
  const nearest = evidence.locations[0];
  return `<div class="lead-match"><strong>Why this company matched</strong>${
    entries.length
      ? `<p>${entries
          .slice(0, 4)
          .map(
            (e) =>
              `${esc(e.basis)} · ${sourceLink(e.url, e.system + " " + e.code)}`,
          )
          .join(
            "<br>",
          )}${entries.length > 4 ? `<br>+ ${entries.length - 4} other matching codes in loaded evidence` : ""}</p>`
      : ""
  }${nearest ? `<p>Approx. ${nearest.km < 1 ? "less than 1" : Math.round(nearest.km)} km · ${nearest.role === "vendor" ? "Vendor address" : "Reported work"} · ${sourceLink(nearest.url, nearest.label)}<br>${esc(nearest.precision)} · straight-line distance</p>` : ""}${entries.length && nearest ? "<small>Capability and location evidence may come from different records for this company.</small>" : ""}</div>`;
}

export function leadSelectionText(selection) {
  if (!selection) return "";
  const cap = LEAD_CAPABILITIES.find((c) => c.id === selection.capability);
  return [
    cap ? `Capability: ${cap.name} (reported codes)` : "All capabilities",
    selection.center && selection.radiusKm
      ? `Within ${selection.radiusKm} km of ${selection.center.label}; ${selection.role === "work" ? "reported award work" : "vendor addresses"}; ${selection.center.precision}; straight-line distance; unlocated records excluded`
      : "No distance filter",
  ].join(" · ");
}

export function initLeadFilters({
  getCountry,
  getRows,
  normalizeCountry,
  loadPlaces,
  onChange,
  focus,
}) {
  const $ = (id) => document.getElementById(id);
  let center = null,
    centerCountry = "",
    map,
    locateRun = 0;
  const data = new Map(),
    pending = new Set();
  const role = () => $("leadLocationRole").value;
  const selection = () => ({
    capability: $("leadCapability").value,
    center,
    radiusKm: center ? Number($("leadRadius").value) : 0,
    role: role(),
  });
  const pointFor = (row, kind) => {
    const address = recordAddress(row, kind);
    return resolvePlace(address, data.get(normalizeCountry(address.country)));
  };
  function draw() {
    if (!map) return;
    const s = selection(),
      polygon = s.center && radiusPolygon(s.center.coordinates, s.radiusKm);
    map
      .getSource("lead-radius")
      .setData({
        type: "FeatureCollection",
        features: polygon
          ? [
              polygon,
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: s.center.coordinates },
              },
            ]
          : [],
      });
  }
  function prepare() {
    if (center && centerCountry !== getCountry()) {
      center = null;
      $("leadPlace").value = "";
      $("leadPlaceStatus").textContent =
        "Location filter cleared for the new country.";
      draw();
    }
    if (!center || !Number($("leadRadius").value)) return;
    const codes = [
      ...new Set(
        getRows()
          .filter(
            (r) =>
              role() !== "work" || ["awards", "subawards"].includes(r.layer),
          )
          .map((r) => normalizeCountry(recordAddress(r, role()).country))
          .filter(Boolean),
      ),
    ];
    const missing = codes.filter(
      (code) => !data.has(code) && !pending.has(code),
    );
    for (const code of missing) pending.add(code);
    if (missing.length)
      void (async () => {
        for (let i = 0; i < missing.length; i += 8)
          await Promise.all(
            missing.slice(i, i + 8).map(async (code) => {
              try {
                data.set(code, await loadPlaces(code));
              } catch {
                data.set(code, null);
              } finally {
                pending.delete(code);
              }
            }),
          );
        onChange();
      })();
  }
  function apply(list) {
    prepare();
    const s = selection(),
      result = filterLeads(list, s, pointFor);
    const cap = LEAD_CAPABILITIES.find((c) => c.id === s.capability);
    $("leadFilterStatus").textContent =
      `${result.matches.length} of ${list.length} loaded companies match${cap ? " · " + cap.name : ""}${s.center && s.radiusKm ? ` · within ${s.radiusKm} km of ${s.center.label} (${s.role === "vendor" ? "vendor addresses" : "reported work"}) · ${result.unlocated} unlocated · ${result.outside} with no known point inside` : ""}.${pending.size && s.center && s.radiusKm ? " Resolving location references; results are still updating." : ""} Filters use loaded records only; missing codes or locations can hide relevant leads.`;
    if (
      s.center &&
      s.radiusKm &&
      s.role === "work" &&
      !getRows().some((r) => ["awards", "subawards"].includes(r.layer))
    )
      $("leadFilterStatus").textContent +=
        " This source has no award work-location evidence. Use Vendor addresses or select an award source.";
    $("leadMatchSummary").hidden = !s.capability && !(s.center && s.radiusKm);
    $("leadMatchSummary").textContent = $("leadFilterStatus").textContent;
    return result.matches;
  }
  async function locate() {
    const q = $("leadPlace").value.trim(),
      country = getCountry(),
      token = ++locateRun;
    if (!q) {
      $("leadPlaceStatus").textContent = "Enter a city or postal area.";
      return;
    }
    $("leadPlaceStatus").textContent = "Finding the reference location…";
    let places;
    try {
      places = await loadPlaces(country);
    } catch {
      places = null;
    }
    if (
      token !== locateRun ||
      country !== getCountry() ||
      q !== $("leadPlace").value.trim()
    )
      return;
    const found =
      resolvePlace({ city: q }, places) || resolvePlace({ postal: q }, places);
    if (!found) {
      $("leadPlaceStatus").textContent =
        "No unique city or postal match. Try another name. The previous radius, if any, is unchanged.";
      return;
    }
    data.set(country, places);
    center = found;
    centerCountry = country;
    if (!Number($("leadRadius").value)) $("leadRadius").value = "50";
    $("leadPlaceStatus").textContent =
      `${found.label} · ${found.precision}. Radius uses straight-line distance, not a road route or service area.`;
    draw();
    onChange();
    focus(found.coordinates, Number($("leadRadius").value));
  }
  $("leadCapability").innerHTML =
    '<option value="">All capabilities</option>' +
    LEAD_CAPABILITIES.map(
      (c) => `<option value="${c.id}">${esc(c.name)}</option>`,
    ).join("");
  $("leadCodeRules").innerHTML =
    LEAD_CAPABILITIES.map(
      (c) =>
        `<p><strong>${esc(c.name)}</strong>: NAICS ${c.naics.join(", ")} · PSC ${c.psc.join(", ")}</p>`,
    ).join("") +
    `<p>Short codes match a code family. Research categories use the <a href="${NAICS_SOURCE}" target="_blank" rel="noopener">2022 NAICS manual</a> and <a href="${PSC_SOURCE}" target="_blank" rel="noopener">April 2024 PSC manual</a>. These categories are broad leads, not verified capabilities or a solicitation code recommendation.</p>`;
  $("leadCapability").onchange = onChange;
  for (const id of ["leadRadius", "leadLocationRole"])
    $(id).onchange = () => {
      draw();
      onChange();
    };
  $("leadLocate").onclick = locate;
  $("leadPlace").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      locate();
    }
  };
  $("leadClear").onclick = () => {
    locateRun++;
    center = null;
    $("leadPlace").value = "";
    $("leadRadius").value = "0";
    $("leadCapability").value = "";
    $("leadPlaceStatus").textContent = "";
    draw();
    onChange();
  };
  return {
    apply,
    selection,
    isResolving: () =>
      !!(center && Number($("leadRadius").value) && pending.size),
    exportRows: (list) =>
      list.flatMap((s) =>
        s.rows.map((r) => ({
          ...r,
          leadFilter: selection(),
          capabilityMatches: capabilityEvidence(r, selection().capability),
          radiusMatch:
            center && Number($("leadRadius").value)
              ? locationEvidence(r, role(), center, pointFor)
              : null,
        })),
      ),
    attachMap: (instance) => {
      map = instance;
      map.addSource("lead-radius", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "lead-radius-fill",
        type: "fill",
        source: "lead-radius",
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#438be4", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "lead-radius-line",
        type: "line",
        source: "lead-radius",
        filter: ["==", "$type", "Polygon"],
        paint: {
          "line-color": "#438be4",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      map.addLayer({
        id: "lead-radius-center",
        type: "circle",
        source: "lead-radius",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-color": "#438be4",
          "circle-radius": 5,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      draw();
    },
  };
}
