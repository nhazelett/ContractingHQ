const STORAGE_KEY = "bpa-generator-draft-v1";
const PIID_ACTIVITY = "FA4867";
const FORM9_DODAAC = "F2D3JC";
const DEPLOYED_OFFICE_ADDRESS = "Deployed Contracting Squadron\n67 Deployed St\nUndisclosed Location, Overseas";

const airForceContacts = [
  { name: "SSgt Maya Reyes", phone: "DSN 318-555-0101" },
  { name: "SrA Jordan Kim", phone: "DSN 318-555-0102" },
  { name: "TSgt Avery Brooks", phone: "DSN 318-555-0103" },
  { name: "MSgt Elena Carter", phone: "DSN 318-555-0104" },
  { name: "Lt Marcus Hale", phone: "DSN 318-555-0105" },
  { name: "Capt Nadia Sullivan", phone: "DSN 318-555-0106" }
];

const deliveryAddressSeeds = [
  { building: "104", street: "Expeditionary Support Ave" },
  { building: "217", street: "Deployed Logistics Rd" },
  { building: "331", street: "Contingency Supply St" },
  { building: "482", street: "Forward Receiving Dr" },
  { building: "596", street: "Mission Support Ln" },
  { building: "721", street: "Airlift Cargo Way" },
  { building: "844", street: "Joint Sustainment Blvd" },
  { building: "918", street: "Theater Support Ct" }
];

const fundingProfiles = {
  om: {
    label: "O&M, Air Force",
    appn: "3400",
    tas: "57XX3400",
    objectClass: "25.2",
    eeicOptions: ["4090", "4110", "5830", "5920", "7710"],
    budgetActivityOptions: ["01", "04", "08"],
    subheadOptions: ["0100", "011A", "041A", "041B", "0820"]
  },
  procurement: {
    label: "Other Procurement, Air Force",
    appn: "3080",
    tas: "57XX3080",
    objectClass: "31.0",
    eeicOptions: ["3080", "3840", "4990", "5340", "5810"],
    budgetActivityOptions: ["02", "03", "04"],
    subheadOptions: ["0200", "0300", "0400", "0410", "0500"]
  }
};

const acrnChars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const organizationCodes = ["067000", "067100", "067200", "067300", "067400", "067500"];
const costCenters = ["F2D3JC", "F2D4JA", "F2D6KD", "F2D8MA", "F3T1AB"];
const projectCodes = ["000000", "10A100", "20B200", "30C300", "40D400"];
const aaiCodes = ["021001", "021201", "021302", "021403", "021504"];

const supplierRoster = [
  {
    code: "K7M4Q9R2T8P1",
    name: "Crescent Field Services LLC",
    address: "Bldg 12, Vendor Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0211",
    facilityCode: "",
    signer: "Avery Morgan, Authorized Representative"
  },
  {
    code: "P3L8V6N1C5X9",
    name: "Summit Transit Solutions LLC",
    address: "Bldg 28, Contractor Staging Area\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0212",
    facilityCode: "",
    signer: "Riley Chen, Program Manager"
  },
  {
    code: "H9C2D7F5M1Q4",
    name: "Harbor Range Support LLC",
    address: "Bldg 43, Mission Support Annex\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0213",
    facilityCode: "",
    signer: "Taylor Grant, Managing Member"
  },
  {
    code: "R6T1K4W8Z3N2",
    name: "Vector Base Operations LLC",
    address: "Bldg 57, Expeditionary Service Row\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0214",
    facilityCode: "",
    signer: "Morgan Ellis, Operations Director"
  },
  {
    code: "N2Q8B5L7S4V1",
    name: "Pioneer Logistics Group LLC",
    address: "Bldg 64, Forward Vendor Lot\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0215",
    facilityCode: "",
    signer: "Casey Porter, Authorized Official"
  },
  {
    code: "T5J9X2C6H8D3",
    name: "Sable Support Services LLC",
    address: "Bldg 78, Contingency Services Ln\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0216",
    facilityCode: "",
    signer: "Jordan Blake, Contract Manager"
  },
  {
    code: "D4W7M1R9K6P2",
    name: "Northline Mission Services LLC",
    address: "Bldg 86, Deployed Vendor Complex\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0217",
    facilityCode: "",
    signer: "Jamie Collins, Managing Director"
  },
  {
    code: "V8S3Q6T1L5B9",
    name: "Frontier Site Solutions LLC",
    address: "Bldg 93, Support Contractor Area\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0218",
    facilityCode: "",
    signer: "Skyler Reed, Authorized Representative"
  }
];

const clauseLibrary = [
  {
    id: "FAR 13.303-3",
    title: "BPA Mandatory Terms",
    date: "BY REF",
    group: "BPA Terms",
    core: true,
    summary: "Description, obligation, purchase limitation, authorized callers, delivery ticket, and invoice terms.",
    body: "BPA terms are set forth in this agreement. The BPA itself cites no accounting and appropriation data. The Government is obligated only to the extent of authorized calls actually placed under the BPA."
  },
  {
    id: "FAR 13.303-5",
    title: "Purchases Under BPAs",
    date: "BY REF",
    group: "BPA Terms",
    core: true,
    summary: "Individual purchases must be otherwise authorized and properly documented.",
    body: "Calls under this BPA shall be placed only by authorized callers, within stated limitations, and only for requirements otherwise authorized by law and regulation. Each call shall record the essential purchase elements, including date, supplier, BPA number, call number, supplies or services, price, delivery or performance requirement, Form 9/requisition number, and accounting and appropriation data."
  },
  {
    id: "52.204-7",
    title: "System for Award Management",
    date: "OCT 2018",
    group: "Core Commercial",
    core: true,
    summary: "SAM registration and status requirements.",
    body: "Incorporated by reference. The supplier shall maintain active SAM registration when required for award, payment, and performance actions."
  },
  {
    id: "52.204-13",
    title: "System for Award Management Maintenance",
    date: "OCT 2018",
    group: "Core Commercial",
    core: true,
    summary: "Maintenance of SAM registration after establishment.",
    body: "Incorporated by reference. The supplier shall keep SAM information current during the BPA period and through final payment for calls."
  },
  {
    id: "52.204-21",
    title: "Basic Safeguarding of Covered Contractor Information Systems",
    date: "NOV 2021",
    group: "Core Commercial",
    core: true,
    summary: "Baseline safeguarding for covered information systems.",
    body: "Incorporated by reference when Federal contract information is processed, stored, or transmitted by supplier systems."
  },
  {
    id: "52.212-4",
    title: "Contract Terms and Conditions - Commercial Products and Commercial Services",
    date: "NOV 2023",
    group: "Commercial Calls",
    core: true,
    summary: "Core commercial terms for calls, as applicable.",
    body: "Incorporated by reference for commercial product and commercial service BPA calls unless a call states otherwise."
  },
  {
    id: "52.232-33",
    title: "Payment by Electronic Funds Transfer - System for Award Management",
    date: "OCT 2018",
    group: "Payment",
    core: true,
    summary: "EFT payment through SAM banking data.",
    body: "Incorporated by reference. Payment will be made by EFT using payment information in SAM."
  },
  {
    id: "252.232-7003",
    title: "Electronic Submission of Payment Requests and Receiving Reports",
    date: "DEC 2018",
    group: "Payment",
    core: true,
    summary: "Requires electronic payment requests and receiving reports through WAWF unless an exception applies.",
    body: "Incorporated by reference. Payment requests and receiving reports for BPA calls shall be submitted through Wide Area WorkFlow unless an authorized exception applies."
  },
  {
    id: "252.232-7006",
    title: "Wide Area WorkFlow Payment Instructions",
    date: "JAN 2023",
    group: "Payment",
    core: true,
    summary: "Completed WAWF document type and routing instructions for calls.",
    body: "Incorporated by reference for calls. Completed WAWF fill-ins for the current BPA call are stated below.\n\n{{wawfInstructions}}"
  },
  {
    id: "52.232-18",
    title: "Availability of Funds",
    date: "APR 1984",
    group: "Payment",
    summary: "Use when a call or contemplated action is subject to funds availability.",
    body: "Funds are not presently available for the call or contemplated action. The Government's obligation is contingent upon the availability of appropriated funds from which payment can be made."
  },
  {
    id: "52.217-8",
    title: "Option to Extend Services",
    date: "NOV 1999",
    group: "Optional Call Terms",
    summary: "Optional continuation of services language for a specific call.",
    body: "The Government may require continued performance of services within the limits and at the rates stated in the call, if this clause is selected for that call."
  }
];

