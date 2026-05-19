const STORAGE_KEY = "idiq-generator-draft-v1";
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

const contractorRoster = [
  {
    uei: "K7M4Q9R2T8P1",
    cage: "K7TP1",
    name: "Crescent Field Services LLC",
    address: "Bldg 12, Vendor Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0211",
    signer: "Avery Morgan, Managing Member"
  },
  {
    uei: "P3L8V6N1C5X9",
    cage: "P3CX9",
    name: "Summit Transit Solutions LLC",
    address: "Bldg 28, Contractor Staging Area\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0212",
    signer: "Riley Chen, Program Manager"
  },
  {
    uei: "H9C2D7F5M1Q4",
    cage: "H9MQ4",
    name: "Harbor Range Support LLC",
    address: "Bldg 43, Mission Support Annex\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0213",
    signer: "Taylor Grant, Managing Member"
  },
  {
    uei: "R6T1K4W8Z3N2",
    cage: "R6ZN2",
    name: "Vector Base Operations LLC",
    address: "Bldg 57, Expeditionary Service Row\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0214",
    signer: "Morgan Ellis, Operations Director"
  },
  {
    uei: "N2Q8B5L7S4V1",
    cage: "N2SV1",
    name: "Pioneer Logistics Group LLC",
    address: "Bldg 64, Forward Vendor Lot\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0215",
    signer: "Casey Porter, Authorized Official"
  },
  {
    uei: "T5J9X2C6H8D3",
    cage: "T5HD3",
    name: "Sable Support Services LLC",
    address: "Bldg 78, Contingency Services Ln\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0216",
    signer: "Jordan Blake, Contract Manager"
  },
  {
    uei: "D4W7M1R9K6P2",
    cage: "D4KP2",
    name: "Northline Mission Services LLC",
    address: "Bldg 86, Deployed Vendor Complex\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0217",
    signer: "Jamie Collins, Managing Director"
  },
  {
    uei: "V8S3Q6T1L5B9",
    cage: "V8LB9",
    name: "Frontier Site Solutions LLC",
    address: "Bldg 93, Support Contractor Area\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0218",
    signer: "Skyler Reed, Authorized Representative"
  }
];

const clauseLibrary = [
  {
    id: "52.204-7",
    title: "System for Award Management",
    date: "OCT 2018",
    group: "Core",
    core: true,
    method: "Reference",
    body: "Incorporated by reference. Contractor registration requirements apply as required for award, ordering, payment, and performance."
  },
  {
    id: "52.204-13",
    title: "System for Award Management Maintenance",
    date: "OCT 2018",
    group: "Core",
    core: true,
    method: "Reference",
    body: "Incorporated by reference. Contractor shall keep SAM information current through final payment under the contract and orders."
  },
  {
    id: "52.204-21",
    title: "Basic Safeguarding of Covered Contractor Information Systems",
    date: "NOV 2021",
    group: "Core",
    core: true,
    method: "Reference",
    body: "Incorporated by reference when Federal contract information is processed, stored, or transmitted by contractor systems."
  },
  {
    id: "52.216-18",
    title: "Ordering",
    date: "AUG 2020",
    group: "IDIQ",
    core: true,
    method: "Full text fill-in",
    body: "Orders may be issued from {{orderingStartDate}} through {{orderingEndDate}} by the individuals or activities designated in Section H. Orders are subject to the terms and conditions of this contract. If an order conflicts with this contract, the contract controls."
  },
  {
    id: "52.216-19",
    title: "Order Limitations",
    date: "OCT 1995",
    group: "IDIQ",
    core: true,
    method: "Full text fill-in",
    body: "Minimum order: {{minimumOrder}}. The contractor is not obligated to honor any order for a single item over {{maximumSingleItem}}, any order for a combination of items over {{maximumCombination}}, or a series of orders from the same ordering office within {{seriesOrderDays}} days that together exceeds those limits, unless the contractor accepts the order. The contractor shall return any order it does not intend to honor within {{rejectionDays}} days after issuance."
  },
  {
    id: "52.216-22",
    title: "Indefinite Quantity",
    date: "OCT 1995",
    group: "IDIQ",
    core: true,
    method: "Full text fill-in",
    body: "This is an indefinite-quantity contract for the supplies or services specified in the Schedule. The Government shall order at least {{guaranteedMinimum}} and the contractor shall furnish ordered supplies or services up to {{ceiling}}. Orders issued during the effective period shall be completed within the time specified in each order, but the contractor is not required to perform after {{finalCompletionDate}}."
  },
  {
    id: "52.216-27",
    title: "Single or Multiple Awards",
    date: "OCT 1995",
    group: "IDIQ",
    solicitationOnly: true,
    multipleOnly: true,
    method: "Provision",
    body: "The Government may elect to award a single task-order or delivery-order contract, or to award multiple contracts for the same or similar supplies or services. The estimated number of awards is {{estimatedAwards}}."
  },
  {
    id: "52.216-32",
    title: "Task-Order and Delivery-Order Ombudsman",
    date: "SEP 2019",
    group: "IDIQ",
    multipleOnly: true,
    method: "Full text fill-in",
    body: "The agency task-order and delivery-order ombudsman for this contract is {{ombudsman}}. The ombudsman reviews contractor complaints concerning order actions and fair opportunity procedures. Contractors are encouraged to first address concerns with the Contracting Officer."
  },
  {
    id: "52.232-33",
    title: "Payment by Electronic Funds Transfer - System for Award Management",
    date: "OCT 2018",
    group: "Payment",
    core: true,
    method: "Reference",
    body: "Incorporated by reference. Payment will be made by electronic funds transfer using SAM banking information."
  },
  {
    id: "252.232-7003",
    title: "Electronic Submission of Payment Requests and Receiving Reports",
    date: "DEC 2018",
    group: "Payment",
    core: true,
    method: "Reference",
    body: "Incorporated by reference. Payment requests and receiving reports for orders shall be submitted electronically through WAWF unless an authorized exception applies."
  },
  {
    id: "252.232-7006",
    title: "Wide Area WorkFlow Payment Instructions",
    date: "JAN 2023",
    group: "Payment",
    core: true,
    method: "Order fill-in",
    body: "Incorporated by reference. Completed WAWF routing data will be stated at the task-order or delivery-order level. Default routing for orders: Pay Official DoDAAC F87700; Issue By DoDAAC FA4867; Admin DoDAAC FA4867; Ship To and Mark For DoDAAC F2D3JC unless otherwise stated in the order."
  }
];

