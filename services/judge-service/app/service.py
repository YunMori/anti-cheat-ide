from app.models import (
    JudgeRequest,
    JudgeResponse,
    JudgeStatus,
    TestCaseResult,
)
from app.profiles import get_language_profile
from app.runners.base import ExecutionRequest, ExecutionResult, SandboxRunner


class JudgeService:
    def __init__(self, runner: SandboxRunner) -> None:
        self._runner = runner

    def judge(self, request: JudgeRequest) -> JudgeResponse:
        profile = get_language_profile(request.language)
        results: list[TestCaseResult] = []

        for test_case in request.test_cases:
            execution = self._runner.execute(
                ExecutionRequest(
                    profile=profile,
                    source_code=request.source_code,
                    stdin=test_case.stdin,
                    limits=request.limits,
                )
            )
            results.append(
                TestCaseResult(
                    id=test_case.id,
                    status=self._status_for(execution, test_case.expected_stdout),
                    stdout=execution.stdout,
                    expected_stdout=test_case.expected_stdout,
                    stderr=execution.stderr,
                    duration_ms=execution.duration_ms,
                    exit_code=execution.exit_code,
                )
            )

        overall_status = next(
            (
                result.status
                for result in results
                if result.status != JudgeStatus.ACCEPTED
            ),
            JudgeStatus.ACCEPTED,
        )
        return JudgeResponse(
            submission_id=request.submission_id,
            status=overall_status,
            passed_count=sum(
                result.status == JudgeStatus.ACCEPTED for result in results
            ),
            total_count=len(results),
            duration_ms=sum(result.duration_ms for result in results),
            test_cases=results,
        )

    @staticmethod
    def _status_for(
        execution: ExecutionResult, expected_stdout: str
    ) -> JudgeStatus:
        if execution.internal_error:
            return JudgeStatus.INTERNAL_ERROR
        if execution.timed_out:
            return JudgeStatus.TIME_LIMIT_EXCEEDED
        if execution.exit_code != 0:
            return JudgeStatus.RUNTIME_ERROR
        if JudgeService._normalize_stdout(execution.stdout) != (
            JudgeService._normalize_stdout(expected_stdout)
        ):
            return JudgeStatus.WRONG_ANSWER
        return JudgeStatus.ACCEPTED

    @staticmethod
    def _normalize_stdout(value: str) -> str:
        return value.replace("\r\n", "\n")
