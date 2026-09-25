import {
  exclusionQuery,
  exclusionURL,
  publicExclusionPage,
} from "./ocs-sam-exclusions.mjs";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
export { samQuery, samURL, publicSamPage } from "./ocs-sam-core.mjs";
import { samQuery, samURL, publicSamPage } from "./ocs-sam-core.mjs";
export function createSamGateway({
  getKey,
  countries,
  usageFile,
  budget = 10,
  fetchImpl = fetch,
  now = () => new Date(),
}) {
  if (!Number.isInteger(budget) || budget < 1 || budget > 1000)
    throw new Error("SAM_DAILY_BUDGET must be 1–1000.");
  let busy = false,
    retryAt = 0;
  const cache = new Map();
  async function usage() {
    const day = now().toISOString().slice(0, 10);
    try {
      const d = JSON.parse(await readFile(usageFile, "utf8"));
      if (
        typeof d.day !== "string" ||
        !Number.isSafeInteger(d.count) ||
        d.count < 0
      )
        throw new Error("Invalid budget state");
      return d.day === day ? d : { day, count: 0 };
    } catch (e) {
      if (e.code === "ENOENT") return { day, count: 0 };
      throw new Error(
        "Local request-budget file needs repair; no SAM request sent.",
      );
    }
  }
  async function status() {
    const u = await usage();
    return {
      configured: Boolean(await getKey()),
      dailyBudget: budget,
      used: u.count,
      remaining: Math.max(0, budget - u.count),
      busy,
      retryAfter: Math.max(0, Math.ceil((retryAt - now().getTime()) / 1000)),
    };
  }
  async function search(input, kind = "entities") {
    const q = (kind === "exclusions" ? exclusionQuery : samQuery)(
        input,
        countries,
      ),
      id = kind + JSON.stringify(q),
      cached = cache.get(id);
    if (cached && now().getTime() - cached.at < 1800000)
      return { ...structuredClone(cached.data), cached: true };
    const key = await getKey();
    if (!key)
      throw new Error("SAM public API key is not configured on this computer.");
    if (busy)
      throw new Error(
        "Another SAM request is running. Try again when it finishes.",
      );
    if (now().getTime() < retryAt)
      throw new Error(
        "SAM asked us to slow down. Wait one minute before retrying.",
      );
    busy = true;
    try {
      const u = await usage();
      if (u.count >= budget)
        throw new Error(
          "Local daily SAM request budget reached. Try tomorrow or use a saved public extract.",
        );
      await mkdir(dirname(usageFile), { recursive: true });
      await writeFile(
        usageFile + ".tmp",
        JSON.stringify({ ...u, count: u.count + 1 }),
      );
      await rename(usageFile + ".tmp", usageFile);
      let res;
      try {
        res = await fetchImpl(
          (kind === "exclusions" ? exclusionURL : samURL)(q, key),
          {
            redirect: "error",
            signal: AbortSignal.timeout(35000),
          },
        );
      } catch {
        throw new Error(
          "SAM connection failed or timed out. Previous evidence is retained.",
        );
      }
      if (res.status === 429) retryAt = now().getTime() + 60000;
      if (!res.ok)
        throw new Error(
          res.status === 401 || res.status === 403
            ? "SAM rejected the key or its public-data access. Check the locally configured public API key."
            : "SAM is unavailable (HTTP " + res.status + "). Retry later.",
        );
      let data;
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of res.body) {
          size += chunk.length;
          if (size > 2_000_000) throw new Error();
          chunks.push(Buffer.from(chunk));
        }
        data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new Error("SAM returned an unreadable or oversized response.");
      }
      const result = (
        kind === "exclusions" ? publicExclusionPage : publicSamPage
      )(data, q, countries, now().toISOString());
      cache.set(id, { at: now().getTime(), data: result });
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      return { ...structuredClone(result), cached: false };
    } finally {
      busy = false;
    }
  }
  return {
    status,
    search: (input) => search(input),
    searchExclusions: (input) => search(input, "exclusions"),
  };
}
