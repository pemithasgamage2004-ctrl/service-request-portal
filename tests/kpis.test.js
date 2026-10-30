import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRequests, computeKpis, countByKey, weekStart, weeklyVolume } from '../src/lib/kpis.js';
import { KPI_SQL } from '../src/lib/sql.js';

const base = { department: 'IT', status: 'Submitted', due_at: '2026-10-10T00:00:00Z', approved_at: null, rejected_at: null, completed_at: null };
const rows = [
  { ...base, id: 'A', created_at: '2026-10-01T09:00:00Z' }, // open, overdue
  { ...base, id: 'B', created_at: '2026-10-05T09:00:00Z', status: 'Approved', approved_at: '2026-10-07T09:00:00Z', due_at: '2026-12-01T00:00:00Z' }, // open, 2 days
  { ...base, id: 'C', created_at: '2026-10-08T09:00:00Z', status: 'Rejected', rejected_at: '2026-10-09T09:00:00Z', department: 'HR' },
  { ...base, id: 'D', created_at: '2026-10-12T09:00:00Z', status: 'Completed', approved_at: '2026-10-16T09:00:00Z', completed_at: '2026-10-20T09:00:00Z' }, // 4 days
];
const NOW = Date.parse('2026-10-30T00:00:00Z');

test('KPIs: open, overdue, avg days to approval, approval rate', () => {
  const k = computeKpis(rows, NOW);
  assert.equal(k.total, 4);
  assert.equal(k.open, 2);
  assert.equal(k.overdue, 1); // A only: C is rejected (terminal), B not yet due
  assert.equal(k.avgDaysToApproval, 3); // (2 + 4) / 2
  assert.equal(k.approvalRate, 66.7); // 2 approved / 3 decided
});

test('KPIs with no data are null, not NaN', () => {
  const k = computeKpis([], NOW);
  assert.equal(k.avgDaysToApproval, null);
  assert.equal(k.approvalRate, null);
  assert.equal(k.open, 0);
});

test('filters: inclusive date range, department, status', () => {
  assert.deepEqual(filterRequests(rows, { from: '2026-10-05', to: '2026-10-08' }).map((r) => r.id), ['B', 'C']);
  assert.deepEqual(filterRequests(rows, { department: 'HR' }).map((r) => r.id), ['C']);
  assert.deepEqual(filterRequests(rows, { status: 'Completed' }).map((r) => r.id), ['D']);
  assert.equal(filterRequests(rows, {}).length, 4);
});

test('countByKey keeps a fixed, zero-filled order', () => {
  assert.deepEqual([...countByKey(rows, 'department', ['HR', 'IT', 'Legal'])], [['HR', 1], ['IT', 3], ['Legal', 0]]);
});

test('weekly buckets start on Monday and are zero-filled', () => {
  assert.equal(weekStart(Date.parse('2026-10-04T12:00:00Z')), '2026-09-28'); // Sunday -> previous Monday
  assert.equal(weekStart(Date.parse('2026-10-05T00:00:00Z')), '2026-10-05'); // Monday
  const w = weeklyVolume(rows, {});
  // D is completed on 2026-10-20, after the last submission: its week must still be included.
  assert.deepEqual(w.map((x) => x.week), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
  assert.deepEqual(w.map((x) => x.submitted), [1, 2, 1, 0]);
  assert.deepEqual(w.map((x) => x.completed), [0, 0, 0, 1]);
});

test('SQL uses bind parameters for filters', () => {
  const sql = KPI_SQL.open({ from: '2026-10-01', department: 'IT' });
  assert.match(sql, /department = :department/);
  assert.match(sql, /created_at >= :from_date/);
  assert.match(sql, /status IN \('Submitted', 'Under Review', 'Approved'\)/);
});
