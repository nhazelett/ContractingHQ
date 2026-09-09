import {
  clean,
  safeURL,
  validDate,
  today,
  record,
} from "./core.mjs?v=20260909-3";

export const CATEGORIES = [
  {
    id: "general",
    name: "General products",
    examples: ["Equipment", "Consumable supplies", "Replacement parts"],
    questions: [
      "What outcome must the product support?",
      "Which specifications are essential, and which are preferences?",
      "Is the price for one item, a package, a rental period, or a subscription?",
      "What delivery, compatibility, warranty, and lifecycle costs need checking?",
    ],
    sources: ["grainger", "thomas", "homedepot", "uline", "cdw", "staples"],
  },
  {
    id: "power",
    name: "Generators & power equipment",
    examples: [
      "Portable inverter generator",
      "Conventional portable generator",
      "Mobile diesel generator",
      "Permanent standby generator",
    ],
    questions: [
      "What continuous output, starting load, voltage, and phase are needed?",
      "Does the application need portable, mobile, or permanent equipment?",
      "Which fuel, runtime, noise, environmental, and maintenance constraints apply?",
      "Does the price include transfer equipment, installation, commissioning, or delivery?",
    ],
    sources: [
      "honda",
      "generac",
      "grainger",
      "thomas",
      "homedepot",
      "northern",
    ],
  },
  {
    id: "it",
    name: "Computers & IT equipment",
    examples: [
      "Business laptop",
      "Desktop workstation",
      "Computer monitor",
      "Network switch",
    ],
    questions: [
      "Which software, performance, ports, and interoperability requirements matter?",
      "Are memory, storage, accessories, and exact configurations comparable?",
      "Are licensing, warranty, support, and device management included?",
      "Is the offer a one-time purchase, lease, or recurring subscription?",
    ],
    sources: ["dell", "cdw", "staples", "thomas"],
  },
  {
    id: "facility",
    name: "Facilities & industrial supplies",
    examples: [
      "Industrial fan",
      "Commercial water pump",
      "Material handling cart",
      "Replacement air filter",
    ],
    questions: [
      "What dimensions, ratings, materials, and operating conditions are needed?",
      "Are replacement parts compatible with the existing equipment?",
      "Are consumables and installation included in the price?",
      "What access, delivery, maintenance, and lead-time constraints apply?",
    ],
    sources: ["grainger", "thomas", "homedepot", "northern", "uline"],
  },
  {
    id: "office",
    name: "Office furniture & supplies",
    examples: [
      "Office task chair",
      "Adjustable desk",
      "Storage cabinet",
      "Copy paper",
    ],
    questions: [
      "What size, capacity, adjustability, and durability are required?",
      "How many items, sheets, or packages does the listed price cover?",
      "Are assembly, delivery, and old-item removal included?",
      "What warranty and replacement support are available?",
    ],
    sources: ["staples", "uline", "thomas", "homedepot"],
  },
  {
    id: "cleaning",
    name: "Cleaning supplies & equipment",
    examples: [
      "Commercial floor scrubber",
      "Commercial vacuum",
      "Trash liners",
      "Paper towels",
    ],
    questions: [
      "What surfaces, area, capacity, and operating conditions must be supported?",
      "Are package counts, sheet sizes, or usable quantities comparable?",
      "What accessories and recurring consumables are required?",
      "What handling, storage, training, and maintenance information needs review?",
    ],
    sources: ["uline", "grainger", "homedepot", "staples", "thomas"],
  },
];
const SITES = {
  grainger: [
    "Grainger",
    "grainger.com",
    "Industrial equipment and maintenance supplies",
  ],
  thomas: [
    "Thomasnet",
    "thomasnet.com",
    "Manufacturer and distributor discovery",
  ],
  homedepot: [
    "The Home Depot",
    "homedepot.com",
    "Equipment and facilities product listings",
  ],
  uline: ["Uline", "uline.com", "Packaging, storage, and janitorial supplies"],
  cdw: ["CDW", "cdw.com", "Computers, networking, and IT configurations"],
  staples: ["Staples", "staples.com", "Office supplies and furniture"],
  honda: [
    "Honda Power Equipment",
    "powerequipment.honda.com",
    "Generator models and manufacturer specifications",
  ],
  generac: [
    "Generac",
    "generac.com",
    "Portable, mobile, and standby power equipment",
  ],
  northern: ["Northern Tool", "northerntool.com", "Tools and equipment"],
  dell: [
    "Dell",
    "dell.com",
    "Manufacturer configurations and product specifications",
  ],
};
export function categoryFor(query) {
  if (/generator|backup power|standby power/i.test(query)) return "power";
  if (/laptop|computer|monitor|network|workstation/i.test(query)) return "it";
  if (
    /janitorial|cleaning|vacuum|scrubber|trash liner|paper towel/i.test(query)
  )
    return "cleaning";
  if (/chair|desk|office|copy paper/i.test(query)) return "office";
  if (/pump|industrial|filter|facility|facilities|hvac/i.test(query))
    return "facility";
  return "general";
}
export function commercialLinks(query, category = "general") {
  const q = clean(query, 180).trim();
  if (!q) return [];
  const search = (text, shopping = false) => {
    const u = new URL("https://www.google.com/search");
    u.searchParams.set("q", text);
    if (shopping) u.searchParams.set("tbm", "shop");
    return u.href;
  };
  const c = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  return [
    {
      name: "Google Shopping",
      description: "Explore advertised product offers across sellers.",
      url: search(q, true),
      label: "Open shopping search",
    },
    {
      name: "Manufacturer discovery",
      description:
        "Find original specifications, model families, and manufacturer pages.",
      url: search(q + " manufacturer specifications"),
      label: "Open web search",
    },
    ...c.sources.map((id) => {
      const [name, domain, description] = SITES[id];
      return {
        name,
        description,
        url: search("site:" + domain + " " + q),
        label: "Search this site via Google",
      };
    }),
  ];
}
export function packageUnitPrice(price, units) {
  if (String(price ?? "").trim() === "" || String(units ?? "").trim() === "")
    return null;
  const amount = Number(price),
    quantity = Number(units);
  return Number.isFinite(amount) &&
    Number.isFinite(quantity) &&
    amount >= 0 &&
    quantity > 0 &&
    Number.isFinite(amount / quantity)
    ? amount / quantity
    : null;
}
export function formatPrice(amount, currency = "USD") {
  if (!Number.isFinite(amount) || amount < 0) return "Not recorded";
  if (!/^[A-Z]{3}$/.test(currency))
    return String(amount) + " (currency not recorded)";
  const tiny = amount > 0 && amount < 0.0001;
  const value = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(tiny ? 0.0001 : amount);
  return (tiny ? "< " : "") + value + " " + currency;
}
export function productValues(e) {
  const f = e.facts || {};
  return {
    title: e.title,
    company: e.company,
    url: e.url,
    date: e.date,
    model: f.Model || "",
    condition: f.Condition || "Not reported",
    basis: f["Price basis"] || "Advertised price",
    currency: f.Currency || "USD",
    price: f["Package price"] ?? "",
    units: f["Units per package"] ?? "",
    unit: f.Unit || "",
    shipping: f.Shipping || "",
    installation: f["Installation / other costs"] || "",
    terms: f.Terms || "",
    specs: e.description || "",
    note: e.note || "",
  };
}
export const worksheetProducts = (evidence) =>
  evidence.filter(
    (e) => e.kind === "product" && e.facts?.["Worksheet version"] === "1",
  );
