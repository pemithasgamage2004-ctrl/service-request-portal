// Pure workflow rules: validation, allowed transitions, applying a transition.
// No DOM, no storage - so the rules are unit-tested and enforced regardless of the UI
// (the UI only *hides* buttons; this layer *blocks* invalid actions).
import {
  DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES, ROLES, OPEN_STATUSES, SLA_DAYS, LIMITS, DAY_MS,
} from './enums.js';

/** from -> { to: [roles allowed] }. Anything not listed is an invalid transition. */
export const TRANSITIONS = {
  Submitted: { 'Under Review': ['Manager'] },
  'Under Review': { Approved: ['Manager'], Rejected: ['Manager'] },
  Approved: { Completed: ['Manager'] },
  Rejected: {},
  Completed: {},
};

/** Roles allowed to create new requests (Leadership is read-only). */
export const CAN_SUBMIT = ['Staff', 'Manager'];

/** Button labels for each target status. */
export const ACTION_LABELS = {
  'Under Review': 'Start review',
  Approved: 'Approve',
  Rejected: 'Reject',
  Completed: 'Mark completed',
};

// Control characters (except tab/newline) are stripped from free text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const NAME_RE = /^\p{L}[\p{L} .'-]*$/u;
const EMP_RE = /^EMP-\d{4}$/;
const REQ_RE = /^REQ-\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

