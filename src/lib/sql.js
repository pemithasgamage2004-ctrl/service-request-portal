// SQL (PostgreSQL) that would produce each dashboard figure from a `requests` table.
// Shown on the dashboard next to each KPI. Filters are expressed as bind parameters
// (never string-concatenated values) - the way it should be done against a real DB.
import { DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES, ROLES, OPEN_STATUSES } from './enums.js';

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const inList = (arr) => arr.map(q).join(', ');

export const CREATE_TABLE_SQL = `CREATE TABLE requests (
  id             VARCHAR(9)    PRIMARY KEY,               -- e.g. REQ-0042
  title          VARCHAR(100)  NOT NULL CHECK (char_length(title) >= 5),
  description    VARCHAR(1000) NOT NULL CHECK (char_length(description) >= 10),
  requester_name VARCHAR(60)   NOT NULL,
  requester_id   CHAR(8)       NOT NULL CHECK (requester_id ~ '^EMP-[0-9]{4}$'),
  requester_role VARCHAR(10)   NOT NULL CHECK (requester_role IN (${inList(ROLES)})),
  department     VARCHAR(20)   NOT NULL CHECK (department IN (${inList(DEPARTMENTS)})),
  request_type   VARCHAR(20)   NOT NULL CHECK (request_type IN (${inList(REQUEST_TYPES)})),
  priority       VARCHAR(10)   NOT NULL CHECK (priority IN (${inList(PRIORITIES)})),
  status         VARCHAR(15)   NOT NULL CHECK (status IN (${inList(STATUSES)})),
  created_at     TIMESTAMPTZ   NOT NULL,
  needed_by      DATE          NOT NULL,
  due_at         TIMESTAMPTZ   NOT NULL,                  -- 17:00 Asia/Colombo on the Nth business day (sla_policy)
  approved_at    TIMESTAMPTZ,
  rejected_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  withdrawn_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ   NOT NULL,
  CHECK (NOT (approved_at IS NOT NULL AND rejected_at IS NOT NULL)),
  CHECK (completed_at IS NULL OR approved_at IS NOT NULL)
);

CREATE TABLE request_status_history (
  request_id VARCHAR(9)   NOT NULL REFERENCES requests(id),
  seq        SMALLINT     NOT NULL,
  from_status VARCHAR(15) CHECK (from_status IN (${inList(STATUSES)})),
  status     VARCHAR(15)  NOT NULL CHECK (status IN (${inList(STATUSES)})),
  at         TIMESTAMPTZ  NOT NULL,
  actor_id   CHAR(8)      NOT NULL,
  actor      VARCHAR(100) NOT NULL,
  role       VARCHAR(10)  NOT NULL CHECK (role IN (${inList(ROLES)})),
  comment    VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (request_id, seq)
);

CREATE INDEX idx_requests_created_at ON requests (created_at);
CREATE INDEX idx_requests_department ON requests (department);
CREATE INDEX idx_requests_status     ON requests (status);`;

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
