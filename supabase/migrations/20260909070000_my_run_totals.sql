create or replace function public.get_my_run_totals()
returns table (
  total_distance_km numeric,
  total_runs bigint,
  total_duration_sec bigint,
  avg_pace_sec_per_km numeric,
  avg_heart_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    round(coalesce(sum(rs.distance_km), 0)::numeric, 2) as total_distance_km,
    count(*)::bigint as total_runs,
    coalesce(sum(rs.duration_sec), 0)::bigint as total_duration_sec,
    case
      when coalesce(sum(rs.distance_km), 0) > 0
        then round(sum(rs.duration_sec)::numeric / sum(rs.distance_km)::numeric, 2)
      else 0::numeric
    end as avg_pace_sec_per_km,
    round(coalesce(avg(rs.avg_heart_rate) filter (where rs.avg_heart_rate > 0), 0)::numeric, 2) as avg_heart_rate
  from public.run_sessions rs
  where rs.profile_id = (select auth.uid())
    and rs.status = 'verified';
$$;

revoke all on function public.get_my_run_totals() from public, anon;
grant execute on function public.get_my_run_totals() to authenticated, service_role;