const sampleState = {
  document: {
    documentType: "contract",
    solicitationMethod: "RFP",
    title: "Deployed Support Services Indefinite-Delivery Indefinite-Quantity Contract",
    contractNumber: "FA4867XXD0001",
    solicitationNumber: "FA4867XXR0001",
    requisitionNumber: "F2D3JC-F9-20XX-0001",
    issueDate: "05/01/20XX",
    offerDueDate: "05/20/20XX",
    awardDate: "05/30/20XX",
    trainingWatermark: true
  },
  government: {
    contactName: "SSgt Maya Reyes",
    contactPhone: "DSN 318-555-0101",
    issuedByCode: PIID_ACTIVITY,
    issuedByName: PIID_ACTIVITY,
    issuedByAddress: DEPLOYED_OFFICE_ADDRESS,
    deliverToCode: FORM9_DODAAC,
    deliverToName: "Undisclosed Location",
    deliverToAddress: "Bldg 217, Deployed Logistics Rd\nUndisclosed Location, Overseas",
    adminCode: PIID_ACTIVITY,
    adminName: PIID_ACTIVITY,
    adminAddress: DEPLOYED_OFFICE_ADDRESS,
    paymentCode: "F87700",
    paymentName: "DFAS COLUMBUS",
    paymentAddress: "DFAS COLUMBUS"
  },
  contractor: {
    uei: "K7M4Q9R2T8P1",
    cage: "K7TP1",
    name: "Crescent Field Services LLC",
    address: "Bldg 12, Vendor Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0211",
    discountTerms: "Net 30",
    signer: "Avery Morgan, Managing Member"
  },
  idiq: {
    awardApproach: "single",
    orderType: "task",
    ceiling: "2500000",
    guaranteedMinimum: "2500",
    minimumOrder: "500",
    maximumSingleItem: "250000",
    maximumCombination: "500000",
    seriesOrderDays: "30",
    rejectionDays: "3",
    estimatedAwards: "1",
    orderingStartDate: "05/30/20XX",
    orderingEndDate: "05/29/20XX",
    finalCompletionDate: "11/29/20XX",
    ombudsman: "Agency Task-Order and Delivery-Order Ombudsman, address and contact information available through the issuing office.",
    orderingActivities: "FA4867 Deployed Contracting Squadron\nAny successor deployed contracting activity designated in writing by the Contracting Officer",
    orderingProcedures: "Orders may be issued by written task order or delivery order using the contract writing system, email distribution of a signed order, or another written method authorized by the Contracting Officer. Oral orders are not authorized unless confirmed in writing and supported by established funds-obligation procedures. Each order will identify the order number, scope, delivery or performance location, period of performance, funding, accounting data, inspection and acceptance terms, and WAWF routing instructions.",
    fairOpportunity: "For multiple-award IDIQ contracts, each awardee will be provided a fair opportunity to be considered for each order exceeding the micro-purchase threshold unless a FAR 16.505 exception applies. The Contracting Officer may use streamlined ordering procedures tailored to the requirement and shall consider price or cost under each order.",
    scope: "The contractor shall provide recurring deployed support supplies, logistics support, minor incidental services, and related mission support tasks within the general scope of this contract when ordered by authorized task orders or delivery orders. Exact quantities, delivery locations, and performance requirements will be stated in individual orders."
  },
  clins: [
    {
      itemNumber: "0001",
      description: "IDIQ ordering capacity for deployed support services and supplies. Orders will specify exact tasks, deliverables, quantities, and prices.",
      unit: "LOT",
      minimum: "2500",
      maximum: "2500000",
      ceiling: "2500000"
    }
  ],
  text: {
    sectionD: "Packaging, packing, and marking requirements will be stated in individual orders. At a minimum, all packages, delivery tickets, invoices, and correspondence shall identify the contract number, order number, CLIN, and delivery location.",
    sectionE: "Inspection and acceptance will occur at destination unless an individual order states otherwise. The Government will document receipt and acceptance in WAWF or another authorized receiving system identified in the order.",
    sectionJ: "No attachments are included by default. Attachments may be added by listing them here, such as a performance work statement, price list, wage determination, quality assurance surveillance plan, or ordering guide.",
    sectionL: "L.1 Proposal Submission. Offerors shall submit technical and price volumes by the date and time stated on the SF 1449.\n\nL.2 Technical Volume. The technical volume shall describe understanding of the IDIQ scope, ordering responsiveness, deployed staffing approach, quality control, and transition plan.\n\nL.3 Price Volume. The price volume shall include completed IDIQ pricing assumptions, proposed labor or supply rates, and any discounts applicable to future orders.",
    sectionM: "M.1 Basis for Award. Award will be made to the responsible offeror whose offer conforms to the solicitation and represents the best value to the Government.\n\nM.2 Evaluation Factors. The Government may evaluate technical approach, past performance, price, and ordering responsiveness. Price or cost will be considered for the base IDIQ and at the order level.\n\nM.3 Multiple Awards. If multiple awards are contemplated, the Government may make the estimated number of awards shown in the IDIQ limits."
  },
  signatures: {
    contractor: false,
    government: false
  }
};

