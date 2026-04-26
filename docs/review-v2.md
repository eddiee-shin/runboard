# RunBoard 문서 리뷰 반영본 v2

## 반영 목표
이 문서는 기존 설계 문서에 대해 리뷰에서 나온 핵심 보완점을 정리한 실행용 보완본이다.

---

## 1) 반드시 추가할 것

### A. Supabase 마이그레이션 SQL
문서 수준 스키마만으로는 실제 개발을 시작하기 어렵다.

추가 필요:
- `supabase/migrations/001_init.sql`
- `profiles` 생성 트리거
- 기본 인덱스
- RLS 정책

### B. 상태값 제약
문자열 자유 입력은 나중에 데이터가 쉽게 오염된다.

추가 필요:
- `status` 허용값 제한
- `period` 허용값 제한
- `goal_type` 허용값 제한
- `tone` 허용값 제한

### C. 업로드/분석 상태 머신
즉시 처리인지 비동기 처리인지가 불명확하다.

권장 상태:
- `uploaded`
- `queued`
- `parsing`
- `parsed`
- `verified`
- `feedback_ready`
- `failed`

---

## 2) 아키텍처 보완

### A. Storage 정책
다음 항목을 명확히 해야 한다.
- 버킷 이름
- public/private 여부
- 업로드 권한
- 조회 권한

### B. AI 추출 버전 관리
앱별 템플릿은 버전으로 관리하는 것이 좋다.

예:
- `source_app`
- `template_version`
- `model_name`
- `confidence_threshold`

### C. 백그라운드 처리
Vision/OCR + 피드백 생성은 시간이 걸릴 수 있다.

권장 방식:
- 업로드 즉시 UI 반영
- 분석은 비동기 큐/잡으로 처리
- 완료 후 상태 갱신

---

## 3) MVP 정책 보완

### A. 목표 타입은 제한형으로 시작
초기에는 사용자 자유 입력보다 미리 정의된 목표 템플릿이 안정적이다.

### B. 리더보드 지표는 1~2개부터
초기에는 아래 중 일부만 우선:
- 거리
- 횟수
- 칼로리

페이스는 보조 지표로 두는 편이 좋다.

### C. 크루 정책
아래 결정이 필요하다.
- 크루 기본 공개/비공개
- 유저가 여러 크루에 속할 수 있는지
- 초대 기반인지 자유 가입인지

---

## 4) 구현 순서 권장
1. SQL migration 작성
2. RLS 정책 작성
3. Google OAuth 연결
4. 업로드 + Storage
5. 앱 선택 + Vision 추출
6. 목표 비교
7. AI 피드백
8. 리더보드/통계

---

## 5) 문서 반영 체크리스트
- [x] `docs/db-schema.md`에 enum/체크 제약 추가
- [x] `docs/db-schema.md`에 RLS 정책 구체화
- [x] `docs/ai-extraction-strategy.md`에 비동기 상태 머신 추가
- [x] `docs/product-spec.md`에 리더보드 기준 우선순위 명시
- [x] `supabase/migrations/001_init.sql` 생성
