// Business-day SLA calculation (pure, unit-tested). Mirrors the SQL function
// `public.sla_due_at()` used in Live mode; CI checks both give the same answers.
import { SLA_BUSINESS_DAYS, SLA_DUE_HOUR_LOCAL, BUSINESS_TZ_OFFSET_MIN, DAY_MS } from './enums.js';
import { PUBLIC_HOLIDAYS } from './holidays.js';

const OFFSET_MS = BUSINESS_TZ_OFFSET_MIN * 60 * 1000;
const DEFAULT_HOLIDAYS = new Set(PUBLIC_HOLIDAYS.map((h) => h.date));

/** Calendar date (YYYY-MM-DD) in the business timezone (Asia/Colombo) for a UTC instant. */
export function localDate(ms) {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** Mon-Fri and not a public holiday. `date` is YYYY-MM-DD (business-timezone calendar). */
export function isBusinessDay(date, holidays = DEFAULT_HOLIDAYS) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.has(date);
}

/** The Nth business day strictly after `date`. */
export function addBusinessDays(date, n, holidays = DEFAULT_HOLIDAYS) {
  let t = Date.parse(`${date}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    t += DAY_MS;
    if (isBusinessDay(new Date(t).toISOString().slice(0, 10), holidays)) left -= 1;
  }
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * SLA due instant (ISO, UTC): 17:00 Asia/Colombo on the Nth business day after the
 * submission date, where N comes from the priority's SLA.
 */
export function slaDueAt(createdIso, priority, { slaDays = SLA_BUSINESS_DAYS, holidays = DEFAULT_HOLIDAYS } = {}) {
  const n = slaDays[priority];
  if (!Number.isInteger(n) || n < 0) throw new Error(`No SLA for priority ${priority}`);
  const dueDate = addBusinessDays(localDate(Date.parse(createdIso)), n, holidays);
  const dueMs = Date.parse(`${dueDate}T00:00:00Z`) + SLA_DUE_HOUR_LOCAL * 3600 * 1000 - OFFSET_MS;
  return new Date(dueMs).toISOString().replace('.000Z', 'Z');
}