let state = loadDraft() || clone(sampleState);
enforceDefaults();

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const pageCount = document.querySelector("#pageCount");
const draftStatus = document.querySelector("#draftStatus");
const zoomInput = document.querySelector("#zoomInput");
const contactSelect = document.querySelector("#contactSelect");
const contractorSelect = document.querySelector("#contractorSelect");
const lmSection = document.querySelector("#lmSection");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeState(clone(sampleState), JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function randomTwoDigit() {
  return String(Math.floor(Math.random() * 100)).padStart(2, "0");
}

function randomFourDigit() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function setPiidSerial(serial = "01") {
  const methodLetter = state.document.solicitationMethod === "RFQ" ? "Q" : "R";
  state.document.contractNumber = `${PIID_ACTIVITY}XXD00${serial}`;
  state.document.solicitationNumber = `${PIID_ACTIVITY}XX${methodLetter}00${serial}`;
}

function randomizePiids() {
  setPiidSerial(randomTwoDigit());
}

function formatForm9Number(serial = "0001") {
  const normalizedSerial = String(serial || "0001").replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `${FORM9_DODAAC}-F9-20XX-${normalizedSerial}`;
}

function normalizeForm9Number(value, fallback = "0001") {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("PR-XX-") || /^FA4867/i.test(raw)) return formatForm9Number(fallback);
  return raw.replace(/\b20\d{2}\b/g, "20XX");
}

