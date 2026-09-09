import {
  clean,
  safeURL,
  validDate,
  today,
  record,
} from "./core.mjs?v=20260909-5";

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
