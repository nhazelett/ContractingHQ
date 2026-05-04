(function () {
  'use strict';

  var STORAGE_KEYS = {
    concierge: 'kthq-preflight-concierge',
    saveEnabled: 'kthq-preflight-save-enabled',
    answers: 'kthq-preflight-answers'
  };

  var rules = [];
  var lastResult = null;

  var sections = [
    {
      id: 'basics',
      title: 'Basics',
      desc: 'What are you buying, how big is it, and when does it need to land?',
      questions: [
        {
          id: 'requirementType',
          label: 'Requirement type',
          help: 'Pick the closest lane. Mixed requirements are normal; this just helps the tool choose which checks matter most.',
          options: [
            ['services', 'Services'],
            ['supplies', 'Supplies or equipment'],
            ['construction', 'Construction'],
            ['it', 'IT / software / cyber'],
            ['rd', 'R&D'],
            ['mixed', 'Mixed requirement'],
            ['other', 'Other'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'requirementSubject',
          label: 'Generic subject area',
          help: 'Keep it generic. Do not enter program names, proprietary product names, contractor names, or sensitive mission details.',
          options: [
            ['facility_support', 'Facilities / base support'],
            ['professional_services', 'Professional services'],
            ['it_hardware', 'IT hardware'],
            ['software', 'Software / SaaS'],
            ['cyber', 'Cybersecurity'],
            ['training', 'Training'],
            ['logistics', 'Logistics / sustainment'],
            ['medical', 'Medical'],
            ['construction_repair', 'Construction / repair'],
            ['research', 'Research'],
            ['other', 'Other generic area'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'dollarBand',
          label: 'Estimated dollar range',
          help: 'Bands are safer than exact amounts and good enough for this check. Thresholds reflect the current ordinary MPT of $15K, SAT of $350K, and RFO Part 12 simplified commercial procedures up to $9M.',
          options: [
            ['mpt', '$15K or less'],
            ['10k-350k', '$15K to $350K'],
            ['350k-9m', '$350K to $9M'],
            ['9m-25m', '$9M to $25M'],
            ['25m-plus', '$25M+'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'needDate',
          type: 'date',
          label: 'Need date',
          help: 'Leave blank if the date is TBD. If the package is due yesterday, the results will say so gently enough.'
        },
        {
          id: 'popLength',
          label: 'Period of performance or delivery shape',
          help: 'A period that crosses fiscal years can create funding questions, especially with annual appropriations.',
          options: [
            ['one_time', 'One-time delivery'],
            ['1-3', '1 to 3 months'],
            ['4-12', '4 to 12 months'],
            ['13-36', '13 to 36 months'],
            ['36-plus', 'More than 36 months'],
            ['tbd', 'TBD']
          ]
        },
        {
          id: 'recurring',
          label: 'Recurring or one-time?',
          help: 'Recurring work raises recompete timing, option, incumbent, and continuity questions.',
          options: [
            ['one_time', 'One-time buy'],
            ['recurring', 'Recurring requirement'],
            ['recompete', 'Recompete / follow-on'],
            ['unknown', "I don't know"]
          ]
        }
      ]
    },
    {
      id: 'authority',
      title: 'Authority and Approach',
      desc: 'How you expect to buy it, compete it, and document the path.',
      questions: [
        {
          id: 'commercialDetermination',
          label: 'Commercial product/service support',
          help: 'Under the RFO, commercial products and services use FAR Part 12, including simplified procedures at FAR 12.201-1. FAR Part 13 SAP is for noncommercial actions.',
          options: [
            ['yes', 'Yes - commercial product/service support exists'],
            ['no', 'No - not documented'],
            ['not_applicable', 'No - noncommercial / not a FAR 12 action'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'authorityTrack',
          label: 'Primary authority track',
          help: 'Pick FAR Part 12 for commercial products or services. Pick FAR Part 13 only for noncommercial SAP under the SAT. This does not lock you in; it helps the tool spot documentation gaps.',
          options: [
            ['far8', 'FAR Part 8 / FSS'],
            ['far12', 'FAR Part 12 / commercial, incl. 12.201-1 simplified'],
            ['far13', 'FAR Part 13 / noncommercial SAP only'],
            ['far14', 'FAR Part 14 / sealed bid'],
            ['far15', 'FAR Part 15 / negotiated'],
            ['far16', 'FAR Part 16 / IDIQ or BPA call'],
            ['far36', 'FAR Part 36 / construction'],
            ['other', 'Other'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'competitionApproach',
          label: 'Competition approach',
          help: 'The more restricted the approach, the more the file has to explain why. "Unsure" is common at intake.',
          options: [
            ['full_open', 'Full and open'],
            ['set_aside', 'Set-aside'],
            ['sole_source', 'Sole source'],
            ['brand_name', 'Brand name'],
            ['brand_name_or_equal', 'Brand-name-or-equal'],
            ['fair_opportunity', 'Fair opportunity under IDIQ'],
            ['urgency', 'Urgency'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'smallBusinessConsidered',
          label: 'Small business / set-aside considered?',
          help: 'This is not asking you to force a set-aside. It is asking whether the market research and file show you considered the small business lane.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'contractType',
          label: 'Contract type intent',
          help: 'If you are not sure yet, say so. High-risk contract types need more planning and surveillance thought before solicitation.',
          options: [
            ['ffp', 'Firm-fixed-price'],
            ['ffp_loe', 'FFP level-of-effort'],
            ['tm_lh', 'T&M / labor-hour'],
            ['cost', 'Cost-type'],
            ['idiq', 'IDIQ'],
            ['bpa', 'BPA'],
            ['boa', 'BOA'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'existingVehicle',
          label: 'Existing contract vehicle in mind?',
          help: 'A vehicle can save time, but it still has ordering procedures, scope limits, and fair opportunity rules.',
          options: [
            ['yes', 'Yes'],
            ['maybe', 'Maybe'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        }
      ]
    },
    {
      id: 'quality',
      title: 'Requirement Quality',
      desc: 'Whether the package explains what success looks like before industry sees it.',
      questions: [
        {
          id: 'reqDoc',
          label: 'Requirement document status',
          help: 'Services usually need a PWS, SOW, or SOO path. Supplies need specs, salient characteristics, drawings, or a purchase description.',
          options: [
            ['pws', 'PWS'],
            ['sow', 'SOW'],
            ['soo', 'SOO'],
            ['specs_drawings', 'Specs / drawings'],
            ['purchase_desc', 'Purchase description'],
            ['none', 'None yet'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'independentReview',
          label: 'Independent review completed?',
          help: 'A second set of eyes catches vague outcomes, hidden brand names, missing deliverables, and impossible schedules.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'igce',
          label: 'IGCE status',
          help: 'The IGCE is the government estimate. It is not always glamorous, but it supports funding, price analysis, and negotiation posture.',
          options: [
            ['complete', 'Complete'],
            ['in_progress', 'In progress'],
            ['not_started', 'Not started'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'marketResearch',
          label: 'Market research conducted?',
          help: 'Formal is best, informal is common, none is a warning light. The tool will route you to the KTHQ market research pages when needed.',
          options: [
            ['formal', 'Yes, formal memo'],
            ['informal', 'Informal'],
            ['not_started', 'Not started'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'justification',
          label: 'Justification document status',
          help: 'If the buy is restricted, brand-name, sole-source, or limited-source, the file needs the right justification path.',
          options: [
            ['complete', 'Complete'],
            ['in_progress', 'In progress'],
            ['required_not_started', 'Required, not started'],
            ['not_required', 'Not required'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'acceptanceCriteria',
          label: 'Acceptance criteria defined?',
          help: 'If you cannot tell when the contractor is done, you do not yet have a clean requirement.',
          options: [
            ['yes', 'Yes'],
            ['partial', 'Partially'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'deliverables',
          label: 'Deliverables list defined?',
          help: 'Deliverables are where many vague requirements become real. Reports, products, meetings, data, and deadlines should be visible.',
          options: [
            ['yes', 'Yes'],
            ['partial', 'Partially'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'salientCharacteristics',
          label: 'Salient characteristics / minimum specs documented?',
          help: 'Especially important for supplies, brand-name-or-equal, and commercial-item buys. This is how industry knows what equal means.',
          options: [
            ['yes', 'Yes'],
            ['partial', 'Partially'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'alternativesAnalysis',
          label: 'Alternatives or sources analyzed?',
          help: 'Restricted approaches need a factual record showing what else was considered and why it did not work.',
          options: [
            ['yes', 'Yes'],
            ['partial', 'Partially'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        }
      ]
    },
    {
      id: 'funding',
      title: 'Funding and Schedule',
      desc: 'Money, time, and the uncomfortable place where they collide.',
      questions: [
        {
          id: 'fundingStatus',
          label: 'Funding status',
          help: 'A package can move before funding is perfect, but solicitation and award planning need to be honest about where the money actually is.',
          options: [
            ['fully_funded', 'Fully funded'],
            ['partially_funded', 'Partially funded'],
            ['not_funded', 'Not yet funded'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'colorMoney',
          label: 'Color of money',
          help: 'Different appropriations have different obligation and expense rules. If you do not know the fund type, the tool will route you to the helper.',
          options: [
            ['om', 'O&M'],
            ['procurement', 'Procurement'],
            ['rdte', 'RDT&E'],
            ['milcon', 'MILCON'],
            ['working_capital', 'Working capital'],
            ['other', 'Other'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'obligationFy',
          label: 'Fiscal year posture',
          help: 'For most annual money, the bona fide need and obligation timing matter. Keep this high level.',
          options: [
            ['current', 'Current FY'],
            ['prior', 'Prior-year funds'],
            ['next', 'Next FY funds expected'],
            ['multiple', 'Multiple fiscal years'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'bonaFideNeed',
          label: 'Bona fide need year matches the funds?',
          help: 'If this answer is no or unsure, slow down and get fiscal law help before the package becomes an award problem.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'crossesFiscalYears',
          label: 'Does performance cross fiscal years?',
          help: 'Crossing fiscal years is not automatically wrong. It just means funding details deserve attention.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'paltPlanned',
          label: 'PALT / milestone plan completed?',
          help: 'A clean package can still fail if the timeline is fantasy. KTHQ has a PALT Builder if you need one.',
          options: [
            ['palt_tool', 'Yes, using KTHQ PALT Builder'],
            ['yes', 'Yes, separately'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        }
      ]
    },
    {
      id: 'customer',
      title: 'Customer Side and Surveillance',
      desc: 'The support structure that keeps performance from becoming a mess later.',
      questions: [
        {
          id: 'corStatus',
          label: 'COR status',
          help: 'For many service contracts, the COR is not optional in practice. If nobody can inspect performance, the contract is already shaky.',
          options: [
            ['designated', 'Designated / name on file'],
            ['nominated', 'Nominated'],
            ['not_started', 'Not started'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'corTraining',
          label: 'COR training current?',
          help: 'A named COR who is not trained is still a risk. This is fixable, but catch it before award.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'qasp',
          label: 'Surveillance plan / QASP status',
          help: 'Services need a way to measure performance after award. The better the plan, the fewer surprises later.',
          options: [
            ['yes', 'Exists'],
            ['draft', 'Draft'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'gfpGfi',
          label: 'Government-furnished property or information involved?',
          help: 'GFP and GFI need controls, timing, and contract language. "Unsure" is a real finding, not a bad answer.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'personalServices',
          label: 'Personal services risk?',
          help: 'If contractor personnel will be treated like government employees, stop and examine the structure before solicitation.',
          options: [
            ['concerns', 'Concerns flagged'],
            ['no', 'No concerns'],
            ['unsure', 'Unsure'],
            ['not_applicable', 'Not applicable']
          ]
        },
        {
          id: 'performanceLocation',
          label: 'Primary performance location',
          help: 'Location affects access, surveillance, GFP/GFI, wage determinations, security, and sometimes funding.',
          options: [
            ['govt_site', 'Government site'],
            ['contractor_site', 'Contractor site'],
            ['mixed', 'Mixed'],
            ['tbd', 'TBD']
          ]
        }
      ]
    },
    {
      id: 'risk',
      title: 'Risk Flags',
      desc: 'The items that tend to pull legal, fiscal, technical, or leadership review into the room.',
      questions: [
        {
          id: 'brandFlag',
          label: 'Brand name or brand-name-or-equal involved?',
          help: 'Brand-name language can be fine, but the file needs to show the minimum need and avoid accidental lock-in.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'soleSourceFlag',
          label: 'Single source / sole source involved?',
          help: 'One source means the file must carry the story. Who else was considered, why not, and what authority applies?',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'urgencyFlag',
          label: 'Urgent and compelling?',
          help: 'Urgency does not erase documentation. It changes the path and demands a clean record.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'oci',
          label: 'Known OCI exposure?',
          help: 'Organizational conflicts of interest are much easier to address before solicitation than after proposals arrive.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'novelTerms',
          label: 'Novel terms: data rights, IP, cybersecurity beyond standard, or unusual access?',
          help: 'Unusual terms are not bad. They just need earlier technical, legal, and clause planning.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'publicSensitivity',
          label: 'Public controversy or political sensitivity?',
          help: 'If the buy may attract outside attention, the package needs cleaner documentation and earlier leadership awareness.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'firstTime',
          label: 'First time doing this for the CO or shop?',
          help: 'First-time buys deserve more review. That is not weakness; that is how you avoid learning by protest.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['unknown', "I don't know"]
          ]
        },
        {
          id: 'performanceBond',
          label: 'Construction bond / protection considered?',
          help: 'Construction requirements bring bonding, insurance, wage, site, and safety concerns into the file.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unsure', 'Unsure']
          ]
        },
        {
          id: 'tmCeilingSurveillance',
          label: 'For T&M/LH: ceiling and surveillance approach defined?',
          help: 'T&M and labor-hour work need a ceiling and active surveillance. If this is not T&M/LH, mark not applicable.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unknown', "I don't know"]
          ]
        }
      ]
    }
  ];

  var quickStarts = [
    {
      id: 'commercial-services-under-sat',
      label: 'Commercial services under SAT',
      description: 'Commercial service buy under the SAT where RFO Part 12 simplified procedures may fit and the service requirement still needs shape.',
      presets: {
        requirementType: 'services',
        requirementSubject: 'professional_services',
        dollarBand: '10k-350k',
        commercialDetermination: 'yes',
        authorityTrack: 'far12',
        competitionApproach: 'full_open',
        contractType: 'ffp',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'services-under-sat',
      label: 'Noncommercial services under SAT',
      description: 'Noncommercial services buy under the SAT where FAR Part 13 may apply and a service requirement document is still needed.',
      presets: {
        requirementType: 'services',
        requirementSubject: 'professional_services',
        dollarBand: '10k-350k',
        commercialDetermination: 'not_applicable',
        authorityTrack: 'far13',
        competitionApproach: 'full_open',
        contractType: 'ffp',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'services-above-sat',
      label: 'Services above SAT',
      description: 'Larger services package where commerciality, requirement quality, IGCE, market research, COR, and QASP matter early. Authority depends on whether the service is commercial.',
      presets: {
        requirementType: 'services',
        requirementSubject: 'professional_services',
        dollarBand: '350k-9m',
        commercialDetermination: 'unsure',
        competitionApproach: 'full_open',
        contractType: 'ffp',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'brand-name-supply',
      label: 'Brand-name supply buy',
      description: 'Supply or equipment package where brand restriction, salient characteristics, and justification posture matter. Procedural lane still depends on vehicle and dollar value.',
      presets: {
        requirementType: 'supplies',
        requirementSubject: 'other',
        competitionApproach: 'brand_name',
        contractType: 'ffp',
        reqDoc: 'purchase_desc',
        brandFlag: 'yes',
        soleSourceFlag: 'no',
        justification: 'required_not_started',
        commercialDetermination: 'unsure',
        performanceBond: 'not_applicable',
        qasp: 'not_applicable',
        corStatus: 'not_applicable',
        corTraining: 'not_applicable'
      }
    },
    {
      id: 'open-market-product',
      label: 'Open-market product buy',
      description: 'Competitive commercial product or equipment purchase without a required brand-name lane.',
      presets: {
        requirementType: 'supplies',
        requirementSubject: 'other',
        authorityTrack: 'far12',
        competitionApproach: 'full_open',
        contractType: 'ffp',
        reqDoc: 'purchase_desc',
        brandFlag: 'no',
        soleSourceFlag: 'no',
        justification: 'not_required',
        salientCharacteristics: 'yes',
        performanceBond: 'not_applicable',
        qasp: 'not_applicable',
        corStatus: 'not_applicable',
        corTraining: 'not_applicable',
        commercialDetermination: 'yes'
      }
    },
    {
      id: 'sole-source',
      label: 'Sole-source action',
      description: 'Restricted-source path where justification, alternatives, market research, and approval posture carry the file.',
      presets: {
        competitionApproach: 'sole_source',
        soleSourceFlag: 'yes',
        justification: 'required_not_started',
        alternativesAnalysis: 'partial',
        smallBusinessConsidered: 'yes'
      }
    },
    {
      id: 'gsa-fss-order',
      label: 'GSA / FSS order (FAR 8)',
      description: 'Federal Supply Schedule order pattern with FAR Part 8 ordering logic.',
      presets: {
        authorityTrack: 'far8',
        competitionApproach: 'fair_opportunity',
        contractType: 'ffp',
        existingVehicle: 'yes',
        brandFlag: 'no',
        soleSourceFlag: 'no',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'idiq-task-order',
      label: 'IDIQ task order (FAR 16)',
      description: 'Task or delivery order under an IDIQ/BPA-style vehicle where ordering scope and fair opportunity matter.',
      presets: {
        authorityTrack: 'far16',
        competitionApproach: 'fair_opportunity',
        contractType: 'idiq',
        existingVehicle: 'yes',
        brandFlag: 'no',
        soleSourceFlag: 'no',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'construction',
      label: 'Construction (FAR 36)',
      description: 'Construction package where drawings/specs, bonds, wage, site, and safety issues matter early.',
      presets: {
        requirementType: 'construction',
        requirementSubject: 'construction_repair',
        authorityTrack: 'far36',
        contractType: 'ffp',
        reqDoc: 'specs_drawings',
        qasp: 'draft',
        performanceBond: 'yes',
        commercialDetermination: 'not_applicable'
      }
    },
    {
      id: 'software-saas',
      label: 'Software / SaaS',
      description: 'IT software package where commerciality, cybersecurity, data rights, access, and 508 issues deserve review.',
      presets: {
        requirementType: 'it',
        requirementSubject: 'software',
        authorityTrack: 'far12',
        contractType: 'ffp',
        commercialDetermination: 'yes',
        novelTerms: 'yes',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'recompete',
      label: 'Recompete',
      description: 'Follow-on package where the old file helps, but fresh market research and schedule planning still matter.',
      presets: {
        recurring: 'recompete',
        existingVehicle: 'maybe',
        marketResearch: 'not_started',
        paltPlanned: 'no',
        firstTime: 'no',
        performanceBond: 'not_applicable'
      }
    },
    {
      id: 'it-hardware',
      label: 'IT hardware buy',
      description: 'Commercial IT equipment package where salient characteristics and brand-neutral specs matter.',
      presets: {
        requirementType: 'supplies',
        requirementSubject: 'it_hardware',
        authorityTrack: 'far12',
        contractType: 'ffp',
        reqDoc: 'purchase_desc',
        commercialDetermination: 'yes',
        performanceBond: 'not_applicable',
        qasp: 'not_applicable',
        corStatus: 'not_applicable',
        corTraining: 'not_applicable'
      }
    }
  ];

  var derivedLabels = {
    aboveSAT: 'Estimated dollar range is above the SAT',
    aboveMPT: 'Estimated dollar range is above the micro-purchase threshold',
    over9M: 'Estimated dollar range is over the ordinary commercial simplified procedures ceiling',
    highDollar: 'Estimated dollar range is high-dollar',
    needWithin30: 'Need date is within 30 days',
    needWithin60: 'Need date is within 60 days',
    needWithin90: 'Need date is within 90 days',
    needDatePast: 'Need date is in the past',
    isServices: 'Requirement is services-like',
    isSupplies: 'Requirement is supplies-like',
    isConstruction: 'Requirement is construction-like',
    isIT: 'Requirement is IT/cyber-related',
    hasRequirementDoc: 'A requirement document exists',
    noRequirementDoc: 'No requirement document is selected',
    hasServiceRequirementDoc: 'A services requirement document exists',
    hasSupplyRequirementDoc: 'A supplies requirement document exists',
    fundingNotReady: 'Funding is not ready',
    fundedAndClean: 'Funding and bona fide need posture look clean',
    marketResearchNotDone: 'Market research is not started or unknown',
    marketResearchFormal: 'Formal market research is complete',
    isBrandRelated: 'Brand-name or brand-name-or-equal is involved',
    isSoleRelated: 'Single-source or sole-source path is involved',
    isUrgent: 'Urgency is involved',
    isFairOpportunityException: 'IDIQ path may need fair-opportunity documentation',
    justificationNotReady: 'Justification is not ready',
    annualMoneyCrossFy: 'Annual money crosses fiscal years',
    isHighRiskContractType: 'Contract type has elevated surveillance risk',
    isTMLH: 'Contract type is T&M or labor-hour',
    commercialPathNoSupport: 'FAR Part 12 path lacks commerciality support',
    nonCommercialPathButCommercial: 'FAR Part 13 path conflicts with commerciality support',
    far13AboveSAT: 'FAR Part 13 is selected above the SAT',
    commercialAboveSAT: 'Commercial Part 12 path above SAT needs support',
    needsCor: 'Requirement likely needs COR/surveillance planning',
    noCor: 'COR is not identified',
    noQasp: 'Surveillance plan or QASP is missing'
  };

  var form = document.getElementById('preflightForm');
  var resultsEl = document.getElementById('results');
  var conciergeToggle = document.getElementById('conciergeToggle');
  var saveToggle = document.getElementById('saveToggle');
  var runBtn = document.getElementById('runBtn');
  var resetBtn = document.getElementById('resetBtn');
  var startBtn = document.getElementById('startBtn');
  var quickStartSelect = document.getElementById('quickStartSelect');
  var quickStartDesc = document.getElementById('quickStartDesc');
  var clearQuickStartBtn = document.getElementById('clearQuickStartBtn');
  var quickStartState = null;

  init();

  function init() {
    renderQuestions();
    renderQuickStarts();
    restorePreferences();
    loadSavedAnswers();
    wireEvents();
    loadRules();
  }

  function renderQuestions() {
    form.innerHTML = sections.map(function (section, index) {
      return '<details class="preflight-section" id="section-' + escapeAttr(section.id) + '" open>' +
        '<summary>' +
          '<span class="section-title-line">' +
            '<span class="section-kicker">Section ' + (index + 1) + '</span>' +
            '<span class="section-heading">' + escapeHtml(section.title) + '</span>' +
            '<span class="section-desc">' + escapeHtml(section.desc) + '</span>' +
          '</span>' +
          '<span class="section-chevron" aria-hidden="true">&#9660;</span>' +
        '</summary>' +
        '<div class="question-grid">' + section.questions.map(renderQuestion).join('') + '</div>' +
      '</details>';
    }).join('');
  }

  function renderQuickStarts() {
    if (!quickStartSelect) return;
    quickStartSelect.innerHTML = '<option value="">None - answer everything myself</option>' +
      quickStarts.map(function (item) {
        return '<option value="' + escapeAttr(item.id) + '">' + escapeHtml(item.label) + '</option>';
      }).join('');
  }

  function renderQuestion(q) {
    if (q.type === 'date') {
      return '<div class="question" data-question="' + escapeAttr(q.id) + '">' +
        '<div class="question-pill" data-pill="' + escapeAttr(q.id) + '"></div>' +
        '<div class="question-head"><label for="' + escapeAttr(q.id) + '">' + escapeHtml(q.label) + '</label></div>' +
        '<p class="question-help">' + escapeHtml(q.help || '') + '</p>' +
        '<input class="date-input" id="' + escapeAttr(q.id) + '" name="' + escapeAttr(q.id) + '" type="date" />' +
      '</div>';
    }

    return '<fieldset class="question" data-question="' + escapeAttr(q.id) + '">' +
      '<div class="question-pill" data-pill="' + escapeAttr(q.id) + '"></div>' +
      '<div class="question-head"><legend>' + escapeHtml(q.label) + '</legend></div>' +
      '<p class="question-help">' + escapeHtml(q.help || '') + '</p>' +
      '<div class="option-grid">' +
        q.options.map(function (opt) {
          return '<label class="option-pill">' +
            '<input type="radio" name="' + escapeAttr(q.id) + '" value="' + escapeAttr(opt[0]) + '" />' +
            '<span>' + escapeHtml(opt[1]) + '</span>' +
          '</label>';
        }).join('') +
      '</div>' +
    '</fieldset>';
  }

  function restorePreferences() {
    var conciergePref = localStorage.getItem(STORAGE_KEYS.concierge);
    var savePref = localStorage.getItem(STORAGE_KEYS.saveEnabled);
    var conciergeOn = conciergePref == null ? true : conciergePref === 'true';
    var saveOn = savePref === 'true';

    conciergeToggle.checked = conciergeOn;
    saveToggle.checked = saveOn;
    document.body.classList.toggle('concierge-on', conciergeOn);
  }

  function loadSavedAnswers() {
    if (!saveToggle.checked) return;
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.answers) || '{}');
      setAnswers(saved);
    } catch (err) {
      localStorage.removeItem(STORAGE_KEYS.answers);
    }
  }

  function wireEvents() {
    conciergeToggle.addEventListener('change', function () {
      document.body.classList.toggle('concierge-on', conciergeToggle.checked);
      localStorage.setItem(STORAGE_KEYS.concierge, conciergeToggle.checked ? 'true' : 'false');
      if (lastResult) renderResults(lastResult);
    });

    saveToggle.addEventListener('change', function () {
      localStorage.setItem(STORAGE_KEYS.saveEnabled, saveToggle.checked ? 'true' : 'false');
      if (saveToggle.checked) {
        saveAnswers();
      } else {
        localStorage.removeItem(STORAGE_KEYS.answers);
      }
    });

    form.addEventListener('change', function (event) {
      var question = eventTargetQuestionId(event.target);
      if (question && quickStartState) {
        quickStartState.touched[question] = true;
        updateQuickStartPills();
      }
      if (saveToggle.checked) saveAnswers();
    });

    runBtn.addEventListener('click', runPreflight);
    resetBtn.addEventListener('click', resetForm);
    clearQuickStartBtn.addEventListener('click', function () {
      clearQuickStart(true);
    });
    quickStartSelect.addEventListener('change', function () {
      if (!quickStartSelect.value) {
        clearQuickStart(false);
        return;
      }
      applyQuickStart(quickStartSelect.value);
    });
    resultsEl.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('.copy-evidence-btn');
      if (!button) return;
      copyEvidence(button.getAttribute('data-rule-id'), button);
    });
    startBtn.addEventListener('click', function () {
      document.getElementById('section-basics').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function eventTargetQuestionId(target) {
    if (!target || !target.name) return '';
    return target.name;
  }

  function applyQuickStart(id) {
    var quickStart = quickStarts.filter(function (item) { return item.id === id; })[0];
    if (!quickStart) return;
    form.reset();
    quickStartState = {
      id: id,
      presetFields: Object.assign({}, quickStart.presets),
      touched: {}
    };
    setAnswers(quickStart.presets, true);
    quickStartDesc.textContent = quickStart.description + ' Pre-filled answers are suggestions; override anything that does not fit.';
    updateQuickStartPills();
    if (saveToggle.checked) saveAnswers();
  }

  function clearQuickStart(resetAnswers) {
    quickStartState = null;
    quickStartSelect.value = '';
    quickStartDesc.textContent = 'Pick a common package pattern to pre-fill the obvious answers. Nothing is locked; change anything that does not fit.';
    clearQuickStartPills();
    if (resetAnswers) resetForm();
  }

  function updateQuickStartPills() {
    if (!quickStartState) {
      clearQuickStartPills();
      return;
    }
    var answers = getAnswers();
    getAllQuestions().forEach(function (q) {
      var pill = form.querySelector('[data-pill="' + cssEscape(q.id) + '"]');
      if (!pill) return;
      pill.className = 'question-pill';
      pill.textContent = '';
      if (quickStartState.touched[q.id]) return;
      if (Object.prototype.hasOwnProperty.call(quickStartState.presetFields, q.id)) {
        pill.textContent = 'Pre-filled by quick start - change if needed';
        pill.classList.add('is-visible', 'is-prefilled');
        return;
      }
      if (!answers[q.id]) {
        pill.textContent = 'Needs your answer';
        pill.classList.add('is-visible', 'is-needed');
      }
    });
  }

  function clearQuickStartPills() {
    form.querySelectorAll('.question-pill').forEach(function (pill) {
      pill.className = 'question-pill';
      pill.textContent = '';
    });
  }

  function loadRules() {
    fetch('preflight-rules.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Unable to load rules');
        return res.json();
      })
      .then(function (json) {
        rules = Array.isArray(json.rules) ? json.rules : [];
      })
      .catch(function () {
        rules = [];
        resultsEl.classList.add('is-visible');
        resultsEl.innerHTML = '<div class="score-card"><strong>Rules failed to load.</strong><p class="score-math">Run this page through a local web server or GitHub Pages so the browser can load <code>preflight-rules.json</code>.</p></div>';
      });
  }

  function getAnswers() {
    var answers = {};
    getAllQuestions().forEach(function (q) {
      if (q.type === 'date') {
        answers[q.id] = (document.getElementById(q.id).value || '').trim();
        return;
      }
      var checked = form.querySelector('input[name="' + cssEscape(q.id) + '"]:checked');
      answers[q.id] = checked ? checked.value : '';
    });
    return answers;
  }

  function setAnswers(answers) {
    getAllQuestions().forEach(function (q) {
      if (!(q.id in answers)) return;
      if (q.type === 'date') {
        document.getElementById(q.id).value = answers[q.id] || '';
        return;
      }
      var input = form.querySelector('input[name="' + cssEscape(q.id) + '"][value="' + cssEscape(answers[q.id]) + '"]');
      if (input) input.checked = true;
    });
  }

  function saveAnswers() {
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(getAnswers()));
  }

  function resetForm() {
    form.reset();
    quickStartState = null;
    if (quickStartSelect) quickStartSelect.value = '';
    if (quickStartDesc) quickStartDesc.textContent = 'Pick a common package pattern to pre-fill the obvious answers. Nothing is locked; change anything that does not fit.';
    clearQuickStartPills();
    resultsEl.classList.remove('is-visible');
    resultsEl.innerHTML = '';
    lastResult = null;
    if (saveToggle.checked) saveAnswers();
    document.getElementById('section-basics').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function runPreflight() {
    var answers = getAnswers();
    var context = buildContext(answers);
    var findings = evaluateRules(context);
    var scoreData = calculateScore(findings);
    lastResult = {
      answers: answers,
      context: context,
      findings: findings,
      scoreData: scoreData,
      ranAt: new Date()
    };
    renderResults(lastResult);
    if (saveToggle.checked) saveAnswers();
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildContext(answers) {
    var today = startOfDay(new Date());
    var needDate = answers.needDate ? startOfDay(new Date(answers.needDate + 'T00:00:00')) : null;
    var daysUntilNeed = needDate ? Math.round((needDate - today) / 86400000) : null;
    var aboveSAT = ['350k-9m', '9m-25m', '25m-plus'].indexOf(answers.dollarBand) !== -1;
    var aboveMPT = ['10k-350k', '350k-9m', '9m-25m', '25m-plus'].indexOf(answers.dollarBand) !== -1;
    var over9M = ['9m-25m', '25m-plus'].indexOf(answers.dollarBand) !== -1;
    var highDollar = ['9m-25m', '25m-plus'].indexOf(answers.dollarBand) !== -1;
    var isConstruction = answers.requirementType === 'construction' || answers.authorityTrack === 'far36';
    var isIT = answers.requirementType === 'it' || ['it_hardware', 'software', 'cyber'].indexOf(answers.requirementSubject) !== -1;
    var isServices = ['services', 'mixed'].indexOf(answers.requirementType) !== -1 ||
      (answers.requirementType === 'it' && answers.requirementSubject !== 'it_hardware') ||
      answers.requirementType === 'rd';
    var isSupplies = answers.requirementType === 'supplies' ||
      answers.requirementSubject === 'it_hardware';
    var serviceReqDocs = ['pws', 'sow', 'soo'];
    var supplyReqDocs = ['specs_drawings', 'purchase_desc', 'sow'];
    var hasRequirementDoc = ['pws', 'sow', 'soo', 'specs_drawings', 'purchase_desc'].indexOf(answers.reqDoc) !== -1;
    var noRequirementDoc = ['none', 'unknown', ''].indexOf(answers.reqDoc) !== -1;
    var hasServiceRequirementDoc = serviceReqDocs.indexOf(answers.reqDoc) !== -1;
    var hasSupplyRequirementDoc = supplyReqDocs.indexOf(answers.reqDoc) !== -1;
    var fundingNotReady = ['partially_funded', 'not_funded', 'unsure', ''].indexOf(answers.fundingStatus) !== -1;
    var fundedAndClean = answers.fundingStatus === 'fully_funded' && answers.bonaFideNeed === 'yes';
    var marketResearchNotDone = ['not_started', 'unknown', ''].indexOf(answers.marketResearch) !== -1;
    var marketResearchFormal = answers.marketResearch === 'formal';
    var isBrandRelated = answers.brandFlag === 'yes' ||
      ['brand_name', 'brand_name_or_equal'].indexOf(answers.competitionApproach) !== -1;
    var isSoleRelated = answers.soleSourceFlag === 'yes' ||
      answers.competitionApproach === 'sole_source';
    var isUrgent = answers.urgencyFlag === 'yes' || answers.competitionApproach === 'urgency';
    var isFairOpportunityException = answers.authorityTrack === 'far16' &&
      (answers.competitionApproach === 'sole_source' || answers.competitionApproach === 'fair_opportunity');
    var justificationNotReady = ['required_not_started', 'unsure', ''].indexOf(answers.justification) !== -1;
    var annualMoneyCrossFy = answers.colorMoney === 'om' && answers.crossesFiscalYears === 'yes';
    var isHighRiskContractType = ['tm_lh', 'cost'].indexOf(answers.contractType) !== -1;
    var isTMLH = answers.contractType === 'tm_lh';
    var commercialPathNoSupport = answers.authorityTrack === 'far12' &&
      answers.commercialDetermination !== 'yes';
    var nonCommercialPathButCommercial = answers.authorityTrack === 'far13' &&
      answers.commercialDetermination === 'yes';
    var far13AboveSAT = aboveSAT && answers.authorityTrack === 'far13';
    var commercialAboveSAT = aboveSAT && commercialPathNoSupport;
    var needsCor = isServices || isConstruction || answers.performanceLocation === 'govt_site' || answers.performanceLocation === 'mixed';
    var noCor = needsCor && ['not_started', 'unknown', ''].indexOf(answers.corStatus) !== -1;
    var noQasp = isServices && ['no', 'unknown', ''].indexOf(answers.qasp) !== -1;

    return Object.assign({}, answers, {
      daysUntilNeed: daysUntilNeed,
      needDateMissing: !needDate,
      needWithin30: daysUntilNeed != null && daysUntilNeed >= 0 && daysUntilNeed <= 30,
      needWithin60: daysUntilNeed != null && daysUntilNeed >= 0 && daysUntilNeed <= 60,
      needWithin90: daysUntilNeed != null && daysUntilNeed >= 0 && daysUntilNeed <= 90,
      needDatePast: daysUntilNeed != null && daysUntilNeed < 0,
      aboveSAT: aboveSAT,
      aboveMPT: aboveMPT,
      over9M: over9M,
      highDollar: highDollar,
      isServices: isServices,
      isSupplies: isSupplies,
      isConstruction: isConstruction,
      isIT: isIT,
      hasRequirementDoc: hasRequirementDoc,
      noRequirementDoc: noRequirementDoc,
      hasServiceRequirementDoc: hasServiceRequirementDoc,
      hasSupplyRequirementDoc: hasSupplyRequirementDoc,
      fundingNotReady: fundingNotReady,
      fundedAndClean: fundedAndClean,
      marketResearchNotDone: marketResearchNotDone,
      marketResearchFormal: marketResearchFormal,
      isBrandRelated: isBrandRelated,
      isSoleRelated: isSoleRelated,
      isUrgent: isUrgent,
      isFairOpportunityException: isFairOpportunityException,
      justificationNotReady: justificationNotReady,
      annualMoneyCrossFy: annualMoneyCrossFy,
      isHighRiskContractType: isHighRiskContractType,
      isTMLH: isTMLH,
      commercialPathNoSupport: commercialPathNoSupport,
      nonCommercialPathButCommercial: nonCommercialPathButCommercial,
      far13AboveSAT: far13AboveSAT,
      commercialAboveSAT: commercialAboveSAT,
      needsCor: needsCor,
      noCor: noCor,
      noQasp: noQasp
    });
  }

  function evaluateRules(context) {
    return rules
      .filter(function (rule) { return matchesRule(rule, context); })
      .map(function (rule) {
        return Object.assign({}, rule, { sectionOrder: sectionOrder(rule.section) });
      })
      .sort(function (a, b) {
        var severityOrder = { showstopper: 0, gap: 1, strength: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        return (a.title || '').localeCompare(b.title || '');
      });
  }

  function matchesRule(rule, context) {
    if (rule.any && Array.isArray(rule.any)) {
      var anyMatch = rule.any.some(function (set) { return matchSet(set, context); });
      if (!anyMatch) return false;
    }
    if (rule.matches && !matchSet(rule.matches, context)) return false;
    if (rule.not && matchSet(rule.not, context)) return false;
    return true;
  }

  function matchSet(set, context) {
    return Object.keys(set || {}).every(function (key) {
      var expected = Array.isArray(set[key]) ? set[key] : [set[key]];
      return expected.some(function (value) { return context[key] === value; });
    });
  }

  function calculateScore(findings) {
    var gaps = findings.filter(function (f) { return f.severity === 'gap'; });
    var showstoppers = findings.filter(function (f) { return f.severity === 'showstopper'; });
    var subtotal = 100;
    var deductions = [];

    findings.forEach(function (finding) {
      if (finding.severity === 'strength') return;
      var impact = Number(finding.scoreImpact || (finding.severity === 'showstopper' ? 15 : 7));
      subtotal -= impact;
      deductions.push({ title: finding.title, impact: impact, severity: finding.severity });
    });

    var cap = showstoppers.reduce(function (lowest, finding) {
      var findingCap = Number(finding.capScore || 60);
      return Math.min(lowest, findingCap);
    }, 100);

    var capped = Math.min(subtotal, cap);
    var score = Math.max(10, capped);
    var status = score >= 80 ? 'Ready-ish' : (score >= 60 ? 'Needs work' : 'Do not solicit yet');
    var tone = score >= 80 ? 'good' : (score >= 60 ? 'caution' : 'danger');

    return {
      score: score,
      status: status,
      tone: tone,
      subtotal: subtotal,
      cap: cap,
      wasCapped: cap < 100 && subtotal > cap,
      deductions: deductions,
      counts: {
        gaps: gaps.length,
        showstoppers: showstoppers.length,
        strengths: findings.filter(function (f) { return f.severity === 'strength'; }).length
      }
    };
  }

  function renderResults(result) {
    var findings = result.findings;
    var scoreData = result.scoreData;
    var strengths = findings.filter(function (f) { return f.severity === 'strength'; });
    var gaps = findings.filter(function (f) { return f.severity === 'gap'; });
    var showstoppers = findings.filter(function (f) { return f.severity === 'showstopper'; });
    var recs = collectRecommendations(findings);

    resultsEl.classList.add('is-visible');
    resultsEl.innerHTML =
      '<div class="print-only">' +
        '<h1>Acquisition Package Preflight Memo</h1>' +
        '<p>Generated ' + escapeHtml(formatDateTime(result.ranAt)) + ' using KTHQ Acquisition Package Preflight. This is an educational readiness check, not legal advice or an agency approval.</p>' +
        renderAnswerSummary(result.answers) +
      '</div>' +
      renderScore(scoreData) +
      renderFixPlan(findings, scoreData) +
      '<div class="findings-grid">' +
        renderFindingPanel('showstopper', 'Showstoppers (' + showstoppers.length + ')', showstoppers, 'No showstoppers triggered. That does not mean the package is approved; it means this ruleset did not find a hard stop.') +
        renderFindingPanel('gap', 'Gaps to Address (' + gaps.length + ')', gaps, 'No gaps triggered. Good. Still read the file like someone else has to defend it.') +
        renderFindingPanel('strength', 'Strengths (' + strengths.length + ')', strengths, 'Run the preflight after selecting answers to see strengths.') +
      '</div>' +
      '<div class="recommendations">' +
        renderRecommendationPanel('Recommended KTHQ Tools', recs.tools, 'Tool links from the findings will appear here.') +
        renderRecommendationPanel('Recommended Training and Reference', recs.training.concat(recs.reference), 'Training and reference links from the findings will appear here.') +
      '</div>' +
      '<div class="memo-actions">' +
        '<div class="memo-note">Print creates a clean memo with the score, key inputs, findings, and next steps. It may run beyond one page when the package has a lot of findings; page one stays summary-first.</div>' +
        '<button class="preflight-btn" type="button" id="printBtn">Print Preflight Memo</button>' +
      '</div>';

    document.getElementById('printBtn').addEventListener('click', function () {
      window.print();
    });
  }

  function renderScore(scoreData) {
    var pips = '';
    var filled = Math.round(scoreData.score / 10);
    for (var i = 1; i <= 10; i++) {
      pips += '<span class="score-pip' + (i <= filled ? ' is-filled ' + scoreData.tone : '') + '"></span>';
    }

    var deductionList = scoreData.deductions.length
      ? '<ul>' + scoreData.deductions.map(function (d) {
          return '<li>-' + d.impact + ' for ' + escapeHtml(d.severity) + ': ' + escapeHtml(d.title) + '</li>';
        }).join('') + '</ul>'
      : '<div>No deductions.</div>';
    var capLine = scoreData.wasCapped
      ? '<div>Capped at ' + scoreData.cap + ' because a showstopper triggered.</div>'
      : '';

    return '<section class="score-card">' +
      '<div class="score-top">' +
        '<div>' +
          '<div class="score-number">' + scoreData.score + '</div>' +
          '<div class="score-label">Readiness Score / 100</div>' +
        '</div>' +
        '<div class="score-status">' +
          '<div class="status-word ' + scoreData.tone + '">' + escapeHtml(scoreData.status) + '</div>' +
          '<div class="score-pips" aria-hidden="true">' + pips + '</div>' +
        '</div>' +
      '</div>' +
      '<details class="score-math"><summary>Show score math</summary><div>Started at 100.</div>' + deductionList + capLine + '<div>Floor is 10.</div></details>' +
    '</section>';
  }

  function renderFixPlan(findings, scoreData) {
    var actionItems = findings
      .filter(function (finding) { return finding.severity !== 'strength'; })
      .slice()
      .sort(compareFixPlanItems);

    if (!actionItems.length) {
      return '<section class="fix-plan">' +
        '<div class="fix-plan-head">' +
          '<div><h2>Fix Plan</h2><p class="fix-plan-summary">No action findings triggered. Keep the package file current and rerun Preflight if the facts change.</p></div>' +
          '<div class="fix-plan-delta">' + scoreData.score + ' / 100</div>' +
        '</div>' +
      '</section>';
    }

    var visible = actionItems.slice(0, 5);
    var hidden = actionItems.slice(5);
    var recovered = Math.min(100, scoreData.score + visible.reduce(function (sum, item) {
      return sum + Number(item.scoreImpact || (item.severity === 'showstopper' ? 15 : 7));
    }, 0));

    return '<section class="fix-plan">' +
      '<div class="fix-plan-head">' +
        '<div>' +
          '<h2>Fix Plan</h2>' +
          '<p class="fix-plan-summary">Work these in order. The list favors stop issues first, then funding and authority, then requirement quality, research, surveillance, and risk cleanup.</p>' +
        '</div>' +
        '<div class="fix-plan-delta">' + scoreData.score + ' -> ' + recovered + '</div>' +
      '</div>' +
      '<div class="fix-plan-list">' + visible.map(renderFixPlanItem).join('') + '</div>' +
      (hidden.length ? '<details class="fix-plan-more"><summary>Show ' + hidden.length + ' more item' + (hidden.length === 1 ? '' : 's') + '</summary><div class="fix-plan-list" style="margin-top:.55rem;counter-reset:fixplan ' + visible.length + ';">' + hidden.map(renderFixPlanItem).join('') + '</div></details>' : '') +
    '</section>';
  }

  function compareFixPlanItems(a, b) {
    var severityOrder = { showstopper: 0, gap: 1 };
    var aSeverity = severityOrder[a.severity] == null ? 9 : severityOrder[a.severity];
    var bSeverity = severityOrder[b.severity] == null ? 9 : severityOrder[b.severity];
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;

    var phaseOrder = {
      stop: 0,
      'funding-authority': 1,
      'requirement-doc': 2,
      'research-justification': 3,
      'surveillance-admin': 4,
      'risk-flags': 5
    };
    var aPhase = phaseOrder[findingPhase(a)] == null ? 9 : phaseOrder[findingPhase(a)];
    var bPhase = phaseOrder[findingPhase(b)] == null ? 9 : phaseOrder[findingPhase(b)];
    if (aPhase !== bPhase) return aPhase - bPhase;

    return Number(b.scoreImpact || 0) - Number(a.scoreImpact || 0);
  }

  function findingPhase(finding) {
    if (finding.phase) return finding.phase;
    if (finding.severity === 'showstopper') return 'stop';
    if (finding.section === 'funding' || finding.section === 'authority') return 'funding-authority';
    if (finding.section === 'quality') {
      return /market|justification|brand|sole|source/i.test(finding.title || '') ? 'research-justification' : 'requirement-doc';
    }
    if (finding.section === 'customer') return 'surveillance-admin';
    return 'risk-flags';
  }

  function renderFixPlanItem(finding) {
    var impact = Number(finding.scoreImpact || (finding.severity === 'showstopper' ? 15 : 7));
    var primary = (finding.fixWith || [])[0];
    return '<div class="fix-plan-item">' +
      '<div class="fix-plan-index" aria-hidden="true"></div>' +
      '<div>' +
        '<div class="fix-plan-title">' + escapeHtml(finding.title) + '</div>' +
        '<div class="fix-plan-meta">' + escapeHtml(phaseLabel(findingPhase(finding))) + ' / ' + escapeHtml(finding.severity) + '</div>' +
        (primary ? '<div class="fix-list" style="margin-top:.45rem;"><a class="fix-link" href="' + escapeAttr(primary.url) + '"><span class="link-prefix">Fix</span>' + escapeHtml(primary.label) + '</a></div>' : '') +
      '</div>' +
      '<div class="fix-plan-points">+' + impact + ' pts</div>' +
    '</div>';
  }

  function phaseLabel(phase) {
    return {
      stop: 'Stop issue',
      'funding-authority': 'Funding / authority',
      'requirement-doc': 'Requirement document',
      'research-justification': 'Research / justification',
      'surveillance-admin': 'Surveillance / admin',
      'risk-flags': 'Risk flags'
    }[phase] || 'Action';
  }

  function renderFindingPanel(type, title, list, emptyText) {
    return '<section class="finding-panel ' + type + '">' +
      '<h2>' + escapeHtml(title) + '</h2>' +
      '<div class="finding-list">' +
        (list.length ? list.map(renderFindingCard).join('') : '<div class="empty-finding">' + escapeHtml(emptyText) + '</div>') +
      '</div>' +
    '</section>';
  }

  function renderFindingCard(finding) {
    var fixes = (finding.fixWith || []).map(function (fix) {
      var isStrength = finding.severity === 'strength';
      var linkClass = isStrength ? 'fix-link related-link' : 'fix-link';
      var prefix = isStrength ? 'Related' : 'Fix';
      return '<a class="' + linkClass + '" href="' + escapeAttr(fix.url) + '"><span class="link-prefix">' + prefix + '</span>' + escapeHtml(fix.label) + '</a>';
    }).join('');
    return '<article class="finding-card">' +
      '<h3>' + escapeHtml(finding.title) + '</h3>' +
      '<p>' + escapeHtml(finding.explanation) + '</p>' +
      (finding.cite ? '<div class="finding-cite"><strong>Cite / hook:</strong> ' + escapeHtml(finding.cite) + '</div>' : '') +
      renderEvidenceList(finding) +
      renderTriggerDrawer(finding) +
      (conciergeToggle.checked && finding.concierge ? '<p><strong>Plain English:</strong> ' + escapeHtml(finding.concierge) + '</p>' : '') +
      (fixes ? '<div class="fix-list">' + fixes + '</div>' : '') +
    '</article>';
  }

  function renderTriggerDrawer(finding) {
    var context = lastResult ? lastResult.context : {};
    var triggerItems = triggerItemsFor(finding, context);
    var clearedItems = (finding.clearedBy || []).map(function (item) {
      return '<li>' + escapeHtml(item.label || clearLabelFor(item)) + '</li>';
    });
    if (!clearedItems.length) {
      clearedItems.push('<li>Change one of the matched answers above so this rule no longer applies.</li>');
    }
    var header = finding.severity === 'strength' ? 'Awarded because' : 'Triggered because';
    return '<details class="trigger-drawer preflight-nonprint">' +
      '<summary>Why did this trigger?</summary>' +
      '<div class="trigger-drawer-body">' +
        '<div><h4>' + header + '</h4><ul>' + triggerItems.join('') + '</ul></div>' +
        '<div><h4>' + (finding.severity === 'strength' ? 'What would remove this strength' : 'What would clear it') + '</h4><ul>' + clearedItems.join('') + '</ul></div>' +
        (finding.cite ? '<div><h4>Cite / hook</h4><div>' + escapeHtml(finding.cite) + '</div></div>' : '') +
      '</div>' +
    '</details>';
  }

  function triggerItemsFor(finding, context) {
    var sets = [];
    if (finding.matches) sets.push(finding.matches);
    if (finding.any && Array.isArray(finding.any)) {
      finding.any.forEach(function (set) {
        if (matchSet(set, context)) sets.push(set);
      });
    }
    if (!sets.length) return ['<li>This rule matched the current package profile.</li>'];
    var seen = {};
    var items = [];
    sets.forEach(function (set) {
      Object.keys(set).forEach(function (key) {
        var expected = set[key];
        var dedupe = key + ':' + JSON.stringify(expected);
        if (seen[dedupe]) return;
        seen[dedupe] = true;
        items.push('<li>' + escapeHtml(triggerTextFor(key, expected, context)) + '</li>');
      });
    });
    return items.length ? items : ['<li>This rule matched the current package profile.</li>'];
  }

  function triggerTextFor(key, expected, context) {
    var q = getQuestionById(key);
    if (q) {
      return q.label + ': ' + labelFor(key, context[key] || expected);
    }
    var expectedText = Array.isArray(expected)
      ? expected.map(function (value) { return String(value); }).join(', ')
      : String(expected);
    var actual = context[key];
    var label = derivedLabels[key] || key;
    if (typeof actual === 'boolean') return label + ': ' + (actual ? 'Yes' : 'No');
    if (actual != null && actual !== '') return label + ': ' + String(actual);
    return label + ': ' + expectedText;
  }

  function clearLabelFor(item) {
    if (!item || !item.answer) return 'Change the relevant answer to clear this finding.';
    var q = getQuestionById(item.answer);
    if (!q) return 'Change ' + item.answer + ' to one of: ' + (item.set || []).join(', ');
    var values = (item.set || []).map(function (value) { return labelFor(item.answer, value); }).join(', ');
    return 'Set ' + q.label + ' to: ' + values;
  }

  function renderEvidenceList(finding) {
    if (!finding.evidence || !finding.evidence.length) return '';
    return '<div class="evidence-list">' +
      '<h4>Evidence to keep in the file</h4>' +
      '<ul>' + finding.evidence.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>' +
      '<button type="button" class="copy-evidence-btn preflight-nonprint" data-rule-id="' + escapeAttr(finding.id) + '">Copy as outline</button>' +
    '</div>';
  }

  function copyEvidence(ruleId, button) {
    var finding = lastResult && lastResult.findings.filter(function (item) { return item.id === ruleId; })[0];
    if (!finding || !finding.evidence || !finding.evidence.length) return;
    var text = finding.title + '\n' + finding.evidence.map(function (item) { return '- ' + item; }).join('\n');
    copyText(text).then(function () {
      var old = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(function () { button.textContent = old; }, 1200);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }

  function collectRecommendations(findings) {
    var buckets = { tools: [], training: [], reference: [] };
    var seen = {};
    findings.forEach(function (finding) {
      (finding.fixWith || []).forEach(function (fix) {
        var key = fix.url + '|' + fix.label;
        if (seen[key]) return;
        seen[key] = true;
        var kind = fix.kind === 'tool' ? 'tools' : (fix.kind === 'reference' ? 'reference' : 'training');
        buckets[kind].push(fix);
      });
    });
    return buckets;
  }

  function renderRecommendationPanel(title, items, emptyText) {
    return '<section class="rec-panel">' +
      '<h2>' + escapeHtml(title) + '</h2>' +
      '<div class="rec-list">' +
        (items.length ? items.map(function (item) {
          return '<a class="rec-item" href="' + escapeAttr(item.url) + '">' +
            '<strong>' + escapeHtml(item.label) + '</strong>' +
            '<span>' + escapeHtml(item.description || item.url) + '</span>' +
          '</a>';
        }).join('') : '<div class="empty-finding">' + escapeHtml(emptyText) + '</div>') +
      '</div>' +
    '</section>';
  }

  function renderAnswerSummary(answers) {
    var rows = getAllQuestions().map(function (q) {
      var raw = answers[q.id];
      if (!raw) raw = q.type === 'date' ? 'TBD' : 'Not answered';
      return '<tr><th>' + escapeHtml(q.label) + '</th><td>' + escapeHtml(labelFor(q.id, raw)) + '</td></tr>';
    }).join('');
    return '<table style="width:100%;border-collapse:collapse;margin:.15in 0 .25in;"><tbody>' + rows + '</tbody></table>';
  }

  function labelFor(questionId, value) {
    var q = getQuestionById(questionId);
    if (!q || q.type === 'date') return value || 'TBD';
    var opt = (q.options || []).filter(function (item) { return item[0] === value; })[0];
    return opt ? opt[1] : value;
  }

  function getQuestionById(questionId) {
    return getAllQuestions().filter(function (item) { return item.id === questionId; })[0];
  }

  function getAllQuestions() {
    return sections.reduce(function (out, section) {
      return out.concat(section.questions);
    }, []);
  }

  function sectionOrder(sectionId) {
    var ids = sections.map(function (s) { return s.id; });
    var index = ids.indexOf(sectionId);
    return index === -1 ? 99 : index;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatDateTime(date) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
  }

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
