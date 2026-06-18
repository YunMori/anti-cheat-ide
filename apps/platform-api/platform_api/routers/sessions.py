"""응시 세션 생성/조회 및 응시자용 문제 목록."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
    RepositoryDependency,
    new_id,
    require_role,
    require_session,
)
from ..models import (
    AdminUserRecord,
    CandidateProblem,
    CandidateProblemSummary,
    RiskAssessment,
    Session,
    SessionCreate,
    utc_now,
)
from ..progress import compute_problem_status

router = APIRouter(tags=["sessions"])


@router.post(
    "/sessions",
    response_model=Session,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: SessionCreate,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord | None, Depends(require_role("admin"))],
) -> Session:
    del current_user
    if repository.get_assessment(payload.assessment_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )

    session = Session(
        id=new_id("ses"),
        assessment_id=payload.assessment_id,
        candidate_id=payload.candidate_id,
        started_at=utc_now(),
    )
    initial_risk = RiskAssessment(
        id=new_id("risk"),
        session_id=session.id,
        risk_score=0,
        review_recommended=False,
        signals=[],
        model_version="unassessed",
    )
    return repository.create_session(session, initial_risk)


@router.get("/sessions/{session_id}", response_model=Session)
def get_session(session_id: str, repository: RepositoryDependency) -> Session:
    return require_session(repository, session_id)


@router.get(
    "/sessions/{session_id}/problems",
    response_model=list[CandidateProblemSummary],
)
def list_session_problems(
    session_id: str, repository: RepositoryDependency
) -> list[CandidateProblemSummary]:
    """문제 순서 목록 + 해금 상태. 잠긴 문제는 제목/내용을 노출하지 않는다."""
    session = require_session(repository, session_id)
    problems = sorted(
        repository.list_problems(session.assessment_id),
        key=lambda item: item.order_index,
    )
    statuses = compute_problem_status(repository, session, problems)
    return [
        CandidateProblemSummary(
            id=problem.id,
            order_index=problem.order_index,
            status=statuses[problem.id],
            pass_threshold=problem.pass_threshold,
            title=(
                problem.title if statuses[problem.id] != "locked" else None
            ),
        )
        for problem in problems
    ]


@router.get(
    "/sessions/{session_id}/problems/{problem_id}",
    response_model=CandidateProblem,
)
def get_session_problem(
    session_id: str, problem_id: str, repository: RepositoryDependency
) -> CandidateProblem:
    """해금된 문제의 전체 내용. 잠긴 문제는 423으로 내용을 막는다(백엔드 강제)."""
    session = require_session(repository, session_id)
    problems = repository.list_problems(session.assessment_id)
    problem = next((item for item in problems if item.id == problem_id), None)
    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="problem not found for session",
        )
    statuses = compute_problem_status(repository, session, problems)
    if statuses[problem.id] == "locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="problem is locked; solve the previous problem first",
        )
    return CandidateProblem(
        id=problem.id,
        assessment_id=problem.assessment_id,
        title=problem.title,
        statement=problem.statement,
        allowed_languages=problem.allowed_languages,
        starter_code=problem.starter_code,
        time_limit_ms=problem.time_limit_ms,
        memory_limit_mb=problem.memory_limit_mb,
        pass_threshold=problem.pass_threshold,
        order_index=problem.order_index,
        status=statuses[problem.id],
        public_test_cases=[
            test_case for test_case in problem.test_cases if not test_case.hidden
        ],
    )