const clean = (v) => (typeof v === 'string' ? v.replace(CONTROL_CHARS, '').trim() : '');
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Is `s` a real calendar date in YYYY-MM-DD form (rejects 2026-02-31)? */
export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Validate the "new request" form. Only whitelisted fields are read.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateNewRequest(input, now = Date.now()) {
  const v = {
    title: clean(input.title),
    description: clean(input.description),
    requester_name: clean(input.requester_name).replace(/\s+/g, ' '),
    requester_id: clean(input.requester_id).toUpperCase(),
    department: clean(input.department),
    request_type: clean(input.request_type),
    priority: clean(input.priority),
    needed_by: clean(input.needed_by),
  };
  const errors = {};
  const len = (field, label) => {
    const { min = 0, max } = LIMITS[field];
    if (!v[field]) errors[field] = `${label} is required.`;
    else if (v[field].length < min) errors[field] = `${label} must be at least ${min} characters.`;
    else if (v[field].length > max) errors[field] = `${label} must be at most ${max} characters.`;
  };
  len('title', 'Title');
  len('description', 'Description');
  len('requester_name', 'Your name');
  if (!errors.requester_name && !NAME_RE.test(v.requester_name)) {
    errors.requester_name = "Name may only contain letters, spaces and . ' -";
  }
  if (!v.requester_id) errors.requester_id = 'Employee ID is required.';
  else if (!EMP_RE.test(v.requester_id)) errors.requester_id = 'Employee ID must look like EMP-1234.';

  const oneOf = (field, list, label) => {
    if (!v[field]) errors[field] = `${label} is required.`;
    else if (!list.includes(v[field])) errors[field] = `${label} must be one of: ${list.join(', ')}.`;
  };
  oneOf('department', DEPARTMENTS, 'Department');
  oneOf('request_type', REQUEST_TYPES, 'Request type');
  oneOf('priority', PRIORITIES, 'Priority');

  const today = utcDay(now);
  const maxDay = utcDay(now + LIMITS.neededByMaxDaysAhead * DAY_MS);
  if (!v.needed_by) errors.needed_by = 'Needed-by date is required.';
  else if (!isValidDate(v.needed_by)) errors.needed_by = 'Enter a valid date (YYYY-MM-DD).';
  else if (v.needed_by < today) errors.needed_by = 'Needed-by date cannot be in the past.';
  else if (v.needed_by > maxDay) errors.needed_by = `Needed-by date must be within ${LIMITS.neededByMaxDaysAhead} days (by ${maxDay}).`;

  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

/** Next sequential REQ id given existing requests. */
export function nextId(requests) {
  const max = requests.reduce((m, r) => Math.max(m, Number(r.id.slice(4)) || 0), 0);
  if (max >= 9999) throw new Error('Request ID space exhausted');
  return `REQ-${String(max + 1).padStart(4, '0')}`;
}

const isoNow = (now) => new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Create a new request (status Submitted) from form input.
 * @returns {{ ok: true, request } | { ok: false, errors }}
 */
export function createRequest(input, { role, existing, now = Date.now() }) {
  if (!CAN_SUBMIT.includes(role)) return { ok: false, errors: { _form: `${role} cannot submit requests.` } };
  const { ok, errors, value } = validateNewRequest(input, now);
  if (!ok) return { ok: false, errors };
  const at = isoNow(now);
  const request = {
    id: nextId(existing),
    ...value,
    status: 'Submitted',
    created_at: at,
    due_at: isoNow(now + SLA_DAYS[value.priority] * DAY_MS),
    approved_at: null,
    rejected_at: null,
    completed_at: null,
    updated_at: at,
    history: [{ status: 'Submitted', at, actor: value.requester_name, role, comment: 'Request submitted.' }],
  };
  // Keep the same key order as the generated dataset (needed_by after created_at).
  const { needed_by, ...rest } = request;
  return { ok: true, request: { ...rest, needed_by } };
}

/** Why a transition is not allowed, or null if it is. */
export function transitionError(request, to, role) {
  if (!STATUSES.includes(to)) return `Unknown status "${to}".`;
  if (!ROLES.includes(role)) return `Unknown role "${role}".`;
  const targets = TRANSITIONS[request.status] || {};
  if (!(to in targets)) {
    if (Object.keys(targets).length === 0) return `${request.status} is a final status; no further changes are allowed.`;
    return `Cannot move from ${request.status} to ${to}. Allowed next: ${Object.keys(targets).join(', ')}.`;
  }
  if (!targets[to].includes(role)) return `Only ${targets[to].join(' / ')} can move a request to ${to}.`;
  return null;
}

/** Target statuses a role may move this request to. */
export function allowedTransitions(request, role) {
  return Object.keys(TRANSITIONS[request.status] || {}).filter((to) => !transitionError(request, to, role));
}

/** Every next status from the current one, regardless of role (for showing disabled buttons). */
export function nextStatuses(request) {
  return Object.keys(TRANSITIONS[request.status] || {});
}

/**
 * Apply a transition immutably.
 * @returns {{ ok: true, request } | { ok: false, error }}
 */
export function applyTransition(request, to, { role, actor, comment = '', now = Date.now() }) {
  const err = transitionError(request, to, role);
  if (err) return { ok: false, error: err };
  const note = clean(comment);
  if (note.length > LIMITS.comment.max) return { ok: false, error: `Comment must be at most ${LIMITS.comment.max} characters.` };
  if (to === 'Rejected' && note.length < 5) return { ok: false, error: 'A reason (at least 5 characters) is required to reject a request.' };
  const lastAt = request.history.at(-1)?.at;
  const at = isoNow(Math.max(now, lastAt ? Date.parse(lastAt) : 0)); // history never goes backwards in time
  const next = {
    ...request,
    status: to,
    updated_at: at,
    history: [...request.history, { status: to, at, actor: clean(actor) || role, role, comment: note }],
  };
  if (to === 'Approved') next.approved_at = at;
  if (to === 'Rejected') next.rejected_at = at;
  if (to === 'Completed') next.completed_at = at;
  return { ok: true, request: next };
}

/** Open = not yet finished (Submitted / Under Review / Approved). */
export const isOpen = (r) => OPEN_STATUSES.includes(r.status);

/** Overdue = still open and the SLA due date has passed. */
export const isOverdue = (r, now = Date.now()) => isOpen(r) && Date.parse(r.due_at) < now;

/**
 * Structural check for a request loaded from localStorage (untrusted: could be
 * tampered with in DevTools or corrupted). Returns null if valid, else a reason.
 */
export function storedRequestError(r) {
  if (!r || typeof r !== 'object') return 'not an object';
  if (!REQ_RE.test(r.id)) return 'bad id';
  for (const f of ['title', 'description', 'requester_name']) {
    if (typeof r[f] !== 'string' || r[f].length === 0 || r[f].length > LIMITS[f].max) return `bad ${f}`;
  }
  if (!EMP_RE.test(r.requester_id)) return 'bad requester_id';
  if (!DEPARTMENTS.includes(r.department)) return 'bad department';
  if (!REQUEST_TYPES.includes(r.request_type)) return 'bad request_type';
  if (!PRIORITIES.includes(r.priority)) return 'bad priority';
  if (!STATUSES.includes(r.status)) return 'bad status';
  for (const f of ['created_at', 'due_at', 'updated_at']) if (!ISO_RE.test(r[f] ?? '')) return `bad ${f}`;
  for (const f of ['approved_at', 'rejected_at', 'completed_at']) if (r[f] !== null && !ISO_RE.test(r[f] ?? '')) return `bad ${f}`;
  if (!isValidDate(r.needed_by)) return 'bad needed_by';
  if (!Array.isArray(r.history) || r.history.length === 0 || r.history.length > 20) return 'bad history';
  for (const h of r.history) {
    if (!h || !STATUSES.includes(h.status) || !ROLES.includes(h.role) || !ISO_RE.test(h.at ?? '')) return 'bad history entry';
    if (typeof h.actor !== 'string' || h.actor.length > 100) return 'bad history actor';
    if (typeof h.comment !== 'string' || h.comment.length > LIMITS.comment.max) return 'bad history comment';
  }
  if (r.history.at(-1).status !== r.status) return 'status does not match history';
  return null;
}
