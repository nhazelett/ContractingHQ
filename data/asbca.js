/* ============================================================
   ASBCA Decisions Digest
   Updated: April 20, 2026
   Pattern: newest digest at index 0, older digests pushed down.
   Nothing is ever deleted — old digests stay for the archive.
   ============================================================ */

var ASBCA_DECISIONS = [
  {
    weekOf: "March 2026",
    intro: "This month's ASBCA digest covers six decisions from February and March 2026 — including a constructive termination win for a contractor at Malmstrom AFB, a motion for reconsideration denied on a failed delivery case, several jurisdictional rulings that remind COs how standing and claim requirements work at the Board, and a USACE construction case where the Board refused to let a bilateral modification sweep away a separate delay claim.",
    decisions: [
      {
        caseNumber: "ASBCA No. 64176",
        caseName: "Group III Management, Inc.",
        date: "March 2, 2026",
        judge: "Laufgraben",
        outcome: "procedural",
        decisionType: "Non-Dispositive (Motion to Dismiss / Summary Judgment)",
        link: "https://www.asbca.mil/Portals/143/Decisions/2026/64176%20Group%20III%20Mgt%203.2.26%20Decision.pdf",
        summary: "USACE awarded Group III a firm-fixed-price contract for construction at the Berkeley Gate Entry Control Point at Seymour Johnson AFB. During performance, a drainage design defect triggered a change, but USACE's funding process pushed the modification past the date Group III had assumed in its proposal. The parties later signed Modification P00003, which added 115 days and $515,693 and recited that the adjustment was compensation in full for the drainage-revision work. Group III then submitted an 84-day claim for the issuing delay — the gap between the assumed and actual modification dates — and USACE moved to dismiss on jurisdictional grounds and, alternatively, argued accord and satisfaction.",
        bottomLine: "USACE's motion to dismiss for lack of jurisdiction and for failure to state a claim, and for summary judgment, is denied. The Contracting Officer's January 9, 2023 letter — treating additional delays of funding as a separate issue — and the parties' continued consideration of the issuing-delay claim after Modification P00003 raise genuine fact issues about whether the parties intended the modification to cover that claim, and an accord and satisfaction defense cannot be resolved on summary judgment when intent is disputed.",
        takeaway: "A closing-statement \"compensation in full\" clause does not automatically swallow every adjacent claim — especially when the CO has said in writing that the delay is a separate issue. If you are signing a bilateral mod for an underlying scope change, either explicitly release the adjacent delay claims in the mod text or expect the contractor to pursue them later. And once the mod is signed, stop negotiating the claim if you actually intend the release to end it — continued negotiations will be held against you on intent."
      },
      {
        caseNumber: "ASBCA No. 64008-ADR",
        caseName: "Allserv, Inc.",
        date: "March 2, 2026",
        judge: "Cates-Harman",
        outcome: "sustained",
        decisionType: "Summary Binding Decision (ADR)",
        link: "https://www.asbca.mil/Decisions/",
        summary: "The Air Force awarded Allserv a commercial item contract for ground maintenance services at Malmstrom Air Force Base (contract FA4626-23-D-0002). Allserv claimed the government constructively terminated the contract and related task orders for convenience. The government argued the contractor waived its claim and that bilateral modifications constituted an accord and satisfaction. The Board found the government failed to meet its burden of proof on both defenses.",
        bottomLine: "Appeal sustained. The Board held there was a constructive termination for convenience. Allserv is entitled to further compensation under FAR 52.212-4. The Board will resolve quantum in a separate proceeding.",
        takeaway: "If a contractor is effectively pushed off a contract without a formal termination notice, that can be a constructive T4C — and the CO's office is on the hook for termination settlement costs. Make sure any actions that effectively end contract performance are documented and processed through proper termination channels. Also note: bilateral mods don't automatically create accord and satisfaction unless the language is airtight."
      },
      {
        caseNumber: "ASBCA No. 64309",
        caseName: "Paragon Defense Solutions, Inc.",
        date: "March 2, 2026",
        judge: "McIlmail",
        outcome: "denied",
        decisionType: "Motion for Reconsideration",
        link: "https://www.asbca.mil/Decisions/",
        summary: "Paragon Defense Solutions had a DLA contract (SPE7L1-23-P-1551) to deliver 225 locks. The company failed to deliver 150 of the 225 locks by the government's unilateral purchase order delivery date of May 5, 2023. The Board previously ruled under Board Rule 12.2 that no completed purchase and sale contract came into existence for those 150 locks. Paragon moved for reconsideration, essentially rearguing the same case it made before the original decision.",
        bottomLine: "Motion for reconsideration denied. The Board found the appellant simply reargued its original position without presenting any new arguments or evidence warranting reconsideration.",
        takeaway: "Once the Board rules, a motion for reconsideration is not a second bite at the apple — you need genuinely new arguments or evidence. For COs: if a vendor can't deliver by the contract date and there's no extension, the Board may find no contract existed for the undelivered items. Document delivery failures carefully and issue timely cure or show-cause notices."
      },
      {
        caseNumber: "ASBCA No. 64165",
        caseName: "Racer Machinery International / Canadian Commercial Corporation",
        date: "February 27, 2026",
        judge: "Melnick",
        outcome: "procedural",
        decisionType: "Non-Dispositive (Jurisdictional)",
        link: "https://www.asbca.mil/Decisions/",
        summary: "DLA awarded a contract to the Canadian Commercial Corporation (CCC) — a Canadian Crown corporation that acts as prime contractor when the U.S. buys from Canadian suppliers — to provide CNC machines made by Racer Machinery International. After Racer failed to deliver a conforming product, the government issued a show-cause letter addressed to both Racer and CCC. Racer filed the appeal directly, raising a jurisdictional question about who had standing.",
        bottomLine: "Racer Machinery International dismissed as appellant for lack of jurisdiction; Canadian Commercial Corporation substituted as appellant. Because CCC held the prime contract, Racer lacked privity of contract with the government and could not appeal independently.",
        takeaway: "Only the entity with privity of contract with the U.S. government can file a CDA appeal. In government-to-government arrangements (like contracts through CCC for Canadian suppliers), the foreign subcontractor cannot appeal directly — only the prime (CCC) can. If you issue show-cause letters, be precise about who holds the contract and who is merely the supplier."
      },
      {
        caseNumber: "ASBCA Nos. 61708-ADR, 61641-ADR, 61642-ADR",
        caseName: "Penna Group, LLC",
        date: "February 20, 2026",
        judge: "Panel",
        outcome: "dismissed",
        decisionType: "Jurisdictional",
        link: "https://www.asbca.mil/Decisions/",
        summary: "After the Board dismissed this case based on a represented settlement, a court-appointed receiver challenged the settlement agreement, claiming the company's owner lacked authority to settle and had hidden the receivership from the Board. The receiver asked the Board to reopen the case.",
        bottomLine: "Board determined it lacked jurisdiction over third-party challenges to settlements. State court holds exclusive jurisdiction over receivership issues and the validity of actions taken by the company's owner.",
        takeaway: "Once a case is settled and dismissed at the Board, it's extremely difficult to reopen — even when a third party (like a receiver) claims the settlement was unauthorized. COs should verify that the person signing a settlement agreement actually has authority to bind the contractor. If the contractor is in receivership or bankruptcy, check with legal before finalizing any settlements."
      },
      {
        caseNumber: "ASBCA No. 64346",
        caseName: "Lift Up Trucking, LLC",
        date: "January 27, 2026",
        judge: "Panel",
        outcome: "dismissed",
        decisionType: "Jurisdictional",
        link: "https://www.asbca.mil/Decisions/",
        summary: "Lift Up Trucking requested specific performance from the Board regarding tick infestation remediation at a contract work site. The contractor admitted it had not performed the required services but still claimed entitlement to payment. The Board examined whether it had jurisdiction over the claim.",
        bottomLine: "Dismissed for lack of jurisdiction. The Board found no sum certain in the claim and no entitlement to payment for work the contractor admitted it never performed. The Board cannot order specific performance.",
        takeaway: "Two important reminders here: (1) The ASBCA cannot order specific performance — it can only award money damages. Contractors who want the government to do something (rather than pay something) need a different forum. (2) A CDA claim must state a sum certain — a specific dollar amount. If the contractor can't say exactly how much they're owed, the claim is jurisdictionally defective."
      },
      {
        caseNumber: "ASBCA Nos. 63933, 63934",
        caseName: "Sierra Nevada Corporation",
        date: "February 24, 2026",
        judge: "Thrasher",
        outcome: "sustained",
        decisionType: "Consent Judgment",
        link: "https://www.asbca.mil/Decisions/",
        summary: "Sierra Nevada Corporation appealed contract disputes to the ASBCA. Rather than litigate, the parties negotiated a resolution and jointly submitted a consent judgment for the Board to enter.",
        bottomLine: "Appeals sustained by consent judgment in favor of Sierra Nevada Corporation in the amount of $53,288, inclusive of Contract Disputes Act interest.",
        takeaway: "Not every Board case goes to trial. ADR and negotiated consent judgments are very common — in FY 2025, 100% of cases diverted to ADR at the ASBCA were successfully resolved. If you have a dispute heading to the Board, consider whether a negotiated resolution might be faster and cheaper than full litigation."
      }
    ]
  }
];
