# RunBoard AI 추출 전략

## 목표
러닝 앱 스크린샷을 업로드하면, 앱별 화면 차이를 고려해 핵심 러닝 지표를 안정적으로 추출하고, 공통 스키마로 정규화한 뒤 목표 대비 피드백까지 연결한다.

---

## 지원 앱
초기 지원 대상:
- Nike
- Garmin
- Strava
- Samsung Health
- adidas Running

이들 앱은 화면 구조가 다르므로, 단일 범용 프롬프트보다 **앱별 추출 템플릿**을 사용하는 편이 안정적이다.

---

## 전체 파이프라인
1. 사용자가 앱 종류를 선택하거나 자동 분류
2. 스크린샷을 프론트엔드 메모리에서 Base64로 인코딩하여 API로 전송
3. 백엔드에서 Base64 문자열을 Vision/OCR로 전달해 화면 텍스트와 숫자 추출
4. 앱별 템플릿으로 필드 매핑
5. 공통 러닝 스키마로 정규화
6. 목표와 비교
7. AI 피드백 생성
8. DB 저장 + 화면 렌더링

---

## 비동기 처리 상태 머신

Vision/OCR + 피드백 생성은 시간이 걸리므로 **비동기 큐 처리** 방식을 권장한다.

### 상태 전이
```
uploaded → queued → parsing → parsed → verified → feedback_ready
                                              ↓
                                           failed
```

### 각 상태 설명
| 상태 | 설명 | 트리거 |
|------|------|--------|
| `uploaded` | 이미지가 Base64로 API 서버에 전송됨 | 클라이언트 업로드(전송) 완료 |
| `queued` | 추출 작업 대기 중 | 서버가 큐에 추가 (인메모리 전송) |
| `parsing` | Vision/OCR 처리 중 | 워커 픽업 |
| `parsed` | 추출 완료, 검증 전 | 추출 성공 |
| `verified` | 검증 통과 | 유효성 체크 통과 |
| `feedback_ready` | AI 피드백 생성 완료 | 피드백 API 완료 |
| `failed` | 처리 중 오류 | 어느 단계든 오류 발생 시 |

### 구현 권장
- 업로드 즉시 UI 반영 (`uploaded` 상태 표시)
- 분석은 Next.js Route Handler → 비동기 큐(Supabase Edge Function 또는 Vercel Background Function)
- 폴링 또는 Supabase Realtime으로 상태 변화를 클라이언트에 전달
- 실패 시 `error_message`를 `run_extractions`에 기록하고 재시도 버튼 제공

---

## 추출 방식
### 1) 앱 선택 기반 추출
가장 먼저 구현할 방식.

- 사용자가 업로드 전에 앱을 선택
- 선택된 앱에 맞는 프롬프트/템플릿 적용
- 추출 정확도 높음
- MVP에 가장 적합

### 2) 자동 분류 기반 추출
2차 고도화.

- Vision 모델이 화면 UI 특징으로 앱을 판별
- 로고, 색상, 레이아웃, 텍스트 패턴으로 분류
- 잘못 분류될 수 있으므로 보조 수단으로 사용

### 3) 하이브리드 방식
권장.

- 기본은 사용자가 앱 선택
- 모델이 자동 분류 결과도 함께 제시
- 둘이 다르면 사용자 확인

---

## 추출 우선순위
### 1차 MVP 필드
- distance_km
- duration_sec
- pace_sec_per_km
- calories
- activity_date

### 2차 확장 필드
- avg_heart_rate
- max_heart_rate
- cadence
- elevation_gain_m
- steps
- splits
- route_summary

### 3차 고급 필드
- training effect
- elevation profile
- power
- recovery time
- zone distribution

---

## 앱별 전략

### Nike
특징:
- 비교적 간단한 요약 화면이 많음
- 거리/시간/페이스 중심

전략:
- 요약 카드 우선 인식
- 운동 상세 화면은 2차 지원
- 핵심 지표 4개를 먼저 안정화

### Garmin
특징:
- 메트릭이 다양하고 화면 정보가 많음
- 심박, 케이던스, 고도 데이터가 풍부함

전략:
- 상단 요약과 메트릭 블록을 분리 처리
- 한 화면에서 여러 숫자가 섞여도 필드별 정규화
- 복잡한 화면은 템플릿을 더 세분화

### Strava
특징:
- 활동 요약과 상세가 분리됨
- 시각적으로 깔끔하지만 정보 위치가 화면마다 달라질 수 있음

전략:
- 활동 상세 화면과 피드형 화면을 구분
- 거리/시간/페이스/고도 우선
- 상세 메트릭은 존재할 때만 추출

