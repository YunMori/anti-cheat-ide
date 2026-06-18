# 에이전트 운영 모델(Agent Operating Model)

## 소유권(Ownership)

| 에이전트 | 쓰기 범위 | 기본 포트 |
| --- | --- | --- |
| Orchestrator | `docs/`, 루트 통합 파일 | 없음 |
| Platform API | `apps/platform-api/` | 8001 |
| Judge Service | `services/judge-service/` | 8002 |
| Detection Service | `services/detection-service/` | 8003 |
| Candidate Web | `frontend/` | 3000 |
| Admin Web | `apps/admin-web/` | 3001 |
| QA / Integration | `tests/`, 루트 검증 파일 | 없음 |

에이전트는 Orchestrator가 승인한 계약 변경 없이 자신의 쓰기 범위 밖을 편집해서는
안 된다. 기존 사용자의 변경 사항을 되돌려서는 안 된다.

## 전달 단계(Delivery phases)

1. Orchestrator가 계약과 서비스 경계를 정의한다.
2. Platform API, Judge Service, Detection Service를 병렬로 구현한다.
3. Candidate Web과 Admin Web을 안정된 계약에 맞춰 통합한다.
4. QA가 전체 워크플로를 검증하고 릴리스 차단 요소(blocker)를 보고한다.

## 티켓 템플릿(Ticket template)

```text
Role:
Write scope:
Read-only dependencies:
Goal:
Required behavior:
Completion criteria:
```

## 완료 보고(Completion report)

모든 에이전트는 다음을 보고한다:

```text
Implemented:
Changed files:
Verification:
Contract changes:
Known limitations:
```

## 검토 규칙(Review rules)

- 위험 점수는 결코 자동 부정행위 판정이 아니다.
- 신뢰할 수 없는 소스 코드는 Platform API가 직접 실행하지 않는다.
- Judge Service는 기본적으로 샌드박스화된 러너를 사용한다.
- 행동 이벤트 스키마는 버전 관리된다.
- 테스트는 내부 헬퍼만이 아니라 계약 수준(contract-level)의 동작을 검증해야 한다.
