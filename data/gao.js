// ContractingHQ — GAO Updates Data
// Most recent week is index 0.
// To add a new week: insert a new object at the BEGINNING of this array.
// Fields: caseNumber, caseName, date, outcome (sustained/denied/dismissed),
//         link (URL to GAO decision), summary (digest), bottomLine (verbatim GAO language), takeaway

var GAO_UPDATES = [
  {
    weekOf: "March 10, 2026",
    decisions: [
      {
        caseNumber: "B-424134",
        caseName: "Information Technology Strategies, Inc.",
        date: "March 10, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-424134",
        summary: "DLA issued a task order solicitation for Oracle EBS R12.2 support services and required key personnel to have 5–10 years of platform-specific experience. IT-Strat protested that the requirements were unduly restrictive and unfairly favored the incumbent. GAO denied the protest because the agency documented exactly why each position demanded R12.2 knowledge — then dismissed the remaining challenges entirely because IT-Strat had already submitted a non-compliant quote, stripping it of interested party standing.",
        bottomLine: "Protest that solicitation's experience requirements for key personnel are overly restrictive is denied where agency has provided a rational explanation for the requirements and demonstrated that they reasonably relate to the agency's needs. Protester is not an interested party to challenge additional aspects of the procurement where the firm acknowledges that it submitted a noncompliant quotation.",
        takeaway: "Document the operational why behind every key personnel requirement — GAO will uphold restrictions tied to specific performance risks, and a vendor that submits a non-compliant quote loses its right to protest anything else."
      },
      {
        caseNumber: "B-423938; B-423938.2",
        caseName: "Dentrust Dental International, Inc. d/b/a DOCS Health",
        date: "February 6, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-423938,b-423938.2",
        summary: "The Secret Service awarded a medical examination services contract to Acuity over Dentrust, rating Dentrust Some Confidence on technical capability because its cloud-based records system lacked its own FedRAMP authorization — even though it ran on a FedRAMP-authorized hosting platform. Dentrust alleged disparate treatment, pointing to a favorable phase-one comment. GAO denied: the RFP was clear that cloud solutions required FedRAMP authorization for the application itself, not just the hosting environment, while non-cloud solutions like Acuity's only needed an ATO.",
        bottomLine: "Protest challenging the agency's evaluation of proposals is denied where the agency's evaluation was reasonable, adequately documented, and in accordance with the terms of the solicitation; to the extent any errors were made, such errors were not competitively prejudicial to the protester. Protest that the agency engaged in disparate treatment in evaluating proposals is denied where the record shows that the agency's evaluation was reasonable and the differences in ratings were based on differences in the proposals.",
        takeaway: "When your solicitation permits both cloud and non-cloud solutions, write explicit and distinct security requirements for each path — FedRAMP for cloud, ATO for non-cloud — so there is no ambiguity in evaluation and no room for a disparate-treatment challenge."
      }
    ]
  }
];
