// Single source of truth for allowed values. Imported by the browser app AND the
// Node data generator, so the dataset, the validation and the SQL CHECKs never drift.

export const DEPARTMENTS = ['Finance', 'HR', 'IT', 'Operations', 'Sales', 'Marketing', 'Legal'];

export const REQUEST_TYPES = ['IT Access', 'Equipment', 'Facilities', 'Software Licence', 'Other'];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'];

export const ROLES = ['Staff', 'Manager', 'Leadership'];

/** Statuses that still need work (used by "open" and "overdue" KPIs). */
export const OPEN_STATUSES = ['Submitted', 'Under Review', 'Approved'];

/** Terminal statuses: no further transitions allowed. */
export const TERMINAL_STATUSES = ['Rejected', 'Completed'];

/** SLA in calendar days from submission to completion, per priority. */
export const SLA_DAYS = { Critical: 2, High: 5, Medium: 10, Low: 15 };

/** Field length limits (shared by form validation and the field dictionary). */
export const LIMITS = {
  title: { min: 5, max: 100 },
  description: { min: 10, max: 1000 },
  requester_name: { min: 2, max: 60 },
  comment: { max: 500 },
  neededByMaxDaysAhead: 180,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
