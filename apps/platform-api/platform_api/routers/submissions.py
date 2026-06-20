"""코드 제출 및 채점 결과 조회.

제출은 저장 후 Judge Service로 채점을 요청하고, 결과에 따라 상태를
judged/judge_failed 로 갱신한다.
"""
from __future__ import annotations

from typing import get_args

from fastapi import APIRouter, HTTPException, Request, status
import httpx

from ..dependencies import (
    CurrentAdmin,
    RepositoryDependency,
    new_id,
    require_session,
)
from ..models import (
    JudgeResult,
    Submission,
    SubmissionAccepted,
    SubmissionCreate,
    SupportedLanguage,
    utc_now,
)

router = APIRouter(tags=["submissions"])


@router.post(
    "/sessions/{session_id}/submissions",
    response_model=SubmissionAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_submission(
    session_id: str,
    payload: SubmissionCreate,
    repository: RepositoryDependency,
    request: Request,
) -> SubmissionAccepted:
    session = require_session(repository, session_id)
    problem = repository.get_problem(payload.problem_id)
    if problem is None or problem.assessment_id != session.assessment_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="problem not found for session assessment",
        )
    if payload.language not in get_args(SupportedLanguage):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="unsupported language",
        )
    submission = Submission(
        id=new_id("sub"),
        session_id=session_id,
        created_at=utc_now(),
        **payload.model_dump(),
    )
    stored_submission = repository.append_submission(submission)
    judge_result: JudgeResult | None = None
    judge_client = request.app.state.judge_client
    if judge_client is not None:
        try:
            judge_result = repository.save_judge_result(
                judge_client.judge(stored_submission, problem)
            )
            stored_submission = (
                repository.update_submission_status(
                    session_id, stored_submission.id, "judged"
                )
                or stored_submission
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            stored_submission = (
                repository.update_submission_status(
                    session_id, stored_submission.id, "judge_failed"
                )
                or stored_submission
            )
    return SubmissionAccepted(
        **stored_submission.model_dump(),
        judge_result=judge_result,
    )


@router.get(
    "/sessions/{session_id}/submissions",
    response_model=list[SubmissionAccepted],
)
def list_session_submissions(
    session_id: str,
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> list[SubmissionAccepted]:
    del current_user
    require_session(repository, session_id)
    return [
        SubmissionAccepted(
            **submission.model_dump(),
            judge_result=repository.get_judge_result(submission.id),
        )
        for submission in repository.list_submissions(session_id)
    ]


@router.get(
    "/submissions/{submission_id}/judge-result",
    response_model=JudgeResult,
)
def get_submission_judge_result(
    submission_id: str,
    repository: RepositoryDependency,
) -> JudgeResult:
    result = repository.get_judge_result(submission_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="judge result not found",
        )
    return result
