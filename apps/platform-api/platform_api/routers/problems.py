"""문제(problem) 생성/조회."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
    CurrentAdmin,
    RepositoryDependency,
    new_id,
    require_role,
)
from ..models import (
    AdminUserRecord,
    Problem,
    ProblemCreate,
    ProblemUpdate,
    TestCase,
    assessment_status,
)
from ..repositories import PlatformRepository

router = APIRouter(tags=["problems"])


def _ensure_editable(repository: PlatformRepository, assessment_id: str) -> None:
    """대상 시험이 출제 편집 가능한 상태(시작 전)인지 확인한다.

    시험이 시작되면(live) 또는 종료되면(archived) 무결성 보장을 위해 출제가
    잠긴다. 프론트의 disabled 처리와 별개로 서버에서도 강제한다.
    """
    assessment = repository.get_assessment(assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    if assessment_status(assessment) != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="시험이 시작되어 출제가 잠겼습니다",
        )


@router.post(
    "/problems",
    response_model=Problem,
    status_code=status.HTTP_201_CREATED,
)
def create_problem(
    payload: ProblemCreate,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord | None, Depends(require_role("admin"))],
) -> Problem:
    del current_user
    _ensure_editable(repository, payload.assessment_id)
    existing = repository.list_problems(payload.assessment_id)
    problem = Problem(
        id=new_id("prb"),
        order_index=len(existing),
        test_cases=[
            TestCase(id=new_id("tc"), **test_case.model_dump())
            for test_case in payload.test_cases
        ],
        **payload.model_dump(exclude={"test_cases"}),
    )
    return repository.create_problem(problem)


@router.patch("/problems/{problem_id}", response_model=Problem)
def update_problem(
    problem_id: str,
    payload: ProblemUpdate,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord | None, Depends(require_role("admin"))],
) -> Problem:
    del current_user
    problem = repository.get_problem(problem_id)
    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="problem not found",
        )
    _ensure_editable(repository, problem.assessment_id)

    updates = payload.model_dump(exclude_unset=True)
    if "test_cases" in updates:
        updates["test_cases"] = [
            TestCase(id=new_id("tc"), **test_case)
            for test_case in updates["test_cases"]
        ]
    updated = problem.model_copy(update=updates)

    if len(set(updated.allowed_languages)) != len(updated.allowed_languages):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="allowed_languages must not contain duplicates",
        )
    if set(updated.starter_code) - set(updated.allowed_languages):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="starter_code languages must be included in allowed_languages",
        )
    return repository.update_problem(updated)


@router.get("/problems", response_model=list[Problem])
def list_problems(
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
    assessment_id: str | None = None,
) -> list[Problem]:
    del current_user
    return repository.list_problems(assessment_id)


@router.get("/problems/{problem_id}", response_model=Problem)
def get_problem(
    problem_id: str,
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> Problem:
    del current_user
    problem = repository.get_problem(problem_id)
    if problem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="problem not found",
        )
    return problem
