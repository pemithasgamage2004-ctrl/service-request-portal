import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNewRequest, createRequest, applyTransition, transitionError, allowedTransitions,
  isOverdue, storedRequestError, isValidDate, nextId,
} from '../src/lib/workflow.js';
import { generate } from '../scripts/generate-data.mjs';

const NOW = Date.parse('2026-10-30T10:00:00Z');
const good = {
  title: 'Second monitor',
  description: 'Need a second monitor for spreadsheet work.',
  requester_name: "Avery O'Neil-Smith",
  requester_id: 'emp-1234',
  department: 'IT',
  request_type: 'Equipment',
  priority: 'High',
  needed_by: '2026-11-15',
};

test('valid input passes and is normalised', () => {
  const { ok, value } = validateNewRequest(good, NOW);
  assert.ok(ok);
  assert.equal(value.requester_id, 'EMP-1234');
});

test('required fields, length limits and enums are enforced', () => {
  const { ok, errors } = validateNewRequest(
    { ...good, title: 'abc', description: '', department: 'Space', priority: 'Urgent!!', requester_id: '1234', requester_name: '<script>' },
    NOW,
  );
  assert.equal(ok, false);
  for (const f of ['title', 'description', 'department', 'priority', 'requester_id', 'requester_name']) assert.ok(errors[f], f);
  assert.ok(validateNewRequest({ ...good, title: 'x'.repeat(101) }, NOW).errors.title);
});

test('dates: real, not in the past, not too far ahead', () => {
  assert.equal(isValidDate('2026-02-31'), false);
  assert.ok(validateNewRequest({ ...good, needed_by: '2026-02-31' }, NOW).errors.needed_by);
  assert.ok(validateNewRequest({ ...good, needed_by: '2026-10-29' }, NOW).errors.needed_by);
  assert.ok(validateNewRequest({ ...good, needed_by: '2027-12-01' }, NOW).errors.needed_by);
  assert.equal(validateNewRequest({ ...good, needed_by: '2026-10-30' }, NOW).ok, true);
});

test('createRequest builds a Submitted request with history and SLA due date', () => {
  const res = createRequest(good, { role: 'Staff', existing: [{ id: 'REQ-0060' }], now: NOW });
  assert.ok(res.ok);
  assert.equal(res.request.id, 'REQ-0061');
  assert.equal(res.request.status, 'Submitted');
  assert.equal(res.request.history.length, 1);
  assert.equal(res.request.due_at, '2026-11-04T10:00:00Z'); // High = 5 days
  assert.equal(storedRequestError(res.request), null);
});

test('Leadership cannot submit', () => {
  assert.equal(createRequest(good, { role: 'Leadership', existing: [], now: NOW }).ok, false);
});

test('full happy path as Manager, with history', () => {
  let r = createRequest(good, { role: 'Staff', existing: [], now: NOW }).request;
  for (const to of ['Under Review', 'Approved', 'Completed']) {
    const res = applyTransition(r, to, { role: 'Manager', actor: 'M', now: NOW + 1000 });
    assert.ok(res.ok, res.error);
    r = res.request;
  }
  assert.deepEqual(r.history.map((h) => h.status), ['Submitted', 'Under Review', 'Approved', 'Completed']);
  assert.ok(r.approved_at && r.completed_at && !r.rejected_at);
});

test('invalid transitions are blocked', () => {
  const r = createRequest(good, { role: 'Staff', existing: [], now: NOW }).request;
  assert.ok(transitionError(r, 'Approved', 'Manager')); // must go through Under Review
  assert.ok(transitionError(r, 'Completed', 'Manager'));
  assert.ok(transitionError(r, 'Under Review', 'Staff')); // role
  assert.ok(transitionError(r, 'Under Review', 'Leadership'));
  assert.ok(transitionError(r, 'Bogus', 'Manager'));
  const review = applyTransition(r, 'Under Review', { role: 'Manager', now: NOW }).request;
  const rejected = applyTransition(review, 'Rejected', { role: 'Manager', comment: 'No budget left', now: NOW }).request;
  assert.ok(transitionError(rejected, 'Completed', 'Manager'), 'Rejected is terminal');
  assert.ok(transitionError(rejected, 'Approved', 'Manager'), 'Rejected is terminal');
  assert.deepEqual(allowedTransitions(review, 'Staff'), []);
  assert.deepEqual(allowedTransitions(review, 'Manager'), ['Approved', 'Rejected']);
});

test('reject requires a reason; comment length is limited', () => {
  const r = applyTransition(createRequest(good, { role: 'Staff', existing: [], now: NOW }).request, 'Under Review', { role: 'Manager', now: NOW }).request;
  assert.equal(applyTransition(r, 'Rejected', { role: 'Manager', comment: '  ' }).ok, false);
  assert.equal(applyTransition(r, 'Approved', { role: 'Manager', comment: 'x'.repeat(501) }).ok, false);
});

test('history timestamps never go backwards (clock skew)', () => {
  const r = createRequest(good, { role: 'Staff', existing: [], now: NOW }).request;
  const next = applyTransition(r, 'Under Review', { role: 'Manager', now: NOW - 60_000 }).request;
  assert.ok(next.history[1].at >= next.history[0].at);
});

test('overdue = open and past due date', () => {
  const r = createRequest(good, { role: 'Staff', existing: [], now: NOW }).request;
  assert.equal(isOverdue(r, NOW), false);
  assert.equal(isOverdue(r, NOW + 6 * 86400000), true);
  assert.equal(isOverdue({ ...r, status: 'Completed' }, NOW + 6 * 86400000), false);
});

test('stored-data validation accepts the sample and rejects tampering', () => {
  for (const r of generate().requests) assert.equal(storedRequestError(r), null, r.id);
  const r = generate().requests[0];
  assert.ok(storedRequestError({ ...r, status: 'Hacked' }));
  assert.ok(storedRequestError({ ...r, department: '<img src=x onerror=alert(1)>' }));
  assert.ok(storedRequestError({ ...r, history: [] }));
  assert.ok(storedRequestError({ ...r, title: 'x'.repeat(5000) }));
});

test('nextId continues the sequence', () => {
  assert.equal(nextId([{ id: 'REQ-0009' }, { id: 'REQ-0042' }]), 'REQ-0043');
  assert.equal(nextId([]), 'REQ-0001');
});
