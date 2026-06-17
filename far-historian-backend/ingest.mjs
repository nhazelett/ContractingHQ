/**
 * FAR Historian — annual tier ingester (run locally, one time).
 *
 * Downloads the GovInfo annual Title 48 editions (1996-2016), parses the
 * older GPO SECTION/SECTNO schema, and writes Cloudflare KV bulk files.
 *
 *   node ingest.mjs                 # all years 1996-2016
 *   node ingest.mjs 2000 2010       # a custom range
 *
 * Then upload (one command per emitted file):
 *   wrangler kv bulk put ./out/kv-far-1996.json   --binding FAR_KV --remote
 *   wrangler kv bulk put ./out/kv-idx.json         --binding FAR_KV --remote
 *   wrangler kv bulk put ./out/kv-hist.json        --binding FAR_KV --remote
 *
 * Requires Node 18+ (global fetch). No dependencies.
 */

import { mkdir, writeFile } from "node:fs/promises";

const START = parseInt(process.argv[2] || "1996", 10);
const END   = parseInt(process.argv[3] || "2016", 10);
const OUT   = "./out";
const MAX_PER_FILE = 9000; // stay under wrangler's 10k-pair bulk limit

const strip = (s) =>
  (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

// Parse one annual volume's XML into FAR (chapter 1, parts 1-53) sections.
function parseVolume(xml) {
  const out = [];
  const secRe = /<SECTION>([\s\S]*?)<\/SECTION>/g;
  let m;
  while ((m = secRe.exec(xml))) {
    const blk = m[1];
    const noRaw = (blk.match(/<SECTNO>([\s\S]*?)<\/SECTNO>/) || [])[1];
    if (!noRaw) continue;
    const sectno = strip(noRaw).replace(/^§?\s*/, "");
    const lead = parseInt(sectno, 10);
    if (!(lead >= 1 && lead <= 53)) continue; // FAR only
    const subj =
      strip((blk.match(/<SUBJECT>([\s\S]*?)<\/SUBJECT>/) || [])[1] ||
            (blk.match(/<SECHD>([\s\S]*?)<\/SECHD>/) || [])[1] || "");
    const paras = [...blk.matchAll(/<(?:P|FP)>([\s\S]*?)<\/(?:P|FP)>/g)]
      .map((x) => strip(x[1])).filter(Boolean);
    const cita = strip((blk.match(/<CITA>([\s\S]*?)<\/CITA>/) || [])[1] || "");
    if (!paras.length && !subj) continue;
    out.push({ sectno, subj, text: paras.join("\n\n"), cita });
  }
  return out;
}

async function volumesFor(year) {
  const r = await fetch(`https://www.govinfo.gov/bulkdata/json/CFR/${year}/title-48`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`dir ${year}: ${r.status}`);
  const files = (await r.json()).files || [];
  return files
    .filter((f) => /-vol\d+\.xml$/i.test(f.name))
    .map((f) => f.link)
    .sort();
}

async function getText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch (e) { /* retry */ }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  throw new Error("fetch failed: " + url);
}

async function dumpBulk(name, pairs) {
  // pairs: [{key, value}]; chunk to respect the bulk-size cap.
  if (pairs.length <= MAX_PER_FILE) {
    await writeFile(`${OUT}/${name}.json`, JSON.stringify(pairs));
    console.log(`  wrote ${OUT}/${name}.json (${pairs.length})`);
    return [`${name}.json`];
  }
  const files = [];
  for (let i = 0, part = 1; i < pairs.length; i += MAX_PER_FILE, part++) {
    const fn = `${name}-${part}.json`;
    await writeFile(`${OUT}/${fn}`, JSON.stringify(pairs.slice(i, i + MAX_PER_FILE)));
    console.log(`  wrote ${OUT}/${fn} (${Math.min(MAX_PER_FILE, pairs.length - i)})`);
    files.push(fn);
  }
  return files;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const hist = new Map();   // sectno -> Set(years)
  const idxPairs = [];      // far:idx:{year}
  const emitted = [];

  for (let year = START; year <= END; year++) {
    process.stdout.write(`\n${year}: `);
    let vols;
    try { vols = await volumesFor(year); }
    catch (e) { console.log("skip (" + e.message + ")"); continue; }

    const seen = new Map(); // sectno -> record (dedupe within the year)
    for (const v of vols) {
      process.stdout.write(".");
      const xml = await getText(v);
      if (!xml) continue;
      for (const s of parseVolume(xml)) {
        if (!seen.has(s.sectno)) seen.set(s.sectno, s);
      }
    }
    const sectnos = [...seen.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }));
    console.log(` ${sectnos.length} FAR sections`);

    const secPairs = sectnos.map((sn) => ({
      key: `far:sec:${year}:${sn}`,
      value: JSON.stringify({ year, sectno: sn, ...seen.get(sn) }),
    }));
    emitted.push(...await dumpBulk(`kv-far-${year}`, secPairs));

    idxPairs.push({ key: `far:idx:${year}`, value: JSON.stringify(sectnos) });
    for (const sn of sectnos) {
      if (!hist.has(sn)) hist.set(sn, new Set());
      hist.get(sn).add(year);
    }
  }

  // reverse index: section -> [years present]
  const histPairs = [...hist.entries()].map(([sn, yrs]) => ({
    key: `far:hist:${sn}`,
    value: JSON.stringify([...yrs].sort()),
  }));
  emitted.push(...await dumpBulk("kv-idx", idxPairs));
  emitted.push(...await dumpBulk("kv-hist", histPairs));

  console.log(`\nDone. ${emitted.length} bulk file(s) in ${OUT}/`);
  console.log("Upload each with:");
  for (const f of emitted)
    console.log(`  wrangler kv bulk put ${OUT}/${f} --binding FAR_KV --remote`);
}

main().catch((e) => { console.error(e); process.exit(1); });
