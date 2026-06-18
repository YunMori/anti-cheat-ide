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
    RiskAssessment,
    Session,
    SessionCreate,
    utc_now,
)

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
    response_model=list[CandidateProblem],
)
def list_session_problems(
    session_id: str, repository: RepositoryDependency
) -> list[CandidateProblem]:
    session = require_session(repository, session_id)
    return [
        CandidateProblem(
            id=problem.id,
            assessment_id=problem.assessment_id,
            title=problem.title,
            statement=problem.statement,
            allowed_languages=problem.allowed_languages,
            starter_code=problem.starter_code,
            time_limit_ms=problem.time_limit_ms,
            memory_limit_mb=problem.memory_limit_mb,
            public_test_cases=[
                test_case
                for test_case in problem.test_cases
                if not test_case.hidden
            ],
        )
        for problem in repository.list_problems(session.assessment_id)
    ]
