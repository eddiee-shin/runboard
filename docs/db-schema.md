# RunBoard DB Schema v0.1

## 목표
RunBoard는 러닝 앱 스크린샷 업로드 → AI 추출 → 목표 비교 → 피드백 생성 → 크루 리더보드/통계 확인 흐름을 지원한다.

이 문서는 Supabase Postgres 기준의 초기 스키마 초안이다.

---

## 설계 원칙
- `auth.users`를 유저의 원본 식별자로 사용하고, 앱 전용 프로필은 `profiles`에 저장한다.
- 러닝 원본 데이터와 AI 결과를 분리 저장한다.
- 앱별 스크린샷 원본 이미지는 스토리지 절약과 서버리스 제약 회피를 위해 저장하지 않고, 업로드 시 메모리상에서 Base64로 인코딩하여 즉시 AI 분석 후 폐기한다.
- 목표는 단일값이 아니라 `type + value + period` 구조로 저장한다.
- 리더보드는 집계 테이블 또는 뷰로 계산한다.

---

## 테이블 목록

### 1) `profiles`
앱 사용자 프로필.

필드:
- `id uuid primary key` — `auth.users.id` 참조
- `display_name text`
- `username text unique`
- `avatar_url text`
- `country text`
- `timezone text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

용도:
- 로그인 사용자 표시
- 리더보드 이름
- 개인 설정

---

### 2) `crews`
크루/팀 단위 그룹.

필드:
- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `slug text unique not null`
- `description text`
- `owner_id uuid references profiles(id)`
- `is_public boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

용도:
- 크루 단위 리더보드
- 그룹 통계

---

### 3) `crew_members`
크루 멤버 연결 테이블.

필드:
- `id uuid primary key default gen_random_uuid()`
- `crew_id uuid references crews(id) on delete cascade`
- `profile_id uuid references profiles(id) on delete cascade`
- `role text not null default 'member'`
- `joined_at timestamptz default now()`

제약:
- `unique (crew_id, profile_id)`

role 예시:
- `owner`
- `admin`
- `member`

---

### 4) `app_sources`
지원 러닝 앱 종류.

필드:
- `id smallint primary key`
- `code text unique not null`  -- `nike`, `garmin`, `strava`, `samsung_health`, `adidas_running`
- `name text not null`
- `is_active boolean default true`

용도:
- 업로드 화면의 앱 선택
- 앱별 추출 템플릿 매핑

---

### 5) `running_goals`
유저 목표 설정.

