import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generate, CONFIG } from '../scripts/generate-data.mjs';
import { DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES } from '../src/lib/enums.js';

const { requests } = generate();

test('is deterministic for the same seed', () => {
  assert.deepEqual(generate(), generate());
});

test('produces the configured number of requests (>= 30)', () => {
  assert.equal(requests.length, CONFIG.COUNT);
  assert.ok(requests.length >= 30);
});

test('covers every department, type, priority and status', () => {
  for (const [field, values] of [['department', DEPARTMENTS], ['request_type', REQUEST_TYPES], ['priority', PRIORITIES], ['status', STATUSES]]) {
    const seen = new Set(requests.map((r) => r[field]));
    for (const v of values) assert.ok(seen.has(v), `${field} missing ${v}`);
  }
});

test('history is consistent with status and timestamps', () => {
  const asOf = Date.parse(CONFIG.AS_OF);
  for (const r of requests) {
    assert.equal(r.history[0].status, 'Submitted', r.id);
    assert.equal(r.history.at(-1).status, r.status, r.id);
    assert.equal(r.updated_at, r.history.at(-1).at, r.id);
    for (let i = 1; i < r.history.length; i++) assert.ok(r.history[i].at >= r.history[i - 1].at, `${r.id} out of order`);
    assert.ok(Date.parse(r.history.at(-1).at) <= asOf, `${r.id} has a future event`);
    assert.equal(r.approved_at !== null, r.history.some((h) => h.status === 'Approved'), r.id);
    assert.equal(r.rejected_at !== null, r.status === 'Rejected', r.id);
    assert.ok(!(r.approved_at && r.rejected_at), r.id);
  }
});
