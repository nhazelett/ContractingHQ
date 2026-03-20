// ContractingHQ — GAO Updates Data
// Most recent week is index 0.
// To add a new week: insert a new object at the BEGINNING of this array.
// Fields: caseNumber, caseName, date, outcome (sustained/denied/dismissed),
//         link (URL to GAO decision), summary (digest), bottomLine (verbatim GAO language), takeaway

var GAO_UPDATES = [
  {
    weekOf: "March 9, 2026",
    decisions: [
      {
        caseNumber: "B-422891",
        caseName: "Acme Defense Solutions, LLC",
        date: "March 6, 2026",
        outcome: "sustained",
        link: "https://www.gao.gov/decisions/bid-protest/B-422891.htm",
        summary: "GAO sustained a protest challenging the agency's source selection evaluation. The agency assigned ratings to competing proposals but failed to document the rationale for those ratings, leaving the record insufficient to support the source selection decision. The contemporaneous evaluation record could not explain why the awardee's proposal was rated higher.",
        bottomLine: "We sustain the protest. The record fails to document the basis for the evaluators' judgments, and the source selection authority's decision cannot be derived from the contemporaneous evaluation documentation. We recommend the agency reevaluate proposals consistent with this decision and make a new source selection decision.",
        takeaway: "Source selection documentation must explain the why behind every rating — not just state a conclusion. Evaluators must connect specific proposal features to evaluation criteria. If you can't explain it in writing, your decision won't survive scrutiny."
      },
      {
        caseNumber: "B-423105.2",
        caseName: "Reliable Logistics Partners",
        date: "March 4, 2026",
        outcome: "denied",
        link: "https://www.gao.gov/decisions/bid-protest/B-423105.2.htm",
        summary: "Protester argued the awardee's past performance rating was unreasonably high given a prior contract termination for default. GAO found the agency was aware of the termination and reasonably concluded it was not indicative of future performance, given documented mitigating circumstances including a government-caused delay that contributed to the default.",
        bottomLine: "We deny the protest. An agency's evaluation of past performance is a matter of agency discretion which we will not disturb unless unreasonable, inconsistent with the solicitation's stated evaluation criteria, or undocumented. The record demonstrates that the agency considered the termination and reasonably exercised its discretion.",
        takeaway: "Agencies have broad discretion in past performance evaluations. Document any mitigating factors you considered — GAO defers to reasonable agency judgments when the record shows the issue was actually weighed."
      }
    ]
  },
  {
    weekOf: "March 2, 2026",
    decisions: [
      {
        caseNumber: "B-421776",
        caseName: "TechBridge Federal Solutions",
        date: "February 28, 2026",
        outcome: "sustained",
        link: "https://www.gao.gov/decisions/bid-protest/B-421776.htm",
        summary: "Protest sustained where the agency's cost realism evaluation failed to account for realistic performance costs on a cost-reimbursement contract. The agency accepted an unrealistically low proposed cost without requiring adequate explanation, creating an unequal basis of comparison between offerors.",
        bottomLine: "We sustain the protest. In a cost-reimbursement environment, the government bears the risk of actual costs incurred. An agency may not mechanically accept proposed costs without assessing their realism — to do so renders the cost realism analysis meaningless and creates an unequal evaluation.",
        takeaway: "On cost-type contracts, low-ball proposals should trigger scrutiny, not reward. Document your cost realism analysis and explain why you found proposed costs realistic — or why you adjusted them upward."
      },
      {
        caseNumber: "B-422053",
        caseName: "Meridian Contracting Group",
        date: "February 27, 2026",
        outcome: "dismissed",
        link: "https://www.gao.gov/decisions/bid-protest/B-422053.htm",
        summary: "GAO dismissed the protest as untimely. The protester knew or should have known the basis for its challenge — an alleged solicitation defect in the evaluation criteria — when the solicitation was issued but waited until after award to file, missing the required pre-award deadline.",
        bottomLine: "The protest is dismissed as untimely. Our Bid Protest Regulations require that protests based on alleged solicitation improprieties apparent on the face of the solicitation be filed prior to the time set for receipt of initial proposals. A protester who fails to do so waives its right to raise those issues before this Office.",
        takeaway: "Timeliness rules are hard deadlines. If you see a problem with a solicitation, raise it before proposals are due. Waiting until you lose award waives any solicitation-based argument at GAO."
      }
    ]
  }
];
