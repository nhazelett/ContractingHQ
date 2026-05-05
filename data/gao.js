// ContractingHQ — GAO Updates Data
// Most recent week is index 0.
// To add a new week: insert a new object at the BEGINNING of this array.
// Fields: caseNumber, caseName, date, outcome (sustained/denied/dismissed),
//         link (URL to GAO decision), summary (digest), bottomLine (verbatim GAO language), takeaway

var GAO_UPDATES = [
  {
    weekOf: "May 4, 2026",
    decisions: [
      {
        caseNumber: "B-423821.2; B-423821.3",
        caseName: "J&J Maintenance, Inc., dba J&J Worldwide Services",
        date: "April 20, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-423821.2,b-423821.3",
        summary: "J&J protested the Army Corps of Engineers' award of a task order to King and George (K&G) under the Operation and Maintenance Engineering Enhancement IDIQ MATOC for facilities support at Defense Health Agency sites in Germany, Belgium, and Italy. J&J argued K&G's proposal failed three material requirements: it didn't initiate the Italian anti-mafia white-list registration before final proposals (K&G's Italian counsel had emailed the prefect about registration but submitted the documentation a day after final proposals were due); its organizational chart identified personnel by role/position rather than by name; and it didn't list specific subcontractors. GAO denied — for the white-list issue, contacting the prefect through counsel was a reasonable way to 'initiate' the process; for the org-chart and subcontractor naming claims, the solicitation language was patently ambiguous (waived by failure to challenge pre-bid) and J&J couldn't show competitive prejudice in any event.",
        bottomLine: "Protest alleging that the awardee's proposal failed to meet material requirements of the solicitation is denied where either the agency's evaluation was reasonable or the protester failed to demonstrate any competitive prejudice arising from the agency's waiver or relaxation of solicitation requirements.",
        takeaway: "Two big lessons: write your solicitation in unambiguous language up front — patent ambiguities that aren't challenged before bids close get the protester nothing later. And when an evaluator works from a sanitized proposal that strips company names anyway, missing subcontractor names can't have been material to the evaluation. If you want named subcontractors to matter, say so explicitly in section M and don't sanitize them out of the evaluator's copy."
      },
      {
        caseNumber: "B-423281.4",
        caseName: "Owl International Inc., d/b/a Global, a 1st Flagship Company",
        date: "April 24, 2026",
        outcome: "sustained in part / denied in part",
        link: "https://www.gao.gov/products/b-423281.4",
        summary: "Owl protested the Navy's RFP for the Navy's emergency ship salvage material system and oil/hazardous-substance spill-response program — a single-award IDIQ with a $315M ceiling. The Navy had amended the RFP to remove the FAR 52.222-46 professional compensation evaluation provision, restricted final proposal revisions to cost/price only, and Owl argued the solicitation contained a latent ambiguity. GAO sustained the second ground only — restricting offerors to revising cost/price after a material technical-side amendment was unreasonable when the solicitation itself warned that proposals could be rejected if cost/price was inconsistent with the technical proposal. The other two grounds were denied.",
        bottomLine: "1. Protest that agency improperly removed provision from solicitation providing for the evaluation of professional compensation is denied where the record showed a reasonable basis for the agency's determination that performance of the requirement would not require meaningful numbers of professional employees. 2. Protest that agency unreasonably restricted offerors to revising only their cost/price proposals is sustained where the record shows the effect of amending the solicitation to remove the evaluation of professional compensation would have a material impact on aspects of an offeror's technical proposal and where the solicitation provided that a proposal could be rejected if the cost/price proposal was inconsistent with the technical proposal. 3. Protest that the solicitation contained a latent ambiguity is denied where the terms of the solicitation were subject to only one reasonable reading.",
        takeaway: "When a corrective-action amendment changes the technical evaluation regime — even by removing a single provision — give offerors a chance to revise their technical proposals, not just price. Locking offerors to price-only revisions while their technical approach is now misaligned creates the very inconsistency your own RFP threatens to reject."
      },
      {
        caseNumber: "B-424221",
        caseName: "Threat Tec, LLC",
        date: "April 23, 2026",
        outcome: "dismissed",
        link: "https://www.gao.gov/products/b-424221",
        summary: "Threat Tec, the prior incumbent's joint-venture parent, protested an Army Transformation and Training Command sole-source bridge contract awarded to Chitra Productions under the SBIR Phase III authority — Chitra had purchased technology assets from a Phase II contractor and the Army awarded as successor-in-interest. Threat Tec's initial protest argued the award violated CICA and the Procurement Integrity Act. After the agency's D&F disclosed the SBIR Phase III rationale on January 28, Threat Tec waited until February 17 to argue Chitra was ineligible — well past the 10-day window in 4 C.F.R. § 21.2(a)(2). GAO dismissed the SBIR-eligibility supplemental as untimely and treated the successor-in-interest follow-on as derivative of an already-untimely argument. The PIA grounds were dismissed as premature and lacking a legally sufficient basis.",
        bottomLine: "1. Protest that the agency improperly issued a sole-source award to another firm under the Small Business Innovation Research program is dismissed as untimely, and the supplemental protest deriving from this untimely protest is also untimely. 2. Protest that the agency violated the Procurement Integrity Act is dismissed as premature and, in any event, lacks a legally sufficient basis.",
        takeaway: "GAO's 10-day clock is not negotiable. When the agency report or D&F first reveals the legal theory the agency used — here, SBIR Phase III successor-in-interest — that's the date the clock starts on a supplemental protest grounded in that theory. Waiting for the full agency report before filing forfeits the argument. On your side: when you make a sole-source award under an unusual authority, document the rationale clearly in the D&F so the basis is findable on day one."
      },
      {
        caseNumber: "B-423066.3",
        caseName: "Bailey's Premier Services, LLC",
        date: "April 15, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-423066.3",
        summary: "Bailey's protested its non-selection for an Air Force CFT LASR multi-award IDIQ for contractor field maintenance services. The Air Force rated Bailey's proposal unacceptable under the Small Business Participation Commitment Document subfactor because Bailey's placed the SBPCD in a different volume of the proposal rather than the technical volume — and the RFP explicitly stated the technical volume would be evaluated stand-alone, with information not in the technical volume 'assumed to have been omitted.' Bailey's argued the agency should have considered its proposal 'as a whole.' GAO denied — the solicitation language was unambiguous, and disagreement with a reasonable evaluation is not enough.",
        bottomLine: "Protest challenging the agency's evaluation of the protester's proposal is denied where the evaluation was reasonable and in accordance with the terms of the solicitation.",
        takeaway: "If your RFP says the technical volume is evaluated stand-alone and missing information will be treated as omitted, the agency can take you at your word. For COs, this is a useful reminder to be explicit about volume-by-volume evaluation rules — and to enforce them consistently. For offerors reading along: file your documents in the volume the RFP says they belong in, even if you think the substance is also visible elsewhere."
      },
      {
        caseNumber: "B-422717.4; B-422717.5",
        caseName: "KriaaNet, Inc.",
        date: "April 23, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-422717.4,b-422717.5",
        summary: "Treasury's Bureau of Engraving and Printing terminated KriaaNet's task order for default after the firm failed to deliver five of its proposed key personnel within the required timeframe. BEP then reprocured the same security-systems O&M services from LBO Technology under the same RFQ structure. KriaaNet protested the reprocurement on multiple grounds — that BEP needed a new J&A, that LBO's proposal had impermissibly changed, and that the reprocurement should have been re-competed beyond the original offerors. GAO denied — the agency's reprocurement approach was consistent with FAR 49.402-6 and applicable FSS procedures.",
        bottomLine: "Protest challenging the agency's issuance of a reprocurement task order is denied where the record reflects that the agency's approach was consistent with applicable requirements.",
        takeaway: "After a default termination, the FAR gives you broad latitude to reprocure — including from a prior offeror under the original solicitation — without restarting the competition from scratch. Document the reprocurement rationale and tie it to FAR 49.402-6, and the protest record will support you. The harder lesson is upstream: a defaulted contractor protesting its own reprocurement rarely wins, but it can still slow you down. Stay disciplined on cure-notice timing and make sure the default determination is well-supported."
      }
    ]
  },
  {
    weekOf: "April 27, 2026",
    decisions: [
      {
        caseNumber: "B-424243; B-424243.2",
        caseName: "SupplyCore, Inc.",
        date: "April 9, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-424243,b-424243.2",
        summary: "GSA awarded an IDIQ contract for logistics operations support services in Japan to Amentum Services over the incumbent SupplyCore. SupplyCore challenged the operational quality assurance evaluation on two grounds: that GSA failed to document why specific proposal features were not assigned strengths, and that GSA unreasonably penalized SupplyCore for submitting its supporting warehouse lease in Japanese without an English translation. GAO denied. The agency's evaluation was adequately documented because it described what proposal material it considered under each component, and an agency is not required to explain why a feature was merely adequate. GAO also held that GSA could reasonably require English-language supporting documents in a procurement conducted entirely in English, even though the RFP did not expressly say so.",
        bottomLine: "Protest that the agency unreasonably evaluated proposals is denied where the record shows the evaluation was reasonable and consistent with the terms of the solicitation and applicable procurement statutes and regulations.",
        takeaway: "Two CO points. First, you only have to document the reasoning behind strengths, weaknesses, and deficiencies — not why a feature was 'merely adequate.' GAO's recent Island Peer Review (IPRO) decision does not change this; that case turned on the agency's evaluation conclusion not being supported by the proposal text it cited. Second, even when an RFP does not expressly require English-language supporting documents, GAO will read that requirement into a procurement conducted entirely in English. If you ever face this issue, document the inference in writing."
      },
      {
        caseNumber: "B-424392",
        caseName: "Metro East Joint Venture, LLC",
        date: "April 21, 2026",
        outcome: "dismissed",
        link: "https://www.gao.gov/products/b-424392",
        summary: "HHS/CDC issued a sole-source contract modification extending Chenega Global Protection's incumbent guard services contract at the CDC's Atlanta and Fort Collins campuses. Metro East challenged the modification as contrary to law and alleged organizational conflicts of interest, and also argued the agency had unduly delayed implementing corrective action from a prior protest. GAO dismissed as untimely — the protest was filed more than 10 days after CDC posted the original sole-source notice that disclosed the option period under challenge.",
        bottomLine: "Protest challenging the agency's issuance of a contract modification that exercises an option period under the incumbent sole-source contract is dismissed as untimely where the protest was filed more than 10 days after the agency posted the original notice indicating that the agency could exercise the option period under challenge and the protester failed to timely challenge the inclusion of the option.",
        takeaway: "When your sole-source notice discloses an option period, the 10-day protest clock for challenging that option starts running from the original notice — not from the day you eventually exercise the option. For COs: when you publish a sole-source J&A, list every option period clearly. That clarity protects your later option exercise from collateral attack."
      },
      {
        caseNumber: "B-419947.4",
        caseName: "Harper Construction Company, Inc.—Reconsideration",
        date: "April 15, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-419947.4",
        summary: "Harper Construction requested reconsideration of GAO's earlier denial of its protest concerning a Navy NAVFAC task order to Clark Construction for repairs to five bachelor enlisted quarters. Harper argued GAO had erred in the underlying decision. GAO denied the reconsideration request, finding Harper had not shown any error of fact or law warranting reversal or modification.",
        bottomLine: "Request for reconsideration is denied where the requester has not shown that our prior decision contained an error of fact or law warranting reversal or modification.",
        takeaway: "Reconsideration at GAO is a narrow remedy. You need a real error of fact or law in the prior decision — not a different framing of the same arguments. If your protest is denied, file a reconsideration request only when you can point to something the original decision got demonstrably wrong."
      },
      {
        caseNumber: "B-423066.2",
        caseName: "LOGMET LLC",
        date: "April 15, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-423066.2",
        summary: "LOGMET, a service-disabled veteran-owned small business, protested its non-selection for a multiple-award IDIQ for Air Force maintenance services. LOGMET argued the agency unreasonably evaluated its proposal as technically unacceptable and should have conducted discussions to give it an opportunity to cure the deficiency. GAO denied. The evaluation was reasonable and aligned with the RFP's terms, and the solicitation expressly stated the agency intended to make award without discussions.",
        bottomLine: "Protest that the agency should have conducted discussions to allow the protester to cure its proposal's technical unacceptability is denied where the solicitation expressly stated that the agency intended to award without discussions.",
        takeaway: "If your RFP states award will be made without discussions, you do not owe offerors an opportunity to fix unacceptable proposals. Make that intent explicit up front in the solicitation — it preserves your discretion and forecloses post-award arguments that you should have opened discussions to save a non-compliant proposal."
      },
      {
        caseNumber: "B-424040.2; B-424040.3",
        caseName: "Identity One, LLC",
        date: "April 13, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-424040.2,b-424040.3",
        summary: "Identity One challenged the scope of corrective action taken by DHS/Coast Guard in connection with a re-solicitation for hand-held biometric reader hardware, software, and maintenance services. Because of a government shutdown, the original Parroco contract had been substantially performed before Identity One filed its protest, and the agency issued a stop work order on the remaining requirement. GAO denied — re-soliciting only the unperformed remainder was reasonable in those unique circumstances.",
        bottomLine: "Protest challenging the implementation and scope of agency corrective action that includes issuing a new solicitation for only the remainder of the requirement is denied where, due to unique circumstances related to a government shutdown, a substantial portion of the requirement was performed before the protest was filed and the agency issued a stop work order.",
        takeaway: "Agencies have broad discretion to scope corrective action. When circumstances make a full re-competition infeasible — significant performance already complete, shutdowns, etc. — it is permissible to re-solicit only the unperformed remainder. Document the operational reasons for the narrower scope in your contract file; that record is what GAO will look at."
      },
      {
        caseNumber: "B-422249.5",
        caseName: "CSlope Solutions, LLC",
        date: "April 8, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/products/b-422249.5",
        summary: "CSlope requested reconsideration of GAO's December 2025 denial of its protest concerning the Army's task order to JCS Solutions for customer care support services at Arlington National Cemetery. CSlope argued the original decision contained errors of fact and law. GAO denied — the requester did not identify any factual or legal error warranting reversal of the prior decision.",
        bottomLine: "Request for reconsideration is denied where the requester has not shown that our prior decision contains an error of fact or law warranting reversal or modification.",
        takeaway: "Same narrow standard as Harper above. If you are a CO defending an awarded contract that survived a protest, a reconsideration request is unlikely to disturb the original outcome unless the protester points to a genuine error in GAO's analysis."
      }
    ]
  },
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
