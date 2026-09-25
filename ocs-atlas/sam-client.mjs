import { samEndpoint } from "./service-config.mjs";
import { esc, dedupe } from "./core.mjs";
const $ = (id) => document.getElementById(id);
export function samQueryLabel(q) {
  if (!q) return "Search criteria not captured";
  if (q.kind === "exclusions")
    return `Active firm exclusions · address country: ${q.country}${q.name ? " · Name contains: " + q.name : ""}`;
  if (q.uei)
    return "Exact UEI: " + q.uei + " · any registration country/status";
  return [
    `Registration country: ${q.country}`,
    q.name && `Company name contains: ${q.name}`,
    q.industry && `Declared industry contains: ${q.industry}`,
    q.naics && `NAICS: ${q.naics}`,
    q.psc && `PSC: ${q.psc}`,
    `Reported status: ${q.status === "A" ? "active" : q.status === "E" ? "expired" : "active or expired"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
export async function samRequest(query, signal) {
  const { kind, ...body } = query;
  const res = await fetch(
    samEndpoint(
      kind === "exclusions" ? "/api/sam/exclusions" : "/api/sam/entities",
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OCS-Request": "1" },
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(40000),
    },
  );
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "The SAM connection returned an unreadable response. Please try again shortly.",
    );
  }
  if (!res.ok) throw new Error(data.error || "SAM search unavailable.");
  if (
    data?.sensitivity !== "PUBLIC" ||
    data.source !== "SAM.gov" ||
    !Array.isArray(data.rows)
  )
    throw new Error("Unexpected public SAM response.");
  return data;
}
export function registrationHTML(rows) {
  const sam = rows.filter((r) => r.layer === "sam");
  const awards = rows.filter((r) => ["awards", "subawards"].includes(r.layer));
  return (
    exclusionsHTML(rows) +
    `<section class="profile-summary"><h3>Registration & evidence</h3><p><strong>Declared capability:</strong> ${sam.length ? "Public SAM registration evidence is available." : "No public SAM registration captured."}</p><p><strong>Documented award experience:</strong> ${awards.length} loaded records. Contract history does not establish successful performance or present capacity.</p>${sam.map((r) => `${r.exclusion === "D" ? "<p><strong>SAM registration reports an exclusion flag.</strong> Review the active exclusion record and its scope in official SAM search.</p>" : ""}<dl class="facts"><div><dt>Reported registration status</dt><dd>${esc(r.status || "Not reported")}</dd></div><div><dt>Registration expiration</dt><dd>${esc(r.expiration || "Not reported")}</dd></div><div><dt>Last SAM update / retrieved</dt><dd>${esc(r.updated || "Not reported")} / ${esc(r.retrievedAt || "Unknown")}</dd></div><div><dt>Reported address</dt><dd>${esc([r.address, r.city, r.region, r.postalCode, r.origin].filter(Boolean).join(", "))}</dd></div><div><dt>Declared NAICS / primary</dt><dd>${esc(r.naics || "Not reported")} / ${esc(r.primaryNaics || "Not reported")}</dd></div><div><dt>Declared industries</dt><dd>${esc(r.declaredIndustries || "Not reported")}</dd></div><div><dt>Declared PSC</dt><dd>${esc(r.psc || "Not reported")}</dd></div><div><dt>Registration purpose</dt><dd>${esc(r.purpose || "Not reported")}</dd></div></dl>`).join("")}<p class="muted small">Still to verify: current capability, availability, registration status, relevant experience and local permissions. Public-record absence does not establish that an entity is unregistered. Registration does not confer installation access.</p></section>`
  );
}
export function exclusionsHTML(rows) {
  const records = rows.filter((r) => r.layer === "exclusions");
  if (!records.length) return "";
  return `<section class="profile-summary"><h3>Active SAM exclusion records</h3><p>Review each record's scope and verify identity in SAM. This is not a universal award-eligibility determination.</p>${records
    .map(
      (r) =>
        `<dl class="facts">${Object.entries({
          "Exclusion type": r.exclusionType,
          Program: r.exclusionProgram,
          "Excluding agency": r.excludingAgency,
          "FASCSA order": r.fascsaOrder || "Not reported",
          Address: [r.address, r.city, r.region, r.postalCode, r.origin]
            .filter(Boolean)
            .join(", "),
          "Source comments": r.description || "Not reported",
          Retrieved: r.retrievedAt,
          Search: samQueryLabel(r.samQuery),
        })
          .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
          .join(
            "",
          )}</dl>${(r.exclusionActions || []).map((a) => `<p>Reported status: ${esc(a.recordStatus)} · Effective: ${esc(a.activateDate || "Not reported")} · Termination: ${esc(a.terminationDate || a.terminationType || "Not reported")} · Updated: ${esc(a.updateDate || "Not reported")}</p>`).join("")}<a href="https://sam.gov/search/" target="_blank" rel="noopener">Review exclusion in SAM using company name${r.uei ? " and UEI " + esc(r.uei) : " and address"} ↗</a>`,
    )
    .join("")}</section>`;
}

// Serialize network work: a changed country/filter replaces pending work, never an
// in-flight request. Old replies are cached but cannot paint a different query.
export function initSAM({
  getCountry,
  isActive = () => true,
  onLoading = () => {},
  onError = () => {},
  onResults,
  schedulePage = (run) => setTimeout(run, 2200),
  cancelPage = clearTimeout,
}) {
  let last = null,
    busy = false,
    wanted = "",
    pending = null,
    timer = null,
    paused = false;
  const cache = new Map();
  const key = (q) => JSON.stringify({ ...q, page: 0 });
  const mode = () => $("samMode").value;
  async function connection() {
    try {
      const res = await fetch(samEndpoint("/api/sam/status"));
      if (!res.ok) throw new Error();
      const s = await res.json();
      const reset = s.resetsAt
        ? ` Resets ${new Date(s.resetsAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}.`
        : "";
      $("samConnection").textContent = s.configured
        ? `Public SAM connection ready · ${s.remaining} of ${s.dailyBudget} ${s.mode === "shared" ? "shared" : "local"} requests remaining today.${reset} Cached searches do not consume another request.`
        : "Add a SAM public API key on this computer to activate live searches. No key is entered in this webpage.";
    } catch {
      $("samConnection").textContent =
        "SAM connection unavailable. Try Check connection again shortly; other research sources remain available.";
    }
  }
  function query() {
    const base = {
      country: getCountry().code,
      name: $("samName").value.trim(),
      page: 0,
    };
    return mode() === "exclusions"
      ? { ...base, kind: "exclusions" }
      : {
          ...base,
          industry: $("samIndustry").value.trim(),
          naics: $("samNAICS").value.trim(),
          psc: $("samPSC").value.trim().toUpperCase(),
          status: $("samExpired").checked ? "" : "A",
        };
  }
  function cancelScheduled() {
    if (timer !== null) cancelPage(timer);
    timer = null;
  }
  function status(message, summary = message) {
    $("samSearchStatus").textContent = message;
    $("samLoadProgress").textContent = summary;
  }
  function controls() {
    const more = !!last?.hasNext;
    const running = !paused && (busy || timer !== null || !!pending);
    $("samStop").hidden = !running;
    $("samResume").hidden = running || !(more || (paused && wanted && !last));
    $("samMore").disabled = running || !more;
    $("samMore").textContent = mode() === "exclusions"
      ? "Load 10 more records" : "Resume loading all matching vendors";
  }
  function describe(d) {
    const processed = d.sourceRecordsLoaded ?? d.rows.length + d.withheldRecords;
    const remaining = Math.ceil(Math.max(0, Math.min(d.queryTotal, 10000) - processed) / 10);
    const progress = d.hasNext
      ? paused ? "Paused; loaded records are retained."
        : d.kind === "exclusions" ? "More pages available."
          : `Loading remaining pages automatically · up to ${remaining} more SAM call${remaining === 1 ? "" : "s"} if uncached.`
      : d.capped ? "API result ceiling reached; narrow the search." : "All matching query pages loaded.";
    status(`${d.rows.length} of ${d.queryTotal} matching ${d.kind === "exclusions" ? "exclusion records" : "registrations"} loaded for ${getCountry().name}. ${progress} ${d.withheldRecords} source records omitted by public/identity/address checks; duplicates count once. Retrieved ${d.retrievedAt.slice(0, 10)}. ${d.kind === "exclusions" ? "No match does not establish award eligibility." : "Only publicly visible registrations matching these filters; registration does not establish capacity or installation access."}`,
      `${d.rows.length} of ${d.queryTotal} matching ${d.kind === "exclusions" ? "exclusion records" : "registrations"} loaded. ${progress}${d.withheldRecords ? ` ${d.withheldRecords} source records omitted by public/identity/address checks.` : ""}`);
  }
  function show(d) {
    last = d;
    onResults(d);
    $("samRetry").hidden = true;
    describe(d);
    controls();
  }
  function continueAutomatically() {
    if (paused || !last?.hasNext || last.kind === "exclusions" || !isActive()
        || key(last.query) !== wanted || timer !== null) return;
    timer = schedulePage(() => {
      timer = null;
      if (!paused && isActive() && last?.hasNext && key(last.query) === wanted) {
        pending = { ...last.query, page: last.page + 1 };
        drain();
      }
    });
    controls();
  }
  async function drain() {
    if (busy || !pending || !isActive()) return;
    const next = pending,
      id = key(next),
      old = last;
    pending = null;
    busy = true;
    controls();
    try {
      const d = await samRequest(next);
      const result = {
        ...d,
        kind: next.kind,
        query: next,
        rows: next.page ? dedupe([...(old?.rows || []), ...d.rows]) : d.rows,
        withheldRecords:
          (next.page ? old?.withheldRecords || 0 : 0) + d.withheldRecords,
        sourceRecordsLoaded: (next.page ? old?.sourceRecordsLoaded || 0 : 0)
          + (d.sourcePageRecords ?? d.rows.length + d.withheldRecords),
      };
      cache.set(id, { at: Date.now(), data: result });
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      if (isActive() && wanted === id) {
        pending = null;
        show(result);
      }
    } catch (e) {
      if (isActive() && wanted === id) {
        paused = true;
        status((next.page
            ? `${last?.rows.length || 0} of ${last?.queryTotal || "unknown"} matching records loaded. Earlier pages retained. `
            : "No results loaded for these criteria. ") + e.message);
        $("samRetry").hidden = false;
        $("samMore").disabled = !last?.hasNext;
        onError(mode(), e.message, !!next.page);
      }
    } finally {
      busy = false;
      connection();
      if (pending) drain();
      else continueAutomatically();
      controls();
    }
  }
  function sync(force = false) {
    cancelScheduled();
    pending = null;
    paused = false;
    $("samLoadPanel").hidden = !isActive();
    if (!isActive()) {
      wanted = "";
      return;
    }
    const exclusions = mode() === "exclusions";
    $("samRegistrationFilters").hidden = exclusions;
    $("samExclusionNote").hidden = !exclusions;
    for (const id of ["samIndustry", "samNAICS", "samPSC", "samExpired"])
      $(id).disabled = exclusions;
    const q = query(),
      id = key(q);
    wanted = id;
    last = null;
    onLoading(mode());
    $("samMore").disabled = true;
    $("samRetry").hidden = true;
    if (!$("samSearchForm").checkValidity()) {
      wanted = "";
      status("Complete the filter: NAICS needs six digits; PSC needs four letters or digits.");
      controls();
      onError(mode(), $("samSearchStatus").textContent, false);
      return;
    }
    const saved = cache.get(id);
    if (!force && saved && Date.now() - saved.at < 1800000) {
      show(saved.data);
      continueAutomatically();
      return;
    }
    status(busy
      ? "Waiting for the previous SAM request; this country's results will load next…"
      : "Loading public SAM records…");
    pending = q;
    drain();
  }
  $("samSearchForm").onkeydown = (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();
      sync();
    }
  };
  $("samSearchForm").onsubmit = (e) => {
    e.preventDefault();
    sync();
  };
  for (const id of [
    "samMode",
    "samExpired",
    "samName",
    "samIndustry",
    "samNAICS",
    "samPSC",
  ])
    $(id).onchange = () => sync();
  function resume() {
    paused = false;
    cancelScheduled();
    if (!busy && last?.hasNext && key(last.query) === wanted) {
      pending = { ...last.query, page: last.page + 1 };
      describe(last);
      drain();
    } else if (!last) {
      if (busy) pending = query();
      else sync(true);
    }
    controls();
  }
  $("samMore").onclick = resume;
  $("samResume").onclick = resume;
  $("samStop").onclick = () => {
    paused = true;
    pending = null;
    cancelScheduled();
    if (last) describe(last);
    else status("Loading stopped. Any request already in progress will finish; no further pages will start.");
    controls();
  };
  $("samRetry").onclick = resume;
  $("samCheckConnection").onclick = connection;
  connection();
  return {
    suspend: () => {
      cancelScheduled();
      paused = true;
      $("samLoadPanel").hidden = true;
      wanted = "";
      pending = null;
      last = null;
    },
    refresh: connection,
    isBusy: () => busy,
    sync,
    countryChanged: sync,
    mode,
  };
}
