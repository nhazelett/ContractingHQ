import { text } from "../ocs-atlas/core.mjs";
export function normalizeEntity(r, asOf) {
  const reg = r.entityRegistration || {},
    core = r.coreData || {},
    address = core.physicalAddress || {},
    assertions = r.assertions || {},
    goods = assertions.goodsAndServices || {};
  // Fail closed for opt-out or unmarked records, even if a credential has broader access.
  if (
    reg.noPublicDisplayFlag === "Y" ||
    (reg.publicDisplayFlag !== "Y" &&
      !(reg.publicDisplayFlag === undefined && reg.noPublicDisplayFlag === "N"))
  )
    return null;
  const list = (v, key) =>
    Array.isArray(v)
      ? v
          .map((x) => text(x[key], 20))
          .filter(Boolean)
          .join(";")
      : "";
  const uei = text(reg.ueiSAM, 30);
  if (!uei || !reg.legalBusinessName) return null;
  return {
    id: "sam:" + uei,
    layer: "sam",
    identifier: text(reg.cageCode, 20),
    name: text(reg.legalBusinessName, 300),
    uei,
    origin: text(address.countryCode, 10),
    city: text(address.city, 120),
    address: text(
      [address.addressLine1, address.addressLine2].filter(Boolean).join(", "),
      300,
    ),
    region: text(address.stateOrProvinceCode, 50),
    postalCode: text(address.zipCode || address.foreignPostalCode, 30),
    updated: text(reg.lastUpdateDate, 30),
    primaryNaics: text(goods.primaryNaics, 6),
    declaredIndustries: Array.isArray(goods.naicsList)
      ? goods.naicsList
          .map((x) => text(x.naicsDescription, 200))
          .filter(Boolean)
          .join("; ")
          .slice(0, 4000)
      : "",
    naics: list(goods.naicsList, "naicsCode"),
    psc: list(goods.pscList, "pscCode"),
    status: text(reg.registrationStatus, 50),
    expiration: text(reg.registrationExpirationDate, 30),
    purpose: text(
      reg.purposeOfRegistrationDesc || reg.purposeOfRegistrationCode,
      100,
    ),
    exclusion: text(reg.exclusionStatusFlag, 10),
    source: "SAM.gov",
    url: "https://sam.gov/search/?index=entity",
    retrievedAt: asOf,
    date: text(reg.registrationDate, 30),
    description:
      "Declared SAM capabilities; registration is not an assessment of current capacity.",
  };
}
