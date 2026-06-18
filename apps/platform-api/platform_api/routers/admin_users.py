"""관리자 가입 승인 대기 목록 / 승인."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import (
    RepositoryDependency,
    public_admin_user,
    require_role,
)
from ..models import AdminApproval, AdminUser, AdminUserRecord, utc_now

router = APIRouter(tags=["admin-users"])


@router.get("/admin/users/pending", response_model=list[AdminUser])
def list_pending_users(
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord, Depends(require_role("admin"))],
) -> list[AdminUser]:
    del current_user
    return [
        public_admin_user(user) for user in repository.list_pending_admin_users()
    ]


@router.post("/admin/users/{user_id}/approve", response_model=AdminUser)
def approve_user(
    user_id: str,
    payload: AdminApproval,
    repository: RepositoryDependency,
    current_user: Annotated[AdminUserRecord, Depends(require_role("admin"))],
) -> AdminUser:
    del current_user
    user = repository.approve_admin_user(user_id, payload.role, utc_now())
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )
    return public_admin_user(user)
