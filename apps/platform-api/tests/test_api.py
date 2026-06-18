from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from platform_api.main import create_app
from platform_api.models import (
    EventBatchCreate,
    JudgeResult,
    JudgeTestCaseResult,
    RiskAssessment,
    RiskSignal,
    utc_now,
)
from platform_api.repositories import InMemoryPlatformRepository


@pytest.fixture
def repository() -> InMemoryPlatformRepository:
    return InMemoryPlatformRepository()


@pytest.fixture
def client(repository: InMemoryPlatformRepository) -> TestClient:
    return TestClient(create_app(repository))


@pytest.fixture
def assessment(client: TestClient) -> dict:
    starts_at = datetime.now(timezone.utc)
    response = client.post(
        "/assessments",
        json={
            "organization_id": "org_1",
            "title": "Backend assessment",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def session(client: TestClient, assessment: dict) -> dict:
    response = client.post(
        "/sessions",
        json={
            "assessment_id": assessment["id"],
            "candidate_id": "user_1",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def problem(client: TestClient, assessment: dict) -> dict:
    response = client.post(
        "/problems",
        json={
            "assessment_id": assessment["id"],
            "title": "A + B",
            "statement": "두 정수의 합을 출력하세요.",
            "allowed_languages": ["python", "cpp", "java"],
            "starter_code": {"python": "a, b = map(int, input().split())"},
            "time_limit_ms": 1000,
            "memory_limit_mb": 128,
            "test_cases": [
                {
                    "stdin": "1 2\n",
                    "expected_stdout": "3\n",
                    "hidden": False,
                },
                {
                    "stdin": "40 2\n",
                    "expected_stdout": "42\n",
                    "hidden": True,
                },
            ],
        },
    )
    assert response.status_code == 201
    return response.json()


def event_batch(session_id: str, sequence_start: int = 0) -> dict:
    return {
        "schema_version": "1.0",
        "session_id": session_id,
        "sequence_start": sequence_start,
        "sent_at": 1781510400000,
        "events": [
            {
                "id": f"evt_{sequence_start}",
                "type": "keydown",
                "timestamp": 1781510400000,
                "editor_revision": 1,
                "key": "a",
                "code": "KeyA",
                "cursor_offset": 0,
            }
        ],
    }


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "platform-api"}


def test_create_assessment_validates_schedule(client: TestClient) -> None:
    now = datetime.now(timezone.utc).isoformat()

    response = client.post(
        "/assessments",
        json={
            "organization_id": "org_1",
            "title": "Invalid",
            "starts_at": now,
            "ends_at": now,
        },
    )

    assert response.status_code == 422


def test_create_session_requires_existing_assessment(client: TestClient) -> None:
    response = client.post(
        "/sessions",
        json={"assessment_id": "asm_missing", "candidate_id": "user_1"},
    )

    assert response.status_code == 404


def test_problem_is_created_and_hidden_cases_are_not_sent_to_candidate(
    client: TestClient, session: dict, problem: dict
) -> None:
    admin_response = client.get(
        "/problems", params={"assessment_id": problem["assessment_id"]}
    )
    list_response = client.get(f"/sessions/{session['id']}/problems")
    detail_response = client.get(
        f"/sessions/{session['id']}/problems/{problem['id']}"
    )

    assert admin_response.status_code == 200
    assert len(admin_response.json()[0]["test_cases"]) == 2

    # 목록은 요약(상태만). 첫 문제는 해금 상태.
    assert list_response.status_code == 200
    summary = list_response.json()[0]
    assert summary["id"] == problem["id"]
    assert summary["status"] == "unlocked"
    assert summary["order_index"] == 0

    # 상세에서만 내용 제공, 숨은 케이스 제외.
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert len(detail["public_test_cases"]) == 1
    assert detail["public_test_cases"][0]["hidden"] is False


class _AllPassJudge:
    """모든 테스트를 통과시키는 가짜 Judge (해금 테스트용)."""

    def judge(self, submission, problem) -> JudgeResult:
        total = len(problem.test_cases)
        return JudgeResult(
            id=f"jr_{submission.id}",
            submission_id=submission.id,
            status="accepted",
            passed_count=total,
            total_count=total,
            duration_ms=1,
            test_cases=[],
            created_at=utc_now(),
        )


def _make_two_problem_assessment(
    repository: InMemoryPlatformRepository,
) -> tuple[TestClient, str, list[str]]:
    judged_client = TestClient(create_app(repository, judge_client=_AllPassJudge()))
    starts_at = datetime.now(timezone.utc)
    assessment = judged_client.post(
        "/assessments",
        json={
            "organization_id": "org_1",
            "title": "Sequential",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        },
    ).json()
    problem_ids = []
    for title in ("First", "Second"):
        created = judged_client.post(
            "/problems",
            json={
                "assessment_id": assessment["id"],
                "title": title,
                "statement": "solve",
                "allowed_languages": ["python"],
                "time_limit_ms": 1000,
                "memory_limit_mb": 128,
                "test_cases": [
                    {"stdin": "", "expected_stdout": "", "hidden": False}
                ],
            },
        )
        problem_ids.append(created.json()["id"])
    session = judged_client.post(
        "/sessions",
        json={"assessment_id": assessment["id"], "candidate_id": "user_seq"},
    ).json()
    return judged_client, session["id"], problem_ids


def test_second_problem_is_locked_until_first_is_solved(
    repository: InMemoryPlatformRepository,
) -> None:
    client, session_id, problem_ids = _make_two_problem_assessment(repository)

    # 처음엔 1번 해금, 2번 잠김(제목도 숨김), 잠긴 상세는 423.
    listing = client.get(f"/sessions/{session_id}/problems").json()
    assert [item["status"] for item in listing] == ["unlocked", "locked"]
    assert listing[1]["title"] is None
    locked = client.get(f"/sessions/{session_id}/problems/{problem_ids[1]}")
    assert locked.status_code == 423

    # 1번을 통과 제출 → 1번 solved, 2번 해금.
    client.post(
        f"/sessions/{session_id}/submissions",
        json={
            "problem_id": problem_ids[0],
            "language": "python",
            "source_code": "x",
        },
    )

    listing = client.get(f"/sessions/{session_id}/problems").json()
    assert [item["status"] for item in listing] == ["solved", "unlocked"]
    assert listing[1]["title"] == "Second"
    unlocked = client.get(f"/sessions/{session_id}/problems/{problem_ids[1]}")
    assert unlocked.status_code == 200


def test_below_threshold_submission_keeps_next_problem_locked(
    repository: InMemoryPlatformRepository,
) -> None:
    class _HalfJudge:
        def judge(self, submission, problem) -> JudgeResult:
            return JudgeResult(
                id=f"jr_{submission.id}",
                submission_id=submission.id,
                status="wrong_answer",
                passed_count=1,
                total_count=2,
                duration_ms=1,
                test_cases=[],
                created_at=utc_now(),
            )

    client = TestClient(create_app(repository, judge_client=_HalfJudge()))
    starts_at = datetime.now(timezone.utc)
    assessment = client.post(
        "/assessments",
        json={
            "organization_id": "org_1",
            "title": "Threshold",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        },
    ).json()
    first = client.post(
        "/problems",
        json={
            "assessment_id": assessment["id"],
            "title": "First",
            "statement": "solve",
            "allowed_languages": ["python"],
            "pass_threshold": 1.0,
            "test_cases": [{"stdin": "", "expected_stdout": "", "hidden": False}],
        },
    ).json()
    client.post(
        "/problems",
        json={
            "assessment_id": assessment["id"],
            "title": "Second",
            "statement": "solve",
            "allowed_languages": ["python"],
            "test_cases": [{"stdin": "", "expected_stdout": "", "hidden": False}],
        },
    )
    session = client.post(
        "/sessions",
        json={"assessment_id": assessment["id"], "candidate_id": "user_t"},
    ).json()

    client.post(
        f"/sessions/{session['id']}/submissions",
        json={"problem_id": first["id"], "language": "python", "source_code": "x"},
    )

    listing = client.get(f"/sessions/{session['id']}/problems").json()
    # 통과율 0.5 < 1.0 → 1번 미해결, 2번 잠김 유지.
    assert [item["status"] for item in listing] == ["unlocked", "locked"]


def test_problem_requires_existing_assessment(client: TestClient) -> None:
    response = client.post(
        "/problems",
        json={
            "assessment_id": "asm_missing",
            "title": "Missing",
            "statement": "Missing assessment",
            "allowed_languages": ["python"],
            "test_cases": [{"stdin": "", "expected_stdout": "", "hidden": True}],
        },
    )

    assert response.status_code == 404


def test_ingest_event_batches_in_sequence(
    client: TestClient, session: dict
) -> None:
    first = client.post(
        f"/sessions/{session['id']}/events",
        json=event_batch(session["id"]),
    )
    second = client.post(
        f"/sessions/{session['id']}/events",
        json=event_batch(session["id"], sequence_start=1),
    )

    assert first.status_code == 202
    assert first.json()["next_sequence"] == 1
    assert second.status_code == 202
    assert second.json()["next_sequence"] == 2


def test_duplicate_sequence_returns_409(
    client: TestClient, session: dict
) -> None:
    payload = event_batch(session["id"])
    assert (
        client.post(f"/sessions/{session['id']}/events", json=payload).status_code
        == 202
    )

    duplicate = client.post(
        f"/sessions/{session['id']}/events", json=payload
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["expected_sequence_start"] == 1


def test_missing_or_out_of_order_sequence_returns_409(
    client: TestClient, session: dict
) -> None:
    response = client.post(
        f"/sessions/{session['id']}/events",
        json=event_batch(session["id"], sequence_start=2),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["expected_sequence_start"] == 0


def test_payload_session_id_must_match_path(
    client: TestClient, session: dict
) -> None:
    response = client.post(
        f"/sessions/{session['id']}/events",
        json=event_batch("ses_other"),
    )

    assert response.status_code == 422


def test_submission_is_accepted(
    client: TestClient, session: dict, problem: dict
) -> None:
    response = client.post(
        f"/sessions/{session['id']}/submissions",
        json={
            "problem_id": problem["id"],
            "language": "python",
            "source_code": "print('hello')",
        },
    )

    assert response.status_code == 202
    assert response.json()["session_id"] == session["id"]
    assert response.json()["status"] == "queued"


def test_submission_rejects_language_not_allowed_for_problem(
    client: TestClient, session: dict, problem: dict
) -> None:
    response = client.post(
        f"/sessions/{session['id']}/submissions",
        json={
            "problem_id": problem["id"],
            "language": "javascript",
            "source_code": "console.log('hello')",
        },
    )

    assert response.status_code == 422


def test_submission_dispatches_to_judge_when_configured(
    repository: InMemoryPlatformRepository,
    assessment: dict,
) -> None:
    class FakeJudgeClient:
        def judge(self, submission, problem) -> JudgeResult:
            assert submission.source_code == "print(3)"
            assert problem.test_cases
            return JudgeResult(
                id=f"jr_{submission.id}",
                submission_id=submission.id,
                status="accepted",
                passed_count=2,
                total_count=2,
                duration_ms=12,
                test_cases=[
                    JudgeTestCaseResult(
                        id="tc_1",
                        status="accepted",
                        stdout="3\n",
                        expected_stdout="3\n",
                        stderr="",
                        duration_ms=6,
                        exit_code=0,
                    )
                ],
                created_at=utc_now(),
            )

    integrated_client = TestClient(
        create_app(repository, judge_client=FakeJudgeClient())
    )
    problem_response = integrated_client.post(
        "/problems",
        json={
            "assessment_id": assessment["id"],
            "title": "A + B",
            "statement": "두 정수의 합을 출력하세요.",
            "allowed_languages": ["python"],
            "time_limit_ms": 1000,
            "memory_limit_mb": 128,
            "test_cases": [
                {"stdin": "1 2\n", "expected_stdout": "3\n", "hidden": False},
                {"stdin": "2 1\n", "expected_stdout": "3\n", "hidden": True},
            ],
        },
    )
    session_response = integrated_client.post(
        "/sessions",
        json={
            "assessment_id": assessment["id"],
            "candidate_id": "user_judge",
        },
    )

    response = integrated_client.post(
        f"/sessions/{session_response.json()['id']}/submissions",
        json={
            "problem_id": problem_response.json()["id"],
            "language": "python",
            "source_code": "print(3)",
        },
    )
    result = integrated_client.get(
        f"/submissions/{response.json()['id']}/judge-result"
    )

    assert response.status_code == 202
    assert response.json()["status"] == "judged"
    assert response.json()["judge_result"]["status"] == "accepted"
    assert result.status_code == 200
    assert result.json()["passed_count"] == 2


def test_new_session_has_reviewable_default_risk(
    client: TestClient, session: dict
) -> None:
    response = client.get(f"/sessions/{session['id']}/risk")

    assert response.status_code == 200
    assert response.json()["risk_score"] == 0
    assert response.json()["review_recommended"] is False
    assert response.json()["signals"] == []


def test_repository_can_store_evidence_backed_risk(
    client: TestClient,
    repository: InMemoryPlatformRepository,
    session: dict,
) -> None:
    stored = repository.save_risk_assessment(
        RiskAssessment(
            id="risk_1",
            session_id=session["id"],
            risk_score=72,
            review_recommended=True,
            signals=[
                RiskSignal(
                    code="paste_spike",
                    score=72,
                    evidence={"inserted_character_count": 240},
                )
            ],
            model_version="rules-1",
        )
    )

    response = client.get(f"/sessions/{session['id']}/risk")

    assert stored.session_id == session["id"]
    assert response.status_code == 200
    assert response.json()["signals"][0]["evidence"] == {
        "inserted_character_count": 240
    }


def test_event_ingest_saves_detection_result(
    repository: InMemoryPlatformRepository, assessment: dict
) -> None:
    class FakeRiskAssessor:
        def assess(self, batch: EventBatchCreate) -> RiskAssessment:
            return RiskAssessment(
                id="risk_detected",
                session_id=batch.session_id,
                risk_score=60,
                review_recommended=True,
                signals=[
                    RiskSignal(
                        code="paste_spike",
                        score=100,
                        evidence={"maximum_inserted_characters": 400},
                    )
                ],
                model_version="rules-test",
            )

    integrated_client = TestClient(create_app(repository, FakeRiskAssessor()))
    session_response = integrated_client.post(
        "/sessions",
        json={
            "assessment_id": assessment["id"],
            "candidate_id": "user_detection",
        },
    )
    session_id = session_response.json()["id"]

    ingest_response = integrated_client.post(
        f"/sessions/{session_id}/events",
        json=event_batch(session_id),
    )
    risk_response = integrated_client.get(f"/sessions/{session_id}/risk")

    assert ingest_response.status_code == 202
    assert risk_response.json()["risk_score"] == 60
    assert risk_response.json()["signals"][0]["code"] == "paste_spike"


def test_unknown_session_resources_return_404(client: TestClient) -> None:
    assert client.get("/sessions/ses_missing/risk").status_code == 404
    assert (
        client.post(
            "/sessions/ses_missing/submissions",
            json={
                "problem_id": "problem_1",
                "language": "python",
                "source_code": "",
            },
        ).status_code
        == 404
    )


def auth_headers(client: TestClient, email: str = "admin@example.com") -> dict[str, str]:
    signup = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "correct-horse",
            "display_name": "Admin",
        },
    )
    assert signup.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": "correct-horse"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_first_admin_signup_is_active_admin() -> None:
    client = TestClient(
        create_app(InMemoryPlatformRepository(), require_admin_auth=True)
    )

    response = client.post(
        "/auth/signup",
        json={
            "email": "owner@example.com",
            "password": "correct-horse",
            "display_name": "Owner",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "active"
    assert response.json()["role"] == "admin"


def test_later_admin_signup_requires_approval() -> None:
    client = TestClient(
        create_app(InMemoryPlatformRepository(), require_admin_auth=True)
    )
    headers = auth_headers(client)

    pending = client.post(
        "/auth/signup",
        json={
            "email": "reviewer@example.com",
            "password": "correct-horse",
            "display_name": "Reviewer",
        },
    )
    assert pending.status_code == 201
    assert pending.json()["status"] == "pending"
    assert (
        client.post(
            "/auth/login",
            json={"email": "reviewer@example.com", "password": "correct-horse"},
        ).status_code
        == 401
    )

    approved = client.post(
        f"/admin/users/{pending.json()['id']}/approve",
        json={"role": "reviewer"},
        headers=headers,
    )

    assert approved.status_code == 200
    assert approved.json()["role"] == "reviewer"
    assert (
        client.post(
            "/auth/login",
            json={"email": "reviewer@example.com", "password": "correct-horse"},
        ).status_code
        == 200
    )


def test_admin_auth_is_required_for_assessment_creation() -> None:
    client = TestClient(
        create_app(InMemoryPlatformRepository(), require_admin_auth=True)
    )

    starts_at = datetime.now(timezone.utc)
    response = client.post(
        "/assessments",
        json={
            "organization_id": "org_1",
            "title": "Protected",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        },
    )

    assert response.status_code == 401


def test_candidate_invite_is_single_use() -> None:
    client = TestClient(
        create_app(InMemoryPlatformRepository(), require_admin_auth=True)
    )
    headers = auth_headers(client)
    starts_at = datetime.now(timezone.utc)
    assessment = client.post(
        "/assessments",
        headers=headers,
        json={
            "organization_id": "org_1",
            "title": "Invite flow",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        },
    )
    assert assessment.status_code == 201

    invite = client.post(
        f"/assessments/{assessment.json()['id']}/invites",
        headers=headers,
        json={
            "candidate_id": "candidate_1",
            "expires_at": (starts_at + timedelta(days=7)).isoformat(),
        },
    )
    assert invite.status_code == 201

    preview = client.get(f"/invites/{invite.json()['token']}")
    first = client.post(f"/invites/{invite.json()['token']}/redeem")
    second = client.post(f"/invites/{invite.json()['token']}/redeem")

    assert preview.status_code == 200
    assert first.status_code == 200
    assert first.json()["session"]["candidate_id"] == "candidate_1"
    assert second.status_code == 409
