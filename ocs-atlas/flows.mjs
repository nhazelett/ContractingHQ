import { countryCode, safeURL } from "./core.mjs";
import { recordAddress, resolvePlace } from "./places.mjs";

export const FLOW_COLORS = {
  local: "#199e8a",
  us: "#438be4",
  third: "#aa78df",
};
const phrase = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
const mentions = (text, name) =>
  (" " + phrase(text) + " ").includes(" " + phrase(name) + " ");
const validPoint = (p) =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

// Named facilities are reference points from the public directory, never a
// guessed worksite or an inferred match from contractor/parent identity.
export function facilityReferences(rows, facilities, countries) {
  const byCountry = new Map();
  for (const f of facilities) {
    if (
      !validPoint(f.point) ||
      f.type === "closed" ||
      phrase(f.name).length < 12
    )
      continue;
    const cc = countryCode(f.country, countries);
    if (!byCountry.has(cc)) byCountry.set(cc, []);
    byCountry.get(cc).push(f);
  }
  const aliases = new Map();
  for (const r of rows) {
    const cc = countryCode(r.performanceCountry, countries);
    for (const f of byCountry.get(cc) || []) {
      // Only derive an abbreviation when this same public award spells it out.
      const escaped = f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = String(r.description || "").match(
        new RegExp(escaped + "\\s*\\(([A-Z0-9]{3,8})\\)", "i"),
      );
      if (!match) continue;
      const key = cc + "|" + match[1].toUpperCase();
      if (!aliases.has(key)) aliases.set(key, new Map());
      aliases.get(key).set(f.id, {
        facility: f,
        proof: r.url,
        proofIdentifier: r.identifier,
      });
    }
  }
  return (row) => {
    const cc = countryCode(row.performanceCountry, countries),
      found = new Map();
    for (const f of byCountry.get(cc) || [])
      if (mentions(row.description, f.name))
        found.set(f.id, {
          facility: f,
          match: "Full facility name in award description",
          proof: row.url,
          proofIdentifier: row.identifier,
        });
    for (const [key, candidates] of aliases) {
      const [country, abbr] = key.split("|");
      if (country !== cc || !mentions(row.description, abbr)) continue;
      // An ambiguous abbreviation must not choose between possible facilities.
      if (candidates.size !== 1) return null;
      const item = [...candidates.values()][0];
      if (!found.has(item.facility.id))
        found.set(item.facility.id, {
          ...item,
          match: `${abbr} in award description; expansion documented by ${item.proofIdentifier}`,
        });
    }
    if (found.size !== 1) return null;
    const hit = [...found.values()][0],
      f = hit.facility;
    return {
      coordinates: f.point,
      label: f.name,
      precision: "Named facility · public directory reference point",
      reference: "OurAirports:" + f.id,
      source: "OurAirports",
      sourceURL:
        "https://ourairports.com/airports/" + encodeURIComponent(f.id) + "/",
      match: hit.match,
      proofURL: safeURL(hit.proof),
      proofIdentifier: hit.proofIdentifier,
    };
  };
}

export function endpoint(address, countries, data) {
  const code = countryCode(address.country, countries),
    c = countries.find((c) => c.code === code);
  if (!c) return null;
  const precise = resolvePlace(address, data);
  if (precise) return { ...precise, country: code, countryName: c.name };
  const coords = c.latlng && [c.latlng[1], c.latlng[0]];
  return validPoint(coords)
    ? {
        coordinates: coords,
        country: code,
        countryName: c.name,
        label: c.name,
        precision:
          "Country only · representative point, exact location unresolved",
        reference: "country:" + code,
        source: "Country reference",
      }
    : null;
}

// Wrap across the antimeridian by the shorter longitudinal path. These lines
// depict an evidence relationship, not travel, freight movement or a route.
export function connectionCoordinates(a, b) {
  let lon = b[0];
  while (lon - a[0] > 180) lon -= 360;
  while (lon - a[0] < -180) lon += 360;
  return [a, [lon, b[1]]];
}
export function contractorFlows(list, countries, data, facilities = []) {
  const rows = list
    .flatMap((s) => s.rows)
    .filter((r) => ["awards", "subawards"].includes(r.layer));
  const facility = facilityReferences(rows, facilities, countries),
    groups = new Map();
  let eligible = 0,
    missing = 0;
  for (const supplier of list)
    for (const row of supplier.rows) {
      if (!["awards", "subawards"].includes(row.layer)) continue;
      eligible++;
      const originAddress = recordAddress(row, "vendor"),
        workAddress = recordAddress(row, "work");
      const origin = endpoint(
        originAddress,
        countries,
        data.get(originAddress.country),
      );
      let work = endpoint(
        workAddress,
        countries,
        data.get(workAddress.country),
      );
      if (!origin || !work) {
        missing++;
        continue;
      }
      const named = facility(row);
      if (named) work = { ...work, ...named };
      const segment =
        origin.country === work.country
          ? "local"
          : origin.country === "USA"
            ? "us"
            : "third";
      const key = JSON.stringify([
        supplier.key,
        origin.country,
        origin.reference,
        work.country,
        work.reference,
      ]);
      if (!groups.has(key))
        groups.set(key, {
          id: "flow-" + groups.size,
          supplierKey: supplier.key,
          name: supplier.name,
          origin,
          work,
          segment,
          color: FLOW_COLORS[segment],
          rows: [],
        });
      const group = groups.get(key);
      if (!group.rows.some((r) => r.id === row.id)) group.rows.push(row);
    }
  return { groups: [...groups.values()], eligible, missing };
}
