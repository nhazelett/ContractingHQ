(function () {
  // Navbar scroll effect
  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // Mobile hamburger toggle
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }

  // More dropdown: click toggle on mobile, close on outside click
  document.querySelectorAll('.nav-more-toggle').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var parent = btn.closest('.nav-more');
      if (parent) parent.classList.toggle('open');
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-more')) {
      document.querySelectorAll('.nav-more.open').forEach(function (el) {
        el.classList.remove('open');
      });
    }
    if (!e.target.closest('.navbar') && links) {
      links.classList.remove('open');
    }
  });
})();

// ══════════════════════════════════════════════
// TRAINING NAV — prev / next between topics
// ══════════════════════════════════════════════
// Add new topics here in order. That's it — pages auto-render.
(function () {
  var TRAINING_CHAIN = [
    ["far-research.html", "Researching the FAR & Supplements"],
    ["market-research.html", "Market Research"],
    ["naics.html", "NAICS Codes"],
    ["fsc-codes.html", "PSC / FSC Codes"],
    ["purchase-requests.html", "Evaluating Purchase Requests"],
    ["funding-color-of-money.html", "Funding & Color of Money"],
    ["statements-of-work.html", "Statements of Work"],
    ["performance-work-statements.html", "Performance Work Statements"],
    ["statements-of-objectives.html", "Statements of Objectives"],
    ["contract-action-reports.html", "Preparing Contract Action Reports"],
    ["writing-mfrs.html", "Writing MFRs"],
    ["contract-closeout.html", "Closeout of Contract Files"],
    ["publicizing-contract-actions.html", "Publicizing Proposed Contract Actions"],
    ["publicizing-awards.html", "Publicizing Awards"],
    ["evaluating-justifications.html", "Evaluating Brand Name J&As"],
    ["far-part6-competition.html", "Other Than Full & Open Competition"],
    ["far-part8-limiting-sources.html", "Limiting Sources"],
    ["far-part16-fair-opportunity.html", "Exceptions to Fair Opportunity"],
    ["far-part12-restricting-competition.html", "Restricting Competition for Commercial Items"],
    ["commercial-competition-statutes.html", "Competition Statutes for Commercial Buys"],
    ["commercial-item-df.html", "Preparing a Commercial Item D&F"],
    ["provisions-clauses-commercial.html", "Selecting Provisions and Clauses"],
    ["simplified-solicitations-commercial.html", "Simplified Solicitations for Commercial Items"],
    ["evaluating-quotations.html", "Evaluating Quotations"],
    ["price-fair-reasonable.html", "Price Fair and Reasonableness"],
    ["delivery-orders-vs-task-orders.html", "Delivery Orders vs. Task Orders"],
    ["gsa-orders-sat.html", "GSA Delivery Orders under the SAT"],
    ["gsa-orders-above-sat.html", "GSA Orders above the SAT"],
    ["blanket-purchase-agreements.html", "BPAs"],
    ["idiq-single-award.html", "Single-Award IDIQ Orders"],
    ["idiq-multiple-award.html", "Multiple-Award IDIQ Orders"],
    ["government-purchase-cards.html", "Government Purchase Cards"],
    ["sf30-modifications.html", "SF 30s for Modifications and Amendments"],
    ["pnm.html", "Price Negotiation Memorandums"],
    ["options.html", "Options"],
    ["unilateral-bilateral-modifications.html", "Unilateral vs. Bilateral Modifications"],
    ["small-business-coordination.html", "2579s"],
    ["wage-determinations.html", "Wage Determinations"],
    ["personal-vs-non-personal-services.html", "Personal vs. Non-personal Services"],
    ["cor-type-a-training.html", "COR Training for Type A Requirements"],
    ["manual-contracts-deployed.html", "Manual Contracts in a Deployed Environment"],
    ["rfp-preparation.html", "Preparing an RFP: C-Type Contracts"],
    ["rfp-preparation-dtype.html", "Preparing an RFP: D-Type Contracts"],
    ["past-performance.html", "Evaluating Past Performance"],
    ["reviewing-tech-evals.html", "Reviewing Technical Evaluations"],
    ["cost-price-analysis.html", "Cost & Price Analysis"],
    ["conducting-negotiations.html", "Conducting Negotiations"],
    ["comparative-analysis.html", "Comparative Analysis"],
    ["award-decision-documents.html", "Award Decision Documents"],
    ["award-notice-letters.html", "Award Notice Letters"],
    ["debriefing-unsuccessful-offerors.html", "Debriefing Unsuccessful Offerors"],
    ["notice-to-proceed.html", "Notice to Proceed"],
    ["preconstruction-conferences.html", "Preconstruction Conferences"],
    ["material-submittals.html", "Material Submittals"],
    ["monitoring-contractor-progress.html", "Monitoring Contractor Progress"],
    ["cpars.html", "CPARS"],
    ["contract-specific-cor-training.html", "Contract-Specific COR Training"],
    ["annual-cor-file-reviews.html", "Annual COR File Reviews"],
    ["evaluating-labor-standards.html", "Evaluating Contract Labor Standards"],
    ["requirements-approval-documents.html", "Requirements Approval Documents"],
    ["cure-notices.html", "Cure Notices"],
    ["show-cause-letters.html", "Show-Cause Letters"],
    ["preparing-ratifications.html", "Preparing Ratifications"],
    ["pick-the-path.html", "Pick the Path"],
    ["contingency-contracting.html", "Contingency Contracting"],
    ["source-selection-guide.html", "Major Source Selection Guide"],
    ["warrant-board.html", "Warrant Board Prep"],
    ["sat-warrant-board.html", "SAT Warrant Board Prep"],
    ["cso.html", "Commercial Solutions Opening"],
    ["ota.html", "Other Transaction Authority"],
    ["naf-contracting.html", "NAF Contracting"],
    ["jeopardy.html", "Contracting Jeopardy"]
  ];

  window.KTHQ_TRAINING_CHAIN = TRAINING_CHAIN;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function currentTrainingIndex() {
    var page = location.pathname.split("/").pop() || "index.html";
    for (var i = 0; i < TRAINING_CHAIN.length; i += 1) {
      if (TRAINING_CHAIN[i][0] === page) return i;
    }
    return -1;
  }

  function removeInlineTrainingNav() {
    document.querySelectorAll(".training-nav-band").forEach(function (band) {
      if (band.classList.contains("training-nav-auto") || band.querySelector("#training-nav, #training-nav-top")) {
        if (band.parentNode) band.parentNode.removeChild(band);
      }
    });
  }

  function addFloatingTrainingButton(direction, target, label, container) {
    var button = document.createElement("a");
    button.className = "training-floating-nav training-" + direction + "-float training-nav-auto";
    button.href = target[0];
    button.setAttribute("aria-label", label + ": " + target[1]);
    if (direction === "prev") {
      button.innerHTML = '<em>&larr;</em><span>' + esc(label) + '</span><strong>' + esc(target[1]) + '</strong>';
    } else {
      button.innerHTML = '<span>' + esc(label) + '</span><strong>' + esc(target[1]) + '</strong><em>&rarr;</em>';
    }
    (container || document.body).appendChild(button);
  }

  function mountTrainingNav() {
    document.querySelectorAll(".training-nav-auto, .training-prev-float, .training-next-float, #training-float-nav").forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    var idx = currentTrainingIndex();
    if (idx === -1) return;
    removeInlineTrainingNav();

    var prev = idx > 0 ? TRAINING_CHAIN[idx - 1] : null;
    var next = idx < TRAINING_CHAIN.length - 1 ? TRAINING_CHAIN[idx + 1] : null;

    var floatNav = document.createElement("nav");
    floatNav.id = "training-float-nav";
    floatNav.setAttribute("aria-label", "Training navigation");
    document.body.appendChild(floatNav);

    addFloatingTrainingButton("prev", prev || ["training.html", "Training Home"], prev ? "Previous Training" : "Training Home", floatNav);
    addFloatingTrainingButton("next", next || ["training.html", "Training Home"], next ? "Next Training" : "Training Home", floatNav);
  }

  window.KTHQ_mountTrainingNav = mountTrainingNav;
  mountTrainingNav();
})();


