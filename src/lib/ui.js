// Small presentational helpers shared by pages.
import { el } from './dom.js';

const STATUS_BADGE = {
  Submitted: 'badge-info',
  'Under Review': 'badge-warn',
  Approved: 'badge-brand',
  Rejected: 'badge-err',
  Completed: 'badge-ok',
};
const PRIORITY_BADGE = { Low: '', Medium: 'badge-info', High: 'badge-warn', Critical: 'badge-err' };

export const statusBadge = (s) => el('span', { class: `badge ${STATUS_BADGE[s] || ''}`, text: s });
export const priorityBadge = (p) => el('span', { class: `badge ${PRIORITY_BADGE[p] || ''}`, text: p });

/** '2026-10-30T09:15:00Z' -> '2026-10-30 09:15 UTC' */
export function fmtDateTime(iso) {
  if (!iso) return '-';
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
export const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '-');

/** Announce a message in the shared aria-live toast region. */
export function toast(message, kind = 'ok') {
  const region = document.getElementById('toast');
  if (!region) return;
  const item = el('div', { class: `toast toast-${kind}`, text: message, attrs: { role: kind === 'error' ? 'alert' : 'status' } });
  region.appendChild(item);
  setTimeout(() => item.remove(), 4000);
}

/** Trigger a client-side file download of generated text (no server involved). */
export function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, attrs: { download: filename } });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
