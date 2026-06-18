# 목표 아키텍처

## 서비스 경계

| 구성요소 | 책임 | 소유 데이터 |
| --- | --- | --- |
| Candidate Web | 코딩 환경 제공 및 행동 이벤트 수집 | 브라우저 상태만 |
| Platform API | 시험, 세션, 제출, 인가 처리 | 제품 데이터 |
| Judge Service | 격리 실행 및 결정적 채점 | 채점 작업과 결과 |
| Detection Service | 설명 가능한 위험 신호 평가 | 위험 평가 결과 |
| Admin Web | 시험 관리 및 검토자 워크플로 | 브라우저 상태만 |
| Red Team Simulator | 탐지 회귀 및 회피 테스트 | 합성 테스트 데이터 |

## 타협 불가 규칙

1. 신뢰할 수 없는 제출물은 오직 Judge Service 샌드박스 경계를 통해서만 실행한다.
2. Detection은 부정행위 판정이 아니라 근거가 뒷받침된 위험 신호를 반환한다.
3. 원시(raw) 행동 이벤트는 버전 관리되며 수집 이후에는 변경 불가(immutable)다.
4. 서비스 구현은 서로의 내부 구현이 아니라 계약(contract)에 의존한다.
5. 개인적으로 민감한 이벤트 데이터에는 명시적인 보존 기간이 있다.

## 현재 마이그레이션 매핑

- `frontend/`는 첫 번째 반복(iteration) 동안 Candidate Web으로 유지된다.
- `backend/`는 프로토타입이자 참조 구현으로 유지된다.
- `ai_engine/`은 ML 연구 및 Red Team 작업 공간으로 유지된다.
- 새로운 운영(production) 지향 서비스는 `apps/`와 `services/` 아래에 도입된다.

## MVP 이벤트→검토 흐름

1. Candidate Web이 순서가 보장된 이벤트 배치를 Platform API로 전송한다.
2. Platform API는 다운스트림 분석 이전에 배치를 먼저 영속화한다.
3. `DETECTION_SERVICE_URL`이 설정되어 있으면, Platform API가 Detection Service에
   설명 가능한 평가를 요청한다.
4. 가장 최근의 위험 평가가 Admin Web 검토용으로 저장된다.
5. Detection 실패가 이벤트 수집을 막지 않으며, 응시자를 자동으로 탈락시키지 않는다.

## 응시자 식별

- `candidate_id`는 조직 내에서 한 사람을 식별한다.
- `session_id`는 한 응시자의 한 시험에 대한 한 번의 응시 시도를 식별한다.
- 브라우저 이벤트, 제출물, 채점 결과, 위험 평가는 `session_id`에 연결되며,
  검토자 화면은 이를 다시 `candidate_id`로 조인한다.
- Admin Web은 특정 시험과 응시자에 대한 1회용 응시자 초대 링크를 생성한다.
  Candidate Web은 초대 토큰을 교환(redeem)하여 문제를 로드하거나 이벤트를
  보내기 전에 세션을 생성한다.
- 현재 MVP는 초대 교환 이후 응시자 로그인이나 SSO를 아직 제공하지 않는다.
  운영 환경에서는 장시간 진행되는 시험을 위해 응시자 재진입 토큰이나 ID 공급자
  바인딩을 추가해야 한다.