export function productEvidence(raw, existing = null) {
  const title = clean(raw.title, 300).trim(),
    company = clean(raw.company, 250).trim(),
    url = safeURL(raw.url),
    date = clean(raw.date, 10);
  if (!title || !company || !url)
    throw new Error(
      "Enter a product name, seller, and valid public source URL.",
    );
  if (!validDate(date) || date > today())
    throw new Error("Use a valid source-check date no later than today.");
  if (
    ![
      "Advertised price",
      "MSRP",
      "Public quotation",
      "Quote required",
    ].includes(raw.basis)
  )
    throw new Error("Choose a valid price basis.");
  if (!["New", "Used", "Refurbished", "Not reported"].includes(raw.condition))
    throw new Error("Choose a valid condition.");
  if (!["USD", "CAD", "EUR", "GBP", "JPY", "AUD"].includes(raw.currency))
    throw new Error("Choose a supported currency.");
  const price =
      raw.basis === "Quote required" ? "" : clean(raw.price, 40).trim(),
    units = clean(raw.units, 40).trim(),
    unit = clean(raw.unit, 60).trim();
  if (price !== "" && (!Number.isFinite(Number(price)) || Number(price) < 0))
    throw new Error("Enter a nonnegative package price, or leave it blank.");
  if (units !== "" && (!Number.isFinite(Number(units)) || Number(units) <= 0))
    throw new Error(
      "Units per package must be greater than zero, or left blank.",
    );
  if (price !== "" && units !== "" && !unit)
    throw new Error(
      "Name the unit of measure before calculating a unit price.",
    );
  const perUnit = packageUnitPrice(price, units);
  const r = record("manual", {
    key: existing?.id || crypto.randomUUID(),
    title,
    company,
    url,
    date,
    description: clean(raw.specs, 4000),
    kind: "product",
    facts: {
      "Worksheet version": "1",
      Model: clean(raw.model, 250),
      Condition: raw.condition,
      "Price basis": raw.basis,
      Currency: raw.currency,
      "Package price": price,
      "Units per package": units,
      Unit: unit,
      "Unit price":
        raw.basis === "Quote required"
          ? "Quote required"
          : perUnit === null
            ? "Not recorded"
            : formatPrice(perUnit, raw.currency) + " per " + unit,
      Shipping: clean(raw.shipping, 600),
      "Installation / other costs": clean(raw.installation, 600),
      Terms: clean(raw.terms, 600),
    },
  });
  return {
    ...r,
    id: existing?.id || r.id,
    citation: existing?.citation,
    retrievedAt: new Date().toISOString(),
    query: "Commercial product worksheet",
    scope:
      "Researcher-entered product and price information; no automated retrieval or refresh. Unit price is package price divided by units and does not include separately recorded costs.",
    note: clean(raw.note, 8000),
    verification: "Needs verification",
  };
}

export function comparisonCSV(evidence) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^(?=\s*[=+@-]|[\t\r\n])/, "'")
      .replace(/"/g, '""') +
    '"';
  const rows = [
    [
      "Citation",
      "Product",
      "Seller",
      "Model",
      "Condition",
      "Price basis",
      "Currency",
      "Package price",
      "Units per package",
      "Unit",
      "Calculated unit price",
      "Date checked",
      "Source URL",
      "Shipping / delivery",
      "Installation / other costs",
      "Specifications",
      "Terms",
      "Requirement fit",
      "Verification",
    ],
    ...worksheetProducts(evidence).map((e) => {
      const p = productValues(e);
      return [
        e.citation,
        p.title,
        p.company,
        p.model,
        p.condition,
        p.basis,
        p.currency,
        p.basis === "Quote required" ? "" : p.price,
        p.units,
        p.unit,
        p.basis === "Quote required"
          ? "Quote required"
          : (packageUnitPrice(p.price, p.units) ?? "Not recorded"),
        p.date,
        p.url,
        p.shipping,
        p.installation,
        p.specs,
        p.terms,
        p.note,
        e.verification,
      ];
    }),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
