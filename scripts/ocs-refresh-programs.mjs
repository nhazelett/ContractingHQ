// Manual public USAspending catalog refresh. No credentials or recurring pulls.
import { readFile, writeFile, rename } from "node:fs/promises";
import { catalogRows } from "../ocs-atlas/programs-core.mjs";
const base = new URL("../ocs-atlas/data/", import.meta.url);
const names = ["afcap", "logcap", "wexmac", "wexmac-expanded"];
const pulls = [];
for (const name of names) {
  const file = new URL("program-" + name + "-source.json", base);
  const prior = JSON.parse(await readFile(file, "utf8"));
  if (process.argv.includes("--from-snapshots")) {
    pulls.push(prior);
    continue;
  }
  const response = await fetch(
    "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prior.query),
      signal: AbortSignal.timeout(55000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Catalog refresh failed for ${name}: HTTP ${response.status}. Existing catalog retained.`,
    );
  const data = await response.json();
  catalogRows([{ ...prior, response: data }]); // Validate before accepting.
  pulls.push({
    ...prior,
    retrievedAt: new Date().toISOString(),
    response: data,
  });
}
// Prefer richer records where the discovery queries overlap.
const rows = catalogRows(
  [...pulls].sort((a, b) => a.query.fields.length - b.query.fields.length),
);
const catalog = {
  schemaVersion: 1,
  source: "USAspending",
  retrievedAt: pulls
    .map((p) => p.retrievedAt)
    .sort()
    .at(-1),
  coverage: pulls.map((p, i) => ({
    name: names[i],
    query: p.query,
    retrievedAt: p.retrievedAt,
    sourceRows: p.response.results.length,
    hasMore: p.response.page_metadata.hasNext,
  })),
  rows,
};
const output = new URL("programs.json", base),
  temp = new URL("programs.json.tmp", base);
await writeFile(temp, JSON.stringify(catalog, null, 2));
await rename(temp, output);
if (!process.argv.includes("--from-snapshots"))
  for (let i = 0; i < names.length; i++)
    await writeFile(
      new URL("program-" + names[i] + "-source.json", base),
      JSON.stringify(pulls[i]),
    );
console.log(
  `${rows.length} verified parent contracts written. Keyword discovery remains an incomplete roster.`,
);
