(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const btn = nav.querySelector('.menu');
  const scrim = document.querySelector('.nav-scrim');
  const panel = document.getElementById('nav-menu');

  const story = document.getElementById('story');
  if (story) {
    nav.classList.remove('solid');
    new IntersectionObserver(
      (entries) => nav.classList.toggle('solid', !entries[0].isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    ).observe(story);
  }

  const sectores = document.getElementById('sectores');
  if (sectores && document.body.classList.contains('home')) {
    const mark = (key) => {
      document.querySelectorAll('[data-nav]').forEach((link) => {
        if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };
    new IntersectionObserver(
      (entries) => mark(entries[0].isIntersecting ? 'sectores' : 'inicio'),
      { rootMargin: '-40% 0px -50% 0px' },
    ).observe(sectores);
  }

  if (!btn || !scrim || !panel) return;

  let open = false;
  let closeTimer = 0;
  let scrollY = 0;

  const focusables = () =>
    [...panel.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null || panel.contains(el));

  const lock = (on) => {
    document.documentElement.classList.toggle('nav-open', on);
    if (on) {
      scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    }
  };

  const finishClose = () => {
    if (open) return;
    panel.hidden = true;
    scrim.hidden = true;
  };

  const close = (restore = true, immediate = false) => {
    if (!open) return;
    open = false;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Abrir menú');
    panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    lock(false);
    clearTimeout(closeTimer);
    if (immediate) {
      finishClose();
      if (restore && btn.offsetParent !== null) btn.focus();
      return;
    }
    const done = () => {
      finishClose();
      panel.removeEventListener('transitionend', onEnd);
    };
    const onEnd = (event) => {
      if (event.target !== panel || event.propertyName !== 'opacity') return;
      done();
    };
    panel.addEventListener('transitionend', onEnd);
    closeTimer = window.setTimeout(done, 400);
    if (restore && btn.offsetParent !== null) btn.focus();
  };

  const openMenu = () => {
    if (open) return;
    open = true;
    clearTimeout(closeTimer);
    panel.hidden = false;
    scrim.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Cerrar menú');
    lock(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!open) return;
        panel.classList.add('is-open');
        scrim.classList.add('is-open');
      });
    });
    const first = panel.querySelector('a[href]');
    if (first) first.focus();
  };

  btn.addEventListener('click', () => {
    if (open) close();
    else openMenu();
  });

  scrim.addEventListener('click', () => close());
  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => close());
  });

  document.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = [btn, ...focusables()];
    const index = nodes.indexOf(document.activeElement);
    event.preventDefault();
    if (index === -1) {
      nodes[event.shiftKey ? nodes.length - 1 : 1].focus();
      return;
    }
    const next = event.shiftKey
      ? (index - 1 + nodes.length) % nodes.length
      : (index + 1) % nodes.length;
    nodes[next].focus();
  });

  const wide = window.matchMedia('(min-width: 901px)');
  wide.addEventListener('change', () => {
    if (wide.matches) close(false, true);
  });
})();
