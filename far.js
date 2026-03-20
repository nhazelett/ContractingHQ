// ContractingHQ — GAO Decision Data
// Updated weekly. Most recent week is index 0.
// Outcome options: "Sustained" | "Denied" | "Dismissed"

const GAO_UPDATES = [
  {
    weekOf: "March 17, 2025",
    decisions: [
      {
        caseNumber: "B-422891",
        caseName: "Acme Defense Solutions, LLC",
        date: "March 14, 2025",
        outcome: "Sustained",
        summary: "GAO sustained a protest challenging an agency's evaluation of the awardee's technical proposal. The agency failed to document its rationale for assigning strengths, leaving the record insufficient to support its source selection decision.",
        takeaway: "Your source selection documentation needs to explain the *why* behind every strength and weakness assigned. A bare conclusion isn't enough — evaluators must connect specific proposal features to evaluation criteria. If you can't explain it in writing, your decision won't survive scrutiny."
      },
      {
        caseNumber: "B-423105.2",
        caseName: "Reliable Logistics Partners",
        date: "March 12, 2025",
        outcome: "Denied",
        summary: "Protester argued the awardee's past performance rating was unreasonably high given a prior contract termination for default. GAO found the agency was aware of the termination and reasonably determined it was not indicative of future performance given mitigating circumstances.",
        takeaway: "Agencies have discretion in past performance evaluations. Document any mitigating factors considered — GAO defers to reasonable agency judgments when the record shows the agency actually considered the issue."
      }
    ]
  },
  {
    weekOf: "March 10, 2025",
    decisions: [
      {
        caseNumber: "B-422644",
        caseName: "Pinnacle Technology Group",
        date: "March 7, 2025",
        outcome: "Dismissed",
        summary: "Protest dismissed as untimely. Protester filed more than 10 days after it knew or should have known the basis for protest. Agency's detailed debriefing provided sufficient information to trigger the filing clock.",
        takeaway: "The 10-day protest clock runs from when a protester *knew or should have known* the basis — not just when they confirmed suspicions. Make sure your debriefings are complete and timely; a good debriefing actually reduces protest exposure by starting that clock."
      },
      {
        caseNumber: "B-422988",
        caseName: "BlueStar Systems Inc.",
        date: "March 5, 2025",
        outcome: "Sustained",
        summary: "Agency conducted discussions with the awardee but not the protester, despite the protester being in the competitive range. GAO found the unequal discussions violated FAR 15.306.",
        takeaway: "Once you establish a competitive range and open discussions, you must conduct meaningful discussions with all offerors in the competitive range. Skipping or shortchanging a competitive offeror on discussions is a fast track to a sustained protest."
      }
    ]
  }
];
