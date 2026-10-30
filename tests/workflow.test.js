import { test, expect, describe } from 'vitest';
import {
  validateNewRequest, createRequest, applyTransition, transitionError, allowedTransitions,
  isOverdue, isOpen, canView, storedRequestError, isValidDate, nextId,
} from '../src/lib/workflow.js';
import { PERSONAS } from '../src/lib/people.js';
import { generate } from '../scripts/generate-data.mjs';

const P = Object.fromEntries(PERSONAS.map((p) => [p.key, p]));
const NOW = Date.parse('2026-10-30T04:30:00Z'); // Friday 10:00 Colombo
const form = {
  title: 'Second monitor',
  description: 'Need a second monitor for spreadsheet work.',
  request_type: 'Equipment',
  priority: 'High',
  needed_by: '2026-11-15',
};
const submit = (actor = P['staff-it'], input = form, existing = []) => createRequest(input, { actor, existing, now: NOW });
const move = (r, to, actor, comment = '') => applyTransition(r, to, { actor, comment, now: NOW + 60_000 });
const must = (res) => {
  expect(res.ok, res.error || JSON.stringify(res.errors)).toBe(true);
  return res.request;
};

describe('validation', () => {
  const full = { ...form, requester_name: "Avery O'Neil-Smith", requester_id: 'emp-1234', department: 'IT' };

  test('valid input passes and is normalised', () => {
    const { ok, value } = validateNewRequest(full, NOW);
    expect(ok).toBe(true);
    expect(value.requester_id).toBe('EMP-1234');
  });

  test('required fields, length limits and enums are enforced', () => {
    const { ok, errors } = validateNewRequest(
      { ...full, title: 'abc', description: '', department: 'Space', priority: 'Urgent!!', requester_id: '1234', requester_name: '<script>' },
      NOW,
    );
    expect(ok).toBe(false);
    for (const f of ['title', 'description', 'department', 'priority', 'requester_id', 'requester_name']) expect(errors[f], f).toBeTruthy();
    expect(validateNewRequest({ ...full, title: 'x'.repeat(101) }, NOW).errors.title).toBeTruthy();
  });

  test('dates: real, not in the past, not too far ahead', () => {
    expect(isValidDate('2026-02-31')).toBe(false);
    expect(validateNewRequest({ ...full, needed_by: '2026-10-29' }, NOW).errors.needed_by).toBeTruthy();
    expect(validateNewRequest({ ...full, needed_by: '2027-12-01' }, NOW).errors.needed_by).toBeTruthy();
    expect(validateNewRequest({ ...full, needed_by: '2026-10-30' }, NOW).ok).toBe(true);
  });
});

describe('creating requests', () => {
  test('identity and department come from the actor, not the form', () => {
    const r = must(submit(P['staff-it'], { ...form, department: 'Finance', requester_id: 'EMP-0001', requester_name: 'Someone Else' }));
    expect(r.department).toBe('IT');
    expect(r.requester_id).toBe(P['staff-it'].id);
    expect(r.requester_role).toBe('Staff');
    expect(r.history[0]).toMatchObject({ status: 'Submitted', from: null, actor_id: P['staff-it'].id, role: 'Staff' });
  });

  test('SLA due date uses business days (High = 3): Fri -> Wed 17:00 Colombo', () => {
    expect(must(submit()).due_at).toBe('2026-11-04T11:30:00Z');
  });

  test('Leadership cannot submit', () => {
    expect(submit(P.leadership).ok).toBe(false);
  });

  test('stored-data schema accepts a new request', () => {
    expect(storedRequestError(must(submit()))).toBeNull();
  });
});

