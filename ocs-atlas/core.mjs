export const API =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";
export const GEO_API =
  "https://api.usaspending.gov/api/v2/search/spending_by_geography/";
export const LAYERS = {
  awards: {
    name: "Prime contracts",
    color: "#36bdb0",
    note: "Reported federal contract awards. Award history does not establish completed performance.",
  },
  subawards: {
    name: "Reported subcontracts",
    color: "#9a85ec",
    note: "Reported prime–sub relationships. Reporting gaps and duplicates may exist; amounts are kept separate from prime awards.",
  },
  vehicles: {
    name: "Contract vehicles",
    color: "#e7b357",
    note: "IDVs with a reported country match. Country filtering can omit vehicles used there through orders. Verify ordering scope and eligibility.",
  },
  exclusions: {
    name: "SAM active exclusions",
    color: "#ef9275",
    note: "Active public exclusion records for firms. Reported addresses are not work locations. Review identity and exclusion scope in SAM; absence is not eligibility clearance.",
  },
  sam: {
    name: "SAM registrations",
    color: "#80b9ef",
    note: "Public SAM snapshot. Registered location and declared capabilities; current status must be checked in SAM.",
  },
};
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const text = (v, n = 4000) =>
  String(v ?? "")
    .replace(/\u0000/g, "")
    .slice(0, n);
export const numeric = (v) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const money = (v) =>
  numeric(v) === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(v));
export const compactMoney = (v) =>
  numeric(v) === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(v));
