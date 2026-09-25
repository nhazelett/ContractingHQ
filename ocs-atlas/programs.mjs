import { sourceFailureMessage } from "./source-request.mjs";
import { API, dedupe, esc } from "./core.mjs";
import {
  PROGRAMS,
  IDV_ORDERS_API,
  awardKey,
  relatedContracts,
  countryOrders,
  validateChildren,
  linkedOrderSearch,
  verifiedOrders,
  parentKey,
  matchesProgramCountry,
} from "./programs-core.mjs";
const $ = (id) => document.getElementById(id);
export function initPrograms({ getScope, request, onChange }) {
  let catalog = [],
    metadata = null,
    catalogError = "",
    selected = new Set(),
    busy = false,
    batch = false,
    generation = 0,
    controller = new AbortController(),
    retryMessage = "";
  const pages = new Map();
  const stateKey = (c) => getScope().country + "|" + awardKey(c);
  function contracts() {
    return catalog.filter((c) => selected.has(c.program));
  }
  function orders() {
    return [...pages.values()]
      .filter((p) => p.country === getScope().country)
      .flatMap((p) => p.rows);
  }
  function pendingContracts() {
    return contracts().filter((c) => {
      const p = pages.get(stateKey(c));
      return !p || p.hasNext || p.error;
    }).sort((a, b) => Number(!!pages.get(stateKey(a))?.error) - Number(!!pages.get(stateKey(b))?.error));
  }
  function discovery() {
    const relevant = contracts().map((c) => pages.get(stateKey(c)));
    const checked = relevant.filter((p) => p?.page).length;
    const errors = relevant.filter((p) => p?.error);
    const pending = pendingContracts().length;
    const loading = busy || batch || (!metadata && !catalogError);
    const state = loading ? "loading" : catalogError || errors.length ? "error" : pending ? checked ? "partial" : "unchecked" : "complete";
    return {
      state, loading, pending, checked, total: contracts().length,
      loaded: orders().filter((r) => selected.has(r.program)).length,
      title: loading ? `Checking ${[...selected].join(", ")} orders in ${getScope().country}…`
        : state === "error" ? "Program check incomplete · source unavailable"
        : state === "unchecked" ? "Country orders have not been checked yet"
        : state === "partial" ? "Program check incomplete · more linked orders remain"
        : "Country check complete for the catalog records",
      message: `${checked} of ${contracts().length} catalog parent contracts checked. ${retryMessage || catalogError || errors[0]?.error || (loading ? "Looking up exact parent-linked orders for this country. You can change countries or stop the check." : pending ? "Continue checking before drawing conclusions about country coverage." : "All direct-child pages in this dated catalog were checked. Missing or indirect awards and other program versions may still be absent.")}`,
    };
  }
  function cancel() {
    generation++;
    controller.abort();
    controller = new AbortController();
    busy = false;
    batch = false;
    retryMessage = "";
  }
  function changed() { render(); onChange(); }
  function autoCheck() {
    if (selected.size && metadata && $("programMode").value === "country" && pendingContracts().length)
      void checkAll(false);
  }
  function render() {
    const old = $("programContract").value;
    $("programContract").innerHTML =
      '<option value="">Choose a holder and contract</option>' +
      contracts()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (c) =>
            `<option value="${esc(awardKey(c))}">${esc(c.name)} · ${esc(c.programVersion)} · ${esc(c.identifier)}</option>`,
        )
        .join("");
    if (contracts().some((c) => awardKey(c) === old))
      $("programContract").value = old;
    const chosen = catalog.find(
      (c) => awardKey(c) === $("programContract").value,
    );
    const p = chosen && pages.get(stateKey(chosen));
    $("programLoad").disabled =
      batch || busy || !chosen || (p?.hasNext === false && !p?.error);
    const checked = contracts().filter((c) => pages.get(stateKey(c))?.page);
    const pending = contracts().filter((c) => {
      const p = pages.get(stateKey(c));
      return !p || p.hasNext || p.error;
    });
    $("programCheckAll").disabled = busy || batch || !contracts().length;
    $("programCheckAll").textContent = batch
      ? "Checking program holders…"
      : pending.length
        ? `Check next ${Math.min(8, pending.length)} holders for country work`
        : "Refresh country checks (up to 8 holders)";
    $("programCountryStatus").textContent =
      `${checked.length} of ${contracts().length} catalog parent contracts checked in ${getScope().country} · ${orders().filter((r) => selected.has(r.program)).length} linked country orders loaded. ${pending.length ? "Unchecked, partial or failed checks remain." : "Direct-child pages complete for this dated catalog."} Includes historical orders; dates do not prove current performance.`;
    $("programLoad").textContent = busy
      ? "Checking linked orders…"
      : p?.error
        ? "Retry linked-order check"
        : p?.page
          ? "Check next 100 linked orders"
          : "Check first 100 linked orders";
    $("programStop").hidden = !busy && !batch;
    $("programCatalogStatus").textContent = metadata
      ? `${catalog.length} verified parent contracts in the dated catalog · ${metadata.retrievedAt.slice(0, 10)}. Keyword discovery is not an exhaustive roster. AFCAP V and LOGCAP V only; WEXMAC versions follow each source description.`
      : catalogError || "Loading the public contract catalog…";
    $("programLoadStatus").textContent = p
      ? `${p.rows.length} country orders loaded for ${p.country}; ${p.reviewed} linked records checked across ${p.page} page(s). ${p.hasNext ? "More linked records remain." : "Direct-order pages complete for this parent."} ${p.error || ""}`
      : `Choose a contract to check orders reported in ${getScope().country}. Checks cover all reported dates; award keywords, buyer and date filters above do not apply. No orders checked yet for this contract/country.`;
    if (busy)
      $("programLoadStatus").textContent = retryMessage ||
        "Checking linked orders for this country. Temporary failures retry once; you can stop and retain earlier pages.";
  }
  async function load(chosen, refresh = false) {
    const c = chosen?.awardKey
      ? chosen
      : catalog.find((c) => awardKey(c) === $("programContract").value);
    if (busy || !c) return;
    const scope = {
      ...getScope(),
      agency: "all",
      q: "",
      naics: "",
      psc: "",
      from: "2007-10-01",
      to: new Date().toISOString().slice(0, 10),
      allDates: true,
    };
    const key = stateKey(c),
      prior = pages.get(key) || {
        country: scope.country,
        parentAwardKey: awardKey(c),
        program: c.program,
        rows: [],
        page: 0,
        reviewed: 0,
        hasNext: true,
      };
    refresh ||= !!prior.error && prior.hasNext === false;
    const previous = refresh
      ? { ...prior, page: 0, reviewed: 0, hasNext: true }
      : prior;
    if (!previous.hasNext) return;
    const token = generation;
    busy = true;
    retryMessage = "";
    changed();
    const sourceOptions = {
      retries: 1,
      onRetry: () => {
        if (generation !== token) return;
        retryMessage = "USAspending is slow or temporarily unavailable. Retrying this linked-order request once…";
        changed();
      },
    };
    try {
      const childQuery = {
        award_id: awardKey(c),
        type: "child_awards",
        limit: 100,
        page: previous.page + 1,
        sort: "period_of_performance_start_date",
        order: "desc",
      };
      const childrenData = await request(IDV_ORDERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(childQuery),
        signal: controller.signal,
      }, sourceOptions);
      if (generation !== token) return;
      const children = validateChildren(childrenData, c);
      if (children.length !== childrenData.results.length)
        throw new Error(
          "Some linked records could not be verified; this page was not accepted.",
        );
      let rows = [],
        page = 1,
        more = children.length > 0;
      while (more) {
        if (page > 3)
          throw new Error(
            "Country lookup exceeded its page limit; previous pages retained.",
          );
        const data = await request(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(linkedOrderSearch(scope, children, page)),
          signal: controller.signal,
        }, sourceOptions);
        if (generation !== token) return;
        const retrievedAt = new Date().toISOString();
        rows.push(
          ...verifiedOrders(data, c, children, scope, retrievedAt).map((r) => ({
            ...r,
            programQuery: {
              linkedOrders: childQuery,
              countryLookup: linkedOrderSearch(scope, children, page),
            },
          })),
        );
        more = data.page_metadata.hasNext;
        page++;
      }
      pages.set(key, {
        country: scope.country,
        rows: dedupe([...(refresh ? [] : previous.rows), ...rows]),
        page: previous.page + 1,
        reviewed: previous.reviewed + children.length,
        hasNext: childrenData.page_metadata.hasNext,
        retrievedAt: new Date().toISOString(),
        parentAwardKey: awardKey(c),
        query: childQuery,
      });
      onChange();
    } catch (e) {
      if (generation === token)
        pages.set(key, {
          ...prior,
          error:
            e.kind ? sourceFailureMessage(e) : e.message,
        });
    } finally {
      if (generation === token) {
        busy = false;
        retryMessage = "";
        changed();
      }
    }
  }
  async function checkAll(allowRefresh = true) {
    if (busy || batch || !selected.size || !metadata) return;
    const token = generation;
    const pending = pendingContracts();
    const refresh = !pending.length && allowRefresh;
    const todo = (refresh ? contracts() : pending).slice(0, 8);
    if (!todo.length) return;
    batch = true;
    changed();
    let consecutiveFailures = 0;
    for (const c of todo) {
      if (generation !== token) return;
      $("programContract").value = awardKey(c);
      await load(c, refresh);
      if (generation !== token) return;
      // Stop a sustained outage; future checks prioritize unattempted holders.
      consecutiveFailures = pages.get(stateKey(c))?.error ? consecutiveFailures + 1 : 0;
      if (consecutiveFailures >= 2) break;
    }
    if (generation === token) {
      batch = false;
      changed();
    }
  }
  $("programCheckAll").onclick = () => checkAll();
  $("programMode").onchange = () => { cancel(); changed(); autoCheck(); };
  $("programContract").onchange = render;
  $("programLoad").onclick = load;
  $("programStop").onclick = () => {
    cancel();
    changed();
    $("programLoadStatus").textContent =
      "Stopped. Earlier completed pages retained; the in-flight page was discarded.";
  };
  request("ocs-atlas/data/programs.json")
    .then(async (d) => {
      if (d.schemaVersion !== 1 || !Array.isArray(d.rows))
        throw new Error("Invalid catalog");
      catalog = d.rows;
      metadata = d;
      try {
        const snapshot = await request(
          "ocs-atlas/data/program-orders-sau.json",
        );
        if (
          snapshot.schemaVersion === 1 &&
          snapshot.source === "USAspending" &&
          Array.isArray(snapshot.pages)
        )
          for (const p of snapshot.pages) {
            const parent = catalog.find(
              (c) => awardKey(c) === p.parentAwardKey,
            );
            if (
              !parent ||
              !Array.isArray(p.rows) ||
              !p.rows.every(
                (r) =>
                  parentKey(r) === awardKey(parent) &&
                  matchesProgramCountry(r, p.country) &&
                  r.program === parent.program,
              )
            )
              continue;
            const key = p.country + "|" + p.parentAwardKey;
            if (!pages.has(key)) {
              const { pulls, ...entry } = p;
              pages.set(key, entry);
            }
          }
      } catch {
        /* An unavailable optional snapshot leaves live checks available. */
      }
      changed();
      autoCheck();
    })
    .catch(() => {
      catalogError = "Contract catalog unavailable. Reload to retry.";
      onChange();
      $("programCatalogStatus").textContent =
        "Contract catalog unavailable. Reload to retry; other research remains available.";
    });
  return {
    select(program) {
      cancel();
      selected = new Set(program ? [program] : []);
      render();
      autoCheck();
    },
    discovery,
    check: () => checkAll(),
    catalog: () => catalog,
    isBusy: () => busy || batch,
    active: () => selected.size > 0,
    selection: () => ({
      programs: [...selected],
      mode: $("programMode").value,
    }),
    rows: () =>
      selected.size
        ? [...contracts(), ...orders().filter((r) => selected.has(r.program))]
        : [],
    filter(s) {
      if (!selected.size) return true;
      const linked = relatedContracts(s.rows, catalog).filter((c) =>
        selected.has(c.program),
      );
      return $("programMode").value === "country"
        ? countryOrders(s.rows, linked, getScope().country).length > 0
        : linked.length > 0;
    },
    enrich(rows) {
      const ueis = new Set(rows.map((r) => r.uei).filter(Boolean));
      // A linked order can name a different recipient. Keep its parent as
      // provenance, not as evidence belonging to that recipient's identity.
      return dedupe([
        ...rows,
        ...relatedContracts(rows, catalog).filter((c) => ueis.has(c.uei)),
      ]);
    },
    coverage: () => ({
      status: busy || batch ? "loading" : metadata ? "snapshot" : "error",
      loaded: contracts().length,
      hasMore: null,
      retrievedAt: metadata?.retrievedAt,
      error: metadata ? "" : "Contract catalog unavailable",
      programCoverage: {
        selection: [...selected],
        mode: $("programMode").value,
        discovery: metadata?.coverage || [],
        orders: [...pages.values()]
          .filter(
            (p) =>
              p.country === getScope().country &&
              contracts().some((c) => awardKey(c) === p.parentAwardKey),
          )
          .map(({ rows, ...rest }) => ({ ...rest, loaded: rows.length })),
      },
    }),
    countryChanged() {
      cancel();
      render();
      autoCheck();
    },
  };
}
