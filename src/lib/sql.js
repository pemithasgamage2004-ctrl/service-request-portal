// SQL (PostgreSQL) that would produce each dashboard figure from a `requests` table.
// Shown on the dashboard next to each KPI. Filters are expressed as bind parameters
// (never string-concatenated values) - the way it should be done against a real DB.
import { OPEN_STATUSES } from './enums.js';

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const inList = (arr) => arr.map(q).join(', ');

// The CREATE TABLE statements shown on the site now come straight from the migration
// files (src/lib/migrations.js); this module only builds the per-KPI illustrative queries.

/** WHERE-clause lines for the active filters (bind parameters) + a comment with the bound values. */
function filterClause(f) {
  const lines = [];
  const binds = [];
  // Date filters use the Asia/Colombo business calendar.
  if (f.from) {
    lines.push("(created_at AT TIME ZONE 'Asia/Colombo')::date >= :from_date");
    binds.push(`:from_date = '${f.from}'`);
  }
  if (f.to) {
    lines.push("(created_at AT TIME ZONE 'Asia/Colombo')::date <= :to_date");
    binds.push(`:to_date = '${f.to}'`);
  }
  if (f.department) {
    lines.push('department = :department');
    binds.push(`:department = '${f.department}'`);
  }
  if (f.status) {
    lines.push('status = :status');
    binds.push(`:status = '${f.status}'`);
  }
  return { lines, binds };
}

function build(select, extra, f, tail = '') {
  const { lines, binds } = filterClause(f);
  const where = [...extra, ...lines];
  let sql = `SELECT ${select}\nFROM requests`;
  if (where.length) sql += `\nWHERE ${where.join('\n  AND ')}`;
  if (tail) sql += `\n${tail}`;
  sql += ';';
  if (binds.length) sql += `\n-- bound parameters: ${binds.join(', ')}`;
  return sql;
}

const OPEN = `status IN (${inList(OPEN_STATUSES)})`;

export const KPI_SQL = {
  total: (f) => build('COUNT(*) AS total_requests', [], f),
  open: (f) => build('COUNT(*) AS open_requests', [OPEN], f),
  overdue: (f) => build('COUNT(*) AS overdue_requests', [OPEN, 'due_at < NOW()'], f),
  avgDaysToApproval: (f) =>
    build("ROUND(AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400)::numeric, 1)\n       AS avg_days_to_approval", ['approved_at IS NOT NULL'], f),
  medianDaysToApproval: (f) =>
    build("ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (\n         ORDER BY EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400))::numeric, 1)\n       AS median_days_to_approval", ['approved_at IS NOT NULL'], f),
  approvalRate: (f) =>
    build('ROUND(100.0 * COUNT(approved_at)\n       / NULLIF(COUNT(approved_at) + COUNT(rejected_at), 0), 1)\n       AS approval_rate_pct', [], f),
};

export const CHART_SQL = {
  department: (f) => build('department, COUNT(*) AS requests', [], f, 'GROUP BY department\nORDER BY department'),
  weekly: (f) =>
    build("date_trunc('week', created_at AT TIME ZONE 'Asia/Colombo')::date AS week, COUNT(*) AS submitted", [], f, 'GROUP BY 1\nORDER BY 1') +
    '\n\n-- completed per week (same filters on created_at)\n' +
    build("date_trunc('week', completed_at AT TIME ZONE 'Asia/Colombo')::date AS week, COUNT(*) AS completed", ['completed_at IS NOT NULL'], f, 'GROUP BY 1\nORDER BY 1'),
  status: (f) => build('status, COUNT(*) AS requests', [], f, 'GROUP BY status'),
  priority: (f) => build('priority, COUNT(*) AS requests', [], f, 'GROUP BY priority'),
};
