import { createHash } from "node:crypto";
import { text, countryCode } from "../ocs-atlas/core.mjs";

export function exclusionQuery(input, countries) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !["country", "name", "page"].includes(k))
  )
    throw new Error("Invalid exclusion search.");
  if (
    typeof input.country !== "string" ||
    !countries.some((c) => c.code === input.country)
  )
    throw new Error("Choose an exclusion address country.");
  if (input.name !== undefined && typeof input.name !== "string")
    throw new Error("Invalid company name.");
  const name = (input.name || "").trim(),
    page = input.page ?? 0;
  if (name.length > 120 || /[\x00-\x1f&|{}^\\~\[\]:]/.test(name))
    throw new Error("Use plain company-name text, up to 120 characters.");
  if (!Number.isInteger(page) || page < 0 || page > 999)
    throw new Error("SAM page must be 0–999.");
  return { country: input.country, name, page };
}
export function exclusionURL(q, key) {
  const u = new URL("https://api.sam.gov/entity-information/v4/exclusions");
  for (const [k, v] of Object.entries({
    api_key: key,
    classification: "Firm",
    recordStatus: "active",
    country: q.country,
    page: q.page,
    size: 10,
  }))
    u.searchParams.set(k, String(v));
  if (q.name) u.searchParams.set("exclusionName", q.name);
  return u;
}
export function publicExclusionPage(data, q, countries, now) {
  if (data?.sensitivity && data.sensitivity !== "PUBLIC")
    throw new Error("The response was not marked public.");
  const count = Number(data?.totalRecords),
    raw = data?.excludedEntity;
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Array.isArray(raw) ||
    raw.length > 10 ||
    (!raw.length && count > q.page * 10)
  )
    throw new Error("Unexpected SAM exclusions response.");
  const rows = [];
  for (const r of raw) {
    const d = r.exclusionDetails || {},
      i = r.exclusionIdentification || {},
      a = r.exclusionPrimaryAddress || {},
      other = r.exclusionOtherInformation || {};
    const actions = r.exclusionActions?.listOfActions;
    if (
      d.classificationType !== "Firm" ||
      !i.entityName ||
      !Array.isArray(actions) ||
      actions.length > 100 ||
      !actions.some((v) => String(v.recordStatus).toLowerCase() === "active")
    )
      continue;
    const origin = countryCode(a.countryCode, countries);
    if (origin !== q.country) continue;
    const row = {
      layer: "exclusions",
      name: text(i.entityName, 300),
      uei: /^[A-Z0-9]{12}$/.test(i.ueiSAM || "") ? i.ueiSAM : "",
      identifier: text(i.cageCode, 20),
      origin,
      city: text(a.city, 120),
      region: text(a.stateOrProvinceCode, 50),
      postalCode: text(a.zipCode, 30),
      address: text(
        [a.addressLine1, a.addressLine2].filter(Boolean).join(", "),
        300,
      ),
      exclusionType: text(d.exclusionType, 200),
      exclusionProgram: text(d.exclusionProgram, 100),
      excludingAgency: text(
        d.excludingAgencyName || d.excludingAgencyCode,
        200,
      ),
      exclusionActions: actions.map((v) =>
        Object.fromEntries(
          [
            "createDate",
            "updateDate",
            "activateDate",
            "terminationDate",
            "terminationType",
            "recordStatus",
          ].map((k) => [k, text(v[k], 50)]),
        ),
      ),
      fascsaOrder: text(other.isFASCSAOrder, 10),
      description: text(other.additionalComments, 8000),
      status: "Active exclusion record",
      amount: null,
      source: "SAM.gov",
      url: "https://sam.gov/search/",
      retrievedAt: now,
      samQuery: { ...q, kind: "exclusions", page: undefined },
    };
    row.id =
      "exclusion:" +
      createHash("sha256")
        .update(
          JSON.stringify({
            ...row,
            retrievedAt: undefined,
            samQuery: undefined,
          }),
        )
        .digest("hex")
        .slice(0, 32);
    rows.push(row);
  }
  const end = q.page * 10 + raw.length;
  return {
    schemaVersion: 1,
    source: "SAM.gov",
    sensitivity: "PUBLIC",
    kind: "exclusions",
    asOf: now.slice(0, 10),
    retrievedAt: now,
    complete: false,
    query: { ...q, kind: "exclusions" },
    page: q.page,
    queryTotal: count,
    sourcePageRecords: raw.length,
    withheldRecords: raw.length - rows.length,
    hasNext: end < Math.min(count, 10000),
    capped: end >= 10000 && count > 10000,
    rows,
  };
}
