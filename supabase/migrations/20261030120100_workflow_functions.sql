-- =============================================================================
-- Workflow rules enforced in the database (A2-A5, A10, A11).
-- Mirrors src/lib/workflow.js (Demo mode); CI runs the same scenarios against both.
--
-- Errors are raised with a stable code prefix so the client can show a generic,
-- friendly message without exposing database details:
--   SRP401 not signed in   SRP403 not allowed   SRP404 not found / not visible
--   SRP409 invalid transition   SRP422 validation failed
-- =============================================================================

-- ---------------------------------------------------------------- caller identity
-- The signed-in user's profile (role/department/team come from here, never the client).
create or replace function private.current_profile() returns public.profiles
language sql stable security definer set search_path = '' as $$
  select p.* from public.profiles p where p.id = auth.uid()
$$;

create or replace function private.team_for(p_request_type text) returns text
language sql stable security definer set search_path = '' as $$
  select t.team from public.request_types t where t.name = p_request_type
$$;

-- Row visibility (A15), used by the RLS SELECT policies and by the functions below.
create or replace function private.can_view_request(
  p_department text, p_request_type text, p_status text, p_requester_employee_id text
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := private.current_profile();
begin
  if me.id is null then return false; end if;
  if me.employee_id = p_requester_employee_id then return true; end if;
  return case me.role
    when 'Leadership' then true
    when 'Admin' then true
    when 'Manager' then p_department = me.department
    when 'Fulfiller' then p_status in ('Approved', 'Completed') and private.team_for(p_request_type) = me.team
    else false
  end;
end $$;

-- ---------------------------------------------------------------- SLA (A5)
-- 17:00 Asia/Colombo (sla_policy.due_hour_local) on the Nth business day after the
-- submission date, skipping Saturdays, Sundays and public_holidays.
create or replace function private.sla_due_at(p_created timestamptz, p_priority text) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_days smallint;
  v_hour smallint;
  d date := (p_created at time zone 'Asia/Colombo')::date;
begin
  select s.business_days, s.due_hour_local into v_days, v_hour from public.sla_policy s where s.priority = p_priority;
  if v_days is null then
    raise exception 'SRP422: no SLA policy for priority' using errcode = 'P0001';
  end if;
  while v_days > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 and not exists (select 1 from public.public_holidays h where h.holiday_date = d) then
      v_days := v_days - 1;
    end if;
  end loop;
  return (d + make_time(v_hour, 0, 0)) at time zone 'Asia/Colombo';
end $$;

-- Strip control characters (except tab/newline) and trim, like the client.
create or replace function private.clean_text(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'))
$$;

-- ---------------------------------------------------------------- create (A1, A10)
create or replace function public.create_request(
  p_title text, p_description text, p_request_type text, p_priority text, p_needed_by date
) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me      public.profiles := private.current_profile();
  v_title text := private.clean_text(p_title);
  v_desc  text := private.clean_text(p_description);
  v_today date := (now() at time zone 'Asia/Colombo')::date;
  v_id    text;
begin
  if me.id is null then raise exception 'SRP401: not signed in' using errcode = 'P0001'; end if;
  if me.role not in ('Staff', 'Manager', 'Fulfiller', 'Admin') then
    raise exception 'SRP403: this role cannot submit requests' using errcode = 'P0001';
  end if;
  if char_length(v_title) not between 5 and 100 then raise exception 'SRP422: title must be 5-100 characters' using errcode = 'P0001'; end if;
  if char_length(v_desc) not between 10 and 1000 then raise exception 'SRP422: description must be 10-1000 characters' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.request_types t where t.name = p_request_type and t.active) then
    raise exception 'SRP422: unknown request type' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.priorities pr where pr.name = p_priority) then
    raise exception 'SRP422: unknown priority' using errcode = 'P0001';
  end if;
  if p_needed_by is null or p_needed_by < v_today or p_needed_by > v_today + 180 then
    raise exception 'SRP422: needed-by date must be between today and 180 days ahead' using errcode = 'P0001';
  end if;

  -- Identity, role and department come from the caller's profile, never from parameters.
  insert into public.requests (title, description, requester_employee_id, requester_name, requester_role,
                               department, request_type, priority, needed_by, due_at)
  values (v_title, v_desc, me.employee_id, me.full_name, me.role,
          me.department, p_request_type, p_priority, p_needed_by, private.sla_due_at(now(), p_priority))
  returning id into v_id;

  insert into public.request_history (request_id, seq, from_status, to_status, actor_user_id, actor_employee_id, actor_name, actor_role, comment)
  values (v_id, 1, null, 'Submitted', me.id, me.employee_id, me.full_name, me.role, 'Request submitted.');
  return v_id;
