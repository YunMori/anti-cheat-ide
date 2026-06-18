"""시험(assessment) 생성/조회."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
    CurrentAdmin,
    RepositoryDependency,
    new_id,
    require_role,
)
from ..models import AdminUserRecord, Assessment, AssessmentCreate

router = APIRouter(tags=["assessments"])


@router.post(
    "/assessments",
    response_model=Assessment,
    status_code=status.HTTP_201_CREATED,
)
def create_assessment(
    payload: AssessmentCreate,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord | None, Depends(require_role("admin"))],
) -> Assessment:
    del current_user
    assessment = Assessment(id=new_id("asm"), **payload.model_dump())
    return repository.create_assessment(assessment)


@router.get("/assessments", response_model=list[Assessment])
def list_assessments(
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> list[Assessment]:
    del current_user
    return repository.list_assessments()


@router.get("/assessments/{assessment_id}", response_model=Assessment)
def get_assessment(
    assessment_id: str,
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> Assessment:
    del current_user
    assessment = repository.get_assessment(assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    return assessment
