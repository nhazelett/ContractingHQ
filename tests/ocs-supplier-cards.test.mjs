import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceDate,
  registrationBadges,
  supplierCardFacts,
  supplierCardHTML,
} from "../ocs-atlas/supplier-cards.mjs";
const sam = (extra = {}) => ({
  layer: "sam",
  status: "Active",
  retrievedAt: "2026-09-25T10:00:00Z",
  expiration: "2027-01-01",
  ...extra,
});
test("status badges reflect dated SAM evidence, never infer registration from an award", () => {
  assert.match(
    registrationBadges([{ layer: "awards", status: "Active" }])[0].label,
    /unknown/,
  );
  assert.match(
    registrationBadges([sam()], "2026-09-25")[0].label,
    /Active registration/,
  );
  assert.match(
    registrationBadges([sam()], "2026-09-25")[0].detail,
    /2026-09-25/,
  );
  assert.match(
    registrationBadges([sam({ status: "E" })], "2026-09-25")[0].label,
    /Expired/,
  );
  const stale = registrationBadges(
    [sam({ expiration: "2026-01-01" })],
    "2026-09-25",
  )[0];
  assert.match(stale.label, /recheck/);
  assert.match(stale.detail, /Reported active/);
  assert.match(
    registrationBadges([sam({ status: "Pending" })])[0].label,
    /unknown/,
  );
});
test("dated newer registrations supersede old status but conflicts and undated evidence stay visible", () => {
  const old = sam({ status: "Expired", retrievedAt: "2025-01-01" });
  assert.match(
    registrationBadges([old, sam()], "2026-09-25")[0].label,
    /Active registration/,
  );
  assert.match(
    registrationBadges([sam({ status: "Expired" }), sam()])[0].label,
    /conflicts/,
  );
  assert.match(
    registrationBadges([sam({ status: "Expired", retrievedAt: "" }), sam()])[0]
      .label,
    /conflicts/,
  );
});
test("exclusions and source exclusion flags remain separate from registration and carry their own retrieval date", () => {
  const badges = registrationBadges(
    [
      sam(),
      {
        layer: "exclusions",
        retrievedAt: "2025-02-03",
        exclusionType: "Prohibition/Restriction",
      },
    ],
    "2026-09-25",
  );
  assert.equal(badges.length, 2);
  assert.match(badges[1].label, /review scope/);
  assert.match(badges[1].detail, /2025-02-03/);
  assert.match(
    registrationBadges([sam({ exclusion: "D" })])[1].label,
    /exclusion flag/,
  );
  assert.equal(registrationBadges([sam({ exclusion: "" })]).length, 1);
});
test("cards preserve separate address/work places, source gaps, and award dates rather than vehicle or registration dates", () => {
  const facts = supplierCardFacts(
    [
      sam({ origin: "USA", city: "Houston", date: "2099-01-01" }),
      {
        layer: "awards",
        origin: "USA",
        city: "Houston",
        performanceCountry: "SAU",
        performanceCity: "Riyadh",
        date: "2024-06-01",
        retrievedAt: "2026-09-24",
        source: "USAspending",
      },
      {
        layer: "awards",
        origin: "USA",
        performanceCountry: "SAU",
        date: "invalid",
      },
      { layer: "subawards", date: "2025-02-03" },
      { layer: "vehicles", performanceCountry: "GBR", date: "2098-01-01" },
    ],
    (c) =>
      ({ USA: "United States", SAU: "Saudi Arabia", GBR: "United Kingdom" })[c],
  );
  assert.deepEqual(facts.work, [
    "Riyadh, Saudi Arabia",
    "Saudi Arabia (country only)",
  ]);
  assert.equal(facts.latestAward, "2025-02-03");
  assert.equal(facts.missingWork, 1);
  assert.equal(facts.awardCount, 3);
  assert.equal(facts.source.layer, "sam");
  assert.ok(facts.addresses.includes("Houston, United States"));
});
test("dates reject rollover and card output escapes source fields, rejects unsafe links, and retains keyboard actions", () => {
  assert.equal(evidenceDate("02-30-2026"), "");
  assert.equal(evidenceDate("2026-02-30"), "");
  assert.equal(evidenceDate("09/25/2026"), "2026-09-25");
  const rows = [
    sam({
      name: "<company>",
      city: "<script>",
      url: "javascript:alert(1)",
      source: "<source>",
    }),
  ];
  const html = supplierCardHTML(
    {
      rows,
      key: 'uei:"bad',
      name: "<company>",
      uei: "ABC123DEF456",
      layers: new Set(["sam"]),
      segment: "unknown",
    },
    { today: "2026-09-25" },
  );
  assert.doesNotMatch(html, /<script>|javascript:/);
  assert.match(html, /&lt;company&gt;/);
  assert.match(html, /&lt;source&gt;/);
  assert.match(html, /data-open="uei:&quot;bad"/);
  assert.match(html, /data-save=/);
  assert.match(html, /View evidence & details/);
  assert.match(html, /No award work evidence loaded/);
});
