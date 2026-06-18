from __future__ import annotations

from typing import Protocol

import httpx

from .models import JudgeResult, JudgeTestCaseResult, Problem, Submission, utc_now


class JudgeClient(Protocol):
    def judge(self, submission: Submission, problem: Problem) -> JudgeResult: ...


class HttpJudgeClient:
    def __init__(self, base_url: str, timeout_seconds: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    def judge(self, submission: Submission, problem: Problem) -> JudgeResult:
        response = httpx.post(
            f"{self._base_url}/judge",
            json={
                "submission_id": submission.id,
                "language": submission.language,
                "source_code": submission.source_code,
                "test_cases": [
                    {
                        "id": test_case.id,
                        "stdin": test_case.stdin,
                        "expected_stdout": test_case.expected_stdout,
                    }
                    for test_case in problem.test_cases
                ],
                "limits": {
                    "time_ms": problem.time_limit_ms,
                    "memory_mb": problem.memory_limit_mb,
                },
            },
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return JudgeResult(
            id=f"jr_{submission.id}",
            submission_id=submission.id,
            status=payload["status"],
            passed_count=payload["passed_count"],
            total_count=payload["total_count"],
            duration_ms=payload["duration_ms"],
            test_cases=[
                JudgeTestCaseResult.model_validate(item)
                for item in payload.get("test_cases", [])
            ],
            created_at=utc_now(),
        )
