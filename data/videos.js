// ContractingHQ — FAR Updates Data
// Status options: "Final Rule" | "Proposed Rule" | "Interim Rule"

const FAR_UPDATES = [
  {
    id: 1,
    date: "March 2025",
    title: "FAR Rewrite — Simplified Structure Proposed",
    status: "Proposed Rule",
    farCase: "FAR Case 2024-001",
    summary: "The FAC has proposed a comprehensive rewrite of the FAR structure, consolidating redundant provisions and modernizing language throughout Parts 1–53. The goal is to reduce the regulatory burden on small businesses and streamline the acquisition process. Public comment period closes April 30, 2025.",
    practitionerNote: "This is the most significant proposed change to the FAR framework in decades. Pay attention to proposed changes in Parts 12 and 15 — commercial item contracting and source selection procedures are both in scope. Submit comments if your organization has strong equities here."
  },
  {
    id: 2,
    date: "February 2025",
    title: "Cybersecurity Maturity Model Certification (CMMC) — Final Rule",
    status: "Final Rule",
    farCase: "DFARS Case 2019-D041",
    summary: "The CMMC 2.0 final rule is now in effect. Defense contractors handling Controlled Unclassified Information (CUI) must meet specified CMMC levels. Level 1 is self-assessed; Levels 2 and 3 require third-party or government assessment.",
    practitionerNote: "If you're acquiring anything that touches CUI — even peripherally — CMMC requirements belong in your solicitation. Work with your program office early to determine the right CMMC level. Getting this wrong at solicitation means a mod later, or worse, a protest."
  },
  {
    id: 3,
    date: "January 2025",
    title: "Inflation Adjustments to Acquisition Thresholds",
    status: "Final Rule",
    farCase: "FAR Case 2023-010",
    summary: "Effective January 2025, several key acquisition thresholds have been adjusted for inflation per statutory requirements. The micro-purchase threshold remains at $10,000; the simplified acquisition threshold remains at $250,000; the Truth in Negotiations Act threshold increases to $2.5M.",
    practitionerNote: "The TINA threshold change is the one to bookmark. Verify current thresholds any time you're drafting a solicitation above $1M — these change periodically and the consequences of using the wrong threshold (especially for certified cost or pricing data requirements) can be significant."
  }
];
