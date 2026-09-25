import { normalizeEntity } from "./ocs-sam-normalize.mjs";
export function samQuery(input, countries) {
  const q = {};
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid SAM search.");
  for (const k of Object.keys(input))
    if (
      ![
        "country",
        "name",
        "industry",
        "naics",
        "psc",
        "status",
        "uei",
        "page",
      ].includes(k)
    )
      throw new Error("Unsupported SAM search field.");
  for (const k of [
    "country",
    "name",
    "industry",
    "naics",
    "psc",
    "status",
    "uei",
  ]) {
    if (input[k] !== undefined && typeof input[k] !== "string")
      throw new Error("Invalid SAM search field.");
    q[k] = (input[k] || "").trim();
  }
  q.page = input.page ?? 0;
  if (!Number.isInteger(q.page) || q.page < 0 || q.page > 999)
    throw new Error("SAM page must be 0–999.");
  if (q.uei) {
    if (
      !/^[A-Z0-9]{12}$/.test(q.uei) ||
      q.page !== 0 ||
      ["country", "name", "industry", "naics", "psc", "status"].some(
        (k) => q[k],
      )
    )
      throw new Error(
        "Exact UEI lookups must be separate from discovery filters.",
      );
  } else if (!countries.some((c) => c.code === q.country))
    throw new Error("Choose a registration country.");
  if (q.naics && !/^\d{6}$/.test(q.naics))
    throw new Error(
      "SAM requires a full six-digit NAICS code. Broad industry searches remain available in award research.",
    );
  if (q.psc && !/^[A-Z0-9]{4}$/.test(q.psc))
    throw new Error("Use a four-character PSC.");
  if (q.status && !["A", "E"].includes(q.status))
    throw new Error("Choose active, expired, or either registration status.");
  if (
    [q.name, q.industry].some(
      (v) => v.length > 120 || /[\x00-\x1f&|{}^\\~\[\]:]/.test(v),
    )
  )
    throw new Error("Use plain search text, up to 120 characters.");
  return q;
}
export function samURL(q, key) {
  const u = new URL("https://api.sam.gov/entity-information/v3/entities");
  u.searchParams.set("api_key", key);
  u.searchParams.set("samRegistered", "Yes");
  u.searchParams.set(
    "includeSections",
    "entityRegistration,coreData,assertions",
  );
  u.searchParams.set("page", String(q.page));
  for (const [field, param] of Object.entries({
    country: "physicalAddressCountryCode",
    name: "legalBusinessName",
    industry: "naicsDesc",
    naics: "naicsCode",
    psc: "pscCode",
    status: "registrationStatus",
    uei: "ueiSAM",
  }))
    if (q[field]) u.searchParams.set(param, q[field]);
  return u;
}
export function publicSamPage(data, q, countries, now) {
  if (data?.sensitivity && data.sensitivity !== "PUBLIC")
    throw new Error("The response was not marked public.");
  const count = Number(data?.totalRecords);
  if (
    !Array.isArray(data?.entityData) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    data.entityData.length > 10 ||
    (!data.entityData.length && count > q.page * 10)
  )
    throw new Error("Unexpected SAM response.");
  const converted = data.entityData
    .map((r) => normalizeEntity(r, now))
    .filter(Boolean)
    .filter((r) => /^[A-Z0-9]{12}$/.test(r.uei));
  const rows = [];
  for (const row of converted) {
    const c = countries.find((c) => [c.code, c.iso2].includes(row.origin));
    if (q.uei && row.uei !== q.uei) continue;
    if (!q.uei && c?.code !== q.country) continue;
    rows.push({
      ...row,
      origin: c?.code || "",
      samQuery: { ...q, page: undefined },
      amount: null,
    });
  }
  const end = q.page * 10 + data.entityData.length;
  return {
    schemaVersion: 1,
    source: "SAM.gov",
    sensitivity: "PUBLIC",
    asOf: now.slice(0, 10),
    retrievedAt: now,
    complete: false,
    query: q,
    page: q.page,
    queryTotal: count,
    sourcePageRecords: data.entityData.length,
    withheldRecords: data.entityData.length - rows.length,
    hasNext: end < Math.min(count, 10000),
    capped: end >= 10000 && count > 10000,
    rows,
  };
}
