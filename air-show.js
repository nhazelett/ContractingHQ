/* Air Show in a Box: shared helpers and reference content. */
(function () {
  const ASB = (window.ASB = {});
  ASB.el = function (t, a, ...kids) {
    const e = document.createElement(t);
    if (a) for (const k in a) {
      const v = a[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(3).forEach(k => k != null && k !== false && e.append(k));
    return e;
  };
  const el = ASB.el;
  ASB.$ = s => document.querySelector(s);
  ASB.fill = function (node, ...kids) { node.replaceChildren(); kids.flat(3).forEach(k => k != null && k !== false && node.append(k)); return node; };
  ASB.money = n => '$' + Math.round(n).toLocaleString('en-US');
  ASB.pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  ASB.fmtDate = d => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  ASB.milDate = d => d.getDate() + ' ' + d.toLocaleDateString('en-US', { month: 'short' }) + ' ' + d.getFullYear();
  ASB.loadData = () => fetch('data/airshow_data.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

  /* ---------- regulations ---------- */
  const RFO = 'https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-';
  ASB.REGS = {
    afman: { short: 'AFMAN 10-1004', title: 'AFMAN 10-1004, Conducting Air Force Open Houses (23 Aug 2018)', url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/afman10-1004/afman10-1004.pdf', about: 'The governing manual for the event: roles, funding by line item, timelines, contracting rules, the approved warbird list.' },
    dafi: { short: 'DAFI 11-209', title: 'DAFI 11-209, Participation in Aerial Events (20 May 2021)', url: 'https://static.e-publishing.af.mil/production/1/af_a3/publication/dafi11-209/dafi11-209.pdf', about: 'Event approval and participation approval for military aircraft. Check your MAJCOM supplement.' },
    naf: { short: 'DAFMAN 64-119', title: 'DAFMAN 64-119, Nonappropriated Fund Contracting Procedures (30 Aug 2023)', url: 'https://static.e-publishing.af.mil/production/1/saf_aq/publication/dafman64-119/dafman64-119.pdf', about: 'The rulebook for anything bought with NAF or sponsorship money. The FAR does not apply to these buys.' },
    far12: { short: 'RFO FAR', title: 'RFO FAR Part 12, Acquisition of Commercial Products and Commercial Services', url: RFO + '12', about: 'Simplified procedures for commercial buys, restricting competition, price reasonableness, micro-purchases.' },
    far5: { short: 'RFO FAR', title: 'RFO FAR Part 5, Publicizing Contract Actions', url: RFO + '5', about: 'When a notice has to be posted before you solicit.' },
    far6: { short: 'RFO FAR', title: 'RFO FAR Part 6, Competition Requirements', url: RFO + '6', about: 'Justification content and approval levels for sole source buys over the simplified acquisition threshold.' },
    far2: { short: 'RFO FAR', title: 'RFO FAR Part 2, Definitions', url: RFO + '2', about: 'Micro-purchase threshold and simplified acquisition threshold.' },
    dod12: { short: 'DoD Class Deviation 2026-O0028', title: 'DoD Class Deviation 2026-O0028, RFO Part 12 and DFARS Part 212', url: 'https://www.acquisition.gov/sites/default/files/page_file_uploads/DoD_RFO_Deviation_Part-12.pdf', about: 'Directs DoD contracting officers to use the RFO Part 12 text.' },
    cfr855: { short: '32 CFR 855.13', title: '32 CFR 855.13, Civil fly-ins', url: 'https://www.law.cornell.edu/cfr/text/32/855.13', about: 'Civil aircraft performing at an Air Force open house: MAJCOM or FOA approval and a landing permit.' },
    acc: { short: 'ACC Aerial Events', title: 'ACC Aerial Events: flyovers, static displays, demonstration teams', url: 'https://www.acc.af.mil/Units/Aerial-Events/Flyovers-Static-Display-and-ACT/', about: 'Where requests for ACC demonstration teams and Heritage Flight are worked.' },
    kthq12: { short: 'KTHQ training', title: 'KTHQ: FAR Part 12, Restricting Competition', url: 'far-part12-restricting-competition.html', about: 'Plain-language walkthrough of the sole source rules for commercial buys.' }
  };
  /* cite('afman','6.4') -> "AFMAN 10-1004, para 6.4"; cite('far12','12.102(a)') -> "RFO FAR 12.102(a)" */
  ASB.citeText = function (reg, ref) {
    const r = ASB.REGS[reg];
    if (!ref) return r.short;
    if (reg.startsWith('far')) return 'RFO FAR ' + ref;
    return r.short + ', ' + (/^(Att|Table|Ch)/.test(ref) ? ref : 'para ' + ref);
  };
  ASB.cite = function (reg, ref) {
    const r = ASB.REGS[reg]; let url = r.url;
    if (reg.startsWith('far') && ref) { const m = ref.match(/^\d+\.\d+(-\d+)?/); if (m) url += '#FAR_' + m[0].replace(/[.-]/g, '_'); }
    return el('a', { class: 'cite', href: url, target: reg === 'kthq12' ? null : '_blank', rel: 'noopener', title: r.title, text: ASB.citeText(reg, ref) });
  };
  /* sentence with trailing citations: ASB.fact('text', ['afman','6.4'], ['far12','12.102(a)']) */
  ASB.fact = (text, ...cites) => el('span', null, text + ' ', cites.map(c => ASB.cite(c[0], c[1])));

  /* ---------- thresholds (RFO FAR 2.101; DAFMAN 64-119 para 6.6) ---------- */
  ASB.T = { MPT: 15000, MPT_SCLS: 2500, SAT: 350000, NOTICE: 20000, CO_CERT: 900000, NAF_NOCOMP: 10000, NAF_TWO: 250000, NAF_ENT_LIMIT: 500000 };

  /* ---------- the show (saved in this browser only) ---------- */
  ASB.getShow = function () { try { return JSON.parse(localStorage.getItem('asb-show') || '{}'); } catch (e) { return {}; } };
  ASB.setShow = function (s) { try { localStorage.setItem('asb-show', JSON.stringify(s)); } catch (e) {} };
  ASB.getPlan = function () { try { return JSON.parse(localStorage.getItem('asb-plan') || '{}'); } catch (e) { return {}; } };
  ASB.setPlan = function (p) { try { localStorage.setItem('asb-plan', JSON.stringify(p)); } catch (e) {} };
  ASB.showDate = function () { const s = ASB.getShow(); if (!s.date) return null; const d = new Date(s.date + 'T12:00:00'); return isNaN(d) ? null : d; };

  ASB.PAGES = [
    ['air-show.html', '1', 'Plan the show'],
    ['air-show-requirements.html', '2', 'Requirements'],
    ['air-show-call-for-acts.html', '3', 'Call for acts'],
    ['air-show-acts.html', '4', 'Acts and prices'],
    ['air-show-sole-source.html', '5', 'Sole source builder']
  ];
  ASB.chrome = function (current) {
    const idx = ASB.PAGES.findIndex(p => p[0] === current);
    const nav = el('nav', { class: 'suite noprint', 'aria-label': 'Air Show in a Box steps' }, el('span', { class: 'suite-label', text: 'Air Show in a Box' }), ASB.PAGES.map((p, i) => el('a', { href: p[0], class: i < idx ? 'done' : null, 'aria-current': p[0] === current ? 'page' : null }, el('b', { text: p[1] }), el('span', { text: p[2] }))));
    const s = ASB.getShow(), d = ASB.showDate(), bar = el('div', { class: 'showbar noprint' });
    if (s.name || s.base || d) {
      const days = d ? Math.ceil((d - new Date()) / 864e5) : null;
      bar.append(el('span', null, 'Your show: ', el('b', { text: [s.name, s.base].filter(Boolean).join(', ') || 'unnamed' })), d ? el('span', null, el('b', { text: ASB.fmtDate(d) }), days >= 0 ? ' (' + days + ' days out)' : ' (date has passed)') : null);
      if (current !== 'air-show.html') bar.append(el('a', { href: 'air-show.html#setup', text: 'Change' }));
    } else if (current !== 'air-show.html') bar.append(el('span', null, 'No show entered yet. ', el('a', { href: 'air-show.html#setup', text: 'Enter your show date' }), ' and every page fills in around it.'));
    const host = document.getElementById('asb-chrome'); if (host) host.replaceChildren(nav, bar);
    /* next / previous step at the bottom of every page */
    const main = document.getElementById('main'), old = document.getElementById('asb-next'); if (old) old.remove();
    if (main && idx >= 0) {
      const prev = ASB.PAGES[idx - 1], next = ASB.PAGES[idx + 1];
      const box = el('nav', { id: 'asb-next', class: 'stepnav noprint', 'aria-label': 'Next step' },
        prev ? el('a', { class: 'prev', href: prev[0] }, el('small', { text: 'Back: Step ' + prev[1] }), el('span', { text: prev[2] })) : el('span'),
        next ? el('a', { class: 'next', href: next[0] }, el('small', { text: 'Step ' + (idx + 1) + ' of ' + ASB.PAGES.length + ' done. Next: Step ' + next[1] }), el('span', { text: next[2] + ' \u2192' })) : el('a', { class: 'next', href: ASB.PAGES[0][0] }, el('small', { text: 'That is all five steps' }), el('span', { text: 'Back to the plan \u2192' })));
      const method = main.querySelector('.method'); if (method) main.insertBefore(box, method); else main.append(box);
    }
  };
  ASB.copyBtn = function (getText, label) {
    label = label || 'Copy';
    return el('button', { class: 'btn2', type: 'button', text: label, onclick: e => { const b = e.currentTarget; const done = () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = label), 1500); }; try { navigator.clipboard.writeText(getText()).then(done, () => { b.textContent = 'Select the text and copy'; }); } catch (x) { b.textContent = 'Select the text and copy'; } } });
  };
  ASB.mix = function (o) {
    const t = o.n || 1, m = el('div', { class: 'mix', role: 'img', 'aria-label': o.not_competed + ' not competed, ' + o.competed_one_offer + ' competed with one offer, ' + o.competed_multi + ' competed with two or more' });
    [['a', o.not_competed], ['b', o.competed_one_offer], ['c', o.competed_multi]].forEach(([c, v]) => { const i = el('i', { class: c }); i.style.width = (100 * v) / t + '%'; m.append(i); });
    return m;
  };

  /* ---------- approved warbird list, AFMAN 10-1004 Attachment 6 (Table A6.1), as read from the publication ---------- */
  ASB.WARBIRDS = 'A-36;JRB-4 Expeditor;AT-6;AT-11 Kansan;C-45 Expeditor;T-34 Mentor;AH-1 Cobra;P-39 Airacobra;P-63 Kingcobra;UH-1 Huey;B-17 Flying Fortress;B-29 Superfortress;C-97 Stratofreighter;PT-17 Kaydet;A-37 Dragonfly;O-1 Bird Dog;O-2 Super Skymaster;UC-78 Bobcat;F4U Corsair;B-24 Liberator;PB4Y Privateer;PBY-6A Catalina;C-131 Samaritan;C-46 Commando;P-40 Warhawk;SB2C Helldiver;A-1E Skyraider;A-26 Invader;A-3 Skywarrior;AD-4 Skyraider;B-23 Dragon;DC-3;C-47 Skytrain;C-53 Skytrooper;C-54 Skymaster;R4D Skytrain;SBD Dauntless;Edge 540;Extra 300;C-119 Flying Boxcar;C-123 Provider;PT-19 Cornell;PT-26 Cornell;UC-61 Forwarder;FM-2 Wildcat;FG-1D Corsair;AF-2S Guardian;C-1 Trader;F4F Wildcat;F6F Hellcat;F7F Tigercat;F8F Bearcat;F9F Panther;G-44 Widgeon;G-164 Ag Cat;HU-16 Albatross;J2F Duck;OV-1 Mohawk;TBF Avenger;TBM-3E Avenger;US-2 Tracker;L-6 Cadet;L-21;L-26;Learjet 24/25;C-60 Lodestar;C-69 Constellation;F-104 Starfighter;P-38 Lightning;P-2V;PV-2 Harpoon;T-33;B-26 Marauder;A-4 Skyhawk;F-4 Phantom;Meyers OTW;AT-6D Texan;B-25 Mitchell;BT-9/BT-14 Yale;F-100 Super Sabre;F-86 Sabre;FJ-3 Fury;L-17 Navion;P-51D Mustang;SNJ-4 Texan;SNJ-5 Texan;SNJ-2;SNJ-3;T-2 Buckeye;T-28A Trojan;F-5 Freedom Fighter;F-5E Tiger II;T-38 Talon;J-3 Cub;L-4 Grasshopper;Pitts S1;Pitts S2;PT-22 Recruit;UH-19D Chickasaw;AT-19 Reliant;L-5 Sentinel;OY-2 Sentinel;L-2 Grasshopper;Twin Beech 18;F-8 Crusader;BT-13A Valiant;PT-14 Waco;OV-10 Bronco;RC-3 SeeBee;L-16 Grasshopper;L-3 Grasshopper;DH-112 Venom;DH-115 Vampire;DH-82 Tiger Moth;Avro Lancaster;BAC Strikemaster;DeHavilland Mosquito;Fairey Firefly;Folland Gnat;Hawker Hunter;Hawker Hurricane;Hawker Sea Fury;Hunting Jet Provost;BAe Hawk;Supermarine Spitfire;Harvard Mk IV;Antonov AN-2;MiG-15;MiG-17;MiG-21;MiG-23;MI-24 Hind;Yak-1;Yak-3;Yak-7;Yak-9;Yak-11;Yak-18;Yak-52;Canadair Tutor;DHC-1 Chipmunk;DHC-4 Caribou;L-20/U-6A Beaver;Aero L-29;Aero L-39;Zlin 226;Aermacchi MB-326;Fieseler Storch;Fokker DR-1;Focke-Wulf FW 190;Heinkel He-111;Junkers JU-52;Bf-108;Bf-109;Me-262;Alpha Jet;Fouga Magister;F-21 Kfir;HA-200 Saeta;Mitsubishi A6M Zero;Nanchang CJ-5/CJ-6;Saab J35 Draken'.split(';');
  ASB.warbirdMatch = function (q) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const STOP = /^(demonstration|aerobatic|static|display|flying|formation|performance|warbird|aircraft|flight|airshow|twoship|performer|aerial|trainer|fighter|bomber|super|flying)$/;
    const tokens = (q || '').toLowerCase().split(/[\s/,()]+/).map(norm).filter(t => (/\d/.test(t) && /[a-z]/.test(t) && t.length >= 2) || (t.length >= 5 && !/\d/.test(t) && !STOP.test(t)));
    if (!tokens.length) return [];
    return ASB.WARBIRDS.filter(w => { const x = norm(w), words = w.toLowerCase().split(/[\s/]+/).map(norm); return tokens.some(t => /\d/.test(t) ? words.some(wd => wd === t || (wd.startsWith(t) && !/\d/.test(wd.slice(t.length, t.length + 1)))) : words.some(wd => wd === t)); });
  };

  /* ---------- funding matrix: AFMAN 10-1004 Attachment 4, read with Chapter 6 ---------- */
  ASB.FUNDING = [
    ['Aerial demonstrations', 'DoD demonstration teams: smoke oil, arresting gear, lodging, meals, transportation, pyrotechnics', 'A', ''],
    ['Aerial demonstrations', 'Warbirds: performance fee, lodging, meals, transportation, pyrotechnics', 'AP', 'Paid like a non-personal services contract. A sponsor may also contract and donate the act (para 6.3).'],
    ['Aerial demonstrations', 'Civilian aerial acts: performance fee, lodging, meals, transportation', 'NP', 'Appropriated funds are not authorized for any cost of civilian crews or aircraft (para 6.4). Commercial sponsorship needs HAF/A1S approval.'],
    ['Ground displays', 'Military and warbird static displays', 'A', ''],
    ['Ground displays', 'Civilian aircraft static displays', 'NP', ''],
    ['Fuel and oil', 'DoD demonstration teams', 'A', ''],
    ['Fuel and oil', 'Warbirds', 'AP', 'Government fuel may be provided under the contract (para 6.3).'],
    ['Fuel and oil', 'Civilian aerial acts', 'NP', 'Government fuel only under a NAF contract, or working capital fund cash sales (para 6.4).'],
    ['Contracted people', 'Open house coordinator, Air Boss, announcer or narrator', 'AP', 'A donor may give money toward these roles but may not pick or influence the contractor (paras 3.1.13, 3.1.14).'],
    ['Facilities', 'Tents, PA system, tables, chairs, bleachers, golf carts, generators, lighting, stage', 'AP', 'Depends on what the item supports. Essential elements use appropriated funds only (para 6.6).'],
    ['Facilities', 'Power, ground communications, trash containers and disposal', 'A', ''],
    ['Facilities', 'Portable restrooms', 'ANP', 'Sanitation for the public is an essential facility (para 6.6). Premium restrooms can be an FSS concession (para 1.13.6).'],
    ['Crowd control', 'Fencing, rope and stanchions, badges, shuttles, parking', 'A', 'No charge to the public for admission, parking or viewing (para 1.11).'],
    ['Security, health, safety', 'Security support, air-to-ground radio, first aid, lost and found', 'A', 'Crowd control, security and first aid are funded with appropriated funds (para 6.7).'],
    ['Publicity', 'Advertising', 'ANP', 'Government-paid advertising needs substantial justification and Public Affairs approval (para 6.8).'],
    ['Publicity', 'Event guides and schedules', 'A', 'Souvenir programs use NAF or private funds.'],
    ['Entertainment', 'Fireworks, concerts, ground acts, kids area', 'NP', 'Pure entertainment is funded by NAF or private gifts (para 6.9). Contractors carry liability insurance.'],
    ['Concessions', 'Master concessionaire, food, beverages, souvenirs', 'N', 'Sold or contracted only through FSS (para 6.10). NAF contracting rules apply (para 5.3.1).'],
    ['Other', 'Bottled water, snacks, refreshments', '', 'Personal expenses. Not an appropriated fund cost (paras 6.2, 1.11.2.1). The installation still provides free water and restrooms (para 1.11.2).'],
    ['Other', 'Event cancellation and rain insurance for MWR elements', 'N', 'FSS may not buy insurance for appropriated-fund demonstrations (para 5.2.4).']
  ];
  ASB.fundTags = code => [['A', 'apf', 'Appropriated'], ['N', 'naf', 'NAF / sponsorship'], ['P', 'prv', 'Private gift']].filter(x => code.includes(x[0])).map(x => el('span', { class: 'tag ' + x[1], text: x[2] }));

  /* ---------- timeline: lead times in AFMAN 10-1004 ---------- */
  ASB.TIMELINE = [
    { jul: 2, what: 'Request the Thunderbirds or Blue Angels (DD Form 2535 through MAJCOM/PA)', opr: 'Open House Director', c: ['afman', '11.2.1.1.1'], hard: true },
    { jul: 1, what: 'Request an ACC single-ship demonstration team or Heritage Flight', opr: 'Open House Director', c: ['afman', '2.14.11'], hard: true },
    { d: 450, d2: 270, what: 'Appoint the Open House Director (O-4 or higher) and start the planning cycle', opr: 'Installation Commander', c: ['afman', '2.13.1'] },
    { d: 270, what: 'Assign a contracting officer to the open house staff and identify purchase requirements', opr: 'Open House Director with Contracting', c: ['afman', '8.1'], note: 'The manual says "early" and gives no number. This row sits at the start of the planning cycle.' },
    { d: 180, what: 'Submit the open house request', opr: 'Open House Director', c: ['afman', 'Table A2.2'] },
    { d: 120, what: 'Foreign military demonstration team application', opr: 'Open House Director', c: ['afman', '4.4'], hard: true },
    { d: 120, what: 'Decide aerial performers and static displays, commit performers, mark show center and crowd lines', opr: 'Air Operations Officer', c: ['afman', 'Table A2.2'] },
    { d: 120, what: 'Air show insurance in place if the Air Boss is contracted', opr: 'Air Operations Officer with Contracting', c: ['afman', 'Table A2.2'] },
    { d: 120, what: 'Rocket launch application, if any', opr: 'Open House Director', c: ['afman', '2.14.5.2'], hard: true },
    { d: 90, what: 'FAA Form 7711-2 (airspace waiver) submitted to the FAA. 120 days is recommended.', opr: 'Open House Director (may delegate)', c: ['afman', '2.14.5'], hard: true },
    { d: 90, what: 'Director working the open house full time', opr: 'Open House Director', c: ['afman', '3.1.1'] },
    { d: 90, what: 'Decide pyrotechnic demonstrations and ground display locations. Air Boss operations letter with air traffic control.', opr: 'Air Operations Officer', c: ['afman', 'Table A2.2'] },
    { d: 60, what: 'Air and ground operations officers working full time', opr: 'Air and Ground Operations Officers', c: ['afman', '3.1.2'] },
    { d: 60, what: 'Unique requests to HAF/A3O', opr: 'Open House Director', c: ['afman', '2.9.1.2'] },
    { d: 45, what: 'Military flyover application', opr: 'Open House Director', c: ['afman', '2.14.5.1'], hard: true },
    { d: 45, what: 'Confirm participating aircraft and their security, aircrew and support requirements', opr: 'Air Operations Officer', c: ['afman', 'Table A2.2'] },
    { d: 30, what: 'Confirm Air Boss show requirements. Customs for foreign participants.', opr: 'Air Operations Officer', c: ['afman', 'Table A2.2'] },
    { d: 10, what: 'Publish the NOTAM. Airfield driving training complete.', opr: 'Airfield Operations', c: ['afman', 'Table A2.2'] }
  ];

  /* ---------- requirement families: who usually owns it, how it is funded, what the manual says ---------- */
  const A = (p) => ['afman', p], N = (p) => ['naf', p];
  ASB.GROUPS = ['Flying program', 'Running the show', 'Crowd support', 'Performer and staff support', 'FSS and sponsorship'];
  ASB.FAM = {
    'Civilian/warbird aerial act': { label: 'Aerial acts (warbird and civilian)', group: 0, owner: 'Open House Director and Air Operations Officer', fund: 'AP|NP', fundNote: 'Warbirds: appropriated funds or a private gift. Civilian acts: NAF sponsorship or private funds only.',
      facts: [['A warbird is a privately owned vintage military aircraft, or likeness, that flew in a conflict or is historically significant. Approved types are listed in Attachment 6, and the installation commander approves warbird participation.', A('4.2.4'), A('2.13.8')], ['Appropriated funds may pay a warbird like a non-personal services contract: fee, lodging, meals, local transportation, pyrotechnics, fuel.', A('6.3')], ['Appropriated funds are not authorized for any cost of other civilian performers. Those costs come from donations or NAF commercial sponsorship approved by HAF/A1S.', A('6.4')], ['A sponsor may contract directly with a civilian act and donate it in kind.', A('5.5.4')], ['Only a contracting officer may enter an agreement with a performer. The director may not book one without the contracting officer.', A('3.2'), A('8.2.1')], ['Performers are not paid in advance. A reasonable deposit is possible.', A('8.2.2')], ['Civil performers using the airfield provide a hold harmless agreement (DD Form 2402) and certificate of insurance (DD Form 2400) before a landing permit is issued.', A('7.9.3')], ['The organizer confirms performer qualifications: pilot certificate, medical certificate, and aerobatic competency where it applies.', A('4.2.5.3')]],
      spec: ['Aircraft type and number of aircraft', 'Fly, static, or both, and on which days', 'Performance length and number of performances per day', 'Arrival, practice and departure dates', 'What the performer needs from the base: fuel type and quantity, smoke oil, hangar, lodging, vehicles', 'Whether pyrotechnics are part of the act'], tool: ['air-show-acts.html', 'Look up who flies it and what bases paid'] },
    'Static display aircraft': { label: 'Static display aircraft', group: 0, owner: 'Air Operations Officer', fund: 'A|NP', fundNote: 'Military and warbird statics: appropriated funds. Civilian aircraft: NAF or private.',
      facts: [['A static display is an aircraft on the ground with no engine start, taxi or flight.', A('Att 1')], ['Agreements for non-military displays address signs and liability, for example a hold harmless agreement.', A('1.6')], ['Ground displays educate the public. Commercial marketing is not permitted.', A('1.13.3')]],
      spec: ['Aircraft type', 'Arrival and departure dates', 'Whether crew will be with the aircraft during public hours', 'Parking location and support needed (tow, power, fuel)'], tool: ['air-show-acts.html', 'Look up operators and prices'] },
    'Jet truck / ground act': { label: 'Jet trucks and ground acts', group: 0, owner: 'Open House Director with FSS', fund: 'NP', fundNote: 'Entertainment: NAF or private gifts.',
      facts: [['Pure entertainment is funded by NAF or private gifts.', A('6.9')], ['Contractors for attractions carry liability insurance.', A('Att 4')]], spec: ['Number of runs per day', 'Runway or taxiway needed and for how long', 'Fuel and pyrotechnic needs'] },
    'Pyrotechnics': { label: 'Pyrotechnics', group: 0, owner: 'Air Operations Officer with Safety and EOD', fund: 'A|NP', fundNote: 'Pyrotechnics supporting military demonstrations or warbirds: appropriated funds. Fireworks shows are entertainment: NAF or private.',
      facts: [['Pyrotechnics for military demonstration teams and warbird acts are an appropriated fund cost.', A('6.2'), A('6.3')], ['Fireworks displays are non-flying entertainment and may not be sold or distributed to the public.', A('5.1.1')], ['Pyrotechnic demonstrations are decided 90 days out.', A('Table A2.2')], ['Hazardous materials used by civilian vendors are identified and handled properly.', A('2.14.14')]],
      spec: ['Which acts the pyrotechnics support', 'Effects wanted (for example wall of fire length, number of shots)', 'Show days and rehearsal days', 'Storage, licensing and explosive safety requirements from Safety'] },
    'Air Boss': { label: 'Air Boss', group: 1, owner: 'Air Operations Officer', fund: 'AP', fundNote: 'Appropriated funds, or a monetary gift where the donor has no say in who is selected.',
      facts: [['The Air Boss controls air show operations in the waivered airspace and coordinates with the FAA inspector-in-charge.', A('3.1.13')], ['The Air Boss may be a contractor paid with appropriated funds. If a gift pays for it, the donor may not specify or influence the selection.', A('3.1.13')], ['Air show insurance is in place 120 days out when the Air Boss is contracted.', A('Table A2.2')], ['The Air Boss and announcer attend the daily crew briefing.', A('9.5.1')]],
      spec: ['Show days, practice days and arrival date', 'Whether the Air Boss also provides ground control, marshallers or an operations letter', 'Experience required (number and size of military shows)', 'Insurance required'], tool: ['air-show-sole-source.html', 'Document a single-source Air Boss'] },
    'Announcer / narrator': { label: 'Announcer or narrator', group: 1, owner: 'Air Operations Officer with Public Affairs', fund: 'AP', fundNote: 'Appropriated funds, or a monetary gift where the donor has no say in who is selected.',
      facts: [['The announcer may be a base employee or a paid professional contractor.', A('3.1.14')], ['Music royalties may use appropriated funds only for performances otherwise supported by appropriated funds.', A('1.14')]],
      spec: ['Show days and hours', 'Whether the announcer supplies music and licensing', 'Emergency announcement scripts and who approves them', 'Whether sound equipment comes with the announcer or separately'] },
    'Sound / PA / AV': { label: 'Sound and public address', group: 1, owner: 'Ground Operations Officer with Communications Squadron', fund: 'AP', fundNote: 'Basic public address is an essential facility: appropriated funds.',
      facts: [['Essential facilities, including basic public address, use appropriated funds only.', A('6.6')]],
      spec: ['Length of the crowd line to cover', 'Setup, operating and teardown dates', 'Operator on site for all show hours', 'Tie-in to the Air Boss and announcer', 'Power source: base power or contractor generators'] },
    'Air show management / turnkey': { label: 'Event management or turnkey support', group: 1, owner: 'Open House Director', fund: 'AP', fundNote: 'Follows the funding of each element inside the package.',
      facts: [['Inherently governmental functions are performed by Air Force personnel. Check each duty before contracting it.', A('1.15'), A('1.17')], ['The director coordinates all open house contracts and agreements with Legal, FSS, Contracting and the Comptroller.', A('2.14.7')], ['A package that mixes NAF and appropriated dollars follows FAR procedures.', N('3.9.4')]],
      spec: ['Every service inside the package, listed separately with quantities', 'Which elements are appropriated and which are NAF', 'Who on the staff the contractor answers to'] },
    'Smoke oil': { label: 'Smoke oil', group: 1, owner: 'Logistics Readiness Squadron (Fuels)', fund: 'A', fundNote: 'Appropriated funds for DoD demonstration teams and warbirds.', facts: [['Smoke oil for DoD demonstration teams is an appropriated fund cost.', A('Att 4')], ['Team support manuals set the type and quantity. The director ensures they are reviewed and met.', A('2.14.8')]], spec: ['Type and specification from each team support manual', 'Quantity in gallons and container size', 'Delivery date and pumping equipment'] },
    'Fuel (AVGAS)': { label: 'Aviation fuel (AVGAS)', group: 1, owner: 'Logistics Readiness Squadron (Fuels)', fund: 'A|NP', fundNote: 'Warbirds: appropriated funds. Civilian acts: NAF contract or cash sales.',
      facts: [['Government fuel may be provided to warbirds under the contract.', A('6.3')], ['Civilian acts get Government fuel only under a NAF contract. Otherwise the installation may authorize working capital fund fuel cash sales.', A('6.4')]],
      spec: ['Grade (for example 100LL) and gallons', 'Truck or storage and dispensing equipment', 'Delivery date, on-site dates and pickup date', 'Who is authorized to receive fuel'] },
    'Arresting gear / airfield': { label: 'Arresting gear and airfield support', group: 1, owner: 'Civil Engineer Squadron and Airfield Operations', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Mobile aircraft arresting gear for DoD demonstration teams is an appropriated fund cost.', A('Att 4')], ['The installation complies with demonstration team support manuals.', A('2.13.9')]], spec: ['Requirement from the team support manual', 'Runway and installation dates'] },
    'Portable toilets / sanitation': { label: 'Portable toilets and hand washing', group: 2, owner: 'Civil Engineer Squadron', fund: 'A', fundNote: 'Essential sanitation: appropriated funds.',
      facts: [['The installation provides free water and restroom facilities.', A('1.11.2')], ['Essential facilities for sanitation and health use appropriated funds only.', A('6.6')], ['Rental contracts include pumping and resupply for each day of use.', A('Table A2.1')], ['Premium restrooms may be offered as an FSS concession.', A('1.13.6')]],
      spec: ['Expected attendance per day', 'Number of standard units, accessible (ADA) units and hand wash stations', 'Service frequency: each night, and during show hours if needed', 'Delivery, in-place and removal dates and times', 'Placement map and base access for service trucks'] },
    'Tents / tables / chairs / staging': { label: 'Tents, tables, chairs, bleachers, staging', group: 2, owner: 'Ground Operations Officer', fund: 'AP', fundNote: 'Appropriated funds or private gift, depending on what the item supports.',
      facts: [['Space for weather protection and seating may be provided, including reserved seating for attendees who are disabled, elderly or pregnant.', A('1.13.5')], ['The commander\'s hospitality tent is one tent paid with appropriated funds, with no sponsor or signage.', A('1.13.1')], ['Tents, bleachers or chairs may also be rented to the public as an FSS concession.', A('1.13.6')]],
      spec: ['Each tent by size and whether it has sides, flooring, lighting', 'Tables and chairs by count and type', 'Bleacher or stage size and capacity', 'Setup complete date and teardown date', 'Wind rating and anchoring method allowed on the ramp'] },
    'Transportation / shuttle': { label: 'Shuttle buses', group: 2, owner: 'Logistics Readiness Squadron', fund: 'A', fundNote: 'Appropriated funds. No fee to the public.',
      facts: [['No charge for admission, parking or viewing.', A('1.11')], ['Before anyone makes a verbal or written agreement for transportation, it is coordinated with the contracting officer.', A('Table A2.1')]],
      spec: ['Number of buses, seats per bus, accessible buses', 'Routes, pickup points and hours each day', 'Dispatchers at loading zones', 'Surge or standby buses'] },
    'Parking / traffic': { label: 'Parking and traffic management', group: 2, owner: 'Security Forces with Ground Operations', fund: 'A', fundNote: 'Appropriated funds. No fee to the public.', facts: [['No charge for parking.', A('1.11')], ['Parking and passes are an appropriated fund cost.', A('Att 4')]], spec: ['Expected vehicles per day', 'Lots and routes to manage, on and off base', 'Staff count and hours', 'Signs, cones, light towers and barricades'] },
    'Fencing / barricades / crowd control': { label: 'Fencing, barricades, crowd line', group: 2, owner: 'Civil Engineer Squadron with Security Forces', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Barricades and crowd control devices are purchased, leased or borrowed in time for the event.', A('Table A2.1')], ['The crowd line is the physical line that keeps spectators at safe distances.', A('Att 1')]], spec: ['Linear feet by type (bike rack, fence panel, water barrier)', 'Delivery, setup and removal dates', 'Who installs: contractor or base'] },
    'Security screening': { label: 'Security screening equipment', group: 2, owner: 'Security Forces', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Crowd control, security and first aid are funded with appropriated funds.', A('6.7')], ['The installation commander appoints an Antiterrorism Officer.', A('2.13.7')]], spec: ['Number of lanes or walk-through units and hand wands', 'Rental or purchase', 'Delivery, training and pickup dates', 'Power at each entry point'] },
    'Medical / EMS': { label: 'Medical and ambulance support', group: 2, owner: 'Medical Group', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Plans cover health emergencies and placement of air evacuation helicopters if needed.', A('3.1.9')], ['First aid is an appropriated fund cost.', A('6.7')]], spec: ['Number of ambulances and crews, and level of care', 'Hours on site', 'First aid station locations', 'What the base medical group covers organically'] },
    'Waste / trash': { label: 'Trash and waste removal', group: 2, owner: 'Civil Engineer Squadron', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Trash containers and disposal are an appropriated fund cost.', A('Att 4')], ['Base service contracts are coordinated well in advance. They may need a modification and added funding.', A('8.3')]], spec: ['Containers by size and count', 'Pickup frequency during and after the show', 'Whether the existing refuse contract can be modified'] },
    'Power / lighting': { label: 'Generators and lighting', group: 2, owner: 'Civil Engineer Squadron', fund: 'AP', fundNote: 'Appropriated funds or private gift, depending on what it supports.', facts: [['Power outlets are an appropriated fund cost.', A('Att 4')], ['Construction and electrical permits are arranged during long-term planning.', A('Table A2.1')]], spec: ['Generators by size, fuel and run hours', 'Light towers by count and location', 'Distribution: cables, panels, ramps'] },
    'Water / ice': { label: 'Water and ice', group: 2, owner: 'Force Support Squadron with Public Health', fund: '', fundNote: 'Free water for the public is required. Bottled water is not an appropriated fund cost except as AFI 65-601 allows. Confirm the source of funds with FM.', facts: [['The installation provides free water.', A('1.11.2')], ['Bottled water may not be bought with appropriated funds except as AFI 65-601 allows.', A('1.11.2.1')], ['Bioenvironmental Engineering and Public Health do water and food vulnerability assessments.', A('3.1.11')]], spec: ['How free water reaches the crowd: water buffalos, misting stations, fountains', 'Ice quantity and storage'] },
    'Radios / comms': { label: 'Radios and communications', group: 2, owner: 'Communications Squadron', fund: 'A', fundNote: 'Appropriated funds.', facts: [['Ground communications and air-to-ground radio are appropriated fund costs.', A('Att 4')]], spec: ['Number of handhelds, channels and repeaters', 'Air-to-ground radio for the control point', 'Rental dates'] },
    'Rental vehicles / golf carts': { label: 'Rental vehicles and golf carts', group: 3, owner: 'Logistics Readiness Squadron', fund: 'AP', fundNote: 'Appropriated funds for official support.', facts: [['Car rentals by performers or others under contracts or travel orders are reimbursed by the Air Force.', A('Table A2.1')], ['Demonstration team support manuals list the vehicles each team needs.', A('2.14.8')]], spec: ['Vehicles by type and count for each team or function', 'Pickup and return dates and location', 'Golf carts or utility vehicles by seat count'] },
    'Lodging': { label: 'Lodging for performers and teams', group: 3, owner: 'Force Support Squadron', fund: 'A|NP', fundNote: 'Military teams and warbirds: appropriated funds. Civilian performers: NAF or private.', facts: [['Lodging, meals and transportation for military demonstration crews are appropriated fund costs.', A('6.2')], ['Warbird lodging and meals may be paid with appropriated funds.', A('6.3')], ['Costs for civilian performers come from private or NAF sponsorship funds.', A('6.4')]], spec: ['Rooms by night for each team or performer', 'Distance from base and parking', 'Who the rooms are for, so funding can be split correctly'] },
    'Signs / printing / marketing': { label: 'Signs, programs, advertising', group: 3, owner: 'Public Affairs', fund: 'ANP', fundNote: 'Event guides: appropriated funds. Souvenir programs: NAF or private. Advertising: see para 6.8.', facts: [['Government-funded advertising needs substantial justification and Public Affairs approval. Public service announcements are used first.', A('6.8')], ['Paid or donated ads carry a no-endorsement disclaimer.', A('Att 4')]], spec: ['Each item by size, quantity and material', 'Proof and delivery dates', 'Who approves content'] },
    'Concessions (NAF)': { label: 'Food, beverage and souvenir concessions', group: 4, owner: 'Force Support Squadron', fund: 'N', fundNote: 'NAF. The FAR does not apply.',
      facts: [['Food, beverage and souvenir sales are restricted to FSS or its concessionaires.', A('6.10')], ['Concession contracts follow NAF contracting rules, are competed to the maximum extent practical, and a sole source needs written justification approved by the Staff Judge Advocate and contracting officer.', A('5.3.1')], ['Commodity concessionaire contracts for air shows fall under unlimited NAF contracting officer authority. The Mission Support Group Commander approves concessionaire contracts.', N('3.3.6'), N('1.2.3.2')], ['Concessionaire services over $2,500 where service labor standards apply go to the servicing contracting office.', N('5.1.4')]],
      spec: ['Expected attendance per day', 'Exclusive or non-exclusive', 'Fee or percentage back to FSS', 'Carve-outs such as food for performers and volunteers'] },
    'Kid zone / entertainment': { label: 'Kids area and entertainment', group: 4, owner: 'Force Support Squadron', fund: 'NP', fundNote: 'NAF or private gifts.', facts: [['Only FSS may contract kids area activities and charge a fee. Adult mechanical rides and games of chance are prohibited.', A('5.1.6')], ['Commercial sponsorship may fund FSS elements, including a kids area.', A('1.3.1')], ['Entertainment contracts under NAF get legal review at any dollar value.', N('2.6.1.1')]], spec: ['Attractions by type and count', 'Operating hours and staffing', 'Insurance certificates'] }
  };

  /* ---------- lane logic shared by the requirements plan and the sole source builder ---------- */
  ASB.lane = function (funds, amt, scls) {
    const T = ASB.T, m = ASB.money;
    if (funds === 'NAF') {
      if (amt <= T.NAF_NOCOMP) return { key: 'naf1', name: 'NAF, ' + m(T.NAF_NOCOMP) + ' or less', rule: 'Competition is not required. The contracting officer\'s signature certifies the price is fair and reasonable.', c: [N('6.6.1')] };
      if (amt <= T.NAF_TWO) return { key: 'naf2', name: 'NAF, over ' + m(T.NAF_NOCOMP) + ' to ' + m(T.NAF_TWO), rule: 'At least two sources are solicited, unless a sole source justification is accepted.', c: [N('6.6.2'), N('6.8')] };
      return { key: 'naf3', name: 'NAF, over ' + m(T.NAF_TWO), rule: 'At least three sources are solicited, unless a sole source justification is accepted. Legal review is required for the justification.', c: [N('6.6.3'), N('2.6.2')] };
    }
    const mpt = scls === 'yes' ? T.MPT_SCLS : T.MPT;
    if (amt <= mpt) return { key: 'micro', name: 'Micro-purchase (' + m(mpt) + ' or less)', rule: 'May be awarded without competitive quotes if the price is considered reasonable. No single-source documentation is required.', c: [['far12', '12.402(b)'], ['far2', '2.101']] };
    if (amt <= T.SAT) return { key: 'sap', name: 'Simplified procedures (over ' + m(mpt) + ' to ' + m(T.SAT) + ')', rule: 'Request for quotations, then a purchase order. A single source is documented in the file with the basis for the decision.', c: [['far12', '12.201-1'], ['far12', '12.102(a)']] };
    return { key: 'oversat', name: 'Over the simplified acquisition threshold (' + m(T.SAT) + ')', rule: 'A single source needs a written justification with the content in 6.104-1, approved under 6.104-2. The contracting officer certifies it up to ' + m(T.CO_CERT) + '.', c: [['far12', '12.102(b)'], ['far6', '6.104-1'], ['far6', '6.104-2']] };
  };
})();
