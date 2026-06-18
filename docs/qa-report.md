# 최종 QA / 통합 보고서

날짜: 2026-06-15

릴리스 권고: **NO-GO(출시 불가)**

독립적으로 실행 가능한 모든 서비스 테스트, 통합 회귀 테스트, 프론트엔드 린트 검사,
타입 검사, webpack 프로덕션 빌드가 통과한다. 이전에 보고된 무결성 및 가용성 결함 3건이
수정되었다. 그러나 완전한 응시자→채점 워크플로가 없고, 접근 제어가 없으며, 영속 상태가
없고, 몇 가지 부정행위 방지 및 Judge 무결성 공백이 남아 있어 릴리스는 여전히 차단된다.

## 해결된 이전 차단 요소

### Detection 장애가 더 이상 이벤트 수집을 HTTP 500으로 만들지 않음

- Platform이 `httpx.HTTPError`를 import하고 처리한다.
- `test_event_ingest_remains_available_when_detection_is_down` 테스트가 Detection
  Service가 사용 불가일 때도 여전히 HTTP `202`를 반환하고 이벤트 sequence를 진행시키는지
  검증한다.

잔여 위험: 실패한 평가는 조용히 건너뛴다. Detection Service로의 영속 큐, 재시도, 추후
재생(replay)이 없다.

### 정상(benign) 배치가 더 이상 이전의 높은 위험 점수를 지우지 않음

- `InMemoryPlatformRepository.save_risk_assessment`가 관측된 세션 최고 위험 점수를 보존한다.
- `test_session_risk_does_not_lose_prior_high_risk_evidence` 테스트가 의심 점수 `60`과
  그 붙여넣기 근거가 이후의 정상 배치에서도 살아남는지 검증한다.

잔여 위험: 이는 최고 점수 보존일 뿐 세션 수준 신호 집계가 아니다. 점수가 더 낮거나 같은
이후 배치의 다른 근거는 여전히 폐기될 수 있다.

### 다중 탭 HTTP 409가 더 이상 패배한 탭의 이벤트를 삭제하지 않음

- Candidate Web은 성공 응답 이후에만 `acceptBatch`를 호출한다.
- `409`는 눈에 보이는 sequence 충돌 오류를 발생시키며 로컬 이벤트 큐를 그대로 유지한다.
- `test_sequence_conflict_keeps_unacknowledged_events_queued` 테스트가 이 경계를 회귀
  테스트로 고정한다.

잔여 위험: 활성 클라이언트 리스(lease)나 조정(reconciliation) 프로토콜이 없어, 서버
sequence가 진행된 후에는 보존된 패배 탭의 큐를 업로드할 수 없다.

## 남은 릴리스 차단 요소

### Critical: 응시자 제출물이 전혀 채점되지 않음

근거:

- Candidate Web은 1회용 초대 링크에서 시작하여 교환 후 시험 데이터를 로드하지만,
  여전히 실행(run)이나 제출(submit) 워크플로가 없다.
- Platform은 제출물을 `queued` 상태로 저장하지만 Judge Service로 디스패치하거나 Judge
  결과를 노출하지 않는다.

릴리스 전 필요 사항:

- 응시자 실행/제출 워크플로를 구현한다.
- 영속 작업 큐를 통해 제출물을 Judge Service로 디스패치한다.
- 결정적 Judge 결과를 영속화하고 노출한다.

### High: 인가가 여전히 불완전함

근거:

- Platform에 admin/reviewer 인증과 역할 검사가 있지만, 조직 격리(isolation)가 없다.
- 검토자 행위와 결정에 대한 감사 로그가 없다.

릴리스 전 필요 사항:

- 응시자 및 검토자 인증, 역할 기반 인가, 테넌트 격리, 감사 로깅을 추가한다.

### High: Platform 상태가 프로세스 로컬이라 재시작 시 손실되거나 분리됨

근거:

- Platform이 기본적으로 `InMemoryPlatformRepository`를 사용한다.
- 시험, 세션, 이벤트 배치, sequence, 제출물, 위험 점수가 프로세스 메모리에 보관된다.

릴리스 전 필요 사항:

- 영속 PostgreSQL 기반 저장소와 원자적(atomic) sequence 처리를 추가한다.

### High: Detection 실패 시 위험 평가가 영구적으로 건너뛰어짐

근거:

- 이벤트 수집은 Detection Service가 다운되어도 올바르게 유지되지만, 오류를 잡은 뒤
  재시도나 재생을 수행하지 않는다.
- 장애 중에 수락된 의심 이벤트 배치가 평가되지 않은 채로 남을 수 있다.

릴리스 전 필요 사항:

- Detection 작업을 영속적으로 큐에 넣고, 관측 가능성(observability)을 갖춰 재시도하며,
  재생을 지원한다.

### High: Detection 및 위험 근거가 세션 수준이 아님

근거:

- Detection은 이전 세션 상태 없이 한 번에 하나의 이벤트 배치만 평가한다.
- 배치를 가로지르는 타이핑 타이밍과 포커스 이탈 행동이 측정되지 않는다.
- Platform은 불변 신호 근거를 집계하지 않고 가장 높은 전체 평가만 보존한다.

릴리스 전 필요 사항:

