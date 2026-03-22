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
