// ContractingHQ — GAO Updates Data
// Most recent week is index 0.
// To add a new week: insert a new object at the BEGINNING of this array.
// Fields: caseNumber, caseName, date, outcome (sustained/denied/dismissed),
//         link (URL to GAO decision), summary (digest), bottomLine (verbatim GAO language), takeaway

var GAO_UPDATES = [
  {
    weekOf: "April 20, 2026",
    decisions: [
      {
        caseNumber: "B-423993; B-423993.2",
        caseName: "Effective Communication Strategies, LLC",
        date: "February 18, 2026",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423993,b-423993.2",
        summary: "The Army Corps of Engineers issued a FAR Part 13 simplified acquisition RFQ for replacement appliances at Navy installations, then amended it ten times over several weeks. Amendments carried response deadlines as short as one hour — some issued over weekends — and repeatedly changed substantive technical requirements, including dimensions, Energy Star certification, and TAA compliance. Effective Communication Strategies was found technically unacceptable, in part because the evolving specs kept moving. GAO sustained the protest, finding the agency never gave vendors a reasonable opportunity to respond and that the shifting requirements may have created a de facto brand-name preference for a Turkish-manufactured product.",
        bottomLine: "FAR 5.203(b) and FAR 13.003(h)(2) require contracting officers to afford offerors a reasonable opportunity to respond. The agency's approach did not permit sufficient time to even submit responses to amendments, much less time to sufficiently address the agency's many technical revisions.",
        takeaway: "Even simplified acquisitions have a reasonableness floor on response times. If you are amending a solicitation materially — dimensions, certifications, compliance — extend the response clock accordingly. And when repeated spec changes narrow the field to one product, look hard for a de facto brand-name situation before you award."
      },
      {
        caseNumber: "B-423898; B-423898.2; B-423898.3; B-423898.4",
        caseName: "Amentum Technology Inc.; SOS International LLC",
        date: "January 27, 2026",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423898,b-423898.2,b-423898.3,b-423898.4",
        summary: "The Defense Intelligence Agency awarded a contract to GDIT over Amentum and SOS International. GAO sustained on two grounds. First, DIA held Amentum to a higher standard than GDIT — assigning Amentum a weakness while crediting GDIT with a strength for a comparable, and in places inferior, approach. Second, DIA assigned SOSi a weakness based on a discussion of decommissioned networks that the written record and audio recordings showed SOSi never actually had. The evaluators' notes were not traceable to anything the offeror said.",
        bottomLine: "Unfair treatment exists when an agency fails to treat all offerors equally and evaluate their proposals evenhandedly. The record did not support the weakness assigned to SOSi, and the agency unreasonably failed to explain why substantially similar approaches were treated differently between GDIT and Amentum.",
        takeaway: "Disparate-treatment protests are winnable when the comparison is concrete — same feature, different rating. Keep your evaluators on consistent application of criteria, and make sure every weakness is traceable to something the offeror actually said in the proposal, discussions, or orals. If your audio and transcripts don't back the evaluator's note, that weakness will not survive review."
      }
    ]
  },
  {
    weekOf: "March 24, 2026",
    decisions: [
      {
        caseNumber: "B-423796.2",
        caseName: "Morrish-Wallace Construction, Inc. d/b/a Ryba Marine Construction Co.",
        date: "March 2026",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423796.2",
        summary: "The Army Corps of Engineers issued an IFB for construction of a steel pile offloading platform. The third solicitation amendment updated Davis-Bacon wage determinations and revised plan sheets to increase the size and weight of structural components. The awardee submitted its bid without acknowledging this third amendment. The agency characterized the omission as a minor informality and awarded the contract anyway, noting the price impact was only about $21,000 (roughly 1.1% of contract value). GAO sustained the protest, finding the amendment was material because it imposed new requirements not in the original solicitation — regardless of the modest dollar impact.",
        bottomLine: "An amendment is material when it imposes legal obligations not contained in the original solicitation. The purpose of acknowledging a solicitation amendment is to bind the bidder to the revised terms. Without acknowledgment, the awardee is not legally obligated to perform under the amended requirements, creating an unequal competitive dynamic where the awardee could accept or reject amended terms post-award while all other bidders were already bound.",
        takeaway: "Never waive a missing amendment acknowledgment just because the price impact looks small. If the amendment changed substantive requirements — wage rates, specs, scope — it is material and the failure to acknowledge it is not a minor informality. Document the materiality analysis in your contract file."
      },
      {
        caseNumber: "B-423744; B-423744.2; B-423744.3",
        caseName: "Tiger Natural Gas, Inc.",
        date: "December 2025",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423744,b-423744.2,b-423744.3",
        summary: "DLA produced a heavily redacted protest record in which proposal and evaluation documents showed only offeror names and overall ratings — no substantive evaluation detail. The agency provided a generic technical evaluator declaration with minimal insight into the contemporaneous evaluation. GAO sustained the protest, finding that the redactions were so severe that nothing useful could be gleaned from the record and that the agency had essentially shielded its evaluation from meaningful review.",
        bottomLine: "Nothing more than the mere existence of documents can be gleaned from such limited disclosure. Protective orders adequately safeguard sensitive information, eliminating 'fishing expedition' concerns. Agencies must provide sufficient records enabling GAO to assess the reasonableness of the evaluation.",
        takeaway: "Agencies cannot hide behind over-redaction to avoid scrutiny. If you're defending a protest, produce a meaningful record under a protective order rather than blanket-redacting everything. GAO will sustain a protest when it literally cannot review the agency's evaluation reasoning."
      },
      {
        caseNumber: "B-423785",
        caseName: "Solvere Technical Group, LLC",
        date: "December 2025",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423785",
        summary: "The Navy's NSWC solicitation for a task order under an IDIQ contract explicitly permitted 'TBD' designations for non-key staffing positions. Solvere complied by marking several non-key positions TBD. Evaluators then assigned a significant weakness, criticizing Solvere for not minimizing TBD usage — even though the solicitation said nothing about limiting it. Worse, in a prior task order under the same IDIQ, the Navy had argued the exact opposite interpretation of identical language. GAO sustained the protest.",
        bottomLine: "The agency's evaluation was unreasonable where it penalized the protester for following the plain language of the solicitation. Agencies cannot apply unstated evaluation criteria or adopt interpretations inconsistent with the solicitation's plain language and contrary to the agency's own prior interpretation of identical language.",
        takeaway: "Write your evaluation criteria to mean what you actually intend to evaluate. If you allow 'TBD' for non-key positions, you cannot later penalize an offeror for using that exact allowance. Consistency across procurements under the same vehicle is critical — GAO will look at how you interpreted the same language before."
      },
      {
        caseNumber: "B-423427.2",
        caseName: "Think Tank, Inc.",
        date: "January 2026",
        outcome: "dismissed",
        link: "https://www.gao.gov/products/b-423427.2",
        summary: "Think Tank's counsel attempted to upload comments on the agency report at 5:28 PM Eastern — two minutes before the 5:30 PM deadline — and encountered a file name error. After a password reset and resubmission, the filing arrived minutes late. Think Tank argued technical difficulties should excuse the delay. GAO dismissed the protest entirely, characterizing the last-minute filing attempt as an 'imprudent decision' and reaffirming that technical problems caused by waiting until the final minutes do not excuse untimely filing.",
        bottomLine: "Last-minute issues caused by waiting until minutes before the deadline do not excuse untimely filing. GAO's filing deadlines are strictly enforced and technical difficulties encountered during last-minute submission attempts are not grounds for relief.",
        takeaway: "GAO's 5:30 PM deadline is a hard wall — not a suggestion. If you are filing anything at GAO, build in a buffer. Technical glitches, password resets, and upload errors will not save you. File early or risk losing your protest entirely."
      },
      {
        caseNumber: "B-423689",
        caseName: "Castro & Company, LLC",
        date: "November 13, 2025",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423689",
        summary: "Castro protested the FEC's award of a financial management and accounting services BPA to CME, alleging an impaired objectivity OCI. CME simultaneously held an acquisition support services contract with FEC, and a CME employee had directly supported the source selection authority for this very procurement. The contracting officer claimed to have identified the conflict and implemented mitigations — firewalling the employee, restricting access to materials, and preventing uploads to shared drives. GAO sustained, finding the investigation was superficial and the mitigations addressed the wrong type of OCI.",
        bottomLine: "The contracting officer failed to conduct a meaningful investigation or to contemporaneously document her consideration of the organizational conflict of interest. The implemented safeguards appeared designed to address an unequal access OCI rather than the impaired objectivity concern actually raised by the protester.",
        takeaway: "When someone raises an impaired objectivity OCI, your investigation and mitigation plan must actually address impaired objectivity — not just unequal access. Document exactly what factors you considered, how you analyzed the specific conflict alleged, and why your mitigation actually resolves it. A boilerplate firewall is not enough."
      },
      {
        caseNumber: "B-423366; B-423366.3; B-423366.4",
        caseName: "DirectViz Solutions, LLC",
        date: "June 11, 2025",
        outcome: "sustained",
        link: "https://www.gao.gov/products/b-423366,b-423366.3,b-423366.4",
        summary: "DirectViz challenged the Army's award of a cybersecurity task order to Peraton for the Global Cyber Center. Peraton simultaneously held an ARCYBER task order under which it helped develop SOPs, reviewed vulnerabilities, and reported on subordinate units' performance. The GCC task order then required Peraton to implement those same policies — effectively positioning Peraton to both shape and execute the same standards. The Army relied on high-level declarations without analyzing actual contract duties. GAO sustained, finding the dual roles created a real risk of self-evaluation.",
        bottomLine: "Peraton's dual roles created a real risk that it would be evaluating or shaping its own work. The agency unreasonably failed to meaningfully consider whether the work Peraton was required to perform under both task orders would impair its ability to provide objective and unbiased services.",
        takeaway: "When the same contractor writes the rules and then performs under them, that is textbook impaired objectivity. COs must dig into the actual performance work statements of both contracts — not rely on high-level declarations that everything is fine. If contractor A develops the standards and contractor A implements them, you have an OCI problem."
      }
    ]
  },
  {
    weekOf: "March 10, 2026",
    decisions: [
      {
        caseNumber: "B-424134",
        caseName: "Information Technology Strategies, Inc.",
        date: "March 10, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-424134",
        summary: "DLA issued a task order solicitation for Oracle EBS R12.2 support services and required key personnel to have 5\u201310 years of platform-specific experience. IT-Strat protested that the requirements were unduly restrictive and unfairly favored the incumbent. GAO denied the protest because the agency documented exactly why each position demanded R12.2 knowledge \u2014 then dismissed the remaining challenges entirely because IT-Strat had already submitted a non-compliant quote, stripping it of interested party standing.",
        bottomLine: "Protest that solicitation\u2019s experience requirements for key personnel are overly restrictive is denied where agency has provided a rational explanation for the requirements and demonstrated that they reasonably relate to the agency\u2019s needs. Protester is not an interested party to challenge additional aspects of the procurement where the firm acknowledges that it submitted a noncompliant quotation.",
        takeaway: "Document the operational why behind every key personnel requirement \u2014 GAO will uphold restrictions tied to specific performance risks, and a vendor that submits a non-compliant quote loses its right to protest anything else."
      },
      {
        caseNumber: "B-423938; B-423938.2",
        caseName: "Dentrust Dental International, Inc. d/b/a DOCS Health",
        date: "February 6, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-423938,b-423938.2",
        summary: "The Secret Service awarded a medical examination services contract to Acuity over Dentrust, rating Dentrust Some Confidence on technical capability because its cloud-based records system lacked its own FedRAMP authorization \u2014 even though it ran on a FedRAMP-authorized hosting platform. Dentrust alleged disparate treatment, pointing to a favorable phase-one comment. GAO denied: the RFP was clear that cloud solutions required FedRAMP authorization for the application itself, not just the hosting environment, while non-cloud solutions like Acuity\u2019s only needed an ATO.",
        bottomLine: "Protest challenging the agency\u2019s evaluation of proposals is denied where the agency\u2019s evaluation was reasonable, adequately documented, and in accordance with the terms of the solicitation; to the extent any errors were made, such errors were not competitively prejudicial to the protester. Protest that the agency engaged in disparate treatment in evaluating proposals is denied where the record shows that the agency\u2019s evaluation was reasonable and the differences in ratings were based on differences in the proposals.",
        takeaway: "When your solicitation permits both cloud and non-cloud solutions, write explicit and distinct security requirements for each path \u2014 FedRAMP for cloud, ATO for non-cloud \u2014 so there is no ambiguity in evaluation and no room for a disparate-treatment challenge."
      }
    ]
  }
];
