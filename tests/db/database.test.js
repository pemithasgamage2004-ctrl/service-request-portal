// Database tests for Live mode: migrations, RLS policies and workflow functions,
// run against real PostgreSQL. Enabled with SRP_DB_TESTS=1 (the CI `db` job);
// skipped in the normal unit-test run.
import { describe, test, expect, beforeAll } from 'vitest';
import { enabled, admin, as, resetDatabase } from './pg.js';
import { PERSONAS } from '../../src/lib/people.js';
import { canView, transitionError, TRANSITIONS } from '../../src/lib/workflow.js';
import { computeKpis } from '../../src/lib/kpis.js';
import { slaDueAt } from '../../src/lib/sla.js';
import { generate } from '../../scripts/generate-data.mjs';

const sample = generate().requests;
const P = Object.fromEntries(PERSONAS.map((p, i) => [p.key, { ...p, uid: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }]));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ids = (out) => out.split('\n').filter(Boolean).sort();

describe.skipIf(!enabled)('database (migrations + RLS + workflow functions)', () => {
  beforeAll(() => {
    resetDatabase();
    // Demo accounts: sign-up trigger creates a Staff profile, then the owner assigns
    // the persona's employee ID, role, department and team (what an Admin would do).
    for (const p of Object.values(P)) {
      admin(`insert into auth.users (id, email, raw_user_meta_data) values (${q(p.uid)}, ${q(`${p.key}@demo.invalid`)}, '{"full_name": ${JSON.stringify(p.name)}}');
             update public.profiles set employee_id = ${q(p.id)}, full_name = ${q(p.name)}, role = ${q(p.role)},
               department = ${p.department ? q(p.department) : 'null'}, team = ${p.team ? q(p.team) : 'null'} where id = ${q(p.uid)};`);
    }
  }, 60_000);

  describe('schema hardening', () => {
    test('RLS is enabled on every table in public', () => {
      expect(admin(`select string_agg(tablename, ',') from pg_tables where schemaname = 'public' and not rowsecurity`)).toBe('');
    });
    test('every SECURITY DEFINER function pins search_path', () => {
      expect(admin(`select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)).toBe('');
    });
    test('views use security_invoker (so RLS applies to the caller)', () => {
      expect(admin(`select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions @> '{security_invoker=on}', false)`)).toBe('');
    });
    test('lookup tables match the app enums', () => {
      expect(admin(`select string_agg(name, ',' order by name) from public.departments`)).toBe('Finance,HR,IT,Legal,Marketing,Operations,Sales');
      expect(admin(`select string_agg(priority || '=' || business_days, ',' order by priority) from public.sla_policy`)).toBe('Critical=1,High=3,Low=10,Medium=7');
    });
  });

  describe('RLS visibility matches the client rules (A15) for every persona', () => {
    for (const key of Object.keys(P)) {
      test(key, () => {
        const expected = sample.filter((r) => canView(r, P[key])).map((r) => r.id).sort();
        const res = as(P[key].uid, 'select id from public.requests');
        expect(res.ok, res.err).toBe(true);
        expect(ids(res.out)).toEqual(expected);
        // history visibility follows the request
        const hist = as(P[key].uid, 'select distinct request_id from public.request_history');
        expect(ids(hist.out)).toEqual(expected);
      });
    }
  });

  describe('transition rules match the client rules for every persona x request x next status', () => {
    for (const key of Object.keys(P)) {
      test(key, () => {
        const attempts = sample.flatMap((r) => Object.keys(TRANSITIONS[r.status]).map((to) => ({ r, to })));
        // One subtransaction per attempt; success is rolled back too, so attempts are independent.
        const block = attempts.map(({ r, to }) => `
          begin perform public.transition_request(${q(r.id)}, ${q(to)}, 'Automated parity check'); raise exception 'SRP_OK';
          exception when others then raise notice 'R|%|%|%', ${q(r.id)}, ${q(to)}, sqlerrm; end;`).join('');
        const res = as(P[key].uid, `do $$ begin ${block} end $$`);
        expect(res.ok, res.err).toBe(true);
        const got = Object.fromEntries(res.err.split('\n').filter((l) => l.includes('R|')).map((l) => {
          const [, id, to, msg] = l.slice(l.indexOf('R|')).split('|');
          return [`${id}>${to}`, msg === 'SRP_OK' ? 'ok' : msg];
        }));
        for (const { r, to } of attempts) {
          const js = transitionError(r, to, P[key]);
          const sql = got[`${r.id}>${to}`];
          expect(sql === 'ok', `${key}: ${r.id} ${r.status}->${to} (js: ${js ?? 'allowed'}, db: ${sql})`).toBe(js === null);
          if (sql !== 'ok') expect(sql).toMatch(/^SRP40[34]/);
        }
      });
    }
  });

  describe('workflow functions', () => {
    test('create_request takes identity from the profile and computes the business-day SLA', () => {
      // (private.sla_due_at() itself is not executable by API users - checked below.)
      const iso = (col) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
      const res = as(P['staff-it'].uid, `select public.create_request('New laptop please', 'My laptop no longer turns on reliably.', 'Equipment', 'High', current_date + 7) \\g /dev/null
        select requester_employee_id, department, requester_role, status, ${iso("date_trunc('second', created_at)")}, ${iso('due_at')} from public.requests where id = 'REQ-0061'`);
      expect(res.ok, res.err).toBe(true);
      const [emp, dept, role, status, created, due] = res.out.split('|');
      expect([emp, dept, role, status]).toEqual(['EMP-2003', 'IT', 'Staff', 'Submitted']);
      expect(due).toBe(slaDueAt(created, 'High'));
      expect(as(P['staff-it'].uid, `select private.sla_due_at(now(), 'High')`).err).toMatch(/permission denied/);
    });
    test('validation is enforced server-side (A10)', () => {
      const bad = [
        ["'abc'", "'long enough description'", "'Equipment'", "'High'", 'current_date + 7', /title/],
        ["'Fine title'", "'short'", "'Equipment'", "'High'", 'current_date + 7', /description/],
        ["'Fine title'", "'long enough description'", "'Teleporter'", "'High'", 'current_date + 7', /request type/],
        ["'Fine title'", "'long enough description'", "'Equipment'", "'Urgent'", 'current_date + 7', /priority/],
        ["'Fine title'", "'long enough description'", "'Equipment'", "'High'", 'current_date - 1', /needed-by/],
        ["'Fine title'", "'long enough description'", "'Equipment'", "'High'", 'current_date + 400', /needed-by/],
      ];
      for (const [t, d, ty, pr, nb, msg] of bad) {
        const res = as(P['staff-it'].uid, `select public.create_request(${t}, ${d}, ${ty}, ${pr}, ${nb})`);
        expect(res.ok).toBe(false);
        expect(res.err).toMatch(/SRP422/);
        expect(res.err).toMatch(msg);
      }
    });
    test('Leadership cannot submit; anonymous users cannot call the API functions', () => {
      expect(as(P.leadership.uid, `select public.create_request('Fine title', 'long enough description', 'Equipment', 'High', current_date + 7)`).err).toMatch(/SRP403/);
      expect(as(null, `select public.create_request('Fine title', 'long enough description', 'Equipment', 'High', current_date + 7)`, { role: 'anon' }).err).toMatch(/permission denied/);
      expect(as(null, `select public.transition_request('REQ-0001', 'Withdrawn', '')`, { role: 'anon' }).err).toMatch(/permission denied/);
    });
    test('rejection needs a 10+ character reason; history records from/to, actor and role', () => {
      const id = sample.find((r) => r.status === 'Under Review' && r.department === 'IT' && r.requester_role === 'Staff').id;
      expect(as(P['manager-it'].uid, `select public.transition_request(${q(id)}, 'Rejected', 'no budget')`).err).toMatch(/SRP422/);
      const res = as(P['manager-it'].uid, `select public.transition_request(${q(id)}, 'Rejected', 'No budget left this quarter') \\g /dev/null
        select from_status || '>' || to_status || '|' || actor_employee_id || '|' || actor_role || '|' || (actor_user_id is not null)
        from public.request_history where request_id = ${q(id)} order by seq desc limit 1`);
      expect(res.out).toBe('Under Review>Rejected|EMP-3003|Manager|true');
    });
    test('a request that is not visible looks the same as one that does not exist', () => {
      const itReq = sample.find((r) => r.department === 'IT' && r.status === 'Submitted').id;
      expect(as(P['staff-finance'].uid, `select public.transition_request(${q(itReq)}, 'Under Review', '')`).err).toMatch(/SRP404/);
      expect(as(P['staff-finance'].uid, `select public.transition_request('REQ-9999', 'Under Review', '')`).err).toMatch(/SRP404/);
    });
  });

  describe('tamper resistance', () => {
    test('API roles cannot write requests directly', () => {
      for (const sql of [
        `insert into public.requests (title, description, requester_employee_id, requester_name, requester_role, department, request_type, priority, needed_by, due_at)
           values ('Sneaky one', 'Bypassing the function', 'EMP-2003', 'X', 'Staff', 'IT', 'Equipment', 'Low', current_date, now())`,
        `update public.requests set status = 'Approved' where id = 'REQ-0001'`,
        `delete from public.requests where id = 'REQ-0001'`,
      ]) expect(as(P.admin.uid, sql).err).toMatch(/permission denied/);
    });
    test('nobody can edit or delete history - not even the table owner (A11)', () => {
      expect(as(P.admin.uid, `update public.request_history set comment = 'edited' where id = 1`).err).toMatch(/permission denied/);
      expect(as(P.admin.uid, `delete from public.request_history where id = 1`).err).toMatch(/permission denied/);
      expect(() => admin(`update public.request_history set comment = 'edited' where id = 1`)).toThrow(/append-only/);
      expect(() => admin(`delete from public.request_history where id = 1`)).toThrow(/append-only/);
      expect(() => admin(`truncate public.request_history`)).toThrow(/append-only/);
    });
    test('users cannot change their own role; Admin can reassign a manager (A2)', () => {
      const self = as(P['staff-it'].uid, `update public.profiles set role = 'Admin' where id = auth.uid() returning role`);
      expect(self.ok).toBe(true);
      expect(self.out).toBe(''); // RLS: zero rows updated
      const byAdmin = as(P.admin.uid, `update public.profiles set department = 'Sales' where employee_id = 'EMP-3003' returning department`);
      expect(byAdmin.out).toBe('Sales');
    });
    test('sign-up never trusts metadata for role; invalid department falls back; name is sanitised', () => {
      const out = admin(`insert into auth.users (email, raw_user_meta_data)
          values ('mallory@demo.invalid', '{"full_name": "<script>Mallory</script>", "role": "Admin", "department": "Board"}') returning id \\g /dev/null
        select role || '|' || department || '|' || full_name || '|' || (employee_id ~ '^EMP-7[0-9]{3}$') from public.profiles p join auth.users u on u.id = p.id where u.email = 'mallory@demo.invalid'`);
      expect(out).toBe('Staff|Operations|scriptMalloryscript|true');
    });
    test('reference data: only Admin can change it (A12)', () => {
      expect(as(P['manager-it'].uid, `insert into public.departments (name) values ('Shadow IT')`).err).toMatch(/row-level security/);
      expect(as(P.admin.uid, `insert into public.departments (name) values ('Procurement') returning name`).out).toBe('Procurement');
      expect(as(P['staff-it'].uid, `update public.sla_policy set business_days = 30 where priority = 'Low' returning priority`).out).toBe('');
    });
    test('anonymous users see reference data but no requests, history or profiles', () => {
      expect(as(null, 'select count(*) from public.departments', { role: 'anon' }).out).toBe('7');
      for (const t of ['requests', 'request_history', 'profiles', 'v_requests']) {
        expect(as(null, `select count(*) from public.${t}`, { role: 'anon' }).err).toMatch(/permission denied/);
      }
    });
  });

  describe('SLA and KPI parity with the client (A5-A7)', () => {
    test('due_at for every seeded request equals the SQL business-day function', () => {
      expect(admin(`select count(*) from public.requests where due_at <> private.sla_due_at(created_at, priority)`)).toBe('0');
      for (const [created, pr] of [['2026-10-30T04:30:00Z', 'Critical'], ['2026-11-16T05:00:00Z', 'Low'], ['2026-12-22T05:00:00Z', 'High'], ['2026-10-29T19:00:00Z', 'Critical']]) {
        const sql = admin(`select to_char(private.sla_due_at('${created}', '${pr}') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`);
        expect(sql, `${created} ${pr}`).toBe(slaDueAt(created, pr));
      }
    });
    const NOW = '2026-10-30T06:00:00Z';
    const kpiSql = (args) => `select concat_ws('|', total_requests, open_requests, overdue_requests, avg_days_to_approval, median_days_to_approval, approval_rate_pct, withdrawn_requests)
      from public.kpi_summary(${args}, p_now => '${NOW}')`;
    const jsKpi = (rows) => {
      const k = computeKpis(rows, Date.parse(NOW));
      const n = (v) => (v === null ? '' : Number(v).toFixed(1));
      return [k.total, k.open, k.overdue, n(k.avgDaysToApproval), n(k.medianDaysToApproval), n(k.approvalRate), k.withdrawn].join('|').replace(/\|\|/g, '||');
    };
    for (const [label, key, args, filter] of [
      ['Leadership, no filters', 'leadership', 'p_from => null', () => true],
      ['Leadership, IT + date range', 'leadership', "p_from => '2026-08-01', p_to => '2026-09-30', p_department => 'IT'", (r) => r.department === 'IT' && r.created_at >= '2026-07-31T18:30:00Z' && r.created_at < '2026-09-30T18:30:00Z'],
      ['Manager (Operations): RLS-limited', 'manager-operations', 'p_from => null', () => true],
      ['Staff (IT): own requests only', 'staff-it', 'p_from => null', () => true],
    ]) {
      test(`kpi_summary = computeKpis: ${label}`, () => {
        const visible = sample.filter((r) => canView(r, P[key]) && filter(r));
        const res = as(P[key].uid, kpiSql(args));
        expect(res.ok, res.err).toBe(true);
        expect(res.out).toBe(jsKpi(visible));
      });
    }
  });
});
