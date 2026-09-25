export const NAICS_SOURCE =
  "https://www.census.gov/naics/reference_files_tools/2022_NAICS_Manual.pdf";
// Practitioner research recipes, not a determination of the appropriate NAICS for a solicitation.
export const CAPABILITIES = [
  {
    id: "power",
    name: "Power & generators",
    terms: ["generator", "power generation", "generator rental"],
    industries: [
      ["532", "Rental and leasing"],
      ["811", "Repair and maintenance"],
    ],
    questions: [
      "What equipment ratings and maintenance support can the supplier document?",
      "Who provides fuel, installation, spares and replacement equipment?",
    ],
  },
  {
    id: "water",
    name: "Water & hauling",
    terms: ["potable water", "water delivery", "water hauling"],
    industries: [["484", "Truck transportation"]],
    questions: [
      "What water-quality documentation and delivery capacity are available?",
      "Who owns the tanks and performs cleaning and quality checks?",
    ],
  },
  {
    id: "fuel",
    name: "Fuel & lubricants",
    terms: ["diesel", "fuel delivery", "lubricants"],
    industries: [],
    questions: [
      "What product specifications, delivery documentation and local permissions apply?",
      "Can the supplier explain its sourcing and quality-control process?",
    ],
  },
  {
    id: "transport",
    name: "Transportation",
    terms: ["trucking", "freight", "transportation"],
    industries: [
      ["484", "Truck transportation"],
      ["488", "Transportation support"],
    ],
    questions: [
      "What cargo types and vehicle capacities are supported?",
      "Which border, customs and transport permissions must be verified?",
    ],
  },
  {
    id: "handling",
    name: "Material handling",
    terms: ["forklift", "crane rental", "material handling"],
    industries: [["532", "Rental and leasing"]],
    questions: [
      "Are operators included and qualified for the proposed equipment?",
      "What lifting capacities, inspection records and maintenance support are available?",
    ],
  },
  {
    id: "storage",
    name: "Warehousing & storage",
    terms: ["warehousing", "cold storage", "warehouse"],
    industries: [["493", "Warehousing and storage"]],
    questions: [
      "What storage conditions, handling services and inventory controls are available?",
      "Does the documented location belong to this legal entity or another operator?",
    ],
  },
  {
    id: "construction",
    name: "Construction",
    terms: ["construction", "site preparation", "electrical work"],
    industries: [["23", "Construction"]],
    questions: [
      "What comparable work and required local licenses can be documented?",
      "Which work is performed directly and which is subcontracted?",
    ],
  },
  {
    id: "sanitation",
    name: "Sanitation & waste",
    terms: ["portable toilet", "sewage", "waste collection"],
    industries: [["562", "Waste management and remediation"]],
    questions: [
      "What collection, servicing and lawful disposal arrangements are documented?",
      "Which environmental and waste-handling permissions apply locally?",
    ],
  },
  {
    id: "lodging",
    name: "Lodging & facilities",
    terms: ["lodging", "hotel", "facility maintenance"],
    industries: [
      ["721", "Accommodation"],
      ["811", "Repair and maintenance"],
    ],
    questions: [
      "What availability and service levels can be confirmed directly?",
      "Which services are included and which depend on other providers?",
    ],
  },
  {
    id: "food",
    name: "Food & catering",
    terms: ["catering", "food service", "meal delivery"],
    industries: [["722", "Food services and drinking places"]],
    questions: [
      "What food-safety controls and supply arrangements are documented?",
      "What meal volumes, preparation locations and dietary options can be supported?",
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance & repair",
    terms: ["vehicle maintenance", "equipment repair", "HVAC maintenance"],
    industries: [["811", "Repair and maintenance"]],
    questions: [
      "Which equipment makes and models are supported?",
      "What technicians, diagnostic tools, spare parts and warranties are available?",
    ],
  },
  {
    id: "communications",
    name: "Communications",
    terms: ["internet service", "telecommunications", "fiber optic"],
    industries: [["517", "Telecommunications"]],
    questions: [
      "Who owns and operates the service infrastructure?",
      "What local licensing, service availability and support commitments can be verified?",
    ],
  },
];
export function capabilityScope(scope, id, mode, value) {
  const preset = CAPABILITIES.find((p) => p.id === id);
  if (!preset || !["keyword", "naics"].includes(mode))
    throw new Error("Choose a research recipe.");
  if (
    mode === "keyword"
      ? !preset.terms.includes(value)
      : !preset.industries.some(([code]) => code === value)
  )
    throw new Error("Unknown preset search.");
  return {
    ...scope,
    q: mode === "keyword" ? value : "",
    naics: mode === "naics" ? value : "",
    psc: "",
  };
}
export function matchingCapability(scope) {
  return CAPABILITIES.find((p) => p.terms.includes(scope.q)) || null;
}
