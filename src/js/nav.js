import { stopScroll, scrollTo } from './motion.js';

/* Mark the current page in both navigations from one attribute on the
 * body, so the markup carries no duplicated state. */
export function markCurrent() {
  const page = document.body.dataset.page;
  if (!page) return;
  for (const link of document.querySelectorAll(`[data-page="${page}"]`)) {
    link.setAttribute('aria-current', 'page');
  }
}

/* The header inverts to match whatever field is behind it, hides on
 * the way down, returns on the way up, and turns opaque once the first
 * screen is behind you. */
export function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const readline = document.querySelector('.readline');
  let lastY = window.scrollY;
  let ticking = false;

  /* Which sections want a light header. Read once; sections do not move. */
  const darkFields = [...document.querySelectorAll('.field--forest, .field--ink, [data-nav="dark"]')];

  const measure = () => {
    const y = window.scrollY;
    /* Viewport coordinates, not offsetTop: several of these sections sit
       inside a positioned parent, which would offset the reading. */
    const probe = header.offsetHeight * 0.55;

    let dark = false;
    for (const section of darkFields) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= probe && rect.bottom >= probe) { dark = true; break; }
    }
    header.classList.toggle('header--dark', dark);
    header.classList.toggle('is-solid', y > window.innerHeight * 0.75);

    if (header.classList.contains('header--over-menu')) { ticking = false; return; }
    const menuOpen = document.body.classList.contains('is-locked');
    const goingDown = y > lastY && y > window.innerHeight;
    header.classList.toggle('is-hidden', goingDown && !menuOpen);
    lastY = y;

    if (readline) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      readline.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measure);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  measure();
}

export function initMenu() {
  const btn = document.querySelector('[data-menu-btn]');
  const menu = document.querySelector('[data-menu]');
  if (!btn || !menu) return;

  const focusables = () => menu.querySelectorAll('a[href], button:not([disabled])');
  let lastFocus = null;
  let focusTimer = null;

  const header = document.querySelector('[data-header]');

  const setOpen = (open, { restoreFocus = true } = {}) => {
    window.clearTimeout(focusTimer);
    btn.setAttribute('aria-expanded', String(open));
    /* The menu is a deep green field and the header sits on top of it,
       so the wordmark has to invert with it. */
    if (header) {
      header.classList.toggle('header--over-menu', open);
      if (open) { header.classList.add('header--dark'); header.classList.remove('is-solid', 'is-hidden'); }
    }
    btn.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Open menu';
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    document.body.classList.toggle('is-locked', open);
    stopScroll(open);

    if (open) {
      lastFocus = document.activeElement;
      /* Wait for the clip to open before moving focus, or the browser
         scrolls the hidden panel into view. */
      focusTimer = window.setTimeout(() => focusables()[0]?.focus(), 220);
    } else {
      if (restoreFocus) lastFocus?.focus();
      lastFocus = null;
    }
  };

  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });

  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;
    const items = [...focusables()];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* The wide navigation replaces the overlay at 1220px. Close an
     in-flight compact menu so desktop never inherits a hidden page
     scroll or an overlay that has lost its visible trigger. */
  const desktopNav = window.matchMedia('(min-width: 1220px)');
  const closeForDesktop = (event) => {
    if (event.matches && menu.classList.contains('is-open')) setOpen(false, { restoreFocus: false });
  };
  if (desktopNav.addEventListener) desktopNav.addEventListener('change', closeForDesktop);
  else desktopNav.addListener(closeForDesktop);
}

/* In-page anchors clear the fixed header and respect the motion setting. */
export function initAnchors() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"], a[href*=".html#"]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    /* IDs are more robust than a CSS selector here: a valid URL hash can
       contain characters that would otherwise throw inside querySelector. */
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    const header = document.querySelector('[data-header]');
    scrollTo(target, -((header?.offsetHeight ?? 72) + 16));
    history.pushState(null, '', url.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}
