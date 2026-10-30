// Small presentational helpers shared by pages.
import { el } from './dom.js';

const STATUS_BADGE = {
  Submitted: 'badge-info',
  'Under Review': 'badge-warn',
  Approved: 'badge-brand',
  Rejected: 'badge-err',
  Completed: 'badge-ok',
  Withdrawn: '',
};
const PRIORITY_BADGE = { Low: '', Medium: 'badge-info', High: 'badge-warn', Critical: 'badge-err' };

export const statusBadge = (s) => el('span', { class: `badge ${STATUS_BADGE[s] || ''}`, text: s });
export const priorityBadge = (p) => el('span', { class: `badge ${PRIORITY_BADGE[p] || ''}`, text: p });

// Timestamps are stored in UTC and shown in the viewer's timezone (default Asia/Colombo
// when the browser does not report one), always with the timezone label (A8).
export const VIEWER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Colombo';
  } catch {
    return 'Asia/Colombo';
  }
})();
const dtf = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIEWER_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
});
const part = (parts, type) => parts.find((p) => p.type === type)?.value ?? '';

/** '2026-10-30T04:30:00Z' -> '2026-10-30 10:00 GMT+5:30' (viewer's timezone). */
export function fmtDateTime(iso) {
  if (!iso) return '-';
  const p = dtf.formatToParts(new Date(iso));
  return `${part(p, 'year')}-${part(p, 'month')}-${part(p, 'day')} ${part(p, 'hour')}:${part(p, 'minute')} ${part(p, 'timeZoneName')}`;
}
/** Date only, in the viewer's timezone. */
export function fmtDate(iso) {
  if (!iso) return '-';
  const p = dtf.formatToParts(new Date(iso));
  return `${part(p, 'year')}-${part(p, 'month')}-${part(p, 'day')}`;
}

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
