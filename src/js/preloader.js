/* The engraved portrait draws itself in, then resolves into the actual
 * photograph beneath it (see tools/build-preloader-sketch.mjs for how
 * the two layers share one crop box and stay in register).
 *
 * It shows once per browser session and is skipped outright under
 * reduced motion or a metered connection. The image is only ever
 * requested once the decision to show has already been made — a
 * session that never sees it never fetches it. A bfcache restore never
 * re-runs this module at all, and sessionStorage already covers a
 * plain reload, so neither needs handling here.
 */
import { env } from './env.js';

const SEEN_KEY = 'be-intro-seen';
const DRAW_MS = 166 * 5.5 + 420;   // last row's delay + its own transition (see preloader.css)
const PHOTO_TIMEOUT_MS = 2600;     // give up waiting on the photograph specifically
const MAX_CAP_MS = 3200;           // hard ceiling from show to resolve, whatever the network is doing
const RESOLVE_MS = 820;            // preloader.css .preloader__portrait transition
const FADE_MS = 380;               // preloader.css .preloader opacity transition

function alreadySeen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode — runs once more, harmless */ }
}

function timeout(ms, value) {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

function loadPhoto(stage) {
  const img = new Image();
  img.className = 'preloader__portrait';
  img.alt = '';
  img.decoding = 'async';
  /* Document-relative, not root-absolute: every page sits at the top
     level (see README), so this has to resolve the same way whether
     the site is served from a domain root or under /MP-SITE/ on
     Pages. Vite's own build rewrites static href/src attributes for
     exactly this reason, but a URL built at runtime in JS is outside
     that pass and has to already be written correctly. */
  img.src = `img/preloader-portrait-${window.devicePixelRatio > 1.5 ? 680 : 340}.webp`;
  stage.prepend(img);

  return img.decode().then(
    () => img,
    () => { img.remove(); return null; }, // no webp support, or the request failed outright
  );
}

export function initPreloader() {
  const root = document.querySelector('[data-preloader]');
  const stage = root?.querySelector('[data-preloader-stage]');
  if (!root || !stage) return;

  if (env.reduced || env.saveData || alreadySeen()) { markSeen(); return; }
  markSeen();

  root.hidden = false;
  document.body.classList.add('is-locked');

  /* Let the first paint of the hidden→visible swap land before drawing,
     the same two-frame convention used for the hero contours. */
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-drawing')));

  const photo = Promise.race([loadPhoto(stage), timeout(PHOTO_TIMEOUT_MS, null)]);
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const drawn = timeout(DRAW_MS, null);

  Promise.race([
    Promise.all([fontsReady, drawn, photo]).then(([, , img]) => img),
    timeout(MAX_CAP_MS, null),
  ]).then((img) => {
    if (img) root.classList.add('is-resolving');
    window.setTimeout(() => {
      root.classList.add('is-done');
      window.setTimeout(() => {
        document.body.classList.remove('is-locked');
        root.remove();
      }, FADE_MS);
    }, img ? RESOLVE_MS : 0);
  });
}
