"""응시자 1회용 초대 링크 생성/미리보기/교환."""
from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
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
    Session,
    utc_now,
)

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
