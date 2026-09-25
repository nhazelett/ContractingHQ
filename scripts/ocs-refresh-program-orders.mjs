// Bounded, credential-free country snapshot for the existing AFCAP catalog.
import { readFile, writeFile, rename } from "node:fs/promises";
import { API, defaults } from "../ocs-atlas/core.mjs";
import {
  IDV_ORDERS_API,
  awardKey,
  validateChildren,
  linkedOrderSearch,
  verifiedOrders,
} from "../ocs-atlas/programs-core.mjs";
const base = new URL("../ocs-atlas/data/", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("programs.json", base), "utf8"),
);
const scope = {
  ...defaults(),
  country: "SAU",
  agency: "all",
  q: "",
  naics: "",
  psc: "",
  from: "2007-10-01",
  allDates: true,
};
async function request(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Public source HTTP ${res.status}`);
  return res.json();
}
const pages = [];
for (const c of catalog.rows.filter((r) => r.program === "AFCAP")) {
  const query = {
    award_id: awardKey(c),
    type: "child_awards",
    limit: 100,
    page: 1,
    sort: "period_of_performance_start_date",
    order: "desc",
  };
  try {
    const childrenData = await request(IDV_ORDERS_API, query),
      children = validateChildren(childrenData, c);
    if (children.length !== childrenData.results.length)
      throw new Error("Unverified child records");
    const rows = [];
    let more = children.length > 0,
      page = 1;
    const pulls = [{ url: IDV_ORDERS_API, query, response: childrenData }];
    while (more) {
      if (page > 3) throw new Error("Country lookup exceeds bounded limit");
      const body = linkedOrderSearch(scope, children, page),
        data = await request(API, body);
      pulls.push({ url: API, query: body, response: data });
      rows.push(
        ...verifiedOrders(
          data,
          c,
          children,
          scope,
          new Date().toISOString(),
        ).map((r) => ({
          ...r,
          programQuery: { linkedOrders: query, countryLookup: body },
        })),
      );
      more = data.page_metadata.hasNext;
      page++;
    }
    pages.push({
      country: scope.country,
      program: c.program,
      parentAwardKey: awardKey(c),
      rows,
      page: 1,
      reviewed: children.length,
      hasNext: childrenData.page_metadata.hasNext,
      retrievedAt: new Date().toISOString(),
      query,
      pulls,
    });
    console.log(
      `${c.name}: ${rows.length} Saudi orders; ${children.length} children checked; more=${childrenData.page_metadata.hasNext}`,
    );
  } catch (e) {
    pages.push({
      country: scope.country,
      program: c.program,
      parentAwardKey: awardKey(c),
      rows: [],
      page: 0,
      reviewed: 0,
      hasNext: true,
      error: e.message,
    });
    console.log(`${c.name}: ${e.message}`);
  }
}
if (!pages.some((p) => p.page))
  throw new Error("All lookups failed; existing snapshot retained");
const dest = new URL("program-orders-sau.json", base),
  temp = new URL("program-orders-sau.json.tmp", base);
await writeFile(
  temp,
  JSON.stringify(
    {
      schemaVersion: 1,
      source: "USAspending",
      country: "SAU",
      retrievedAt: new Date().toISOString(),
      coverage:
        "First 100 direct children per catalog AFCAP V parent; all reported dates; missing or incomplete checks remain explicit.",
      pages,
    },
    null,
    2,
  ),
);
await rename(temp, dest);