필드:
- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid references profiles(id) on delete cascade`
- `goal_type text not null`
- `goal_value numeric not null`
- `unit text not null`
- `period text not null`
- `start_date date`
- `end_date date`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

goal_type 허용값 (check constraint):
- `weekly_run_count`
- `weekly_distance_km`
- `monthly_distance_km`
- `target_pace_min_per_km`
- `avg_heart_rate_max`
- `weekly_long_run_count`

> ⚠️ `goal_type`은 자유 입력 금지. CHECK constraint 또는 enum 적용 필수.

period 허용값 (check constraint):
- `weekly`
- `monthly`
- `custom`

> ⚠️ `period`도 CHECK constraint 적용. 자유 문자열 금지.

---

### 6) `run_sessions`
러닝 활동의 정규화된 메인 테이블.

필드:
- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid references profiles(id) on delete cascade`
- `crew_id uuid references crews(id) on delete set null`
- `source_app_id smallint references app_sources(id)`
- `activity_date date not null`
- `activity_type text default 'run'`
- `distance_km numeric(10,2)`
- `duration_sec integer`
- `pace_sec_per_km integer`
- `calories integer`
- `avg_heart_rate integer`
- `max_heart_rate integer`
- `cadence integer`
- `elevation_gain_m numeric(10,2)`
- `steps integer`
- `notes text`
- `status text not null default 'parsed'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

status 허용값 (check constraint):
- `uploaded`
- `queued`
- `parsing`
- `parsed`
- `verified`
- `feedback_ready`
- `failed`

> ⚠️ status는 상태 머신 기반으로 전이해야 하며, CHECK constraint로 허용값 제한 필수.

---

### 8) `run_extractions`
AI/Vision/OCR 추출 결과.

필드:
- `id uuid primary key default gen_random_uuid()`
- `run_session_id uuid references run_sessions(id) on delete cascade`
- `model_name text`
- `provider text`
- `raw_text text`
- `raw_json jsonb`
- `confidence numeric(4,3)`
- `status text not null default 'success'`
- `error_message text`
- `created_at timestamptz default now()`

용도:
- 추출 결과 디버깅
- 모델 비교
- 실패 원인 추적

---

### 9) `ai_feedbacks`
목표 대비 AI 코칭 결과.

필드:
- `id uuid primary key default gen_random_uuid()`
- `run_session_id uuid references run_sessions(id) on delete cascade`
- `profile_id uuid references profiles(id) on delete cascade`
- `goal_summary jsonb`
- `feedback_text text not null`
- `feedback_json jsonb`
- `tone text default 'coach' check (tone in ('coach', 'casual', 'strict'))`
- `created_at timestamptz default now()`

> ⚠️ `tone`은 허용값을 CHECK constraint로 열거. 자유 입력 금지.

용도:
- 화면에 보여줄 코칭 문장
- 구조화된 피드백
- 추후 재생성

---

### 10) `leaderboard_snapshots`
리더보드용 집계 스냅샷.

필드:
- `id uuid primary key default gen_random_uuid()`
- `crew_id uuid references crews(id) on delete cascade`
- `period text not null`
- `period_start date not null`
- `period_end date not null`
- `metric text not null`
- `rank_data jsonb not null`
- `created_at timestamptz default now()`

용도:
- 주간/월간 리더보드 빠른 조회
- 통계 캐싱

metric 예시:
- `distance_km`
- `run_count`
- `pace`
- `calories`

---

### 11) `activity_aggregates`
유저별 집계 테이블 또는 materialized view 후보.

필드 예시:
- `profile_id uuid`
- `crew_id uuid`
- `period text`
- `period_start date`
- `period_end date`
- `run_count integer`
- `distance_km numeric(10,2)`
- `moving_time_sec integer`
- `avg_pace_sec_per_km integer`
- `calories integer`
- `updated_at timestamptz`

용도:
- 대시보드
- 통계 차트
- 리더보드

---

## 추천 관계도
- `profiles 1:N running_goals`
- `profiles 1:N run_sessions`
- `profiles 1:N ai_feedbacks`
- `crews 1:N crew_members`
- `crews 1:N run_sessions`
- `crews 1:N leaderboard_snapshots`
- `run_sessions 1:N run_extractions`
- `run_sessions 1:N ai_feedbacks`

---

## RLS 정책 (구체화)

### profiles
- `SELECT`: `auth.uid() = id`
- `UPDATE`: `auth.uid() = id`
- `INSERT`: 트리거로만 생성 (직접 INSERT 금지)

### crews
- `SELECT`: `is_public = true` 이면 누구든 가능, 비공개는 멤버만
- `INSERT`: 인증된 사용자만
- `UPDATE/DELETE`: `owner_id = auth.uid()` 또는 role이 admin인 멤버

### crew_members
- `SELECT`: `profile_id = auth.uid()` 또는 같은 크루 멤버
- `INSERT`: 크루 owner/admin만
- `DELETE`: 본인 탈퇴 또는 크루 owner/admin

### running_goals
- `ALL`: `profile_id = auth.uid()`

### run_sessions
- `SELECT`: `profile_id = auth.uid()` (크루 공유 활성화 시 같은 크루 멤버도)
- `INSERT/UPDATE/DELETE`: `profile_id = auth.uid()`

### run_extractions
- `SELECT`: `run_session_id`의 owner만
- `INSERT`: service_role만 (서버 함수 전용)

### ai_feedbacks
- `SELECT`: `profile_id = auth.uid()`
- `INSERT`: service_role만 (서버 함수 전용)

---

## 추천 인덱스
- `run_sessions(profile_id, activity_date desc)`
- `run_sessions(crew_id, activity_date desc)`
- `run_sessions(source_app_id)`
- `running_goals(profile_id, is_active)`
- `crew_members(crew_id, profile_id)` unique index
- `leaderboard_snapshots(crew_id, period, period_start desc)`

---

## MVP용 최소 필드만 먼저 만들 경우
가장 먼저 필요한 컬럼만 압축하면:
- `profiles`
- `crews`
- `crew_members`
- `app_sources`
- `running_goals`
- `run_sessions`
- `run_extractions`
- `ai_feedbacks`

`leaderboard_snapshots`와 `activity_aggregates`는 2차로 가도 된다.

---

## 다음 단계 제안
1. 이 문서를 기준으로 Supabase SQL 파일 생성
2. Next.js 프로젝트 구조 생성
3. Google 로그인 연결
4. 업로드 API와 추출 API 연결