end $$;

-- ---------------------------------------------------------------- transitions (A2-A4, A11)
-- Same matrix as TRANSITIONS in src/lib/workflow.js:
--   Submitted    -> Under Review (approver) | Withdrawn (requester)
--   Under Review -> Approved | Rejected (approver)
--   Approved     -> Completed (fulfiller)
--   Rejected / Completed / Withdrawn are final.
create or replace function public.transition_request(p_request_id text, p_to text, p_comment text default '')
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  me      public.profiles := private.current_profile();
  r       public.requests;
  v_rule  text;
  v_note  text := private.clean_text(p_comment);
  v_now   timestamptz := now();
  v_seq   smallint;
begin
  if me.id is null then raise exception 'SRP401: not signed in' using errcode = 'P0001'; end if;

  select * into r from public.requests q where q.id = p_request_id for update;
  -- Not found and not visible look the same, so existence is not leaked.
  if r.id is null or not private.can_view_request(r.department, r.request_type, r.status, r.requester_employee_id) then
    raise exception 'SRP404: request not found' using errcode = 'P0001';
  end if;

  v_rule := case
    when r.status = 'Submitted'    and p_to = 'Under Review' then 'approver'
    when r.status = 'Submitted'    and p_to = 'Withdrawn'    then 'requester'
    when r.status = 'Under Review' and p_to in ('Approved', 'Rejected') then 'approver'
    when r.status = 'Approved'     and p_to = 'Completed'    then 'fulfiller'
  end;
  if v_rule is null then
    raise exception 'SRP409: cannot move from % to %', r.status, coalesce(p_to, 'null') using errcode = 'P0001';
  end if;

  if v_rule = 'requester' and me.employee_id <> r.requester_employee_id then
    raise exception 'SRP403: only the requester can withdraw' using errcode = 'P0001';
  end if;
  if v_rule = 'approver' then
    if me.employee_id = r.requester_employee_id then
      raise exception 'SRP403: you cannot decide your own request' using errcode = 'P0001';
    end if;
    if r.requester_role = 'Manager' then
      if me.role <> 'Admin' then raise exception 'SRP403: requests raised by a manager are decided by an Admin' using errcode = 'P0001'; end if;
    elsif me.role <> 'Manager' or me.department is distinct from r.department then
      raise exception 'SRP403: only this department''s manager can act' using errcode = 'P0001';
    end if;
  end if;
  if v_rule = 'fulfiller' then
    if me.employee_id = r.requester_employee_id then
      raise exception 'SRP403: you cannot complete your own request' using errcode = 'P0001';
    end if;
    if me.role <> 'Fulfiller' or me.team is distinct from private.team_for(r.request_type) then
      raise exception 'SRP403: only the fulfilment team for this request type can complete it' using errcode = 'P0001';
    end if;
  end if;

  if char_length(v_note) > 500 then raise exception 'SRP422: comment must be at most 500 characters' using errcode = 'P0001'; end if;
  if p_to = 'Rejected' and char_length(v_note) < 10 then
    raise exception 'SRP422: a rejection reason of at least 10 characters is required' using errcode = 'P0001';
  end if;

  -- History never goes backwards in time.
  v_now := greatest(v_now, (select max(h.at) from public.request_history h where h.request_id = r.id));
  update public.requests q set
    status       = p_to,
    updated_at   = v_now,
    approved_at  = case when p_to = 'Approved'  then v_now else q.approved_at end,
    rejected_at  = case when p_to = 'Rejected'  then v_now else q.rejected_at end,
    completed_at = case when p_to = 'Completed' then v_now else q.completed_at end,
    withdrawn_at = case when p_to = 'Withdrawn' then v_now else q.withdrawn_at end
  where q.id = r.id;

  select coalesce(max(h.seq), 0) + 1 into v_seq from public.request_history h where h.request_id = r.id;
  insert into public.request_history (request_id, seq, from_status, to_status, at, actor_user_id, actor_employee_id, actor_name, actor_role, comment)
  values (r.id, v_seq, r.status, p_to, v_now, me.id, me.employee_id, me.full_name, me.role, v_note);
  return p_to;
end $$;