export function safeURL(v) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export function defaults(now = new Date()) {
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 3);
  return {
    country: "SAU",
    q: "",
    naics: "",
    psc: "",
    agency: "all",
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}
export function validate(s) {
  if (!/^[A-Z]{3}$/.test(s.country)) throw new Error("Choose a country.");
  for (const d of [s.from, s.to])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new Error("Enter valid search dates.");
  if (s.from > s.to)
    throw new Error("The start date must be before the end date.");
  if (s.from < "2007-10-01")
    throw new Error("This search supports dates from October 1, 2007.");
  if (s.naics && !/^\d{2,6}$/.test(s.naics))
    throw new Error("NAICS must contain 2–6 digits.");
  if (s.psc && !/^[A-Z0-9]{4}$/.test(s.psc))
    throw new Error("PSC must contain four letters or digits.");
  if (!["all", "dod", "civilian"].includes(s.agency))
    throw new Error("Choose a buyer scope.");
  return s;
}
export const TERRITORIES = {
  PRI: "PR",
  GUM: "GU",
  ASM: "AS",
  MNP: "MP",
  VIR: "VI",
  UMI: "UM",
};
export function spendingBody(s, layer = "awards", page = 1) {
  validate(s);
  if (!["awards", "subawards", "vehicles"].includes(layer))
    throw new Error("Unsupported award layer.");
  const filters = {
    award_type_codes:
      layer === "vehicles"
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
    time_period: [{ start_date: s.from, end_date: s.to }],
    place_of_performance_locations: [
      TERRITORIES[s.country]
        ? { country: "USA", state: TERRITORIES[s.country] }
        : { country: s.country },
    ],
  };
  if (s.q) filters.keywords = [s.q];
  if (s.naics) filters.naics_codes = { require: [s.naics] };
  if (s.psc) filters.psc_codes = [s.psc];
  // Civilian scope is applied after retrieval: the API's agency filter is inclusive.
  if (s.agency === "dod")
    filters.agencies = [
      { type: "awarding", tier: "toptier", name: "Department of Defense" },
    ];
  const fields =
    layer === "subawards"
      ? [
          "Sub-Award ID",
          "Sub-Awardee Name",
          "Sub-Recipient UEI",
          "Sub-Award Amount",
          "Sub-Award Date",
          "Sub-Award Description",
          "Prime Award ID",
          "Prime Award Recipient UEI",
          "Prime Recipient Name",
          "Sub-Recipient Location",
          "Sub-Award Primary Place of Performance",
          "Awarding Agency",
          "NAICS",
          "PSC",
        ]
      : [
          "Award ID",
          "Recipient Name",
          "Recipient UEI",
          "Award Amount",
          "Awarding Agency",
          "Description",
          "Start Date",
          layer === "vehicles" ? "Last Date to Order" : "End Date",
          "NAICS",
          "PSC",
          "Recipient Location",
          "Primary Place of Performance",
          "generated_internal_id",
        ];
  return {
    filters,
    fields,
    spending_level: layer === "subawards" ? "subawards" : "awards",
    subawards: layer === "subawards",
    limit: 100,
    page,
    sort: layer === "subawards" ? "Sub-Award Date" : "Start Date",
    order: "desc",
  };
}
export function geographyBody(s) {
  if (s.agency === "civilian")
    throw new Error("Global activity supports all federal buyers or DoD only.");
  const { filters } = spendingBody(s);
  delete filters.place_of_performance_locations;
  return {
    filters,
    scope: "place_of_performance",
    geo_layer: "country",
    spending_level: "transactions",
  };
}
export function normalizeGeography(data) {
  if (!Array.isArray(data.results))
    throw new Error("Unexpected global activity response.");
  return data.results
    .map((r) => ({
      country: text(r.shape_code, 3),
      amount: numeric(r.aggregated_amount),
    }))
    .filter((r) => /^[A-Z]{3}$/.test(r.country) && r.amount !== null);
}
function code(v) {
  return text(typeof v === "object" && v ? v.code || v.name : v, 100);
}
function countryOf(v) {
  return code(
    v?.location_country_code ||
      v?.country_code ||
      v?.country ||
      v?.country_name,
  ).toUpperCase();
}
function cityOf(v) {
  return code(v?.city_name || v?.city);
}
function hash(s) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(36);
}
export function normalizeAwards(
  data,
  layer,
  scope,
  retrievedAt = new Date().toISOString(),
) {
  if (
    !Array.isArray(data.results) ||
    !data.page_metadata ||
    typeof data.page_metadata.hasNext !== "boolean"
  )
    throw new Error("USAspending returned an unexpected response.");
  const sub = layer === "subawards";
  const rows = data.results
    .map((r) => {
      const identifier = text(r[sub ? "Sub-Award ID" : "Award ID"], 200);
      const uei = text(r[sub ? "Sub-Recipient UEI" : "Recipient UEI"], 30)
        .trim()
        .toUpperCase();
      const name = text(
        r[sub ? "Sub-Awardee Name" : "Recipient Name"] || "Unnamed recipient",
        300,
      );
      const location = r[sub ? "Sub-Recipient Location" : "Recipient Location"];
      const pop =
        r[
          sub
            ? "Sub-Award Primary Place of Performance"
            : "Primary Place of Performance"
        ];
      const unique = r.generated_internal_id;
      const date = text(r[sub ? "Sub-Award Date" : "Start Date"], 30);
      const amount = numeric(r[sub ? "Sub-Award Amount" : "Award Amount"]);
      const prime = text(r["Prime Award ID"], 200);
      const description = text(
        r[sub ? "Sub-Award Description" : "Description"],
      );
      const key = sub
        ? JSON.stringify([
            identifier,
            prime,
            uei,
            name,
            date,
            amount,
            description,
          ])
        : text(unique) || identifier;
      return {
        id: layer + ":" + hash(key),
        layer,
        identifier,
        awardKey: text(unique),
        name,
        uei,
        amount,
        date,
        end: text(
          r[layer === "vehicles" ? "Last Date to Order" : "End Date"],
          30,
        ),
        description,
        agency: text(r["Awarding Agency"], 150),
        naics: code(r.NAICS),
        psc: code(r.PSC),
        origin: countryOf(location),
        city: cityOf(location),
        region: text(
          location?.state_code ||
            location?.state_name ||
            location?.foreign_province,
          100,
        ),
        postalCode: text(
          location?.zip5 ||
            location?.zip ||
            location?.zip_code ||
            location?.foreign_postal_code,
          30,
        ),
        performanceCountry: countryOf(pop),
        performanceCity: cityOf(pop),
        performancePostalCode: text(
          pop?.zip5 || pop?.zip || pop?.zip_code || pop?.foreign_postal_code,
          30,
        ),
        performanceState: text(
          pop?.state_code ||
            pop?.location_state_code ||
            pop?.state_name ||
            pop?.foreign_province,
          100,
        ),
        primeName: text(r["Prime Recipient Name"], 300),
        primeUEI: text(r["Prime Award Recipient UEI"], 30),
        primeID: prime,
        url: unique
          ? "https://www.usaspending.gov/award/" +
            encodeURIComponent(unique) +
            "/"
          : "https://www.usaspending.gov/search",
        source: "USAspending",
        retrievedAt,
        scope: { ...scope },
        locationPrecision: "country",
        aggregate:
          /^(MISCELLANEOUS (FOREIGN|DOMESTIC) AWARDEES|MULTIPLE RECIPIENTS|REDACTED|UNKNOWN|UNNAMED RECIPIENT)$/i.test(
            name,
          ),
      };
    })
    .filter(
      (r) =>
        scope.agency !== "civilian" ||
        !/^Department of (Defense|War)$/i.test(r.agency),
    );
  return {
    rows,
    hasNext: data.page_metadata.hasNext,
    messages: Array.isArray(data.messages)
      ? data.messages.map((v) => text(v))
      : [],
  };
}
export function dedupe(rows) {
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}
export function countryCode(value, countries) {
  if (!value) return "";
  const v = String(value).toUpperCase();
  return (
    countries.find((c) =>
      [
        c.code,
        c.iso2,
        c.name.toUpperCase(),
        c.official?.toUpperCase(),
      ].includes(v),
    )?.code || ""
  );
}
export function supplierKey(row) {
  // Missing UEIs stay separate by source and name + country. Never join across sources by fuzzy name.
  if (row.layer === "exclusions" && !row.uei) return row.id;
  return row.uei
    ? "uei:" + row.uei
    : row.layer +
        ":name:" +
        text(row.name).toUpperCase() +
        "|" +
        (row.origin || "unknown");
}
export function suppliers(rows, countries, selectedCountry) {
  const grouped = new Map();
  for (const r of rows) {
    if (r.aggregate) continue;
    const key = supplierKey(r);
    if (!grouped.has(key))
      grouped.set(key, {
        key,
        name: r.name,
        uei: r.uei,
        rows: [],
        origins: new Set(),
        layers: new Set(),
        buyers: new Set(),
        naics: new Set(),
      });
    const s = grouped.get(key);
    s.rows.push(r);
    s.layers.add(r.layer);
    const origin = countryCode(r.origin, countries);
    if (origin) s.origins.add(origin);
    if (r.agency) s.buyers.add(r.agency);
    if (r.naics) s.naics.add(r.naics);
  }
  return [...grouped.values()]
    .map((s) => ({
      ...s,
      origin: s.origins.size === 1 ? [...s.origins][0] : "",
      segment:
        s.origins.size !== 1
          ? "unknown"
          : [...s.origins][0] === selectedCountry
            ? "local"
            : [...s.origins][0] === "USA"
              ? "us"
              : "third",
      latest:
        s.rows
          .map((r) =>
            s.layers.size === 1 &&
            (s.layers.has("sam") || s.layers.has("exclusions"))
              ? r.retrievedAt
              : ["sam", "exclusions"].includes(r.layer)
                ? ""
                : r.date,
          )
          .filter(Boolean)
          .sort()
          .at(-1) || "",
      latestLabel:
        s.layers.size === 1 &&
        (s.layers.has("sam") || s.layers.has("exclusions"))
          ? s.layers.has("exclusions")
            ? "exclusion checked"
            : "registration checked"
          : "latest start / report",
      primeAmount: s.rows
        .filter((r) => r.layer === "awards" && r.amount !== null)
        .reduce((n, r) => n + r.amount, 0),
    }))
    .sort(
      (a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name),
    );
}
export function filterSuppliers(
  list,
  {
    query = "",
    segment = "all",
    layers = Object.keys(LAYERS),
    shortlistOnly = false,
    shortlist = [],
  } = {},
) {
  const q = query.trim().toLowerCase();
  return list.filter(
    (s) =>
      (segment === "all" || s.segment === segment) &&
      (!shortlistOnly || shortlist.includes(s.key)) &&
      s.rows.some((r) => layers.includes(r.layer)) &&
      (!q ||
        [
          s.name,
          s.uei,
          ...s.rows.map((r) =>
            [
              r.description,
              r.naics,
              r.psc,
              r.primeName,
              r.city,
              r.region,
              r.postalCode,
              r.performanceCity,
              r.performanceState,
              r.performancePostalCode,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
}
export function csv(rows) {
  const fields = [
    "name",
    "uei",
    "layer",
    "identifier",
    "origin",
    "city",
    "address",
    "region",
    "postalCode",
    "updated",
    "primaryNaics",
    "declaredIndustries",
    "performanceCountry",
    "performanceCity",
    "performancePostalCode",
    "performanceState",
    "description",
    "agency",
    "date",
    "end",
    "amount",
    "naics",
    "psc",
    "primeName",
    "primeUEI",
    "primeID",
    "awardKey",
    "program",
    "programVersion",
    "programRole",
    "parentAwardKey",
    "source",
    "url",
    "retrievedAt",
    "searchCountry",
    "searchFrom",
    "searchTo",
    "searchKeyword",
    "searchNAICS",
    "searchPSC",
    "searchAgency",
    "registrationQuery",
    "status",
    "expiration",
    "exclusion",
    "exclusionType",
    "exclusionProgram",
    "excludingAgency",
    "fascsaOrder",
    "exclusionActions",
  ];
  const cell = (v) =>
    '"' +
    String(typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? ""))
      .replace(/^[\s]*[=+@-]/, (m) => "'" + m)
      .replace(/"/g, '""') +
    '"';
  return (
    "\uFEFF" +
    [
      fields.map(cell).join(","),
      ...rows.map((r) => {
        const out = {
          ...r,
          searchCountry: r.scope?.country,
          searchFrom: r.scope?.from,
          searchTo: r.scope?.to,
          searchKeyword: r.scope?.q,
          searchNAICS: r.scope?.naics,
          searchPSC: r.scope?.psc,
          searchAgency: r.scope?.agency,
          registrationQuery: r.samQuery ? JSON.stringify(r.samQuery) : "",
        };
        return fields.map((k) => cell(out[k])).join(",");
      }),
    ].join("\r\n")
  );
}
export function validateSnapshot(data) {
  if (
    data?.schemaVersion !== 1 ||
    data?.source !== "SAM.gov" ||
    data?.sensitivity !== "PUBLIC" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data?.asOf || "") ||
    !Array.isArray(data.rows)
  )
    throw new Error("This is not a supported PUBLIC SAM snapshot.");
  const allowed = [
    "id",
    "layer",
    "identifier",
    "name",
    "uei",
    "origin",
    "city",
    "address",
    "region",
    "postalCode",
    "updated",
    "primaryNaics",
    "declaredIndustries",
    "naics",
    "psc",
    "status",
    "expiration",
    "purpose",
    "exclusion",
    "source",
    "url",
    "retrievedAt",
    "date",
    "description",
  ];
  if (data.rows.length > 1000000) throw new Error("Snapshot is too large.");
  const rows = data.rows.map((r) => {
    if (!r || typeof r !== "object" || !r.uei || !r.name || r.layer !== "sam")
      throw new Error("The SAM snapshot contains an invalid supplier row.");
    const row = Object.fromEntries(
      allowed.map((k) => [k, text(r[k], k === "description" ? 4000 : 400)]),
    );
    row.id = "sam:" + row.uei;
    row.amount = null;
    row.url = "https://sam.gov/search/?index=entity";
    row.source = "SAM.gov";
    row.retrievedAt = data.asOf;
    return row;
  });
  return { ...data, rows: dedupe(rows) };
}
export function samRowsForScope(snapshot, s, countries) {
  if (snapshot.query)
    return snapshot.query.country === s.country
      ? snapshot.rows.filter(
          (r) => countryCode(r.origin, countries) === s.country,
        )
      : [];
  return snapshot.rows.filter(
    (r) =>
      countryCode(r.origin, countries) === s.country &&
      (!s.naics ||
        r.naics.split(/[;, ]+/).some((c) => c.startsWith(s.naics))) &&
      (!s.psc || r.psc.split(/[;, ]+/).includes(s.psc)) &&
      (!s.q ||
        [r.name, r.description, r.naics, r.psc]
          .join(" ")
          .toLowerCase()
          .includes(s.q.toLowerCase())),
  );
}
