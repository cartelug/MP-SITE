import { env } from './env.js';

let gsapRef = null;
let stRef = null;
let lenisRef = null;
let lenisTick = null;
let lifecycleBound = false;
let scrollLocked = false;

function disableEnhancedMotion() {
  stRef?.getAll().forEach((trigger) => trigger.kill(true));
  document.querySelectorAll('.is-pinned').forEach((section) => section.classList.remove('is-pinned'));
  if (lenisRef) {
    lenisRef.stop();
    lenisRef.destroy();
    lenisRef = null;
  }
  if (gsapRef && lenisTick) {
    gsapRef.ticker.remove(lenisTick);
    lenisTick = null;
  }
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      lenisRef?.stop();
      gsapRef?.ticker.sleep();
      return;
    }
    gsapRef?.ticker.wake();
    if (!scrollLocked) lenisRef?.start();
    stRef?.refresh();
  });

  window.addEventListener('motion:environmentchange', (event) => {
    if (event.detail.tier !== 'desktop') disableEnhancedMotion();
  });
}

/* GSAP and Lenis are only fetched when a scene actually needs them, so
 * a phone that gets none of the scroll scenes never downloads them. */
export async function scroller() {
  if (gsapRef) return { gsap: gsapRef, ScrollTrigger: stRef, lenis: lenisRef };
  if (!env.scenes) return { gsap: null, ScrollTrigger: null, lenis: null };

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  gsapRef = gsap;
  stRef = ScrollTrigger;
  bindLifecycle();

  if (!env.reduced) {
    const { default: Lenis } = await import('lenis');
    /* Wheel smoothing only. Touch keeps the platform's own scrolling,
     * so momentum, overscroll and the address-bar behaviour stay native. */
    lenisRef = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1,
    });
    lenisRef.on('scroll', ScrollTrigger.update);
    lenisTick = (time) => lenisRef?.raf(time * 1000);
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);
  }

  /* Pin measurements depend on final font and image geometry. Refresh once
     those resources settle, while ScrollTrigger continues to handle normal
     viewport changes itself. */
  document.fonts?.ready?.then(() => stRef?.refresh());
  if (document.readyState === 'complete') stRef.refresh();
  else window.addEventListener('load', () => stRef?.refresh(), { once: true });

  return { gsap: gsapRef, ScrollTrigger: stRef, lenis: lenisRef };
}

export function stopScroll(locked) {
  scrollLocked = locked;
  if (!lenisRef) return;
  locked ? lenisRef.stop() : lenisRef.start();
}

export function scrollTo(target, offset = 0) {
  if (lenisRef) { lenisRef.scrollTo(target, { offset, duration: 1 }); return; }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: env.reduced ? 'auto' : 'smooth' });
  }
}
