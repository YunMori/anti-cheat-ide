# 플랫폼 데이터 모델(Platform Data Model)

첫 구현은 테스트를 위해 인메모리 저장소를 사용할 수 있지만, 그 인터페이스는 아래의
최종 PostgreSQL 엔티티에 대응되어야 한다.

| 엔티티 | 주요 필드 |
| --- | --- |
| admin_users | id, email, display_name, password_hash, role, status, created_at, approved_at |
| organizations | id, name, created_at |
| assessments | id, organization_id, title, starts_at, ends_at |
| problems | id, assessment_id, title, statement, allowed_languages, starter_code, time_limit_ms, memory_limit_mb |
| test_cases | id, problem_id, stdin, expected_stdout, hidden |
| candidate_invites | id, assessment_id, candidate_id, token, expires_at, created_at, created_by_user_id, used_at, session_id |
| sessions | id, assessment_id, candidate_id, status, started_at, finished_at |
| submissions | id, session_id, problem_id, language, source_code, created_at |
| judge_results | id, submission_id, status, score, details |
| session_event_batches | id, session_id, sequence_start, payload, received_at |
| risk_assessments | id, session_id, score, review_recommended, signals, model_version |

## 제약 조건(Constraints)

- 이벤트 배치의 `(session_id, sequence_start)`는 유일(unique)하다.
- `admin_users.email`은 유일하다.
- `candidate_invites.token`은 유일하며 1회용이다.
- 제출물과 이벤트 배치는 추가 전용(append-only)이다.
- 모든 위험 신호는 검토자가 읽을 수 있는 근거를 포함한다.
- Detection 점수는 결코 세션을 직접 탈락(rejected) 상태로 설정하지 않는다.
