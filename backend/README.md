# Backend (WebSocket 프로토타입)

ai_engine 판별기를 사용해 응시 키스트로크의 **인간 유사도 점수(0~100)** 를 실시간으로
산출하는 참조/프로토타입 서비스다.

## 라이브 MVP와의 관계

이 서비스는 **라이브 요청 흐름에 포함되지 않는다.** 운영 경로는
`apps/platform-api`(수집·오케스트레이션) + `services/detection-service`(설명 가능한
규칙 기반 위험 평가)가 담당한다. 본 프로토타입은 "실시간 ML 점수"라는 다른 접근을
탐색하기 위한 것으로, 향후 발전을 위해 유지된다.

| 구분 | 이 프로토타입 | 라이브 detection-service |
| --- | --- | --- |
| 전송 | WebSocket(`/ws`) | HTTP(`/assess`) |
| 방식 | ai_engine GAN 판별기 점수 | 설명 가능한 규칙 + 근거 |
| 상태 | 세션별 인메모리 점수 | 무상태 배치 평가 |

## 구조

```
backend/app/
  main.py             # FastAPI 앱 팩토리 + /ws 엔드포인트
  session_manager.py  # 세션별 상태와 점수 계산 로직
  detector_adapter.py # ai_engine 판별기 연동(지연 로딩) 캡슐화
  config.py           # 환경변수 기반 설정(패널티/점수 등)
  schemas.py          # WebSocket 메시지 스키마(snake_case)
```

## 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 설정 (환경변수)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `BACKEND_MODEL_DIR` | `../ai_engine/models` | 판별기 가중치 경로 |
| `BACKEND_INITIAL_HUMAN_SCORE` | `100.0` | 세션 시작 점수 |
| `BACKEND_MIN_HUMAN_SCORE` | `0.0` | 점수 하한 |
| `BACKEND_PASTE_PENALTY` | `15.0` | 붙여넣기당 차감 |
| `BACKEND_CORS_ALLOWED_ORIGINS` | `*` | 허용 출처(쉼표 구분) |

## 테스트

```bash
cd backend && PYTHONPATH=. python -m pytest -q
```

가짜 점수기를 주입하므로 torch/ai_engine 없이도 WebSocket 흐름을 검증한다.

## 향후 발전(로드맵) 아이디어

- 키스트로크 타이밍 전처리를 실제 timestamp 기반으로 정밀화
  (현재 ai_engine `detector.py`는 PoC 수준의 고정값 사용)
- 세션 종료 시 점수/근거를 platform-api로 전달해 검토 흐름과 통합
- 점수 단일 값이 아니라 detection-service처럼 신호별 근거 제공
