import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import {
  samQuery,
  samURL,
  publicSamPage,
  createSamGateway,
} from "../scripts/ocs-sam-gateway.mjs";
import { createAtlasServer } from "../scripts/ocs-server.mjs";
import {
  samRowsForScope,
  suppliers,
  validateSnapshot,
} from "../ocs-atlas/core.mjs";
import { registrationHTML } from "../ocs-atlas/sam-client.mjs";
import { packetHTML } from "../ocs-atlas/packet.mjs";
const countries = [
  { code: "SAU", iso2: "SA", name: "Saudi Arabia" },
  { code: "USA", iso2: "US", name: "United States" },
];
async function clean(dir) {
  if (
    dirname(resolve(dir)) !== resolve(tmpdir()) ||
    !basename(dir).startsWith("ocs-sam-test-")
  )
    throw new Error("Unexpected test cleanup path");
  await rm(dir, { recursive: true, force: true });
}
const when = "2026-09-25T00:00:00Z";
const entity = (id = "ABC123DEF456", flag = "Y") => ({
  entityRegistration: {
    ueiSAM: id,
    legalBusinessName: "Test <company>",
    publicDisplayFlag: flag,
    registrationStatus: "Active",
    registrationExpirationDate: "2027-01-01",
  },
  coreData: {
    physicalAddress: {
      countryCode: "SAU",
      city: "Test city",
      addressLine1: "Public business address",
    },
    financialInformation: { bankAccount: "DO NOT COPY" },
  },
  assertions: {
    goodsAndServices: {
      primaryNaics: "484110",
      naicsList: [
        { naicsCode: "484110", naicsDescription: "General Freight Trucking" },
      ],
    },
  },
  pointsOfContact: { email: "DO NOT COPY" },
});
test("SAM requests separate exact identity and discovery, validate codes and ignore award filters", () => {
  const q = samQuery(
    { country: "SAU", industry: "trucking", naics: "484110", status: "A" },
    countries,
  );
  const url = samURL(q, "test-key");
  assert.equal(url.hostname, "api.sam.gov");
  assert.equal(url.searchParams.get("naicsDesc"), "trucking");
  assert.equal(url.searchParams.get("samRegistered"), "Yes");
  assert.equal(
    url.searchParams.get("includeSections"),
    "entityRegistration,coreData,assertions",
  );
  for (const q of [
    { country: "SAU", naics: "484" },
    { country: "BAD" },
    { uei: "ABC123DEF456", country: "SAU" },
    { country: "SAU", name: "x~y" },
    { country: "SAU", page: 1000 },
    { country: "SAU", from: "2020-01-01" },
  ])
    assert.throws(() => samQuery(q, countries));
});
test("SAM normalization excludes private/unmarked identities, drops restricted fields, and preserves query pagination", () => {
  const q = samQuery({ country: "SAU" }, countries),
    data = {
      totalRecords: 12,
      entityData: [
        entity(),
        entity("ZZZ123DEF456", "N"),
        entity("YYY123DEF456", ""),
      ],
    };
  const d = publicSamPage(data, q, countries, when);
  assert.equal(d.rows.length, 1);
  assert.equal(d.withheldRecords, 2);
  assert.equal(d.hasNext, true);
  assert.equal(d.complete, false);
  assert.equal(d.rows[0].address, "Public business address");
  assert.equal(d.rows[0].primaryNaics, "484110");
  assert.doesNotMatch(
    JSON.stringify(d),
    /DO NOT COPY|bankAccount|pointsOfContact/,
  );
  assert.throws(() =>
    publicSamPage({ ...data, sensitivity: "FOUO" }, q, countries, when),
  );
  const exact = publicSamPage(
    data,
    samQuery({ uei: "XXX123DEF456" }, countries),
    countries,
    when,
  );
  assert.equal(exact.rows.length, 0);
  const snap = validateSnapshot(d);
  assert.equal(snap.rows[0].primaryNaics, "484110");
  assert.equal(
    samRowsForScope(
      d,
      { country: "SAU", q: "unrelated", naics: "23" },
      countries,
    ).length,
    1,
  );
  assert.equal(samRowsForScope(d, { country: "USA" }, countries).length, 0);
});
test("SAM gateway caches sanitized pages, counts failed requests, and enforces persistent local quotas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ocs-sam-test-"));
  try {
    let calls = 0;
    const gateway = createSamGateway({
      getKey: async () => "test-secret-never-return",
      countries,
      usageFile: join(dir, "usage.json"),
      budget: 2,
      now: () => new Date(when),
      fetchImpl: async () => {
        calls++;
        return new Response(
          JSON.stringify({ totalRecords: 1, entityData: [entity()] }),
        );
      },
    });
    const a = await gateway.search({ country: "SAU" });
    const b = await gateway.search({ country: "SAU" });
    assert.equal(calls, 1);
    assert.equal(b.cached, true);
    a.rows[0].name = "mutation";
    assert.equal(b.rows[0].name, "Test <company>");
    assert.doesNotMatch(JSON.stringify(b), /test-secret/);
    await gateway.search({ country: "SAU", name: "Test" });
    await assert.rejects(
      gateway.search({ country: "SAU", name: "Another" }),
      /budget reached/,
    );
    assert.equal((await gateway.status()).used, 2);
    assert.doesNotMatch(
      await readFile(join(dir, "usage.json"), "utf8"),
      /secret|company/,
    );
  } finally {
    await clean(dir);
  }
});
test("SAM gateway never sends a request without a key or echoes upstream errors containing credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ocs-sam-test-"));
  try {
    const args = {
      countries,
      usageFile: join(dir, "usage.json"),
      fetchImpl: async () => {
        throw new Error("https://api.sam.gov/?api_key=SECRET");
      },
    };
    await assert.rejects(
      createSamGateway({ ...args, getKey: async () => "" }).search({
        country: "SAU",
      }),
      /not configured/,
    );
    await assert.rejects(
      createSamGateway({ ...args, getKey: async () => "SECRET" }).search({
        country: "SAU",
      }),
      (e) => !e.message.includes("SECRET") && /failed/.test(e.message),
    );
  } finally {
    await clean(dir);
  }
});
test("local SAM routes block foreign origins and require the atlas request header", async () => {
  let calls = 0;
  const server = createAtlasServer({
    port: 8899,
    gateway: {
      status: async () => ({ configured: false }),
      search: async () => {
        calls++;
        return { rows: [] };
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = "http://127.0.0.1:" + server.address().port;
  const headers = {
    Host: "127.0.0.1:" + server.address().port,
    "Content-Type": "application/json",
    "X-OCS-Request": "1",
  };
  try {
    assert.equal(
      (
        await fetch(address + "/api/sam/entities", {
          method: "POST",
          headers: { ...headers, Origin: "https://foreign.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(address + "/api/sam/entities", {
          method: "POST",
          headers: { Host: headers.Host, "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await fetch(address + "/api/sam/entities", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      200,
    );
    assert.equal(calls, 1);
    assert.equal(
      (
        await fetch(address + "/.git/config", {
          headers: { Host: headers.Host },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(address + "/scripts/ocs-server.mjs", {
          headers: { Host: headers.Host },
        })
      ).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("registration profiles and shortlist packets explain evidence types and preserve escaped research notes", () => {
  const d = publicSamPage(
    { totalRecords: 1, entityData: [entity()] },
    samQuery({ country: "SAU" }, countries),
    countries,
    when,
  );
  const profile = registrationHTML(d.rows);
  assert.match(profile, /Declared capability/);
  assert.match(profile, /2027-01-01/);
  assert.match(profile, /484110/);
  assert.doesNotMatch(profile, /DO NOT COPY/);
  const html = packetHTML({
    exportedAt: when,
    countryNames: {},
    searches: [],
    shortlist: [
      {
        name: "Test",
        uei: d.rows[0].uei,
        savedAt: when,
        note: "<script>bad</script>",
        rows: d.rows,
        summary: { countries: [], buyers: [] },
      },
    ],
    logistics: [],
    transport: null,
  });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Registration query/);
  assert.match(html, /Registered country: SAU/);
  assert.match(html, /Registration date:/);
  assert.doesNotMatch(html, /buyer unknown|Reported work country:/);
  assert.match(html, /Reported registration status/);
  assert.doesNotMatch(html, /<script>/);
});

test("registration checks do not become award-performance dates in combined company records", () => {
  const row = {
    id: "sam:A",
    name: "Example",
    uei: "ABC123DEF456",
    layer: "sam",
    origin: "SAU",
    date: "2001-01-01",
    retrievedAt: when,
  };
  const registration = suppliers([row], countries, "SAU")[0];
  assert.equal(registration.latest, when);
  assert.equal(registration.latestLabel, "registration checked");
  const mixed = suppliers(
    [row, { ...row, id: "award:A", layer: "awards", date: "2023-01-01" }],
    countries,
    "SAU",
  )[0];
  assert.equal(mixed.latest, "2023-01-01");
  assert.equal(mixed.latestLabel, "latest start / report");
});
