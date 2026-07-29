-- ============================================================
-- RunBoard — 003_garmin_tokens.sql
-- Garmin 연동 세션 토큰 저장 테이블 및 RLS 정책
-- ============================================================

create table if not exists public.garmin_tokens (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles(id) on delete cascade,
  session_data       text not null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- RLS 활성화
alter table public.garmin_tokens enable row level security;

-- RLS 정책 설정
create policy "garmin_tokens: 본인만 조회"
  on public.garmin_tokens for select
  using (profile_id = auth.uid());

create policy "garmin_tokens: 본인만 생성/수정"
  on public.garmin_tokens for insert
  with check (profile_id = auth.uid());

create policy "garmin_tokens: 본인만 수정"
  on public.garmin_tokens for update
  using (profile_id = auth.uid());

create policy "garmin_tokens: 본인만 삭제"
  on public.garmin_tokens for delete
  using (profile_id = auth.uid());
