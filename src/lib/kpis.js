// Pure KPI + aggregation functions for the dashboard (unit-tested).
// Definitions match the SQL shown on the dashboard (see lib/sql.js).
import { DAY_MS } from './enums.js';
import { isOpen, isOverdue } from './workflow.js';
import { localDate } from './sla.js';

/**
 * Filter by submission date (inclusive, Asia/Colombo business-calendar days), department and status.
 * Empty filter values mean "all".
 */
export function filterRequests(requests, { from = '', to = '', department = '', status = '' } = {}) {
  return requests.filter((r) => {
    const day = localDate(Date.parse(r.created_at));
    return (!from || day >= from) && (!to || day <= to) && (!department || r.department === department) && (!status || r.status === status);
  });
}

const round1 = (x) => Math.round(x * 10) / 10;

/** Median of a non-empty numeric array (mean of the two middle values for even lengths, like PERCENTILE_CONT(0.5)). */
export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** KPI values for a (filtered) set of requests. null = not computable (no data). */
export function computeKpis(rows, now = Date.now()) {
  const approved = rows.filter((r) => r.approved_at);
  const rejected = rows.filter((r) => r.rejected_at);
  const decided = approved.length + rejected.length; // Withdrawn requests are never decided, so they are excluded
  const approvalDays = approved.map((r) => (Date.parse(r.approved_at) - Date.parse(r.created_at)) / DAY_MS);
  const avgDays = approvalDays.length ? round1(approvalDays.reduce((s, d) => s + d, 0) / approvalDays.length) : null;
  return {
    total: rows.length,
    open: rows.filter(isOpen).length,
    overdue: rows.filter((r) => isOverdue(r, now)).length,
    avgDaysToApproval: avgDays,
    medianDaysToApproval: approvalDays.length ? round1(median(approvalDays)) : null,
    withdrawn: rows.filter((r) => r.status === 'Withdrawn').length,
    approvalRate: decided ? round1((100 * approved.length) / decided) : null,
    decided,
  };
}

/** Count by a field in a fixed key order (zero-filled, so colors/positions never shift). */
export function countByKey(rows, field, keys) {
  const m = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) if (m.has(r[field])) m.set(r[field], m.get(r[field]) + 1);
  return m;
}

/** Monday (Asia/Colombo calendar) of the week containing instant `ms`, as YYYY-MM-DD. */
export function weekStart(ms) {
  const d = new Date(`${localDate(ms)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(d.getTime() - dow * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Weekly volume: requests submitted per week and requests completed per week.
 * Weeks span the filter range (or the data range when unfiltered), zero-filled.
 */
export function weeklyVolume(rows, { from = '', to = '' } = {}) {
  const created = rows.map((r) => Date.parse(r.created_at));
  if (!created.length && !(from && to)) return [];
  // Filter dates are Colombo calendar days; noon UTC of that day maps back to the same Colombo date.
  const startMs = from ? Date.parse(`${from}T12:00:00Z`) : Math.min(...created);
  // Without a `to` filter the range must also cover completion dates, otherwise
  // completions after the last submission would be silently dropped.
  const completed = rows.filter((r) => r.completed_at).map((r) => Date.parse(r.completed_at));
  const endDay = to || localDate(Math.max(...created, ...completed));
  const weeks = new Map();
  for (let t = Date.parse(`${weekStart(startMs)}T00:00:00Z`); new Date(t).toISOString().slice(0, 10) <= endDay; t += 7 * DAY_MS) {
    weeks.set(new Date(t).toISOString().slice(0, 10), { week: new Date(t).toISOString().slice(0, 10), submitted: 0, completed: 0 });
  }
  for (const r of rows) {
    const w = weeks.get(weekStart(Date.parse(r.created_at)));
    if (w) w.submitted += 1;
    if (r.completed_at) {
      const c = weeks.get(weekStart(Date.parse(r.completed_at)));
      if (c) c.completed += 1;
    }
  }
  return [...weeks.values()];
}
