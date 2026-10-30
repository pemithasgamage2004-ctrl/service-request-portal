// Pure workflow rules: validation, who may do which transition, applying a transition,
// visibility. No DOM, no storage - unit-tested, and mirrored by the Postgres functions and
// RLS policies in supabase/migrations (Live mode). In Demo mode these rules run in the
// browser and are therefore NOT a security boundary.
//
// An "actor" is { id: 'EMP-1234', name, role, department?, team? }.
import {
  DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES, ROLES, OPEN_STATUSES, LIMITS, DAY_MS, FULFILMENT_TEAMS,
} from './enums.js';
import { slaDueAt, localDate } from './sla.js';

/**
 * from -> { to: rule }. Anything not listed is an invalid transition.
 * Rules: 'approver' (department manager, or Admin when the requester is a manager),
 * 'fulfiller' (the request type's fulfilment team), 'requester' (the person who raised it).
 */
export const TRANSITIONS = {
  Submitted: { 'Under Review': 'approver', Withdrawn: 'requester' },
  'Under Review': { Approved: 'approver', Rejected: 'approver' },
  Approved: { Completed: 'fulfiller' },
  Rejected: {},
  Completed: {},
  Withdrawn: {},
};

/** Human-readable "who" for each rule (Requirements page and error messages). */
export const RULE_LABELS = {
  approver: "Manager of the request's department (Admin if the requester is a manager); never the requester",
  fulfiller: "Fulfiller in the request type's team; never the requester",
  requester: 'The requester only',
};

/** Roles allowed to create new requests (Leadership is read-only). */
export const CAN_SUBMIT = ['Staff', 'Manager', 'Fulfiller', 'Admin'];