function randomizeForm9() {
  state.document.requisitionNumber = formatForm9Number(randomFourDigit());
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

function applyGovernmentContact(name) {
  const contact = airForceContacts.find((item) => item.name === name) || airForceContacts[0];
  state.government.contactName = contact.name;
  state.government.contactPhone = contact.phone;
}

function contractorByUei(uei) {
  return contractorRoster.find((item) => item.uei === uei) || contractorRoster[0];
}

function applyContractor(contractor) {
  state.contractor.uei = contractor.uei;
  state.contractor.cage = contractor.cage;
  state.contractor.name = contractor.name;
  state.contractor.address = contractor.address;
  state.contractor.phone = contractor.phone;
  state.contractor.discountTerms = "Net 30";
  state.contractor.signer = contractor.signer;
}

function enforceDefaults() {
  if (!["contract", "solicitation"].includes(state.document.documentType)) state.document.documentType = "contract";
  if (!["RFP", "RFQ"].includes(state.document.solicitationMethod)) state.document.solicitationMethod = "RFP";
  const match = String(state.document.contractNumber || "").match(/^FA4867XXD00(\d{2})$/);
  setPiidSerial(match?.[1] || "01");
  state.document.requisitionNumber = normalizeForm9Number(state.document.requisitionNumber);
  state.document.issueDate = futureProofDate(state.document.issueDate) || "05/01/20XX";
  state.document.offerDueDate = futureProofDate(state.document.offerDueDate) || "05/20/20XX";
  state.document.awardDate = futureProofDate(state.document.awardDate) || "05/30/20XX";
  state.idiq.orderingStartDate = futureProofDate(state.idiq.orderingStartDate) || "05/30/20XX";
  state.idiq.orderingEndDate = futureProofDate(state.idiq.orderingEndDate) || "05/29/20XX";
  state.idiq.finalCompletionDate = futureProofDate(state.idiq.finalCompletionDate) || "11/29/20XX";
  if (state.idiq.awardApproach === "single") state.idiq.estimatedAwards = state.idiq.estimatedAwards || "1";

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

  applyContractor(contractorByUei(state.contractor.uei));
  if (!Array.isArray(state.clins) || !state.clins.length) state.clins = clone(sampleState.clins);
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

function numeric(value) {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  const number = numeric(value);
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  });
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function signedName(role) {
  if (role === "contractor") return state.signatures.contractor ? state.contractor.signer : "";
  return state.signatures.government ? state.government.contactName : "";
}

function orderNoun(plural = false) {
  const type = state.idiq.orderType;
  if (type === "delivery") return plural ? "delivery orders" : "delivery order";
  if (type === "both") return plural ? "task orders or delivery orders" : "task order or delivery order";
  return plural ? "task orders" : "task order";
}

function tokenText(value = "") {
  return String(value)
    .replaceAll("{{orderingStartDate}}", formatDate(state.idiq.orderingStartDate))
    .replaceAll("{{orderingEndDate}}", formatDate(state.idiq.orderingEndDate))
    .replaceAll("{{minimumOrder}}", money(state.idiq.minimumOrder))
    .replaceAll("{{maximumSingleItem}}", money(state.idiq.maximumSingleItem))
    .replaceAll("{{maximumCombination}}", money(state.idiq.maximumCombination))
    .replaceAll("{{seriesOrderDays}}", state.idiq.seriesOrderDays || "")
    .replaceAll("{{rejectionDays}}", state.idiq.rejectionDays || "")
    .replaceAll("{{guaranteedMinimum}}", money(state.idiq.guaranteedMinimum))
    .replaceAll("{{ceiling}}", money(state.idiq.ceiling))
    .replaceAll("{{finalCompletionDate}}", formatDate(state.idiq.finalCompletionDate))
    .replaceAll("{{estimatedAwards}}", state.idiq.estimatedAwards || "1")
    .replaceAll("{{ombudsman}}", state.idiq.ombudsman || "See issuing office");
}

function selectedClauses() {
  return clauseLibrary.filter((clause) => {
    if (clause.solicitationOnly && state.document.documentType !== "solicitation") return false;
    if (clause.multipleOnly && state.idiq.awardApproach !== "multiple") return false;
    return clause.core || clause.solicitationOnly || clause.multipleOnly;
  });
}

function accountingText() {
  if (state.document.documentType === "solicitation") {
    return "NOT OBLIGATED AT SOLICITATION - SAMPLE FORM 9 SHOWN FOR TRAINING";
  }
  return [
    "ACRN AA: 57XX3400 04 041A 4090 067100 F2D3JC 10A100 000000 503000",
    "Fund Type: O&M, Air Force (3400)  Object Class: 25.2",
    `Funding Document: ${state.document.requisitionNumber}`,
    `Obligation: Guaranteed Minimum ${money(state.idiq.guaranteedMinimum)}. Orders cite separate accounting data.`
  ].join("\n");
}

function renderContactSelect() {
  contactSelect.innerHTML = airForceContacts.map((contact) => `
    <option value="${attr(contact.name)}">${escapeHtml(contact.name)}</option>
  `).join("");
}

function renderContractorSelect() {
  contractorSelect.innerHTML = contractorRoster.map((contractor) => `
    <option value="${attr(contractor.uei)}">${escapeHtml(contractor.uei)} - ${escapeHtml(contractor.name)}</option>
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
  contactSelect.value = state.government.contactName;
  contractorSelect.value = state.contractor.uei;
  lmSection.classList.toggle("hidden", state.document.documentType !== "solicitation");
}

function renderClinEditor() {
  const root = document.querySelector("#clinEditor");
  root.innerHTML = state.clins.map((clin, index) => `
    <article class="clin-card" data-clin-index="${index}">
      <header>
        <strong>CLIN ${escapeHtml(clin.itemNumber || String(index + 1).padStart(4, "0"))}</strong>
        <button type="button" class="small" data-remove-clin="${index}">Remove</button>
      </header>
      <div class="field-grid two">
        <label>
          Item number
          <input data-clin-field="itemNumber" value="${attr(clin.itemNumber)}">
        </label>
        <label>
          Unit
          <input data-clin-field="unit" value="${attr(clin.unit)}">
        </label>
      </div>
      <label>
        Description
        <textarea data-clin-field="description" rows="3">${escapeHtml(clin.description)}</textarea>
      </label>
      <div class="field-grid three">
        <label>
          Minimum
          <input data-clin-field="minimum" value="${attr(clin.minimum)}">
        </label>
        <label>
          Maximum
          <input data-clin-field="maximum" value="${attr(clin.maximum)}">
        </label>
        <label>
          Ceiling
          <input data-clin-field="ceiling" value="${attr(clin.ceiling)}">
        </label>
      </div>
    </article>
  `).join("");
}

function box(label, value = "", extraClass = "") {
  return `
    <div class="sf-box ${extraClass}">
      <div class="sf-label">${escapeHtml(label)}</div>
      <div class="sf-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderSf1449(totalPages) {
  const isSolicitation = state.document.documentType === "solicitation";
  const contractorBlock = isSolicitation
    ? "TO BE COMPLETED BY OFFEROR"
    : `${state.contractor.name}\nUEI ${state.contractor.uei}  CAGE ${state.contractor.cage}\n${state.contractor.address}\nTelephone Number: ${state.contractor.phone}`;
  const pageClass = `document-page sf-cover-page ${state.document.trainingWatermark ? "watermark" : ""}`;
  return `
    <section class="${pageClass}">
      <div class="sf-form">
        <div class="sf-row sf-title-row">
          <div class="sf-title">
            SOLICITATION/CONTRACT/ORDER FOR COMMERCIAL PRODUCTS AND COMMERCIAL SERVICES
            <div class="sf-note">INDEFINITE-DELIVERY INDEFINITE-QUANTITY - TRAINING SAMPLE</div>
          </div>
          ${box("1. Requisition Number", state.document.requisitionNumber)}
          ${box("Page 1 of", String(totalPages))}
        </div>
        <div class="sf-row doc-ids">
          ${box("2. Contract Number", isSolicitation ? "" : state.document.contractNumber)}
          ${box("3. Award/Effective Date", isSolicitation ? "" : formatDate(state.document.awardDate))}
          ${box("4. Order Number", "SEE INDIVIDUAL ORDERS")}
          ${box("5. Solicitation Number", state.document.solicitationNumber)}
          ${box("6. Issue Date", formatDate(state.document.issueDate))}
        </div>
        <div class="sf-row contact-row">
          <div class="sf-box">
            <div class="sf-label">7. For Solicitation/Contract Information Call</div>
            <div class="sf-value">a. Name: ${escapeHtml(state.government.contactName)}<br>b. Telephone Number: ${escapeHtml(state.government.contactPhone)}</div>
          </div>
          ${box("8. Offer Due Date", isSolicitation ? formatDate(state.document.offerDueDate) : "N/A")}
          <div class="sf-box">
            <div class="sf-label">14. Method of Solicitation</div>
            <div class="sf-checkline">
              <span><span class="check">${state.document.solicitationMethod === "RFP" ? "X" : ""}</span> RFP</span>
              <span><span class="check">${state.document.solicitationMethod === "RFQ" ? "X" : ""}</span> RFQ</span>
              <span><span class="check"></span> IFB</span>
            </div>
          </div>
        </div>
        <div class="sf-row office-row">
          <div class="sf-box">
            <div class="sf-label">9. Issued By <span class="sf-tiny">Code ${escapeHtml(state.government.issuedByCode)}</span></div>
            <div class="sf-value">${escapeHtml(state.government.issuedByName)}<br>${escapeHtml(state.government.issuedByAddress)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">10. This Acquisition Is</div>
            <div class="sf-checkline">
              <span><span class="check">X</span> Unrestricted</span>
              <span><span class="check"></span> Set Aside</span>
            </div>
            <div class="sf-value">IDIQ - ${escapeHtml(state.idiq.awardApproach === "multiple" ? "Multiple-award" : "Single-award")}</div>
          </div>
          ${box("11. Delivery / Performance", `Specified on individual ${orderNoun(true)}.`)}
        </div>
        <div class="sf-row dest-row">
          ${box("12. Discount Terms", state.contractor.discountTerms)}
          ${box(`15. Deliver To Code ${state.government.deliverToCode}`, `${state.government.deliverToName}\n${state.government.deliverToAddress}`)}
          ${box(`16. Administered By Code ${state.government.adminCode}`, `${state.government.adminName}\n${state.government.adminAddress}`)}
        </div>
        <div class="sf-row contractor-row">
          <div class="sf-box">
            <div class="sf-label">17a. Contractor / Offeror</div>
            <div class="sf-value">${escapeHtml(contractorBlock)}</div>
            <div class="sf-checkline"><span><span class="check"></span> 17b. Remittance address is different</span></div>
          </div>
          <div class="sf-box">
            <div class="sf-label">18a. Payment Will Be Made By <span class="sf-tiny">Code ${escapeHtml(state.government.paymentCode)}</span></div>
            <div class="sf-value">${escapeHtml(state.government.paymentName)}<br>${escapeHtml(state.government.paymentAddress)}</div>
            <div class="sf-checkline"><span><span class="check">X</span> 18b. See order-level WAWF instructions</span></div>
          </div>
        </div>
        <table class="sf-schedule">
          <thead>
            <tr>
              <th style="width: 13%;">19.<br>Item Number</th>
              <th>20.<br>Schedule of Supplies/Services</th>
              <th style="width: 10%;">21.<br>Quantity</th>
              <th style="width: 9%;">22.<br>Unit</th>
              <th style="width: 12%;">23.<br>Unit Price</th>
              <th style="width: 12%;">24.<br>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr class="continuation-row">
              <td></td>
              <td class="continuation-note">SEE CONTINUATION PAGE FOR IDIQ SCHEDULE, MINIMUM, MAXIMUM, CEILING, AND ORDERING TERMS</td>
              <td></td><td></td><td></td><td></td>
            </tr>
          </tbody>
        </table>
        <div class="sf-row money-row">
          ${box("25. Accounting and Appropriation Data", accountingText())}
          ${box("26. Total Award Amount", isSolicitation ? `IDIQ Ceiling: ${money(state.idiq.ceiling)}` : `Guaranteed Minimum Obligated: ${money(state.idiq.guaranteedMinimum)}\nIDIQ Ceiling: ${money(state.idiq.ceiling)}`)}
          ${box("27. United States of America", isSolicitation ? "SOLICITATION" : "AWARD")}
        </div>
        <div class="sf-row award-row">
          ${box("28. Contractor Is Required to Sign This Document and Return Copies", isSolicitation ? "See Section L" : "Contractor signature shown below if applied")}
          ${box("29. Award of Contract", isSolicitation ? "Offers will be evaluated in accordance with Section M." : `Contract ${state.document.contractNumber} is awarded. The guaranteed minimum is obligated at award; orders will be issued separately.`)}
        </div>
        <div class="sf-row signatures">
          ${box("30a. Signature of Offeror/Contractor", signedName("contractor"), "signature-box")}
          ${box("31a. United States of America (Signature of Contracting Officer)", signedName("government"), "signature-box")}
        </div>
        <div class="sf-row sign-names">
          ${box("30b. Name and Title of Signer", state.contractor.signer)}
          ${box("30c. Date Signed", state.signatures.contractor ? formatDate(state.document.awardDate) : "")}
          ${box("31b. Name of Contracting Officer", state.government.contactName)}
          ${box("31c. Date Signed", state.signatures.government ? formatDate(state.document.awardDate) : "")}
        </div>
      </div>
      <div class="sf-footer">
        <span>AUTHORIZED FOR LOCAL REPRODUCTION - TRAINING SAMPLE</span>
        <strong>STANDARD FORM 1449 STYLE IDIQ PACKAGE</strong>
      </div>
    </section>
  `;
}

function renderPage(title, content, pageNumber, totalPages) {
  return `
    <section class="document-page ${state.document.trainingWatermark ? "watermark" : ""}">
      <header class="page-header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <div>${escapeHtml(state.document.documentType === "solicitation" ? state.document.solicitationNumber : state.document.contractNumber)}</div>
        </div>
        <div>Page ${pageNumber} of ${totalPages}<br>${escapeHtml(PIID_ACTIVITY)}</div>
      </header>
      <div class="ucf-section">${content}</div>
      <footer class="page-footer">
        <span>SF 1449 Continuation / Uniform Contract Format</span>
        <span>Page ${pageNumber} of ${totalPages}</span>
      </footer>
    </section>
  `;
}

function renderSectionB() {
  return `
    <h2>Section B - Supplies or Services and Prices/Costs</h2>
    <p>This section continues SF 1449 Blocks 19 through 24. This is an indefinite-delivery indefinite-quantity contract. Exact quantities, locations, periods of performance, and prices will be established by individual ${escapeHtml(orderNoun(true))} issued within the ordering period.</p>
    <table class="ucf-table">
      <thead>
        <tr>
          <th style="width: 11%;">CLIN</th>
          <th>Description</th>
          <th style="width: 10%;">Unit</th>
          <th style="width: 15%;">Minimum</th>
          <th style="width: 15%;">Maximum</th>
          <th style="width: 15%;">Ceiling</th>
        </tr>
      </thead>
      <tbody>
        ${state.clins.map((clin) => `
          <tr>
            <td>${escapeHtml(clin.itemNumber)}</td>
            <td>${escapeHtml(clin.description)}</td>
            <td>${escapeHtml(clin.unit)}</td>
            <td>${money(clin.minimum)}</td>
            <td>${money(clin.maximum)}</td>
            <td>${money(clin.ceiling)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <h3>IDIQ Limits</h3>
    <p>Guaranteed minimum: ${money(state.idiq.guaranteedMinimum)}. Contract maximum/ceiling: ${money(state.idiq.ceiling)}. The guaranteed minimum is satisfied by the first order or by one or more orders issued during the ordering period. The Government is not obligated beyond the guaranteed minimum except as separately obligated on individual orders.</p>
    <h3>Order Limitations</h3>
    <p>Minimum order: ${money(state.idiq.minimumOrder)}. Maximum order for a single item: ${money(state.idiq.maximumSingleItem)}. Maximum order for a combination of items: ${money(state.idiq.maximumCombination)}. A series of orders from the same ordering office within ${escapeHtml(state.idiq.seriesOrderDays)} days may not together exceed the maximum order limits unless accepted by the contractor.</p>
  `;
}

function renderSectionCF() {
  return `
    <h2>Section C - Description/Specifications/Statement of Work</h2>
    <p>${escapeHtml(state.idiq.scope)}</p>
  `;
}

function renderSectionDE() {
  return `
    <h2>Section D - Packaging and Marking</h2>
    <p>${escapeHtml(state.text.sectionD)}</p>
    <h2>Section E - Inspection and Acceptance</h2>
    <p>${escapeHtml(state.text.sectionE)}</p>
  `;
}

function renderSectionF() {
  return `
    <h2>Section F - Deliveries or Performance</h2>
    <p>The ordering period begins ${escapeHtml(formatDate(state.idiq.orderingStartDate))} and ends ${escapeHtml(formatDate(state.idiq.orderingEndDate))}. Individual ${escapeHtml(orderNoun(true))} will establish delivery dates, period of performance, inspection and acceptance locations, and any order-specific milestones.</p>
    <p>Any order issued during the ordering period and not completed within that period shall be completed within the time specified in the order. The contractor is not required to perform after ${escapeHtml(formatDate(state.idiq.finalCompletionDate))}, unless the contract is modified by the Contracting Officer.</p>
  `;
}

function renderSectionGH() {
  const fairOpportunity = state.idiq.awardApproach === "multiple"
    ? state.idiq.fairOpportunity
    : "This is configured as a single-award IDIQ. Orders may be issued directly to the awardee within the scope, ordering period, and limitations of the contract.";
  return `
    <h2>Section G - Contract Administration Data</h2>
    <p>Administered by: ${escapeHtml(state.government.adminCode)}\nPayment office: ${escapeHtml(state.government.paymentCode)} ${escapeHtml(state.government.paymentName)}\nBase accounting data: ${escapeHtml(accountingText())}</p>
    <p>Individual ${escapeHtml(orderNoun(true))} will cite order-specific accounting and appropriation data, funding document, obligation amount, inspection and acceptance points, and completed WAWF instructions.</p>
    <h2>Section H - Special Contract Requirements</h2>
    <h3>Ordering Activities</h3>
    <p>${escapeHtml(state.idiq.orderingActivities)}</p>
    <h3>Ordering Procedures</h3>
    <p>${escapeHtml(state.idiq.orderingProcedures)}</p>
    <h3>Fair Opportunity</h3>
    <p>${escapeHtml(fairOpportunity)}</p>
  `;
}

function renderSectionI() {
  const clauses = selectedClauses();
  return `
    <h2>Section I - Contract Clauses</h2>
    <table class="ucf-table">
      <thead>
        <tr><th style="width: 18%;">Reference</th><th>Title</th><th style="width: 13%;">Date</th><th style="width: 15%;">Method</th></tr>
      </thead>
      <tbody>
        ${clauses.map((clause) => `
          <tr>
            <td>${escapeHtml(clause.id)}</td>
            <td>${escapeHtml(clause.title)}</td>
            <td>${escapeHtml(clause.date)}</td>
            <td>${escapeHtml(clause.method)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${clauses.map((clause) => `
      <div class="clause-body">
        <h3>${escapeHtml(clause.id)} ${escapeHtml(clause.title)}</h3>
        <p>${escapeHtml(tokenText(clause.body))}</p>
      </div>
    `).join("")}
  `;
}

function renderSectionJ() {
  return `
    <h2>Section J - List of Attachments</h2>
    <p>${escapeHtml(state.text.sectionJ)}</p>
  `;
}

function renderSectionLM() {
  if (state.document.documentType !== "solicitation") return [];
  return [
    { title: "Section L", content: `<h2>Section L - Instructions, Conditions, and Notices to Offerors</h2><p>${escapeHtml(state.text.sectionL)}</p>` },
    { title: "Section M", content: `<h2>Section M - Evaluation Factors for Award</h2><p>${escapeHtml(state.text.sectionM)}</p>` }
  ];
}

function renderPackage() {
  const pages = [
    { title: "Section B", content: renderSectionB() },
    { title: "Section C", content: renderSectionCF() },
    { title: "Sections D and E", content: renderSectionDE() },
    { title: "Section F", content: renderSectionF() },
    { title: "Sections G and H", content: renderSectionGH() },
    { title: "Section I", content: renderSectionI() },
    { title: "Section J", content: renderSectionJ() },
    ...renderSectionLM()
  ];
  const totalPages = pages.length + 1;
  return [
    renderSf1449(totalPages),
    ...pages.map((page, index) => renderPage(page.title, page.content, index + 2, totalPages))
  ];
}

function renderPreview() {
  const pages = renderPackage();
  preview.innerHTML = `<div class="document-pack">${pages.join("")}</div>`;
  pageCount.textContent = `${pages.length} pages`;
}

function renderAll() {
  renderContactSelect();
  renderContractorSelect();
  syncControls();
  renderClinEditor();
  renderPreview();
}

function markDirty() {
  draftStatus.textContent = "Unsaved";
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  draftStatus.textContent = "Saved";
}

editor.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setPath(state, target.dataset.field, value);
    if (target.dataset.field === "document.requisitionNumber") {
      state.document.requisitionNumber = normalizeForm9Number(state.document.requisitionNumber);
    }
    markDirty();
    renderPreview();
  }

  if (target.matches("[data-clin-field]")) {
    const card = target.closest("[data-clin-index]");
    const index = Number(card.dataset.clinIndex);
    state.clins[index][target.dataset.clinField] = target.value;
    markDirty();
    renderPreview();
  }
});

editor.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setPath(state, target.dataset.field, value);
    if (target.dataset.field === "government.contactName") applyGovernmentContact(state.government.contactName);
    if (target.dataset.field === "document.solicitationMethod") {
      const match = String(state.document.contractNumber || "").match(/^FA4867XXD00(\d{2})$/);
      setPiidSerial(match?.[1] || "01");
    }
    if (target.dataset.field === "document.requisitionNumber") {
      state.document.requisitionNumber = normalizeForm9Number(state.document.requisitionNumber);
    }
    markDirty();
    renderAll();
  }
});

