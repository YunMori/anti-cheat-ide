"""관리자 가입/로그인/본인 조회."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import hash_password, issue_access_token, verify_password
from ..dependencies import (
    RepositoryDependency,
    new_id,
    public_admin_user,
    require_authenticated_admin,
)
from ..models import (
    AdminLogin,
    AdminSignup,
    AdminToken,
    AdminUser,
    AdminUserRecord,
    utc_now,
)

router = APIRouter(tags=["auth"])


@router.post(
    "/auth/signup",
    response_model=AdminUser,
    status_code=status.HTTP_201_CREATED,
)
def signup(payload: AdminSignup, repository: RepositoryDependency) -> AdminUser:
    active_admin_count = repository.count_active_admin_users()
    user = AdminUserRecord(
        id=new_id("usr"),
        email=payload.email.lower(),
        display_name=payload.display_name,
        role="admin" if active_admin_count == 0 else None,
        status="active" if active_admin_count == 0 else "pending",
        created_at=utc_now(),
        approved_at=utc_now() if active_admin_count == 0 else None,
        password_hash=hash_password(payload.password),
    )
    try:
        created = repository.create_admin_user(user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        ) from exc
    return public_admin_user(created)


@router.post("/auth/login", response_model=AdminToken)
def login(payload: AdminLogin, repository: RepositoryDependency) -> AdminToken:
    user = repository.get_admin_user_by_email(payload.email)
    if (
        user is None
        or user.status != "active"
        or user.role is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )
    return AdminToken(
        access_token=issue_access_token(user.id),
        user=public_admin_user(user),
    )


@router.get("/auth/me", response_model=AdminUser)
def me(
    current_user: Annotated[AdminUserRecord, Depends(require_authenticated_admin)],
) -> AdminUser:
    return public_admin_user(current_user)
