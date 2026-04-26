# RunBoard 이미지 업로드 + AI 피드백 전략 설계

## 목표
RunBoard를 사용해 러닝 앱 스크린샷을 업로드하면, 앱별로 핵심 러닝 지표를 추출하고, 유저별 목표와 비교해 AI 피드백을 제공하는 웹앱을 만든다.

## 초기 범위
지원 소스:
- Nike
- Garmin
- Strava
- Samsung Health
- adidas Running

핵심 기능:
- Google 로그인
- 이미지 업로드
- 러닝 기록 추출
- 목표 대비 AI 피드백
- 크루 리더보드
- 통계 대시보드

## 핵심 설계 원칙
1. 앱별 화면 차이를 인정하고, 한 번에 완전 자동화를 노리지 않는다.
2. 우선은 공통 지표만 안정적으로 추출한다.
3. 추출 정확도는 앱별 템플릿 + Vision/OCR 혼합으로 높인다.
4. 결과 데이터는 공통 스키마로 정규화한다.
5. AI 피드백은 “설명”보다 “실행 가능한 코칭” 중심으로 제공한다.

## 공통 추출 필드
최소 MVP에서 정규화할 항목:
- activity_date
- distance_km
- duration_min
- pace_min_per_km
- calories
- avg_heart_rate
- max_heart_rate
- cadence
- elevation_gain
- activity_type
- source_app
- screenshot_url

## 제안 아키텍처
### Frontend
- Next.js 15
- App Router
- Tailwind CSS
- 차트 라이브러리(예: Recharts)

### Auth
- Google OAuth via Supabase Auth

### Storage / DB
- Supabase Storage: 스크린샷 저장
- Supabase Postgres: 유저, 목표, 기록, 피드백, 크루 데이터 저장

### AI Pipeline
1. 사용자가 스크린샷 업로드
2. 앱 종류 선택 또는 자동 분류
3. Vision/OCR로 숫자 추출
4. 공통 스키마로 정규화
5. 목표와 비교
6. AI 코멘트 생성
7. 결과 저장 및 UI 반영

## 앱별 추출 전략
### 1) Nike
- 주로 거리/시간/페이스 중심 화면이 많을 가능성
- 요약 카드에서 핵심 수치 추출 우선
- 추후 상세 화면 지원

### 2) Garmin
- 매우 다양한 메트릭 제공 가능
- 기본 요약 + 심박/케이던스/고도 지원
- 화면 레이아웃이 복잡할 수 있어 템플릿 분리가 중요

### 3) Strava
- 요약형 화면과 활동 상세 화면을 분리해서 처리
- 거리/시간/페이스/고도 추출 우선

### 4) Samsung Health
- 한국 사용자 친화적인 레이아웃
- 거리/시간/칼로리/페이스를 안정적으로 우선 추출

### 5) adidas Running
- 요약 카드 중심으로 추출
- 거리/시간/페이스/칼로리 우선

## AI 피드백 전략
피드백은 3단계로 구성한다.

### 1) 사실 요약
- 이번 러닝 요약
- 목표 대비 달성 여부

### 2) 비교 분석
- 이번 기록이 목표보다 빠른지/느린지
- 주간 누적이 목표보다 부족한지/초과인지

### 3) 행동 제안
- 다음 러닝에서 무엇을 조정할지
- 예: 거리 유지, 페이스 조절, 빈도 증가, 회복 러닝 권장

## 목표 시스템
유저는 아래 중 일부 또는 전체를 설정할 수 있다.
- 주간 횟수 목표
- 주간 거리 목표
- 월간 거리 목표
- 5K/10K 페이스 목표
- 평균 심박 목표
- 회복/지속주 비율 목표

목표는 단일 숫자보다 “유형 + 값 + 주기” 구조로 저장한다.

## Supabase 데이터 모델 초안
- users
- crews
- crew_members
- running_goals
- run_sessions
- run_images
- ai_feedbacks
- leaderboard_snapshots
- app_sources

## MVP 화면 구성
- 로그인 화면
- 대시보드
- 업로드 화면
- 기록 상세 화면
- 목표 설정 화면
- 리더보드 화면
- 통계 화면

## 단계별 실행 계획
### Phase 1: 프로젝트 초기화
- Next.js 프로젝트 생성
- Supabase/Auth 기본 연결
- 환경변수 구성

### Phase 2: DB 및 Storage
- 테이블 생성
- 스토리지 버킷 생성
- RLS 정책 설계

### Phase 3: 업로드 + 추출
- 이미지 업로드 UI
- 앱 선택 UI
- Vision/OCR 추출 API
- 추출 결과 검증 UI

### Phase 4: 목표 + 피드백
- 목표 등록 UI
- 기록과 목표 비교 로직
- AI 피드백 생성

### Phase 5: 리더보드 + 통계
- 크루 기준 집계
- 주간/월간 통계 차트
- 유저별 진행률 표시

### Phase 6: 배포
- Vercel 배포
- Supabase 환경변수 연결
- 운영 점검

## 검증 기준
- 스크린샷 업로드가 정상 동작하는가
- 각 앱 소스에서 핵심 지표를 추출할 수 있는가
- 목표와 기록 비교가 일관적인가
- 리더보드 수치가 실제 기록과 맞는가
- 배포 후 Google 로그인과 DB 저장이 문제 없는가

## 리스크 / 주의점
- 앱마다 UI가 달라서 추출 실패 가능성 있음
- 스크린샷 품질이 낮으면 OCR 정확도 하락
- 최초에는 자동 분류보다 수동 앱 선택이 안정적
- 심박/케이던스 같은 필드는 앱별로 누락될 수 있음

## 권장 MVP 우선순위
1. 로그인
2. 업로드
3. 거리/시간/페이스 추출
4. 목표 비교 피드백
5. 리더보드
6. 고급 통계
7. 추가 메트릭 확장
