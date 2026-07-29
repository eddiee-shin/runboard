-- ============================================================
-- RunBoard — 002_strava_tokens.sql
-- Strava 연동 토큰 저장 테이블 및 RLS 정책
-- ============================================================

create table if not exists public.strava_tokens (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles(id) on delete cascade,
  strava_athlete_id  bigint,
  access_token       text not null,
  refresh_token      text not null,
  expires_at         bigint not null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- RLS 활성화
alter table public.strava_tokens enable row level security;

-- RLS 정책 설정
create policy "strava_tokens: 본인만 조회"
  on public.strava_tokens for select
  using (profile_id = auth.uid());

create policy "strava_tokens: 본인만 생성/수정"
  on public.strava_tokens for insert
  with check (profile_id = auth.uid());

create policy "strava_tokens: 본인만 수정"
  on public.strava_tokens for update
  using (profile_id = auth.uid());

create policy "strava_tokens: 본인만 삭제"
  on public.strava_tokens for delete
  using (profile_id = auth.uid());
