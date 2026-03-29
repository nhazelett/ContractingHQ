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
    ["far-research.html", "Researching the FAR"],
    ["market-research.html", "Market Research"],
    ["naics.html", "NAICS Codes"],
    ["fsc-codes.html", "PSC / FSC Codes"],
    ["purchase-requests.html", "Evaluating Purchase Requests"],
    ["statements-of-work.html", "Statements of Work"],
    ["performance-work-statements.html", "Performance Work Statements"],
    ["statements-of-objectives.html", "Statements of Objectives"],
    ["contract-action-reports.html", "Contract Action Reports"],
    ["writing-mfrs.html", "Writing MFRs"],
    ["contract-closeout.html", "Closeout of Contract Files"],
    ["publicizing-contract-actions.html", "Publicizing Contract Actions"],
    ["publicizing-awards.html", "Publicizing Awards"],
    ["evaluating-justifications.html", "Evaluating Brand Name J&As"],
    ["far-part6-competition.html", "Other Than Full & Open (FAR 6)"],
    ["far-part8-limiting-sources.html", "Limiting Sources (FAR 8)"],
    ["far-part16-fair-opportunity.html", "Fair Opportunity (FAR 16)"],
    ["far-part12-restricting-competition.html", "Restricting Competition (FAR 12)"],
    ["commercial-item-df.html", "Commercial Item D&F"],
    ["provisions-clauses-commercial.html", "Provisions & Clauses"],
    ["simplified-solicitations-commercial.html", "Simplified Solicitations"],
    ["evaluating-quotations.html", "Evaluating Quotations"],
    ["price-fair-reasonable.html", "Price Fair & Reasonable"],
    ["delivery-orders-vs-task-orders.html", "Delivery Orders vs Task Orders"],
    ["government-purchase-cards.html", "Government Purchase Cards"],
    ["gsa-orders-sat.html", "GSA Orders under the SAT"],
    ["gsa-orders-above-sat.html", "GSA Orders above the SAT"]
  ];

  // Find current page in chain
  var page = location.pathname.split("/").pop() || "";
  var idx = -1;
  for (var i = 0; i < TRAINING_CHAIN.length; i++) {
    if (TRAINING_CHAIN[i][0] === page) { idx = i; break; }
  }
  if (idx === -1) return;

  function esc(s) { return s.replace(/&/g, "&amp;"); }

  var prev = idx > 0 ? TRAINING_CHAIN[idx - 1] : null;
  var next = idx < TRAINING_CHAIN.length - 1 ? TRAINING_CHAIN[idx + 1] : null;

  // Build nav HTML (shared by top and bottom)
  function buildNav() {
    var html = "";
    if (prev) {
      html += '<a href="' + prev[0] + '" class="tn-prev">'
            + '<span class="tn-arrow">&larr;</span>'
            + '<span class="tn-text"><span class="tn-label">Previous</span>'
            + '<span class="tn-title">' + esc(prev[1]) + '</span></span></a>';
    } else {
      html += '<a href="training.html" class="tn-prev">'
            + '<span class="tn-arrow">&larr;</span>'
            + '<span class="tn-text"><span class="tn-label">Back to</span>'
            + '<span class="tn-title">Training Home</span></span></a>';
    }
    if (next) {
      html += '<a href="' + next[0] + '" class="tn-next">'
            + '<span class="tn-text"><span class="tn-label">Next Training</span>'
            + '<span class="tn-title">' + esc(next[1]) + '</span></span>'
            + '<span class="tn-arrow">&rarr;</span></a>';
    } else {
      html += '<a href="training.html" class="tn-next">'
            + '<span class="tn-text"><span class="tn-label">Complete!</span>'
            + '<span class="tn-title">Training Home</span></span>'
            + '<span class="tn-arrow">&rarr;</span></a>';
    }
    return html;
  }

  var navHTML = buildNav();

  // Render into bottom nav
  var bottom = document.getElementById("training-nav");
  if (bottom) bottom.innerHTML = navHTML;

  // Render into top nav
  var top = document.getElementById("training-nav-top");
  if (top) top.innerHTML = navHTML;
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
