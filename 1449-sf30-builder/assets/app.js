const STORAGE_KEY = "sf1449-generator-draft-v1";
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

const contractorRoster = [
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
  },
  {
    code: "M1F6N8X2C7K4",
    name: "Atlas Forward Services LLC",
    address: "Bldg 108, Expeditionary Vendor Bay\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0219",
    facilityCode: "",
    signer: "Devon Price, General Manager"
  },
  {
    code: "Q9R4H2P7T5L1",
    name: "Keystone Theater Support LLC",
    address: "Bldg 116, Local Services Compound\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0220",
    facilityCode: "",
    signer: "Kendall Rivera, Managing Member"
  },
  {
    code: "B6L1V9D3N8S4",
    name: "Redstone Field Contractors LLC",
    address: "Bldg 129, Forward Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0221",
    facilityCode: "",
    signer: "Logan Brooks, Authorized Official"
  },
  {
    code: "X2C7M4Q8R1W5",
    name: "Blue Ridge Deployed Services LLC",
    address: "Bldg 137, Vendor Processing Row\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0222",
    facilityCode: "",
    signer: "Reese Patel, Program Director"
  },
  {
    code: "L5P9T2K6F3N8",
    name: "Falcon Way Support LLC",
    address: "Bldg 144, Expeditionary Services Area\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0223",
    facilityCode: "",
    signer: "Cameron Hayes, Contract Administrator"
  },
  {
    code: "S8N3B7V1Q4D6",
    name: "Meridian Contingency Services LLC",
    address: "Bldg 158, Deployed Operations Lot\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0224",
    facilityCode: "",
    signer: "Finley Ward, Managing Member"
  },
  {
    code: "W4K2R8X5M9C1",
    name: "Prairie Signal Services LLC",
    address: "Bldg 166, Contractor Support Annex\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0225",
    facilityCode: "",
    signer: "Rowan Bennett, Authorized Representative"
  }
];

const clauseLibrary = [
  {
    id: "52.204-7",
    title: "System for Award Management",
    date: "OCT 2018",
    group: "Core Commercial",
    core: true,
    summary: "SAM registration and status requirements.",
    body: "(a) The offeror shall be registered in the System for Award Management at the time an offer is submitted and shall maintain active registration during performance.\n\n(b) The Contractor is responsible for the accuracy and completeness of information entered in SAM. Failure to maintain required registration may affect payment, award, or performance actions."
  },
  {
    id: "52.204-13",
    title: "System for Award Management Maintenance",
    date: "OCT 2018",
    group: "Core Commercial",
    core: true,
    summary: "Maintenance of SAM registration after award.",
    body: "(a) The Contractor shall maintain registration in SAM during contract performance and through final payment.\n\n(b) The Contractor shall notify the Contracting Officer of changes that could affect payment, representations, certifications, or responsibility determinations."
  },
  {
    id: "52.204-21",
    title: "Basic Safeguarding of Covered Contractor Information Systems",
    date: "NOV 2021",
    group: "Core Commercial",
    core: true,
    summary: "Baseline safeguarding for covered information systems.",
    body: "(a) The Contractor shall apply basic safeguarding requirements and procedures to protect covered contractor information systems.\n\n(b) This clause applies to systems owned or operated by the Contractor that process, store, or transmit Federal contract information."
  },
  {
    id: "52.212-1",
    title: "Instructions to Offerors - Commercial Products and Commercial Services",
    date: "SEP 2023",
    group: "Commercial Item",
    core: true,
    summary: "Solicitation instructions for commercial acquisitions.",
    body: "(a) North American Industry Classification System code and small business size standard are stated on the face page.\n\n(b) Offerors shall submit offers in the form and quantity specified in Section L. Offers shall include prices, technical information, representations, and other information required by the solicitation.\n\n(c) The Government may reject any or all offers if such action is in the public interest."
  },
  {
    id: "52.212-4",
    title: "Contract Terms and Conditions - Commercial Products and Commercial Services",
    date: "NOV 2023",
    group: "Commercial Item",
    core: true,
    summary: "Core commercial contract terms.",
    body: "(a) The Contractor shall comply with the terms and conditions of this contract and shall provide the supplies or services described in the schedule.\n\n(b) The Government will inspect and accept supplies or services as stated in Section E. Payment will be made in accordance with the payment office identified on the SF 1449.\n\n(c) Changes may be made only by written agreement of the parties unless otherwise authorized by the contract."
  },
  {
    id: "52.232-33",
    title: "Payment by Electronic Funds Transfer - System for Award Management",
    date: "OCT 2018",
    group: "Payment",
    core: true,
    summary: "EFT payment through SAM banking data.",
    body: "(a) The Government shall make payment by electronic funds transfer using information contained in SAM.\n\n(b) The Contractor is responsible for maintaining current EFT information. Payment may be delayed if banking information is incomplete, inaccurate, or inactive."
  },
  {
    id: "252.232-7003",
    title: "Electronic Submission of Payment Requests and Receiving Reports",
    date: "DEC 2018",
    group: "Payment",
    core: true,
    summary: "Requires electronic payment requests and receiving reports through WAWF unless an exception applies.",
    body: "Incorporated by reference. Payment requests and receiving reports shall be submitted through Wide Area WorkFlow (WAWF) unless an authorized exception applies."
  },
  {
    id: "252.232-7006",
    title: "Wide Area WorkFlow Payment Instructions",
    date: "JAN 2023",
    group: "Payment",
    core: true,
    summary: "Completed WAWF document type and routing instructions.",
    body: "Incorporated by reference. The completed WAWF fill-ins for this training contract are stated below and in Section G.\n\n{{wawfInstructions}}"
  },
  {
    id: "52.217-8",
    title: "Option to Extend Services",
    date: "NOV 1999",
    group: "Options",
    summary: "Continued performance for up to six months.",
    body: "The Government may require continued performance of any services within the limits and at the rates specified in the contract. These rates may be adjusted only as a result of revisions to prevailing labor rates provided by the Secretary of Labor. The option provision may be exercised more than once, but the total extension of performance shall not exceed 6 months. The Contracting Officer may exercise the option by written notice to the Contractor within 30 days."
  },
  {
    id: "52.217-9",
    title: "Option to Extend the Term of the Contract",
    date: "MAR 2000",
    group: "Options",
    summary: "Exercise of priced option periods.",
    body: "(a) The Government may extend the term of this contract by written notice to the Contractor within 30 days; provided that the Government gives the Contractor a preliminary written notice of its intent to extend at least 30 days before the contract expires. The preliminary notice does not commit the Government to an extension.\n\n(b) If the Government exercises this option, the extended contract shall be considered to include this option clause.\n\n(c) The total duration of this contract, including the exercise of any options under this clause, shall not exceed five years."
  },
  {
    id: "52.216-18",
    title: "Ordering",
    date: "AUG 2020",
    group: "IDIQ / Requirements",
    summary: "Ordering period and ordering authority.",
    body: "(a) Supplies and services to be furnished under this contract shall be ordered by issuance of delivery orders or task orders by the individuals or activities designated in the schedule.\n\n(b) All orders are subject to the terms and conditions of this contract. In the event of conflict between an order and this contract, the contract shall control.\n\n(c) Orders may be issued during the ordering period stated in Section F."
  },
  {
    id: "52.216-19",
    title: "Order Limitations",
    date: "OCT 1995",
    group: "IDIQ / Requirements",
    summary: "Minimum, maximum, and order threshold rules.",
    body: "(a) Minimum order. When the Government requires supplies or services covered by this contract in an amount less than the minimum order stated in Section B, the Government is not obligated to purchase under this contract.\n\n(b) Maximum order. The Contractor is not obligated to honor any order exceeding the order limitations stated in Section B unless the Contractor elects to do so.\n\n(c) The Contractor shall honor orders issued in accordance with the contract ordering procedures."
  },
  {
    id: "52.216-21",
    title: "Requirements",
    date: "OCT 1995",
    group: "IDIQ / Requirements",
    summary: "Requirements contract coverage.",
    body: "(a) This is a requirements contract for the supplies or services specified in the schedule and for the period stated in the contract.\n\n(b) The quantities stated in the schedule are estimates only and are not purchased by this contract. Except as otherwise provided, the Government shall order all actual requirements from the Contractor.\n\n(c) Delivery or performance shall be made only as authorized by orders issued under this contract."
  },
  {
    id: "52.216-22",
    title: "Indefinite Quantity",
    date: "OCT 1995",
    group: "IDIQ / Requirements",
    summary: "IDIQ minimum and maximum quantity coverage.",
    body: "(a) This is an indefinite-quantity contract for the supplies or services specified in the schedule and for the period stated in the contract.\n\n(b) The quantities stated in the schedule are estimates only. The Government shall order at least the minimum quantity or amount stated in Section B and may order up to the maximum quantity or amount stated in Section B.\n\n(c) Delivery or performance shall be made only as authorized by orders issued under this contract."
  },
  {
    id: "52.232-18",
    title: "Availability of Funds",
    date: "APR 1984",
    group: "Payment",
    summary: "Funds availability limitation.",
    body: "Funds are not presently available for this contract. The Government's obligation under this contract is contingent upon the availability of appropriated funds from which payment can be made. No legal liability on the part of the Government shall arise until funds are made available to the Contracting Officer."
  },
  {
    id: "52.232-40",
    title: "Providing Accelerated Payments to Small Business Subcontractors",
    date: "MAR 2023",
    group: "Payment",
    summary: "Accelerated payments flowdown.",
    body: "Upon receipt of accelerated payments from the Government, the Contractor shall make accelerated payments to small business subcontractors to the maximum extent practicable after receipt of a proper invoice and all other required documentation."
  },
  {
    id: "52.237-3",
    title: "Continuity of Services",
    date: "JAN 1991",
    group: "Services",
    summary: "Transition and continuity support.",
    body: "(a) The Contractor recognizes that the services under this contract are vital to the Government and must be continued without interruption.\n\n(b) The Contractor shall cooperate with successor contractors and Government personnel to ensure orderly transition of services."
  },
  {
    id: "52.246-4",
    title: "Inspection of Services - Fixed-Price",
    date: "AUG 1996",
    group: "Services",
    summary: "Fixed-price service inspection.",
    body: "(a) The Contractor shall provide and maintain an inspection system acceptable to the Government.\n\n(b) The Government has the right to inspect and test all services called for by the contract, to the extent practicable, at all places and times during performance."
  }
];

