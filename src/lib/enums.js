// Single source of truth for allowed values. Imported by the browser app AND the
// Node data generator, so the dataset, the validation and the SQL CHECKs never drift.

export const DEPARTMENTS = ['Finance', 'HR', 'IT', 'Operations', 'Sales', 'Marketing', 'Legal'];

export const REQUEST_TYPES = ['IT Access', 'Equipment', 'Facilities', 'Software Licence', 'Other'];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Withdrawn'];

// Staff submit; Managers review/decide for their own department; Fulfillers complete
// approved requests for their team's request types; Leadership is read-only; Admin
// maintains reference data and decides requests raised by a department's own manager.
export const ROLES = ['Staff', 'Manager', 'Fulfiller', 'Leadership', 'Admin'];

/** Statuses that still need work (used by "open" and "overdue" KPIs). */
export const OPEN_STATUSES = ['Submitted', 'Under Review', 'Approved'];

/** Terminal statuses: no further transitions allowed. */
export const TERMINAL_STATUSES = ['Rejected', 'Completed', 'Withdrawn'];

/**
 * SLA in BUSINESS days (Mon-Fri, excluding public holidays), per priority.
 * Due = 17:00 Asia/Colombo on the Nth business day after the submission date.
 * (Live mode reads this from the `sla_policy` table.)
 */
export const SLA_BUSINESS_DAYS = { Critical: 1, High: 3, Medium: 7, Low: 10 };
export const SLA_DUE_HOUR_LOCAL = 17;

/** Business calendar timezone (SLA, date filters, weekly buckets). Sri Lanka has no DST. */
export const BUSINESS_TZ = 'Asia/Colombo';
export const BUSINESS_TZ_OFFSET_MIN = 330; // UTC+05:30

/** Which fulfilment team completes each request type (Live mode: lookup table). */
export const FULFILMENT_TEAMS = {
  'IT Access': 'IT Service Desk',
  Equipment: 'IT Asset Team',
  Facilities: 'Facilities Team',
  'Software Licence': 'IT Service Desk',
  Other: 'Operations Support',
};
export const TEAMS = [...new Set(Object.values(FULFILMENT_TEAMS))];

/** Field length limits (shared by form validation and the field dictionary). */
export const LIMITS = {
  title: { min: 5, max: 100 },
  description: { min: 10, max: 1000 },
  requester_name: { min: 2, max: 60 },
  comment: { max: 500 },
  rejectReason: { min: 10 },
  neededByMaxDaysAhead: 180,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
