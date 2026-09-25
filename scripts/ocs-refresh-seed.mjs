// Public, bounded preview data. Run explicitly; never represents a complete country census.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  API,
  defaults,
  spendingBody,
  normalizeAwards,
} from "../ocs-atlas/core.mjs";
const root = new URL("../ocs-atlas/data/", import.meta.url);
await mkdir(root, { recursive: true });
const scope = { ...defaults(), country: "SAU" };
const results = await Promise.allSettled(
  ["awards", "subawards", "vehicles"].map(async (id) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spendingBody(scope, id)),
      signal: AbortSignal.timeout(55000),
    });
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    const data = await res.json();
    normalizeAwards(data, id, scope);
    return [id, data];
  }),
);
const layers = {};
for (const r of results) {
  if (r.status === "fulfilled") {
    layers[r.value[0]] = r.value[1];
    console.log(
      r.value[0] +
        ": " +
        r.value[1].results.length +
        " records; more=" +
        r.value[1].page_metadata.hasNext,
    );
  } else console.error(r.reason.message);
}
if (!layers.awards)
  throw new Error("No prime award data; existing seed retained.");
await writeFile(
  new URL("seed-sau.json", root),
  JSON.stringify(
    {
      schemaVersion: 1,
      source: "USAspending",
      retrievedAt: new Date().toISOString(),
      scope,
      layers,
    },
    null,
    2,
  ),
);
console.log("Saved " + fileURLToPath(new URL("seed-sau.json", root)));
