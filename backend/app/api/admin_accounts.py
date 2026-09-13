"""Administrator-only teacher account lifecycle endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select

from app.api.auth import UserSummary, _user_summary, create_temporary_password_record
from app.auth.passwords import generate_temporary_password, normalize_username
from app.auth.session import DbSession, SessionPrincipal, account_session_store, require_roles
from app.models.entities import User, UserRole
from app.services.audit import record_audit_event

router = APIRouter(prefix="/api/v1/admin/users", tags=["admin-accounts"])
AdminPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.ADMIN))]


class TeacherCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("username")
    @classmethod
    def normalized_username(cls, value: str) -> str:
        return normalize_username(value)


class AccountWithTemporaryPassword(UserSummary):
    temporary_password: str


class AccountStatusPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


@router.post(
    "/teachers", response_model=AccountWithTemporaryPassword, status_code=status.HTTP_201_CREATED
)
def create_teacher(
    payload: TeacherCreatePayload,
    principal: AdminPrincipal,
    session: DbSession,
) -> AccountWithTemporaryPassword:
    if session.scalar(select(User.id).where(User.username == payload.username)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已被使用")
    administrator = session.get(User, principal.user_id)
    if administrator is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    temporary_password = generate_temporary_password()
    user = User(
        username=payload.username,
        display_name=" ".join(payload.display_name.split()),
        role=UserRole.COUNSELOR,
        password_hash="!pending-temporary-password!",
    )
    session.add(user)
    session.flush()
    create_temporary_password_record(
        session, user=user, created_by=administrator, temporary_password=temporary_password
    )
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="teacher_account_created",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()
    return AccountWithTemporaryPassword(
        **_user_summary(user).model_dump(), temporary_password=temporary_password
    )


@router.post("/{user_id}/reset-password", response_model=AccountWithTemporaryPassword)
def reset_password(
    user_id: UUID,
    principal: AdminPrincipal,
    session: DbSession,
) -> AccountWithTemporaryPassword:
    user = session.get(User, user_id)
    administrator = session.get(User, principal.user_id)
    if user is None or user.role is UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在")
    if administrator is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    temporary_password = generate_temporary_password()
    create_temporary_password_record(
        session, user=user, created_by=administrator, temporary_password=temporary_password
    )
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="password_reset",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()
    return AccountWithTemporaryPassword(
        **_user_summary(user).model_dump(), temporary_password=temporary_password
    )


@router.patch("/{user_id}/status", response_model=UserSummary)
def set_account_status(
    user_id: UUID,
    payload: AccountStatusPayload,
    principal: AdminPrincipal,
    session: DbSession,
) -> UserSummary:
    user = session.get(User, user_id)
    if user is None or user.role is UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在")
    user.is_active = payload.is_active
    account_session_store.revoke_user(user.id)
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="account_status_changed",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()
    return _user_summary(user)
