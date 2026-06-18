import pytest

from app.models import JudgeRequest, JudgeStatus
from app.runners.base import ExecutionResult
from app.service import JudgeService
from tests.fakes import FakeRunner


@pytest.mark.parametrize(
    ("execution", "expected_status"),
    [
        (ExecutionResult("", "", None, 2001, timed_out=True), "time_limit_exceeded"),
        (ExecutionResult("", "boom", 1, 5), "runtime_error"),
        (ExecutionResult("", "docker unavailable", None, 1, internal_error=True), "internal_error"),
    ],
)
def test_execution_failures_are_reported(
    execution: ExecutionResult, expected_status: str
) -> None:
    request = JudgeRequest.model_validate(
        {
            "submission_id": "submission-1",
            "language": "javascript",
            "source_code": "console.log('ok')",
            "test_cases": [{"id": "one", "stdin": "", "expected_stdout": "ok\n"}],
        }
    )

    result = JudgeService(FakeRunner([execution])).judge(request)

    assert result.status == JudgeStatus(expected_status)
    assert result.test_cases[0].status == JudgeStatus(expected_status)


def test_stdout_comparison_normalizes_only_line_endings() -> None:
    request = JudgeRequest.model_validate(
        {
            "submission_id": "submission-1",
            "language": "python",
            "source_code": "print('ok')",
            "test_cases": [
                {"id": "one", "stdin": "", "expected_stdout": "ok\r\n"},
                {"id": "two", "stdin": "", "expected_stdout": "ok\n"},
            ],
        }
    )
    runner = FakeRunner(
        [
            ExecutionResult("ok\n", "", 0, 1),
            ExecutionResult("ok \n", "", 0, 1),
        ]
    )

    result = JudgeService(runner).judge(request)

    assert result.test_cases[0].status == JudgeStatus.ACCEPTED
    assert result.test_cases[1].status == JudgeStatus.WRONG_ANSWER
