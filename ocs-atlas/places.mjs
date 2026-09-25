// Local public gazetteer matching. No fuzzy matches, address transmission,
// country-centroid fallback, or inferred relationship between address and work.
export const placeKey = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const valid = (lat, lon) =>
  typeof lat === "number" &&
  typeof lon === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;
const indexes = new WeakMap();
function index(data) {
  if (indexes.has(data)) return indexes.get(data);
  const cities = new Map(),
    postal = new Map(),
    regions = new Set();
  const add = (map, key, row) => {
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).includes(row)) map.get(key).push(row);
  };
  for (const r of data.cities) {
    for (const n of r[1]) add(cities, placeKey(n), r);
    for (const n of r[4]) regions.add(placeKey(n));
  }
  for (const r of data.postal) add(postal, placeKey(r[0]), r);
  const result = { cities, postal, regions };
  indexes.set(data, result);
  return result;
}
export function resolvePlace(address, data) {
  if (!data) return null;
  const city = placeKey(address.city),
    postal = placeKey(address.postal),
    region = placeKey(address.region);
  const regionMatches = (r) => !region || r.some((x) => placeKey(x) === region);
  const lookup = index(data);
  let cities = lookup.cities.get(city) || [];
  if (region && cities.some((r) => regionMatches(r[4])))
    cities = cities.filter((r) => regionMatches(r[4]));
  else if (region && lookup.regions.has(region)) cities = [];
  let codes = (lookup.postal.get(postal) || []).filter((r) =>
    regionMatches(r[4]),
  );
  if (city)
    codes = codes.filter(
      (r) =>
        placeKey(r[1]) === city ||
        cities.some((c) => c[1].some((n) => placeKey(n) === placeKey(r[1]))),
    );
  // Multiple places for the same postal code are deliberately left unresolved.
  const uniqueCodes = [
    ...new Map(codes.map((r) => [r[2] + "," + r[3], r])).values(),
  ];
  if (uniqueCodes.length === 1 && valid(uniqueCodes[0][2], uniqueCodes[0][3])) {
    const r = uniqueCodes[0];
    return {
      coordinates: [r[3], r[2]],
      precision: "Postal area (estimated)",
      label: r[1] + " " + r[0],
      reference: "postal:" + r[0],
      source: "GeoNames",
    };
  }
  if (cities.length === 1 && valid(cities[0][2], cities[0][3])) {
    const r = cities[0];
    return {
      coordinates: [r[3], r[2]],
      precision: "City center (approximate)",
      label: r[1][0],
      reference: "geoname:" + r[0],
      source: "GeoNames",
    };
  }
  return null;
}
export function recordAddress(row, role) {
  return role === "work"
    ? {
        country: row.performanceCountry,
        city: row.performanceCity,
        region: row.performanceState,
        postal: row.performancePostalCode,
      }
    : {
        country: row.origin,
        city: row.city,
        region: row.region,
        postal: row.postalCode,
      };
}
