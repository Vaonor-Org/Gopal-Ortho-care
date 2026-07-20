(function () {
  function inferActivePage(pathname) {
    var path = (pathname || '').toLowerCase();
    if (path.indexOf('/about') !== -1) return 'about';
    if (path.indexOf('/services') !== -1) return 'services';
    if (path.indexOf('/gallery') !== -1) return 'gallery';
    if (path.indexOf('/patients') !== -1) return 'patients';
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
    var drawer = document.getElementById('mobile-drawer');
    var toggle = document.getElementById('mobile-toggle');
    var closeBtn = document.getElementById('drawer-close');

    function updateHeaderOnScroll() {
      var currentScrollY = window.scrollY;

      if (navbar) {
        navbar.classList.toggle('scrolled', currentScrollY > 40);
      }
    }

    updateHeaderOnScroll();
    window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });

    function openDrawer() {
      if (!drawer || !toggle) return;
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (!drawer || !toggle) return;
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
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

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#mobile-toggle')) {
        openDrawer();
      }
      if (e.target.closest && e.target.closest('#drawer-close')) {
        closeDrawer();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100) {
        closeDrawer();
      }
    });

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
