// Test helper: runs SQL through the `psql` client against a throwaway database, as a
// chosen user (role + JWT claims exactly like Supabase's PostgREST sets them).
// Connection comes from the standard PG* environment variables.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

export const DB = process.env.SRP_DB_TEST_DATABASE || 'srp_test';
export const enabled = Boolean(process.env.SRP_DB_TESTS);

function run(sql, { db = DB, file } = {}) {
  // SQL goes in on stdin (not -c) so psql meta-commands such as \g work and each
  // statement runs on its own, like a script.
  const args = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db];
  if (file) args.push('-f', file);
  const res = spawnSync('psql', args, { encoding: 'utf8', input: file ? undefined : `${sql};\n` });
  if (res.error) throw res.error;
  return { ok: res.status === 0, out: res.stdout.trim(), err: res.stderr.trim() };
}

/** Run as the database owner (setup / assertions about catalog state). */
export function admin(sql) {
  const r = run(sql);
  if (!r.ok) throw new Error(`SQL failed: ${r.err}\n${sql.slice(0, 300)}`);
  return r.out;
}

/**
 * Run `sql` inside a transaction that is always rolled back, as `role`
 * ('authenticated' with the given user id, or 'anon').
 * Returns { ok, out, err } - err holds the database error message on failure.
 */
export function as(user, sql, { role = 'authenticated' } = {}) {
  const claims = JSON.stringify(user ? { sub: user, role } : { role });
  return run(`begin;
set local role ${role};
select set_config('request.jwt.claims', '${claims}', true) \\g /dev/null
${sql};
rollback;`);
}

/** Fresh database: Supabase shim, all migrations in order, seed. */
export function resetDatabase() {
  // Separate calls: DROP/CREATE DATABASE cannot run inside a transaction block.
  for (const stmt of [`drop database if exists ${DB} with (force)`, `create database ${DB}`]) {
    const r = run(stmt, { db: 'postgres' });
    if (!r.ok) throw new Error(r.err);
  }
  const files = [
    'supabase/tests/00_supabase_shim.sql',
    ...readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort().map((f) => `supabase/migrations/${f}`),
    'supabase/seed.sql',
  ];
  for (const file of files) {
    const r = run(null, { file });
    if (!r.ok) throw new Error(`${file}: ${r.err}`);
  }
  return files;
}

export const readText = (f) => readFileSync(f, 'utf8');
