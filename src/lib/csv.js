// CSV serialisation shared by the Node generator and the browser export.
// RFC 4180 quoting + protection against CSV/formula injection: a cell that starts
// with = + - @ TAB or CR could be executed as a formula by Excel/Sheets, so it is
// prefixed with a single quote.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** rows: array of objects; columns: array of keys (header order). */
export function toCsv(rows, columns) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export const REQUEST_COLUMNS = [
  'id',
  'title',
  'description',
  'requester_name',
  'requester_id',
  'requester_role',
  'department',
  'request_type',
  'priority',
  'status',
  'created_at',
  'needed_by',
  'due_at',
  'approved_at',
  'rejected_at',
  'completed_at',
  'withdrawn_at',
  'updated_at',
];

export const HISTORY_COLUMNS = ['request_id', 'seq', 'from_status', 'status', 'at', 'actor_id', 'actor', 'role', 'comment'];

/** Flatten nested history into one row per status change (mirrors the SQL history table). */
export function historyRows(requests) {
  return requests.flatMap((r) =>
    r.history.map((h, i) => ({
      request_id: r.id, seq: i + 1, from_status: h.from, status: h.status, at: h.at, actor_id: h.actor_id, actor: h.actor, role: h.role, comment: h.comment,
    })),
  );
}