// ══════════════════════════════════════════════
// BOTTOM TAB BAR — clone top tabs to bottom
// ══════════════════════════════════════════════
// Automatically duplicates the tab bar at the bottom of the content area
// so users can switch tabs without scrolling back up. Zero per-page config.
(function () {
  var topTabs = document.querySelector('[role="tablist"]');
  if (!topTabs) return;

  // Clone the tab bar
  var bottomTabs = topTabs.cloneNode(true);
  bottomTabs.removeAttribute('id');
  bottomTabs.classList.add('tablist-bottom');
  bottomTabs.setAttribute('aria-label', 'Tab navigation (bottom)');

  // Find the content bg wrapper (parent of the top tabs) and append clone at end
  var bgWrapper = topTabs.parentElement;
  if (bgWrapper) bgWrapper.appendChild(bottomTabs);

  // Get all tab buttons from both bars
  var topButtons = topTabs.querySelectorAll('[data-tab]');
  var bottomButtons = bottomTabs.querySelectorAll('[data-tab]');

  // Sync: clicking a bottom tab activates the matching top tab and scrolls up
  bottomButtons.forEach(function (btn, i) {
    // Remove any cloned event listeners by replacing with clean clone
    var clean = btn.cloneNode(true);
    btn.parentNode.replaceChild(clean, btn);
    bottomButtons[i] = clean;

    clean.addEventListener('click', function () {
      // Trigger the top tab's click (which handles panel switching)
      if (topButtons[i]) topButtons[i].click();

      // Scroll the top tabs into view
      topTabs.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Sync active state on bottom bar
      syncBottom();
    });
  });

  // Keep bottom bar in sync whenever a top tab is clicked
  topButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      syncBottom();
    });
  });

  function syncBottom() {
    // Short delay to let the top tab handler finish
    setTimeout(function () {
      topButtons.forEach(function (tb, j) {
        if (tb.classList.contains('active')) {
          bottomButtons[j].classList.add('active');
        } else {
          bottomButtons[j].classList.remove('active');
        }
      });
    }, 10);
  }

  // Initial sync
  syncBottom();
})();



// ══════════════════════════════════════════════
// A11Y — TABLIST BEHAVIOR (aria-selected sync + arrow keys)
// ══════════════════════════════════════════════
(function () {
  function syncTablist(tablist, activeTab) {
    tablist.querySelectorAll('[role="tab"]').forEach(function (t) {
      t.setAttribute('aria-selected', t === activeTab ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    var list = tab.closest('[role="tablist"]');
    if (list) syncTablist(list, tab);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    if (!e.target || !e.target.closest) return;
    var tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    var list = tab.closest('[role="tablist"]');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab);
    var next = e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
      : e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
      : e.key === 'Home' ? tabs[0] : tabs[tabs.length - 1];
    if (next) { e.preventDefault(); next.focus(); next.click(); }
  });
})();