- 세션 수준 Detection 상태를 유지하거나 불변 배치 평가를 누적(append)하고, 근거를 보존하는
  집계 정책을 정의한다.

### High: Judge stdout 및 stderr가 호스트 프로세스에서 무제한임

근거:

- `DockerSandboxRunner`가 `subprocess.run(..., capture_output=True)`를 사용한다.
- 컨테이너 메모리 제한은 Judge Service가 할당하는 버퍼를 제한하지 않는다.

릴리스 전 필요 사항:

- 출력을 스트리밍하고 상한을 두며, 제한 도달 시 종료하고, 회귀 테스트를 추가한다.

### High: 다중 탭 충돌이 이벤트를 보존하지만 조정할 수 없음

근거:

- 패배한 탭은 HTTP `409` 이후 큐를 유지하여 조용한 삭제를 해결했다.
- 그러나 수락된 이벤트 ID 확인(acknowledgement), 활성 클라이언트 리스, sequence 조정
  경로가 없어 재시도가 계속 충돌한다.

릴리스 전 필요 사항:

- 세션당 하나의 활성 응시자 클라이언트를 강제하거나, 멱등(idempotent) 배치/이벤트
  확인과 조정을 구현한다.

## 추가 공백(Additional Gaps)

### High: 브라우저 이벤트 무결성이 강제되지 않음

행동 이벤트는 브라우저 코드에 의해 생성되므로 비활성화하거나 위조할 수 있다. 수집 시점에
인증된 클라이언트 리스, 하트비트 정책, 서버 측 무결성 제어가 없다.

### Judge 런타임 격리 검증

Docker CLI, Compose, Buildx, Colima가 설치되었고 전체 Compose 스택이 성공적으로
시작되었다. 실제 Judge 요청으로 다음을 검증했다:

- 수락된 Python 및 JavaScript 제출물
- 구성된 타임아웃에서 무한 루프 종료
- 외부 네트워크 접근 차단(`Network unreachable`)
- 읽기 전용 루트 파일시스템 강제
- 종료 코드 `137`을 동반한 메모리 제한 강제
- 타임아웃 후 임시 `judge-*` 컨테이너 정리
- Colima Docker 런타임 재시작 후 서비스 복구
- localhost 전용 포트 게시 및 Compose 헬스체크

검증 중, Judge 이미지가 Debian Trixie에서 Docker CLI 없이 `docker.io`를 설치하는 문제가
발견되었다. 이제 Dockerfile은 `docker-cli`를 설치하며, 회귀 테스트가 이 요구 사항을 보호한다.

### Medium: 프라이버시 및 출시 게이트가 여전히 미완성임

- 원시 이벤트 보존 기간과 삭제 절차가 정의되지 않았다.
- 검토자 이의제기 워크플로가 구현되지 않았다.
- 백업/복구 및 100개 동시 세션 부하 테스트가 수행되지 않았다.
- 응시자 및 Admin UI 스모크 테스트는 통과했지만, 전체 브라우저 E2E는 미완성된
  응시자→채점 흐름 때문에 여전히 차단되어 있다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| Platform API pytest | `12 passed` |
| Detection Service pytest | `11 passed` |
| Judge Service pytest | `7 passed` |
| 통합 및 보안 회귀 테스트 | `9 passed, 3 skipped without runtime URL` |
| 실제 Docker Judge 런타임 테스트 | `3 passed` |
| Candidate Web ESLint | 통과 |
| Candidate Web TypeScript | 통과 |
| Candidate Web webpack 프로덕션 빌드 | 통과 |
| Candidate Web 기본 Turbopack 빌드 | 제한된 샌드박스 밖에서 통과 |
| Candidate Web 브라우저 스모크 테스트 | 통과; Monaco 렌더링되고 hydration/런타임 콘솔 오류 없음 |
| Admin Web ESLint | 통과 |
| Admin Web TypeScript | 통과 |
| Admin Web webpack 프로덕션 빌드 | 통과 |
| Admin Web 기본 Turbopack 빌드 | 통과 |
| Docker Compose / 실제 Docker Judge 실행 | Colima로 통과 |

## QA 소유 회귀 테스트

- `tests/integration/test_platform_detection_flow.py`
  - 실제 인프로세스 Detection 통합 및 검토자가 읽을 수 있는 위험을 검증한다.
  - 이전의 높은 위험 근거가 정상 배치 이후에도 살아남는지 검증한다.
  - Detection 장애가 이벤트 수집을 사용 불가로 만들지 않는지 검증한다.
- `tests/integration/test_candidate_event_queue_boundary.py`
  - HTTP `409`가 수락되지 않은 이벤트를 확인 처리하고 삭제할 수 없음을 검증한다.
- `tests/integration/test_judge_security_boundary.py`
  - 기본 Docker 러너와 선언된 격리 경계를 검증한다.
  - Docker 러너 밖의 호스트 실행 API 및 `shell=True`를 거부한다.
- `tests/integration/test_judge_docker_runtime.py`
  - `JUDGE_RUNTIME_URL`이 설정되면 실제 Docker Judge Service에 대해 수락, 타임아웃,
    네트워크 차단, 읽기 전용 파일시스템 검사를 실행한다.

실행:

```bash
.venv/bin/python -m pytest -q tests/integration
```

현재 예상 결과:

```text
9 passed, 3 skipped
```