/** Button labels for each target status. */
export const ACTION_LABELS = {
  'Under Review': 'Start review',
  Approved: 'Approve',
  Rejected: 'Reject',
  Completed: 'Mark completed',
  Withdrawn: 'Withdraw',
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

/** Is `s` a real calendar date in YYYY-MM-DD form (rejects 2026-02-31)? */
export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Validate the "new request" fields. Only whitelisted fields are read.
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

  // Business calendar (Asia/Colombo), same as the server-side check in create_request().
  const today = localDate(now);
  const maxDay = localDate(now + LIMITS.neededByMaxDaysAhead * DAY_MS);
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
 * Create a new request (status Submitted). Requester identity and department come from
 * the actor (the signed-in profile), never from form input.
 * @returns {{ ok: true, request } | { ok: false, errors }}
 */
export function createRequest(input, { actor, existing, now = Date.now() }) {
  if (!actor || !CAN_SUBMIT.includes(actor.role)) return { ok: false, errors: { _form: `${actor?.role || 'This role'} cannot submit requests.` } };
  const { ok, errors, value } = validateNewRequest(
    { ...input, requester_name: actor.name, requester_id: actor.id, department: actor.department },
    now,
  );
  if (!ok) return { ok: false, errors };
  const at = isoNow(now);
  const request = {
    id: nextId(existing),
    title: value.title,
    description: value.description,
    requester_name: value.requester_name,
    requester_id: value.requester_id,
    requester_role: actor.role,
    department: value.department,
    request_type: value.request_type,
    priority: value.priority,
    status: 'Submitted',
    created_at: at,
    needed_by: value.needed_by,
    due_at: slaDueAt(at, value.priority),
    approved_at: null,
    rejected_at: null,
    completed_at: null,
    withdrawn_at: null,
    updated_at: at,
    history: [{ status: 'Submitted', from: null, at, actor: value.requester_name, actor_id: value.requester_id, role: actor.role, comment: 'Request submitted.' }],
  };
  return { ok: true, request };
}

/** Why `actor` may not satisfy `rule` for this request, or null if they may. */
function ruleError(rule, request, actor) {
  const own = actor.id === request.requester_id;
  if (rule === 'requester') return own ? null : 'Only the requester can withdraw their own request.';
  if (rule === 'approver') {
    if (own) return 'You cannot review or decide your own request (separation of duties).';
    if (request.requester_role === 'Manager') {
      return actor.role === 'Admin' ? null : 'Requests raised by a department manager are reviewed and decided by an Admin.';
    }
    if (actor.role !== 'Manager') return `Only the ${request.department} department's Manager can review or decide this request.`;
    if (actor.department !== request.department) return `Only the ${request.department} department's Manager can act on this request (you manage ${actor.department}).`;
    return null;
  }
  if (rule === 'fulfiller') {
    const team = FULFILMENT_TEAMS[request.request_type];
    if (own) return 'You cannot complete your own request (separation of duties).';
    if (actor.role !== 'Fulfiller') return `Only the ${team} (Fulfiller) can mark ${request.request_type} requests completed.`;
    if (actor.team !== team) return `Only the ${team} can complete ${request.request_type} requests (you are in ${actor.team}).`;
    return null;
  }
  return 'Unknown rule.';
}

/** Why a transition is not allowed for this actor, or null if it is. */
export function transitionError(request, to, actor) {
  if (!STATUSES.includes(to)) return `Unknown status "${to}".`;
  if (!actor || !ROLES.includes(actor.role)) return 'Unknown user or role.';
  const targets = TRANSITIONS[request.status] || {};
  if (!(to in targets)) {
    if (Object.keys(targets).length === 0) return `${request.status} is a final status; no further changes are allowed.`;
    return `Cannot move from ${request.status} to ${to}. Allowed next: ${Object.keys(targets).join(', ')}.`;
  }
  return ruleError(targets[to], request, actor);
}

/** Target statuses this actor may move the request to. */
export function allowedTransitions(request, actor) {
  return Object.keys(TRANSITIONS[request.status] || {}).filter((to) => !transitionError(request, to, actor));
}

/** Every next status from the current one, regardless of actor (for showing disabled buttons). */
export function nextStatuses(request) {
  return Object.keys(TRANSITIONS[request.status] || {});
}

/**
 * Apply a transition immutably.
 * @returns {{ ok: true, request } | { ok: false, error }}
 */
export function applyTransition(request, to, { actor, comment = '', now = Date.now() }) {
  const err = transitionError(request, to, actor);
  if (err) return { ok: false, error: err };
  const note = clean(comment);
  if (note.length > LIMITS.comment.max) return { ok: false, error: `Comment must be at most ${LIMITS.comment.max} characters.` };
  if (to === 'Rejected' && note.length < LIMITS.rejectReason.min) {
    return { ok: false, error: `A reason of at least ${LIMITS.rejectReason.min} characters is required to reject a request.` };
  }
  const lastAt = request.history.at(-1)?.at;
  const at = isoNow(Math.max(now, lastAt ? Date.parse(lastAt) : 0)); // history never goes backwards in time
  const next = {
    ...request,
    status: to,
    updated_at: at,
    history: [...request.history, { status: to, from: request.status, at, actor: clean(actor.name) || actor.role, actor_id: actor.id, role: actor.role, comment: note }],
  };
  if (to === 'Approved') next.approved_at = at;
  if (to === 'Rejected') next.rejected_at = at;
  if (to === 'Completed') next.completed_at = at;
  if (to === 'Withdrawn') next.withdrawn_at = at;
  return { ok: true, request: next };
}

/** Open = not yet finished (Submitted / Under Review / Approved). Withdrawn is not open. */
export const isOpen = (r) => OPEN_STATUSES.includes(r.status);

/** Overdue = still open and the SLA due time has passed. */
export const isOverdue = (r, now = Date.now()) => isOpen(r) && Date.parse(r.due_at) < now;

/**
 * Row visibility (mirrors the RLS SELECT policies): Staff see their own requests;
 * Managers their department (and their own); Fulfillers approved/completed requests for
 * their team (and their own); Leadership and Admin see everything.
 */
export function canView(request, actor) {
  if (!actor) return false;
  if (actor.id === request.requester_id) return true;
  switch (actor.role) {
    case 'Leadership':
    case 'Admin':
      return true;
    case 'Manager':
      return request.department === actor.department;
    case 'Fulfiller':
      return ['Approved', 'Completed'].includes(request.status) && FULFILMENT_TEAMS[request.request_type] === actor.team;
    default:
      return false;
  }
}

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
  if (!ROLES.includes(r.requester_role)) return 'bad requester_role';
  if (!DEPARTMENTS.includes(r.department)) return 'bad department';
  if (!REQUEST_TYPES.includes(r.request_type)) return 'bad request_type';
  if (!PRIORITIES.includes(r.priority)) return 'bad priority';
  if (!STATUSES.includes(r.status)) return 'bad status';
  for (const f of ['created_at', 'due_at', 'updated_at']) if (!ISO_RE.test(r[f] ?? '')) return `bad ${f}`;
  for (const f of ['approved_at', 'rejected_at', 'completed_at', 'withdrawn_at']) if (r[f] !== null && !ISO_RE.test(r[f] ?? '')) return `bad ${f}`;
  if (!isValidDate(r.needed_by)) return 'bad needed_by';
  if (!Array.isArray(r.history) || r.history.length === 0 || r.history.length > 20) return 'bad history';
  for (const h of r.history) {
    if (!h || !STATUSES.includes(h.status) || !ROLES.includes(h.role) || !ISO_RE.test(h.at ?? '')) return 'bad history entry';
    if (h.from !== null && !STATUSES.includes(h.from)) return 'bad history from';
    if (!EMP_RE.test(h.actor_id ?? '')) return 'bad history actor_id';
    if (typeof h.actor !== 'string' || h.actor.length > 100) return 'bad history actor';
    if (typeof h.comment !== 'string' || h.comment.length > LIMITS.comment.max) return 'bad history comment';
  }
  if (r.history.at(-1).status !== r.status) return 'status does not match history';
  return null;
}
