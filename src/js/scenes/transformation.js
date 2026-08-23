import { env } from '../env.js';

/* TODAY → 2036.
 *
 * One progress value, 0 → 1, drives everything: the clip on the
 * projection layer, the seam, the two stamps and the five outcome
 * words. Where the device can afford it, scroll pins the frame and
 * writes that value; everywhere else the same value comes from normal
 * scroll position or from the range control, which is always live so
 * the comparison never depends on a scroll trick.
 */
export async function initTransformation(section) {
  const frame = section.querySelector('[data-transform-frame]');
  const future = section.querySelector('[data-layer-future]');
  const seam = section.querySelector('[data-seam]');
  const control = section.querySelector('[data-transform-control]');
  const words = [...section.querySelectorAll('[data-word]')];
  const stampToday = section.querySelector('[data-stamp="today"]');
  const stampFuture = section.querySelector('[data-stamp="future"]');
  if (!frame || !future) return;

  let dragging = false;

  const apply = (p) => {
    const wipe = (1 - p) * 100;
    future.style.setProperty('--wipe', `${wipe.toFixed(2)}%`);
    if (seam) seam.style.setProperty('--wipe', `${wipe.toFixed(2)}%`);
    if (stampToday) stampToday.style.opacity = String(Math.max(0.25, 1 - p * 1.6));
    if (stampFuture) stampFuture.style.opacity = String(Math.min(1, Math.max(0.25, p * 1.8)));
    words.forEach((word, i) => {
      word.classList.toggle('is-lit', p >= (i + 0.6) / (words.length + 0.6));
    });
    if (control && !dragging) control.value = String(Math.round(p * 100));
  };

  apply(0);

  if (control) {
    control.addEventListener('pointerdown', () => { dragging = true; });
    window.addEventListener('pointerup', () => { dragging = false; });
    control.addEventListener('input', () => { dragging = true; apply(Number(control.value) / 100); });
    control.addEventListener('change', () => { dragging = false; });
    control.addEventListener('keydown', () => { dragging = true; });
    control.addEventListener('blur', () => { dragging = false; });
  }

  if (env.reduced) { apply(0.5); return; }

  if (env.scenes) {
    const { ScrollTrigger } = await import('../motion.js').then((m) => m.scroller());
    if (!ScrollTrigger) return;
    const hold = section.querySelector('[data-transform-stage]');
    ScrollTrigger.create({
      trigger: hold,
      start: 'top top',
      end: '+=140%',
      pin: hold,
      pinSpacing: true,
      scrub: 0.6,
      onUpdate: (self) => { if (!dragging) apply(self.progress); },
    });
    return;
  }

  /* Phones and tablets: the frame is not held. Progress is simply how
     far the frame has travelled through the middle of the screen. */
  let ticking = false;
  const measure = () => {
    const r = frame.getBoundingClientRect();
    const span = window.innerHeight * 0.75 + r.height;
    const travelled = window.innerHeight - r.top;
    if (!dragging) apply(Math.min(1, Math.max(0, travelled / span)));
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
