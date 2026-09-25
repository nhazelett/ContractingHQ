// Ingest only PUBLIC Entity API JSON. Credentials and raw responses are never written.
// Usage: node scripts/ocs-sam-public.mjs --country SAU [--pages 1]
//        node scripts/ocs-sam-public.mjs --public-json /path/SAM_PUBLIC_entities.json --as-of YYYY-MM-DD
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { validateSnapshot, text } from "../ocs-atlas/core.mjs";
export { normalizeEntity } from "./ocs-sam-normalize.mjs";
import { normalizeEntity } from "./ocs-sam-normalize.mjs";
async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .reduce(
        (a, v, i, all) =>
          v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a,
        [],
      ),
  );
  const asOf = args["as-of"] || new Date().toISOString().slice(0, 10);
  let records = [],
    complete = false;
  if (args["public-json"]) {
    if (!/^SAM_PUBLIC.*\.json$/i.test(basename(args["public-json"])))
      throw new Error(
        "Input must be an official PUBLIC JSON export named SAM_PUBLIC*.json. Do not rename restricted exports.",
      );
    const data = JSON.parse(await readFile(args["public-json"], "utf8"));
    if (data.sensitivity && data.sensitivity !== "PUBLIC")
      throw new Error("Restricted exports are not supported.");
    records = Array.isArray(data) ? data : data.entityData;
    if (!Array.isArray(records))
      throw new Error("Expected PUBLIC Entity API JSON (entityData array).");
  } else {
    if (!/^[A-Z]{3}$/.test(args.country || ""))
      throw new Error("Specify an ISO3 --country or --public-json file.");
    if (!process.env.SAM_API_KEY)
      throw new Error(
        "Set SAM_API_KEY locally to a SAM public-data key. Never put it in browser code or a committed file.",
      );
    const pages = Number(args.pages || 1);
    if (!Number.isInteger(pages) || pages < 1 || pages > 100)
      throw new Error(
        "--pages must be 1–100. Check the key’s daily request quota.",
      );
    for (let page = 0; page < pages; page++) {
      const u = new URL("https://api.sam.gov/entity-information/v3/entities");
      u.searchParams.set("api_key", process.env.SAM_API_KEY);
      u.searchParams.set("physicalAddressCountryCode", args.country);
      u.searchParams.set(
        "includeSections",
        "entityRegistration,coreData,assertions",
      );
      u.searchParams.set("page", String(page));
      const res = await fetch(u, { signal: AbortSignal.timeout(45000) });
      if (!res.ok)
        throw new Error(
          "SAM request failed (HTTP " +
            res.status +
            "). No response or credential was saved.",
        );
      const data = await res.json();
      if (!Array.isArray(data.entityData))
        throw new Error("Unexpected SAM response; no snapshot written.");
      records.push(...data.entityData);
      if (
        data.entityData.length < 10 ||
        records.length >= Number(data.totalRecords)
      ) {
        complete = true;
        break;
      }
    }
  }
  const rows = records.map((r) => normalizeEntity(r, asOf)).filter(Boolean);
  if (!rows.length)
    throw new Error(
      "No usable entities returned; existing snapshots retained.",
    );
  const countries = JSON.parse(
    await readFile(
      new URL("../ocs-atlas/data/countries.json", import.meta.url),
      "utf8",
    ),
  );
  const groups = new Map();
  for (const r of rows) {
    const c = countries.find((c) => c.code === r.origin || c.iso2 === r.origin);
    if (!c) continue;
    r.origin = c.code;
    if (!groups.has(c.code)) groups.set(c.code, []);
    groups.get(c.code).push(r);
  }
  if (!groups.size)
    throw new Error(
      "No recognized entity countries; existing snapshots retained.",
    );
  const out = new URL("../ocs-atlas/data/sam/", import.meta.url);
  await mkdir(out, { recursive: true });
  for (const [code, group] of groups) {
    const snapshot = validateSnapshot({
      schemaVersion: 1,
      source: "SAM.gov",
      sensitivity: "PUBLIC",
      asOf,
      complete,
      rows: group,
    });
    const target = new URL(code + ".json", out);
    let previous = null;
    try {
      previous = JSON.parse(await readFile(target, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (previous?.complete && !complete)
      throw new Error(
        "A partial pull cannot replace the existing complete " +
          code +
          " snapshot. Obtain a complete public extract before replacing it.",
      );
    const temp = new URL(code + ".json.tmp", out);
    await writeFile(temp, JSON.stringify(snapshot));
    await rename(temp, target);
  }
  let prior = [];
  try {
    prior =
      JSON.parse(await readFile(new URL("manifest.json", out), "utf8"))
        .countries || [];
  } catch {}
  await writeFile(
    new URL("manifest.json", out),
    JSON.stringify({
      schemaVersion: 1,
      source: "SAM.gov",
      sensitivity: "PUBLIC",
      asOf,
      countries: [...new Set([...prior, ...groups.keys()])],
    }),
  );
  console.log(
    "Wrote public supplier snapshots for " +
      groups.size +
      " countries; " +
      rows.length +
      " entities. " +
      (complete
        ? "Requested country pages complete."
        : "Partial / unverified completeness."),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
