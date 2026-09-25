import { supplierCardHTML } from "./supplier-cards.mjs";
import { resolvePlace, recordAddress } from "./places.mjs";
import { contractorFlows, connectionCoordinates } from "./flows.mjs";
import { initCountryNavigation } from "./country-navigation.mjs";
import {
  API,
  GEO_API,
  LAYERS,
  esc,
  money,
  compactMoney,
  defaults,
  validate,
  spendingBody,
  geographyBody,
  normalizeGeography,
  normalizeAwards,
  dedupe,
  suppliers,
  filterSuppliers,
  csv,
  safeURL,
  validateSnapshot,
  samRowsForScope,
  countryCode,
} from "./core.mjs";
import {
  companyHistoryBody,
  exactCompanyRows,
  companySummary,
  searchCacheKey,
} from "./research.mjs";
import {
  CAPABILITIES,
  NAICS_SOURCE,
  capabilityScope,
} from "./capabilities.mjs";
import { initPacket } from "./packet.mjs";
import {
  initSAM,
  samRequest,
  registrationHTML,
  samQueryLabel,
} from "./sam-client.mjs";
import { initPrograms } from "./programs.mjs";
import {
  programBadges,
  programSignals,
  programEvidenceHTML,
  dateStatus,
} from "./programs-core.mjs";
import { initTransport } from "./transport.mjs";
import { initLogistics } from "./logistics.mjs";
import { RESEARCH_SOURCES } from "./sources.mjs";
const $ = (id) => document.getElementById(id);
const STORAGE = "kthq-ocs-shortlist-v1";
let countries = [],
  scope = defaults(),
  generation = 0,
  controller = new AbortController(),
  map,
  mapReady = false,
  samSnapshot = null;
let layerData = {},
  enabled = new Set(["awards"]),
  activeSource = "awards",
  segment = "all",
  onlySaved = false,
  originFilter = "",
  activeSupplier = null;
let globalData = null,
  globalOn = false;
let supplierPopup = null;
let flowGroups = [],
  facilityPromise;
let logistics, transport, packet, samClient, programs, countryNavigation;
const samProfiles = new Map(),
  researchNotes = new Map();
let selectedCapability = "";
let capabilitySearch = null;
let historyRun = null;
const queryCache = new Map();
const profiles = new Map();
let profileController = new AbortController();
let samIsImported = false;
let saved = {};
try {
  const parsed = JSON.parse(localStorage.getItem(STORAGE) || "{}");
  if (parsed?.version === 1 && Array.isArray(parsed.suppliers))
    for (const s of parsed.suppliers.slice(0, 500))
      if (typeof s.key === "string" && Array.isArray(s.rows)) saved[s.key] = s;
} catch {
  /* Storage may be blocked. */
}
const country = (code) => countries.find((c) => c.code === code);
const cname = (code) =>
  code === "ALL" ? "Worldwide" : country(code)?.name || code || "Not reported";
const currentCountry = () => country(scope.country);
const layerRows = () =>
  dedupe([
    ...Object.entries(layerData)
      .filter(([id]) => enabled.has(id))
      .flatMap(([, d]) => d.rows || []),
    ...(programs?.rows() || []),
  ]);