editor.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-clin]");
  if (remove) {
    const index = Number(remove.dataset.removeClin);
    state.clins.splice(index, 1);
    if (!state.clins.length) state.clins = clone(sampleState.clins);
    markDirty();
    renderAll();
  }
});

contactSelect.addEventListener("change", () => {
  applyGovernmentContact(contactSelect.value);
  markDirty();
  renderAll();
});

contractorSelect.addEventListener("change", () => {
  applyContractor(contractorByUei(contractorSelect.value));
  markDirty();
  renderAll();
});

document.querySelector("#addClinBtn").addEventListener("click", () => {
  const last = state.clins[state.clins.length - 1];
  const next = last?.itemNumber ? String(Number(last.itemNumber) + 1).padStart(4, "0") : "0001";
  state.clins.push({
    itemNumber: Number.isNaN(Number(next)) ? "" : next,
    description: "Additional IDIQ ordering capacity. Orders will define exact requirements.",
    unit: "LOT",
    minimum: "0",
    maximum: "0",
    ceiling: "0"
  });
  markDirty();
  renderAll();
});

document.querySelector("#randomPiidBtn").addEventListener("click", () => {
  randomizePiids();
  markDirty();
  renderAll();
});

document.querySelector("#randomForm9Btn").addEventListener("click", () => {
  randomizeForm9();
  markDirty();
  renderAll();
});

