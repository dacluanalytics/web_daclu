(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const btn = nav.querySelector('.menu');
  const links = nav.querySelector('.links');
  const close = () => {
    if (!btn || !links) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Abrir menú');
    links.classList.remove('open');
  };
  btn?.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    btn.setAttribute('aria-label', open ? 'Abrir menú' : 'Cerrar menú');
    links.classList.toggle('open', !open);
  });
  links?.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  const story = document.getElementById('story');
  if (story) {
    nav.classList.remove('solid');
    new IntersectionObserver(
      (entries) => nav.classList.toggle('solid', !entries[0].isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    ).observe(story);
  }
})();