const coreClauseIds = clauseLibrary.filter((clause) => clause.core).map((clause) => clause.id);

const profileClauses = {
  ffp: ["52.246-4"],
  idiq: ["52.216-18", "52.216-19", "52.216-22", "52.217-8", "52.217-9"],
  requirements: ["52.216-18", "52.216-19", "52.216-21", "52.217-8", "52.217-9"],
  optionYear: ["52.217-8", "52.217-9", "52.237-3", "52.246-4"]
};

const sampleState = {
  previewMode: "award",
  signatures: {
    contractor: false,
    government: false
  },
  document: {
    instrumentType: "CONTRACT",
    profile: "optionYear",
    requisitionNumber: "F2D3JC-F9-20XX-0001",
    contractNumber: "FA4867XXP0001",
    awardDate: "04/29/20XX",
    orderNumber: "",
    solicitationNumber: "FA4867XXQ0001",
    issueDate: "03/15/20XX",
    offerDueDate: "04/08/20XX",
    offerDueTime: "3:00 PM ET",
    method: "RFQ",
    trainingWatermark: true
  },
  acquisition: {
    naics: "",
    sizeStandard: "",
    setAside: "UNRESTRICTED",
    fobDestination: true,
    dpasRated: false,
    dpasRating: ""
  },
  government: {
    contactName: "SSgt Maya Reyes",
    contactPhone: "DSN 318-555-0101",
    issuedByCode: "FA4867",
    issuedByName: "FA4867",
    issuedByAddress: DEPLOYED_OFFICE_ADDRESS,
    deliverToCode: "F2D3JC",
    deliverToName: "Undisclosed Location",
    deliverToAddress: "",
    adminCode: "FA4867",
    adminName: "FA4867",
    adminAddress: DEPLOYED_OFFICE_ADDRESS,
    paymentCode: "F87700",
    paymentName: "DFAS COLUMBUS",
    paymentAddress: "DFAS COLUMBUS"
  },
  contractor: {
    code: "K7M4Q9R2T8P1",
    facilityCode: "",
    name: "Crescent Field Services LLC",
    address: "Bldg 12, Vendor Support Yard\nUndisclosed Location, Overseas",
    phone: "DSN 318-555-0211",
    discountTerms: "Net 30",
    remittanceDifferent: false
  },
  clins: [
    {
      itemNumber: "0001",
      description: "Contractor shall provide services in accordance with its quote submitted in response to solicitation number {{solicitationNumber}}.",
      quantity: "1",
      unit: "LO",
      unitPrice: "84250",
      amount: "84250"
    },
    {
      itemNumber: "0002",
      description: "Contractor shall provide related support services in accordance with the quote and all attachments incorporated into this contract.",
      quantity: "1",
      unit: "LO",
      unitPrice: "28600",
      amount: "28600"
    },
    {
      itemNumber: "0003",
      description: "Other direct costs, if authorized, shall be provided in accordance with the accepted quote and applicable contract terms.",
      quantity: "1",
      unit: "NTE",
      unitPrice: "12000",
      amount: "12000"
    },
    {
      itemNumber: "1001",
      description: "Option period services, if exercised, shall be performed in accordance with the accepted quote and this contract.",
      quantity: "1",
      unit: "LO",
      unitPrice: "87900",
      amount: "87900"
    }
  ],
  ucf: {
    includeKLM: true,
    showBlankSections: true,
    sectionC: "C.1 Scope. The Contractor shall provide services in accordance with its quote submitted in response to solicitation number {{solicitationNumber}}.\n\nC.2 Requirements. Specific tasks, deliverables, performance standards, quantities, and other requirements are contained in the Contractor's quote and any attachments incorporated into this contract.\n\nC.3 Order of Precedence. In the event of conflict, the terms and conditions of this contract take precedence over the quote unless otherwise stated in writing by the Contracting Officer.",
    sectionD: "D.1 Packaging. Training materials shall be delivered electronically unless otherwise directed by the Contracting Officer.\n\nD.2 Marking. Each deliverable shall identify the contract number, CLIN, deliverable title, and date of submission.",
    sectionE: "E.1 Inspection. Services and deliverables will be inspected by the Contracting Officer's Representative for conformance with Section C.\n\nE.2 Acceptance. Acceptance occurs upon written confirmation by the Government or ten business days after receipt absent written rejection.",
    sectionF: "F.1 Period of Performance. Base period: 01 May 20XX through 30 April 20XX.\n\nF.2 Place of Performance. Performance will occur at Government facilities at an undisclosed overseas location and virtually as directed.\n\nF.3 Option Notice. The Government may exercise options by written notice at least 30 days before expiration of the current period.",
    sectionG: "G.1 Contracting Officer. Only the Contracting Officer may change the terms and conditions of this contract.\n\nG.2 COR. A Contracting Officer's Representative may be designated in writing after award.\n\nG.3 Invoices. Invoices shall be submitted through Wide Area WorkFlow and shall reference the contract number, CLIN, period of performance, and amount billed.",
    sectionH: "H.1 Key Personnel. The Program Manager and Lead Facilitator are considered key personnel. Substitutions require prior written Government approval.\n\nH.2 Organizational Conflict of Interest. The Contractor shall disclose any actual or potential OCI that may affect impartial performance.\n\nH.3 Training Data. Exercise data and artifacts are for instructional use only and shall not be represented as official procurement actions.",
    sectionJ: "",
    attachments: [],
    sectionK: "K.1 Annual Representations and Certifications. Offerors shall complete representations and certifications in SAM and submit any updates required by this solicitation.\n\nK.2 Responsibility Information. The Government may request additional information necessary to determine responsibility.",
    sectionL: "L.1 Proposal Submission. Offerors shall submit separate technical and price volumes by the date and time stated on the SF 1449.\n\nL.2 Technical Volume. The technical volume shall address approach, staffing, scenario development, exercise execution, and quality control.\n\nL.3 Price Volume. The price volume shall include completed CLIN pricing and supporting rationale.",
    sectionM: "M.1 Basis for Award. Award will be made to the responsible offeror whose proposal represents the best value to the Government.\n\nM.2 Evaluation Factors. Technical approach, staffing, past performance, and price will be evaluated. Technical factors, when combined, are more important than price.\n\nM.3 Price Evaluation. Price will be evaluated for completeness, balance, and reasonableness."
  },
  clauses: {
    "52.217-8": true,
    "52.217-9": true,
    "52.237-3": true,
    "52.246-4": true
  },
  award: {
    fundType: "om",
    funding: null,
    accountingData: "",
    offerDate: "04/08/20XX",
    acceptedItems: "ALL CLINS",
    contractorSigner: "Avery Morgan, Authorized Representative",
    contractorDate: "04/26/20XX",
    contractingOfficer: "SSgt Maya Reyes",
    coDate: "04/29/20XX"
  },
  mod: {
    modNumber: "P00001",
    effectiveDate: "05/01/20XX",
    requisitionNumber: "F2D3JC-F9-20XX-0001",
    projectNumber: "",
    modType: "supplemental",
    authority: "FAR 52.212-4(c)",
    contractorSignatureRequired: true,
    returnCopies: "0",
    description: "The purpose of this modification is to update the contract in accordance with the changes described below.\n\nA. Section B is modified to reflect the revised CLIN structure and/or funding shown in this modification.\n\nB. Section G is modified to reflect the accounting and appropriation data in Block 12.\n\nExcept as provided herein, all terms and conditions of the contract remain unchanged and in full force and effect."
  }
};

