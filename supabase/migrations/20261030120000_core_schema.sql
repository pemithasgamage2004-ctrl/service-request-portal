-- =============================================================================
-- Service Request Portal - core schema
-- Source of truth in Live mode (A9). Reference data in lookup tables (A12),
-- SLA policy and holidays in tables (A5), append-only history (A11).
-- Every table gets Row Level Security in 20261030120200_rls_policies.sql.
-- =============================================================================

-- Functions that must not be callable through the API live in `private`
-- (Supabase only exposes `public` through PostgREST).
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------- reference data (A12)
create table public.departments (
  name   text primary key check (char_length(name) between 2 and 40),
  active boolean not null default true
);
create table public.fulfilment_teams (
  name   text primary key check (char_length(name) between 2 and 40),
  active boolean not null default true
);
create table public.request_types (
  name   text primary key check (char_length(name) between 2 and 40),
  team   text not null references public.fulfilment_teams (name),
  active boolean not null default true
);
create table public.priorities (
  name       text primary key,
  sort_order smallint not null unique
);
-- SLA in business days per priority; ops can change it without a deploy (A5).
create table public.sla_policy (
  priority       text primary key references public.priorities (name),
  business_days  smallint not null check (business_days between 0 and 60),
  due_hour_local smallint not null default 17 check (due_hour_local between 0 and 23)
);
create table public.public_holidays (
  holiday_date date primary key,
  name         text not null check (char_length(name) between 2 and 80)
);

insert into public.departments (name) values ('Finance'), ('HR'), ('IT'), ('Operations'), ('Sales'), ('Marketing'), ('Legal');
insert into public.fulfilment_teams (name) values ('IT Service Desk'), ('IT Asset Team'), ('Facilities Team'), ('Operations Support');
insert into public.request_types (name, team) values
  ('IT Access', 'IT Service Desk'), ('Equipment', 'IT Asset Team'), ('Facilities', 'Facilities Team'),
  ('Software Licence', 'IT Service Desk'), ('Other', 'Operations Support');
insert into public.priorities (name, sort_order) values ('Low', 1), ('Medium', 2), ('High', 3), ('Critical', 4);
insert into public.sla_policy (priority, business_days) values ('Critical', 1), ('High', 3), ('Medium', 7), ('Low', 10);
-- Sri Lanka 2026 (Gazette 2438/22) - verify against the gazette; Admin can maintain this table.
insert into public.public_holidays (holiday_date, name) values
  ('2026-01-03', 'Duruthu Full Moon Poya Day'), ('2026-01-15', 'Tamil Thai Pongal Day'),
  ('2026-02-01', 'Navam Full Moon Poya Day'), ('2026-02-04', 'Independence Day'),
  ('2026-02-15', 'Mahasivarathri Day'), ('2026-03-02', 'Medin Full Moon Poya Day'),
  ('2026-03-21', 'Id-Ul-Fitr (Ramazan Festival Day)'), ('2026-04-01', 'Bak Full Moon Poya Day'),
  ('2026-04-03', 'Good Friday'), ('2026-04-13', 'Day prior to Sinhala and Tamil New Year Day'),
  ('2026-04-14', 'Sinhala and Tamil New Year Day'), ('2026-05-01', 'May Day / Vesak Full Moon Poya Day'),
  ('2026-05-02', 'Day following Vesak Full Moon Poya Day'), ('2026-05-28', 'Id-Ul-Alha (Hadji Festival Day)'),
  ('2026-06-29', 'Poson Full Moon Poya Day'), ('2026-07-29', 'Esala Full Moon Poya Day'),
  ('2026-08-26', 'Milad-Un-Nabi (Holy Prophet''s Birthday)'), ('2026-08-27', 'Nikini Full Moon Poya Day'),
  ('2026-09-26', 'Binara Full Moon Poya Day'), ('2026-10-25', 'Vap Full Moon Poya Day'),
  ('2026-11-08', 'Deepavali Festival Day'), ('2026-11-24', 'Il Full Moon Poya Day'),
  ('2026-12-23', 'Unduvap Full Moon Poya Day'), ('2026-12-25', 'Christmas Day');

-- ---------------------------------------------------------------- profiles (A1)
-- Role, department, team and employee ID are set by the server (sign-up trigger)
-- or an Admin - never by the user. Ownership of requests is by employee_id.
create sequence public.employee_number_seq start 7001 maxvalue 9999;

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  employee_id text not null unique check (employee_id ~ '^EMP-[0-9]{4}$'),
  full_name   text not null check (char_length(full_name) between 2 and 60),
  role        text not null default 'Staff' check (role in ('Staff', 'Manager', 'Fulfiller', 'Leadership', 'Admin')),
  department  text references public.departments (name),
  team        text references public.fulfilment_teams (name),
  created_at  timestamptz not null default now(),
  constraint manager_has_department check (role <> 'Manager' or department is not null),
  constraint fulfiller_has_team check (role <> 'Fulfiller' or team is not null),
  constraint submitter_has_department check (role in ('Leadership') or department is not null)
);

