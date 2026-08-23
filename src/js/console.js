/* Office prototype: reads the submissions this browser recorded. It is
 * deliberately read-only and local — there is no server behind it. */
export function initConsole(table) {
  const body = table.querySelector('tbody');
  if (!body) return;

  let records = [];
  try { records = JSON.parse(localStorage.getItem('budadiri.issues') || '[]'); } catch { /* ignore */ }

  if (!records.length) {
    body.innerHTML =
      '<tr><td colspan="5">No submissions recorded on this device yet. ' +
      'Raise an issue from the Community page to see the workflow.</td></tr>';
    return;
  }

  const escape = (value) => String(value ?? '—').replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

  body.innerHTML = records
    .map((r) => `<tr>
      <td class="num">${escape(r.ref)}</td>
      <td>${escape(r.name)}</td>
      <td>${escape(r.area)}</td>
      <td>${escape(r.category)}</td>
      <td class="num">${new Date(r.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
    </tr>`)
    .join('');
}
