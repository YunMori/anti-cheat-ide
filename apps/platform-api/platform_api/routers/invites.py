"""응시자 1회용 초대 링크 생성/미리보기/교환."""
from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
    CurrentAdmin,
    RepositoryDependency,
    build_invite_url,
    new_id,
    require_role,
    require_valid_invite,
)
from ..models import (
    AdminUserRecord,
    CandidateInvite,
    CandidateInviteCreate,
    CandidateInvitePreview,
    CandidateInviteRedeemed,
    ParticipantStatus,
    Session,
    utc_now,
)
from ..progress import compute_problem_status

router = APIRouter(tags=["invites"])


@router.post(
    "/assessments/{assessment_id}/invites",
    response_model=CandidateInvite,
    status_code=status.HTTP_201_CREATED,
)
def create_candidate_invite(
    assessment_id: str,
    payload: CandidateInviteCreate,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord | None, Depends(require_role("admin"))],
) -> CandidateInvite:
    assessment = repository.get_assessment(assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    if payload.expires_at <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expires_at must be in the future",
        )
    token = secrets.token_urlsafe(24)
    invite = CandidateInvite(
        id=new_id("inv"),
        assessment_id=assessment_id,
        candidate_id=payload.candidate_id,
        token=token,
        invite_url=build_invite_url(token),
        expires_at=payload.expires_at,
        created_at=utc_now(),
        created_by_user_id=current_user.id if current_user else "auth-disabled",
    )
    return repository.create_candidate_invite(invite)


@router.get(
    "/assessments/{assessment_id}/participants",
    response_model=list[ParticipantStatus],
)
def list_assessment_participants(
    assessment_id: str,
    repository: RepositoryDependency,
    current_user: CurrentAdmin,
) -> list[ParticipantStatus]:
    """초대한 참가자별 응시 현황(상태·풀이 진행·위험) 집계. admin·reviewer 공용."""
    del current_user
    if repository.get_assessment(assessment_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    problems = repository.list_problems(assessment_id)
    total_problems = len(problems)
    rows: list[ParticipantStatus] = []
    for invite in repository.list_candidate_invites(assessment_id):
        session_status: str | None = None
        solved_count = 0
        risk_score: float | None = None
        review_recommended: bool | None = None
        if invite.session_id is not None:
            session = repository.get_session(invite.session_id)
            if session is not None:
                session_status = session.status
                statuses = compute_problem_status(repository, session, problems)
                solved_count = sum(
                    1 for value in statuses.values() if value == "solved"
                )
            risk = repository.get_risk_assessment(invite.session_id)
            if risk is not None:
                risk_score = risk.risk_score
                review_recommended = risk.review_recommended
        rows.append(
            ParticipantStatus(
                candidate_id=invite.candidate_id,
                invited_at=invite.created_at,
                expires_at=invite.expires_at,
                redeemed=invite.used_at is not None,
                session_id=invite.session_id,
                session_status=session_status,
                risk_score=risk_score,
                review_recommended=review_recommended,
                solved_count=solved_count,
                total_problems=total_problems,
            )
        )
    return rows


@router.get("/invites/{token}", response_model=CandidateInvitePreview)
def preview_candidate_invite(
    token: str, repository: RepositoryDependency
) -> CandidateInvitePreview:
    invite = require_valid_invite(repository, token, allow_used=True)
    assessment = repository.get_assessment(invite.assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="assessment not found",
        )
    return CandidateInvitePreview(
        assessment_id=assessment.id,
        assessment_title=assessment.title,
        candidate_id=invite.candidate_id,
        expires_at=invite.expires_at,
        used=invite.used_at is not None,
    )


@router.post("/invites/{token}/redeem", response_model=CandidateInviteRedeemed)
def redeem_candidate_invite(
    token: str, repository: RepositoryDependency
) -> CandidateInviteRedeemed:
    invite = require_valid_invite(repository, token, allow_used=False)
    session = Session(
        id=new_id("ses"),
        assessment_id=invite.assessment_id,
        candidate_id=invite.candidate_id,
        started_at=utc_now(),
    )
    used = repository.mark_candidate_invite_used(token, utc_now(), session)
    if used is None or used.session_id != session.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="invite already used",
        )
    return CandidateInviteRedeemed(session=session)
