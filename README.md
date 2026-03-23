<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ContractingHQ | KTHQ — The One-Stop Resource for Contracting Officers</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>

  <!-- NAV -->
  <nav class="navbar" id="navbar">
    <div class="nav-inner">
      <a href="#home" class="nav-logo">
        <span class="logo-kthq">KTHQ</span>
        <span class="logo-full">ContractingHQ</span>
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" id="navLinks">
        <li><a href="#welcome">Welcome</a></li>
        <li><a href="#training">Training</a></li>
        <li><a href="#gao">GAO Updates</a></li>
        <li><a href="#tools">Tools</a></li>
        <li><a href="#far">FAR Updates</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero" id="home">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <div class="hero-badge">KTHQ — ContractingHQ</div>
      <h1 class="hero-title">The One-Stop Resource<br />for Contracting Officers</h1>
      <p class="hero-sub">Practitioner-led. No fluff. Built by a CO, for COs.<br />Start at zero — grow as far as you want to go.</p>
      <div class="hero-cta">
        <a href="#welcome" class="btn btn-primary">Get Started</a>
        <a href="#training" class="btn btn-outline">Watch Training</a>
      </div>
    </div>
    <div class="hero-stats">
      <div class="stat"><span class="stat-num">5</span><span class="stat-label">Core Sections</span></div>
      <div class="stat-divider"></div>
      <div class="stat"><span class="stat-num">Weekly</span><span class="stat-label">GAO Updates</span></div>
      <div class="stat-divider"></div>
      <div class="stat"><span class="stat-num">Live</span><span class="stat-label">FAR Overhaul Tracking</span></div>
      <div class="stat-divider"></div>
      <div class="stat"><span class="stat-num">Free</span><span class="stat-label">Always</span></div>
    </div>
  </section>

  <!-- WELCOME -->
  <section class="section" id="welcome">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Welcome</span>
        <h2>Your Senior CO, On Demand</h2>
        <p class="section-desc">Think of this as having an experienced contracting officer looking over your shoulder — one who's been through it, who knows the shortcuts and the landmines, and who's here to help you succeed.</p>
      </div>
      <div class="welcome-grid">
        <div class="welcome-card">
          <div class="wc-icon">📋</div>
          <h3>Built for New COs</h3>
          <p>Start with the fundamentals — the meat and potatoes every contracting officer needs from day one. No assumed knowledge, no jargon without explanation.</p>
        </div>
        <div class="welcome-card">
          <div class="wc-icon">📈</div>
          <h3>Scale as You Grow</h3>
          <p>As your experience builds, so does ContractingHQ. Dive deeper into complex topics, edge cases, and advanced techniques whenever you're ready.</p>
        </div>
        <div class="welcome-card">
          <div class="wc-icon">⚡</div>
          <h3>Practitioner Knowledge</h3>
          <p>This isn't doctrine. This is what actually works in the field — lessons learned, real scenarios, and the kind of context you only get from someone who's done the job.</p>
        </div>
        <div class="welcome-card">
          <div class="wc-icon">🔄</div>
          <h3>Always Current</h3>
          <p>Weekly GAO updates, live FAR overhaul tracking, and tools that keep you ahead of changes — not scrambling to catch up.</p>
        </div>
      </div>
      <div class="disclaimer">
        <p>ContractingHQ is an independent, practitioner-built resource. It is not affiliated with, endorsed by, or sponsored by the U.S. Air Force, the Department of Defense, or any government agency.</p>
      </div>
    </div>
  </section>

  <!-- TRAINING -->
  <section class="section section-alt" id="training">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Training</span>
        <h2>Training</h2>
        <p class="section-desc">Practical, scenario-based videos covering the contracting topics that matter most. Built for the way real COs learn — not the way regulations are written.</p>
      </div>
      <div class="video-grid" id="videoGrid">
        <!-- Populated by videos.js -->
      </div>
    </div>
  </section>

  <!-- GAO UPDATES -->
  <section class="section" id="gao">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">GAO Updates</span>
        <h2>Weekly GAO Decision Summaries</h2>
        <p class="section-desc">The most relevant bid protest decisions — summarized in plain language with practitioner takeaways. Updated every week.</p>
      </div>
      <div class="gao-current" id="gaoCurrentWeek">
        <!-- Populated by gao.js -->
      </div>
      <div class="gao-archive-wrapper">
        <h3 class="archive-title">Previous Weeks</h3>
        <div class="gao-archive" id="gaoArchive">
          <!-- Populated by gao.js -->
        </div>
      </div>
    </div>
  </section>

  <!-- TOOLS -->
  <section class="section section-alt" id="tools">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Tools</span>
        <h2>Contracting Officer Toolkit</h2>
        <p class="section-desc">Quick-access resources, references, and tools you'll actually use on the job.</p>
      </div>
      <div class="tools-grid" id="toolsGrid">
        <!-- Populated by tools.js -->
      </div>
    </div>
  </section>

  <!-- FAR UPDATES -->
  <section class="section" id="far">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">FAR Updates</span>
        <h2>FAR Overhaul Tracker</h2>
        <p class="section-desc">The Federal Acquisition Regulation is being overhauled. Here's what's changing, what it means for you, and what to watch.</p>
      </div>
      <div class="far-list" id="farList">
        <!-- Populated by far.js -->
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <span class="logo-kthq">KTHQ</span>
        <span class="footer-tagline">ContractingHQ — Built by practitioners, for practitioners.</span>
      </div>
      <nav class="footer-nav">
        <a href="#welcome">Welcome</a>
        <a href="#training">Training</a>
        <a href="#gao">GAO Updates</a>
        <a href="#tools">Tools</a>
        <a href="#far">FAR Updates</a>
      </nav>
      <p class="footer-disclaimer">Not affiliated with the U.S. Air Force, Department of Defense, or any government agency. For educational purposes only.</p>
      <p class="footer-copy">&copy; 2025 ContractingHQ. All rights reserved.</p>
    </div>
  </footer>

  <script src="data/videos.js"></script>
  <script src="data/gao.js"></script>
  <script src="data/tools.js"></script>
  <script src="data/far.js"></script>
  <script src="main.js"></script>
</body>
</html>
