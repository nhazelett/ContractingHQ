import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import {
  exclusionQuery,
  exclusionURL,
  publicExclusionPage,
} from "../scripts/ocs-sam-exclusions.mjs";
import { createSamGateway } from "../scripts/ocs-sam-gateway.mjs";
import { createAtlasServer } from "../scripts/ocs-server.mjs";
import { suppliers, csv } from "../ocs-atlas/core.mjs";
import { companySummary } from "../ocs-atlas/research.mjs";
import { registrationHTML } from "../ocs-atlas/sam-client.mjs";
const countries = [
  { code: "SAU", iso2: "SA", name: "Saudi Arabia" },
  { code: "USA", iso2: "US", name: "United States" },
];
const when = "2026-09-25T00:00:00Z";
const firm = () => ({
  exclusionDetails: {
    classificationType: "Firm",
    exclusionType: "Prohibition/Restriction",
    exclusionProgram: "Procurement",
    excludingAgencyName: "Example agency",
  },
  exclusionIdentification: {
    entityName: "TEST ONLY <Example firm>",
    ueiSAM: null,
    npi: "DO NOT COPY",
  },
  exclusionPrimaryAddress: {
    countryCode: "SAU",
    city: "Riyadh",
    zipCode: "12345",
  },
  exclusionActions: {
    listOfActions: [
      {
        activateDate: "01-01-2025",
        recordStatus: "Active",
        terminationType: "Indefinite",
      },
    ],
  },
  exclusionOtherInformation: {
    isFASCSAOrder: "Yes",
    additionalComments: "Example restriction scope",
    evsInvestigationStatus: "DO NOT COPY",
  },
  vesselDetails: { owner: "DO NOT COPY" },
});
test("public exclusions use only firms and documented v4 filters, with no extraction/email or arbitrary fields", () => {
  const q = exclusionQuery({ country: "SAU", name: "Example firm" }, countries),
    u = exclusionURL(q, "test-secret");
  assert.equal(u.pathname, "/entity-information/v4/exclusions");
  assert.equal(u.searchParams.has("includeSections"), false);
  assert.equal(u.searchParams.get("classification"), "Firm");
  assert.equal(u.searchParams.get("recordStatus"), "active");
  assert.equal(u.searchParams.get("exclusionName"), "Example firm");
  for (const bad of [
    { country: "ZZZ" },
    { country: "SAU", page: 1000 },
    { country: "SAU", name: "name|other" },
    { country: "SAU", emailId: "Yes" },
    { country: "SAU", status: "A" },
  ])
    assert.throws(() => exclusionQuery(bad, countries));
});
test("exclusions retain scope and source actions, omit nonfirm/inactive/mismatched records and never become award experience", () => {
  const individual = firm();
  individual.exclusionDetails.classificationType = "Individual";
  const inactive = firm();
  inactive.exclusionActions.listOfActions[0].recordStatus = "Inactive";
  const other = firm();
  other.exclusionPrimaryAddress.countryCode = "USA";
  const q = exclusionQuery({ country: "SAU" }, countries);
  const page = publicExclusionPage(
    { totalRecords: 4, excludedEntity: [firm(), individual, inactive, other] },
    q,
    countries,
    when,
  );
  assert.equal(page.rows.length, 1);
  assert.equal(page.withheldRecords, 3);
  assert.equal(JSON.stringify(page).includes("DO NOT COPY"), false);
  assert.equal(page.rows[0].exclusionType, "Prohibition/Restriction");
  assert.equal(page.rows[0].fascsaOrder, "Yes");
  assert.equal(page.rows[0].performanceCountry, undefined);
  assert.equal(companySummary(page.rows).missingWorkCountry, 0);
  assert.equal(companySummary(page.rows).latest, "");
  const different = structuredClone(page.rows[0]);
  different.id += "-other-record";
  assert.equal(
    suppliers([...page.rows, different], countries, "SAU").length,
    2,
  );
  assert.equal(
    suppliers(page.rows, countries, "SAU")[0].latestLabel,
    "exclusion checked",
  );
  assert.match(registrationHTML(page.rows), /TEST ONLY|Exclusion type/);
  assert.match(registrationHTML(page.rows), /Example restriction scope/);
  assert.match(csv(page.rows), /Prohibition\/Restriction/);
  assert.match(csv(page.rows), /activateDate/);
  assert.throws(() =>
    publicExclusionPage(
      { totalRecords: 1, excludedEntity: [] },
      q,
      countries,
      when,
    ),
  );
  assert.throws(() =>
    publicExclusionPage(
      { totalRecords: 0, excludedEntity: [], sensitivity: "PRIVATE" },
      q,
      countries,
      when,
    ),
  );
  assert.equal(
    publicExclusionPage(
      { totalRecords: 0, excludedEntity: [] },
      q,
      countries,
      when,
    ).hasNext,
    false,
  );
});
test("registration and exclusion requests share a quota, separate caches, and protected local routes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ocs-exclusions-test-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("ocs-exclusions-test-"));
    await rm(dir, { recursive: true, force: true });
  });
  let calls = 0;
  const gateway = createSamGateway({
    getKey: async () => "test-secret",
    countries,
    usageFile: join(dir, "usage.json"),
    budget: 2,
    fetchImpl: async (url) => {
      calls++;
      return new Response(
        JSON.stringify(
          url.pathname.endsWith("exclusions")
            ? { totalRecords: 1, excludedEntity: [firm()] }
            : { totalRecords: 0, entityData: [] },
        ),
      );
    },
  });
  const server = createAtlasServer({ gateway });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}/api/sam/exclusions`;
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  assert.equal((await fetch(url, { method: "POST" })).status, 415);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-OCS-Request": "1" },
    body: JSON.stringify({ country: "SAU" }),
  });
  const result = await res.json();
  assert.equal(result.rows.length, 1);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
  await gateway.search({ country: "SAU" });
  assert.equal(calls, 2);
  assert.equal(
    (await gateway.searchExclusions({ country: "SAU" })).cached,
    true,
  );
  assert.equal((await gateway.status()).remaining, 0);
  await assert.rejects(
    gateway.searchExclusions({ country: "USA" }),
    /budget reached/,
  );
  assert.equal(calls, 2);
});
