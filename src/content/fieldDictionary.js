import { DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES, ROLES, LIMITS, SLA_DAYS } from '../lib/enums.js';

const list = (a) => a.join(', ');
const sla = Object.entries(SLA_DAYS).map(([p, d]) => `${p} ${d}d`).join(', ');

// Field dictionary for the `requests` dataset (and the nested / separate status history).
export const REQUEST_FIELDS = [
  { name: 'id', type: 'string', description: 'Unique request identifier, sequential by submission time.', allowed: 'REQ-0001 … REQ-9999' },
  { name: 'title', type: 'string', description: 'Short summary of the request.', allowed: `${LIMITS.title.min}–${LIMITS.title.max} characters` },
  { name: 'description', type: 'string', description: 'Details / business justification.', allowed: `${LIMITS.description.min}–${LIMITS.description.max} characters` },
  { name: 'requester_name', type: 'string', description: 'Fictional name of the staff member who submitted it.', allowed: `${LIMITS.requester_name.min}–${LIMITS.requester_name.max} characters, letters/space/.'-` },
  { name: 'requester_id', type: 'string', description: 'Fictional employee ID.', allowed: 'EMP-#### (4 digits)' },
  { name: 'department', type: 'enum', description: 'Requesting department.', allowed: list(DEPARTMENTS) },
  { name: 'request_type', type: 'enum', description: 'Category of request.', allowed: list(REQUEST_TYPES) },
  { name: 'priority', type: 'enum', description: 'Business priority; drives the SLA / due date.', allowed: list(PRIORITIES) },
  { name: 'status', type: 'enum', description: 'Current workflow status (latest history entry).', allowed: list(STATUSES) },
  { name: 'created_at', type: 'datetime (ISO 8601, UTC)', description: 'When the request was submitted.', allowed: 'Not in the future' },
  { name: 'needed_by', type: 'date (YYYY-MM-DD)', description: 'Date the requester needs it by.', allowed: `On/after submission date, at most ${LIMITS.neededByMaxDaysAhead} days ahead` },
  { name: 'due_at', type: 'datetime (ISO 8601, UTC)', description: 'SLA deadline = created_at + SLA days for the priority.', allowed: sla },
  { name: 'approved_at', type: 'datetime | null', description: 'When a Manager approved it.', allowed: 'Set only if approved' },
  { name: 'rejected_at', type: 'datetime | null', description: 'When a Manager rejected it.', allowed: 'Set only if rejected' },
  { name: 'completed_at', type: 'datetime | null', description: 'When it was fulfilled.', allowed: 'Set only after approval' },
  { name: 'updated_at', type: 'datetime (ISO 8601, UTC)', description: 'Time of the latest status change.', allowed: '= last history entry' },
  { name: 'history', type: 'array (JSON only)', description: 'Ordered, append-only status changes. In CSV form this is the separate status_history.csv file.', allowed: 'See history fields below' },
];

export const HISTORY_FIELDS = [
  { name: 'request_id', type: 'string', description: 'Request the change belongs to (CSV only; implicit in JSON).', allowed: 'Existing REQ id' },
  { name: 'seq', type: 'integer', description: 'Order of the change within the request (CSV only).', allowed: '1, 2, 3 …' },
  { name: 'status', type: 'enum', description: 'Status entered by this change.', allowed: list(STATUSES) },
  { name: 'at', type: 'datetime (ISO 8601, UTC)', description: 'When the change happened.', allowed: 'Non-decreasing within a request' },
  { name: 'actor', type: 'string', description: 'Fictional person who made the change.', allowed: 'Free text' },
  { name: 'role', type: 'enum', description: 'Role of the actor at the time.', allowed: list(ROLES) },
  { name: 'comment', type: 'string', description: 'Optional note; mandatory when rejecting.', allowed: `0–${LIMITS.comment.max} characters` },
];