-- New sign-ups become Staff in the department they chose (validated against the
-- lookup table, else Operations). The name is sanitised; the role is never taken
-- from user-supplied metadata (open sign-up, A14).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(regexp_replace(coalesce(new.raw_user_meta_data ->> 'full_name', ''), '[^[:alpha:] .''-]', '', 'g'), 60);
  v_dept text := new.raw_user_meta_data ->> 'department';
begin
  if char_length(trim(v_name)) < 2 then v_name := 'New user'; end if;
  if v_dept is null or not exists (select 1 from public.departments d where d.name = v_dept and d.active) then
    v_dept := 'Operations';
  end if;
  insert into public.profiles (id, employee_id, full_name, role, department)
  values (new.id, 'EMP-' || lpad(nextval('public.employee_number_seq')::text, 4, '0'), trim(v_name), 'Staff', v_dept);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- requests
create sequence public.request_number_seq start 1 maxvalue 9999;

create table public.requests (
  id                    text primary key default 'REQ-' || lpad(nextval('public.request_number_seq')::text, 4, '0')
                          check (id ~ '^REQ-[0-9]{4}$'),
  title                 text not null check (char_length(title) between 5 and 100),
  description           text not null check (char_length(description) between 10 and 1000),
  requester_employee_id text not null check (requester_employee_id ~ '^EMP-[0-9]{4}$'),
  requester_name        text not null check (char_length(requester_name) between 2 and 60),
  requester_role        text not null check (requester_role in ('Staff', 'Manager', 'Fulfiller', 'Leadership', 'Admin')),
  department            text not null references public.departments (name),
  request_type          text not null references public.request_types (name),
  priority              text not null references public.priorities (name),
  status                text not null default 'Submitted'
                          check (status in ('Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Withdrawn')),
  created_at            timestamptz not null default now(),
  needed_by             date not null,
  due_at                timestamptz not null,
  approved_at           timestamptz,
  rejected_at           timestamptz,
  completed_at          timestamptz,
  withdrawn_at          timestamptz,
  updated_at            timestamptz not null default now(),
  constraint not_both_decisions check (not (approved_at is not null and rejected_at is not null)),
  constraint completed_needs_approval check (completed_at is null or approved_at is not null),
  constraint status_matches_timestamps check (
    (status <> 'Approved'  or approved_at  is not null) and
    (status <> 'Rejected'  or rejected_at  is not null) and
    (status <> 'Completed' or completed_at is not null) and
    (status <> 'Withdrawn' or withdrawn_at is not null))
);
create index requests_department_idx on public.requests (department);
create index requests_status_idx on public.requests (status);
create index requests_created_at_idx on public.requests (created_at);
create index requests_requester_idx on public.requests (requester_employee_id);

-- ---------------------------------------------------------------- append-only history (A11)
create table public.request_history (
  id                bigint generated always as identity primary key,
  request_id        text not null references public.requests (id) on delete cascade,
  seq               smallint not null,
  from_status       text check (from_status in ('Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Withdrawn')),
  to_status         text not null check (to_status in ('Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Withdrawn')),
  at                timestamptz not null default now(),
  actor_user_id     uuid references auth.users (id) on delete set null,
  actor_employee_id text not null check (actor_employee_id ~ '^EMP-[0-9]{4}$'),
  actor_name        text not null check (char_length(actor_name) between 1 and 100),
  actor_role        text not null check (actor_role in ('Staff', 'Manager', 'Fulfiller', 'Leadership', 'Admin')),
  comment           text not null default '' check (char_length(comment) <= 500),
  unique (request_id, seq)
);

-- History can never be changed: UPDATE is always refused, even for the table owner.
-- DELETE/TRUNCATE are refused unless a maintenance job explicitly opts in for its own
-- transaction (used only by the demo-data reset; API roles have no DELETE privilege at all).
create or replace function private.forbid_history_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'SRP403: status history is append-only' using errcode = 'P0001';
  end if;
  if coalesce(current_setting('srp.history_maintenance', true), '') <> 'on' then
    raise exception 'SRP403: status history is append-only' using errcode = 'P0001';
  end if;
  return null;
end $$;
create trigger history_no_update before update on public.request_history
  for each row execute function private.forbid_history_change();
create trigger history_no_delete before delete on public.request_history
  for each row execute function private.forbid_history_change();
create trigger history_no_truncate before truncate on public.request_history
  for each statement execute function private.forbid_history_change();
