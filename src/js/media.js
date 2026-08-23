/* The source archive: every image extracted from the three national
 * framework documents. 873 records, fetched as JSON on this page only,
 * rendered a page at a time, each thumbnail lazily loaded. */
const LABELS = { vision2040: 'Vision 2040', ndpiv: 'NDP IV', manifesto: 'NRM Manifesto' };
const PAGE = 60;

export async function initArchive(root) {
  const grid = root.querySelector('[data-plates]');
  const more = root.querySelector('[data-more]');
  const count = root.querySelector('[data-count]');
  const filters = [...root.querySelectorAll('[data-filter]')];
  /* The viewer sits outside the section it serves, so it is looked up
     from the document rather than from the archive root. */
  const box = document.querySelector('[data-lightbox]');
  if (!grid) return;

  let records = [];
  let doc = 'all';
  let shown = 0;

  const visible = () => (doc === 'all' ? records : records.filter((r) => r.d === doc));

  const render = (reset) => {
    if (reset) { grid.textContent = ''; shown = 0; }
    const list = visible();
    const slice = list.slice(shown, shown + PAGE);
    const frag = document.createDocumentFragment();

    for (const record of slice) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'plate';
      button.innerHTML =
        `<img loading="lazy" decoding="async" width="${record.w}" height="${record.h}"` +
        ` src="${record.t}" alt="Figure from ${LABELS[record.d]}">` +
        `<span class="plate__doc">${LABELS[record.d]}</span>`;
      button.addEventListener('click', () => open(record));
      frag.append(button);
    }
    grid.append(frag);
    shown += slice.length;
    if (more) more.hidden = shown >= list.length;
    if (count) {
      count.textContent = `${shown.toLocaleString()} of ${list.length.toLocaleString()} figures`;
    }
  };

  const open = (record) => {
    if (!box) return;
    const img = box.querySelector('img');
    img.src = record.s;
    img.alt = `Full figure from ${LABELS[record.d]}`;
    box.hidden = false;
    box.querySelector('[data-close]').focus();
    document.body.classList.add('is-locked');
  };

  const close = () => {
    if (!box) return;
    box.hidden = true;
    box.querySelector('img').removeAttribute('src');
    document.body.classList.remove('is-locked');
  };

  box?.addEventListener('click', (e) => {
    if (e.target === box || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && box && !box.hidden) close();
  });

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      doc = button.dataset.filter;
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      render(true);
    });
  });

  more?.addEventListener('click', () => render(false));

  try {
    records = await fetch('data/media-archive.json').then((r) => r.json());
  } catch {
    if (count) count.textContent = 'The archive index could not be loaded.';
    return;
  }
  render(true);
}
