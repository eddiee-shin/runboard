-- ============================================================
-- RunBoard — 001_init.sql
-- MVP 초기 스키마: 테이블, 제약, 인덱스, RLS 정책, 트리거
-- ============================================================

-- ────────────────────────────────────────
-- 1. profiles
-- ────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  nickname    text,
  username    text unique,
  avatar_url  text,
  country     text,
  timezone    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- auth.users 생성 시 자동으로 profiles 행 삽입
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────
-- 2. app_sources  (지원 러닝 앱)
-- ────────────────────────────────────────
create table if not exists public.app_sources (
  id       smallint primary key,
  code     text unique not null,   -- 'nike' | 'garmin' | 'strava' | 'samsung_health' | 'adidas_running'
  name     text not null,
  is_active boolean default true
);

insert into public.app_sources (id, code, name) values
  (1, 'nike',            'Nike Run Club'),
  (2, 'garmin',          'Garmin Connect'),
  (3, 'strava',          'Strava'),
  (4, 'samsung_health',  'Samsung Health'),
  (5, 'adidas_running',  'adidas Running')
on conflict do nothing;

-- ────────────────────────────────────────
-- 3. crews
-- ────────────────────────────────────────
create table if not exists public.crews (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  description text,
  owner_id    uuid references public.profiles(id) on delete set null,
  is_public   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ────────────────────────────────────────
-- 4. crew_members
-- ────────────────────────────────────────
create table if not exists public.crew_members (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid references public.crews(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role       text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz default now(),
  unique (crew_id, profile_id)
);

-- ────────────────────────────────────────
-- 5. running_goals
-- ────────────────────────────────────────
create table if not exists public.running_goals (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles(id) on delete cascade,
  goal_type   text not null
    check (goal_type in (
      'weekly_run_count',
      'weekly_distance_km',
      'monthly_distance_km',
      'target_pace_min_per_km',
      'avg_heart_rate_max',
      'weekly_long_run_count'
    )),
  goal_value  numeric not null,
  unit        text not null,
  period      text not null
    check (period in ('weekly', 'monthly', 'custom')),
  start_date  date,
  end_date    date,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ────────────────────────────────────────
-- 6. run_sessions
-- ────────────────────────────────────────
create table if not exists public.run_sessions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id) on delete cascade,
  crew_id          uuid references public.crews(id) on delete set null,
  source_app_id    smallint references public.app_sources(id),
  activity_date    date not null,
  activity_type    text default 'run',
  distance_km      numeric(10,2),
  duration_sec     integer,
  pace_sec_per_km  integer,
  calories         integer,
  avg_heart_rate   integer,
  max_heart_rate   integer,
  cadence          integer,
  elevation_gain_m numeric(10,2),
  steps            integer,
  notes            text,
  status           text not null default 'uploaded'
    check (status in (
      'uploaded', 'queued', 'parsing', 'parsed',
      'verified', 'feedback_ready', 'failed'
    )),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ────────────────────────────────────────
-- 8. run_extractions
-- ────────────────────────────────────────
create table if not exists public.run_extractions (
  id             uuid primary key default gen_random_uuid(),
  run_session_id uuid references public.run_sessions(id) on delete cascade,
  model_name     text,
  provider       text,
  template_version text,               -- 버전 관리 (review-v2 반영)
  raw_text       text,
  raw_json       jsonb,
  confidence     numeric(4,3),
  status         text not null default 'success'
    check (status in ('success', 'partial', 'failed')),
  error_message  text,
  created_at     timestamptz default now()
);

-- ────────────────────────────────────────
-- 9. ai_feedbacks
-- ────────────────────────────────────────
create table if not exists public.ai_feedbacks (
  id             uuid primary key default gen_random_uuid(),
  run_session_id uuid references public.run_sessions(id) on delete cascade,
  profile_id     uuid references public.profiles(id) on delete cascade,
  goal_summary   jsonb,
  feedback_text  text not null,
  feedback_json  jsonb,
  tone           text default 'coach'
    check (tone in ('coach', 'casual', 'strict')),
  created_at     timestamptz default now()
);

-- ────────────────────────────────────────
-- 인덱스
-- ────────────────────────────────────────
create index if not exists idx_run_sessions_profile_date
  on public.run_sessions (profile_id, activity_date desc);

create index if not exists idx_run_sessions_crew_date
  on public.run_sessions (crew_id, activity_date desc);

create index if not exists idx_run_sessions_source_app
  on public.run_sessions (source_app_id);

create index if not exists idx_running_goals_profile_active
  on public.running_goals (profile_id, is_active);

create index if not exists idx_crew_members_crew_profile
  on public.crew_members (crew_id, profile_id);

-- ────────────────────────────────────────
-- RLS 활성화
-- ────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.crews          enable row level security;
alter table public.crew_members   enable row level security;
alter table public.running_goals  enable row level security;
alter table public.run_sessions   enable row level security;
alter table public.run_extractions enable row level security;
alter table public.ai_feedbacks   enable row level security;

-- ────────────────────────────────────────
-- RLS 정책
-- ────────────────────────────────────────

-- profiles
create policy "profiles: 본인만 조회"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: 본인만 수정"
  on public.profiles for update using (auth.uid() = id);

-- crews
create policy "crews: 공개 크루 조회"
  on public.crews for select
  using (is_public = true or owner_id = auth.uid());

create policy "crews: 인증 사용자 생성"
  on public.crews for insert
  with check (auth.uid() is not null);

create policy "crews: 소유자/관리자만 수정"
  on public.crews for update
  using (
    owner_id = auth.uid() or
    exists (
      select 1 from public.crew_members
      where crew_id = crews.id
        and profile_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- crew_members
create policy "crew_members: 누구나 조회 가능"
  on public.crew_members for select
  using (auth.uid() is not null);

create policy "crew_members: owner/admin만 추가"
  on public.crew_members for insert
  with check (
    exists (
      select 1 from public.crew_members cm
      where cm.crew_id = crew_members.crew_id
        and cm.profile_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

create policy "crew_members: 본인 탈퇴 또는 owner/admin 삭제"
  on public.crew_members for delete
  using (
    profile_id = auth.uid() or
    exists (
      select 1 from public.crew_members cm
      where cm.crew_id = crew_members.crew_id
        and cm.profile_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

-- running_goals
create policy "running_goals: 본인만 CRUD"
  on public.running_goals for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- run_sessions
create policy "run_sessions: 본인 또는 같은 크루 멤버 조회"
  on public.run_sessions for select
  using (
    profile_id = auth.uid() or
    (crew_id is not null and exists (
      select 1 from public.crew_members cm
      where cm.crew_id = run_sessions.crew_id
        and cm.profile_id = auth.uid()
    ))
  );

create policy "run_sessions: 본인만 쓰기"
  on public.run_sessions for insert
  with check (profile_id = auth.uid());

create policy "run_sessions: 본인만 수정/삭제"
  on public.run_sessions for update using (profile_id = auth.uid());

create policy "run_sessions: 본인만 삭제"
  on public.run_sessions for delete using (profile_id = auth.uid());

-- run_extractions (서버 함수만 INSERT)
create policy "run_extractions: 세션 소유자 조회"
  on public.run_extractions for select
  using (
    exists (
      select 1 from public.run_sessions rs
      where rs.id = run_extractions.run_session_id
        and rs.profile_id = auth.uid()
    )
  );

-- ai_feedbacks (서버 함수만 INSERT)
create policy "ai_feedbacks: 본인만 조회"
  on public.ai_feedbacks for select
  using (profile_id = auth.uid());
