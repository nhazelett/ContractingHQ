import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  programVersion,
  catalogRows,
  parentKey,
  awardKey,
  relatedContracts,
  countryOrders,
  matchesProgramCountry,
  dateStatus,
  linkedOrderSearch,
  validateChildren,
  verifiedOrders,
  programEvidenceHTML,
} from "../ocs-atlas/programs-core.mjs";
import { captureSearch, packetHTML } from "../ocs-atlas/packet.mjs";
const contract = {
  id: "vehicle:1",
  layer: "vehicles",
  identifier: "W52P1J19D0045",
  awardKey: "CONT_IDV_W52P1J19D0045_9700",
  uei: "ABC123DEF456",
  name: "Example",
  program: "LOGCAP",
  programVersion: "LOGCAP V",
  programRole: "holder",
  date: "2020-01-01",
  end: "2030-01-01",
  url: "https://www.usaspending.gov/award/CONT_IDV_W52P1J19D0045_9700/",
  retrievedAt: "2026-09-25",
};
const child = {
  piid: "W912XX26F0001",
  generated_unique_award_id: "CONT_AWD_W912XX26F0001_9700_W52P1J19D0045_9700",
};
const order = {
  id: "award:1",
  layer: "awards",
  awardKey: child.generated_unique_award_id,
  uei: contract.uei,
  performanceCountry: "SAU",
  identifier: child.piid,
  name: "Example",
  date: "2026-01-01",
  end: "2027-01-01",
  url:
    "https://www.usaspending.gov/award/" +
    child.generated_unique_award_id +
    "/",
};
const scope = {
  country: "SAU",
  from: "2023-09-25",
  to: "2026-09-25",
  agency: "dod",
  q: "fuel",
  naics: "23",
  psc: "S208",
};
test("program classification distinguishes basic vehicles, versions and support contracts", () => {
  assert.deepEqual(programVersion("AFCAP V - BASIC CONTRACT FLUOR"), [
    "AFCAP",
    "AFCAP V",
  ]);
  assert.equal(programVersion("LOGCAP PROGRAM SUPPORT"), null);
  assert.equal(programVersion("AFCAP IV BASIC"), null);
  assert.deepEqual(
    programVersion(
      "THE WORLDWIDE EXPEDITIONARY MULTIPLE AWARD CONTRACT (WEXMAC) 2.2",
    ),
    ["WEXMAC", "WEXMAC 2.2"],
  );
  assert.deepEqual(programVersion("WEXMAC TITUS"), [
    "WEXMAC",
    "WEXMAC · version not stated · TITUS",
  ]);
});
test("exact entity and parent agency identifiers establish program associations without transferring unrelated work", () => {
  assert.equal(parentKey(order), contract.awardKey);
  assert.equal(
    relatedContracts(
      [
        {
          ...order,
          uei: "OTHER1234567",
          awardKey: "CONT_AWD_X_9700_OTHER_9700",
          name: "Example",
        },
      ],
      [contract],
    ).length,
    0,
  );
  assert.equal(
    countryOrders(
      [{ ...order, awardKey: "CONT_AWD_X_9700_W52P1J19D0045_9999" }],
      [contract],
      "SAU",
    ).length,
    0,
  );
  assert.equal(
    countryOrders(
      [{ ...order, awardKey: "CONT_AWD_X_9700_UNRELATED_9700" }],
      [contract],
      "SAU",
    ).length,
    0,
  );
  assert.equal(countryOrders([order], [contract], "SAU").length, 1);
  assert.equal(countryOrders([order], [contract], "USA").length, 0);
  assert.equal(parentKey({ ...order, layer: "subawards" }), "");
});
test("date labels separate ordering from performance and reject missing or invalid dates", () => {
  assert.equal(
    dateStatus(contract, "2026-09-25"),
    "Ordering period appears open",
  );
  assert.equal(
    dateStatus(order, "2026-09-25"),
    "Reported performance period includes today",
  );
  assert.equal(
    dateStatus({ ...order, end: "2025-12-31" }, "2026-09-25"),
    "Dates incomplete or inconsistent",
  );
  assert.equal(
    dateStatus({ ...order, end: "" }),
    "Dates incomplete or inconsistent",
  );
  assert.equal(
    dateStatus({ ...order, date: "2026-02-30" }),
    "Dates incomplete or inconsistent",
  );
  assert.equal(
    dateStatus(contract, "2031-01-01"),
    "Reported ordering deadline passed",
  );
});
test("country-order checks remove unrelated query filters and verify every returned link and country", () => {
  const b = linkedOrderSearch(scope, [child]);
  assert.deepEqual(b.filters.award_ids, [child.piid]);
  assert.equal(b.filters.time_period, undefined);
  assert.equal(b.filters.keywords, undefined);
  assert.equal(b.filters.agencies, undefined);
  assert.deepEqual(b.filters.place_of_performance_locations, [
    { country: "SAU" },
  ]);
  assert.throws(() => validateChildren({ results: [] }, contract));
  assert.deepEqual(
    validateChildren(
      {
        results: [
          child,
          { ...child, generated_unique_award_id: "CONT_AWD_X_9700_OTHER_9700" },
        ],
        page_metadata: { hasNext: false },
      },
      contract,
    ),
    [child],
  );
  const row = {
    "Award ID": child.piid,
    "Recipient Name": "Example",
    "Recipient UEI": contract.uei,
    generated_internal_id: child.generated_unique_award_id,
    "Primary Place of Performance": { country_code: "SAU" },
  };
  const d = {
    results: [
      row,
      { ...row, generated_internal_id: "CONT_AWD_WRONG_9700_OTHER_9700" },
      { ...row, "Primary Place of Performance": { country_code: "USA" } },
    ],
    page_metadata: { hasNext: false },
  };
  assert.equal(
    verifiedOrders(d, contract, [child], scope, "2026-09-25").length,
    1,
  );
});
test("program evidence survives packet capture with source dates, coverage and escaped source text", () => {
  const c = { ...contract, name: "<script>bad</script>" };
  const html = programEvidenceHTML([c, order], [c], "SAU", "2026-09-25");
  assert.match(html, /1 loaded orders reported in SAU/);
  assert.match(html, /Availability unverified/);
  assert.doesNotMatch(html, /<script>/);
  const s = captureSearch({
    scope,
    coverage: {
      programs: {
        status: "snapshot",
        programCoverage: { orders: [{ hasNext: true }] },
      },
    },
    rows: [c, order],
    filters: { programs: ["LOGCAP"] },
  });
  const report = packetHTML({
    exportedAt: "2026-09-25",
    countryNames: {},
    searches: [s],
    shortlist: [],
    logistics: [],
    transport: null,
  });
  assert.match(report, /Program query and order coverage/);
  assert.match(report, /Ordering period appears open/);
  assert.match(report, /Reported performance period includes today/);
});
test("bundled catalog retains source proof and only recognized exact-ID vehicles", async () => {
  const d = JSON.parse(
    await readFile(
      new URL("../ocs-atlas/data/programs.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(new Set(d.rows.map(awardKey)).size, d.rows.length);
  for (const r of d.rows) {
    assert.equal(r.layer, "vehicles");
    assert.match(r.uei, /^[A-Z0-9]{12}$/);
    assert.ok(programVersion(r.description));
    assert.equal(r.performanceCountry, "");
    assert.equal(r.amount, null);
    assert.ok(r.programQuery);
  }
  assert.equal(d.rows.filter((r) => r.program === "AFCAP").length, 8);
  assert.equal(d.rows.filter((r) => r.program === "LOGCAP").length, 4);
  assert.ok(d.rows.filter((r) => r.program === "WEXMAC").length > 0);
});

test("territory matches verify source country and state without rewriting geography", () => {
  assert.equal(
    matchesProgramCountry(
      { performanceCountry: "USA", performanceState: "PR" },
      "PRI",
    ),
    true,
  );
  assert.equal(
    matchesProgramCountry(
      { performanceCountry: "USA", performanceState: "TX" },
      "PRI",
    ),
    false,
  );
  assert.equal(
    matchesProgramCountry({ performanceCountry: "USA" }, "PRI"),
    false,
  );
});
