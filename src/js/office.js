/* The constituency office form.
 *
 * Four questions, one at a time, validated as you leave each step so
 * nobody fills in four screens and is told at the end that the first
 * one was wrong. There is no backend yet, and the interface says so
 * rather than implying a submission went somewhere.
 */
import { env } from './env.js';

const STORE = 'budadiri.issues';

const messages = {
  valueMissing: 'This one is needed before we can route your issue.',
  tooShort: 'A little more detail helps the office act on it.',
  patternMismatch: 'Check the format and try again.',
  typeMismatch: 'Check the format and try again.',
};

function describe(field) {
  const v = field.validity;
  if (v.valueMissing) return field.dataset.required || messages.valueMissing;
  if (v.tooShort) return messages.tooShort;
  if (v.patternMismatch || v.typeMismatch) return messages.patternMismatch;
  return field.validationMessage;
}

function reference() {
  const year = new Date().getFullYear();
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BE-${year}-${tail}`;
}

export function initOffice(form) {
  const steps = [...form.querySelectorAll('[data-step]')];
  const marks = [...form.querySelectorAll('[data-step-mark]')];
  const receipt = form.querySelector('[data-receipt]');
  const live = form.querySelector('[data-step-live]');
  if (!steps.length) return;

  let current = 0;

  /* A manual area choice on the home page can prefill step one. No
     location permission is requested and unknown values are ignored. */
  const requestedArea = new URLSearchParams(window.location.search).get('area');
  const area = form.querySelector('select[name="area"]');
  if (requestedArea && area) {
    const known = [...area.options].some((option) => option.value === requestedArea);
    if (known) area.value = requestedArea;
  }

  const paint = (direction = 'forward') => {
    steps.forEach((step, i) => {
      step.hidden = i !== current;
      if (i === current) {
        step.setAttribute('data-enter', direction);
        /* Re-trigger the entrance without leaving the attribute behind. */
        requestAnimationFrame(() => step.removeAttribute('data-enter'));
      }
    });
    marks.forEach((mark, i) => {
      mark.dataset.state = i < current ? 'done' : i === current ? 'current' : 'todo';
    });
    const question = steps[current]?.querySelector('.step__question')?.textContent?.trim() || '';
    if (live) live.textContent = `Step ${current + 1} of ${steps.length}: ${question}`;
    document.dispatchEvent(new CustomEvent('office:step', {
      detail: { step: current + 1, total: steps.length },
    }));
  };

  const showError = (field, message) => {
    const slot = field.closest('.field-row')?.querySelector('[data-error]');
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (slot) slot.textContent = message || '';
  };

  const validate = (index) => {
    const fields = [...steps[index].querySelectorAll('input, select, textarea')];
    let ok = true;
    for (const field of fields) {
      if (field.checkValidity()) { showError(field, ''); continue; }
      showError(field, describe(field));
      if (ok) field.focus();
      ok = false;
    }
    return ok;
  };

  form.addEventListener('input', (e) => {
    const field = e.target;
    if (field.getAttribute('aria-invalid') === 'true' && field.checkValidity()) showError(field, '');
  });

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const back = e.target.closest('[data-back]');
    if (next) {
      e.preventDefault();
      if (!validate(current)) return;
      current = Math.min(steps.length - 1, current + 1);
      paint('forward');
      steps[current].querySelector('.step__question')?.focus();
    }
    if (back) {
      e.preventDefault();
      current = Math.max(0, current - 1);
      paint('back');
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(current)) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const record = { ...data, ref: reference(), created: new Date().toISOString() };

    /* Prototype storage: this device only. Stated in the interface. */
    try {
      const all = JSON.parse(localStorage.getItem(STORE) || '[]');
      all.unshift(record);
      localStorage.setItem(STORE, JSON.stringify(all.slice(0, 200)));
    } catch { /* private mode — the receipt still shows */ }

    if (receipt) {
      receipt.querySelector('[data-ref]').textContent = record.ref;
      receipt.querySelector('[data-receipt-area]').textContent = record.area || '—';
      receipt.querySelector('[data-receipt-category]').textContent = record.category || '—';
      receipt.hidden = false;
      if (!env.reduced && typeof receipt.animate === 'function') {
        receipt.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: env.tier === 'mobile' ? 360 : 520,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          },
        );
      }
    }
    form.querySelector('[data-flow]').hidden = true;
    /* The step rail described a journey that is now finished. */
    form.querySelector('.steps')?.setAttribute('hidden', '');
    receipt?.focus();
    document.dispatchEvent(new CustomEvent('office:complete'));
  });

  paint('initial');
}
