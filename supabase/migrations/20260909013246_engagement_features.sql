-- Persistent import summaries shown in My Runs.
create table public.import_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('garmin_csv', 'garmin_link', 'strava')),
  label text,
  total_count integer not null default 0 check (total_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index import_reports_profile_created_idx
  on public.import_reports (profile_id, created_at desc);

alter table public.import_reports enable row level security;

grant select, insert on public.import_reports to authenticated;
grant select, insert, update, delete on public.import_reports to service_role;

create policy "import_reports: 본인만 조회"
  on public.import_reports for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "import_reports: 본인만 생성"
  on public.import_reports for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

-- One current value per goal type lets the app save goals atomically.
create unique index running_goals_profile_type_unique
  on public.running_goals (profile_id, goal_type);

-- Keep ownership unchanged when users update profile and run rows.
drop policy if exists "profiles: 본인만 수정" on public.profiles;
create policy "profiles: 본인만 수정"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "run_sessions: 본인만 수정/삭제" on public.run_sessions;
create policy "run_sessions: 본인만 수정"
  on public.run_sessions for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