let state = loadDraft() || structuredClone(sampleState);
enforceExerciseDefaults();

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const pageCount = document.querySelector("#pageCount");
const draftStatus = document.querySelector("#draftStatus");
const zoomInput = document.querySelector("#zoomInput");
const contractorSelect = document.querySelector("#contractorSelect");
const previewTitle = document.querySelector("#previewTitle");
const previewAwardBtn = document.querySelector("#previewAwardBtn");
const previewModBtn = document.querySelector("#previewModBtn");

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

function randomNonzeroTwoDigit() {
  return String(Math.floor(Math.random() * 99) + 1).padStart(2, "0");
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

function applyGovernmentContact(name) {
  const contact = airForceContacts.find((item) => item.name === name) || airForceContacts[0];
  state.government.contactName = contact.name;
  state.government.contactPhone = contact.phone;
  state.award.contractingOfficer = contact.name;
}

function contractorByCode(code) {
  return contractorRoster.find((contractor) => contractor.code === code) || contractorRoster[0];
}

function simulatedCageCode(code = "") {
  const cleaned = String(code).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `${cleaned.slice(0, 2)}${cleaned.slice(-3)}`.padEnd(5, "0").slice(0, 5);
}

function applyContractor(contractor) {
  state.contractor.code = contractor.code;
  state.contractor.name = contractor.name;
  state.contractor.address = contractor.address;
  state.contractor.phone = contractor.phone;
  state.contractor.facilityCode = contractor.facilityCode || simulatedCageCode(contractor.code);
  state.contractor.discountTerms = "Net 30";
  state.award.contractorSigner = contractor.signer;
}

function signedName(party) {
  if (party === "contractor") {
    return state.signatures.contractor ? state.award.contractorSigner : "";
  }
  if (party === "government") {
    return state.signatures.government ? state.award.contractingOfficer : "";
  }
  return "";
}

function applyRequiredSignatures() {
  state.signatures.contractor = true;
  state.signatures.government = true;
}

function clearSignatures() {
  state.signatures.contractor = false;
  state.signatures.government = false;
}

function solicitationSectionsAllowed() {
  return state.document.instrumentType === "SOLICITATION";
}

function setContractSerial(serial = "01") {
  state.document.contractNumber = `${PIID_ACTIVITY}XXP00${serial}`;
}

function setSolicitationSerial(serial = "01") {
  const typeByMethod = { RFP: "R", RFQ: "Q", IFB: "B" };
  if (!typeByMethod[state.document.method]) {
    state.document.method = "RFQ";
  }
  state.document.solicitationNumber = `${PIID_ACTIVITY}XX${typeByMethod[state.document.method]}00${serial}`;
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
    /^FA4867XX[BPQRC]00\d{2}$/i.test(raw);
}

function normalizeForm9Number(value, fallback = "0001") {
  if (badForm9Number(value)) {
    return formatForm9Number(fallback);
  }
  return String(value).replace(/\b20\d{2}\b/g, "20XX");
}

function setForm9Serial(serial = "0001") {
  state.document.requisitionNumber = formatForm9Number(serial);
}

function randomizeContractSerial() {
  setContractSerial(randomTwoDigit());
}

function randomizeSolicitationSerial() {
  setSolicitationSerial(randomTwoDigit());
}

function randomizeForm9Serial() {
  const previous = state.document.requisitionNumber;
  setForm9Serial(randomFourDigit());
  if (badForm9Number(state.mod.requisitionNumber) || state.mod.requisitionNumber === previous) {
    state.mod.requisitionNumber = state.document.requisitionNumber;
  }
}

function randomizeModNumber() {
  state.mod.modNumber = `P000${randomNonzeroTwoDigit()}`;
}

function defaultModAuthority(type) {
  const authorities = {
    administrative: "FAR 43.103(b)",
    supplemental: "FAR 52.212-4(c)",
    unilateral: "FAR 52.243-1",
    other: "FAR 43.103"
  };
  return authorities[type] || authorities.supplemental;
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

function fundingDocumentNumber() {
  return state.document.requisitionNumber || "FORM 9 NUMBER TBD";
}

function accountingDataText() {
  const seed = state.award.funding;
  if (!seed) return "";
  return [
    `ACRN ${seed.acrn}: ${fundingLoa(seed)}`,
    `AAI: ${seed.aai}  DoD LOA: ${seed.tas} / ${seed.subhead} / ${seed.eeic} / ${seed.organization} / ${seed.costCenter}`,
    `Fund Type: ${fundingLabel(state.award.fundType)} (${seed.appn})  Object Class: ${seed.objectClass}`,
    `Funding Document: ${fundingDocumentNumber()}  Obligation: ${formatMoney(totalAwardAmount())}`
  ].join("\n");
}

function acceptedItemsText() {
  return "ALL CLINS";
}

function syncAwardComputedFields() {
  if (!fundingProfiles[state.award.fundType]) {
    state.award.fundType = "om";
  }
  if (!state.award.funding || state.award.funding.appn !== fundingProfiles[state.award.fundType].appn) {
    state.award.funding = createFundingSeed(state.award.fundType);
  }
  state.award.accountingData = accountingDataText();
  state.award.acceptedItems = acceptedItemsText();
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

function enforceExerciseDefaults() {
  if (!["award", "mod"].includes(state.previewMode)) {
    state.previewMode = "award";
  }
  if (!state.signatures) {
    state.signatures = { contractor: false, government: false };
  }
  const contractMatch = String(state.document.contractNumber || "").match(/^FA4867XXP00(\d{2})$/);
  if (!["IFB", "RFP", "RFQ"].includes(state.document.method)) {
    state.document.method = "RFQ";
  }

  const solicitationMatch = String(state.document.solicitationNumber || "").match(/^FA4867XX[BRQ]00(\d{2})$/);
  const oldContractMatch = String(state.document.contractNumber || "").match(/^FA4867(\d{2}|XX)P0001$/);
  const oldSolicitationMatch = String(state.document.solicitationNumber || "").match(/^FA4867(\d{2}|XX)Q0001$/);

  setContractSerial(contractMatch?.[1] || (oldContractMatch?.[1] === "XX" ? "01" : oldContractMatch?.[1]) || "01");
  setSolicitationSerial(solicitationMatch?.[1] || (oldSolicitationMatch?.[1] === "XX" ? "01" : oldSolicitationMatch?.[1]) || "01");
  state.document.awardDate = futureProofDate(state.document.awardDate) || "04/29/20XX";
  const previousRequisitionNumber = state.document.requisitionNumber;
  state.document.requisitionNumber = normalizeForm9Number(state.document.requisitionNumber);
  state.document.issueDate = futureProofDate(state.document.issueDate) || "03/15/20XX";
  state.document.offerDueDate = futureProofDate(state.document.offerDueDate) || "04/08/20XX";
  state.award.offerDate = futureProofDate(state.award.offerDate) || "04/08/20XX";
  state.award.contractorDate = futureProofDate(state.award.contractorDate) || "04/26/20XX";
  state.award.coDate = futureProofDate(state.award.coDate) || "04/29/20XX";
  syncAwardComputedFields();

  state.acquisition.setAside = "UNRESTRICTED";
  state.acquisition.naics = "";
  state.acquisition.sizeStandard = "";

  applyGovernmentContact(state.government.contactName);

  state.government.issuedByCode = PIID_ACTIVITY;
  state.government.issuedByName = PIID_ACTIVITY;
  state.government.issuedByAddress = DEPLOYED_OFFICE_ADDRESS;
  state.government.deliverToCode = "F2D3JC";
  state.government.deliverToName = "Undisclosed Location";
  if (!String(state.government.deliverToAddress || "").includes("Undisclosed Location, Overseas")) {
    state.government.deliverToAddress = randomDeliveryAddress();
  }
  state.government.adminCode = state.government.issuedByCode;
  state.government.adminName = state.government.issuedByName;
  state.government.adminAddress = state.government.issuedByAddress;
  state.government.paymentCode = "F87700";
  state.government.paymentName = "DFAS COLUMBUS";
  state.government.paymentAddress = "DFAS COLUMBUS";

  applyContractor(contractorByCode(state.contractor.code));
  state.mod.effectiveDate = futureProofDate(state.mod.effectiveDate) || "05/01/20XX";
  if (badForm9Number(state.mod.requisitionNumber) || state.mod.requisitionNumber === previousRequisitionNumber) {
    state.mod.requisitionNumber = state.document.requisitionNumber;
  } else {
    state.mod.requisitionNumber = normalizeForm9Number(state.mod.requisitionNumber);
  }
  if (!state.mod.modNumber) state.mod.modNumber = "P00001";
  if (!state.mod.authority) state.mod.authority = defaultModAuthority(state.mod.modType);
  if (!Array.isArray(state.ucf.attachments)) {
    const lines = String(state.ucf.sectionJ || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    state.ucf.attachments = lines.map((line, index) => ({
      number: `J-${String(index + 1).padStart(2, "0")}`,
      title: line.replace(/^Attachment\s+\d+\s*-\s*/i, ""),
      date: "",
      pages: ""
    }));
  }
  state.ucf.sectionJ = "";
  Object.keys(state.clauses).forEach((id) => {
    if (!clauseLibrary.some((clause) => clause.id === id)) {
      delete state.clauses[id];
    }
  });

  if (String(state.ucf.sectionC || "").includes("simulated acquisition capstone exercise")) {
    state.ucf.sectionC = sampleState.ucf.sectionC;
  }

  state.clins.forEach((clin) => {
    const description = String(clin.description || "");
    if (description.includes("Option period one capstone exercise")) {
      clin.description = "Option period services, if exercised, shall be performed in accordance with the accepted quote and this contract.";
    } else if (description.includes("Base period capstone exercise facilitation")) {
      clin.description = "Contractor shall provide services in accordance with its quote submitted in response to solicitation number {{solicitationNumber}}.";
    } else if (description.includes("Scenario package development")) {
      clin.description = "Contractor shall provide related support services in accordance with the quote and all attachments incorporated into this contract.";
    } else if (description.includes("Other direct costs")) {
      clin.description = "Other direct costs, if authorized, shall be provided in accordance with the accepted quote and applicable contract terms.";
    }
  });
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

function requisitionDodaac() {
  const match = String(state.document.requisitionNumber || "").match(/^([A-Z0-9]{6})/i);
  return (match?.[1] || state.government.issuedByCode || PIID_ACTIVITY).toUpperCase();
}

function contractorSubmitterCode() {
  return state.contractor.facilityCode || state.contractor.code || "SEE SAM";
}

function wawfDocumentType() {
  return "Invoice 2-in-1";
}

function wawfInstructionsText() {
  const issueBy = state.government.issuedByCode || PIID_ACTIVITY;
  const adminBy = state.government.adminCode || issueBy;
  const serviceDodaac = requisitionDodaac();
  const routingRows = [
    ["Document type", wawfDocumentType()],
    ["Pay Official DoDAAC", state.government.paymentCode || "F87700"],
    ["Issue By DoDAAC", issueBy],
    ["Admin DoDAAC", adminBy],
    ["Inspect By DoDAAC", issueBy],
    ["Ship To Code", state.government.deliverToCode || "F2D3JC"],
    ["Ship From Code", "Not applicable"],
    ["Mark For Code", state.government.deliverToCode || "F2D3JC"],
    ["Service Approver (DoDAAC)", serviceDodaac],
    ["Service Acceptor (DoDAAC)", issueBy],
    ["Accept at Other DoDAAC", "Not applicable"],
    ["LPO DoDAAC", "Not applicable"],
    ["DCAA Auditor DoDAAC", "Not applicable"],
    ["Other DoDAAC(s)", `Contractor submitter: ${contractorSubmitterCode()}`]
  ];

  return [
    "DFARS 252.232-7006 WAWF payment instructions fill-ins for this training contract:",
    ...routingRows.map(([label, value]) => `${label}: ${value}`),
    `WAWF point of contact: ${state.government.contactName || state.award.contractingOfficer}, ${state.government.contactPhone || "DSN 318-555-0101"}`
  ].join("\n");
}

function sectionGText() {
  return `${state.ucf.sectionG || ""}\n\nG.4 WAWF Instructions.\n${wawfInstructionsText()}`;
}

function applyDocumentTokens(value = "") {
  return String(value)
    .replaceAll("{{solicitationNumber}}", state.document.solicitationNumber || "")
    .replaceAll("{{contractNumber}}", state.document.contractNumber || "")
    .replaceAll("{{contractorName}}", state.contractor.name || "")
    .replaceAll("{{wawfInstructions}}", wawfInstructionsText());
}

function attr(value = "") {
  return escapeHtml(value);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function formatMoney(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  });
}

function plainNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function totalAwardAmount() {
  return state.clins.reduce((sum, clin) => sum + plainNumber(clin.amount), 0);
}

function isChecked(value) {
  return value ? "X" : "";
}

function clauseSelected(id) {
  return coreClauseIds.includes(id) || Boolean(state.clauses[id]);
}

function selectedClauses() {
  return clauseLibrary.filter((clause) => clauseSelected(clause.id));
}

function renderContractorSelect() {
  contractorSelect.innerHTML = contractorRoster.map((contractor) => `
    <option value="${attr(contractor.code)}">${escapeHtml(contractor.code)} - ${escapeHtml(contractor.name)}</option>
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
    if (control.dataset.field === "ucf.includeKLM") {
      control.disabled = !solicitationSectionsAllowed();
    }
  });
  contractorSelect.value = state.contractor.code;
  document.querySelectorAll(".solicitation-only-field").forEach((field) => {
    field.hidden = !solicitationSectionsAllowed();
  });
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
        <textarea rows="3" data-clin-field="description">${escapeHtml(clin.description)}</textarea>
      </label>
      <div class="field-grid three">
        <label>
          Quantity
          <input data-clin-field="quantity" value="${attr(clin.quantity)}">
        </label>
        <label>
          Unit price
          <input data-clin-field="unitPrice" value="${attr(clin.unitPrice)}">
        </label>
        <label>
          Amount
          <input data-clin-field="amount" value="${attr(clin.amount)}">
        </label>
      </div>
    </article>
  `).join("");
}

function renderAttachmentEditor() {
  const root = document.querySelector("#attachmentEditor");
  if (!state.ucf.attachments.length) {
    root.innerHTML = `<p class="empty-note">No attachments by default. Add one here when an exercise needs Section J material.</p>`;
    return;
  }

  root.innerHTML = state.ucf.attachments.map((attachment, index) => `
    <article class="attachment-card" data-attachment-index="${index}">
      <header>
        <strong>${escapeHtml(attachment.number || `J-${String(index + 1).padStart(2, "0")}`)}</strong>
        <button type="button" class="small" data-remove-attachment="${index}">Remove</button>
      </header>
      <div class="field-grid two">
        <label>
          Attachment no.
          <input data-attachment-field="number" value="${attr(attachment.number)}">
        </label>
        <label>
          Pages
          <input data-attachment-field="pages" value="${attr(attachment.pages)}">
        </label>
      </div>
      <label>
        Title
        <input data-attachment-field="title" value="${attr(attachment.title)}">
      </label>
      <label>
        Date
        <input data-attachment-field="date" value="${attr(attachment.date)}" placeholder="05/01/20XX">
      </label>
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
    <div class="sf-box ${extraClass}">
      <div class="sf-label">${label}</div>
      <div class="sf-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function multiline(value) {
  return escapeHtml(value || "");
}

function renderCoverPage(totalPages) {
  const d = state.document;
  const a = state.acquisition;
  const g = state.government;
  const c = state.contractor;
  const award = state.award;
  const total = formatMoney(totalAwardAmount());

  return `
    <section class="document-page sf-cover-page ${d.trainingWatermark ? "watermark" : ""}">
      <div class="sf-form">
        <div class="sf-row sf-title-row">
          <div class="sf-title">
            SOLICITATION/CONTRACT/ORDER FOR COMMERCIAL PRODUCTS AND COMMERCIAL SERVICES
            <div class="sf-note">OFFEROR TO COMPLETE BLOCKS 12, 17, 23, 24, AND 30 AS APPLICABLE.</div>
          </div>
          ${box("1. Requisition Number", d.requisitionNumber)}
          <div class="sf-box">
            <div class="sf-label">Page 1 of</div>
            <div class="sf-value">${totalPages}</div>
          </div>
        </div>
        <div class="sf-row doc-ids">
          ${box("2. Contract Number", d.contractNumber)}
          ${box("3. Award/Effective Date", formatDate(d.awardDate))}
          ${box("4. Order Number", d.orderNumber)}
          ${box("5. Solicitation Number", d.solicitationNumber)}
          ${box("6. Solicitation Issue Date", formatDate(d.issueDate))}
        </div>
        <div class="sf-row contact">
          <div class="sf-box">
            <div class="sf-label">7. For Solicitation Information Call</div>
            <div class="sf-value">a. Name: ${escapeHtml(g.contactName)}<br>b. Telephone Number: ${escapeHtml(g.contactPhone)}</div>
          </div>
          ${box("8. Offer Due Date / Local Time", `${formatDate(d.offerDueDate)} ${d.offerDueTime || ""}`)}
          <div class="sf-box">
            <div class="sf-label">14. Method of Solicitation</div>
            <div class="sf-checkline">
              <span><span class="check">${isChecked(d.method === "IFB")}</span> IFB</span>
              <span><span class="check">${isChecked(d.method === "RFP")}</span> RFP</span>
              <span><span class="check">${isChecked(d.method === "RFQ")}</span> RFQ</span>
            </div>
          </div>
        </div>
        <div class="sf-row office">
          <div class="sf-box">
            <div class="sf-label">9. Issued By <span class="sf-tiny">Code ${escapeHtml(g.issuedByCode)}</span></div>
            <div class="sf-value">${escapeHtml(g.issuedByName)}<br>${multiline(g.issuedByAddress)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">10. This Acquisition Is</div>
            <div class="sf-checkline">
              <span><span class="check">${isChecked(a.setAside === "UNRESTRICTED")}</span> Unrestricted</span>
              <span><span class="check">${isChecked(a.setAside !== "UNRESTRICTED")}</span> Set aside: ${escapeHtml(a.setAside === "UNRESTRICTED" ? "" : a.setAside)}</span>
            </div>
            <div class="sf-value">NAICS: ${escapeHtml(a.naics)}<br>Size Standard: ${escapeHtml(a.sizeStandard)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">11. Delivery for FOB Destination Unless Block Is Marked</div>
            <div class="sf-checkline">
              <span><span class="check">${isChecked(!a.fobDestination)}</span> See Schedule</span>
            </div>
            <div class="sf-label">13a. DPAS Rated Order</div>
            <div class="sf-checkline">
              <span><span class="check">${isChecked(a.dpasRated)}</span> Yes</span>
              <span>13b. Rating: ${escapeHtml(a.dpasRating)}</span>
            </div>
          </div>
        </div>
        <div class="sf-row destination">
          <div class="sf-box">
            <div class="sf-label">12. Discount Terms</div>
            <div class="sf-value">${escapeHtml(c.discountTerms)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">15. Deliver To <span class="sf-tiny">Code ${escapeHtml(g.deliverToCode)}</span></div>
            <div class="sf-value">${escapeHtml(g.deliverToName)}<br>${multiline(g.deliverToAddress)}</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">16. Administered By <span class="sf-tiny">Code ${escapeHtml(g.adminCode)}</span></div>
            <div class="sf-value">${escapeHtml(g.adminName)}<br>${multiline(g.adminAddress)}</div>
          </div>
        </div>
        <div class="sf-row contractor">
          <div class="sf-box">
            <div class="sf-label">17a. Contractor / Offeror <span class="sf-tiny">Code ${escapeHtml(c.code)} Facility Code ${escapeHtml(c.facilityCode)}</span></div>
            <div class="sf-value">${escapeHtml(c.name)}<br>${multiline(c.address)}<br>Telephone Number: ${escapeHtml(c.phone)}</div>
            <div class="sf-checkline"><span><span class="check">${isChecked(c.remittanceDifferent)}</span> 17b. Check if remittance is different and put such address in offer</span></div>
          </div>
          <div class="sf-box">
            <div class="sf-label">18a. Payment Will Be Made By <span class="sf-tiny">Code ${escapeHtml(g.paymentCode)}</span></div>
            <div class="sf-value">${escapeHtml(g.paymentName)}<br>${multiline(g.paymentAddress)}</div>
            <div class="sf-checkline"><span><span class="check"></span> 18b. Submit invoices to address shown unless checked: See addendum</span></div>
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
              <td class="sf-continuation-note">SEE CONTINUATION</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            <tr class="sf-schedule-helper-row">
              <td colspan="6" class="sf-schedule-instruction">(Use Reverse and/or Attach Additional Sheets as Necessary)</td>
            </tr>
          </tbody>
        </table>
        <div class="sf-row money">
          ${box("25. Accounting and Appropriation Data", "SEE CONTINUATION")}
          ${box("26. Total Award Amount (For Government Use Only)", total)}
        </div>
        <div class="sf-row addenda">
          <div class="sf-box">
            <div class="sf-label">27a/27b. Solicitation/Contract Incorporates Commercial Item Clauses</div>
            <div class="sf-checkline">
              <span><span class="check">X</span> FAR 52.212-1 and FAR 52.212-4 are incorporated as applicable.</span>
              <span><span class="check">X</span> Addenda are attached.</span>
            </div>
          </div>
        </div>
        <div class="sf-row award">
          <div class="sf-box">
            <div class="sf-label">28. Contractor Is Required To Sign This Document And Return Copies</div>
            <div class="sf-value">Contractor agrees to furnish and deliver all items set forth or otherwise identified above and on any continuation sheets subject to the terms and conditions specified herein.</div>
          </div>
          <div class="sf-box">
            <div class="sf-label">29. Award of Contract</div>
            <div class="sf-value">Reference offer dated ${formatDate(award.offerDate)}. Your offer on solicitation ${escapeHtml(d.solicitationNumber)}, including any additions or changes set forth herein, is accepted as to items: ${escapeHtml(award.acceptedItems)}.</div>
          </div>
        </div>
        <div class="sf-row signatures">
          ${box("30a. Signature of Offeror/Contractor", signedName("contractor"), "signature-box")}
          ${box("31a. United States of America (Signature of Contracting Officer)", signedName("government"), "signature-box")}
        </div>
        <div class="sf-row sign-names">
          ${box("30b. Name and Title of Signer", award.contractorSigner)}
          ${box("30c. Date Signed", state.signatures.contractor ? formatDate(award.contractorDate) : "")}
          ${box("31b. Name of Contracting Officer", award.contractingOfficer)}
          ${box("31c. Date Signed", state.signatures.government ? formatDate(award.coDate) : "")}
        </div>
      </div>
      <div class="sf-footer">
        <span>AUTHORIZED FOR LOCAL REPRODUCTION - PREVIOUS EDITION IS NOT USABLE</span>
        <strong>STANDARD FORM 1449 (REV. 11/2021)</strong>
      </div>
    </section>
  `;
}

function renderUcfPage(title, content, pageNumber, totalPages) {
  const d = state.document;
  return `
    <section class="document-page ${d.trainingWatermark ? "watermark" : ""}">
      <header class="ucf-header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <div>${escapeHtml(d.instrumentType)} ${escapeHtml(d.contractNumber || d.solicitationNumber || "")}</div>
        </div>
        <div class="ucf-meta">
          Solicitation: ${escapeHtml(d.solicitationNumber)}<br>
          Contractor: ${escapeHtml(state.contractor.name)}<br>
          Page ${pageNumber} of ${totalPages}
        </div>
      </header>
      ${content}
      <footer class="pack-footer">
        <span>SF 1449 Continuation / Uniform Contract Format</span>
        <span>Page ${pageNumber} of ${totalPages}</span>
      </footer>
    </section>
  `;
}

function sf30Box(label, value = "", extraClass = "") {
  return `
    <div class="sf30-box ${extraClass}">
      <div class="sf30-label">${label}</div>
      <div class="sf30-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function modTypeCheck(type) {
  return state.mod.modType === type ? "X" : "";
}

function renderSf30Cover(totalPages) {
  const d = state.document;
  const g = state.government;
  const c = state.contractor;
  const m = state.mod;
  const award = state.award;
  const signatureRequired = Boolean(m.contractorSignatureRequired);

  return `
    <section class="document-page ${d.trainingWatermark ? "watermark" : ""}">
      <div class="sf30-form">
        <div class="sf30-title-row">
          ${sf30Box("1. Contract ID Code", "")}
          <div class="sf30-title">AMENDMENT OF SOLICITATION/MODIFICATION OF CONTRACT</div>
          ${sf30Box("Page of Pages", `1 of ${totalPages}`)}
        </div>
        <div class="sf30-row ids">
          ${sf30Box("2. Amendment/Modification No.", m.modNumber)}
          ${sf30Box("3. Effective Date", formatDate(m.effectiveDate))}
          ${sf30Box("4. Requisition/Purchase Req. No.", m.requisitionNumber || d.requisitionNumber)}
          ${sf30Box("5. Project No. (If Applicable)", m.projectNumber)}
        </div>
        <div class="sf30-row offices">
          <div class="sf30-box">
            <div class="sf30-label">6. Issued By <span class="sf-tiny">Code ${escapeHtml(g.issuedByCode)}</span></div>
            <div class="sf30-value">${escapeHtml(g.issuedByName)}<br>${multiline(g.issuedByAddress)}</div>
          </div>
          <div class="sf30-box">
            <div class="sf30-label">7. Administered By (If Other Than Item 6) <span class="sf-tiny">Code ${escapeHtml(g.adminCode)}</span></div>
            <div class="sf30-value">${escapeHtml(g.adminName)}<br>${multiline(g.adminAddress)}</div>
          </div>
        </div>
        <div class="sf30-row party">
          <div class="sf30-box">
            <div class="sf30-label">8. Name and Address of Contractor</div>
            <div class="sf30-value">${escapeHtml(c.name)}<br>${multiline(c.address)}<br>Code: ${escapeHtml(c.code)} &nbsp;&nbsp; Facility Code: ${escapeHtml(c.facilityCode)}</div>
          </div>
          <div class="sf30-stack">
            ${sf30Box("9A. Amendment of Solicitation No.", "")}
            ${sf30Box("9B. Dated (See Item 11)", "")}
            ${sf30Box("10A. Modification of Contract/Order No.", d.contractNumber)}
            ${sf30Box("10B. Dated (See Item 13)", formatDate(d.awardDate))}
          </div>
        </div>
        <div class="sf30-row mod">
          <div class="sf30-box">
            <div class="sf30-label">11. This Item Only Applies to Amendments of Solicitations</div>
            <div class="sf30-value">Not applicable. This SF 30 is prepared as a modification to the contract/order identified in Item 10A.</div>
          </div>
        </div>
        <div class="sf30-row mod">
          ${sf30Box("12. Accounting and Appropriation Data (If Required)", award.accountingData)}
        </div>
        <div class="sf30-row mod">
          <div class="sf30-box">
            <div class="sf30-label">13. This Item Applies Only to Modifications of Contracts/Orders</div>
            <div class="sf30-value">
              <span><span class="check">${modTypeCheck("unilateral")}</span> A. This change order is issued pursuant to: ${escapeHtml(m.authority)}</span><br>
              <span><span class="check">${modTypeCheck("administrative")}</span> B. The above numbered contract/order is modified to reflect administrative changes pursuant to FAR 43.103(b).</span><br>
              <span><span class="check">${modTypeCheck("supplemental")}</span> C. This supplemental agreement is entered into pursuant to authority of: ${escapeHtml(m.authority)}</span><br>
              <span><span class="check">${modTypeCheck("other")}</span> D. Other: ${escapeHtml(m.authority)}</span><br>
              <span>E. Important: Contractor <span class="check">${signatureRequired ? "" : "X"}</span> is not, <span class="check">${signatureRequired ? "X" : ""}</span> is required to sign this document and return ${escapeHtml(m.returnCopies || "0")} copies to the issuing office.</span>
            </div>
          </div>
        </div>
        <div class="sf30-row mod">
          <div class="sf30-box sf30-description">
            <div class="sf30-label">14. Description of Amendment/Modification</div>
            <div class="sf30-value">See continuation page.</div>
          </div>
        </div>
        <div class="sf30-row sign">
          ${sf30Box("15A. Name and Title of Signer", signatureRequired ? award.contractorSigner : "")}
          ${sf30Box("16A. Name and Title of Contracting Officer", award.contractingOfficer)}
        </div>
        <div class="sf30-row sign-details">
          ${sf30Box("15B. Contractor/Offeror", signatureRequired ? signedName("contractor") : "", "signature-box")}
          ${sf30Box("15C. Date Signed", signatureRequired && state.signatures.contractor ? formatDate(award.contractorDate) : "")}
          ${sf30Box("16B. United States of America", signedName("government"), "signature-box")}
          ${sf30Box("16C. Date Signed", state.signatures.government ? formatDate(m.effectiveDate) : "")}
        </div>
      </div>
      <div class="sf-footer">
        <span>NSN 7540-01-152-8070 - PREVIOUS EDITION UNUSABLE</span>
        <strong>STANDARD FORM 30 (REV. 11/2016)</strong>
      </div>
    </section>
  `;
}

function renderSf30Continuation(pageNumber, totalPages) {
  const d = state.document;
  const m = state.mod;
  return `
    <section class="document-page ${d.trainingWatermark ? "watermark" : ""}">
      <header class="ucf-header">
        <div>
          <h1>SF 30 Continuation - Item 14</h1>
          <div>${escapeHtml(m.modNumber)} to ${escapeHtml(d.contractNumber)}</div>
        </div>
        <div class="ucf-meta">
          Contractor: ${escapeHtml(state.contractor.name)}<br>
          Page ${pageNumber} of ${totalPages}
        </div>
      </header>
      <section class="ucf-section">
        <h2>14. Description of Amendment/Modification</h2>
        <div class="ucf-body">${escapeHtml(applyDocumentTokens(m.description))}</div>
      </section>
      <section class="ucf-section">
        <h2>Summary</h2>
        <table class="ucf-table">
          <tbody>
            <tr><th style="width: 28%;">Contract</th><td>${escapeHtml(d.contractNumber)}</td></tr>
            <tr><th>Modification</th><td>${escapeHtml(m.modNumber)}</td></tr>
            <tr><th>Authority</th><td>${escapeHtml(m.authority)}</td></tr>
            <tr><th>Accounting Data</th><td>${escapeHtml(state.award.accountingData)}</td></tr>
          </tbody>
        </table>
      </section>
      <footer class="pack-footer">
        <span>SF 30 Continuation Sheet</span>
        <span>Page ${pageNumber} of ${totalPages}</span>
      </footer>
    </section>
  `;
}

function renderSf30Package() {
  const totalPages = 2;
  return [
    renderSf30Cover(totalPages),
    renderSf30Continuation(2, totalPages)
  ];
}

function ucfSection(letter, title, body, fallback = "") {
  const value = applyDocumentTokens(body || fallback);
  if (!state.ucf.showBlankSections && !value) return "";
  return `
    <section class="ucf-section">
      <h2>Section ${letter} - ${escapeHtml(title)}</h2>
      <div class="ucf-body">${escapeHtml(value || "Reserved.")}</div>
    </section>
  `;
}

function renderTableOfContents() {
  const showSolicitationSections = state.ucf.includeKLM && solicitationSectionsAllowed();
  const rows = [
    ["A", "Solicitation/Contract Form", "SF 1449 cover page"],
    ["B", "Supplies or Services and Prices/Costs", "CLIN schedule and pricing"],
    ["C", "Description/Specifications/Work Statement", "Statement of work or PWS narrative"],
    ["D", "Packaging and Marking", "Delivery packaging and marking instructions"],
    ["E", "Inspection and Acceptance", "Inspection, acceptance, and QA terms"],
    ["F", "Deliveries or Performance", "Period, place, and schedule of performance"],
    ["G", "Contract Administration Data", "Payment, COR, invoicing, and administration"],
    ["H", "Special Contract Requirements", "Special terms not covered elsewhere"],
    ["I", "Contract Clauses", "FAR and supplemental clauses"],
    ["J", "List of Attachments", "Attachments and exhibits"]
  ];

  if (showSolicitationSections) {
    rows.push(
      ["K", "Representations, Certifications, and Other Statements", "Offeror reps and certs"],
      ["L", "Instructions, Conditions, and Notices to Offerors", "Proposal submission instructions"],
      ["M", "Evaluation Factors for Award", "Evaluation basis and factors"]
    );
  }

  return `
    <section class="ucf-section">
      <h2>Uniform Contract Format</h2>
      <table class="ucf-table">
        <thead>
          <tr><th style="width: 12%;">Section</th><th style="width: 44%;">Title</th><th>Use in This Package</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr><td>${row[0]}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="ucf-section">
      <h2>Document Control</h2>
      <table class="ucf-table">
        <tbody>
          <tr><th>Instrument</th><td>${escapeHtml(state.document.instrumentType)}</td><th>Profile</th><td>${escapeHtml(profileLabel(state.document.profile))}</td></tr>
          <tr><th>Solicitation</th><td>${escapeHtml(state.document.solicitationNumber)}</td><th>Contract</th><td>${escapeHtml(state.document.contractNumber)}</td></tr>
          <tr><th>Issued By</th><td>${escapeHtml(state.government.issuedByName)}</td><th>Contractor</th><td>${escapeHtml(state.contractor.name)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function profileLabel(profile) {
  const labels = {
    ffp: "Firm-fixed-price",
    idiq: "IDIQ",
    requirements: "Requirements",
    optionYear: "Base plus options"
  };
  return labels[profile] || profile;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function renderSectionBPages() {
  const clinChunks = chunkArray(state.clins, 8);
  return clinChunks.map((clins, pageIndex) => `
    <section class="ucf-section">
      <h2>Section B - Supplies or Services and Prices/Costs${pageIndex ? " (Continued)" : ""}</h2>
      ${pageIndex ? "" : "<p>This section continues SF 1449 Blocks 19 through 24. The CLIN schedule below controls the item numbers, supplies or services, quantities, units, unit prices, and amounts.</p>"}
      <table class="ucf-table">
        <thead>
          <tr>
            <th style="width: 12%;">CLIN</th>
            <th>Description</th>
            <th style="width: 10%;">Qty</th>
            <th style="width: 10%;">Unit</th>
            <th style="width: 14%;">Unit Price</th>
            <th style="width: 14%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${clins.map((clin) => `
            <tr>
              <td>${escapeHtml(clin.itemNumber)}</td>
              <td>${escapeHtml(applyDocumentTokens(clin.description))}</td>
              <td style="text-align: right;">${escapeHtml(clin.quantity)}</td>
              <td style="text-align: center;">${escapeHtml(clin.unit)}</td>
              <td style="text-align: right;">${formatMoney(clin.unitPrice)}</td>
              <td style="text-align: right;">${formatMoney(clin.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p><strong>Total Evaluated / Award Amount:</strong> ${formatMoney(totalAwardAmount())}</p>
      <p>Prices include all labor, materials, overhead, general and administrative expense, and profit unless otherwise stated in the schedule.</p>
    </section>
  `);
}

function renderAdministrationContinuation() {
  return `
    <section class="ucf-section">
      <h2>Continuation of SF 1449 Blocks 25 and 26</h2>
      <table class="ucf-table">
        <tbody>
          <tr>
            <th style="width: 30%;">Accounting and Appropriation Data</th>
            <td>${escapeHtml(state.award.accountingData || "To be cited on orders or funding documents.")}</td>
          </tr>
          <tr>
            <th>Total Award Amount</th>
            <td>${formatMoney(totalAwardAmount())}</td>
          </tr>
          <tr>
            <th>Payment Office</th>
            <td>${escapeHtml(state.government.paymentName)}<br>${escapeHtml(state.government.paymentAddress)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderClauseMatrix() {
  const clauses = selectedClauses();
  return `
    <section class="ucf-section">
      <h2>Section I - Contract Clauses</h2>
      <table class="ucf-table">
        <thead>
          <tr><th style="width: 18%;">Clause</th><th>Title</th><th style="width: 14%;">Date</th><th style="width: 18%;">Method</th></tr>
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
    </section>
    <section class="ucf-section">
      <h2>Commercial Addendum</h2>
      <p>The clauses listed above are incorporated by reference or set forth in full text. Fill-ins, ordering limitations, option notice periods, and other addenda are stated in the applicable UCF sections.</p>
    </section>
  `;
}

function renderClauseTextPages() {
  return chunkArray(selectedClauses(), 4).map((clauses, index) => `
    <section class="ucf-section">
      <h2>Section I - Full Text Clauses${index ? " (Continued)" : ""}</h2>
      ${clauses.map((clause) => `
        <h3>${escapeHtml(clause.id)} ${escapeHtml(clause.title)} (${escapeHtml(clause.date)})</h3>
        <div class="clause-body">${escapeHtml(applyDocumentTokens(clause.body))}</div>
      `).join("")}
    </section>
  `);
}

function renderSectionJ() {
  const attachments = state.ucf.attachments || [];
  if (!attachments.length) {
    return ucfSection("J", "List of Attachments", "No attachments are included.");
  }

  return `
    <section class="ucf-section">
      <h2>Section J - List of Attachments</h2>
      <table class="ucf-table">
        <thead>
          <tr><th style="width: 18%;">Attachment</th><th>Title</th><th style="width: 18%;">Date</th><th style="width: 12%;">Pages</th></tr>
        </thead>
        <tbody>
          ${attachments.map((attachment, index) => `
            <tr>
              <td>${escapeHtml(attachment.number || `J-${String(index + 1).padStart(2, "0")}`)}</td>
              <td>${escapeHtml(applyDocumentTokens(attachment.title || "Attachment"))}</td>
              <td>${escapeHtml(attachment.date || "")}</td>
              <td>${escapeHtml(attachment.pages || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildUcfContents() {
  const pages = [];
  pages.push({
    title: "Continuation Sheet - Table of Contents",
    content: renderTableOfContents()
  });

  renderSectionBPages().forEach((content, index) => {
    pages.push({
      title: index ? "Section B - Continued" : "Section B - Supplies or Services",
      content
    });
  });

  pages.push({
    title: "Sections C and D",
    content: [
      ucfSection("C", "Description / Specifications / Work Statement", state.ucf.sectionC),
      ucfSection("D", "Packaging and Marking", state.ucf.sectionD)
    ].join("")
  });

  pages.push({
    title: "Sections E and F",
    content: [
      ucfSection("E", "Inspection and Acceptance", state.ucf.sectionE),
      ucfSection("F", "Deliveries or Performance", state.ucf.sectionF)
    ].join("")
  });

  pages.push({
    title: "Sections G and H",
    content: [
      ucfSection("G", "Contract Administration Data", sectionGText()),
      renderAdministrationContinuation(),
      ucfSection("H", "Special Contract Requirements", state.ucf.sectionH)
    ].join("")
  });

  pages.push({
    title: "Section I - Contract Clauses",
    content: renderClauseMatrix()
  });

  renderClauseTextPages().forEach((content, index) => {
    pages.push({
      title: index ? "Section I - Full Text Clauses Continued" : "Section I - Full Text Clauses",
      content
    });
  });

  pages.push({
    title: "Section J - Attachments",
    content: renderSectionJ()
  });

  if (state.ucf.includeKLM && solicitationSectionsAllowed()) {
    pages.push({
      title: "Section K - Representations and Certifications",
      content: ucfSection("K", "Representations, Certifications, and Other Statements", state.ucf.sectionK)
    });
    pages.push({
      title: "Section L - Instructions to Offerors",
      content: ucfSection("L", "Instructions, Conditions, and Notices to Offerors", state.ucf.sectionL)
    });
    pages.push({
      title: "Section M - Evaluation Factors",
      content: ucfSection("M", "Evaluation Factors for Award", state.ucf.sectionM)
    });
  }

  return pages;
}

function renderPreview() {
  syncAwardComputedFields();
  const isModPreview = state.previewMode === "mod";
  const ucfPages = isModPreview ? [] : buildUcfContents();
  const renderedPages = isModPreview
    ? renderSf30Package()
    : [
      renderCoverPage(1 + ucfPages.length),
      ...ucfPages.map((page, index) => renderUcfPage(page.title, page.content, index + 2, 1 + ucfPages.length))
    ];
  const totalPages = renderedPages.length;
  preview.innerHTML = `<div class="document-pack">${renderedPages.join("")}</div>`;
  pageCount.textContent = `${totalPages} pages`;
  previewTitle.textContent = isModPreview ? "SF 30 Preview" : "SF 1449 Preview";
  previewAwardBtn.classList.toggle("active", !isModPreview);
  previewModBtn.classList.toggle("active", isModPreview);
}

function renderAll() {
  syncAwardComputedFields();
  renderContractorSelect();
  syncControls();
  renderClinEditor();
  renderAttachmentEditor();
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
  const next = {};
  Object.keys(state.clauses).forEach((id) => {
    next[id] = false;
  });
  (profileClauses[state.document.profile] || []).forEach((id) => {
    next[id] = true;
  });
  state.clauses = next;
  markDirty();
  renderAll();
}

editor.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-field]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setPath(state, target.dataset.field, value);
    if (target.dataset.field === "document.requisitionNumber") {
      syncAwardComputedFields();
      const accountingInput = document.querySelector('[data-field="award.accountingData"]');
      if (accountingInput) accountingInput.value = state.award.accountingData;
    }
    markDirty();
    renderPreview();
  }

  if (target.matches("[data-clin-field]")) {
    const card = target.closest("[data-clin-index]");
    const index = Number(card.dataset.clinIndex);
    state.clins[index][target.dataset.clinField] = target.value;
    if (target.dataset.clinField === "quantity" || target.dataset.clinField === "unitPrice") {
      const quantity = plainNumber(state.clins[index].quantity);
      const unitPrice = plainNumber(state.clins[index].unitPrice);
      if (quantity || unitPrice) {
        state.clins[index].amount = String(quantity * unitPrice);
        const amountInput = card.querySelector('[data-clin-field="amount"]');
        if (amountInput) amountInput.value = state.clins[index].amount;
      }
    }
    markDirty();
    renderPreview();
  }

  if (target.matches("[data-attachment-field]")) {
    const card = target.closest("[data-attachment-index]");
    const index = Number(card.dataset.attachmentIndex);
    state.ucf.attachments[index][target.dataset.attachmentField] = target.value;
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
    if (target.dataset.field === "document.requisitionNumber") {
      const previous = value;
      state.document.requisitionNumber = normalizeForm9Number(state.document.requisitionNumber);
      if (badForm9Number(state.mod.requisitionNumber) || state.mod.requisitionNumber === previous) {
        state.mod.requisitionNumber = state.document.requisitionNumber;
      }
      syncAwardComputedFields();
    }
    if (target.dataset.field === "mod.requisitionNumber") {
      state.mod.requisitionNumber = normalizeForm9Number(state.mod.requisitionNumber);
    }
    if (target.dataset.field === "document.method") {
      const serial = String(state.document.solicitationNumber || "").match(/00(\d{2})$/)?.[1] || "01";
      setSolicitationSerial(serial);
    }
    if (target.dataset.field === "award.fundType") {
      state.award.funding = createFundingSeed(state.award.fundType);
      syncAwardComputedFields();
    }
    if (target.dataset.field === "mod.modType") {
      state.mod.authority = defaultModAuthority(state.mod.modType);
    }
    state.acquisition.setAside = "UNRESTRICTED";
    state.acquisition.naics = "";
    state.acquisition.sizeStandard = "";
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
  const removeButton = event.target.closest("[data-remove-clin]");
  if (removeButton) {
    const index = Number(removeButton.dataset.removeClin);
    state.clins.splice(index, 1);
    markDirty();
    renderAll();
  }

  const removeAttachmentButton = event.target.closest("[data-remove-attachment]");
  if (removeAttachmentButton) {
    const index = Number(removeAttachmentButton.dataset.removeAttachment);
    state.ucf.attachments.splice(index, 1);
    markDirty();
    renderAll();
  }
});

document.querySelector("#addClinBtn").addEventListener("click", () => {
  const last = state.clins[state.clins.length - 1];
  const nextNumber = last?.itemNumber ? String(Number(last.itemNumber) + 1).padStart(4, "0") : "0001";
  state.clins.push({
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

document.querySelector("#addAttachmentBtn").addEventListener("click", () => {
  const nextNumber = `J-${String(state.ucf.attachments.length + 1).padStart(2, "0")}`;
  state.ucf.attachments.push({
    number: nextNumber,
    title: "",
    date: "",
    pages: ""
  });
  markDirty();
  renderAll();
});

document.querySelector("#applyProfileBtn").addEventListener("click", applyProfile);

document.querySelector("#generateForm9Btn").addEventListener("click", () => {
  randomizeForm9Serial();
  syncAwardComputedFields();
  markDirty();
  renderAll();
});

document.querySelector("#generateContractPiidBtn").addEventListener("click", () => {
  randomizeContractSerial();
  markDirty();
  renderAll();
});

document.querySelector("#generateSolicitationPiidBtn").addEventListener("click", () => {
  randomizeSolicitationSerial();
  markDirty();
  renderAll();
});

document.querySelector("#generateDeliveryBtn").addEventListener("click", () => {
  state.government.deliverToAddress = randomDeliveryAddress();
  markDirty();
  renderAll();
});

document.querySelector("#generateFundingBtn").addEventListener("click", () => {
  state.award.funding = createFundingSeed(state.award.fundType);
  syncAwardComputedFields();
  markDirty();
  renderAll();
});

document.querySelector("#randomizeModBtn").addEventListener("click", () => {
  randomizeModNumber();
  markDirty();
  renderAll();
});

document.querySelector("#applySignaturesBtn").addEventListener("click", () => {
  applyRequiredSignatures();
  markDirty();
  renderAll();
});

document.querySelector("#clearSignaturesBtn").addEventListener("click", () => {
  clearSignatures();
  markDirty();
  renderAll();
});

document.querySelector("#matchModReqBtn").addEventListener("click", () => {
  state.mod.requisitionNumber = state.document.requisitionNumber;
  markDirty();
  renderAll();
});

previewAwardBtn.addEventListener("click", () => {
  state.previewMode = "award";
  renderPreview();
});

previewModBtn.addEventListener("click", () => {
  state.previewMode = "mod";
  renderPreview();
});

contractorSelect.addEventListener("change", () => {
  applyContractor(contractorByCode(contractorSelect.value));
  markDirty();
  renderAll();
});

document.querySelector("#sampleBtn").addEventListener("click", () => {
  state = structuredClone(sampleState);
  enforceExerciseDefaults();
  applyProfile();
  markDirty();
  renderAll();
});

document.querySelector("#saveDraftBtn").addEventListener("click", saveDraft);

document.querySelector("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.document.contractNumber || state.document.solicitationNumber || "sf1449-draft"}.json`;
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
    enforceExerciseDefaults();
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
