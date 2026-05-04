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
          help: 'Bands are safer than exact amounts and good enough for this check. Thresholds reflect the current ordinary SAT of $350K and FAR 13.5 commercial simplified procedures up to $9M.',
          options: [
            ['mpt', '$10K or less'],
            ['10k-350k', '$10K to $350K'],
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
          id: 'authorityTrack',
          label: 'Primary authority track',
          help: 'This does not lock you in. It helps the tool spot when the package is missing the documentation that goes with the path.',
          options: [
            ['far8', 'FAR Part 8 / FSS'],
            ['far12', 'FAR Part 12 / commercial'],
            ['far13', 'FAR Part 13 / SAP'],
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
          id: 'commercialDetermination',
          label: 'Commercial product/service determination considered?',
          help: 'Especially important when using commercial procedures above the SAT under FAR 13.5.',
          options: [
            ['yes', 'Yes'],
            ['no', 'No'],
            ['not_applicable', 'Not applicable'],
            ['unsure', 'Unsure']
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

  var form = document.getElementById('preflightForm');
  var resultsEl = document.getElementById('results');
  var conciergeToggle = document.getElementById('conciergeToggle');
  var saveToggle = document.getElementById('saveToggle');
  var runBtn = document.getElementById('runBtn');
  var resetBtn = document.getElementById('resetBtn');
  var startBtn = document.getElementById('startBtn');

  init();

  function init() {
    renderQuestions();
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

  function renderQuestion(q) {
    if (q.type === 'date') {
      return '<div class="question" data-question="' + escapeAttr(q.id) + '">' +
        '<div class="question-head"><label for="' + escapeAttr(q.id) + '">' + escapeHtml(q.label) + '</label></div>' +
        '<p class="question-help">' + escapeHtml(q.help || '') + '</p>' +
        '<input class="date-input" id="' + escapeAttr(q.id) + '" name="' + escapeAttr(q.id) + '" type="date" />' +
      '</div>';
    }

    return '<fieldset class="question" data-question="' + escapeAttr(q.id) + '">' +
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

    form.addEventListener('change', function () {
      if (saveToggle.checked) saveAnswers();
    });

    runBtn.addEventListener('click', runPreflight);
    resetBtn.addEventListener('click', resetForm);
    startBtn.addEventListener('click', function () {
      document.getElementById('section-basics').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    var commercialAboveSAT = aboveSAT &&
      (answers.authorityTrack === 'far12' || answers.authorityTrack === 'far13') &&
      answers.commercialDetermination !== 'yes';
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
      (conciergeToggle.checked && finding.concierge ? '<p><strong>Plain English:</strong> ' + escapeHtml(finding.concierge) + '</p>' : '') +
      (fixes ? '<div class="fix-list">' + fixes + '</div>' : '') +
    '</article>';
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
    var q = getAllQuestions().filter(function (item) { return item.id === questionId; })[0];
    if (!q || q.type === 'date') return value || 'TBD';
    var opt = (q.options || []).filter(function (item) { return item[0] === value; })[0];
    return opt ? opt[1] : value;
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
