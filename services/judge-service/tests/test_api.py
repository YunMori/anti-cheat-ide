from fastapi.testclient import TestClient

from app.main import create_app
from app.models import Language
from app.profiles import get_language_profile
from app.runners.base import ExecutionResult
from tests.fakes import FakeRunner


def test_health() -> None:
    client = TestClient(create_app(FakeRunner([])))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_judge_returns_per_test_case_results() -> None:
    runner = FakeRunner(
        [
            ExecutionResult("3\n", "", 0, 11),
            ExecutionResult("4\n", "", 0, 13),
        ]
    )
    client = TestClient(create_app(runner))

    response = client.post(
        "/judge",
        json={
            "submission_id": "submission-1",
            "language": "python",
            "source_code": "a, b = map(int, input().split()); print(a + b)",
            "test_cases": [
                {"id": "one", "stdin": "1 2\n", "expected_stdout": "3\n"},
                {"id": "two", "stdin": "2 2\n", "expected_stdout": "5\n"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "submission_id": "submission-1",
        "status": "wrong_answer",
        "passed_count": 1,
        "total_count": 2,
        "duration_ms": 24,
        "test_cases": [
            {
                "id": "one",
                "status": "accepted",
                "stdout": "3\n",
                "expected_stdout": "3\n",
                "stderr": "",
                "duration_ms": 11,
                "exit_code": 0,
            },
            {
                "id": "two",
                "status": "wrong_answer",
                "stdout": "4\n",
                "expected_stdout": "5\n",
                "stderr": "",
                "duration_ms": 13,
                "exit_code": 0,
            },
        ],
    }
    assert runner.requests[0].profile.image == "python:3.12-alpine"
    assert runner.requests[0].limits.time_ms == 2000


def test_judge_validates_contract_language() -> None:
    client = TestClient(create_app(FakeRunner([])))

    response = client.post(
        "/judge",
        json={
            "submission_id": "submission-1",
            "language": "ruby",
            "source_code": "puts 1",
            "test_cases": [],
        },
    )

    assert response.status_code == 422


def test_compiled_language_profiles_define_compile_and_run_commands() -> None:
    cpp = get_language_profile(Language.CPP)
    java = get_language_profile(Language.JAVA)

    assert cpp.image == "gcc:14-bookworm"
    assert cpp.compile_command is not None
    assert cpp.run_command == ("/tmp/main",)
    assert java.image == "eclipse-temurin:21-jdk-jammy"
    assert java.compile_command is not None
    assert java.run_command == ("java", "-cp", "/tmp", "Main")
