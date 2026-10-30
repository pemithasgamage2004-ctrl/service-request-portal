-- =============================================================================
-- Reporting (A6, A7, A15). The dashboard shows THIS SQL next to each KPI, and in
-- Live mode calls this function, so the figures and the displayed SQL are one source.
-- security_invoker = on / SECURITY INVOKER: the caller's RLS policies apply, so KPIs
-- only cover requests the caller may see. (A plain view would run with the view
-- owner's rights and bypass RLS.)
-- =============================================================================

-- @sql:view
create view public.v_requests with (security_invoker = on) as
select
  r.*,
  private.team_for(r.request_type) as team,
  r.status in ('Submitted', 'Under Review', 'Approved') as is_open,
  extract(epoch from (r.approved_at - r.created_at)) / 86400 as days_to_approval
from public.requests r;
-- @end

grant select on public.v_requests to authenticated;

-- @sql:kpi_summary
create function public.kpi_summary(
  p_from       date        default null,  -- submitted on/after (Asia/Colombo calendar day)
  p_to         date        default null,  -- submitted on/before
  p_department text        default null,
  p_status     text        default null,
  p_now        timestamptz default now()  -- "now" for overdue (parameter makes it testable)
) returns table (
  total_requests          integer,
  open_requests           integer,
  overdue_requests        integer,
  avg_days_to_approval    numeric,
  median_days_to_approval numeric,
  approval_rate_pct       numeric,
  withdrawn_requests      integer
)
language sql stable security invoker set search_path = '' as $$
  select
    count(*)::int,
    count(*) filter (where v.is_open)::int,
    count(*) filter (where v.is_open and v.due_at < p_now)::int,
    round(avg(v.days_to_approval)::numeric, 1),
    round((percentile_cont(0.5) within group (order by v.days_to_approval)
           filter (where v.days_to_approval is not null))::numeric, 1),
    -- Withdrawn requests are never decided, so they are excluded automatically (A7).
    round(100.0 * count(v.approved_at) / nullif(count(v.approved_at) + count(v.rejected_at), 0), 1),
    count(*) filter (where v.status = 'Withdrawn')::int
  from public.v_requests v
  where (p_from is null or (v.created_at at time zone 'Asia/Colombo')::date >= p_from)
    and (p_to is null or (v.created_at at time zone 'Asia/Colombo')::date <= p_to)
    and (p_department is null or v.department = p_department)
    and (p_status is null or v.status = p_status)
$$;
-- @end

revoke execute on function public.kpi_summary(date, date, text, text, timestamptz) from public, anon;
grant execute on function public.kpi_summary(date, date, text, text, timestamptz) to authenticated;
