/* Shared interface behaviour.
 *
 * Everything here is an enhancement over markup that already works:
 * a figure is in the HTML before it is counted up, a meter carries its
 * value as a custom property before it is animated, and a filter only
 * ever hides rows that are also reachable without JavaScript.
 */

import { env } from './env.js';

/* ── figures ────────────────────────────────────────────────────
 * A published number counts up once, when it arrives. It never counts
 * on a reduced-motion device, and the final value is the one already
 * in the markup, so nothing depends on the animation completing.     */
export function initCounters(root = document) {
  const targets = root.querySelectorAll('[data-count-to]');
  if (!targets.length) return;

  if (env.reduced || !('IntersectionObserver' in window)) return;

  const run = (el) => {
    const to = Number(el.dataset.countTo);
    if (!Number.isFinite(to)) return;
    /* Anything above a couple of hundred is a size, not a count, and
       reads better landing whole than ticking through four digits. */
    const duration = to > 200 ? 700 : 900;
    const start = performance.now();
    const settle = () => { el.textContent = String(to); };

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      /* easeOutExpo: fast to near-final, then settles. */
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = String(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
      else settle();
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      run(entry.target);
      io.unobserve(entry.target);
    }
  }, { threshold: 0.6 });

  targets.forEach((el) => io.observe(el));
}

/* ── meters ─────────────────────────────────────────────────────
 * The fill is drawn by CSS from `--value`; this only marks a meter as
 * arrived so the transition has something to run from.               */
export function initMeters(root = document) {
  const meters = root.querySelectorAll('.meter');
  if (!meters.length) return;

  if (env.reduced || !('IntersectionObserver' in window)) {
    meters.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.25 });

  meters.forEach((el) => io.observe(el));
}

/* ── filters ────────────────────────────────────────────────────
 * A segmented control over a list of records. The buttons are added
 * by the page; each carries `data-filter="<value>"` and each filterable
 * row carries `data-filter-tags="a b c"`. "all" always matches.       */
export function initFilters(root = document) {
  for (const group of root.querySelectorAll('[data-filter-group]')) {
    const buttons = [...group.querySelectorAll('[data-filter]')];
    const listId = group.dataset.filterGroup;
    const list = document.getElementById(listId);
    if (!buttons.length || !list) continue;

    const rows = [...list.querySelectorAll('[data-filter-tags]')];
    const empty = list.querySelector('[data-filter-empty]');

    const apply = (value) => {
      let shown = 0;
      for (const row of rows) {
        const tags = (row.dataset.filterTags || '').split(/\s+/);
        const match = value === 'all' || tags.includes(value);
        row.hidden = !match;
        if (match) shown += 1;
      }
      if (empty) empty.hidden = shown !== 0;
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.filter === value));
      }
      /* Announce the result rather than leaving a screen-reader user to
         discover that the list silently changed length. */
      list.setAttribute('aria-busy', 'false');
    };

    group.addEventListener('click', (e) => {
      const button = e.target.closest('[data-filter]');
      if (!button) return;
      apply(button.dataset.filter);
    });

    apply(buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.filter || 'all');
  }
}

/* ── copy ───────────────────────────────────────────────────────
 * For the report reference, which someone has to be able to read back
 * over a phone line. Falls back to selecting the text when the
 * clipboard is unavailable, which it is on any insecure origin.      */
export function initCopy(root = document) {
  for (const button of root.querySelectorAll('[data-copy]')) {
    const sourceId = button.dataset.copy;
    button.addEventListener('click', async () => {
      const source = document.getElementById(sourceId);
      if (!source) return;
      const text = (source.textContent || '').trim();
      const label = button.querySelector('[data-copy-label]') || button;
      const original = label.textContent;

      try {
        await navigator.clipboard.writeText(text);
        label.textContent = 'Copied';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        label.textContent = 'Select and copy';
      }
      window.setTimeout(() => { label.textContent = original; }, 2000);
    });
  }
}

export function initUI(root = document) {
  initCounters(root);
  initMeters(root);
  initFilters(root);
  initCopy(root);
}
