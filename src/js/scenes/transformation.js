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
  const control = section.querySelector('[data-transform-control]');
  const words = [...section.querySelectorAll('[data-word]')];
  const stampToday = section.querySelector('[data-stamp="today"]');
  const stampFuture = section.querySelector('[data-stamp="future"]');
  if (!frame || !future) return;

  let dragging = false;

  const apply = (p) => {
    const wipe = (1 - p) * 100;
    /* Set once on the frame: the future layer's clip, the seam and the
       handle all read the same inherited custom property, so nothing
       here can drift out of sync with anything else. */
    frame.style.setProperty('--wipe', `${wipe.toFixed(2)}%`);
    if (stampToday) stampToday.style.opacity = String(Math.max(0.25, 1 - p * 1.6));
    if (stampFuture) stampFuture.style.opacity = String(Math.min(1, Math.max(0.25, p * 1.8)));
    words.forEach((word, i) => {
      word.classList.toggle('is-lit', p >= (i + 0.6) / (words.length + 0.6));
    });
    /* The control's value is kept equal to the wipe/handle position (not
       to p) so it always matches where the handle actually sits on
       screen — the native input's own min-is-left/max-is-right geometry
       then lines up with a left handle meaning wipe 0, with nothing
       inverted for drag, click or arrow keys to fight against. */
    if (control && !dragging) control.value = String(Math.round(wipe));
  };

  apply(0);

  if (control) {
    /* The input is stretched over the whole photograph so it can be
       picked up anywhere, but a native range input's own click/drag
       geometry is built for a thin horizontal track — reshaped this
       far, browsers stop reliably computing a value from where the
       pointer actually lands. Pointer Events (which unify mouse and
       touch) read the position ourselves and drive the same input, so
       everything downstream — the 'input' listener, apply(), keyboard,
       screen readers — still goes through one path. */
    const setFromClientX = (clientX) => {
      const rect = frame.getBoundingClientRect();
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      control.value = String(Math.round(pct));
      control.dispatchEvent(new Event('input', { bubbles: true }));
    };

    control.addEventListener('pointerdown', (e) => {
      dragging = true;
      control.setPointerCapture(e.pointerId);
      /* Without this, the browser's own native range-drag still runs
         alongside ours — built for a thin horizontal track, it
         miscomputes a value against this full-photo box and its own
         'input' event lands after ours, silently overwriting it back
         to whatever its geometry decided. preventDefault also
         suppresses the focus a pointerdown would normally give a form
         control, so it is restored explicitly on the next line. */
      e.preventDefault();
      control.focus();
      setFromClientX(e.clientX);
    });
    control.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setFromClientX(e.clientX);
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    control.addEventListener('input', () => { dragging = true; apply(1 - Number(control.value) / 100); });
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