const coreClauseIds = clauseLibrary.filter((clause) => clause.core).map((clause) => clause.id);

const sampleState = {
  previewMode: "bpa",
  signatures: {
    supplier: false,
    government: false
  },
  document: {
    bpaType: "FAR13",
    arrangement: "single",
    title: "Deployed Support Supplies and Incidental Services",
    bpaNumber: "FA4867XXA0001",
    effectiveDate: "05/01/20XX",
    expirationDate: "04/30/20XX",
    trainingWatermark: true
  },
  government: {
    contactName: "SSgt Maya Reyes",
    contactPhone: "DSN 318-555-0101",
    issuedByCode: "FA4867",
    issuedByName: "FA4867",
    issuedByAddress: DEPLOYED_OFFICE_ADDRESS,
    deliverToCode: "F2D3JC",
    deliverToName: "Undisclosed Location",
    deliverToAddress: "Bldg 217, Deployed Logistics Rd\nUndisclosed Location, Overseas",
    adminCode: "FA4867",
    adminName: "FA4867",
    adminAddress: DEPLOYED_OFFICE_ADDRESS,
    paymentCode: "F87700",
    paymentName: "DFAS COLUMBUS",
    paymentAddress: "DFAS COLUMBUS"
  },
  supplier: {
    code: "K7M4Q9R2T8P1",
    facilityCode: "K7TP1",
    name: "Crescent Field Services LLC",
    address: "Bldg 12, Vendor Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0211",
    discountTerms: "Net 30",
    signer: "Avery Morgan, Authorized Representative"
  },
  terms: {
    aggregateLimit: "",
    fssScheduleContract: "GS-00F-20XX1",
    purchaseLimit: "the simplified acquisition threshold",
    billingCycle: "Monthly",
    reviewDate: "04/01/20XX",
    authorizedCallers: "Contracting Officer, FA4867 - up to the simplified acquisition threshold\nAny GPC holder - up to $25,000\nAuthorized Government Purchase Card holder, requiring activity - up to the micro-purchase threshold",
    description: "The supplier shall furnish the supplies or services described in general terms in this BPA if and when requested by the Contracting Officer or an authorized representative during the BPA period and within the stated purchase limitations.",
    orderingProcedures: "Authorized callers may place calls by written call document, email, or other written method that identifies the BPA number, call number, items or services requested, delivery or performance requirements, funding document, total call amount, and any applicable attached price list or catalog reference. The supplier shall not perform work or deliver supplies unless a call is issued by an authorized caller within the caller's authority.",
    deliveryTickets: "All shipments or services under this BPA shall be accompanied by a delivery ticket, sales slip, or service ticket showing, at a minimum, supplier name, BPA number, call number, date of purchase, itemized supplies or services furnished, quantity, unit price, extended amount, applicable discounts, and date of delivery or performance.",
    invoices: "The supplier shall submit a summary invoice at least monthly, or upon BPA expiration, whichever occurs first, for all deliveries or services accepted during the billing period. The invoice shall identify the BPA number, call numbers, delivery tickets or call records covered, total dollar value, applicable discounts, and shall be supported by receipt copies or WAWF receiving reports when required by the call."
  },
  call: {
    callNumber: "FA4867XXF0001",
    requisitionNumber: "F2D3JC-F9-20XX-0001",
    callDate: "05/02/20XX",
    deliveryDate: "05/30/20XX",
    callerName: "SSgt Maya Reyes",
    fundType: "om",
    funding: null,
    accountingData: "",
    scheduleMode: "attached",
    attachedPriceListTitle: "Attached BPA Price List",
    totalAmount: "12850",
    description: "Provide deployed support supplies and incidental services in accordance with the BPA and this call.",
    placeOfPerformance: "Bldg 217, Deployed Logistics Rd\nUndisclosed Location, Overseas"
  },
  lines: [
    {
      itemNumber: "0001",
      description: "BPA call for deployed support supplies and incidental services.",
      quantity: "1",
      unit: "LOT",
      unitPrice: "12850",
      amount: "12850"
    }
  ],
  clauses: {
    "52.217-8": false,
    "52.232-18": false
  }
};