const allSuppliers = () => suppliers(layerRows(), countries, scope.country);
function visibleSuppliers() {
  const list = onlySaved
    ? suppliers(
        Object.values(saved).flatMap((s) => s.rows),
        countries,
        scope.country,
      )
    : allSuppliers();
  return filterSuppliers(list, {
    query: $("localFilter").value,
    segment,
    layers:
      onlySaved || programs?.active() ? Object.keys(LAYERS) : [...enabled],
  }).filter(
    (s) =>
      (!originFilter || s.origin === originFilter) &&
      (programs?.filter(s) ?? true),
  );
}
function notify(message = "") {
  $("notice").textContent = message;
  $("notice").hidden = !message;
}
function persist() {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({ version: 1, suppliers: Object.values(saved) }),
    );
  } catch {
    notify(
      "Browser storage is unavailable or full. Export your shortlist to preserve it.",
    );
  }
}
function download(name, body, type) {
  const u = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function exportFile(name, body, type) {
  $("exportTitle").textContent = name;
  $("exportContent").value = body;
  $("exportHelp").textContent =
    "Download the file, or copy its contents if your browser restricts downloads.";
  $("downloadExport").onclick = () => download(name, body, type);
  $("copyExport").onclick = async () => {
    try {
      await navigator.clipboard.writeText(body);
      $("exportHelp").textContent =
        "Copied. The export includes the source records and research context.";
    } catch {
      $("exportContent").select();
      $("exportHelp").textContent =
        "Contents selected. Use your browser’s Copy command.";
    }
  };
  $("exportDialog").showModal();
}
async function json(url, options = {}) {
  const ac = new AbortController();
  const abort = () => ac.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) ac.abort();
  const timer = setTimeout(() => ac.abort(), 40000);
  try {
    const res = await fetch(url, { ...options, signal: ac.signal });
    if (!res.ok) throw new Error(`Source returned HTTP ${res.status}.`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
function formScope() {
  if (!["awards", "subawards", "vehicles"].includes(activeSource))
    return { ...scope, country: $("country").value };
  const s = {};
  for (const k of ["country", "q", "naics", "psc", "agency", "from", "to"])
    s[k] = $(k).value.trim();
  s.psc = s.psc.toUpperCase();
  return validate(s);
}
function fillForm() {
  for (const [k, v] of Object.entries(scope)) if ($(k)) $(k).value = v;
}
function setURL() {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(scope))
    v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
  history.replaceState(null, "", u);
}
function statusText(id) {
  const d = layerData[id];
  if (!d)
    return id === "sam"
      ? "Select SAM to load public registrations automatically"
      : "Not loaded";
  if (d.status === "loading")
    return `Loading${d.rows?.length ? " more records" : ""}…`;
  if (d.status === "error")
    return d.rows?.length
      ? `${d.rows.length} retained · refresh unavailable`
      : "Unavailable · retry";
  if (d.status === "snapshot")
    return `${d.rows.length} records · saved ${d.asOf?.slice(0, 10)}`;
  if (d.status === "ready")
    return `${d.rows.length} records · ${d.hasNext ? "more available" : "pages complete"}`;
  return d.status;
}
async function selectSource(id, { skipSAM = false } = {}) {
  supplierPopup?.remove();
  notify();
  activeSource = id;
  enabled = new Set(LAYERS[id] ? [id] : []);
  programs?.select(LAYERS[id] ? null : id);
  onlySaved = false;
  originFilter = "";
  segment = "all";
  $("localFilter").value = "";
  $("flowFocus").value = "";
  if (historyRun) historyRun.stop = true;
  render();
  if (!skipSAM) samClient?.sync();
  if (LAYERS[id] && !["sam", "exclusions"].includes(id) && !layerData[id])
    await loadLayer(id, 1, generation);
  if (activeSource === id && $("locationRole").value === "flow") {
    await updateMap(visibleSuppliers());
    if (activeSource === id) fitMap();
  }
}
function renderLayers() {
  const sourceFocused = document.activeElement?.name === "supplierSource";
  const names = {
    awards: "Prime contracts",
    subawards: "Subcontracts",
    vehicles: "Contract Vehicles",
    sam: "SAM Registered vendors",
    AFCAP: "AFCAP",
    LOGCAP: "LOGCAP",
    WEXMAC: "WEXMAC",
  };
  $("layers").innerHTML = Object.entries(names)
    .map(
      ([id, name]) =>
        `<label class="source-choice ${activeSource === id ? "selected" : ""}"><input type="radio" name="supplierSource" value="${id}" ${activeSource === id ? "checked" : ""}>${name}</label>`,
    )
    .join("");
  $("layerCount").textContent = "One at a time";
  $("layers")
    .querySelectorAll("input")
    .forEach((input) => (input.onchange = () => selectSource(input.value)));
  if (sourceFocused)
    $("layers").querySelector("input:checked")?.focus({ preventScroll: true });
  const awardMode = ["awards", "subawards", "vehicles"].includes(activeSource);
  $("awardCriteria").hidden = !awardMode;
  $("samDiscovery").hidden = activeSource !== "sam";
  $("programPanel").hidden = !!LAYERS[activeSource];
  $("capabilityPresets").hidden = !awardMode;
  $("capabilityRecipe").hidden = !awardMode;
}
function render() {
  countryNavigation?.sync();
  renderLayers();
  const list = visibleSuppliers(),
    all = onlySaved
      ? suppliers(
          Object.values(saved).flatMap((s) => s.rows),
          countries,
          scope.country,
        )
      : allSuppliers().filter((s) => programs?.filter(s) ?? true);
  $("countryName").textContent = cname(scope.country);
  $("mapLabel").textContent = cname(scope.country);
  $("regionName").textContent =
    currentCountry()?.region?.toUpperCase() || "COUNTRY RESEARCH";
  $("dossier").href =
    "country-contracting-dossier.html?country=" + scope.country;
  const rows =
    onlySaved || programs?.active()
      ? dedupe(all.flatMap((s) => s.rows))
      : layerRows();
  $("supplierMetric").textContent = all.length.toLocaleString();
  $("recordMetric").textContent = rows.length.toLocaleString();
  $("originMetric").textContent = new Set(
    all.map((s) => s.origin).filter(Boolean),
  ).size;
  $("buyerMetric").textContent = new Set(
    rows.map((r) => r.agency).filter(Boolean),
  ).size;
  for (const type of ["all", "local", "us", "third", "unknown"])
    $("count-" + type).textContent =
      type === "all"
        ? all.length
        : all.filter((s) => s.segment === type).length;
  $("segments")
    .querySelectorAll("button")
    .forEach((b) =>
      b.classList.toggle("selected", b.dataset.segment === segment),
    );
  $("shortlistCount").textContent = Object.keys(saved).length;
  $("compareSaved").disabled = Object.keys(saved).length < 2;
  $("loadHistory").disabled =
    onlySaved ||
    !!historyRun ||
    Object.values(layerData).some((d) => d.status === "loading");
  $("loadHistory").hidden = !!programs?.active() || activeSource === "sam";
  $("shortlistToggle").classList.toggle("primary", onlySaved);
  $("shortlistToggle").firstChild.textContent = onlySaved
    ? "Showing shortlist "
    : "Show shortlist ";
  $("resultCount").textContent = list.length;
  const partial = Object.entries(layerData).some(
    ([id, d]) => enabled.has(id) && d.hasNext,
  );
  $("scopeLabel").textContent =
    (onlySaved
      ? "Saved evidence across research sessions. "
      : programs?.active()
        ? `Contract programs · ${programs.selection().programs.join(", ")} · ${programs.selection().mode === "country" ? "loaded orders in " + cname(scope.country) : "worldwide holders"}. Program checks use all reported dates; main award filters apply only to ordinary award results. `
        : activeSource === "sam"
          ? `${cname(scope.country)} · ${samClient?.mode() === "exclusions" ? "active firm exclusions" : "SAM registrations"} · SAM search criteria only. `
          : `${LAYERS[activeSource]?.name} · ${cname(scope.country)} · ${scope.from} → ${scope.to} · ${scope.agency === "dod" ? "DoD" : scope.agency === "civilian" ? "Civilian buyers, filtered after retrieval" : "All federal buyers, including DoD"}. `) +
    (partial && !onlySaved && !programs?.active()
      ? "Partial results; load additional pages below. "
      : "") +
    (originFilter
      ? `Origin filter: ${cname(originFilter)}. Select All origins to clear. `
      : "");
  if (!list.length) {
    const loading = Object.entries(layerData).some(
      ([id, d]) => enabled.has(id) && d.status === "loading",
    );
    const failed = Object.entries(layerData).some(
      ([id, d]) => enabled.has(id) && d.status === "error",
    );
    $("resultList").innerHTML =
      `<div class="empty"><strong>${loading ? "Looking up public records…" : onlySaved ? "Your shortlist is empty" : failed ? "A source could not be loaded" : "No matching leads in the loaded records"}</strong><p>${loading ? "Fetching the selected evidence layers." : failed ? "Open Sources & coverage for the connection status, or retry the source below." : "Try a broader search, another layer, or clear the loaded-result filter. This does not establish that no capable suppliers exist."}</p></div>`;
  } else
    $("resultList").innerHTML = list
      .map((s) => {
        const badges = programBadges(s.rows, programs?.catalog() || []);
        const programHTML = badges
          ? `<button class="program-badges" data-open="${esc(s.key)}" aria-label="View contract programs for ${esc(s.name)}">${badges}</button>${programSignals(s.rows, programs?.catalog() || [], scope.country)}`
          : "";
        return supplierCardHTML(s, {
          countryName: cname,
          saved: !!saved[s.key],
          programHTML,
        });
      })
      .join("");
  $("resultList")
    .querySelectorAll("[data-open]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        openSupplier(list.find((s) => s.key === b.dataset.open)),
      ),
    );
  $("resultList")
    .querySelectorAll("[data-save]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        saveSupplier(list.find((s) => s.key === b.dataset.save)),
      ),
    );
  $("pagination").innerHTML =
    onlySaved || programs?.active()
      ? ""
      : Object.entries(layerData)
          .filter(
            ([id]) => enabled.has(id) && !["sam", "exclusions"].includes(id),
          )
          .map(([id, d]) =>
            d.hasNext || d.status === "error"
              ? `<button data-more="${id}" ${d.status === "loading" || historyRun ? "disabled" : ""}>${d.status === "error" ? "Retry" : "Load 100 more"} · ${esc(LAYERS[id].name)}</button>`
              : "",
          )
          .join("");
  $("pagination")
    .querySelectorAll("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        const d = layerData[b.dataset.more];
        loadLayer(
          b.dataset.more,
          d.status === "error" ? d.failedPage || 1 : (d.page || 1) + 1,
          generation,
        );
      }),
    );
  updateMap(list);
  renderInsights(list);
  $("exportCSV").disabled = !list.length;
  $("exportJSON").disabled = !Object.keys(saved).length;
}
async function loadGlobal(token = generation) {
  $("globalStatus").textContent = "Loading worldwide award activity…";
  try {
    const data = await json(GEO_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geographyBody(scope)),
      signal: controller.signal,
    });
    if (token !== generation) return;
    globalData = normalizeGeography(data);
    $("globalStatus").textContent =
      `${globalData.length} reported countries · retrieved ${new Date().toISOString().slice(0, 10)} · same dates and capability filters.`;
    updateMap(visibleSuppliers());
  } catch (err) {
    if (token !== generation) return;
    $("globalStatus").textContent =
      scope.agency === "civilian"
        ? "Choose all buyers or DoD for global activity."
        : "Worldwide activity unavailable. Toggle off and on to retry.";
  }
}
async function loadLayer(id, page = 1, token = generation) {
  if (token !== generation || layerData[id]?.status === "loading") return;
  const prior = layerData[id] || { rows: [] };
  layerData[id] = { ...prior, status: "loading" };
  render();
  try {
    const data = await json(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spendingBody(scope, id, page)),
      signal: controller.signal,
    });
    if (token !== generation) return;
    const normalized = normalizeAwards(data, id, scope);
    layerData[id] = {
      ...normalized,
      rows: dedupe(
        page === 1
          ? normalized.rows
          : [...(prior.rows || []), ...normalized.rows],
      ),
      page,
      status: "ready",
      retrievedAt: new Date().toISOString(),
    };
    cacheSearch();
  } catch (err) {
    if (token !== generation) return;
    layerData[id] = {
      ...prior,
      status: "error",
      failedPage: page,
      error:
        err.name === "AbortError"
          ? "The source timed out. Retry this layer."
          : "The source is temporarily unavailable. " + err.message,
    };
  }
  render();
  if ($("coverageDialog").open) renderCoverage();
}
async function search() {
  let next;
  try {
    next = formScope();
  } catch (err) {
    notify(err.message);
    return;
  }
  if (historyRun) historyRun.stop = true;
  controller.abort();
  controller = new AbortController();
  const token = ++generation;
  profileController.abort();
  if ($("supplierDialog").open) $("supplierDialog").close();
  if (scope.country !== next.country) {
    transport.clear();
    $("placeQuery").value = "";
    $("placeStatus").textContent = "";
    $("flowFocus").value = "";
  }
  scope = next;
  programs?.countryChanged();
  logistics.render();
  layerData = {};
  onlySaved = false;
  originFilter = "";
  segment = "all";
  $("localFilter").value = "";
  notify();
  setURL();
  updateCacheButton();
  $("historyStatus").textContent = "";
  globalData = null;
  if (globalOn) loadGlobal(token);
  if (
    !samIsImported &&
    (!samSnapshot?.query || samSnapshot.query.country !== scope.country)
  )
    samSnapshot = null;
  if (samSnapshot)
    layerData.sam = {
      rows: samRowsForScope(samSnapshot, scope, countries),
      status: "snapshot",
      asOf: samSnapshot.asOf,
      query: samSnapshot.query,
      queryTotal: samSnapshot.queryTotal,
      hasNext: samSnapshot.hasNext,
      withheldRecords: samSnapshot.withheldRecords,
      capped: samSnapshot.capped,
    };
  render();
  focusCountry();
  await Promise.allSettled(
    [...enabled]
      .filter((id) => !["sam", "exclusions"].includes(id))
      .map((id) => loadLayer(id, 1, token)),
  );
  samClient?.countryChanged();
}
async function loadHostedSAM(token) {
  try {
    const manifest = await json("ocs-atlas/data/sam/manifest.json", {
      signal: controller.signal,
    });
    if (token !== generation) return;
    if (!manifest.countries?.includes(scope.country)) return;
    const data = await json("ocs-atlas/data/sam/" + scope.country + ".json", {
      signal: controller.signal,
    });
    if (token !== generation) return;
    samSnapshot = validateSnapshot(data);
    layerData.sam = {
      rows: samRowsForScope(samSnapshot, scope, countries),
      status: "snapshot",
      asOf: samSnapshot.asOf,
      query: samSnapshot.query,
      queryTotal: samSnapshot.queryTotal,
      hasNext: samSnapshot.hasNext,
      withheldRecords: samSnapshot.withheldRecords,
      capped: samSnapshot.capped,
    };
    render();
  } catch {
    /* No hosted public snapshot is a distinct not-connected state. */
  }
}
function saveSupplier(s) {
  if (!s) return;
  s = { ...s, rows: programs?.enrich(s.rows) || s.rows };
  if (saved[s.key]) delete saved[s.key];
  else
    saved[s.key] = {
      key: s.key,
      rows: s.rows,
      note: researchNotes.get(s.key) || "",
      researchCoverage: s.researchCoverage,
      savedAt: new Date().toISOString(),
    };
  persist();
  render();
}
function openSupplier(s) {
  s = { ...s, rows: programs?.enrich(s.rows) || s.rows };
  if (samProfiles.has(s.uei))
    s = { ...s, rows: dedupe([...s.rows, ...samProfiles.get(s.uei)]) };
  const known = profiles.get(profileKey(s));
  if (known?.rows.length)
    s = {
      ...s,
      rows: dedupe([...s.rows, ...known.rows]),
      researchCoverage: {
        scope: {
          ...scope,
          country: "ALL",
          q: "",
          naics: "",
          psc: "",
          recipientUEI: s.uei,
        },
        pages: known.page,
        hasMore: known.hasNext,
        retrievedAt: known.retrievedAt,
      },
    };
  profileController.abort();
  profileController = new AbortController();
  activeSupplier = s;
  $("supplierDetail").innerHTML =
    `<h2>${esc(s.name)}</h2><div class="detail-meta"><span class="tag">${s.uei ? "UEI " + esc(s.uei) : "UEI not reported"}</span><span class="tag">${esc(cname(s.origin))}</span><span class="tag">${s.rows.length} evidence records</span></div><p class="muted small" style="margin-top:13px">${s.uei ? "Records joined by exact UEI." : "Name-only records have not been joined across sources."} Addresses describe reported locations, not ownership or installation access.</p><div class="detail-actions"><button id="detailSave" class="primary">${saved[s.key] ? "Remove from shortlist" : "Save to shortlist"}</button><button id="gleifButton" class="secondary">Find possible GLEIF matches</button><a class="secondary" style="padding:9px 13px;border-radius:6px" href="https://sam.gov/search/?index=entity" target="_blank" rel="noopener">Check SAM ↗</a></div><div id="gleifResults"></div><div id="companyProfile"></div><h3>Evidence trail</h3>${s.rows
      .map(
        (r) =>
          `<article class="evidence"><header><span>${esc(LAYERS[r.layer]?.name || r.layer)}</span><span>${esc(r.source)}</span></header><h4>${esc(r.identifier || "Registration record")}</h4><p>${esc(r.description || "No description reported.")}</p><dl class="facts">${Object.entries(
            {
              Buyer: r.agency,
              "Exclusion type": r.exclusionType,
              "Exclusion program": r.exclusionProgram,
              "Excluding agency": r.excludingAgency,
              "FASCSA order": r.fascsaOrder,
              "Reported amount (USD)":
                r.amount !== null && r.amount !== undefined
                  ? money(r.amount)
                  : "",
              [r.layer === "sam" ? "Registration date" : "Start / report date"]:
                r.date,
              "End / last ordering date": r.end,
              "Recipient location": [
                r.city,
                r.region,
                r.postalCode,
                cname(r.origin),
              ]
                .filter(Boolean)
                .join(", "),
              "Recorded work location": r.performanceCountry
                ? [
                    r.performanceCity,
                    r.performanceState,
                    r.performancePostalCode,
                    cname(r.performanceCountry),
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "",
              "NAICS / PSC": [r.naics, r.psc].filter(Boolean).join(" / "),
              "Prime contractor": r.primeName,
              "Prime UEI": r.primeUEI,
              "Prime award": r.primeID,
              "SAM status": r.status,
              "SAM search criteria": r.samQuery
                ? samQueryLabel(r.samQuery)
                : "",
              "Registration expires": r.expiration,
              Purpose: r.purpose,
              "Exclusion flag (snapshot)": r.exclusion,
              "Retrieved / snapshot": r.retrievedAt?.slice(0, 10),
              "Search country": r.scope ? cname(r.scope.country) : "",
              "Search window": r.scope ? r.scope.from + " → " + r.scope.to : "",
              "Source search keyword": ["sam", "exclusions"].includes(r.layer)
                ? ""
                : r.scope?.q || "Any",
              "Source search NAICS / PSC": r.scope
                ? [r.scope.naics || "Any NAICS", r.scope.psc || "Any PSC"].join(
                    " / ",
                  )
                : "",
            },
          )
            .filter(([, v]) => v)
            .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
            .join(
              "",
            )}</dl><a href="${esc(safeURL(r.url) || "https://www.usaspending.gov/search")}" target="_blank" rel="noopener">${["sam", "exclusions"].includes(r.layer) ? "Open SAM search; verify company identity" : r.url?.endsWith("/search") ? "Open source search; use award identifier" : "Open source record"} ↗</a>${r.layer === "subawards" ? '<p class="small muted" style="margin-top:8px">Subaward descriptions and reporting may be incomplete. A subcontract does not establish physical presence at a site.</p>' : ""}</article>`,
      )
      .join("")}`;
  renderCompanyProfile(s);
  if (saved[s.key] && known?.rows.length) {
    $("detailSave").textContent = "Update saved evidence";
  }
  $("detailSave").onclick = () => {
    if (saved[s.key] && known?.rows.length) {
      saved[s.key] = {
        ...saved[s.key],
        key: s.key,
        rows: s.rows,
        researchCoverage: s.researchCoverage,
        savedAt: new Date().toISOString(),
      };
      persist();
      render();
      $("detailSave").textContent = "Saved updated evidence";
      return;
    }
    saveSupplier(s);
    $("detailSave").textContent = saved[s.key]
      ? "Remove from shortlist"
      : "Save to shortlist";
  };
  $("gleifButton").onclick = async () => {
    const target = $("gleifResults");
    target.innerHTML =
      '<p class="muted small" style="margin-top:16px">Looking up possible legal-entity matches…</p>';
    $("gleifButton").disabled = true;
    try {
      const u = new URL("https://api.gleif.org/api/v1/lei-records");
      u.searchParams.set("filter[fulltext]", s.name);
      u.searchParams.set("page[size]", "5");
      const data = await json(u);
      if (activeSupplier !== s) return;
      if (!Array.isArray(data.data)) throw new Error("Unexpected response.");
      target.innerHTML =
        '<h3>Possible identity matches</h3><p class="muted small">Name search only. Check identifiers and jurisdiction before linking any entity. No matches is not an adverse finding.</p>' +
        (data.data.length
          ? data.data
              .map(
                (r) =>
                  `<div class="gleif-card"><strong>${esc(r.attributes?.entity?.legalName?.name || r.id)}</strong><p>${esc(r.attributes?.entity?.legalAddress?.country || "")} · LEI ${esc(r.id)}</p><a href="https://search.gleif.org/#/record/${encodeURIComponent(r.id)}" target="_blank" rel="noopener">Review identity and reported relationships ↗</a></div>`,
              )
              .join("")
          : '<p class="muted small">No matches returned by GLEIF.</p>');
    } catch {
      if (activeSupplier === s)
        target.innerHTML =
          '<p class="notice">GLEIF lookup is unavailable. <a href="https://search.gleif.org/" target="_blank" rel="noopener">Open the official search ↗</a></p>';
    } finally {
      if (activeSupplier === s) $("gleifButton").disabled = false;
    }
  };
  if (!$("supplierDialog").open) $("supplierDialog").showModal();
}
function renderCoverage() {
  $("coverage").innerHTML =
    Object.entries(LAYERS)
      .map(
        ([id, l]) =>
          `<div class="coverage-row"><strong>${esc(l.name)}</strong><span>${esc(statusText(id))}</span><p style="grid-column:1/-1">${esc(l.note)} ${esc(layerData[id]?.error || "")} ${id === "sam" ? "SAM filters cover registered country, name, NAICS, and PSC; federal buyer and award dates do not filter registrations." : ""}</p></div>`,
      )
      .join("") +
    '<p class="muted small">USAspending: 100 records per request, newest start/report dates first; load additional pages explicitly. Keyword search is the source’s broad search, not a capability certification. No amount totals combine prime awards, subawards, and vehicles. Civilian-only searches remove DoD records from retrieved pages.</p>';
  $("coverage").innerHTML +=
    '<div class="coverage-row"><strong>Airfields &amp; ports</strong><span>Connected · public snapshots</span><p style="grid-column:1/-1">OurAirports global aviation directory and UNECE UN/LOCODE maritime trade locations (pre-release). Enable logistics layers to see retrieval dates, directory counts and missing coordinates. Independent of award filters. <a href="ocs-atlas/data/logistics/SOURCES.md" target="_blank" rel="noopener">Source and transformation details ↗</a></p></div>';
  $("sourceLibrary").innerHTML = RESEARCH_SOURCES.filter(
    (s) => !s.countries || s.countries.includes(scope.country),
  )
    .map(
      (s) =>
        `<div class="source-card"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a><small>${esc(s.access)} · ${esc(s.group)}</small><p>${esc(s.note)}</p></div>`,
    )
    .join("");
}
function countBy(rows, get) {
  const counts = new Map();
  for (const r of rows) {
    const k = get(r);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
}
function bars(items) {
  const max = items[0]?.[1] || 1;
  return items.length
    ? items
        .map(
          ([k, n]) =>
            `<div class="bar-row"><div class="bar-label"><span>${esc(k)}</span><b>${n}</b></div><div class="bar"><span style="width:${(100 * n) / max}%"></span></div></div>`,
        )
        .join("")
    : '<p class="muted">No values in these loaded records.</p>';
}
function renderInsights(list) {
  const rows = list
    .flatMap((s) => s.rows)
    .filter((r) => onlySaved || programs?.active() || enabled.has(r.layer));
  const prime = rows.filter((r) => r.layer === "awards");
  const relationships = rows.filter(
    (r) => r.layer === "subawards" && r.primeName,
  );
  const uniqueRel = [
    ...new Map(
      relationships.map((r) => [r.primeName + "|" + r.name, r]),
    ).values(),
  ].slice(0, 5);
  $("insights").innerHTML =
    `<div class="insight-card"><h3>Buyers in the evidence</h3>${bars(countBy(prime, (r) => r.agency))}<p class="muted">Loaded prime-award record counts, by awarding agency.</p></div><div class="insight-card"><h3>Capability codes</h3>${bars(countBy(prime, (r) => r.naics))}<p class="muted">Reported NAICS on loaded prime awards; not verified current capabilities.</p></div><div class="insight-card"><h3>Prime → subcontractor leads</h3>${uniqueRel.length ? uniqueRel.map((r) => `<div class="relationship">${esc(r.primeName)}<span>→</span>${esc(r.name)}</div>`).join("") : '<p class="muted">Load the subcontract layer to explore reported relationships. Missing relationships may reflect reporting gaps.</p>'}</div><div class="insight-card"><h3>Record recency</h3>${bars(
      countBy(
        rows.filter((r) => !["sam", "exclusions"].includes(r.layer)),
        (r) => r.date?.slice(0, 4),
      ),
    )}<p class="muted">Start/report years in loaded records. Future performance starts can appear within the search window.</p></div><div class="insight-card"><h3>Repeat supplier leads</h3>${bars(
      list
        .slice()
        .sort((a, b) => b.rows.length - a.rows.length)
        .slice(0, 5)
        .map((s) => [s.name, s.rows.length]),
    )}<p class="muted">Record counts across selected layers; not a market-share measure.</p></div><div class="insight-card"><h3>Coverage gaps</h3><p class="muted">${list.filter((s) => !s.uei).length} suppliers without UEI.<br>${list.filter((s) => !s.origin).length} suppliers with unknown or conflicting origin.<br>${Object.values(layerData).filter((d) => d.hasNext).length} sources have more pages.<br>${layerRows().filter((r) => r.aggregate).length} generic recipient records excluded from company leads.<br>Host-government award data: not connected.<br>SAM registrations: ${samSnapshot ? "snapshot loaded" : "not connected"}.</p></div>`;
}
function initMap() {
  if (!window.maplibregl) {
    mapFailed();
    return;
  }
  try {
    map = new maplibregl.Map({
      container: "map",
      cooperativeGestures: true,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [45, 24],
      zoom: 3,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    const failTimer = setTimeout(() => {
      if (!mapReady) mapFailed();
    }, 25000);
    map.on("load", () => {
      clearTimeout(failTimer);
      mapReady = true;
      $("mapFallback").hidden = true;
      for (const id of [
        "atlas-flow",
        "atlas-origins",
        "atlas-target",
        "atlas-global",
      ])
        map.addSource(id, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      map.addLayer({
        id: "atlas-global",
        type: "circle",
        source: "atlas-global",
        paint: {
          "circle-color": "#d99824",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "scale"],
            0,
            5,
            6,
            9,
            9,
            25,
            12,
            38,
          ],
          "circle-opacity": 0.4,
          "circle-stroke-color": "#99752c",
          "circle-stroke-width": 1,
        },
      });
      map.on("click", "atlas-global", (e) => {
        if (
          map.queryRenderedFeatures(e.point, {
            layers: ["logistics-airfields", "logistics-ports"],
          }).length
        )
          return;
        if (
          map.queryRenderedFeatures(e.point, { layers: ["atlas-origins"] })
            .length
        )
          return;
        const p = e.features[0].properties;
        supplierPopup = new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            "<strong>" +
              esc(cname(p.code)) +
              "</strong><p>" +
              esc(money(p.amount)) +
              " net contract obligations</p><p>Reported work country · selected dates and capability filters.</p>",
          )
          .addTo(map);
      });
      map.addLayer({
        id: "atlas-flow",
        type: "line",
        source: "atlas-flow",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
          "line-opacity": 0.8,
          "line-dasharray": [2, 3],
        },
      });
      map.addLayer({
        id: "atlas-origins",
        type: "circle",
        source: "atlas-origins",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1,
            7,
            30,
            21,
            100,
            30,
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "coarse"], true],
            0.28,
            0.9,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": [
            "case",
            ["==", ["get", "coarse"], true],
            ["get", "color"],
            "#fff",
          ],
        },
      });
      map.addLayer({
        id: "atlas-target",
        type: "circle",
        source: "atlas-target",
        paint: {
          "circle-color": "#143b46",
          "circle-radius": 6,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#e8b64e",
        },
      });
      map.on("click", "atlas-origins", (e) => {
        if (
          map.queryRenderedFeatures(e.point, {
            layers: ["logistics-airfields", "logistics-ports"],
          }).length
        )
          return;
        if (e.features.some((f) => f.properties.flowId)) {
          showFlowPopup(
            e.features.map((f) => f.properties.flowId).filter(Boolean),
            e.lngLat,
          );
          return;
        }
        const p = e.features[0].properties;
        const box = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = p.label;
        box.append(title);
        const desc = document.createElement("p");
        desc.textContent = `${p.role === "work" ? "Reported work" : "Vendor address"} · ${p.precision} · ${p.count} evidence records. GeoNames reference; not an exact site.`;
        const hits = e.features.map((f) => f.properties);
        if (hits.length > 1)
          desc.textContent =
            hits
              .map(
                (h) =>
                  `${h.label}: ${h.role === "work" ? "reported work" : "vendor address"} · ${h.precision} · ${h.count} records`,
              )
              .join("; ") + ". GeoNames reference points, not exact sites.";
        box.append(desc);
        const keys = [...new Set(hits.flatMap((h) => JSON.parse(h.keys)))];
        const list = visibleSuppliers();
        for (const key of keys) {
          const supplier = list.find((s) => s.key === key);
          if (!supplier) continue;
          const btn = document.createElement("button");
          btn.textContent = supplier.name;
          btn.style.cssText = "display:block;font-size:11px;margin:6px 0";
          btn.onclick = () => openSupplier(supplier);
          box.append(btn);
        }
        supplierPopup = new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setDOMContent(box)
          .addTo(map);
      });
      map.on("click", "atlas-flow", (e) => {
        if (
          map.queryRenderedFeatures(e.point, {
            layers: ["atlas-origins", "logistics-airfields", "logistics-ports"],
          }).length
        )
          return;
        showFlowPopup(
          e.features.map((f) => f.properties.flowId),
          e.lngLat,
        );
      });
      map.on(
        "mouseenter",
        "atlas-flow",
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        "atlas-flow",
        () => (map.getCanvas().style.cursor = ""),
      );
      map.on(
        "mouseenter",
        "atlas-origins",
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        "atlas-origins",
        () => (map.getCanvas().style.cursor = ""),
      );
      logistics.attachMap();
      transport.attachMap();
      countryNavigation = initCountryNavigation({
        map,
        countries,
        request: json,
        getSelected: () => scope.country,
        onSelect: async (code) => {
          $("country").value = code;
          await search();
          $("country").value = scope.country;
        },
        onStatus: (message) => {
          $("countryMapHint").textContent = message;
        },
      });
      updateMap(visibleSuppliers());
      focusCountry();
    });
    map.on("error", (event) => {
      console.warn(
        "Atlas map:",
        event.error?.message || "A map resource is unavailable.",
      );
    });
  } catch {
    mapFailed();
  }
}
function mapFailed() {
  $("mapFallback").hidden = false;
  $("mapFallback").textContent =
    "The background map is unavailable in this browser or network. Country filters, supplier lists, patterns, and exports remain available.";
}
function updateMap(list) {
  if (!mapReady) return;
  const target = currentCountry()?.latlng;
  if (!target) return;
  const counts = new Map();
  for (const s of list)
    if (s.origin) counts.set(s.origin, (counts.get(s.origin) || 0) + 1);
  map.getSource("atlas-global").setData({
    type: "FeatureCollection",
    features: globalOn
      ? (globalData || [])
          .filter((r) => r.amount > 0 && country(r.country)?.latlng)
          .map((r) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                country(r.country).latlng[1],
                country(r.country).latlng[0],
              ],
            },
            properties: {
              code: r.country,
              amount: r.amount,
              scale: Math.max(0, Math.log10(r.amount)),
            },
          }))
      : [],
  });
  return updatePlaces(list);
}
const placeCache = new Map();
let placeRun = 0,
  mappedFeatures = [];
async function placeData(code) {
  const cc = country(countryCode(code, countries))?.iso2;
  if (!cc) return null;
  if (!placeCache.has(cc))
    placeCache.set(
      cc,
      (async () => {
        const res = await fetch(`ocs-atlas/data/places/${cc}.json.gz`, {
          signal: AbortSignal.timeout(40000),
        });
        if (!res.ok) throw new Error("Reference unavailable");
        return new Response(
          res.body.pipeThrough(new DecompressionStream("gzip")),
        ).json();
      })().catch(() => {
        placeCache.delete(cc);
        return null;
      }),
    );
  return placeCache.get(cc);
}
async function updatePlaces(list) {
  supplierPopup?.remove();
  $("fitMap").disabled = true;
  const token = ++placeRun;
  const role = $("locationRole").value;
  $("locationLegend").textContent =
    role === "flow"
      ? "Teal: in-country · Blue: U.S. origin abroad · Purple: other foreign origin. Faded endpoints are country-only reference points; click for precision and source records."
      : "Teal: vendor address · Purple: reported work. Approximate city / postal points, never exact company sites. Unmatched records stay in the list.";
  $("flowControls").hidden = role !== "flow";
  const roles =
    role === "both" || role === "flow" ? ["vendor", "work"] : [role];
  const pending = list.flatMap((s) =>
    s.rows.flatMap((row) =>
      roles.map((role) => ({
        row,
        key: s.key,
        role,
        address: recordAddress(row, role),
      })),
    ),
  );
  $("locationCoverage").textContent =
    "Matching reported city and postal locations…";
  // Clear stale source points while the newly selected source is resolving.
  mappedFeatures = [];
  for (const id of ["atlas-origins", "atlas-target", "atlas-flow"])
    map.getSource(id).setData({ type: "FeatureCollection", features: [] });
  const codes = [
    ...new Set(pending.map((p) => p.address.country).filter(Boolean)),
  ];
  const data = new Map();
  // Bound concurrent local reads for broad worldwide program rosters.
  for (let i = 0; i < codes.length; i += 8) {
    await Promise.all(
      codes
        .slice(i, i + 8)
        .map(async (code) => data.set(code, await placeData(code))),
    );
    if (token !== placeRun) return;
  }
  if (role === "flow") {
    facilityPromise ||= json("ocs-atlas/data/logistics/airfields.json")
      .then((d) => d.rows)
      .catch(() => []);
    const facilities = await facilityPromise;
    if (token !== placeRun) return;
    const result = contractorFlows(list, countries, data, facilities);
    flowGroups = result.groups;
    const prior = $("flowFocus").value;
    const names = new Map(flowGroups.map((g) => [g.supplierKey, g.name]));
    $("flowFocus").innerHTML =
      '<option value="">All contractor connections</option>' +
      [...names]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(
          ([key, name]) => `<option value="${esc(key)}">${esc(name)}</option>`,
        )
        .join("");
    if (names.has(prior)) $("flowFocus").value = prior;
    const shown = flowGroups.filter(
      (g) => !$("flowFocus").value || g.supplierKey === $("flowFocus").value,
    );
    $("flowSummary").textContent = $("flowFocus").value
      ? shown
          .map(
            (g) =>
              `${g.name}: ${g.origin.label} (${g.origin.countryName}) → ${g.work.label} (${g.work.countryName}) · ${g.rows.length} award records`,
          )
          .join("; ")
      : "";
    const lines = shown
      .filter((g) =>
        g.origin.coordinates.some((v, i) => v !== g.work.coordinates[i]),
      )
      .map((g) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: connectionCoordinates(
            g.origin.coordinates,
            g.work.coordinates,
          ),
        },
        properties: { flowId: g.id, color: g.color },
      }));
    mappedFeatures = shown.flatMap((g) =>
      ["origin", "work"].map((role) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: g[role].coordinates },
        properties: {
          flowId: g.id,
          label: g.name + " · " + g[role].label,
          role: role === "origin" ? "vendor" : "work",
          precision: g[role].precision,
          count: g.rows.length,
          color: g.color,
          coarse: g[role].reference.startsWith("country:"),
        },
      })),
    );
    // Registrations and bare vehicles have addresses but cannot establish work.
    if (!result.eligible)
      for (const s of list)
        for (const row of s.rows) {
          const address = recordAddress(row, "vendor"),
            p = resolvePlace(address, data.get(address.country));
          if (p)
            mappedFeatures.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: p.coordinates },
              properties: {
                ...p,
                role: "vendor",
                count: 1,
                keys: JSON.stringify([s.key]),
                color: "#199e8a",
              },
            });
        }
    map
      .getSource("atlas-flow")
      .setData({ type: "FeatureCollection", features: lines });
    map
      .getSource("atlas-origins")
      .setData({ type: "FeatureCollection", features: mappedFeatures });
    $("fitMap").disabled = !mappedFeatures.length;
    const coarse = shown.filter((g) =>
      g.work.reference.startsWith("country:"),
    ).length;
    $("locationCoverage").textContent = result.eligible
      ? `${shown.length} contractor connections · ${coarse} end at a country-only reference · ${result.missing} award records lack a usable origin or work country. Click a line or endpoint for dates and evidence.`
      : "Address points only. No task-order or award work location is loaded for these records. Registration, exclusion records and parent vehicles do not establish country work.";
    return;
  }
  const groups = new Map();
  let placed = 0;
  for (const item of pending) {
    const p = resolvePlace(item.address, data.get(item.address.country));
    if (!p) continue;
    placed++;
    const id = item.role + "|" + item.address.country + "|" + p.reference;
    if (!groups.has(id))
      groups.set(id, { p, role: item.role, keys: new Set(), count: 0 });
    const g = groups.get(id);
    g.keys.add(item.key);
    g.count++;
  }
  mappedFeatures = [...groups.values()].map((g) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: g.p.coordinates },
    properties: {
      ...g.p,
      role: g.role,
      count: g.count,
      keys: JSON.stringify([...g.keys]),
      color: g.role === "work" ? "#8f62c5" : "#199e8a",
    },
  }));
  map
    .getSource("atlas-origins")
    .setData({ type: "FeatureCollection", features: mappedFeatures });
  $("fitMap").disabled = !mappedFeatures.length;
  $("locationCoverage").textContent =
    `${placed} of ${pending.length} record locations mapped · ${pending.length - placed} unplaced (missing, ambiguous or outside reference coverage).`;
}
function showFlowPopup(ids, lngLat) {
  const groups = [...new Set(ids)]
    .map((id) => flowGroups.find((g) => g.id === id))
    .filter(Boolean);
  if (!groups.length) return;
  supplierPopup?.remove();
  const box = document.createElement("div");
  box.innerHTML = groups
    .map(
      (g) =>
        `<article><strong>${esc(g.name)}</strong><p><b>Address:</b> ${esc(g.origin.label)}, ${esc(g.origin.countryName)}<br>${esc(g.origin.precision)}</p><p><b>Reported work:</b> ${esc(g.work.label)}, ${esc(g.work.countryName)}<br>${esc(g.work.precision)}</p>${g.work.match ? `<p>${esc(g.work.match)}. <a href="${esc(g.work.sourceURL)}" target="_blank" rel="noopener">Facility reference</a> · <a href="${esc(g.work.proofURL)}" target="_blank" rel="noopener">Name evidence</a></p>` : ""}<p>${g.rows.length} linked evidence records. Dates indicate reported periods, not verified current performance.</p>${g.rows
          .slice(0, 10)
          .map(
            (r) =>
              `<p><a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener">${esc(r.identifier)}</a> · ${esc(r.programVersion || LAYERS[r.layer]?.name)}<br>${esc(r.date || "?")} → ${esc(r.end || "?")}<br>${esc(dateStatus(r))}</p>`,
          )
          .join(
            "",
          )}${g.rows.length > 10 ? "<p>First 10 shown; open company evidence for all loaded records.</p>" : ""}<button data-flow-zoom="${esc(g.id)}">Zoom to work location</button><button data-flow-company="${esc(g.supplierKey)}">Open company evidence</button></article>`,
    )
    .join("<hr>");
  box.querySelectorAll("[data-flow-company]").forEach(
    (b) =>
      (b.onclick = () => {
        const s = visibleSuppliers().find(
          (s) => s.key === b.dataset.flowCompany,
        );
        if (s) openSupplier(s);
      }),
  );
  box.querySelectorAll("[data-flow-zoom]").forEach(
    (b) =>
      (b.onclick = () => {
        const g = groups.find((g) => g.id === b.dataset.flowZoom);
        if (g) {
          supplierPopup?.remove();
          map.flyTo({
            center: g.work.coordinates,
            zoom: g.work.reference.startsWith("country:") ? 4 : 10,
            duration: 650,
          });
        }
      }),
  );
  supplierPopup = new maplibregl.Popup({ maxWidth: "340px" })
    .setLngLat(lngLat)
    .setDOMContent(box)
    .addTo(map);
}
async function findPlace() {
  const code = scope.country,
    q = $("placeQuery").value.trim();
  if (!q) {
    $("placeStatus").textContent =
      "Enter a city or postal code in the research country.";
    return;
  }
  const data = await placeData(code);
  if (code !== scope.country || q !== $("placeQuery").value.trim()) return;
  const p =
    resolvePlace({ city: q }, data) || resolvePlace({ postal: q }, data);
  $("placeStatus").textContent = p
    ? `${p.label} · ${p.precision}. Map focus only; supplier results are unchanged.`
    : "No unique match in this country’s reference data. Try a city name.";
  if (p && mapReady)
    map.flyTo({ center: p.coordinates, zoom: 10, duration: 650 });
}

function focusCountry() {
  if (mapReady && currentCountry()?.latlng)
    map.flyTo({
      center: [currentCountry().latlng[1], currentCountry().latlng[0]],
      zoom: scope.country === "USA" ? 2.5 : 3.4,
      duration: 600,
    });
}
function fitMap() {
  if (!mapReady || !mappedFeatures.length) return;
  const bounds = new maplibregl.LngLatBounds();
  mappedFeatures.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 600 });
}
function packetSearch() {
  if (programs?.isBusy())
    throw new Error(
      "Let the linked-order check finish before capturing evidence.",
    );
  if (samClient?.isBusy())
    throw new Error(
      "Let the SAM registration search finish before capturing its evidence.",
    );
  if (onlySaved)
    throw new Error(
      "Switch to country results to capture a search. The packet already includes your shortlist.",
    );
  return {
    scope,
    rows: visibleSuppliers().flatMap((s) => s.rows),
    filters: {
      text: $("localFilter").value,
      segment,
      origin: originFilter,
      layers: [...enabled],
      supplierSource: activeSource,
      mapLocationRole: $("locationRole").value,
      mapContractor:
        $("locationRole").value === "flow" ? $("flowFocus").value : "",
      contractPrograms: programs?.selection(),
    },
    capability:
      capabilitySearch?.key === searchCacheKey(scope)
        ? capabilitySearch.name
        : null,
    coverage: {
      ...(programs?.active() ? { programs: programs.coverage() } : {}),
      ...Object.fromEntries(
        [...enabled].map((k) => [
          k,
          {
            status: layerData[k]?.status || "not connected",
            loaded: layerData[k]?.rows?.length || 0,
            hasMore:
              typeof layerData[k]?.hasNext === "boolean"
                ? layerData[k].hasNext
                : null,
            error: layerData[k]?.error || "",
            retrievedAt:
              layerData[k]?.retrievedAt || layerData[k]?.asOf || null,
            query:
              layerData[k]?.query || (k === "sam" ? samSnapshot?.query : null),
            queryTotal: layerData[k]?.queryTotal,
            withheldRecords: layerData[k]?.withheldRecords,
            capped: layerData[k]?.capped,
          },
        ]),
      ),
    },
  };
}
function rerunScope(next) {
  for (const k of ["country", "q", "naics", "psc", "agency", "from", "to"])
    $(k).value = next[k] || "";
  search();
}
function renderCapabilities() {
  $("capabilityPresets").innerHTML = CAPABILITIES.map(
    (p) =>
      `<button type="button" data-capability="${p.id}" class="${selectedCapability === p.id ? "primary" : "secondary"}" aria-pressed="${selectedCapability === p.id}">${esc(p.name)}</button>`,
  ).join("");
  $("capabilityPresets")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          selectedCapability = b.dataset.capability;
          renderCapabilities();
        }),
    );
  const p = CAPABILITIES.find((p) => p.id === selectedCapability);
  $("capabilityRecipe").innerHTML = p
    ? `<h3>${esc(p.name)}</h3><p class="muted small">Run one search at a time. Each shortcut replaces keyword, NAICS and PSC; country, dates and buyer filters stay as shown below. Industry searches are deliberately broad and do not establish capability.</p><div class="recipe-buttons">${p.terms.map((t) => `<button class="secondary" data-term="${esc(t)}">Search “${esc(t)}”</button>`).join("")}${p.industries.map(([code, label]) => `<button class="secondary" data-industry="${code}">NAICS ${code} · ${esc(label)}</button>`).join("")}</div><p class="muted small">${esc(p.questions.join(" "))} ${p.industries.length ? `<a href="${NAICS_SOURCE}" target="_blank" rel="noopener">2022 NAICS definitions ↗</a>` : ""}</p>`
    : '<p class="muted small">Select a capability to see suggested search terms and related industries. Custom keyword, NAICS and PSC searches remain available below.</p>';
  $("capabilityRecipe")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          try {
            const next = capabilityScope(
              formScope(),
              p.id,
              b.dataset.term ? "keyword" : "naics",
              b.dataset.term || b.dataset.industry,
            );
            capabilitySearch = { key: searchCacheKey(next), name: p.name };
            rerunScope(next);
          } catch (e) {
            notify(e.message);
          }
        }),
    );
}
function bind() {
  programs = initPrograms({
    getScope: () => scope,
    request: json,
    onChange: render,
  });
  samClient = initSAM({
    getCountry: currentCountry,
    isActive: () => activeSource === "sam",
    onLoading: (kind) => {
      supplierPopup?.remove();
      if ($("supplierDialog").open) $("supplierDialog").close();
      enabled = new Set([kind]);
      layerData[kind] = { rows: [], status: "loading" };
      render();
    },
    onError: (kind, error, retained) => {
      layerData[kind] = {
        ...layerData[kind],
        status: retained ? "ready" : "error",
        error,
      };
      render();
    },
    onResults: (snapshot) => {
      const kind = snapshot.kind === "exclusions" ? "exclusions" : "sam";
      if (kind === "sam") samSnapshot = snapshot;
      samIsImported = false;
      // Background SAM results never change the selected supplier source.
      layerData[kind] = {
        rows: snapshot.rows,
        status: "ready",
        hasNext: snapshot.hasNext,
        retrievedAt: snapshot.retrievedAt,
        query: snapshot.query,
        queryTotal: snapshot.queryTotal,
        withheldRecords: snapshot.withheldRecords,
        capped: snapshot.capped,
      };
      render();
    },
  });
  $("supplierDialog").addEventListener("close", () => {
    profileController.abort();
    activeSupplier = null;
  });
  logistics = initLogistics({
    getCountry: currentCountry,
    getMap: () => map,
    exportFile,
    onExplore: (point) => transport.explore(point),
  });
  transport = initTransport({
    getMap: () => map,
    getCountry: currentCountry,
    exportFile,
  });
  packet = initPacket({
    getSearch: packetSearch,
    getSaved: () => saved,
    getCountries: () => countries,
    getLogistics: () => logistics.capture(),
    getTransport: () => transport.capture(),
    exportFile,
    onRestore: rerunScope,
  });
  renderCapabilities();
  $("loadHistory").onclick = loadHistory;
  $("stopHistory").onclick = () => {
    if (historyRun) historyRun.stop = true;
  };
  $("restoreHistory").onclick = restoreSearch;
  $("compareSaved").onclick = openComparison;
  $("globalToggle").onchange = () => {
    globalOn = $("globalToggle").checked;
    if (globalOn && !globalData) loadGlobal();
    updateMap(visibleSuppliers());
  };
  $("searchForm").onsubmit = (e) => {
    e.preventDefault();
    search();
  };
  $("country").onchange = () => search();
  $("locationRole").onchange = () => updateMap(visibleSuppliers());
  $("flowFocus").onchange = async () => {
    await updateMap(visibleSuppliers());
    fitMap();
  };
  $("findPlace").onclick = findPlace;
  $("placeQuery").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      findPlace();
    }
  };
  $("localFilter").oninput = render;
  $("fitMap").onclick = fitMap;
  $("searchForm").addEventListener("change", (e) => {
    if (e.target.id !== "country")
      notify("Filters changed. Select Search this source to apply them.");
  });
  $("segments")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          segment = b.dataset.segment;
          originFilter = "";
          render();
        }),
    );
  $("shortlistToggle").onclick = () => {
    onlySaved = !onlySaved;
    segment = "all";
    originFilter = "";
    $("localFilter").value = "";
    render();
  };
  for (const id of ["map", "insights"])
    $(id + "Tab").onclick = () => {
      for (const v of ["map", "insights"]) {
        $(v + "Panel").hidden = v !== id;
        $(v + "Tab").setAttribute("aria-pressed", String(v === id));
      }
      if (id === "map") map?.resize();
      document
        .querySelector(".content")
        .scrollTo({ top: 0, behavior: "smooth" });
    };
  $("coverageButton").onclick = () => {
    renderCoverage();
    $("coverageDialog").showModal();
  };
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
  $("exportCSV").onclick = () => {
    const rows = dedupe(
      visibleSuppliers()
        .flatMap((s) => s.rows)
        .filter((r) => onlySaved || programs?.active() || enabled.has(r.layer)),
    );
    if (!rows.length) return;
    exportFile(
      "ocs-evidence-" + scope.country + ".csv",
      csv(rows),
      "text/csv;charset=utf-8",
    );
  };
  $("exportJSON").onclick = () =>
    exportFile(
      "ocs-shortlist-" + scope.country + ".json",
      JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          currentScope: scope,
          suppliers: Object.values(saved),
          coverage: Object.fromEntries(
            Object.entries(layerData).map(([k, d]) => [
              k,
              {
                status: d.status,
                loaded: d.rows?.length || 0,
                hasMore: !!d.hasNext,
              },
            ]),
          ),
          note: "Public-source research leads. No installation-access, capability, or eligibility determination.",
        },
        null,
        2,
      ),
      "application/json",
    );
  $("samImport").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 100 * 1024 * 1024)
        throw new Error("Choose a country snapshot smaller than 100 MB.");
      samSnapshot = validateSnapshot(JSON.parse(await f.text()));
      samIsImported = true;
      samClient.suspend();
      await selectSource("sam", { skipSAM: true });
      $("samMode").value = "sam";
      $("samRegistrationFilters").hidden = false;
      $("samExclusionNote").hidden = true;
      $("samSearchStatus").textContent =
        "Imported public snapshot displayed. Change a SAM filter to return to automatic live discovery.";
      $("samMore").disabled = true;
      $("samRetry").hidden = true;
      for (const id of ["samIndustry", "samNAICS", "samPSC", "samExpired"])
        $(id).disabled = false;
      enabled = new Set(["sam"]);
      layerData.sam = {
        rows: samRowsForScope(samSnapshot, scope, countries),
        status: "snapshot",
        asOf: samSnapshot.asOf,
        query: samSnapshot.query,
        queryTotal: samSnapshot.queryTotal,
        hasNext: samSnapshot.hasNext,
        withheldRecords: samSnapshot.withheldRecords,
        capped: samSnapshot.capped,
      };
      render();
      renderCoverage();
      notify(
        "PUBLIC SAM snapshot loaded for this session. Award dates and buyer filters do not apply to registrations.",
      );
    } catch (err) {
      notify(err.message);
    }
    e.target.value = "";
  };
}
function cacheSearch() {
  const key = searchCacheKey(scope);
  const data = {
    schemaVersion: 1,
    scope: { ...scope },
    savedAt: new Date().toISOString(),
    layers: Object.fromEntries(
      Object.entries(layerData).filter(
        ([id, d]) =>
          !["sam", "exclusions"].includes(id) && d.status === "ready",
      ),
    ),
  };
  queryCache.set(key, data);
  try {
    localStorage.setItem("kthq-ocs-last-search-v1", JSON.stringify(data));
  } catch {
    $("historyStatus").textContent =
      "Search retained for this session; browser storage is full or unavailable. Export to preserve it.";
  }
  updateCacheButton();
}
function cachedSearch() {
  const key = searchCacheKey(scope);
  if (queryCache.has(key)) return queryCache.get(key);
  try {
    const d = JSON.parse(
      localStorage.getItem("kthq-ocs-last-search-v1") || "null",
    );
    if (
      d?.schemaVersion === 1 &&
      searchCacheKey(d.scope) === key &&
      d.layers &&
      Object.values(d.layers).every(
        (v) => Array.isArray(v.rows) && Number.isInteger(v.page) && v.page >= 1,
      )
    )
      return d;
  } catch {
    /* Optional cache. */
  }
  return null;
}
function updateCacheButton() {
  $("restoreHistory").hidden = !cachedSearch();
}
function restoreSearch() {
  const d = cachedSearch();
  if (!d) return;
  if (historyRun) historyRun.stop = true;
  controller.abort();
  controller = new AbortController();
  ++generation;
  layerData = Object.fromEntries(
    Object.entries(d.layers).map(([id, v]) => [
      id,
      { ...v, status: "snapshot", asOf: d.savedAt },
    ]),
  );
  if (samSnapshot)
    layerData.sam = {
      rows: samRowsForScope(samSnapshot, scope, countries),
      status: "snapshot",
      asOf: samSnapshot.asOf,
      query: samSnapshot.query,
      queryTotal: samSnapshot.queryTotal,
      hasNext: samSnapshot.hasNext,
      withheldRecords: samSnapshot.withheldRecords,
      capped: samSnapshot.capped,
    };
  onlySaved = false;
  $("historyStatus").textContent =
    "Restored saved search from " +
    d.savedAt.slice(0, 19).replace("T", " ") +
    ". Search this source refreshes from page 1.";
  render();
}
async function loadHistory() {
  if (historyRun) return;
  const run = { stop: false, token: generation };
  historyRun = run;
  $("stopHistory").hidden = false;
  render();
  let requests = 0,
    failed = false;
  const ids = [...enabled].filter((id) => !["sam", "exclusions"].includes(id));
  for (const id of ids) {
    for (let n = 0; n < 10; n++) {
      if (run.stop || run.token !== generation || !enabled.has(id)) break;
      const d = layerData[id];
      if (d?.status === "loading" || (d && !d.hasNext && d.status !== "error"))
        break;
      const page =
        d?.status === "error" ? d.failedPage || 1 : (d?.page || 0) + 1;
      $("historyStatus").textContent =
        `Loading ${LAYERS[id].name}, page ${page} · ${requests} additional pages received…`;
      await loadLayer(id, page, run.token);
      if (run.token !== generation) break;
      if (layerData[id]?.status === "error") {
        failed = true;
        break;
      }
      requests++;
    }
  }
  if (run.token === generation)
    $("historyStatus").textContent =
      `${run.stop ? "Stopped" : failed ? "Finished with source errors; retry is available below" : "Finished"} · ${requests} additional pages received. ${ids.some((id) => layerData[id]?.hasNext) ? "More records remain; run again to continue." : "Available pages complete for these sources."}`;
  if (historyRun === run) historyRun = null;
  $("stopHistory").hidden = true;
  render();
}
function profileKey(s) {
  return JSON.stringify([s.uei, scope.from, scope.to, scope.agency]);
}
function renderCompanyProfile(s) {
  const d = profiles.get(profileKey(s));
  const summary = companySummary(s.rows);
  $("companyProfile").innerHTML =
    `<section class="profile-summary"><h3>Company research profile</h3><p><strong>Reported work countries:</strong> ${esc(summary.countries.map(cname).join(", ") || "Not reported")}</p><p><strong>Buyers:</strong> ${esc(summary.buyers.join("; ") || "Not reported")}</p><p><strong>NAICS:</strong> ${esc(summary.naics.join(", ") || "Not reported")} · <strong>PSC:</strong> ${esc(summary.psc.join(", ") || "Not reported")}</p><p><strong>Start / report dates:</strong> ${esc(summary.earliest || "Unknown")} → ${esc(summary.latest || "Unknown")}</p><p class="small muted">${summary.counts.awards} prime awards · ${summary.counts.subawards} reported subcontracts · ${summary.counts.vehicles} vehicles · ${summary.counts.sam} registrations · ${summary.counts.exclusions} exclusion records. ${summary.missingWorkCountry} award/vehicle records lack a reported work country.</p><h3>Expand company history</h3><p class="small muted">Worldwide prime contracts for this exact UEI, ${esc(scope.from)} → ${esc(scope.to)}, ${esc(scope.agency)} buyers. Capability and country restrictions are removed. Records remain separate from the country results; save this profile to preserve them.</p><button id="companyHistory" class="secondary" ${!s.uei || d?.loading || d?.hasNext === false ? "disabled" : ""}>${d?.loading ? "Loading…" : d?.page ? "Load 100 more worldwide awards" : "Find worldwide award history"}</button><p id="companyHistoryStatus" class="small muted" role="status">${!s.uei ? "No exact UEI; verify identity before expanding across countries." : esc(d?.error || (d?.page ? `${d.rows.length} exact-UEI records retrieved · ${d.hasNext ? "more pages available" : "pages complete"} · ${d.retrievedAt}` : "Uses exact returned UEI; similar company names are not merged."))}</p></section>`;
  $("companyProfile").insertAdjacentHTML(
    "afterbegin",
    registrationHTML(s.rows) +
      programEvidenceHTML(s.rows, programs?.catalog() || [], scope.country) +
      `<button id="samRefresh" class="secondary" ${s.uei ? "" : "disabled"}>Check public SAM by UEI</button><p id="samProfileStatus" class="small muted" role="status">Exact-identifier lookup through the shared public SAM connection.</p><label class="research-note">Why this company is a lead / questions to resolve<textarea id="supplierNote" maxlength="4000" rows="3" placeholder="Document the evidence that makes this company worth contacting.">${esc(researchNotes.get(s.key) ?? saved[s.key]?.note ?? "")}</textarea></label><button id="saveSupplierNote" class="secondary">Save note & shortlist evidence</button>`,
  );
  $("supplierNote").oninput = (e) => researchNotes.set(s.key, e.target.value);
  $("saveSupplierNote").onclick = () => {
    saved[s.key] = {
      ...saved[s.key],
      key: s.key,
      rows: dedupe(
        [...(saved[s.key]?.rows || []), ...s.rows].sort((a, b) =>
          String(a.retrievedAt || "").localeCompare(
            String(b.retrievedAt || ""),
          ),
        ),
      ),
      researchCoverage: s.researchCoverage || saved[s.key]?.researchCoverage,
      note: $("supplierNote").value,
      savedAt: new Date().toISOString(),
    };
    persist();
    render();
    $("saveSupplierNote").textContent = "Note and evidence saved";
    $("detailSave").textContent = "Remove from shortlist";
  };
  $("samRefresh").onclick = async () => {
    const signal = profileController.signal;
    $("samRefresh").disabled = true;
    $("samProfileStatus").textContent = "Checking public registration…";
    try {
      const data = await samRequest({ uei: s.uei, page: 0 }, signal);
      if (activeSupplier !== s || signal.aborted) return;
      const matches = data.rows.filter((r) => r.uei === s.uei);
      if (!matches.length) {
        $("samProfileStatus").textContent =
          "No publicly displayed registration returned for this UEI. Existing evidence retained; this does not establish that the entity is unregistered.";
        return;
      }
      samProfiles.set(s.uei, matches);
      openSupplier({ ...s, rows: dedupe([...s.rows, ...matches]) });
      $("samProfileStatus").textContent =
        "Public registration retrieved " +
        data.retrievedAt +
        ". Save note & shortlist evidence to preserve this version.";
    } catch (e) {
      if (!signal.aborted) $("samProfileStatus").textContent = e.message;
    } finally {
      samClient.refresh();
      if (activeSupplier === s && !signal.aborted)
        $("samRefresh").disabled = false;
    }
  };
  $("companyHistory").onclick = () => loadCompanyHistory(s);
}
async function loadCompanyHistory(s) {
  const key = profileKey(s),
    prior = profiles.get(key) || { rows: [], page: 0 };
  if (prior.loading) return;
  const queryScope = {
    ...scope,
    country: "ALL",
    q: "",
    naics: "",
    psc: "",
    recipientUEI: s.uei,
  };
  const signal = profileController.signal;
  profiles.set(key, { ...prior, loading: true });
  renderCompanyProfile(s);
  try {
    const data = await json(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(companyHistoryBody(scope, s.uei, prior.page + 1)),
      signal,
    });
    const normalized = normalizeAwards(data, "awards", queryScope);
    const d = {
      rows: dedupe([
        ...prior.rows,
        ...exactCompanyRows(normalized.rows, s.uei),
      ]),
      page: prior.page + 1,
      hasNext: normalized.hasNext,
      retrievedAt: new Date().toISOString(),
    };
    profiles.set(key, d);
    if (activeSupplier !== s || signal.aborted) return;
    const enriched = {
      ...s,
      rows: dedupe([...s.rows, ...d.rows]),
      researchCoverage: {
        scope: queryScope,
        pages: d.page,
        hasMore: d.hasNext,
        retrievedAt: d.retrievedAt,
      },
    };
    openSupplier(enriched);
    // New expanded evidence requires an explicit save/update, preserving original saved snapshots until then.
    if (saved[s.key]) {
      $("detailSave").textContent = "Update saved evidence";
      $("detailSave").onclick = () => {
        saved[s.key] = {
          ...saved[s.key],
          key: s.key,
          rows: enriched.rows,
          researchCoverage: enriched.researchCoverage,
          savedAt: new Date().toISOString(),
        };
        persist();
        render();
        $("detailSave").textContent = "Saved updated evidence";
      };
    }
  } catch (e) {
    profiles.set(key, {
      ...prior,
      error:
        e.name === "AbortError"
          ? "Lookup interrupted; retry to continue."
          : "Source unavailable; retry to continue.",
    });
    if (activeSupplier === s && !signal.aborted) renderCompanyProfile(s);
  }
}
function openComparison() {
  const list = Object.values(saved)
    .map((v) => ({
      ...suppliers(v.rows, countries, scope.country).find(
        (s) => s.key === v.key,
      ),
      savedAt: v.savedAt,
      researchCoverage: v.researchCoverage,
    }))
    .filter((s) => s.key);
  $("comparisonChoices").innerHTML = list
    .map(
      (s, i) =>
        `<label><input type="checkbox" data-compare="${i}" ${i < 3 ? "checked" : ""}> ${esc(s.name)}</label>`,
    )
    .join("");
  function draw() {
    const picked = [
      ...$("comparisonChoices").querySelectorAll("input:checked"),
    ].map((i) => list[Number(i.dataset.compare)]);
    const summaries = picked.map((s) => companySummary(s.rows));
    const fields = {
      UEI: (_, i) => picked[i].uei || "Not reported",
      "Reported origin": (_, i) => cname(picked[i].origin),
      "Work countries": (s) =>
        s.countries.map(cname).join(", ") || "Not reported",
      Buyers: (s) => s.buyers.join("; ") || "Not reported",
      "Evidence by source": (s) =>
        `${s.counts.awards} prime · ${s.counts.subawards} sub · ${s.counts.vehicles} vehicle · ${s.counts.sam} SAM`,
      "Start / report dates": (s) =>
        `${s.earliest || "Unknown"} → ${s.latest || "Unknown"}`,
      "NAICS / PSC": (s) =>
        `${s.naics.join(", ") || "Unknown"} / ${s.psc.join(", ") || "Unknown"}`,
      "SAM registration evidence": (s) =>
        s.registrations
          .map(
            (r) =>
              `${r.status || "Unknown"}; expires ${r.expiration || "unknown"}; snapshot ${r.retrievedAt || "unknown"}`,
          )
          .join("; ") || "Not connected / no saved registration evidence",
      "Search scopes": (s) =>
        s.scopes
          .map(
            (q) =>
              `${cname(q.country)}; ${q.from} → ${q.to}; ${q.agency}; keyword ${q.q || "any"}; NAICS ${q.naics || "any"}; PSC ${q.psc || "any"}`,
          )
          .join(" | "),
      "Worldwide expansion coverage": (_, i) =>
        picked[i].researchCoverage
          ? `${picked[i].researchCoverage.pages} pages; ${picked[i].researchCoverage.hasMore ? "more available" : "pages complete"}; retrieved ${picked[i].researchCoverage.retrievedAt}`
          : "No saved worldwide expansion; country evidence may be partial",
      "Research questions": (s) =>
        `${s.registrations.length ? "Recheck current SAM status." : "Verify current registration."} Confirm relevant capacity, local permissions, and current availability. ${s.missingWorkCountry ? "Resolve missing work locations." : ""}`,
    };
    $("comparisonTable").innerHTML = picked.length
      ? `<table><thead><tr><th>Evidence</th>${picked.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${Object.entries(
          fields,
        )
          .map(
            ([k, fn]) =>
              `<tr><th>${esc(k)}</th>${summaries.map((s, i) => `<td>${esc(fn(s, i))}</td>`).join("")}</tr>`,
          )
          .join("")}<tr><th>Source records</th>${picked
          .map(
            (s) =>
              `<td>${s.rows
                .slice(0, 10)
                .map(
                  (r) =>
                    `<a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener">${esc(r.identifier || r.source)}</a>`,
                )
                .join(
                  "<br>",
                )}<p>${s.rows.length > 10 ? "First 10 links shown; export contains every saved record." : ""}</p></td>`,
          )
          .join("")}</tr></tbody></table>`
      : "<p>Select at least two companies to compare.</p>";
    $("exportComparison").disabled = picked.length < 2;
    $("exportComparison").onclick = () =>
      exportFile(
        "ocs-company-comparison.json",
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            note: "Comparison of saved evidence; source scopes and coverage differ.",
            suppliers: picked.map((s) => ({
              key: s.key,
              name: s.name,
              uei: s.uei,
              savedAt: s.savedAt,
              researchCoverage: s.researchCoverage,
              summary: companySummary(s.rows),
              rows: s.rows,
            })),
          },
          null,
          2,
        ),
        "application/json",
      );
    $("comparisonChoices")
      .querySelectorAll("input")
      .forEach((i) => (i.disabled = picked.length >= 4 && !i.checked));
  }
  $("comparisonChoices")
    .querySelectorAll("input")
    .forEach((i) => (i.onchange = draw));
  draw();
  $("comparisonDialog").showModal();
}
async function boot() {
  try {
    countries = await json("ocs-atlas/data/countries.json");
    if (!Array.isArray(countries) || !countries.length)
      throw new Error("Country metadata missing.");
    $("country").innerHTML = countries
      .map((c) => `<option value="${esc(c.code)}">${esc(c.name)}</option>`)
      .join("");
    const params = new URLSearchParams(location.search);
    for (const k of Object.keys(scope))
      if (params.has(k)) scope[k] = params.get(k);
    if (!country(scope.country)) scope.country = "SAU";
    try {
      validate(scope);
    } catch {
      scope = defaults();
    }
    fillForm();
    bind();
    updateCacheButton();
    render();
    initMap();
    // A bounded, real-source seed makes the first review useful without inventing suppliers.
    if (!params.size && scope.country === "SAU") {
      try {
        const seed = await json("ocs-atlas/data/seed-sau.json");
        if (
          seed.schemaVersion === 1 &&
          seed.source === "USAspending" &&
          seed.scope.country === "SAU"
        ) {
          scope = validate(seed.scope);
          fillForm();
          for (const [id, data] of Object.entries(seed.layers))
            if (LAYERS[id] && !["sam", "exclusions"].includes(id))
              layerData[id] = {
                ...normalizeAwards(data, id, scope, seed.retrievedAt),
                status: "snapshot",
                asOf: seed.retrievedAt,
                page: 1,
              };
          render();
          notify(
            "Showing a saved public-data pull from " +
              seed.retrievedAt.slice(0, 10) +
              ". Select Search this source to refresh or change the search.",
          );
          return;
        }
      } catch {
        /* Continue with a live search if no seed is available. */
      }
    }
    await search();
  } catch (err) {
    notify("The atlas could not start: " + err.message);
    $("resultList").innerHTML =
      '<div class="empty">Reload the page or check the local data files.</div>';
  }
}
boot();
