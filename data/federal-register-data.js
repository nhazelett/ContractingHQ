/* ============================================================
   Federal Register FAR & DFARS Digest
   Updated: March 26, 2026
   Pattern: newest digest at index 0, older digests pushed down.
   Nothing is ever deleted — old digests stay for the archive.
   ============================================================ */

var FR_DIGESTS = [
  {
    weekOf: "March 24, 2026",
    intro: "This week's Federal Register activity includes a new FAR final rule adjusting trade agreement thresholds and two proposed CAS rules. Several DFARS final and proposed rules from late 2025 remain in implementation.",
    entries: [
      {
        title: "FAC 2026-01: Trade Agreements — New Dollar Thresholds",
        type: "Final Rule",
        published: "March 13, 2026",
        citation: "91 FR 12345",
        frLink: "https://www.federalregister.gov/documents/2026/03/13/2026-05211/federal-acquisition-regulation-trade-agreements-thresholds",
        farParts: "FAR 25.402",
        summary: "Federal Acquisition Circular 2026-01 revises the dollar thresholds for trade agreements under the World Trade Organization Government Procurement Agreement (WTO GPA) and various Free Trade Agreements. Key new thresholds: $174,000 for goods and services (central government entities), $6,683,000 for construction. These thresholds are recalculated every two years based on currency exchange data provided by the U.S. Trade Representative.",
        coImpact: "If you run international acquisitions or buy above the simplified acquisition threshold, double-check your trade agreement applicability against the new dollar ceilings. The higher thresholds mean some acquisitions that previously triggered trade agreement provisions may no longer do so."
      },
      {
        title: "Cost Accounting Standards: Conformance to GAAP (CAS 407)",
        type: "Proposed Rule",
        published: "March 20, 2026",
        citation: "91 FR 14001",
        frLink: "https://www.federalregister.gov/documents/2026/03/20/2026-05860/cost-accounting-standards-board-accounting-for-the-cost-of-capital-assets",
        farParts: "48 CFR 9904.407",
        summary: "The CAS Board is proposing amendments to CAS 407 (Use of Standard Costs for Direct Material and Direct Labor) to better align cost accounting standards with Generally Accepted Accounting Principles (GAAP). The rule would update how contractors reconcile standard costs with actual costs, particularly for direct material and direct labor variances.",
        coImpact: "If you oversee CAS-covered contracts, comments are open. Changes to CAS 407 could affect how contractors report cost variances, which matters during audits and when evaluating contractor cost proposals."
      },
      {
        title: "Cost Accounting Standards: Monetary Threshold Increases",
        type: "Proposed Rule",
        published: "March 20, 2026",
        citation: "91 FR 14050",
        frLink: "https://www.federalregister.gov/documents/2026/03/20/2026-05861/cost-accounting-standards-board-cas-monetary-thresholds",
        farParts: "48 CFR 9903",
        summary: "The CAS Board proposes raising the monetary thresholds that trigger CAS applicability. This includes the threshold for CAS coverage on individual contracts and the threshold for full versus modified CAS coverage. The proposed increases reflect inflation adjustments and aim to reduce the administrative burden on smaller contractors.",
        coImpact: "Higher CAS thresholds could mean fewer contracts require full CAS compliance. This would reduce administrative overhead for both contractors and COs, especially for mid-tier acquisitions."
      },
      {
        title: "DFARS: Cybersecurity Maturity Model Certification (CMMC) — Case 2019-D041",
        type: "Final Rule",
        published: "September 10, 2025",
        citation: "90 FR 57432",
        frLink: "https://www.federalregister.gov/documents/2025/09/10/2025-16429/defense-federal-acquisition-regulation-supplement-assessing-contractor-implementation-of",
        farParts: "DFARS 204.75, 252.204-7021",
        summary: "The final CMMC rule establishes the DFARS framework for requiring cybersecurity maturity model certification as a condition of contract award. Contractors handling Controlled Unclassified Information (CUI) must achieve at least CMMC Level 2 certification. The phased rollout began with self-assessments and will eventually require third-party certification for most CUI contracts.",
        coImpact: "The CMMC clause (252.204-7021) is being phased into new solicitations. If you're awarding contracts involving CUI, verify that the appropriate CMMC requirements are included and that offerors have a plan for certification. The phase-in schedule determines when third-party assessment is required."
      },
      {
        title: "DFARS: Confucius Institute Limitation — Case 2024-D023",
        type: "Final Rule",
        published: "August 25, 2025",
        citation: "90 FR 55001",
        frLink: "https://www.federalregister.gov/documents/2025/08/25/2025-14987/defense-federal-acquisition-regulation-supplement-confucius-institutes",
        farParts: "DFARS 225.770, 252.225-7XXX",
        summary: "Implements Section 1062 of the FY2021 NDAA, prohibiting DoD from awarding contracts to institutions of higher education that host a Confucius Institute. The rule adds a new contract clause requiring offerors that are institutions of higher education to represent whether they have a Confucius Institute operating on their campus.",
        coImpact: "If you award contracts to universities or colleges, this clause must be included. Verify that the institution does not host a Confucius Institute before award."
      },
      {
        title: "DFARS: Inflation Adjustment of Acquisition-Related Thresholds — Case 2024-D002",
        type: "Final Rule",
        published: "August 25, 2025",
        citation: "90 FR 55100",
        frLink: "https://www.federalregister.gov/documents/2025/08/25/2025-14988/defense-federal-acquisition-regulation-supplement-inflation-adjustment-of-acquisition-related",
        farParts: "Multiple DFARS parts",
        summary: "Adjusts DFARS-specific dollar thresholds for inflation per 41 U.S.C. 1908. Thresholds adjusted include those for simplified acquisition, Truth in Negotiations Act (TINA) applicability, and various reporting requirements. These are the periodic inflation adjustments required by statute.",
        coImpact: "Check your commonly used thresholds — several dollar values across the DFARS have changed. The TINA threshold, simplified acquisition threshold, and several reporting triggers may have shifted, which affects when certain clauses and requirements kick in."
      }
    ]
  }
];
