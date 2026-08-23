import { stopScroll, scrollTo } from './motion.js';

/* Mark the current page in every navigation from one attribute on the
 * body, so the markup carries no duplicated state. */
export function markCurrent() {
  const page = document.body.dataset.page;
  if (!page) return;
  /* Scoped to links: the page name lives on <body data-page="…">, so an
     unscoped selector matched the body itself and marked the whole
     document aria-current="page". */
  for (const link of document.querySelectorAll(`a[data-page="${page}"]`)) {
    link.setAttribute('aria-current', 'page');
  }
}

/* The masthead.
 *
 * It is opaque from the first pixel now, so the previous build's
 * per-section inversion — measuring which dark band sits behind the
 * header on every frame — is gone along with the flicker it caused at
 * band boundaries. What is left is cheap: a solid state once the page
 * has moved at all, a hide-on-the-way-down, and the reading position.
 */
export function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const readline = document.querySelector('.readline');
  let lastY = window.scrollY;
  let ticking = false;
  /* Below this the direction change is treated as noise: iOS rubber-band
     and trackpad jitter otherwise toggle the header several times a second. */
  const DIRECTION_THRESHOLD = 6;

  const measure = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);

    header.classList.toggle('is-solid', y > 4);

    if (readline) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      readline.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    }

    /* While the drawer is open the header holds its position: it carries
       the close button, so hiding it would strand the only way out. */
    if (document.body.classList.contains('is-locked')) { lastY = y; return; }

    const delta = y - lastY;
    if (Math.abs(delta) > DIRECTION_THRESHOLD) {
      /* Only hide once the first screen is genuinely behind you, and never
         while a focused control inside the header would be scrolled away. */
      const past = y > window.innerHeight * 0.6;
      const focusInside = header.contains(document.activeElement);
      header.classList.toggle('is-hidden', delta > 0 && past && !focusInside);
      lastY = y;
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measure);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  /* A keyboard user tabbing into a hidden header needs it back. */
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  measure();
}

/* The drawer.
 *
 * Full-screen below 1220px. It traps focus, locks the page behind it,
 * restores focus on close, and closes on Escape, on a link, on a
 * backdrop tap and when the viewport grows into the desktop navigation.
 */
export function initMenu() {
  const btn = document.querySelector('[data-menu-btn]');
  const menu = document.querySelector('[data-menu]');
  if (!btn || !menu) return;

  const srLabel = btn.querySelector('.visually-hidden');
  const visLabel = btn.querySelector('[data-menu-btn-label]');
  const header = document.querySelector('[data-header]');

  /* Recomputed per call: the drawer's contents do not change, but a
     disabled or hidden control inside it must never take the trap. */
  const focusables = () => [...menu.querySelectorAll('a[href], button:not([disabled])')]
    .filter((el) => el.offsetParent !== null || el.getClientRects().length);

  let lastFocus = null;
  let focusTimer = null;

  const setOpen = (open, { restoreFocus = true } = {}) => {
    window.clearTimeout(focusTimer);
    btn.setAttribute('aria-expanded', String(open));

    /* The drawer is a deep green field and the header sits on top of it,
       so the masthead drops its ground and inverts while it is open. */
    if (header) {
      header.classList.toggle('header--over-menu', open);
      if (open) header.classList.remove('is-hidden');
    }

    if (srLabel) srLabel.textContent = open ? 'Close menu' : 'Open menu';
    if (visLabel) visLabel.textContent = open ? 'Close' : 'Menu';

    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    document.body.classList.toggle('is-locked', open);
    stopScroll(open);

    if (open) {
      lastFocus = document.activeElement;
      /* Wait for the panel to become visible before moving focus, or the
         browser scrolls a still-hidden element into view. */
      focusTimer = window.setTimeout(() => focusables()[0]?.focus(), 200);
    } else {
      if (restoreFocus && lastFocus?.isConnected) lastFocus.focus();
      lastFocus = null;
    }
  };

  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) { setOpen(false, { restoreFocus: false }); return; }
    /* A tap on the field itself, rather than on a row, closes it. */
    if (e.target === menu) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key !== 'Tab') return;

    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;

    /* Focus can escape to the page behind if something outside the drawer
       took it; pull it back rather than only wrapping at the two ends. */
    if (!menu.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* The wide navigation replaces the overlay at 1220px. Close an in-flight
     compact menu so desktop never inherits a hidden page scroll or an
     overlay whose visible trigger has gone. */
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
    if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

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
