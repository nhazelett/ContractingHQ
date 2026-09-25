import { leadSelectionText } from "./lead-filters.mjs";
import { esc, safeURL, dedupe, suppliers } from "./core.mjs";
import { companySummary } from "./research.mjs";
import { CAPABILITIES, matchingCapability } from "./capabilities.mjs";
import { registrationHTML, samQueryLabel } from "./sam-client.mjs";
import { programEvidenceHTML } from "./programs-core.mjs";
import { transportLabels, groupTransportSegments } from "./transport-core.mjs";
const $ = (id) => document.getElementById(id);
const STORE = "kthq-ocs-research-packet-v1";
export function scopeText(s, names = {}) {
  return `${names[s.country] || s.country} · ${s.allDates ? "all reported dates" : `${s.from} to ${s.to}`} · ${s.agency} buyers · keyword: ${s.q || "any"} · NAICS: ${s.naics || "any"} · PSC: ${s.psc || "any"}`;
}
export function captureSearch({ scope, coverage, rows, filters, capability }) {
  if (Object.values(coverage).some((d) => d.status === "loading"))
    throw new Error(
      "Let the current source requests finish before capturing this search.",
    );
  if (
    !Object.values(coverage).some((d) =>
      ["ready", "snapshot", "error"].includes(d.status),
    )
  )
    throw new Error("Run a search before capturing its evidence.");
  const unique = dedupe(rows);
  return {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    scope: { ...scope },
    coverage: structuredClone(coverage),
    filters: structuredClone(filters),
    requirement:
      capability || matchingCapability(scope)?.name || "Custom market search",
    questions: (
      CAPABILITIES.find((p) => p.name === capability) ||
      matchingCapability(scope)
    )?.questions || [
      "Confirm current capability and availability directly.",
      "Verify identity, current registration, local permissions and relevant experience.",
    ],
    rows: structuredClone(unique.slice(0, 2000)),
    matchingRecords: unique.length,
    truncated: unique.length > 2000,
  };
}
function link(url, label) {
  const u = safeURL(url);
  return u
    ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : esc(label);
}
function evidenceTable(rows) {
  if (!rows.length)
    return "<p>No company evidence captured. This does not establish that no suppliers exist.</p>";
  return `<table><thead><tr><th>Supplier / identifier</th><th>Evidence</th><th>Source and retrieval</th></tr></thead><tbody>${rows.map((r) => `<tr><td><strong>${esc(r.name)}</strong><br>UEI ${esc(r.uei || "not reported")}<br>${esc(r.identifier)}</td><td>${r.layer === "exclusions" ? `Active SAM exclusion record<br>Type: ${esc(r.exclusionType)}<br>Program: ${esc(r.exclusionProgram)}<br>Excluding agency: ${esc(r.excludingAgency)}<br>Exclusion address country: ${esc(r.origin)}<br>FASCSA order: ${esc(r.fascsaOrder || "Not reported")}<br>Actions: ${esc(JSON.stringify(r.exclusionActions))}<br>Query: ${esc(samQueryLabel(r.samQuery))}<br>Verify identity and scope in SAM; this is not an overall eligibility determination.` : r.layer === "sam" ? `SAM public registration<br>Registered country: ${esc(r.origin || "unknown")}<br>Registration date: ${esc(r.date || "unknown")}` : `${esc(r.layer)} · ${esc(r.agency || "buyer unknown")}<br>Reported work country: ${esc(r.performanceCountry || "unknown")}<br>Start/report: ${esc(r.date || "unknown")}`}<br>${esc(r.description || "No description reported.")}${r.capabilityMatches?.length ? `<br>Matched codes: ${r.capabilityMatches.map(e => esc(e.basis + " · " + e.system + " " + e.code)).join("; ")}` : ""}${r.radiusMatch ? `<br>Location match reference: ${esc(r.radiusMatch.label)} · ${Math.round(r.radiusMatch.km)} km · ${esc(r.radiusMatch.role)} · ${esc(r.radiusMatch.precision)} · straight-line distance` : ""}${r.layer === "sam" ? `<br>Reported status: ${esc(r.status || "Unknown")}<br>Expires: ${esc(r.expiration || "Unknown")}<br>Declared NAICS: ${esc(r.naics || "Unknown")}<br>Declared PSC: ${esc(r.psc || "Unknown")}<br>Registration query: ${esc(samQueryLabel(r.samQuery))}` : ""}</td><td>${link(r.url, r.source || "Source")}<br>${esc(r.retrievedAt || "unknown")}<br>${r.scope ? esc(scopeText(r.scope)) : ""}</td></tr>`).join("")}</tbody></table>`;
}
export function transportReport(t) {
  if (!t) return "<p>No transport extract included.</p>";
  const groups = groupTransportSegments(t.rows),
    borders = t.rows.filter((r) => r.kind === "borders");
  const missing = t.rows.filter(
    (r) => r.kind !== "borders" && !transportLabels(r).name,
  ).length;
  return `<p>${esc(t.displayStatus)}</p><p>Research country: ${esc(t.researchCountry)}. Bounds (south, west, north, east): ${esc(t.bbox.join(", "))}. Enabled layers: ${esc(t.selectedLayers.join(", "))}. ${link(t.sourceURL, "© OpenStreetMap contributors · ODbL 1.0")}</p>
  <h3>How to read this map evidence</h3><p>A label such as <strong>Route 60</strong> is a road reference reported by the map source. It is not a speed limit, distance or capacity. ${link("https://wiki.openstreetmap.org/wiki/Key:ref", "About road references")}.</p><p>Roads and railways are recorded as individual segments; one road may have many records. ${missing} road/rail segments have no name recorded. This means the source lacks a name, not that the road has no local name. Grouping below uses matching names, references and source classes; it does not establish a continuous or usable route.</p>
  <h3>Border-control points · ${borders.length}</h3>${borders.length ? `<table><thead><tr><th>Mapped checkpoint</th><th>Location / reported operator</th><th>Evidence</th></tr></thead><tbody>${borders.map((r) => `<tr><td>${esc(transportLabels(r).title)}</td><td>${esc(r.geometry.coordinates[1])}° latitude, ${esc(r.geometry.coordinates[0])}° longitude<br>Operator: ${esc(r.tags?.operator || "Not recorded")}</td><td>${link(r.url, r.id)}</td></tr>`).join("")}</tbody></table>` : "<p>No border-control points were returned in this extract. This does not establish that none exist.</p>"}<p>These are publicly mapped border controls, not a live inventory of patrols or checkpoint staffing. Operating status and crossing permissions require verification.</p>
  <h3>Road and rail summary · ${groups.length} label groups</h3><table><thead><tr><th>Road / railway</th><th>Reported reference and class</th><th>Source segments</th></tr></thead><tbody>${groups.map((g) => `<tr><td><strong>${esc(g.title)}</strong><br>${esc(g.type)}${!g.name ? "<br>Name not recorded by source" : ""}</td><td>Route/reference: ${esc(g.reference || "Not recorded")}<br>Map class: ${esc(g.sourceClass || "Not recorded")}</td><td>${g.rows.length} segments<details><summary>Source records</summary>${g.rows.map((r) => link(r.url, r.id)).join("<br>")}</details></td></tr>`).join("")}</tbody></table><p>The JSON companion retains every individual segment, its source attributes and geometry. Segment counts do not count distinct roads.</p>`;
}
export function packetHTML(packet) {
  const sections = packet.searches
    .map(
      (s, i) =>
        `<section><h2>${i + 1}. ${esc(s.requirement)}</h2><p>${esc(scopeText(s.scope, packet.countryNames))}</p><p>Captured ${esc(s.capturedAt)}. View filters: ${esc(JSON.stringify(Object.fromEntries(Object.entries(s.filters || {}).filter(([key]) => key !== "leadDiscovery"))))}. ${esc(leadSelectionText(s.filters?.leadDiscovery))}</p><table><thead><tr><th>Source</th><th>State</th><th>Loaded records</th><th>More pages</th></tr></thead><tbody>${Object.entries(
          s.coverage,
        )
          .map(
            ([k, d]) =>
              `<tr><td>${esc(k)}${d.query ? `<br>SAM query: ${esc(samQueryLabel(d.query))}<br>Source matches: ${esc(d.queryTotal ?? "Unknown")} · withheld: ${esc(d.withheldRecords ?? "Unknown")}${d.capped ? " · API result ceiling reached" : ""}` : ""}</td><td>${esc(d.status)}${d.programCoverage ? `<details><summary>Program query and order coverage</summary><pre>${esc(JSON.stringify(d.programCoverage, null, 2))}</pre></details>` : ""}${d.error ? ": " + esc(d.error) : ""}</td><td>${d.loaded || 0}</td><td>${d.hasMore === null ? "Unknown" : d.hasMore ? "Yes" : "No, within this query"}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table><p>${s.rows.length} captured company records out of ${s.matchingRecords} in this view.${s.truncated ? " Capture limit reached; export visible evidence separately for the full set." : ""} Source counts may also include generic recipient records omitted from company leads.</p><h3>Questions for follow-up</h3><ul>${s.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul><details open><summary>View ${s.rows.length} supporting records</summary>${programEvidenceHTML(
          s.rows,
          s.rows.filter((r) => r.programRole === "holder"),
          s.scope.country,
          packet.exportedAt.slice(0, 10),
        )}${evidenceTable(s.rows)}</details></section>`,
    )
    .join("");
  const shortlist = packet.shortlist
    .map(
      (s) =>
        `<section><h3>${esc(s.name)}</h3><p><strong>Why selected / questions:</strong> ${esc(s.note || "No research note saved.")}</p>${registrationHTML(s.rows)}${programEvidenceHTML(
          s.rows,
          s.rows.filter((r) => r.programRole === "holder"),
          s.summary.countries.length === 1
            ? s.summary.countries[0]
            : "selected country not retained",
          packet.exportedAt.slice(0, 10),
        )}<p>UEI ${esc(s.uei || "not reported")} · saved ${esc(s.savedAt)}. Work countries: ${esc(s.summary.countries.join(", ") || "unknown")}. Buyers: ${esc(s.summary.buyers.join("; ") || "unknown")}.</p><p>Worldwide history coverage: ${s.researchCoverage ? esc(JSON.stringify(s.researchCoverage)) : "Not captured; saved evidence may be partial."}</p><details open><summary>View ${s.rows.length} saved records</summary>${evidenceTable(s.rows)}</details></section>`,
    )
    .join("");
  const logistics = packet.logistics
    .map(
      (d) =>
        `<section><h3>${esc(d.kind)}</h3><p>${esc(d.source)} · ${esc(d.license)} · ${esc(d.version)} · retrieved ${esc(d.retrievedAt)}. Filters: ${esc(JSON.stringify(d.filters))}.</p><p>${d.totalMatches} directory matches; ${d.mappedMatches} have coordinates. ${d.rows.length} records included${d.truncated ? " (packet limit; export the logistics directory for all matches)" : ""}. ${link(d.sourcePage, "Source directory")}</p><table><thead><tr><th>Facility</th><th>Identifier / country</th><th>Position</th></tr></thead><tbody>${d.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.id)} · ${esc(r.country)}</td><td>${r.point ? esc(r.point.join(", ")) + " (longitude, latitude)" : "Not mapped"}</td></tr>`).join("")}</tbody></table></section>`,
    )
    .join("");
  const t = packet.transport;
  const transport = transportReport(t);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OCS market research packet</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#172f40;background:#f1f5f8;margin:0}main{max-width:1050px;margin:auto;padding:38px;background:white}h1{font-size:32px;line-height:1.15}h2{margin-top:30px;color:#0b6863}h3{margin-bottom:6px}p,td{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:12px;margin:15px 0}th,td{border:1px solid #ced9df;padding:9px;text-align:left;vertical-align:top}th{background:#edf4f5}a{color:#075c83}section{margin:20px 0;padding-bottom:16px;border-bottom:1px solid #ccd8de}.note{border-left:4px solid #238b80;padding:12px;background:#eff8f6}summary{cursor:pointer;font-weight:600}details[open]{margin-top:12px}@media print{body{background:white}main{padding:0}details{display:block}details>*{display:block!important}summary{display:none}tr{break-inside:avoid}h2,h3{break-after:avoid}a{color:inherit}}@page{margin:15mm}</style></head><body><main><p>KTHQ · Independent practitioner research</p><h1>OCS market research packet</h1><p>Prepared ${esc(packet.exportedAt)} · ${packet.searches.length} captured searches · ${packet.shortlist.length} shortlisted companies</p><p class="note">Public-source research leads for further verification. This packet documents search methods, evidence and gaps. It does not determine responsibility, eligibility, successful performance, logistics suitability or installation access. Search dates are API query windows; award start/end dates may fall outside them. Source retrieval dates do not confirm current facility status. Open evidence sections to inspect records; the JSON companion preserves full structured data.</p><h2>Research coverage</h2><p>SAM and host-government evidence are included only where explicitly captured. Missing sources and empty results are research gaps. Country-based supplier positions must not be used for distance-to-facility or route calculations.</p>${sections || "<p>No searches captured.</p>"}<h2>Shortlisted companies</h2>${shortlist || "<p>No companies shortlisted.</p>"}<h2>Logistics directory context</h2><p>Directory coordinates and types do not establish cargo handling or permission to use facilities. Port records may describe a town or area. Logistics context below was captured at packet preparation, separately from the earlier searches.</p>${logistics || "<p>No enabled logistics directory included.</p>"}<h2>Transportation context</h2>${transport}<p>Roads and rail are mapped features, not validated routes. Border-control points do not establish current crossing or customs availability. See the source records and relevant authorities.</p></main></body></html>`;
}
export function initPacket({
  getSearch,
  getSaved,
  getCountries,
  getLogistics,
  getTransport,
  exportFile,
  onRestore,
}) {
  let searches = [];
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || "null");
    if (x?.schemaVersion === 1 && Array.isArray(x.searches))
      searches = x.searches
        .filter(
          (s) =>
            s.scope &&
            Array.isArray(s.rows) &&
            s.coverage &&
            Array.isArray(s.questions),
        )
        .slice(0, 12);
  } catch {}
  function persist() {
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({ schemaVersion: 1, searches }),
      );
      $("packetStatus").textContent =
        "Captured searches saved in this browser.";
    } catch {
      $("packetStatus").textContent =
        "Browser storage unavailable or full. Your packet remains in this session; export it to preserve it.";
    }
  }
  function render() {
    $("packetCount").textContent = searches.length;
    $("packetSearches").innerHTML =
      searches
        .map(
          (s, i) =>
            `<article class="packet-search"><div><strong>${esc(s.requirement)}</strong><p class="muted small">${esc(scopeText(s.scope))}<br>${s.rows.length} captured records · ${esc(s.capturedAt.slice(0, 10))}</p></div><button data-rerun="${i}" class="secondary">Rerun</button><button data-remove-search="${i}" class="text-button">Remove</button></article>`,
        )
        .join("") ||
      '<p class="muted small">Capture a completed search to retain its filters, evidence and coverage gaps.</p>';
    $("packetSearches")
      .querySelectorAll("[data-rerun]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            onRestore(searches[Number(b.dataset.rerun)].scope)),
      );
    $("packetSearches")
      .querySelectorAll("[data-remove-search]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            searches.splice(Number(b.dataset.removeSearch), 1);
            persist();
            render();
          }),
      );
  }
  $("captureSearch").onclick = () => {
    try {
      if (searches.length >= 12)
        throw new Error(
          "This packet holds up to 12 searches. Export it or remove an entry before adding another.",
        );
      searches.push(captureSearch(getSearch()));
      persist();
      render();
    } catch (e) {
      $("packetStatus").textContent = e.message;
    }
  };
  $("previewPacket").onclick = () => {
    const countries = getCountries();
    const packet = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      countryNames: Object.fromEntries(countries.map((c) => [c.code, c.name])),
      searches: structuredClone(searches),
      shortlist: Object.values(getSaved())
        .map((v) => {
          const s = suppliers(v.rows, countries, "").find(
            (s) => s.key === v.key,
          );
          return s
            ? {
                key: s.key,
                name: s.name,
                uei: s.uei,
                rows: s.rows,
                savedAt: v.savedAt,
                note: v.note || "",
                researchCoverage: v.researchCoverage,
                summary: companySummary(s.rows),
              }
            : null;
        })
        .filter(Boolean),
      logistics: getLogistics(),
      transport: getTransport(),
    };
    const html = packetHTML(packet);
    $("packetPreview").srcdoc = html;
    $("packetHTML").onclick = () =>
      exportFile("ocs-market-research.html", html, "text/html;charset=utf-8");
    $("packetJSON").onclick = () =>
      exportFile(
        "ocs-market-research.json",
        JSON.stringify(packet, null, 2),
        "application/json",
      );
    $("packetDialog").showModal();
  };
  render();
  return { render };
}
