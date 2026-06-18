"""라우터들이 공유하는 의존성·헬퍼.

라우트 핸들러는 도메인별 `routers/` 모듈로 분리되어 있고, 그들이 공통으로
사용하는 인증/세션/초대 검증 로직과 ID 생성기를 이 모듈에 모은다.
이렇게 한 곳에 두면 라우터 간 import 순환을 피할 수 있다.
"""
from __future__ import annotations

import os
from datetime import timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import TokenError, verify_access_token
from .models import AdminUser, AdminUserRecord, CandidateInvite, Session, utc_now
from .repositories import PlatformRepository

bearer_scheme = HTTPBearer(auto_error=False)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def get_repository(request: Request) -> PlatformRepository:
    return request.app.state.repository


RepositoryDependency = Annotated[PlatformRepository, Depends(get_repository)]


def public_admin_user(user: AdminUserRecord) -> AdminUser:
    return AdminUser.model_validate(user.model_dump(exclude={"password_hash"}))


def require_authenticated_admin(
    request: Request,
    repository: RepositoryDependency,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AdminUserRecord | None:
    if not request.app.state.require_admin_auth:
        return None
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    try:
        user_id = verify_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        ) from exc
    user = repository.get_admin_user(user_id)
    if user is None or user.status != "active" or user.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        )
    return user


CurrentAdmin = Annotated[AdminUserRecord | None, Depends(require_authenticated_admin)]


def require_role(role: str):
    def dependency(
        current_user: CurrentAdmin,
        request: Request,
    ) -> AdminUserRecord | None:
        if not request.app.state.require_admin_auth:
            return None
        if current_user is None or current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient role",
            )
        return current_user

    return dependency


def require_valid_invite(
    repository: PlatformRepository, token: str, allow_used: bool
) -> CandidateInvite:
    invite = repository.get_candidate_invite_by_token(token)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="invite not found",
        )
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="invite expired",
        )
    if invite.used_at is not None and not allow_used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="invite already used",
        )
    return invite


def build_invite_url(token: str) -> str:
    base_url = os.getenv("INVITE_PUBLIC_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base_url}/?invite={token}"


def require_session(repository: PlatformRepository, session_id: str) -> Session:
    session = repository.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )
    return session
