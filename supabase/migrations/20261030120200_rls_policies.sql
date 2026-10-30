-- =============================================================================
-- Row Level Security and privileges (A1, A2, A11, A12, A15).
-- Principle: the API roles (anon, authenticated) can only READ through RLS
-- policies; every WRITE to requests/history goes through the SECURITY DEFINER
-- functions create_request() / transition_request(), which enforce the rules.
-- =============================================================================

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'Admin' from public.profiles p where p.id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- privileges
-- Start from nothing, then grant the minimum.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- New functions are executable by PUBLIC by default (and Supabase adds default grants
-- for anon/authenticated in `public`), so revoke explicitly and re-grant per function.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- RLS policies run as the caller, so the caller needs USAGE on `private` and EXECUTE on
-- the helper functions the policies call. `private` is not exposed through the API.
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_view_request(text, text, text, text) to authenticated;
grant execute on function private.team_for(text) to authenticated;

grant execute on function public.create_request(text, text, text, text, date) to authenticated;
grant execute on function public.transition_request(text, text, text) to authenticated;

-- ---------------------------------------------------------------- RLS on every table
alter table public.departments      enable row level security;
alter table public.fulfilment_teams enable row level security;
alter table public.request_types    enable row level security;
alter table public.priorities       enable row level security;
alter table public.sla_policy       enable row level security;
alter table public.public_holidays  enable row level security;
alter table public.profiles         enable row level security;
alter table public.requests         enable row level security;
alter table public.request_history  enable row level security;

-- Reference data: readable by everyone (the sign-up form needs departments before login);
-- writable only by Admin (A12). No DELETE: deactivate instead (keeps history valid).
grant select on public.departments, public.fulfilment_teams, public.request_types, public.priorities,
                public.sla_policy, public.public_holidays to anon, authenticated;
grant insert, update on public.departments, public.fulfilment_teams, public.request_types to authenticated;
grant update (business_days, due_hour_local) on public.sla_policy to authenticated;
grant insert, update, delete on public.public_holidays to authenticated;

create policy lookup_read on public.departments      for select to anon, authenticated using (true);
create policy lookup_read on public.fulfilment_teams for select to anon, authenticated using (true);
create policy lookup_read on public.request_types    for select to anon, authenticated using (true);
create policy lookup_read on public.priorities       for select to anon, authenticated using (true);
create policy lookup_read on public.sla_policy       for select to anon, authenticated using (true);
create policy lookup_read on public.public_holidays  for select to anon, authenticated using (true);

create policy admin_insert on public.departments      for insert to authenticated with check (private.is_admin());
create policy admin_update on public.departments      for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admin_insert on public.fulfilment_teams for insert to authenticated with check (private.is_admin());
create policy admin_update on public.fulfilment_teams for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admin_insert on public.request_types    for insert to authenticated with check (private.is_admin());
create policy admin_update on public.request_types    for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admin_update on public.sla_policy       for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admin_write  on public.public_holidays  for all    to authenticated using (private.is_admin()) with check (private.is_admin());

-- Profiles: you can read your own; Admin can read all and reassign role / department /
-- team (A2). Nobody else can change a profile - in particular not their own role.
grant select on public.profiles to authenticated;
grant update (role, department, team, full_name) on public.profiles to authenticated;
create policy profile_read  on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin());
create policy profile_admin on public.profiles for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- Requests: read-only through RLS, visibility per A15. No INSERT/UPDATE/DELETE grants.
grant select on public.requests to authenticated;
create policy request_read on public.requests for select to authenticated
  using (private.can_view_request(department, request_type, status, requester_employee_id));

-- History: visible exactly when its request is visible (the subquery is itself subject
-- to the requests policy). No UPDATE/DELETE grants; triggers also block them (A11).
grant select on public.request_history to authenticated;
create policy history_read on public.request_history for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id));