describe('transitions and roles', () => {
  test('happy path: department manager reviews and approves, fulfiller completes', () => {
    let r = must(submit()); // IT staff, Equipment -> IT Asset Team
    r = must(move(r, 'Under Review', P['manager-it']));
    r = must(move(r, 'Approved', P['manager-it'], 'Approved, in budget'));
    const assetTeam = { id: 'EMP-4002', name: 'Mira Solberg', role: 'Fulfiller', team: 'IT Asset Team', department: 'IT' };
    r = must(move(r, 'Completed', assetTeam));
    expect(r.history.map((h) => `${h.from}->${h.status}`)).toEqual([
      'null->Submitted', 'Submitted->Under Review', 'Under Review->Approved', 'Approved->Completed',
    ]);
    expect(r.approved_at && r.completed_at && !r.rejected_at).toBeTruthy();
  });

  test('assignment path is enforced: no skipping, no going back, finals are final', () => {
    const r = must(submit());
    expect(transitionError(r, 'Approved', P['manager-it'])).toMatch(/Cannot move/);
    expect(transitionError(r, 'Completed', P['manager-it'])).toMatch(/Cannot move/);
    const review = must(move(r, 'Under Review', P['manager-it']));
    expect(transitionError(review, 'Submitted', P['manager-it'])).toMatch(/Cannot move/);
    const rejected = must(move(review, 'Rejected', P['manager-it'], 'No budget left this quarter'));
    for (const to of ['Completed', 'Approved', 'Withdrawn']) expect(transitionError(rejected, to, P.admin)).toMatch(/final/);
  });

  test('A2: managers act only within their own department', () => {
    const r = must(submit()); // IT request
    expect(transitionError(r, 'Under Review', P['manager-operations'])).toMatch(/IT department's Manager/);
    expect(allowedTransitions(r, P['manager-it'])).toEqual(['Under Review']);
  });

  test('A2: a manager\'s own request goes to Admin; nobody decides their own request', () => {
    const r = must(submit(P['manager-it'])); // raised by the IT manager
    expect(r.requester_role).toBe('Manager');
    expect(transitionError(r, 'Under Review', P['manager-it'])).toMatch(/your own request/);
    expect(transitionError(r, 'Under Review', P.admin)).toBeNull();
    const adminOwn = must(submit(P.admin));
    expect(transitionError(adminOwn, 'Under Review', P['manager-it'])).toBeNull(); // Admin is not a manager -> dept manager decides
  });

  test('A3: only the matching fulfilment team completes; managers cannot complete', () => {
    let r = must(submit(P['staff-it'], { ...form, request_type: 'IT Access' })); // -> IT Service Desk
    r = must(move(r, 'Under Review', P['manager-it']));
    r = must(move(r, 'Approved', P['manager-it']));
    expect(transitionError(r, 'Completed', P['manager-it'])).toMatch(/Only the IT Service Desk/);
    expect(transitionError(r, 'Completed', P['fulfiller-facilities'])).toMatch(/you are in Facilities Team/);
    expect(transitionError(r, 'Completed', P['fulfiller-servicedesk'])).toBeNull();
  });

  test('A4: rejection needs a reason of at least 10 characters', () => {
    const r = must(move(must(submit()), 'Under Review', P['manager-it']));
    expect(move(r, 'Rejected', P['manager-it'], 'no budget').ok).toBe(false); // 9 chars
    expect(move(r, 'Rejected', P['manager-it'], 'No budget left').ok).toBe(true);
    expect(move(r, 'Approved', P['manager-it'], 'x'.repeat(501)).ok).toBe(false);
  });

  test('A4: only the requester can withdraw, and only while Submitted', () => {
    const r = must(submit());
    expect(transitionError(r, 'Withdrawn', P['manager-it'])).toMatch(/Only the requester/);
    const w = must(move(r, 'Withdrawn', P['staff-it'], 'No longer needed'));
    expect(w.withdrawn_at).toBeTruthy();
    expect(isOpen(w)).toBe(false);
    const review = must(move(must(submit()), 'Under Review', P['manager-it']));
    expect(transitionError(review, 'Withdrawn', P['staff-it'])).toMatch(/Cannot move/);
  });

  test('read-only Leadership can do nothing', () => {
    expect(allowedTransitions(must(submit()), P.leadership)).toEqual([]);
  });

  test('history timestamps never go backwards (clock skew)', () => {
    const r = must(submit());
    const next = must(applyTransition(r, 'Under Review', { actor: P['manager-it'], now: NOW - 60_000 }));
    expect(next.history[1].at >= next.history[0].at).toBe(true);
  });
});

describe('visibility (mirrors RLS)', () => {
  test('staff see own, managers their department, fulfillers their approved queue, leadership all', () => {
    const r = must(submit()); // IT staff, Equipment
    expect(canView(r, P['staff-it'])).toBe(true);
    expect(canView(r, P['staff-finance'])).toBe(false);
    expect(canView(r, P['manager-it'])).toBe(true);
    expect(canView(r, P['manager-operations'])).toBe(false);
    expect(canView(r, P['fulfiller-servicedesk'])).toBe(false);
    expect(canView(r, P.leadership)).toBe(true);
    expect(canView(r, P.admin)).toBe(true);
    const approved = { ...r, request_type: 'IT Access', status: 'Approved' };
    expect(canView(approved, P['fulfiller-servicedesk'])).toBe(true);
  });
});

test('overdue = open and past due', () => {
  const r = must(submit());
  expect(isOverdue(r, NOW)).toBe(false);
  expect(isOverdue(r, Date.parse('2026-11-05T00:00:00Z'))).toBe(true);
  expect(isOverdue({ ...r, status: 'Withdrawn' }, Date.parse('2026-11-05T00:00:00Z'))).toBe(false);
});

test('stored-data validation accepts the sample and rejects tampering', () => {
  const sample = generate().requests;
  for (const r of sample) expect(storedRequestError(r), r.id).toBeNull();
  const r = sample[0];
  expect(storedRequestError({ ...r, status: 'Hacked' })).toBeTruthy();
  expect(storedRequestError({ ...r, department: '<img src=x onerror=alert(1)>' })).toBeTruthy();
  expect(storedRequestError({ ...r, requester_role: 'Superuser' })).toBeTruthy();
  expect(storedRequestError({ ...r, history: [] })).toBeTruthy();
  expect(storedRequestError({ ...r, title: 'x'.repeat(5000) })).toBeTruthy();
});

test('nextId continues the sequence', () => {
  expect(nextId([{ id: 'REQ-0009' }, { id: 'REQ-0042' }])).toBe('REQ-0043');
  expect(nextId([])).toBe('REQ-0001');
});

test('needed-by "today" follows the Asia/Colombo calendar (same rule as the server)', () => {
  const lateUtc = Date.parse('2026-10-30T20:00:00Z'); // already 31 Oct 01:30 in Colombo
  const base = { ...form, requester_name: 'Kiran Morrow', requester_id: 'EMP-2003', department: 'IT' };
  expect(validateNewRequest({ ...base, needed_by: '2026-10-30' }, lateUtc).errors.needed_by).toMatch(/past/);
  expect(validateNewRequest({ ...base, needed_by: '2026-10-31' }, lateUtc).ok).toBe(true);
});
