import { spendingBody, dedupe } from "./core.mjs";
export function companyHistoryBody(scope, uei, page = 1) {
  if (!/^[A-Z0-9]{12}$/.test(uei))
    throw new Error("An exact 12-character UEI is required.");
  const body = spendingBody(
    { ...scope, q: "", naics: "", psc: "" },
    "awards",
    page,
  );
  delete body.filters.place_of_performance_locations;
  body.filters.recipient_search_text = [uei];
  return body;
}
export function exactCompanyRows(rows, uei) {
  return rows.filter((r) => r.uei === uei && !r.aggregate);
}
export function companySummary(rows) {
  rows = dedupe(rows);
  const unique = (fn) => [...new Set(rows.map(fn).filter(Boolean))].sort();
  const dates = unique((r) =>
    ["sam", "exclusions"].includes(r.layer) ? "" : r.date,
  );
  return {
    records: rows.length,
    countries: unique((r) => r.performanceCountry),
    buyers: unique((r) => r.agency),
    naics: unique((r) => r.naics),
    psc: unique((r) => r.psc),
    earliest: dates[0] || "",
    latest: dates.at(-1) || "",
    registrations: rows
      .filter((r) => r.layer === "sam")
      .map((r) => ({
        status: r.status,
        expiration: r.expiration,
        retrievedAt: r.retrievedAt,
      })),
    relationships: unique((r) => r.primeName),
    counts: Object.fromEntries(
      ["awards", "subawards", "vehicles", "sam", "exclusions"].map((k) => [
        k,
        rows.filter((r) => r.layer === k).length,
      ]),
    ),
    scopes: [
      ...new Map(
        rows
          .filter((r) => r.scope)
          .map((r) => [JSON.stringify(r.scope), r.scope]),
      ).values(),
    ],
    missingWorkCountry: rows.filter(
      (r) => !["sam", "exclusions"].includes(r.layer) && !r.performanceCountry,
    ).length,
  };
}
export const searchCacheKey = (scope) =>
  JSON.stringify([
    "ocs-query-v1",
    ...["country", "from", "to", "q", "naics", "psc", "agency"].map(
      (k) => scope[k] || "",
    ),
  ]);