### Samsung Health
특징:
- 한국 사용자에게 친숙
- 거리/시간/칼로리 정보가 비교적 명확함

전략:
- 텍스트 OCR과 숫자 추출 결합
- 한국어 라벨 대응
- 페이스/칼로리/거리 안정 추출 우선

### adidas Running
특징:
- 요약 중심 UI
- 거리/시간/페이스/칼로리 같은 핵심 정보가 중요

전략:
- 요약 카드 중심 템플릿
- 불필요한 UI 요소는 무시
- 간단하지만 신뢰도 높은 추출을 목표

---

## 공통 추출 포맷
Vision/OCR 결과는 먼저 아래 구조로 맞춘다.

```json
{
  "source_app": "strava",
  "activity_date": "2026-04-26",
  "distance_km": 5.23,
  "duration_sec": 1620,
  "pace_sec_per_km": 310,
  "calories": 412,
  "avg_heart_rate": 148,
  "max_heart_rate": 172,
  "cadence": 168,
  "elevation_gain_m": 42.5,
  "confidence": 0.91,
  "notes": "..."
}
```

---

## 템플릿 전략
앱별 프롬프트는 공통 구조를 유지하되, 앱에 따라 지시를 조금 바꾼다.

### 공통 지시
- 이미지에서 러닝 관련 숫자만 추출
- 단위는 표준화
- 불확실하면 null 허용
- JSON만 반환

### 앱별 추가 지시
- Nike: 거리, 시간, 페이스 우선
- Garmin: 메트릭이 많으니 항목별로 분리
- Strava: 활동 요약 중심
- Samsung Health: 한국어 라벨 대응
- adidas Running: 핵심 요약값 중심

---

## 추출 검증 규칙
추출 결과는 저장 전에 검증한다.

### 기본 검증
- distance_km > 0
- duration_sec > 0
- pace_sec_per_km는 거리와 시간으로 역산한 값과 크게 다르지 않아야 함
- calories는 음수일 수 없음
- activity_date는 미래 과도값이면 경고

### 일관성 검증
- 5km인데 duration이 2분이면 이상치
- pace와 distance/time가 심하게 불일치하면 재분석
- confidence가 낮으면 사용자 확인 요청

### 재분석 조건
- confidence < 0.70
- 필수 필드 2개 이상 누락
- 앱 분류와 화면 내용이 충돌

---

## AI 피드백 생성 전략
추출값과 목표를 비교해 세 가지 레이어로 응답한다.

### 1) 요약
- 오늘 러닝의 핵심 수치 요약

### 2) 목표 대비 평가
- 목표 달성/미달성 여부
- 어느 항목이 좋았는지
- 어느 항목이 부족한지

### 3) 다음 행동 제안
- 다음 러닝에서 바꿀 점
- 회복이 필요한지
- 페이스를 올릴지/유지할지

### 피드백 예시 톤
- 짧고 명확하게
- 코치처럼 말하되 부담스럽지 않게
- 숫자 기반으로 설명

---

## 프롬프트 출력 형식
모델 출력은 JSON이어야 한다.

예시:
```json
{
  "summary": "이번 러닝은 5.23km를 27분 00초에 완료했습니다.",
  "goal_status": "weekly_distance_goal 80% 달성",
  "strengths": ["거리 목표에 근접", "페이스가 안정적"],
  "improvements": ["주간 빈도를 1회 더 늘리면 좋음"],
  "next_action": "다음 러닝은 10~15초/km 정도만 빠르게 시도해보세요.",
  "confidence": 0.91
}
```

---

## 실패 처리
### 화면 인식 실패
- 앱 선택 재확인
- 이미지 확대 요청
- 다른 화면 캡처 유도

### 숫자 추출 실패
- 수동 수정 폼 제공
- 일부 필드만 저장
- 재분석 버튼 제공

### 모델 오류
- raw_text/raw_json 저장
- 에러 메시지 기록
- 재시도 가능하게 설계

---

## 추천 구현 순서
1. 앱 선택 기반 추출부터 시작
2. 거리/시간/페이스/칼로리만 먼저 지원
3. 실패율 분석 후 앱별 템플릿 조정
4. 심박/케이던스/고도 확장
5. 자동 분류 추가
6. 피드백 품질 개선

---

## 다음 단계
- `supabase`용 SQL 마이그레이션 작성
- Next.js 업로드 페이지 구현
- Vision API 또는 OpenAI/Anthropic 기반 추출 API 연결
- 목표 비교와 피드백 생성 로직 구현
