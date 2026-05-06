(function () {
  function inferActivePage(pathname) {
    var path = (pathname || '').toLowerCase();
    if (path.indexOf('/about') !== -1) return 'about';
    if (path.indexOf('/services') !== -1) return 'services';
    if (path.indexOf('/gallery') !== -1) return 'gallery';
    if (path.indexOf('/doctors') !== -1) return 'doctors';
    if (path.indexOf('/contact') !== -1) return 'contact';
    if (path.indexOf('/booking') !== -1) return 'booking';
    return 'home';
  }

  function setActiveLinks(root, activePage) {
    var navLinks = root.querySelectorAll('.nav-link[data-page]');
    navLinks.forEach(function (link) {
      var isActive = link.getAttribute('data-page') === activePage;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    var drawerLinks = root.querySelectorAll('.drawer-nav-link[data-page]');
    drawerLinks.forEach(function (link) {
      var isActive = link.getAttribute('data-page') === activePage;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    var bookingCta = root.querySelector('#nav-booking-cta');
    if (bookingCta) {
      var bookingActive = activePage === 'booking';
      bookingCta.classList.toggle('active', bookingActive);
      if (bookingActive) {
        bookingCta.setAttribute('aria-current', 'page');
      } else {
        bookingCta.removeAttribute('aria-current');
      }
    }
  }

  function initHeaderInteractions() {
    var navbar = document.getElementById('navbar');
    var emergencyBar = document.getElementById('emergency-bar');
    var emergencyBarClose = document.getElementById('emergency-bar-close');
    var drawer = document.getElementById('mobile-drawer');
    var toggle = document.getElementById('mobile-toggle');
    var closeBtn = document.getElementById('drawer-close');
    var lastScrollY = window.scrollY;
    var emergencyHideDelta = 12;

    function updateHeaderOnScroll() {
      var currentScrollY = window.scrollY;

      if (navbar) {
        navbar.classList.toggle('scrolled', currentScrollY > 40);
      }

      if (!emergencyBar || document.body.classList.contains('emergency-bar-hidden')) {
        lastScrollY = currentScrollY;
        return;
      }

      var scrollDiff = currentScrollY - lastScrollY;
      if (currentScrollY <= 10) {
        document.body.classList.remove('emergency-bar-collapsed');
      } else if (scrollDiff > emergencyHideDelta) {
        document.body.classList.add('emergency-bar-collapsed');
      } else if (scrollDiff < -emergencyHideDelta) {
        document.body.classList.remove('emergency-bar-collapsed');
      }

      lastScrollY = currentScrollY;
    }

    if (sessionStorage.getItem('gopalEmergencyHidden') === '1') {
      document.body.classList.add('emergency-bar-hidden');
      document.body.classList.remove('emergency-bar-collapsed');
    }

    updateHeaderOnScroll();
    window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });

    if (emergencyBarClose) {
      emergencyBarClose.addEventListener('click', function () {
        document.body.classList.remove('emergency-bar-collapsed');
        document.body.classList.add('emergency-bar-hidden');
        sessionStorage.setItem('gopalEmergencyHidden', '1');
      });
    }

    function openDrawer() {
      if (!drawer || !toggle) return;
      drawer.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (!drawer || !toggle) return;
      drawer.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    if (toggle) toggle.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target === drawer) closeDrawer();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  function loadSharedNavbar(options) {
    var opts = options || {};
    var mountId = opts.mountId || 'site-header';
    var mount = document.getElementById(mountId);
    if (!mount) return;

    var basePath = typeof opts.basePath === 'string' ? opts.basePath : '';
    var componentPath = opts.componentPath || (basePath + 'components/Navbar.html');

    var request = new XMLHttpRequest();
    try {
      request.open('GET', componentPath, false);
      request.send(null);
    } catch (err) {
      console.error('Failed to load shared navbar:', err);
      return;
    }

    if (!((request.status >= 200 && request.status < 300) || request.status === 0)) {
      console.error('Failed to load shared navbar component:', request.status);
      return;
    }

    mount.innerHTML = request.responseText.replace(/\{\{BASE\}\}/g, basePath);

    var activePage = opts.activePage || inferActivePage(window.location.pathname);
    setActiveLinks(mount, activePage);
    initHeaderInteractions();
  }

  window.loadSharedNavbar = loadSharedNavbar;
})();
