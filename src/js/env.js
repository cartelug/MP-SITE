/* One place that decides how much motion this device should be asked
 * to do. Everything else asks here rather than sniffing on its own. */

const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqMobile = window.matchMedia('(max-width: 759.98px)');
const mqDesktop = window.matchMedia('(min-width: 1100px)');
const mqPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

const tier = () => {
  if (mqReduce.matches) return 'static';
  if (mqDesktop.matches && mqPointer.matches && !connection?.saveData) return 'desktop';
  if (mqMobile.matches) return 'mobile';
  return 'tablet';
};

export const env = {
  get reduced() { return mqReduce.matches; },
  get tier() { return tier(); },
  get saveData() { return Boolean(connection?.saveData); },
  /* Scroll-driven scenes are for pointer desktops that are not
   * explicitly asking us to stop moving things. */
  get scenes() { return tier() === 'desktop'; },
};

/* Keep one capability label on the root so CSS and lazy modules make the
 * same decision. A change event lets an already-loaded desktop motion
 * module shut itself down if the viewport or user preference changes. */
export function initMotionEnvironment() {
  let current = '';
  const sync = () => {
    const next = tier();
    document.documentElement.dataset.motion = next;
    if (next === current) return;
    const previous = current;
    current = next;
    window.dispatchEvent(new CustomEvent('motion:environmentchange', {
      detail: { previous, tier: next },
    }));
  };

  const queries = [mqReduce, mqMobile, mqDesktop, mqPointer];
  queries.forEach((query) => {
    if (query.addEventListener) query.addEventListener('change', sync);
    else query.addListener(sync);
  });
  connection?.addEventListener?.('change', sync);
  sync();
}
