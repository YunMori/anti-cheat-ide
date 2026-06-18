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
from ..models import AdminUserRecord, Problem, ProblemCreate, TestCase

router = APIRouter(tags=["problems"])


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
    if repository.get_assessment(payload.assessment_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    problem = Problem(
        id=new_id("prb"),
        test_cases=[
            TestCase(id=new_id("tc"), **test_case.model_dump())
            for test_case in payload.test_cases
        ],
        **payload.model_dump(exclude={"test_cases"}),
    )
    return repository.create_problem(problem)


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
