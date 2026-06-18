"""세션 위험 평가 조회 (검토자용)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..dependencies import CurrentAdmin, RepositoryDependency, require_session
from ..models import RiskAssessment

router = APIRouter(tags=["risk"])


@router.get("/sessions/{session_id}/risk", response_model=RiskAssessment)
def get_session_risk(
    session_id: str,
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> RiskAssessment:
    del current_user
    require_session(repository, session_id)
    assessment = repository.get_risk_assessment(session_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="risk assessment not found",
        )
    return assessment
