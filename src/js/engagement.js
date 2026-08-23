/* Small, shared interaction helpers for the constituency interface.
 * They do not hide content unless JavaScript is available, and every
 * control keeps a native link or button as its baseline behaviour. */

import { env } from './env.js';

export function initMobileDock() {
  const dock = document.querySelector('[data-mobile-dock]');
  if (!dock) return;

  const label = dock.querySelector('[data-mobile-dock-label]');
  const context = dock.querySelector('[data-mobile-dock-context]');
  const action = dock.querySelector('[data-mobile-dock-action]');
  const gate = document.querySelector('[data-hero], .opener');
  const isCommunity = document.body.dataset.page === 'community';
  let complete = false;
  let ticking = false;

  if (isCommunity) {
    if (label) label.textContent = 'Continue report';
    if (context) context.textContent = 'Four-step report';
    if (action) action.href = '#raise';
  }

  const measure = () => {
    const gateBottom = gate?.getBoundingClientRect().bottom ?? 0;
    const headerHeight = document.querySelector('[data-header]')?.offsetHeight ?? 72;
    const passedGate = gate ? gateBottom <= headerHeight + 12 : window.scrollY > 240;
    dock.classList.toggle('is-visible', passedGate && !complete);
    ticking = false;
  };

  const requestMeasure = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measure);
  };

  document.addEventListener('office:step', (event) => {
    if (!isCommunity || !context) return;
    const { step, total } = event.detail;
    context.textContent = `Report step ${step} of ${total}`;
  });

  document.addEventListener('office:complete', () => {
    complete = true;
    dock.classList.remove('is-visible');
  });

  window.addEventListener('scroll', requestMeasure, { passive: true });
  window.addEventListener('resize', requestMeasure, { passive: true });
  window.addEventListener('load', requestMeasure, { once: true });
  requestMeasure();
}

export function initRecordDisclosures() {
  for (const record of document.querySelectorAll('[data-record]')) {
    const toggle = record.querySelector('[data-record-toggle]');
    const label = toggle?.querySelector('[data-record-toggle-label]');
    if (!toggle) continue;

    toggle.addEventListener('click', () => {
      const open = !record.classList.contains('is-open');
      record.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Hide evidence' : 'View evidence';

      /* The disclosure remains an instant CSS state change everywhere.
         On phones, newly visible evidence gets one short directional settle
         so the reader can see what the tap revealed. */
      if (open && env.tier === 'mobile' && !env.reduced) {
        const details = record.querySelectorAll('[data-record-detail]');
        details.forEach((detail, index) => {
          if (typeof detail.animate !== 'function') return;
          detail.getAnimations().forEach((animation) => animation.cancel());
          detail.animate(
            [
              { opacity: 0, transform: 'translateY(-6px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            {
              duration: 240,
              delay: index * 35,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              fill: 'backwards',
            },
          );
        });
      }
    });
  }
}
