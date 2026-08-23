/* The framework line.
 *
 * A single rAF-throttled scroll read sets the length of the drawn line
 * and marks whichever stage is at the reading position. No library, and
 * cheap enough to leave running on a low-end phone.
 */
export function initFramework(section) {
  const track = section.querySelector('[data-track]');
  const line = section.querySelector('[data-line]');
  const stages = [...section.querySelectorAll('[data-stage]')];
  if (!track || !stages.length) return;

  let ticking = false;

  const measure = () => {
    const rect = track.getBoundingClientRect();
    const readAt = window.innerHeight * 0.55;
    const progress = Math.min(1, Math.max(0, (readAt - rect.top) / rect.height));
    if (line) line.style.setProperty('--p', progress.toFixed(4));

    for (const stage of stages) {
      const r = stage.getBoundingClientRect();
      stage.classList.toggle('is-on', r.top < readAt && r.bottom > 0);
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