document.querySelector("#randomDeliveryBtn").addEventListener("click", () => {
  state.government.deliverToAddress = randomDeliveryAddress();
  markDirty();
  renderAll();
});

document.querySelector("#applySignaturesBtn").addEventListener("click", () => {
  state.signatures.contractor = true;
  state.signatures.government = true;
  markDirty();
  renderAll();
});

document.querySelector("#clearSignaturesBtn").addEventListener("click", () => {
  state.signatures.contractor = false;
  state.signatures.government = false;
  markDirty();
  renderAll();
});

document.querySelector("#sampleBtn").addEventListener("click", () => {
  state = clone(sampleState);
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
  link.download = `${state.document.contractNumber || "idiq-draft"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.querySelector("#importInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = mergeState(clone(sampleState), JSON.parse(String(reader.result || "{}")));
      enforceDefaults();
      markDirty();
      renderAll();
    } catch {
      alert("Could not import that JSON file.");
    }
  });
  reader.readAsText(file);
});

document.querySelector("#printBtn").addEventListener("click", () => window.print());

zoomInput.addEventListener("input", () => {
  preview.style.transform = `scale(${Number(zoomInput.value) / 100})`;
});

renderAll();
preview.style.transform = `scale(${Number(zoomInput.value) / 100})`;
