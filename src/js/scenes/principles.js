import { env } from '../env.js';

/* Transparent. Visible. Accountable. — each word takes the screen in
 * turn. The staging is CSS; this only decides when a word has arrived. */
export function initPrinciples(section) {
  const items = [...section.querySelectorAll('[data-principle]')];
  if (!items.length) return;

  /* Asked for no motion, or nothing to observe with: the three words and
     their definitions are simply on the page from the start. */
  if (env.reduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      }
    },
    { rootMargin: '-12% 0px -22% 0px' },
  );
  items.forEach((el) => io.observe(el));
}
