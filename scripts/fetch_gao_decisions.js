#!/usr/bin/env node

/*
  Fetch recent GAO legal products, filter for bid-protest style decisions,
  and write a static data bundle consumed by gao-decisions.html.

  GAO's RSS feed is the reliable source. The recent decisions page and product
  pages are treated as optional enrichment because GAO may block automated HTML
  fetches from some networks.
*/

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "gao-live.json");
const OUT_JS = path.join(ROOT, "data", "gao-live.js");
const RSS_URL = "https://www.gao.gov/rss/reportslegal.xml";
const RECENT_URL = "https://www.gao.gov/legal/bid-protests/recent";
const MAX_RSS_ITEMS = Number(process.env.GAO_MAX_RSS_ITEMS || 120);
const MAX_OUTPUT_ITEMS = Number(process.env.GAO_MAX_OUTPUT_ITEMS || 36);
const MAX_PRODUCT_FETCHES = Number(process.env.GAO_MAX_PRODUCT_FETCHES || 18);

const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12"
};

function nowIso() {
  return new Date().toISOString();
}

function dateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...");
}

function cleanText(value) {
  return htmlDecode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlToLines(html) {
  return htmlDecode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(h[1-6]|p|li|div|section|article|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function shorten(value, max = 420) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

async function fetchText(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        "user-agent": "KTHQ ContractingHQ GAO protest watch (+https://kthq.org/contact.html)"
      }
    });
    if (!res.ok) {
      const err = new Error(`${label} returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return {
      ok: true,
      status: res.status,
      text: await res.text()
    };
  } catch (err) {
    return {
      ok: false,
      status: err.status || "",
      error: err.message || String(err),
      text: ""
    };
  } finally {
    clearTimeout(timeout);
  }
}

function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? htmlDecode(match[1]).trim() : "";
}

function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, MAX_RSS_ITEMS)
    .map((match) => {
      const item = match[1];
      const title = cleanText(firstTag(item, "title"));
      const link = cleanText(firstTag(item, "link"));
      const description = cleanText(firstTag(item, "description"));
      const pubDateRaw = cleanText(firstTag(item, "pubDate"));
      const guid = cleanText(firstTag(item, "guid"));
      return {
        title,
        link,
        description,
        pubDateRaw,
        publicationDate: dateOnly(pubDateRaw),
        guid
      };
    });
}

function bNumbers(value) {
  let text = String(value || "").replace(/%2c/gi, ",");
  try {
    text = decodeURIComponent(text);
  } catch (_) {
    // Keep the partially decoded text.
  }
  return [...text.matchAll(/\bB-\d{5,6}(?:\.\d+)?\b/gi)]
    .map((m) => m[0].toUpperCase())
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function itemKey(item) {
  const nums = bNumbers(`${item.title} ${item.link} ${item.description}`);
  if (nums.length) return nums.join(",");
  return normalizeKey(item.link || item.title);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/www\.gao\.gov\/products\//, "")
    .replace(/%2c/g, ",")
    .replace(/[^a-z0-9.,-]+/g, "")
    .trim();
}

function isLikelyBidProtest(item) {
  const text = `${item.title} ${item.description} ${item.link}`.toLowerCase();
  if (!/\/products\/b-/i.test(item.link)) return false;
  if (/gao reviewed|congressional review act|antideficiency|professional standards update|federal vacancies reform act/i.test(text)) return false;
  return /protest|protests|protested|reconsideration|corrective action|solicitation|request for proposals|\brfp\b|\brfq\b|task order|award of|contract modification|sole-source|non-selection|reprocurement|indefinite-delivery|idiq|quote|proposal|offeror/i.test(text);
}

function parseRecentPage(html) {
  const lines = stripHtmlToLines(html);
  const out = new Map();
  const currentYear = new Date().getUTCFullYear();

  for (let i = 0; i < lines.length; i += 1) {
    const dateMatch = lines[i].match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})$/i);
    if (!dateMatch) continue;

    const month = MONTHS[dateMatch[1].toLowerCase()];
    const day = String(dateMatch[2]).padStart(2, "0");
    const date = `${currentYear}-${month}-${day}`;
    const caseName = lines[i + 1] || "";
    const decisionLine = lines[i + 2] || "";
    const bLine = lines[i + 3] || "";
    const nums = bNumbers(bLine);
    if (!caseName || !/^We\s/i.test(decisionLine) || !nums.length) continue;

    const parsed = {
      caseName,
      decisionLine,
      date,
      outcome: classifyOutcome(decisionLine),
      outcomeSource: "GAO recent decisions page"
    };
    out.set(nums.join(","), parsed);
    nums.forEach((num) => out.set(num, parsed));
  }

  return out;
}

function classifyOutcome(value) {
  const text = String(value || "").toLowerCase();
  const outcomes = [];
  if (/\bsustain|sustained|grant/.test(text)) outcomes.push("sustained");
  if (/\bdeny|denied\b/.test(text)) outcomes.push("denied");
  if (/\bdismiss|dismissed\b/.test(text)) outcomes.push("dismissed");
  if (/\breconsideration\b/.test(text)) outcomes.push("reconsideration");
  if (outcomes.includes("sustained") && (outcomes.includes("denied") || outcomes.includes("dismissed"))) return "mixed";
  if (outcomes.includes("sustained")) return "sustained";
  if (outcomes.includes("dismissed") && outcomes.includes("denied")) return "mixed";
  if (outcomes.includes("dismissed")) return "dismissed";
  if (outcomes.includes("denied")) return "denied";
  if (outcomes.includes("reconsideration")) return "reconsideration";
  return "unclassified";
}

function extractBetween(text, startRx, endRx, max = 1200) {
  const start = text.search(startRx);
  if (start === -1) return "";
  const after = text.slice(start).replace(startRx, "").trim();
  const end = after.search(endRx);
  const chunk = end === -1 ? after : after.slice(0, end);
  return shorten(chunk, max);
}

function parseProductPage(html) {
  const lines = stripHtmlToLines(html);
  const text = lines.join("\n");
  const digest = extractBetween(text, /^DIGEST\s*/im, /^(DECISION|View Decision|DOCUMENT FOR PUBLIC RELEASE|This version)/im, 1300);
  const highlights = extractBetween(text, /^Highlights\s*/im, /^(View Decision|Full Report|Recommendations|DIGEST|Matter of:)/im, 900);
  const matterLine = lines.find((line) => /^Matter of:/i.test(line)) || "";
  const fileLine = lines.find((line) => /^File:/i.test(line)) || "";
  const dateLine = lines.find((line) => /^Date:/i.test(line)) || "";

  const decisionLines = lines.filter((line) => /^We\s+(deny|sustain|dismiss|grant)/i.test(line));
  const decisionLine = decisionLines[0] || "";

  return {
    digest,
    highlights,
    matter: matterLine.replace(/^Matter of:\s*/i, ""),
    file: fileLine.replace(/^File:\s*/i, ""),
    date: dateLine.replace(/^Date:\s*/i, ""),
    decisionLine,
    outcome: classifyOutcome(`${decisionLine} ${digest}`)
  };
}

function classifyTopic(item, product) {
  const text = `${item.title} ${item.description} ${product.digest || ""} ${product.highlights || ""}`.toLowerCase();
  const hits = [];
  const checks = [
    [/timely|untimely|10-day|ten-day|deadline|filed late|late filing/, "Timeliness"],
    [/disparate treatment|unequal|evaluat|weakness|strength|rating|technical/, "Evaluation"],
    [/corrective action|scope of.*corrective/, "Corrective action"],
    [/organizational conflict|conflict of interest|\boci\b/, "OCI"],
    [/sole-source|sole source|single-source|bridge contract/, "Sole source"],
    [/discussion|final proposal revision|\bfpr\b/, "Discussions / FPR"],
    [/solicitation|ambiguity|patent|latent|unstated|requirement/, "Solicitation terms"],
    [/price|cost|compensation|realism/, "Price / cost"],
    [/key personnel|staffing|personnel/, "Staffing"],
    [/small business|8\(a\)|sdvosb|hubzone|set-aside|size/, "Small business"],
    [/task order|idiq|indefinite-delivery|fss|schedule/, "Orders / IDIQ"]
  ];
  checks.forEach(([rx, label]) => {
    if (rx.test(text)) hits.push(label);
  });
  return hits.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);
}

function practitionerNote(tags, outcome) {
  if (tags.includes("Timeliness")) {
    return "Watch the clock. GAO filing windows are unforgiving, and late supplemental grounds usually die even when the underlying issue matters.";
  }
  if (tags.includes("Evaluation")) {
    return "Evaluation records need traceable reasoning. The file should show what the evaluators read, why it mattered, and how the same standard was applied across offerors.";
  }
  if (tags.includes("Solicitation terms")) {
    return "If the requirement matters, say it clearly in the solicitation. Ambiguity and unstated evaluation preferences are protest fuel.";
  }
  if (tags.includes("OCI")) {
    return "OCI issues need a real investigation and contemporaneous documentation. A generic mitigation memo rarely carries the day.";
  }
  if (tags.includes("Corrective action")) {
    return "Corrective action is broad, but not unlimited. Tie the scope to the procurement defect and document why the remedy fits.";
  }
  if (outcome === "sustained") {
    return "Read sustained decisions closely. They usually point to a file habit that can be fixed before the next protest.";
  }
  return "Skim the official synopsis, then read the decision if the facts resemble an active acquisition in your office.";
}

function outcomeLabel(outcome) {
  return {
    sustained: "Sustained",
    denied: "Denied",
    dismissed: "Dismissed",
    mixed: "Mixed",
    reconsideration: "Reconsideration",
    unclassified: "Read Decision"
  }[outcome] || "Read Decision";
}

function normalizeItem(item, recentMap, productMap, legacyMap) {
  const nums = bNumbers(`${item.title} ${item.link} ${item.description}`);
  const key = itemKey(item);
  const recent = recentMap.get(key) || nums.map((num) => recentMap.get(num)).find(Boolean) || {};
  const product = productMap.get(key) || {};
  const legacy = legacyMap.get(key) || nums.map((num) => legacyMap.get(num)).find(Boolean) || {};
  const legacyOutcome = legacy.outcome ? classifyOutcome(`${legacy.outcome} ${legacy.bottomLine || ""}`) : "";
  const productDate = dateOnly(product.date || "");
  const date = productDate || recent.date || item.publicationDate || "";
  const decisionLine = product.decisionLine || recent.decisionLine || legacy.bottomLine || "";
  const outcome = product.outcome && product.outcome !== "unclassified"
    ? product.outcome
    : (recent.outcome || legacyOutcome || classifyOutcome(`${decisionLine} ${item.description}`));
  const tags = classifyTopic(item, product);

  return {
    id: key,
    caseName: product.matter || recent.caseName || item.title,
    title: item.title,
    bNumbers: nums,
    bNumberText: nums.join(", "),
    link: item.link,
    publicationDate: item.publicationDate,
    decisionDate: date,
    displayDate: displayDate(date || item.publicationDate),
    outcome,
    outcomeLabel: outcomeLabel(outcome),
    outcomeSource: product.decisionLine ? "GAO product page" : (recent.outcomeSource || (legacy.outcome ? "KTHQ legacy holding cache" : "Inferred from GAO RSS")),
    decisionLine,
    officialSynopsis: shorten(item.description, 520),
    highlights: product.highlights || "",
    digest: product.digest || "",
    tags,
    practitionerNote: practitionerNote(tags, outcome),
    sourceStatus: product.status || "rss",
    sourceStatusLabel: product.status === "product-page" ? "Product page enriched" : "RSS fallback"
  };
}

function buildStats(items, sourceStatus) {
  const byOutcome = items.reduce((acc, item) => {
    acc[item.outcome] = (acc[item.outcome] || 0) + 1;
    return acc;
  }, {});
  return {
    total: items.length,
    latestDecisionDate: items[0] ? (items[0].decisionDate || items[0].publicationDate) : "",
    sustained: byOutcome.sustained || 0,
    denied: byOutcome.denied || 0,
    dismissed: byOutcome.dismissed || 0,
    mixed: byOutcome.mixed || 0,
    unclassified: byOutcome.unclassified || 0,
    sourceStatus
  };
}

async function fetchProductMap(items) {
  const productMap = new Map();
  let attempted = 0;
  let enriched = 0;
  let blocked = 0;

  for (const item of items.slice(0, MAX_PRODUCT_FETCHES)) {
    attempted += 1;
    const res = await fetchText(item.link, "GAO product page");
    const key = itemKey(item);
    if (!res.ok) {
      if (res.status === 403) blocked += 1;
      productMap.set(key, { status: "rss", error: res.error });
      continue;
    }
    const parsed = parseProductPage(res.text);
    productMap.set(key, { ...parsed, status: "product-page" });
    enriched += 1;
  }

  return { productMap, attempted, enriched, blocked };
}

function loadLegacyMap() {
  const legacyPath = path.join(ROOT, "data", "gao.js");
  const legacyMap = new Map();
  if (!fs.existsSync(legacyPath)) return { legacyMap, count: 0 };

  try {
    const code = fs.readFileSync(legacyPath, "utf8");
    const context = {};
    vm.createContext(context);
    vm.runInContext(`${code}\nthis.GAO_UPDATES = GAO_UPDATES;`, context, {
      filename: legacyPath,
      timeout: 1000
    });
    const weeks = Array.isArray(context.GAO_UPDATES) ? context.GAO_UPDATES : [];
    weeks.forEach((week) => {
      (week.decisions || []).forEach((decision) => {
        const item = {
          title: decision.caseName || "",
          link: decision.link || "",
          description: decision.caseNumber || ""
        };
        const entry = {
          caseName: decision.caseName || "",
          caseNumber: decision.caseNumber || "",
          link: decision.link || "",
          outcome: decision.outcome || "",
          bottomLine: decision.bottomLine || "",
          takeaway: decision.takeaway || ""
        };
        const key = itemKey(item);
        if (key) legacyMap.set(key, entry);
        bNumbers(`${decision.caseNumber || ""} ${decision.link || ""}`).forEach((num) => {
          legacyMap.set(num, entry);
        });
      });
    });
  } catch (err) {
    console.warn(`Could not load legacy GAO cache: ${err.message}`);
  }

  return { legacyMap, count: legacyMap.size };
}

async function main() {
  const rss = await fetchText(RSS_URL, "GAO RSS");
  if (!rss.ok) {
    throw new Error(`Could not fetch GAO RSS: ${rss.error}`);
  }

  const allRss = parseRss(rss.text);
  const protestItems = allRss
    .filter(isLikelyBidProtest)
    .slice(0, MAX_OUTPUT_ITEMS);

  const recent = await fetchText(RECENT_URL, "GAO recent decisions page");
  const recentMap = recent.ok ? parseRecentPage(recent.text) : new Map();
  const productResult = await fetchProductMap(protestItems);
  const legacyResult = loadLegacyMap();

  const items = protestItems
    .map((item) => normalizeItem(item, recentMap, productResult.productMap, legacyResult.legacyMap))
    .sort((a, b) => {
      const ad = a.decisionDate || a.publicationDate || "";
      const bd = b.decisionDate || b.publicationDate || "";
      if (ad !== bd) return ad < bd ? 1 : -1;
      return a.caseName.localeCompare(b.caseName);
    });

  const sourceStatus = {
    rss: { ok: true, url: RSS_URL, itemCount: allRss.length },
    recentPage: recent.ok
      ? { ok: true, url: RECENT_URL, parsedOutcomes: recentMap.size }
      : { ok: false, url: RECENT_URL, error: recent.error, status: recent.status },
    productPages: {
      attempted: productResult.attempted,
      enriched: productResult.enriched,
      blocked: productResult.blocked
    },
    legacyCache: {
      entries: legacyResult.count
    }
  };

  const payload = {
    generatedAt: nowIso(),
    source: {
      name: "U.S. Government Accountability Office",
      rssUrl: RSS_URL,
      recentDecisionsUrl: RECENT_URL
    },
    note: "Automated KTHQ GAO protest watch. Official synopsis/digest text comes from GAO sources when available. Practitioner notes are deterministic triage prompts, not legal advice.",
    stats: buildStats(items, sourceStatus),
    items
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(OUT_JS, `window.KTHQ_GAO_DATA = ${JSON.stringify(payload, null, 2)};\n`);
  console.log(`Wrote ${items.length} GAO protest items to ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_JS)}`);
  if (!recent.ok) console.log(`Recent page fallback: ${recent.error}`);
  if (productResult.blocked) console.log(`Product pages blocked: ${productResult.blocked}/${productResult.attempted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
