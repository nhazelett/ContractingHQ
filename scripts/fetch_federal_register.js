#!/usr/bin/env node

/*
  Fetch FAR/DFARS rulemaking data from FederalRegister.gov and write a static
  data bundle consumed by federal-register.html.

  No API key and no npm dependencies required.
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_JSON = path.join(ROOT, "data", "federal-register-live.json");
const OUT_JS = path.join(ROOT, "data", "federal-register-live.js");
const API = "https://www.federalregister.gov/api/v1/documents.json";

const FIELDS = [
  "title",
  "type",
  "publication_date",
  "effective_on",
  "comments_close_on",
  "dates",
  "action",
  "abstract",
  "document_number",
  "html_url",
  "pdf_url",
  "citation",
  "regulation_id_numbers",
  "cfr_references",
  "agencies",
  "excerpts"
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

const since = process.env.FEDREG_SINCE || daysAgo(540);

const QUERIES = [
  {
    label: "DFARS / DARS agency feed",
    params: {
      "conditions[agencies][]": "defense-acquisition-regulations-system"
    }
  },
  {
    label: "FAR system agency feed",
    params: {
      "conditions[agencies][]": "federal-acquisition-regulation-system"
    }
  },
  {
    label: "Federal Acquisition Regulation keyword feed",
    params: {
      "conditions[term]": '"Federal Acquisition Regulation"'
    }
  },
  {
    label: "Federal Acquisition Circular keyword feed",
    params: {
      "conditions[term]": '"Federal Acquisition Circular"'
    }
  },
  {
    label: "Federal contracting keyword feed",
    params: {
      "conditions[term]": '"federal contracting"'
    }
  }
];

function buildUrl(query, page = 1) {
  const url = new URL(API);
  url.searchParams.set("order", "newest");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("conditions[publication_date][gte]", since);
  FIELDS.forEach((field) => url.searchParams.append("fields[]", field));
  Object.entries(query.params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.append(key, value);
    }
  });
  return url;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "KTHQ ContractingHQ rulemaking watch"
    }
  });
  if (!res.ok) {
    throw new Error(`Federal Register API ${res.status}: ${url}`);
  }
  return res.json();
}

async function fetchQuery(query) {
  const first = await fetchJson(buildUrl(query, 1));
  const pages = Math.min(Number(first.total_pages || 1), 3);
  const all = [...(first.results || [])];
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchJson(buildUrl(query, page));
    all.push(...(next.results || []));
  }
  return all.map((doc) => ({ ...doc, _sourceQuery: query.label }));
}

function textOf(doc) {
  return [
    doc.title,
    doc.abstract,
    doc.action,
    doc.dates,
    ...(doc.agencies || []).map((a) => a.name || a.raw_name || a.slug || "")
  ].filter(Boolean).join(" ");
}

function cfrText(doc) {
  return (doc.cfr_references || [])
    .map((ref) => {
      if (!ref) return "";
      const title = ref.title ? `${ref.title} CFR` : "";
      const part = ref.part ? `part ${ref.part}` : "";
      return [title, part].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function agencySlugs(doc) {
  return (doc.agencies || []).map((a) => a.slug || "");
}

function isRelevant(doc) {
  const haystack = textOf(doc);
  const title = doc.title || "";
  const cfr = cfrText(doc);
  const slugs = agencySlugs(doc);
  const acquisitionAgency = slugs.some((slug) => [
    "defense-acquisition-regulations-system",
    "federal-acquisition-regulation-system",
    "federal-procurement-policy-office"
  ].includes(slug));

  if (acquisitionAgency) return true;
  if (/Federal Acquisition Circular/i.test(title)) return true;
  if (/Defense Federal Acquisition Regulation Supplement|DFARS/i.test(haystack)) return true;
  if (/Federal Acquisition Regulation|FAR\b/i.test(title) && /48 CFR|FAR\b|Federal Acquisition Regulation/i.test(haystack)) return true;
  if (/federal contracting|acquisition regulation|procurement policy/i.test(title)) return true;
  if (/Cost Accounting Standards/i.test(title) && /48 CFR/i.test(cfr)) return true;
  return false;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function classifySystem(doc) {
  const haystack = textOf(doc);
  const slugs = agencySlugs(doc);
  if (slugs.includes("defense-acquisition-regulations-system") || /DFARS|Defense Federal Acquisition Regulation Supplement|DARS/i.test(haystack)) return "DFARS";
  if (/Federal Acquisition Circular|Federal Acquisition Regulation|FAR\b/i.test(haystack)) return "FAR";
  if (/Cost Accounting Standards|CAS\b/i.test(haystack)) return "CAS";
  return "Acquisition";
}

function classifyStage(doc) {
  const type = doc.type || "";
  const text = `${doc.title || ""} ${doc.action || ""}`.toLowerCase();
  if (/proposed/i.test(type) || /proposed rule/.test(text)) return "Proposed rule";
  if (/interim/.test(text)) return "Interim rule";
  if (/rule/i.test(type)) return "Final rule";
  if (/information collection|omb control|burden/i.test(text)) return "Information collection";
  if (/presidential/i.test(type)) return "Executive action";
  return type || "Notice";
}

function classifyTopic(doc) {
  const t = textOf(doc).toLowerCase();
  const topics = [
    [/cyber|cmmc|cloud|incident|information security|data and computer software|technical data/, "Cyber / data rights"],
    [/small business|socioeconomic|set-aside|8\(a\)|hubzone|sdvosb|wosb/, "Small business"],
    [/competition|sole source|single source|fair opportunity|federal prison industries|mandatory source/, "Competition / sources"],
    [/payment|financing|performance-based payment|invoice|wawf/, "Payments"],
    [/threshold|trade agreement|tina|certified cost or pricing|inflation/, "Thresholds"],
    [/labor|wage|service contract|construction|davis-bacon|sick leave/, "Labor / construction"],
    [/clause|provision|representation|certification|reps and certs/, "Clauses / reps"],
    [/supply chain|domestic|buy american|made in america|country/, "Supply chain"],
    [/cost accounting|cas\b|gaap|cost principle/, "Cost / CAS"],
    [/contracting|procurement|acquisition/, "Acquisition policy"]
  ];
  const hit = topics.find(([regex]) => regex.test(t));
  return hit ? hit[1] : "General rulemaking";
}

function actionGuidance(doc, stage, topic) {
  const text = textOf(doc).toLowerCase();
  const openComment = Boolean(doc.comments_close_on && doc.comments_close_on >= isoDate(new Date()));
  const effectiveFuture = Boolean(doc.effective_on && doc.effective_on >= isoDate(new Date()));

  if (stage === "Proposed rule") {
    return {
      level: openComment ? "Comment window" : "Review",
      tone: openComment ? "active" : "watch",
      note: openComment
        ? "This is not binding yet, but the comment period is open. Read it if the topic touches your office and consider whether your organization should comment."
        : "This is proposed rulemaking, not a current requirement. Keep it on your radar for the final rule.",
      steps: ["Check the comment due date", "Skim the affected FAR/DFARS parts", "Flag it for policy or leadership if it touches your buying lane"]
    };
  }

  if (stage === "Final rule" || stage === "Interim rule") {
    return {
      level: effectiveFuture ? "Prepare update" : "Check templates",
      tone: "action",
      note: "This is implemented rulemaking. Check effective dates, affected parts, and whether your templates, clauses, review checklists, or training notes need to change.",
      steps: ["Read the effective date language", "Search local templates for the cited parts or clauses", "Tell the team if open acquisitions are affected"]
    };
  }

  if (stage === "Information collection") {
    return {
      level: "Monitor",
      tone: "monitor",
      note: "This is usually an administrative Paperwork Reduction Act notice, not a new contracting rule. It matters most when you rely on the cited representation, form, report, or system requirement.",
      steps: ["Identify the cited provision, clause, form, or system", "Comment only if your office has burden data or a process concern", "No template change unless a later rule follows"]
    };
  }

  if (/federal prison industries|mandatory source/.test(text)) {
    return {
      level: "Check source rules",
      tone: "action",
      note: "This can affect source selection and mandatory-source handling. New specialists should slow down here and verify whether the buy needs special market research, competition, or documentation.",
      steps: ["Check the listed product or service category", "Confirm whether FPI or another mandatory source applies", "Document the file before moving past the source requirement"]
    };
  }

  if (stage === "Executive action") {
    return {
      level: "Read soon",
      tone: "watch",
      note: "This is policy direction, not always clause text. It may drive later FAR/DFARS updates, agency memos, or implementation guidance.",
      steps: ["Read for policy direction", "Watch for implementing FAR/DFARS cases", "Do not change templates until implementation guidance exists"]
    };
  }

  return {
    level: "Awareness",
    tone: "monitor",
    note: `This is a ${topic.toLowerCase()} item. Read enough to know whether it touches your current workload, then monitor for follow-on implementation.`,
    steps: ["Skim the abstract", "Check whether the affected topic matches your portfolio", "Save the source link if it may affect an active file"]
  };
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/^Federal Acquisition Regulation;\s*/i, "FAR: ")
    .replace(/^Defense Federal Acquisition Regulation Supplement[;:\s]*/i, "DFARS: ")
    .replace(/^Defense Acquisition Regulations System[;:\s]*/i, "DARS: ")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text, max = 520) {
  const s = String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}...`;
}

function normalize(doc) {
  const stage = classifyStage(doc);
  const topic = classifyTopic(doc);
  const guidance = actionGuidance(doc, stage, topic);
  const agencies = unique((doc.agencies || []).map((a) => a.name || a.raw_name || a.slug));
  const regs = unique(doc.regulation_id_numbers || []);
  const cfr = cfrText(doc);
  const summary = shorten(doc.abstract || doc.excerpts || doc.action || doc.dates || "No Federal Register abstract was provided for this item.");

  return {
    id: doc.document_number || `${doc.publication_date}-${doc.title}`,
    documentNumber: doc.document_number || "",
    title: doc.title || "Untitled Federal Register item",
    shortTitle: cleanTitle(doc.title),
    system: classifySystem(doc),
    stage,
    topic,
    actionLevel: guidance.level,
    actionTone: guidance.tone,
    practitionerNote: guidance.note,
    nextSteps: guidance.steps,
    type: doc.type || "",
    publicationDate: doc.publication_date || "",
    effectiveDate: doc.effective_on || "",
    commentsCloseDate: doc.comments_close_on || "",
    datesText: doc.dates || "",
    actionText: doc.action || "",
    summary,
    citation: doc.citation || "",
    regulationIds: regs,
    cfrReferences: cfr,
    agencies,
    htmlUrl: doc.html_url || "",
    pdfUrl: doc.pdf_url || "",
    sourceQuery: doc._sourceQuery || ""
  };
}

function buildStats(items) {
  const byTone = items.reduce((acc, item) => {
    acc[item.actionTone] = (acc[item.actionTone] || 0) + 1;
    return acc;
  }, {});
  return {
    total: items.length,
    latestPublicationDate: items[0] ? items[0].publicationDate : "",
    openCommentWindows: items.filter((item) => item.commentsCloseDate && item.commentsCloseDate >= isoDate(new Date())).length,
    rules: items.filter((item) => /rule/i.test(item.stage)).length,
    byTone
  };
}

async function main() {
  const batches = await Promise.all(QUERIES.map(fetchQuery));
  const docs = batches.flat();
  const deduped = new Map();
  for (const doc of docs) {
    if (!isRelevant(doc)) continue;
    const key = doc.document_number || `${doc.publication_date}-${doc.title}`;
    if (!deduped.has(key)) deduped.set(key, doc);
  }

  const items = [...deduped.values()]
    .map(normalize)
    .sort((a, b) => {
      if (a.publicationDate !== b.publicationDate) return a.publicationDate < b.publicationDate ? 1 : -1;
      return a.shortTitle.localeCompare(b.shortTitle);
    });

  const payload = {
    generatedAt: new Date().toISOString(),
    since,
    source: {
      name: "Federal Register API",
      url: "https://www.federalregister.gov/developers/documentation/api/v1",
      queries: QUERIES.map((q) => q.label)
    },
    note: "Automated KTHQ rulemaking watch. Practitioner notes are deterministic triage guidance based on document type and topic; they are not legal advice.",
    stats: buildStats(items),
    items
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(OUT_JS, `window.KTHQ_FEDREG_DATA = ${JSON.stringify(payload, null, 2)};\n`);
  console.log(`Wrote ${items.length} items to ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_JS)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
