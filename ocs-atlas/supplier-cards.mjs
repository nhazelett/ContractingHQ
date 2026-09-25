import { esc, safeURL, LAYERS } from "./core.mjs";

// Compare calendar dates without treating malformed or ambiguous dates as recent.
export function evidenceDate(value) {
  const raw = String(value || "");
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  const us = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const date = iso || (us ? `${us[3]}-${us[1]}-${us[2]}` : "");
  const time = Date.parse(date);
  return date &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === date
    ? date
    : "";
}
const latestDate = (rows, field) =>
  rows
    .map((r) => evidenceDate(r[field]))
    .filter(Boolean)
    .sort()
    .at(-1) || "";
const status = (r) =>
  ["A", "ACTIVE"].includes(String(r.status).toUpperCase())
    ? "active"
    : ["E", "EXPIRED"].includes(String(r.status).toUpperCase())
      ? "expired"
      : "unknown";
export function registrationBadges(
  rows,
  today = new Date().toISOString().slice(0, 10),
) {
  const sam = rows.filter((r) => r.layer === "sam");
  const latest = latestDate(sam, "retrievedAt");
  // Undated evidence cannot silently be ranked below dated evidence.
  const recent = sam.some((r) => !evidenceDate(r.retrievedAt))
    ? sam
    : sam.filter((r) => evidenceDate(r.retrievedAt) === latest);
  const values = new Set(recent.map(status));
  let label = "Registration status unknown",
    tone = "unknown",
    detail = "No SAM registration in these loaded records.";
  if (sam.length) {
    detail = latest
      ? `SAM retrieved ${latest}`
      : "SAM retrieval date not reported";
    if (values.size > 1) {
      label = "Registration status conflicts";
      tone = "review";
      detail += " · Loaded records disagree; review evidence.";
    } else if (values.has("expired")) {
      label = "Expired registration · reported";
      tone = "review";
    } else if (values.has("active")) {
      const past = recent.some(
        (r) => evidenceDate(r.expiration) && evidenceDate(r.expiration) < today,
      );
      label = past
        ? "Registration needs recheck"
        : "Active registration · reported";
      tone = past ? "review" : "recorded";
      if (past)
        detail += " · Reported active, but its expiration date has passed.";
    } else detail += " · Status not recognized or not reported.";
    const expirations = [
      ...new Set(recent.map((r) => evidenceDate(r.expiration)).filter(Boolean)),
    ];
    if (expirations.length === 1) detail += ` · Expiration ${expirations[0]}`;
    else if (expirations.length > 1) detail += " · Expiration dates differ";
  }
  const badges = [{ label, tone, detail }];
  const exclusions = rows.filter((r) => r.layer === "exclusions");
  if (exclusions.length)
    badges.push({
      label: "Exclusion record · review scope",
      tone: "review",
      detail: `SAM retrieved ${latestDate(exclusions, "retrievedAt") || "date unknown"} · ${exclusions.length} loaded record${exclusions.length === 1 ? "" : "s"}`,
    });
  else if (recent.some((r) => r.exclusion === "D"))
    badges.push({
      label: "SAM reports an exclusion flag",
      tone: "review",
      detail: `SAM retrieved ${latest || "date unknown"} · Open the official exclusion record to verify scope.`,
    });
  return badges;
}
export function supplierCardFacts(rows, countryName = (c) => c) {
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const location = (r, work = false) => {
    const code = work ? r.performanceCountry : r.origin;
    const parts = unique(
      (work
        ? [r.performanceCity, r.performanceState, r.performancePostalCode]
        : [r.city, r.region, r.postalCode]
      ).map((v) => String(v || "").trim()),
    );
    if (code) parts.push(countryName(code));
    if (!parts.length) return "";
    return (
      parts.join(", ") +
      (code && parts.length === 1
        ? " (country only)"
        : !code
          ? " (country not reported)"
          : "")
    );
  };
  const awards = rows.filter((r) => ["awards", "subawards"].includes(r.layer));
  const addresses = unique(rows.map((r) => location(r)));
  const work = unique(awards.map((r) => location(r, true)));
  const source = [...rows].sort((a, b) =>
    evidenceDate(b.retrievedAt).localeCompare(evidenceDate(a.retrievedAt)),
  )[0];
  return {
    addresses,
    work,
    missingAddress: rows.filter((r) => !location(r)).length,
    missingWork: awards.filter((r) => !location(r, true)).length,
    awardCount: awards.length,
    latestAward: latestDate(awards, "date"),
    source,
  };
}
export function supplierCardHTML(
  s,
  { countryName, saved = false, programHTML = "", matchHTML = "", today } = {},
) {
  const f = supplierCardFacts(s.rows, countryName);
  const places = (values, fallback) =>
    values.length
      ? `${values.slice(0, 2).map(esc).join("<br>")}${values.length > 2 ? `<br><button class="card-more text-button" data-open="${esc(s.key)}">View ${values.length - 2} more locations ↗</button>` : ""}`
      : fallback;
  const sourceURL = safeURL(f.source?.url);
  const source = esc(f.source?.source || "Source not reported");
  return `<article class="supplier-row supplier-card">
    <header class="supplier-card-heading"><div><button class="supplier-name" data-open="${esc(s.key)}">${esc(s.name)} ↗</button><div class="supplier-sub">${s.uei ? "UEI " + esc(s.uei) : "UEI not reported · identity unresolved"} · ${s.rows.length} evidence record${s.rows.length === 1 ? "" : "s"}</div></div><button class="save-button ${saved ? "saved" : ""}" data-save="${esc(s.key)}" aria-label="${saved ? "Remove" : "Save"} ${esc(s.name)}" aria-pressed="${saved}">${saved ? "★" : "☆"}</button></header>
    <div class="card-status-list">${registrationBadges(s.rows, today)
      .map(
        (b) =>
          `<div class="card-status"><span class="status-badge status-${b.tone}">${esc(b.label)}</span><small>${esc(b.detail)}</small></div>`,
      )
      .join("")}</div>
    <div class="card-source-tags">${[...s.layers].map((l) => `<span class="tag">${esc(LAYERS[l]?.name || l)}</span>`).join("")}</div>${programHTML ? `<div class="card-programs"><span class="card-program-label">Holder / parent program links</span><div>${programHTML}</div><small>Program links alone do not establish work in this country.</small></div>` : ""}
    ${matchHTML}
    <dl class="card-facts"><div><dt>Reported address${f.addresses.length > 1 ? "es" : ""}</dt><dd>${places(f.addresses, "Address not reported")}${f.missingAddress ? `<small>${f.missingAddress} records lack an address location</small>` : ""}</dd></div><div><dt>Documented work locations</dt><dd>${places(f.work, f.awardCount ? "Location not reported in loaded awards" : "No award work evidence loaded")}${f.missingWork ? `<small>${f.missingWork} award records lack a work location</small>` : ""}</dd></div><div><dt>Latest award start / report</dt><dd>${esc(f.latestAward || "Not available in loaded evidence")}<small>Historical evidence; current performance unverified</small></dd></div><div><dt>Latest captured source</dt><dd>${sourceURL ? `<a href="${esc(sourceURL)}" target="_blank" rel="noopener noreferrer">${source} ↗</a>` : source}<small>Retrieved ${esc(evidenceDate(f.source?.retrievedAt) || "date not reported")}</small></dd></div></dl>
    <footer class="card-footer"><span>${esc(s.segment === "local" ? "Address in research country" : s.segment === "us" ? "U.S. address" : s.segment === "third" ? "Third-country address" : "Unknown / conflicting address country")}</span><button class="text-button" data-open="${esc(s.key)}">View evidence & details ↗</button></footer>
  </article>`;
}