let state = loadDraft() || structuredClone(sampleState);
enforceDefaults();

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const pageCount = document.querySelector("#pageCount");
const draftStatus = document.querySelector("#draftStatus");
const zoomInput = document.querySelector("#zoomInput");
const supplierSelect = document.querySelector("#supplierSelect");
const contactSelect = document.querySelector("#contactSelect");
const previewTitle = document.querySelector("#previewTitle");
const previewBpaBtn = document.querySelector("#previewBpaBtn");
const previewCallBtn = document.querySelector("#previewCallBtn");

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeState(structuredClone(sampleState), JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function mergeState(base, incoming) {
  Object.keys(incoming || {}).forEach((key) => {
    if (Array.isArray(incoming[key])) {
      base[key] = incoming[key];
    } else if (incoming[key] && typeof incoming[key] === "object" && base[key]) {
      base[key] = mergeState(base[key], incoming[key]);
    } else {
      base[key] = incoming[key];
    }
  });
  return base;
}

function randomTwoDigit() {
  return String(Math.floor(Math.random() * 100)).padStart(2, "0");
}

function randomFourDigit() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomAcrn() {
  return `${pickRandom(acrnChars)}${pickRandom(acrnChars)}`;
}

function simulatedCageCode(code = "") {
  const cleaned = String(code).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `${cleaned.slice(0, 2)}${cleaned.slice(-3)}`.padEnd(5, "0").slice(0, 5);
}

function supplierByCode(code) {
  return supplierRoster.find((supplier) => supplier.code === code) || supplierRoster[0];
}

function applySupplier(supplier) {
  state.supplier.code = supplier.code;
  state.supplier.name = supplier.name;
  state.supplier.address = supplier.address;
  state.supplier.phone = supplier.phone;
  state.supplier.facilityCode = supplier.facilityCode || simulatedCageCode(supplier.code);
  state.supplier.discountTerms = "Net 30";
  state.supplier.signer = supplier.signer;
}

function applyGovernmentContact(name) {
  const contact = airForceContacts.find((item) => item.name === name) || airForceContacts[0];
  state.government.contactName = contact.name;
  state.government.contactPhone = contact.phone;
  state.call.callerName = state.call.callerName || contact.name;
}

function setBpaSerial(serial = "01") {
  state.document.bpaNumber = `${PIID_ACTIVITY}XXA00${serial}`;
}

function setCallSerial(serial = "01") {
  state.call.callNumber = `${PIID_ACTIVITY}XXF00${serial}`;
}

function form9Dodaac() {
  return state.government?.deliverToCode || FORM9_DODAAC;
}

function formatForm9Number(serial = "0001") {
  const normalizedSerial = String(serial || "0001").replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `${form9Dodaac()}-F9-20XX-${normalizedSerial}`;
}

function badForm9Number(value = "") {
  const raw = String(value || "").trim();
  return !raw ||
    raw.startsWith("PR-XX-") ||
    /^FA4867-F9-/i.test(raw) ||
    /^FA4867XX[A-Z]00\d{2}$/i.test(raw);
}

function normalizeForm9Number(value, fallback = "0001") {
  if (badForm9Number(value)) return formatForm9Number(fallback);
  return String(value).replace(/\b20\d{2}\b/g, "20XX");
}

function randomizeBpa() {
  setBpaSerial(randomTwoDigit());
}

function randomizeCall() {
  setCallSerial(randomTwoDigit());
}

function randomizeForm9() {
  state.call.requisitionNumber = formatForm9Number(randomFourDigit());
}

function createFundingSeed(fundType = "om") {
  const profile = fundingProfiles[fundType] || fundingProfiles.om;
  return {
    acrn: randomAcrn(),
    aai: pickRandom(aaiCodes),
    tas: profile.tas,
    appn: profile.appn,
    budgetActivity: pickRandom(profile.budgetActivityOptions),
    subhead: pickRandom(profile.subheadOptions),
    eeic: pickRandom(profile.eeicOptions),
    organization: pickRandom(organizationCodes),
    costCenter: pickRandom(costCenters),
    project: pickRandom(projectCodes),
    fiscalStation: "503000",
    limit: "000000",
    objectClass: profile.objectClass
  };
}

function fundingLabel(fundType = "om") {
  return (fundingProfiles[fundType] || fundingProfiles.om).label;
}

function fundingLoa(seed) {
  return `${seed.tas} ${seed.budgetActivity} ${seed.subhead} ${seed.eeic} ${seed.organization} ${seed.costCenter} ${seed.project} ${seed.limit} ${seed.fiscalStation}`;
}

function accountingDataText() {
  const seed = state.call.funding;
  if (!seed) return "";
  return [
    `ACRN ${seed.acrn}: ${fundingLoa(seed)}`,
    `AAI: ${seed.aai}  DoD LOA: ${seed.tas} / ${seed.subhead} / ${seed.eeic} / ${seed.organization} / ${seed.costCenter}`,
    `Fund Type: ${fundingLabel(state.call.fundType)} (${seed.appn})  Object Class: ${seed.objectClass}`,
    `Funding Document: ${state.call.requisitionNumber}  Obligation: ${formatMoney(totalCallAmount())}`
  ].join("\n");
}

function syncCallComputedFields() {
  if (!fundingProfiles[state.call.fundType]) state.call.fundType = "om";
  if (!state.call.funding || state.call.funding.appn !== fundingProfiles[state.call.fundType].appn) {
    state.call.funding = createFundingSeed(state.call.fundType);
  }
  state.call.accountingData = accountingDataText();
}

function randomDeliveryAddress() {
  const seed = deliveryAddressSeeds[Math.floor(Math.random() * deliveryAddressSeeds.length)];
  return `Bldg ${seed.building}, ${seed.street}\nUndisclosed Location, Overseas`;
}

function futureProofDate(value) {
  if (!value) return value;
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/20XX`;
  return String(value).replace(/(\d{1,2}\/\d{1,2}\/)20\d{2}\b/g, "$120XX");
}

function enforceDefaults() {
  if (!["bpa", "call"].includes(state.previewMode)) state.previewMode = "bpa";
  const bpaMatch = String(state.document.bpaNumber || "").match(/^FA4867XXA00(\d{2})$/);
  const callMatch = String(state.call.callNumber || "").match(/^FA4867XXF00(\d{2})$/);
  setBpaSerial(bpaMatch?.[1] || "01");
  setCallSerial(callMatch?.[1] || "01");
  state.call.requisitionNumber = normalizeForm9Number(state.call.requisitionNumber);
  state.document.effectiveDate = futureProofDate(state.document.effectiveDate) || "05/01/20XX";
  state.document.expirationDate = futureProofDate(state.document.expirationDate) || "04/30/20XX";
  state.terms.reviewDate = futureProofDate(state.terms.reviewDate) || "04/01/20XX";
  state.call.callDate = futureProofDate(state.call.callDate) || "05/02/20XX";
  state.call.deliveryDate = futureProofDate(state.call.deliveryDate) || "05/30/20XX";

  applyGovernmentContact(state.government.contactName);
  state.government.issuedByCode = PIID_ACTIVITY;
  state.government.issuedByName = PIID_ACTIVITY;
  state.government.issuedByAddress = DEPLOYED_OFFICE_ADDRESS;
  state.government.deliverToCode = FORM9_DODAAC;
  state.government.deliverToName = "Undisclosed Location";
  if (!String(state.government.deliverToAddress || "").includes("Undisclosed Location, Overseas")) {
    state.government.deliverToAddress = randomDeliveryAddress();
  }
  state.government.adminCode = PIID_ACTIVITY;
  state.government.adminName = PIID_ACTIVITY;
  state.government.adminAddress = DEPLOYED_OFFICE_ADDRESS;
  state.government.paymentCode = "F87700";
  state.government.paymentName = "DFAS COLUMBUS";
  state.government.paymentAddress = "DFAS COLUMBUS";

  applySupplier(supplierByCode(state.supplier.code));
  if (!Array.isArray(state.lines) || !state.lines.length) {
    state.lines = structuredClone(sampleState.lines);
  }
  Object.keys(state.clauses).forEach((id) => {
    if (!clauseLibrary.some((clause) => clause.id === id)) delete state.clauses[id];
  });
  syncCallComputedFields();
}

function getPath(obj, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((cursor, key) => {
    if (!cursor[key]) cursor[key] = {};
    return cursor[key];
  }, obj);
  target[last] = value;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function attr(value = "") {
  return escapeHtml(value);
}

function applyTokens(value = "") {
  return String(value)
    .replaceAll("{{bpaNumber}}", state.document.bpaNumber || "")
    .replaceAll("{{callNumber}}", state.call.callNumber || "")
    .replaceAll("{{supplierName}}", state.supplier.name || "")
    .replaceAll("{{wawfInstructions}}", wawfInstructionsText());
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function formatMoney(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(number)) return "$0.00";
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  });
}

function formatLimit(value) {
  const text = String(value || "").trim();
  if (!text) return "the simplified acquisition threshold";
  const number = Number(text.replace(/,/g, ""));
  return Number.isFinite(number) ? formatMoney(number) : escapeHtml(text);
}

function plainNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function totalCallAmount() {
  if (state.call.scheduleMode === "attached") {
    return plainNumber(state.call.totalAmount);
  }
  return state.lines.reduce((sum, line) => sum + plainNumber(line.amount), 0);
}

function clauseSelected(id) {
  return coreClauseIds.includes(id) || Boolean(state.clauses[id]);
}

function selectedClauses(context = "call") {
  return clauseLibrary.filter((clause) => {
    if (!clauseSelected(clause.id)) return false;
    if (context === "bpa" && clause.id === "252.232-7006") return false;
    return true;
  });
}

function contractorSubmitterCode() {
  return state.supplier.facilityCode || state.supplier.code || "SEE SAM";
}

function wawfInstructionsText() {
  const issueBy = state.government.issuedByCode || PIID_ACTIVITY;
  const adminBy = state.government.adminCode || issueBy;
  const routingRows = [
    ["Document type", "Invoice 2-in-1"],
    ["Pay Official DoDAAC", state.government.paymentCode || "F87700"],
    ["Issue By DoDAAC", issueBy],
    ["Admin DoDAAC", adminBy],
    ["Inspect By DoDAAC", issueBy],
    ["Ship To Code", state.government.deliverToCode || FORM9_DODAAC],
    ["Ship From Code", "Not applicable"],
    ["Mark For Code", state.government.deliverToCode || FORM9_DODAAC],
    ["Service Approver (DoDAAC)", form9Dodaac()],
    ["Service Acceptor (DoDAAC)", issueBy],
    ["Accept at Other DoDAAC", "Not applicable"],
    ["LPO DoDAAC", "Not applicable"],
    ["DCAA Auditor DoDAAC", "Not applicable"],
    ["Other DoDAAC(s)", `Supplier submitter: ${contractorSubmitterCode()}`]
  ];

  return [
    "DFARS 252.232-7006 WAWF payment instructions fill-ins for this BPA call:",
    ...routingRows.map(([label, value]) => `${label}: ${value}`),
    `WAWF point of contact: ${state.government.contactName}, ${state.government.contactPhone}`
  ].join("\n");
}

function bpaTypeLabel() {
  return state.document.bpaType === "FSS"
    ? "Federal Supply Schedule BPA under FAR 8.405-3"
    : "Open market BPA under FAR 13.303";
}

function renderContactSelect() {
  contactSelect.innerHTML = airForceContacts.map((contact) => `
    <option value="${attr(contact.name)}">${escapeHtml(contact.name)}</option>
  `).join("");
}

function renderSupplierSelect() {
  supplierSelect.innerHTML = supplierRoster.map((supplier) => `
    <option value="${attr(supplier.code)}">${escapeHtml(supplier.code)} - ${escapeHtml(supplier.name)}</option>
  `).join("");
}

function syncControls() {
  document.querySelectorAll("[data-field]").forEach((control) => {
    const value = getPath(state, control.dataset.field);
    if (control.type === "checkbox") {
      control.checked = Boolean(value);
    } else {
      control.value = value ?? "";
    }
  });
  supplierSelect.value = state.supplier.code;
  contactSelect.value = state.government.contactName;
}

function renderLineEditor() {
  const root = document.querySelector("#lineEditor");
  if (state.call.scheduleMode === "attached") {
    root.innerHTML = `
      <div class="muted-panel">
        The call schedule will reference the attached price list instead of printing CLIN-level prices. Switch schedule mode to "Priced lines" to edit line items.
      </div>
    `;
    return;
  }

  root.innerHTML = state.lines.map((line, index) => `
    <article class="clin-card" data-line-index="${index}">
      <header>
        <strong>Line ${escapeHtml(line.itemNumber || String(index + 1).padStart(4, "0"))}</strong>
        <button type="button" class="small" data-remove-line="${index}">Remove</button>
      </header>
      <div class="field-grid two">
        <label>
          Item number
          <input data-line-field="itemNumber" value="${attr(line.itemNumber)}">
        </label>
        <label>
          Unit
          <input data-line-field="unit" value="${attr(line.unit)}">
        </label>
      </div>
      <label>
        Description
        <textarea data-line-field="description" rows="3">${escapeHtml(line.description)}</textarea>
      </label>
      <div class="field-grid three">
        <label>
          Quantity
          <input data-line-field="quantity" value="${attr(line.quantity)}">
        </label>
        <label>
          Unit price
          <input data-line-field="unitPrice" value="${attr(line.unitPrice)}">
        </label>
        <label>
          Amount
          <input data-line-field="amount" value="${attr(line.amount)}">
        </label>
      </div>
    </article>
  `).join("");
}

function renderClauseEditor() {
  const root = document.querySelector("#clauseEditor");
  const groups = clauseLibrary.reduce((map, clause) => {
    if (!map.has(clause.group)) map.set(clause.group, []);
    map.get(clause.group).push(clause);
    return map;
  }, new Map());

  root.innerHTML = Array.from(groups.entries()).map(([group, clauses]) => `
    <div class="clause-group">
      <h3>${escapeHtml(group)}</h3>
      ${clauses.map((clause) => `
        <label class="clause-option">
          <input type="checkbox" data-clause-id="${attr(clause.id)}" ${clauseSelected(clause.id) ? "checked" : ""} ${clause.core ? "disabled" : ""}>
          <span>
            <b>${escapeHtml(clause.id)} ${escapeHtml(clause.title)} (${escapeHtml(clause.date)})</b>
            <span>${escapeHtml(clause.summary)}</span>
          </span>
        </label>
      `).join("")}
    </div>
  `).join("");
}

function box(label, value = "", extraClass = "") {
  return `
    <div class="bpa-box ${extraClass}">
      <div class="bpa-label">${label}</div>
      <div class="bpa-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function sfBox(label, value = "", extraClass = "") {
  return `
    <div class="sf-box ${extraClass}">
      <div class="sf-label">${label}</div>
      <div class="sf-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function ofBox(label, value = "", extraClass = "") {
  return `
    <div class="of-box ${extraClass}">
      <div class="of-label">${label}</div>
      <div class="of-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderPage(title, content, pageNumber, totalPages) {
  const watermark = state.document.trainingWatermark ? "watermark" : "";
  return `
    <section class="document-page ${watermark}">
      <header class="bpa-page-header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <div>${escapeHtml(state.document.bpaNumber)} ${state.previewMode === "call" ? `/ ${escapeHtml(state.call.callNumber)}` : ""}</div>
        </div>
        <div>
          Page ${pageNumber} of ${totalPages}<br>
          ${escapeHtml(PIID_ACTIVITY)}
        </div>
      </header>
      ${content}
      <footer class="pack-footer">
        <span>Training BPA Package - Not for Award</span>
        <span>Page ${pageNumber} of ${totalPages}</span>
      </footer>
    </section>
  `;
}

function renderSf1449BpaCover(totalPages) {
  const pageClass = `document-page sf-cover-page ${state.document.trainingWatermark ? "watermark" : ""}`;
  const supplierBlock = `${state.supplier.name}\nUEI ${state.supplier.code}  CAGE ${state.supplier.facilityCode}\n${state.supplier.address}\nTelephone Number: ${state.supplier.phone}`;
  return `
    <section class="${pageClass}">
      <div class="sf-form">
        <div class="sf-row sf-title-row">
          <div class="sf-title">
            SOLICITATION/CONTRACT/ORDER FOR COMMERCIAL PRODUCTS AND COMMERCIAL SERVICES
            <div class="sf-note">BLANKET PURCHASE AGREEMENT - TRAINING SAMPLE</div>
          </div>
          ${sfBox("1. Requisition Number", "N/A - BPA MASTER")}
          <div class="sf-box">
            <div class="sf-label">Page 1 of</div>
            <div class="sf-value">${totalPages}</div>
          </div>
        </div>
        <div class="sf-row doc-ids">
          ${sfBox("2. Contract/BPA Number", state.document.bpaNumber)}
          ${sfBox("3. Effective Date", formatDate(state.document.effectiveDate))}
          ${sfBox("4. Order Number", "SEE BPA CALLS")}
          ${sfBox("5. Solicitation Number", "BPA SETUP")}
          ${sfBox("6. Issue Date", formatDate(state.document.effectiveDate))}
        </div>
        <div class="sf-row contact">
          <div class="sf-box">
            <div class="sf-label">7. For BPA Information Call</div>
            <div class="sf-value">a. Name: ${escapeHtml(state.government.contactName)}<br>b. Telephone Number: ${escapeHtml(state.government.contactPhone)}</div>
          </div>
          ${sfBox("8. BPA Period", `${formatDate(state.document.effectiveDate)} through ${formatDate(state.document.expirationDate)}`)}
          <div class="sf-box">
            <div class="sf-label">14. Method</div>
            <div class="sf-checkline">
              <span><span class="check">X</span> BPA</span>
              <span><span class="check">${state.document.bpaType === "FSS" ? "X" : ""}</span> FSS</span>
              <span><span class="check">${state.document.bpaType === "FAR13" ? "X" : ""}</span> FAR 13</span>
            </div>
          </div>
        </div>
        <div class="sf-row office">
          <div class="sf-box">
            <div class="sf-label">9. Issued By <span class="sf-tiny">Code ${escapeHtml(state.government.issuedByCode)}</span></div>
            <div class="sf-value">${escapeHtml(state.government.issuedByName)}<br>${escapeHtml(state.government.issuedByAddress)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">10. BPA Arrangement</div>
            <div class="sf-checkline">
              <span><span class="check">${state.document.arrangement === "single" ? "X" : ""}</span> Single-award</span>
              <span><span class="check">${state.document.arrangement === "multiple" ? "X" : ""}</span> Multiple-award</span>
            </div>
            <div class="sf-value">${escapeHtml(bpaTypeLabel())}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">11. Delivery / Performance</div>
            <div class="sf-value">Delivery and performance will be specified on individual BPA calls.</div>
          </div>
        </div>
        <div class="sf-row destination">
          ${sfBox("12. Discount Terms", state.supplier.discountTerms)}
          ${sfBox(`15. Deliver To Code ${state.government.deliverToCode}`, `${state.government.deliverToName}\n${state.government.deliverToAddress}`)}
          ${sfBox(`16. Administered By Code ${state.government.adminCode}`, `${state.government.adminName}\n${state.government.adminAddress}`)}
        </div>
        <div class="sf-row contractor">
          <div class="sf-box">
            <div class="sf-label">17a. Contractor / Supplier</div>
            <div class="sf-value">${escapeHtml(supplierBlock)}</div>
            <div class="sf-checkline"><span><span class="check"></span> 17b. Remittance address is different</span></div>
          </div>
          <div class="sf-box">
            <div class="sf-label">18a. Payment Will Be Made By <span class="sf-tiny">Code ${escapeHtml(state.government.paymentCode)}</span></div>
            <div class="sf-value">${escapeHtml(state.government.paymentName)}<br>${escapeHtml(state.government.paymentAddress)}</div>
            <div class="sf-checkline"><span><span class="check">X</span> 18b. See call-level WAWF instructions</span></div>
          </div>
        </div>
        <table class="sf-schedule">
          <thead>
            <tr>
              <th style="width: 13%;">19.<br>Item Number</th>
              <th style="width: 48%;">20.<br>Schedule of Supplies/Services</th>
              <th style="width: 10%;">21.<br>Quantity</th>
              <th style="width: 9%;">22.<br>Unit</th>
              <th style="width: 10%;">23.<br>Unit Price</th>
              <th style="width: 10%;">24.<br>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr class="sf-schedule-continuation-row">
              <td></td>
              <td class="sf-continuation-note">SEE BPA TERMS, AUTHORIZED CALLERS, PURCHASE LIMITS, AND INDIVIDUAL CALLS</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            <tr class="sf-schedule-helper-row">
              <td colspan="6" class="sf-schedule-instruction">The master BPA does not obligate funds. Supplies or services are ordered only by authorized BPA calls.</td>
            </tr>
          </tbody>
        </table>
        <div class="sf-row money">
          ${sfBox("25. Accounting and Appropriation Data", "NOT CITED ON MASTER BPA - SEE INDIVIDUAL CALLS")}
          ${sfBox("26. Total Award Amount (For Government Use Only)", "N/A - BPA MASTER")}
        </div>
        <div class="sf-row addenda">
          <div class="sf-box">
            <div class="sf-label">27a/27b. BPA Incorporates Terms and Conditions</div>
            <div class="sf-checkline">
              <span><span class="check">X</span> FAR BPA procedures and listed clauses/references are incorporated.</span>
              <span><span class="check">X</span> Addenda and continuation pages are attached.</span>
            </div>
          </div>
        </div>
        <div class="sf-row award">
          <div class="sf-box">
            <div class="sf-label">28. Supplier Agreement</div>
            <div class="sf-value">The supplier agrees to furnish supplies or services if and when requested by authorized BPA calls during the BPA period, subject to the terms, purchase limitations, delivery-ticket requirements, invoice procedures, and clauses stated herein.</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">29. Establishment of BPA</div>
            <div class="sf-value">This BPA establishes a charge account arrangement only. The Government is obligated solely to the extent of authorized calls actually placed under this BPA.</div>
          </div>
        </div>
        <div class="sf-row signatures">
          ${sfBox("30a. Signature of Supplier", "", "signature-box")}
          ${sfBox("31a. United States of America (Signature of Contracting Officer)", "", "signature-box")}
        </div>
        <div class="sf-row sign-names">
          ${sfBox("30b. Name and Title of Signer", state.supplier.signer)}
          ${sfBox("30c. Date Signed", "")}
          ${sfBox("31b. Name of Contracting Officer", state.government.contactName)}
          ${sfBox("31c. Date Signed", "")}
        </div>
      </div>
      <div class="sf-footer">
        <span>AUTHORIZED FOR LOCAL REPRODUCTION - TRAINING SAMPLE</span>
        <strong>STANDARD FORM 1449 STYLE BPA PACKAGE</strong>
      </div>
    </section>
  `;
}

function renderFssSupplement() {
  if (state.document.bpaType !== "FSS") return "";
  const scheduleContract = state.terms.fssScheduleContract
    ? `Schedule contract ${state.terms.fssScheduleContract}`
    : "the applicable Federal Supply Schedule contract";
  const arrangementText = state.document.arrangement === "multiple"
    ? "For multiple-award BPAs, calls shall be placed using the ordering procedures stated in this BPA and FAR 8.405-3."
    : "For a single-award BPA, calls shall be placed only within the scope, period, and ordering limitations of this BPA and the applicable Schedule contract.";

  return `
    <h3>8. Federal Supply Schedule BPA Supplement</h3>
    <p>This BPA is established under FAR 8.405-3 against ${escapeHtml(scheduleContract)}. Orders placed under this BPA are subject to the terms of the BPA, the applicable Federal Supply Schedule contract, and FAR Subpart 8.4 ordering procedures. This BPA does not alter the underlying Schedule contract terms except as authorized by the Schedule contract and applicable regulations.</p>
    <p>${escapeHtml(arrangementText)} Calls shall address the supplies or services ordered, frequency of ordering, invoicing, discounts, requirements, delivery locations, delivery or performance time, and price or price-list basis.</p>
  `;
}

function renderBpaTerms() {
  return `
    <section class="bpa-section">
      <h2>BPA Terms and Conditions</h2>
      <h3>1. Description of Agreement</h3>
      <p>${escapeHtml(state.terms.description)}</p>
      <h3>2. Extent of Obligation</h3>
      <p>The Government is obligated only to the extent of authorized purchases actually made under this BPA. This BPA does not require the Government to place any minimum number of calls and does not require the supplier to perform unless an authorized call is issued within the stated scope and limitations.</p>
      <h3>3. Purchase Limitation</h3>
      <p>Individual calls shall not exceed ${formatLimit(state.terms.purchaseLimit)} unless modified in writing by the Contracting Officer and otherwise permitted by law and regulation.${state.terms.aggregateLimit ? ` Aggregate value guidance: ${escapeHtml(state.terms.aggregateLimit)}` : " No stipulated aggregate amount is stated for this master BPA."}</p>
      <h3>4. Individuals Authorized to Purchase</h3>
      <p>${escapeHtml(state.terms.authorizedCallers)}</p>
      <h3>5. Ordering Procedures</h3>
      <p>${escapeHtml(state.terms.orderingProcedures)}</p>
    </section>
    <section class="bpa-section">
      <h2>Delivery Tickets and Invoices</h2>
      <h3>Delivery Tickets</h3>
      <p>${escapeHtml(state.terms.deliveryTickets)}</p>
      <h3>Invoices</h3>
      <p>${escapeHtml(state.terms.invoices)}</p>
      <h3>Administration</h3>
      <p>The Contracting Officer may cancel or revise this BPA by written notice. The Contracting Officer will review the BPA at least annually, before the review date stated in this agreement when practicable, to confirm authorized procedures are being followed and to determine whether the BPA remains advantageous. The review shall consider the authorized caller list, purchase limitations, supplier performance, price list or catalog currency, discounts, market conditions, available sources, and whether updates or new arrangements are warranted.</p>
      ${renderFssSupplement()}
    </section>
  `;
}

function renderClauseMatrix(context = "call") {
  const clauses = selectedClauses(context);
  return `
    <section class="bpa-section">
      <h2>Clauses and References</h2>
      <table class="bpa-table">
        <thead>
          <tr><th style="width: 18%;">Reference</th><th>Title</th><th style="width: 13%;">Date</th><th style="width: 16%;">Method</th></tr>
        </thead>
        <tbody>
          ${clauses.map((clause) => `
            <tr>
              <td>${escapeHtml(clause.id)}</td>
              <td>${escapeHtml(clause.title)}</td>
              <td>${escapeHtml(clause.date)}</td>
              <td>${clause.core ? "Reference" : "Full text"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${clauses.map((clause) => `
        <h3>${escapeHtml(clause.id)} ${escapeHtml(clause.title)}</h3>
        <p>${escapeHtml(applyTokens(clause.body))}</p>
      `).join("")}
    </section>
  `;
}

function renderBpaPackage() {
  const pages = [
    { title: "BPA Terms", content: renderBpaTerms() },
    { title: "Clauses and References", content: renderClauseMatrix("bpa") }
  ];
  const totalPages = pages.length + 1;
  return [
    renderSf1449BpaCover(totalPages),
    ...pages.map((page, index) => renderPage(page.title, page.content, index + 2, totalPages))
  ];
}

function renderOf347CallCover(totalPages) {
  const total = formatMoney(totalCallAmount());
  const pageClass = `document-page of347-cover ${state.document.trainingWatermark ? "watermark" : ""}`;
  const useAttachedPriceList = state.call.scheduleMode === "attached";
  const lines = useAttachedPriceList ? [] : state.lines.slice(0, 6);
  return `
    <section class="${pageClass}">
      <div class="of347-form">
        <div class="of-row of347-title-row">
          <div class="of-title">
            ORDER FOR SUPPLIES OR SERVICES
            <div class="of-note">IMPORTANT: Mark all packages and papers with contract and/or order numbers.</div>
          </div>
          ${ofBox("Page", `1 of ${totalPages}`)}
        </div>
        <div class="of-row of347-ids">
          ${ofBox("1. Date of Order", formatDate(state.call.callDate))}
          ${ofBox("2. Contract Number (If any)", state.document.bpaNumber)}
          ${ofBox("3. Order Number", state.call.callNumber)}
          ${ofBox("4. Requisition/Reference Number", state.call.requisitionNumber)}
        </div>
        <div class="of-row of347-addresses">
          ${ofBox("5. Issuing Office (Address correspondence to)", `${state.government.issuedByName}\n${state.government.issuedByAddress}`)}
          ${ofBox("6. Ship To / Performance Location", `a. Name of consignee: ${state.government.deliverToName}\nb. Street address: ${state.government.deliverToAddress}\nf. Ship via: Best method`)}
        </div>
        <div class="of-row of347-to-order">
          ${ofBox("7. To", `a. Name of contractor: ${state.supplier.name}\nb. UEI: ${state.supplier.code}  CAGE: ${state.supplier.facilityCode}\n${state.supplier.address}\nPhone: ${state.supplier.phone}`)}
          <div class="of-box">
            <div class="of-label">8. Type of Order</div>
            <div class="of-checkline">
              <span><span class="check"></span> a. Purchase</span>
              <span><span class="check">X</span> b. Delivery/Call</span>
            </div>
            <div class="of-value">This BPA call is issued subject to the terms and conditions of BPA ${escapeHtml(state.document.bpaNumber)} and the terms stated on this order.</div>
          </div>
        </div>
        <div class="of-row of347-accounting">
          ${ofBox("9. Accounting and Appropriation Data", state.call.accountingData)}
        </div>
        <div class="of-row of347-admin">
          ${ofBox("10. Requisitioning Office", `${state.government.deliverToCode}\n${state.government.deliverToName}`)}
          <div class="of-box">
            <div class="of-label">11. Business Classification</div>
            <div class="of-checkline">
              <span><span class="check">X</span> Small</span>
              <span><span class="check"></span> Other than small</span>
              <span><span class="check"></span> WOSB</span>
              <span><span class="check"></span> SDVOSB</span>
            </div>
          </div>
          ${ofBox("12. F.O.B. Point", "Destination")}
        </div>
        <div class="of-row of347-delivery">
          ${ofBox("13. Place of Inspection / Acceptance", `Inspection: Destination\nAcceptance: Destination`)}
          ${ofBox("14. Government B/L Number", "N/A")}
          ${ofBox("15. Deliver To F.O.B. Point On or Before", formatDate(state.call.deliveryDate))}
          ${ofBox("16. Discount Terms", state.supplier.discountTerms)}
        </div>
        <table class="of-schedule">
          <thead>
            <tr>
              <th style="width: 10%;">17a.<br>Item No.</th>
              <th>17b.<br>Supplies or Services</th>
              <th style="width: 11%;">17c.<br>Qty Ordered</th>
              <th style="width: 9%;">17d.<br>Unit</th>
              <th style="width: 12%;">17e.<br>Unit Price</th>
              <th style="width: 13%;">17f.<br>Amount</th>
              <th style="width: 10%;">17g.<br>Qty Accepted</th>
            </tr>
          </thead>
          <tbody>
            ${useAttachedPriceList ? `
              <tr class="of-attached-price-row">
                <td>0001</td>
                <td>SEE ATTACHED PRICE LIST / BPA CATALOG. Supplies or services shall be ordered in accordance with the BPA and this call.</td>
                <td style="text-align: right;">1</td>
                <td style="text-align: center;">LOT</td>
                <td style="text-align: center;">SEE ATTACHMENT</td>
                <td style="text-align: right;">${total}</td>
                <td></td>
              </tr>
            ` : lines.map((line) => `
              <tr>
                <td>${escapeHtml(line.itemNumber)}</td>
                <td>${escapeHtml(line.description)}</td>
                <td style="text-align: right;">${escapeHtml(line.quantity)}</td>
                <td style="text-align: center;">${escapeHtml(line.unit)}</td>
                <td style="text-align: right;">${formatMoney(line.unitPrice)}</td>
                <td style="text-align: right;">${formatMoney(line.amount)}</td>
                <td></td>
              </tr>
            `).join("")}
            ${!useAttachedPriceList && state.lines.length > lines.length ? `
              <tr>
                <td colspan="7" class="of-continuation-note">Additional line items continue on the schedule continuation page.</td>
              </tr>
            ` : ""}
          </tbody>
        </table>
        <div class="of-row of347-totals">
          ${ofBox("18. Shipping Point", "Destination")}
          ${ofBox("19. Gross Shipping Weight", "N/A")}
          ${ofBox("20. Invoice Number", "Supplier assigned")}
          ${ofBox("21. Mail Invoice To", `WAWF / DFAS COLUMBUS\nPay DoDAAC ${state.government.paymentCode}`)}
          ${ofBox("17h. Total (Cont. Pages)", state.lines.length > lines.length ? total : "")}
          ${ofBox("17i. Grand Total", total)}
        </div>
        <div class="of-row of347-sign">
          ${ofBox("22. United States of America By (Signature)", "", "signature-box")}
          ${ofBox("23. Name (Typed)", `${state.call.callerName}\nTitle: Contracting/Ordering Officer`)}
        </div>
      </div>
      <div class="sf-footer">
        <span>OPTIONAL FORM 347 STYLE (REV. 2/2012) - TRAINING SAMPLE</span>
        <strong>Prescribed by GSA/FAR 48 CFR 53.213(f)</strong>
      </div>
    </section>
  `;
}

function renderCallCover() {
  const total = formatMoney(totalCallAmount());
  const scheduleText = state.call.scheduleMode === "attached"
    ? `Schedule and pricing are stated in ${state.call.attachedPriceListTitle || "the attached price list"}.`
    : "Schedule and pricing are stated in the line-item schedule.";
  return `
    <section class="bpa-cover">
      <div class="bpa-title">
        <h2>BPA Call Addendum</h2>
        <p>Call issued under ${escapeHtml(state.document.bpaNumber)}</p>
      </div>
      <table class="bpa-table">
        <tbody>
          <tr><th>Call number</th><td>${escapeHtml(state.call.callNumber)}</td></tr>
          <tr><th>BPA number</th><td>${escapeHtml(state.document.bpaNumber)}</td></tr>
          <tr><th>Description</th><td>${escapeHtml(state.call.description)}</td></tr>
          <tr><th>Delivery / Performance</th><td>Complete delivery or performance not later than ${escapeHtml(formatDate(state.call.deliveryDate))}, unless otherwise directed by the Contracting Officer.</td></tr>
          <tr><th>Schedule Mode</th><td>${escapeHtml(scheduleText)}</td></tr>
          <tr><th>Place</th><td>${escapeHtml(state.call.placeOfPerformance)}</td></tr>
          <tr><th>Accounting Data</th><td>${escapeHtml(state.call.accountingData)}</td></tr>
          <tr><th>Total Call Amount</th><td>${total}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderCallLines() {
  if (state.call.scheduleMode === "attached") {
    return `
      <section class="bpa-section">
        <h2>Schedule of Supplies / Services</h2>
        <table class="bpa-table">
          <tbody>
            <tr><th>Schedule</th><td>See ${escapeHtml(state.call.attachedPriceListTitle || "attached price list")}.</td></tr>
            <tr><th>Call Amount</th><td>${formatMoney(totalCallAmount())}</td></tr>
            <tr><th>Ordering Basis</th><td>The supplier shall provide supplies or services ordered under this call in accordance with the BPA, the attached price list or BPA catalog, and any delivery or performance instructions stated in the call.</td></tr>
          </tbody>
        </table>
        <h3>Call Terms</h3>
        <p>This call is issued under the BPA identified above. The supplier shall furnish only the supplies or services stated in this call or the attached price list. This call obligates funds only in the amount stated.</p>
        <h3>Delivery Tickets and Invoicing</h3>
        <p>Delivery tickets, receiving documentation, and invoices shall identify the BPA number, call number, Form 9/requisition number, item or catalog reference, quantity, unit price when applicable, and amount. Invoices shall be submitted in accordance with the BPA and the WAWF payment instructions in the clause section.</p>
      </section>
    `;
  }

  return `
    <section class="bpa-section">
      <h2>Schedule of Supplies / Services</h2>
      <table class="bpa-table">
        <thead>
          <tr>
            <th style="width: 12%;">Line</th>
            <th>Description</th>
            <th style="width: 10%;">Qty</th>
            <th style="width: 10%;">Unit</th>
            <th style="width: 14%;">Unit Price</th>
            <th style="width: 14%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${state.lines.map((line) => `
            <tr>
              <td>${escapeHtml(line.itemNumber)}</td>
              <td>${escapeHtml(line.description)}</td>
              <td style="text-align: right;">${escapeHtml(line.quantity)}</td>
              <td style="text-align: center;">${escapeHtml(line.unit)}</td>
              <td style="text-align: right;">${formatMoney(line.unitPrice)}</td>
              <td style="text-align: right;">${formatMoney(line.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p><strong>Total Call Amount:</strong> ${formatMoney(totalCallAmount())}</p>
      <h3>Call Terms</h3>
      <p>This call is issued under the BPA identified above. The supplier shall furnish only the supplies or services stated in this call. This call obligates funds only in the amount stated and only for the line items listed above.</p>
      <h3>Delivery Tickets and Invoicing</h3>
      <p>Delivery tickets, receiving documentation, and invoices shall identify the BPA number, call number, Form 9/requisition number, line item, quantity, unit price, and amount. Invoices shall be submitted in accordance with the BPA and the WAWF payment instructions in the clause section.</p>
    </section>
  `;
}

function renderCallPackage() {
  const pages = [
    { title: "BPA Call Addendum", content: renderCallCover() },
    { title: "BPA Call Schedule", content: renderCallLines() },
    { title: "Call Clauses and References", content: renderClauseMatrix("call") }
  ];
  const totalPages = pages.length + 1;
  return [
    renderOf347CallCover(totalPages),
    ...pages.map((page, index) => renderPage(page.title, page.content, index + 2, totalPages))
  ];
}

function renderPreview() {
  syncCallComputedFields();
  const isCall = state.previewMode === "call";
  const pages = isCall ? renderCallPackage() : renderBpaPackage();
  preview.innerHTML = `<div class="document-pack">${pages.join("")}</div>`;
  pageCount.textContent = `${pages.length} pages`;
  previewTitle.textContent = isCall ? "OF 347 BPA Call Preview" : "SF 1449-Style BPA Preview";
  previewBpaBtn.classList.toggle("active", !isCall);
  previewCallBtn.classList.toggle("active", isCall);
}

function renderAll() {
  syncCallComputedFields();
  renderContactSelect();
  renderSupplierSelect();
  syncControls();
  renderLineEditor();
  renderClauseEditor();
  renderPreview();
}

function markDirty() {
  draftStatus.textContent = "Unsaved";
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  draftStatus.textContent = "Saved";
}

function applyProfile() {
  state.clauses = {
    "52.217-8": false,
    "52.232-18": false
  };
  markDirty();
  renderAll();
}

editor.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setPath(state, target.dataset.field, value);
    if (target.dataset.field === "call.requisitionNumber") {
      syncCallComputedFields();
    }
    markDirty();
    renderPreview();
  }

  if (target.matches("[data-line-field]")) {
    const card = target.closest("[data-line-index]");
    const index = Number(card.dataset.lineIndex);
    state.lines[index][target.dataset.lineField] = target.value;
    if (target.dataset.lineField === "quantity" || target.dataset.lineField === "unitPrice") {
      const quantity = plainNumber(state.lines[index].quantity);
      const unitPrice = plainNumber(state.lines[index].unitPrice);
      if (quantity || unitPrice) {
        state.lines[index].amount = String(quantity * unitPrice);
        const amountInput = card.querySelector('[data-line-field="amount"]');
        if (amountInput) amountInput.value = state.lines[index].amount;
      }
    }
    syncCallComputedFields();
    markDirty();
    renderPreview();
  }
});

editor.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setPath(state, target.dataset.field, value);
    if (target.dataset.field === "government.contactName") {
      applyGovernmentContact(state.government.contactName);
    }
    if (target.dataset.field === "call.requisitionNumber") {
      state.call.requisitionNumber = normalizeForm9Number(state.call.requisitionNumber);
    }
    if (target.dataset.field === "call.fundType") {
      state.call.funding = createFundingSeed(state.call.fundType);
      syncCallComputedFields();
    }
    markDirty();
    renderAll();
  }

  if (target.matches("[data-clause-id]")) {
    state.clauses[target.dataset.clauseId] = target.checked;
    markDirty();
    renderPreview();
  }
});

editor.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-line]");
  if (removeButton) {
    const index = Number(removeButton.dataset.removeLine);
    state.lines.splice(index, 1);
    syncCallComputedFields();
    markDirty();
    renderAll();
  }
});

supplierSelect.addEventListener("change", () => {
  applySupplier(supplierByCode(supplierSelect.value));
  markDirty();
  renderAll();
});

document.querySelector("#addLineBtn").addEventListener("click", () => {
  const last = state.lines[state.lines.length - 1];
  const nextNumber = last?.itemNumber ? String(Number(last.itemNumber) + 1).padStart(4, "0") : "0001";
  state.lines.push({
    itemNumber: Number.isNaN(Number(nextNumber)) ? "" : nextNumber,
    description: "",
    quantity: "1",
    unit: "EA",
    unitPrice: "0",
    amount: "0"
  });
  markDirty();
  renderAll();
});

document.querySelector("#randomBpaBtn").addEventListener("click", () => {
  randomizeBpa();
  markDirty();
  renderAll();
});

document.querySelector("#randomCallBtn").addEventListener("click", () => {
  randomizeCall();
  markDirty();
  renderAll();
});

document.querySelector("#randomForm9Btn").addEventListener("click", () => {
  randomizeForm9();
  syncCallComputedFields();
  markDirty();
  renderAll();
});

document.querySelector("#randomDeliveryBtn").addEventListener("click", () => {
  state.government.deliverToAddress = randomDeliveryAddress();
  state.call.placeOfPerformance = state.government.deliverToAddress;
  markDirty();
  renderAll();
});

document.querySelector("#randomFundingBtn").addEventListener("click", () => {
  state.call.funding = createFundingSeed(state.call.fundType);
  syncCallComputedFields();
  markDirty();
  renderAll();
});

document.querySelector("#applyProfileBtn").addEventListener("click", applyProfile);

previewBpaBtn.addEventListener("click", () => {
  state.previewMode = "bpa";
  renderAll();
});

previewCallBtn.addEventListener("click", () => {
  state.previewMode = "call";
  renderAll();
});

document.querySelector("#sampleBtn").addEventListener("click", () => {
  state = structuredClone(sampleState);
  enforceDefaults();
  markDirty();
  renderAll();
});

document.querySelector("#saveDraftBtn").addEventListener("click", saveDraft);

document.querySelector("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.document.bpaNumber || "bpa-draft"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    state = mergeState(structuredClone(sampleState), imported);
    enforceDefaults();
    markDirty();
    renderAll();
  } catch {
    alert("That JSON file could not be imported.");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#printBtn").addEventListener("click", () => {
  renderPreview();
  window.print();
});

zoomInput.addEventListener("input", () => {
  preview.style.setProperty("--preview-scale", Number(zoomInput.value) / 100);
});

preview.style.setProperty("--preview-scale", Number(zoomInput.value) / 100);
renderAll();
