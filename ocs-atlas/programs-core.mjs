import {
  esc,
  normalizeAwards,
  dedupe,
  safeURL,
  spendingBody,
  TERRITORIES,
} from "./core.mjs";

export const PROGRAMS = {
  AFCAP: "AFCAP V",
  LOGCAP: "LOGCAP V",
  WEXMAC: "WEXMAC",
};
export const IDV_ORDERS_API = "https://api.usaspending.gov/api/v2/idvs/awards/";
export function programVersion(description = "") {
  if (/\bAFCAP V\b.*BASIC CONTRACT/i.test(description))
    return ["AFCAP", "AFCAP V"];
  if (/BASIC IDIQ FOR LOGCAP V SERVICES/i.test(description))
    return ["LOGCAP", "LOGCAP V"];
  if (
    /\bWEXMAC\b|WORLD\s*WIDE EXPEDITIONARY MULTIPLE AWARD CONTRACT/i.test(
      description,
    )
  ) {
    const version = description.match(
      /(?:WEXMAC\)?\s*|MULTIPLE AWARD CONTRACT\s*)(\d+\.\d+)/i,
    )?.[1];
    return [
      "WEXMAC",
      "WEXMAC" +
        (version ? " " + version : " · version not stated") +
        (/TITUS/i.test(description) ? " · TITUS" : ""),
    ];
  }
  return null;
}
export function awardKey(row) {
  if (row.awardKey) return row.awardKey;
  try {
    return decodeURIComponent(new URL(row.url).pathname.split("/")[2] || "");
  } catch {
    return "";
  }
}
export function parentKey(row) {
  if (row.layer !== "awards") return "";
  const m = awardKey(row).match(/^CONT_AWD_[^_]+_[^_]+_([^_]+)_([^_]+)$/);
  return m && m[1] !== "-NONE-" && m[2] !== "-NONE-"
    ? `CONT_IDV_${m[1]}_${m[2]}`
    : "";
}
export function catalogRows(pulls) {
  return dedupe(
    pulls.flatMap((p) => {
      const scope = {
        country: "ALL",
        from: "2007-10-01",
        to: p.retrievedAt.slice(0, 10),
        agency: "all",
        q: "",
        naics: "",
        psc: "",
      };
      return normalizeAwards(
        p.response,
        "vehicles",
        scope,
        p.retrievedAt,
      ).rows.flatMap((r) => {
        const match = programVersion(r.description);
        if (
          !match ||
          !/^[A-Z0-9]{12}$/.test(r.uei) ||
          !/^CONT_IDV_[A-Z0-9]+_[A-Z0-9]+$/.test(awardKey(r)) ||
          (match[0] === "WEXMAC" && !/^N00023/.test(r.identifier))
        )
          return [];
        return [
          {
            ...r,
            amount: null,
            performanceCountry: "",
            performanceCity: "",
            awardKey: awardKey(r),
            program: match[0],
            programVersion: match[1],
            programQuery: p.query,
            programRole: "holder",
          },
        ];
      });
    }),
  );
}
export function relatedContracts(rows, catalog) {
  const ueis = new Set(rows.map((r) => r.uei).filter(Boolean));
  const keys = new Set(rows.map(parentKey).filter(Boolean));
  return catalog.filter((c) => ueis.has(c.uei) || keys.has(awardKey(c)));
}
export function matchesProgramCountry(row, country) {
  return TERRITORIES[country]
    ? row.performanceCountry === "USA" &&
        row.performanceState === TERRITORIES[country]
    : row.performanceCountry === country;
}
export function countryOrders(rows, contracts, country) {
  const keys = new Set(contracts.map(awardKey));
  return rows.filter(
    (r) =>
      r.layer === "awards" &&
      matchesProgramCountry(r, country) &&
      keys.has(parentKey(r)),
  );
}
export function dateStatus(row, today = new Date().toISOString().slice(0, 10)) {
  const valid = (d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d || "") &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  if (!valid(row.date) || !valid(row.end) || row.date > row.end)
    return "Dates incomplete or inconsistent";
  if (row.date > today)
    return row.layer === "vehicles"
      ? "Reported contract start is in the future"
      : "Reported performance has not started";
  if (row.end < today)
    return row.layer === "vehicles"
      ? "Reported ordering deadline passed"
      : "Reported performance period ended";
  return row.layer === "vehicles"
    ? "Ordering period appears open"
    : "Reported performance period includes today";
}
export function programBadges(rows, catalog) {
  return [
    ...new Set(relatedContracts(rows, catalog).map((c) => c.programVersion)),
  ]
    .map((v) => `<span class="tag program-tag">${esc(v)}</span>`)
    .join("");
}
export function programSignals(rows, catalog, country, today) {
  const orders = countryOrders(rows, relatedContracts(rows, catalog), country);
  if (!orders.length) return "";
  return `<span class="tag program-tag">${orders.length} linked orders · ${esc(country)}</span>${orders.some((r) => dateStatus(r, today) === "Reported performance period includes today") ? '<span class="tag program-tag">Reported period includes today</span>' : ""}`;
}
export function programEvidenceHTML(rows, catalog, country, today) {
  catalog = dedupe([
    ...catalog,
    ...rows.map((r) => r.programParent).filter(Boolean),
  ]);
  const contracts = relatedContracts(rows, catalog);
  if (!contracts.length) return "";
  return `<section class="profile-summary"><h3>Contract program evidence</h3><p>Availability unverified. Public award records do not confirm capacity, successful performance, current authorization or installation access. Dates below are evaluated as of ${esc(today || new Date().toISOString().slice(0, 10))}.</p>${contracts
    .map((c) => {
      const orders = rows.filter((r) => parentKey(r) === awardKey(c));
      const local = countryOrders(orders, [c], country);
      return `<article class="program-evidence"><h4>${esc(c.programVersion)} · ${esc(c.identifier)}</h4><p>${rows.some((r) => r.uei === c.uei) ? "Verified contract holder in the cited award record" : "Linked parent contract; holder identity differs"}: ${esc(c.name)} · UEI ${esc(c.uei)}</p><p>${esc(dateStatus(c, today))} · reported last date to order: ${esc(c.end || "Unknown")}. Verify changes and ordering requirements with the program office.</p><p>${local.length} loaded orders reported in ${esc(country)}; ${orders.length} linked orders in this evidence set. Missing orders are a coverage gap.</p><p><a href="${esc(safeURL(c.url))}" target="_blank" rel="noopener">Parent contract record ↗</a> · retrieved ${esc(c.retrievedAt)}</p>${orders.map((r) => `<p><a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener">${esc(r.identifier)}</a> · ${esc(r.performanceCountry || "Work country unreported")} · ${esc(r.date || "?")} to ${esc(r.end || "?")} · ${esc(dateStatus(r, today))}<br>${esc(r.description)}</p>`).join("")}</article>`;
    })
    .join("")}</section>`;
}
export function linkedOrderSearch(scope, children, page = 1) {
  const body = spendingBody(
    {
      ...scope,
      agency: "all",
      q: "",
      naics: "",
      psc: "",
      from: "2007-10-01",
      to: new Date().toISOString().slice(0, 10),
    },
    "awards",
    page,
  );
  delete body.filters.time_period;
  // Quoted ID batches currently return source errors. Candidate IDs are unquoted;
  // verifiedOrders independently requires the full exact award key and parent.
  body.filters.award_ids = children.map((r) => r.piid);
  return body;
}
export function validateChildren(data, contract) {
  if (
    !Array.isArray(data.results) ||
    typeof data.page_metadata?.hasNext !== "boolean"
  )
    throw new Error(
      "Unexpected linked-order response. Previous evidence retained.",
    );
  if (data.results.length > 100)
    throw new Error("Linked-order response exceeded the page limit.");
  return data.results.filter(
    (r) =>
      /^[A-Z0-9]+$/.test(r.piid || "") &&
      parentKey({ layer: "awards", awardKey: r.generated_unique_award_id }) ===
        awardKey(contract),
  );
}
export function verifiedOrders(data, contract, children, scope, retrievedAt) {
  const allowed = new Set(children.map((r) => r.generated_unique_award_id));
  return normalizeAwards(data, "awards", scope, retrievedAt)
    .rows.filter(
      (r) =>
        allowed.has(awardKey(r)) &&
        parentKey(r) === awardKey(contract) &&
        matchesProgramCountry(r, scope.country),
    )
    .map((r) => ({
      ...r,
      program: contract.program,
      programVersion: contract.programVersion,
      programRole: "order",
      parentAwardKey: awardKey(contract),
      programParent: contract,
    }));
}
