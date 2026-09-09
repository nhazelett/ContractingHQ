import { SOURCE_MAP } from "./sources.mjs?v=20260909-3";
export const VERSION = 2;
export const today = () => new Date().toISOString().slice(0, 10);
export const clean = (value, max = 4000) =>
  String(value ?? "")
    .replace(/\u0000/g, "")
    .slice(0, max);
export const escapeHTML = (value) =>
  clean(value, 50000).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function safeURL(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function money(value) {
  const n = number(value);
  return n === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(n);
}
export function code(value) {
  return clean(typeof value === "object" && value ? value.code : value, 100);
}
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function defaultSearch() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 3);
  return {
    q: "",
    mode: "requirement",
    kind: "mixed",
    naics: "",
    psc: "",
    state: "",
    from: d.toISOString().slice(0, 10),
    to: today(),
    page: 1,
  };
}
export function validateSearch(raw) {
  const s = {
    ...defaultSearch(),
    ...raw,
    q: clean(raw.q, 180).trim(),
    naics: clean(raw.naics, 100).trim(),
    psc: clean(raw.psc, 100).trim().toUpperCase(),
    state: clean(raw.state, 100).trim().toUpperCase(),
    page: Number(raw.page || 1),
  };
  if (!s.q && !s.naics && !s.psc)
    throw new Error("Enter a search phrase, NAICS code, or PSC.");
  if (s.q && s.q.length < 2)
    throw new Error("Use at least two characters for the search phrase.");
  if (
    !["requirement", "supplier"].includes(s.mode) ||
    !["products", "services", "mixed"].includes(s.kind)
  )
    throw new Error("Choose a valid search type.");
  if (s.mode === "supplier" && !s.q)
    throw new Error("Enter a supplier name for supplier research.");
  if (s.naics && !/^\d{6}$/.test(s.naics))
    throw new Error("NAICS must contain six digits.");
  if (s.psc && !/^[A-Z0-9]{4}$/.test(s.psc))
    throw new Error("PSC must contain four letters or digits.");
  if (
    s.state &&
    !/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|GU|VI|AS|MP)$/.test(
      s.state,
    )
  )
    throw new Error("Use a valid two-letter U.S. state or territory code.");
  if (
    !validDate(s.from) ||
    !validDate(s.to) ||
    s.from > s.to ||
    s.to > today() ||
    s.from < "2007-10-01"
  )
    throw new Error(
      "Use a valid date range from October 1, 2007 through today.",
    );
  if (!Number.isInteger(s.page) || s.page < 1 || s.page > 5)
    throw new Error(
      "Page must be between 1 and 5. Refine your search for more targeted results.",
    );
  return s;
}
export function spendBody(s, id = "awards") {
  const filters = {
    time_period: [{ start_date: s.from, end_date: s.to }],
    award_type_codes:
      id === "vehicles"
        ? [
            "IDV_A",
            "IDV_B",
            "IDV_B_A",
            "IDV_B_B",
            "IDV_B_C",
            "IDV_C",
            "IDV_D",
            "IDV_E",
          ]
        : ["A", "B", "C", "D"],
  };
  if (s.q)
    filters[s.mode === "supplier" ? "recipient_search_text" : "keywords"] = [
      s.q,
    ];
  if (s.naics) filters.naics_codes = [s.naics];
  if (s.psc) filters.psc_codes = [s.psc];
  if (s.state)
    filters.place_of_performance_locations = [
      { country: "USA", state: s.state },
    ];
  if (id === "small-business")
    filters.recipient_type_names = ["small_business"];
  return {
    filters,
    fields: [
      "Award ID",
      "Recipient Name",
      "Recipient UEI",
      "Award Amount",
      "Awarding Agency",
      "Description",
      "Start Date",
      id === "vehicles" ? "Last Date to Order" : "End Date",
      "NAICS",
      "PSC",
      "Contract Award Type",
      "generated_internal_id",
    ],
    limit: 50,
    page: s.page || 1,
    sort: "Start Date",
    order: "desc",
  };
}
export function samWindow(s) {
  const floor = new Date(`${s.to}T00:00:00Z`);
  floor.setUTCDate(floor.getUTCDate() - 360);
  const from =
    s.from > floor.toISOString().slice(0, 10)
      ? s.from
      : floor.toISOString().slice(0, 10);
  const format = (v) => `${v.slice(5, 7)}/${v.slice(8, 10)}/${v.slice(0, 4)}`;
  return {
    from: format(from),
    to: format(s.to),
    note: `Posted ${from} through ${s.to} (maximum 360-day window).`,
  };
}
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
export function record(source, row) {
  const facts = Object.fromEntries(
    Object.entries(row.facts || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [clean(k, 70), clean(v, 600)]),
  );
  const url = safeURL(row.url) || SOURCE_MAP[source]?.url || "";
  return {
    id: `${source}:${hash(String(row.key || url + "|" + row.title + "|" + JSON.stringify(facts)))}`,
    source,
    title: clean(row.title || "Untitled record", 300),
    company: clean(row.company, 250),
    uei: clean(row.uei, 20),
    description: clean(row.description, 4000),
    date: clean(row.date, 40),
    url,
    facts,
    amount: number(row.amount),
    kind: row.kind || "lead",
  };
}
export function normalize(id, data) {
  let rows = [],
    total = null,
    hasNext = false,
    note = "";
  if (["awards", "small-business", "vehicles"].includes(id)) {
    if (!Array.isArray(data.results))
      throw new Error("The source returned an unexpected award response.");
    rows = data.results.map((r) =>
      record(id, {
        key: r.generated_internal_id || r["Award ID"],
        title: r["Award ID"],
        company: r["Recipient Name"],
        uei: r["Recipient UEI"],
        description: r.Description,
        date: r["Start Date"],
        url: r.generated_internal_id
          ? `https://www.usaspending.gov/award/${encodeURIComponent(r.generated_internal_id)}`
          : "",
        amount: r["Award Amount"],
        kind: id === "vehicles" ? "vehicle" : "award",
        facts: {
          Recipient: r["Recipient Name"],
          UEI: r["Recipient UEI"],
          "Reported award amount": money(r["Award Amount"]),
          Agency: r["Awarding Agency"],
          NAICS: code(r.NAICS),
          PSC: code(r.PSC),
          "Start date": r["Start Date"],
          [id === "vehicles" ? "Last date to order" : "End date"]:
            r[id === "vehicles" ? "Last Date to Order" : "End Date"],
          "Award type": r["Contract Award Type"],
        },
      }),
    );
    hasNext = data.page_metadata?.hasNext === true;
  } else if (id === "calc") {
    if (!Array.isArray(data.hits?.hits))
      throw new Error("The source returned an unexpected labor-rate response.");
    total = number(data.hits.total?.value);
    hasNext = data.hits.hits.length === 50;
    note =
      data.hits.total?.relation === "gte"
        ? "Total is a lower bound reported by GSA."
        : "";
    rows = data.hits.hits.map((h) => {
      const r = h._source;
      return record(id, {
        key: h._id,
        title: r.labor_category,
        company: r.vendor_name,
        date: r._timestamp,
        amount: r.current_price,
        kind: "rate",
        url: `https://buy.gsa.gov/pricing/qr/ceiling-rates`,
        facts: {
          Supplier: r.vendor_name,
          "Hourly ceiling": money(r.current_price),
          Contract: r.idv_piid,
          SIN: r.sin,
          Worksite: r.worksite,
          Education: r.education_level,
          "Minimum experience (years)": r.min_years_experience,
          "Business size (record)":
            r.business_size === "S"
              ? "Small"
              : r.business_size === "O"
                ? "Other than small"
                : "Not reported",
          "Contract end": r.contract_end,
          Updated: r._timestamp,
        },
        description:
          "Schedule ceiling rate; not a quoted offer, wage, or price paid. Match experience, education, worksite, and contract terms before comparing.",
      });
    });
  } else if (id === "regulations") {
    if (!Array.isArray(data.results))
      throw new Error("The source returned an unexpected notice response.");
    total = number(data.count);
    hasNext = !!data.next_page_url;
    rows = data.results.map((r) =>
      record(id, {
        key: r.document_number,
        title: r.title,
        description: r.abstract,
        date: r.publication_date,
        url: r.html_url,
        kind: "notice",
        facts: {
          Type: r.type,
          Agency: (r.agencies || []).map((a) => a.name).join("; "),
          "Publication date": r.publication_date,
          "Effective date": r.effective_on,
        },
      }),
    );
  } else if (id === "gleif") {
    if (!Array.isArray(data.data))
      throw new Error("The source returned an unexpected entity response.");
    total = number(data.meta?.pagination?.total);
    hasNext = !!data.links?.next;
    rows = data.data.map((r) =>
      record(id, {
        key: r.id,
        title: r.attributes?.entity?.legalName?.name,
        company: r.attributes?.entity?.legalName?.name,
        date: r.attributes?.registration?.lastUpdateDate,
        url: `https://search.gleif.org/#/record/${r.id}`,
        kind: "supplier",
        facts: {
          LEI: r.id,
          Jurisdiction: r.attributes?.entity?.jurisdiction,
          "Entity status": r.attributes?.entity?.status,
          "Registration status": r.attributes?.registration?.status,
        },
      }),
    );
  } else if (id === "nih") {
    if (!Array.isArray(data.results))
      throw new Error("The source returned an unexpected research response.");
    total = number(data.meta?.total);
    rows = data.results.map((r) =>
      record(id, {
        key: r.appl_id,
        title: r.project_title,
        company: r.organization?.org_name,
        uei: r.organization?.primary_uei,
        description: r.abstract_text,
        date: r.project_start_date,
        url: `https://reporter.nih.gov/project-details/${r.appl_id}`,
        kind: "research",
        facts: {
          Organization: r.organization?.org_name,
          "Project number": r.project_num,
          "Fiscal year": r.fiscal_year,
          "Research funding": money(r.award_amount),
          "Project end": r.project_end_date,
          "Active project":
            r.is_active === true
              ? "Yes"
              : r.is_active === false
                ? "No"
                : "Not reported",
        },
      }),
    );
  } else if (id === "bls") {
    if (
      data.status !== "REQUEST_SUCCEEDED" ||
      !Array.isArray(data.Results?.series)
    )
      throw new Error("BLS could not return this series.");
    rows = (data.Results.series[0]?.data || [])
      .filter((r) => r.period !== "M13")
      .slice(0, 24)
      .map((r) =>
        record(id, {
          key: `${r.year}-${r.period}`,
          title: `CPI-U · ${r.periodName} ${r.year}`,
          date: `${r.year}-${r.period.slice(1)}-01`,
          url: "https://data.bls.gov/timeseries/CUUR0000SA0",
          kind: "index",
          facts: {
            Series: "CUUR0000SA0",
            "Index (1982–84=100)": r.value,
            Period: `${r.periodName} ${r.year}`,
          },
          description:
            (r.footnotes || [])
              .map((n) => n.text)
              .filter(Boolean)
              .join(" ") ||
            "National, all items, not seasonally adjusted. General context; not specific to your requirement.",
        }),
      );
  } else if (id === "web") {
    if (!data.web || !Array.isArray(data.web.results))
      throw new Error("The search service returned no usable response.");
    rows = data.web.results.map((r) =>
      record(id, {
        key: r.url,
        title: r.title,
        description: r.description,
        date: r.age,
        url: r.url,
        kind: "web",
        facts: { Publisher: r.meta_url?.hostname },
      }),
    );
  } else {
    if (!data.ok) {
      const raw = String(data.error || "");
      const e = new Error(
        /401|403|API_KEY|not configured/i.test(raw)
          ? "This source needs its connection renewed. Use the official search in the source library."
          : data.disabled
            ? "This optional source is not connected."
            : "This source is temporarily unavailable. Try again or use its official search.",
      );
      e.status = data.disabled ? "not_connected" : "unavailable";
      throw e;
    }
    if (!Array.isArray(data.results))
      throw new Error("The source returned an unexpected response.");
    total = number(
      data.meta?.totalRecords ?? data.meta?.total ?? data.meta?.totalResults,
    );
    rows = data.results.map((r) => {
      if (id === "opportunities")
        return record(id, {
          key: r.id,
          title: r.title,
          description: r.description,
          date: r.postedDate,
          url: r.url,
          kind: "opportunity",
          facts: {
            Solicitation: r.solicitationNumber,
            Type: r.type,
            Agency: r.department,
            Office: r.office,
            NAICS: r.naics,
            PSC: r.psc,
            "Set-aside (notice)": r.setAside,
            "Response deadline": r.responseDeadline,
          },
        });
      if (id === "entities")
        return record(id, {
          key: r.uei || r.cage || r.name,
          title: r.name,
          company: r.name,
          uei: r.uei,
          date: r.registrationDate,
          url: r.url,
          kind: "supplier",
          facts: {
            UEI: r.uei,
            CAGE: r.cage,
            DBA: r.dba,
            "Registration status": r.registrationStatus,
            Expiration: r.expirationDate,
            Address: r.address,
          },
        });
      if (id === "exclusions")
        return record(id, {
          key: `${r.uei || r.name}:${r.activationDate}`,
          title: r.name,
          company: r.name,
          uei: r.uei,
          date: r.activationDate,
          url: r.url,
          kind: "screening",
          facts: {
            UEI: r.uei,
            CAGE: r.cage,
            "Exclusion type": r.exclusionType,
            "Excluding agency": r.excludingAgency,
            "Activation date": r.activationDate,
            "Termination date": r.terminationDate,
          },
          description:
            "Potential name match. Verify identifiers and the current official record; do not assume this is the supplier you are researching.",
        });
      if (id === "news")
        return record(id, {
          key: r.url,
          title: r.title,
          description: r.description,
          date: r.publishedAt,
          url: r.url,
          kind: "news",
          facts: { Publisher: r.source, Author: r.author },
        });
      if (id === "corporations")
        return record(id, {
          key: `${r.jurisdiction}:${r.number}`,
          title: r.name,
          company: r.name,
          date: r.incorporated,
          url: r.url,
          kind: "supplier",
          facts: {
            Number: r.number,
            Jurisdiction: r.jurisdiction,
            Status: r.status,
          },
        });
      return record(id, {
        key: r.id,
        title: r.title,
        description: r.abstract,
        date: r.date,
        url: r.url,
        kind: "patent",
        facts: {
          Patent: r.id,
          Assignees: Array.isArray(r.assignees)
            ? r.assignees.join("; ")
            : r.assignees,
        },
      });
    });
  }
  return { records: rows, total, hasNext, note };
}
export function sourceURL(id, s) {
  if (["awards", "small-business", "vehicles"].includes(id))
    return "https://api.usaspending.gov/api/v2/search/spending_by_award/";
  if (id === "calc")
    return (
      "https://api.gsa.gov/acquisition/calc/v3/api/ceilingrates/?" +
      new URLSearchParams({
        keyword: s.q,
        page: s.page || 1,
        page_size: 50,
        ordering: "labor_category",
        sort: "asc",
      })
    );
  if (id === "regulations")
    return (
      "https://www.federalregister.gov/api/v1/documents.json?" +
      new URLSearchParams({
        "conditions[term]": s.q,
        "conditions[publication_date][gte]": s.from,
        "conditions[publication_date][lte]": s.to,
        per_page: 25,
        order: "relevance",
        page: s.page || 1,
      })
    );
  if (id === "gleif")
    return (
      "https://api.gleif.org/api/v1/lei-records?" +
      new URLSearchParams({
        "filter[fulltext]": s.q,
        "page[size]": 25,
        "page[number]": s.page || 1,
      })
    );
  if (id === "nih") return "https://api.reporter.nih.gov/v2/projects/search";
  if (id === "bls")
    return "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0";
  return "";
}
export function sourceRequest(id, s) {
  if (["awards", "small-business", "vehicles"].includes(id))
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spendBody(s, id)),
    };
  if (id === "nih")
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        criteria: {
          advanced_text_search: {
            operator: "and",
            search_field: "all",
            search_text: s.q,
          },
        },
        offset: 0,
        limit: 25,
        include_fields: [
          "ApplId",
          "ProjectTitle",
          "Organization",
          "AbstractText",
          "ProjectStartDate",
          "ProjectEndDate",
          "ProjectNum",
          "FiscalYear",
          "AwardAmount",
          "IsActive",
        ],
      }),
    };
  return {};
}
export function newProject() {
  return {
    version: VERSION,
    id: crypto.randomUUID(),
    brief: {
      title: "",
      need: "",
      outcomes: "",
      quantity: "",
      budget: "",
      deadline: "",
      location: "",
      agency: "",
      objectives: "",
      constraints: "",
      smallBusiness: "",
    },
    search: defaultSearch(),
    evidence: [],
    citationSequence: 0,
    assessments: {},
    engagements: [],
    conclusions: {
      commercial: "",
      competition: "",
      vehicles: "",
      pricing: "",
      risks: "",
      nextSteps: "",
      reviewDate: "",
    },
    runs: [],
    savedAt: null,
  };
}
export function importProject(raw) {
  if (
    !raw ||
    raw.version !== VERSION ||
    !Array.isArray(raw.evidence) ||
    raw.evidence.length > 300 ||
    !raw.brief ||
    !raw.conclusions
  )
    throw new Error("This is not a supported Market Research Desk project.");
  const base = newProject();
  for (const k of Object.keys(base.brief))
    base.brief[k] = clean(raw.brief[k], 8000);
  for (const k of Object.keys(base.conclusions))
    base.conclusions[k] = clean(raw.conclusions[k], 12000);
  base.search = { ...defaultSearch() };
  for (const k of Object.keys(base.search))
    base.search[k] =
      k === "page" ? 1 : clean(raw.search?.[k] ?? base.search[k], 180);
  const citations = new Set(),
    identifiers = new Set();
  base.evidence = raw.evidence.map((r, i) => {
    if (!r || typeof r !== "object")
      throw new Error("Invalid evidence record.");
    const citation = clean(r.citation, 20),
      id = clean(r.id, 300) || `import:${i}`;
    if (
      !/^E\d{3,6}$/.test(citation) ||
      citations.has(citation) ||
      identifiers.has(id)
    )
      throw new Error("Evidence citations and identifiers must be unique.");
    citations.add(citation);
    identifiers.add(id);
    return {
      ...record(SOURCE_MAP[r.source] ? r.source : "manual", r),
      id,
      citation,
      retrievedAt: clean(r.retrievedAt, 40),
      query: clean(r.query, 1000),
      scope: clean(r.scope, 2000),
      note: clean(r.note, 8000),
      verification: clean(r.verification, 80) || "Needs verification",
    };
  });
  const savedSequence = Number(raw.citationSequence);
  base.citationSequence = Math.max(
    Number.isSafeInteger(savedSequence) &&
      savedSequence >= 0 &&
      savedSequence < 999999
      ? savedSequence
      : 0,
    ...base.evidence.map((e) => Number(e.citation.slice(1))),
  );
  base.engagements = (Array.isArray(raw.engagements) ? raw.engagements : [])
    .slice(0, 100)
    .map((r) => ({
      id: crypto.randomUUID(),
      date: clean(r.date, 30),
      organization: clean(r.organization, 250),
      method: clean(r.method, 100),
      summary: clean(r.summary, 8000),
      next: clean(r.next, 3000),
    }));
  const assessments =
    raw.assessments && typeof raw.assessments === "object"
      ? raw.assessments
      : {};
  base.assessments = Object.fromEntries(
    Object.entries(assessments)
      .slice(0, 300)
      .map(([k, v]) => [
        clean(k, 300),
        {
          fit: clean(v?.fit, 4000),
          gaps: clean(v?.gaps, 4000),
          status: clean(v?.status, 80),
        },
      ]),
  );
  base.runs = (Array.isArray(raw.runs) ? raw.runs : [])
    .slice(-100)
    .map((r) => ({
      date: clean(r.date, 40),
      query: clean(r.query, 1000),
      sources: (Array.isArray(r.sources) ? r.sources : [])
        .slice(0, 20)
        .map((s) => ({
          id: clean(s.id, 60),
          status: clean(s.status, 30),
          count: number(s.count) || 0,
          scope: clean(s.scope, 3000),
        })),
    }));
  return base;
}
export function supplierKey(r) {
  return r.uei ? `uei:${r.uei}` : `name:${r.company.trim().toUpperCase()}`;
}
export function suppliers(evidence) {
  const groups = new Map();
  for (const r of evidence) {
    if (!r.company || r.kind === "screening") continue;
    const key = supplierKey(r);
    if (!groups.has(key))
      groups.set(key, { key, name: r.company, uei: r.uei, evidence: [] });
    groups.get(key).evidence.push(r);
  }
  return [...groups.values()];
}
export function queryLabel(s) {
  return [
    s.mode === "supplier" ? "Supplier" : "Requirement",
    s.q || "(code search)",
    s.naics && `NAICS ${s.naics}`,
    s.psc && `PSC ${s.psc}`,
    s.state && `Performance ${s.state}`,
    `${s.from} to ${s.to}`,
    `page ${s.page || 1}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function reportSections(p) {
  const pending = "Not yet documented — researcher review required.";
  return [
    {
      title: "1. Requirement and research objectives",
      lines: Object.entries({
        Requirement: p.brief.title,
        "Mission need": p.brief.need,
        "Required outcomes": p.brief.outcomes,
        "Quantity / scale": p.brief.quantity,
        "Budget context": p.brief.budget,
        "Need date": p.brief.deadline,
        "Place of performance": p.brief.location,
        Agency: p.brief.agency,
        Objectives: p.brief.objectives,
        Constraints: p.brief.constraints,
        "Small-business considerations": p.brief.smallBusiness,
      }).map(([k, v]) => `${k}: ${v || "Not provided"}`),
    },
    {
      title: "2. Research method and source coverage",
      lines: [
        `Latest search: ${queryLabel(p.search)}`,
        "Results are bounded source samples, not a census of the market. Historical awards do not establish current capability, business status, commerciality, or price reasonableness.",
        ...p.runs.map(
          (r) =>
            `${r.date} | ${r.query}\n${r.sources.map((s) => `${SOURCE_MAP[s.id]?.provider || s.id} / ${SOURCE_MAP[s.id]?.name || s.id}: ${s.status}; ${s.count} records. ${s.scope || ""}`).join("\n")}`,
        ),
      ],
    },
    {
      title: "3. Commercial availability and alternatives",
      lines: [p.conclusions.commercial || pending],
    },
    {
      title: "4. Supplier capability and competition",
      lines: [
        p.conclusions.competition || pending,
        ...suppliers(p.evidence).map((s) => {
          const a = p.assessments[s.key] || {};
          return `${s.name}${s.uei ? " · UEI " + s.uei : ""}\nEvidence: ${s.evidence.map((e) => e.citation).join(", ")}\nCapability fit: ${a.fit || "Not assessed"}\nGaps: ${a.gaps || "Not assessed"}\nReview status: ${a.status || "Needs verification"}`;
        }),
      ],
    },
    {
      title: "5. Contract vehicles and required-source research",
      lines: [p.conclusions.vehicles || pending],
    },
    {
      title: "6. Pricing and cost drivers",
      lines: [
        p.conclusions.pricing || pending,
        ...p.evidence
          .filter(
            (e) =>
              e.kind === "product" && e.facts?.["Worksheet version"] === "1",
          )
          .map(
            (e) =>
              `[${e.citation}] ${e.title} | ${e.company}\n${Object.entries(
                e.facts,
              )
                .filter(([key]) => key !== "Worksheet version")
                .map(([key, value]) => `${key}: ${value}`)
                .join(
                  "\n",
                )}\nSpecifications: ${e.description || "Not recorded"}\nRequirement fit: ${e.note || "Not assessed"}\nPrice checked: ${e.date || "Not recorded"} | Source: ${e.url}`,
          ),
        "Distinguish award amounts, ceiling rates, actual prices paid, wage rates, and vendor quotations. Account for units, quantity, dates, terms, delivery, geography, and scope before making comparisons.",
      ],
    },
    {
      title: "7. Industry engagement",
      lines: p.engagements.length
        ? p.engagements.map(
            (e) =>
              `${e.date || "Date not recorded"} | ${e.organization} | ${e.method}\n${e.summary}\nFollow-up: ${e.next || "Not recorded"}`,
          )
        : [pending],
    },
    {
      title: "8. Risks, requirements refinement, and next steps",
      lines: [
        `Risks and gaps: ${p.conclusions.risks || pending}`,
        `Next steps: ${p.conclusions.nextSteps || pending}`,
        `Next research review: ${p.conclusions.reviewDate || "Not scheduled"}`,
      ],
    },
    {
      title: "9. Evidence register",
      lines: p.evidence.length
        ? p.evidence.map(
            (e) =>
              `[${e.citation}] ${e.title}\nSource: ${SOURCE_MAP[e.source]?.provider || "Researcher-entered"} | ${e.url || "No source URL recorded"}\nRecord date: ${e.date || "Not reported"} | Retrieved: ${e.retrievedAt || "Not recorded"}\nQuery: ${e.query || "Manual entry"}\nScope: ${e.scope || "Researcher-entered evidence"}\n${Object.entries(
                e.facts || {},
              )
                .filter(([key]) => key !== "Worksheet version")
                .map(([k, v]) => `${k}: ${v}`)
                .join(
                  "\n",
                )}\n${e.description || ""}\nResearch note: ${e.note || "None"}\nVerification: ${e.verification || "Needs verification"}`,
          )
        : [pending],
    },
    {
      title: "10. Preparation and review",
      lines: [
        "Draft prepared with KTHQ Market Research Desk. The tool assembles source records and researcher-entered notes; it does not make acquisition determinations. No generative AI was used by this tool to write this draft. Any subsequent AI use and validation should be documented by the researcher.",
        "Prepared by: ____________________  Date: __________",
        "Reviewed by / contracting officer: ____________________  Date: __________",
      ],
    },
  ];
}
export function reportText(p) {
  return [
    `DRAFT MARKET RESEARCH REPORT\n${p.brief.title || "Untitled requirement"}\nPrepared ${today()}`,
    ...reportSections(p).map((s) => s.title + "\n" + s.lines.join("\n\n")),
  ].join("\n\n");
}
export function evidenceCSV(evidence) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  return [
    [
      "Citation",
      "Title",
      "Supplier",
      "UEI",
      "Source",
      "URL",
      "Record date",
      "Retrieved",
      "Query",
      "Scope",
      "Facts",
      "Description",
      "Research note",
      "Verification",
    ],
    ...evidence.map((e) => [
      e.citation,
      e.title,
      e.company,
      e.uei,
      SOURCE_MAP[e.source]?.provider || "Manual",
      e.url,
      e.date,
      e.retrievedAt,
      e.query,
      e.scope,
      Object.entries(e.facts || {})
        .filter(([key]) => key !== "Worksheet version")
        .map(([k, v]) => `${k}: ${v}`)
        .join("; "),
      e.description,
      e.note,
      e.verification,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

export function allocateCitation(project) {
  const next =
    Math.max(
      project.citationSequence || 0,
      0,
      ...project.evidence.map((e) => Number(e.citation.slice(1)) || 0),
    ) + 1;
  if (next > 999999)
    throw new Error(
      "This file has exhausted its citation numbers. Start a new research file.",
    );
  project.citationSequence = next;
  return "E" + String(next).padStart(3, "0");
}
