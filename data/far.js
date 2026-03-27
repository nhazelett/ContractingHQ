// ContractingHQ — FAR Updates Data
// To add an update: copy a block below and fill in the details.
// status options: "final", "proposed", "interim"

var FAR_UPDATES = [
  {
    id: 1,
    date: "February 2026",
    title: "FAR Overhaul — First Wave of Changes Now in Effect",
    status: "interim",
    farCase: "EO 14275 / FAR Deviations",
    summary: "The first wave of the Revolutionary FAR Overhaul (Executive Order 14275, signed April 2025) took effect February 1, 2026. The overhaul is restructuring the FAR from a prescriptive, rule-based system to a principles-based framework that gives contracting officers greater discretion. 38 FAR parts are currently subject to deviations, with rolling updates continuing through June 30, 2026. Formal notice-and-comment rulemaking is expected to begin spring 2026.",
    practitionerNote: "This is the most significant change to the FAR since its 1984 rewrite. The rules you learned may already have changed. Before relying on any FAR provision, check acquisition.gov/far-overhaul for the latest class deviations. Agency-specific interim guidance is where the action is right now."
  },
  {
    id: 2,
    date: "November 2025",
    title: "CMMC 2.0 Final Rule — Mandatory for DoD Contracts",
    status: "final",
    farCase: "DFARS Case 2025-D001",
    summary: "The Cybersecurity Maturity Model Certification (CMMC) 2.0 became enforceable under DFARS effective November 10, 2025. Phase 1 (November 2025 through November 2026) requires CMMC Level 1 self-attestation and Level 2 assessments in select DoD solicitations. All contractors handling Controlled Unclassified Information (CUI) must meet applicable CMMC level requirements. Third-party assessment organizations (C3PAOs) are required for Level 2+ certifications starting Phase 2 in November 2026.",
    practitionerNote: "If you’re writing or awarding DoD contracts involving CUI, CMMC clauses are now required. Verify contractor CMMC status in SPRS before award. Level 1 contractors can self-attest, but Level 2+ need documented assessments. Missing this is a significant liability at award."
  },
  {
    id: 3,
    date: "March 2026",
    title: "Trade Agreements Thresholds Updated — FAC 2026-01",
    status: "final",
    farCase: "FAC 2026-01",
    summary: "Federal Acquisition Circular 2026-01 (published March 13, 2026) updated WTO Government Procurement Agreement and Free Trade Agreement procurement thresholds under FAR Subpart 25.4. The new thresholds reflect updated figures published by the U.S. Trade Representative and affect which acquisitions require international competitive procedures and country-of-origin analysis.",
    practitionerNote: "If you’re running a competitive acquisition above the simplified acquisition threshold, verify whether Trade Agreements Act requirements apply under the new thresholds. This is a routine but commonly missed update — especially on requirements near the boundary values. Check FAR 25.402 for the current figures."
  }
];
