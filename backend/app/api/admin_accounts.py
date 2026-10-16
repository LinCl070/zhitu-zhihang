"""Administrator-only teacher account lifecycle endpoints."""

import re
from datetime import UTC, date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select

from app.api.auth import UserSummary, _user_summary, create_temporary_password_record
from app.auth.passwords import (
    generate_temporary_password,
    hash_password,
    normalize_username,
    validate_password,
)
from app.auth.session import DbSession, SessionPrincipal, account_session_store, require_roles
from app.models.entities import User, UserRole
from app.services.audit import record_audit_event

router = APIRouter(prefix="/api/v1/admin/users", tags=["admin-accounts"])
AdminPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.ADMIN))]


class TeacherCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=11, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    employment_date: date
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalized_username(cls, value: str) -> str:
        return normalize_username(value)

    @field_validator("display_name")
    @classmethod
    def normalized_display_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("教师身份不能为空")
        return normalized

    @field_validator("phone")
    @classmethod
    def normalized_phone(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"1[3-9]\d{9}", normalized):
            raise ValueError("电话号码格式不正确")
        return normalized

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
            raise ValueError("联系邮箱格式不正确")
        return normalized

    @field_validator("employment_date")
    @classmethod
    def valid_employment_date(cls, value: date) -> date:
        if not date(1958, 1, 1) <= value <= date.today():
            raise ValueError("入职日期须在 1958-01-01 至今天之间")
        return value

    @field_validator("password")
    @classmethod
    def valid_password(cls, value: str) -> str:
        validate_password(value)
        return value


class AccountWithTemporaryPassword(UserSummary):
    temporary_password: str


class AccountStatusPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


@router.post(
    "/teachers", response_model=UserSummary, status_code=status.HTTP_201_CREATED
)
def create_teacher(
    payload: TeacherCreatePayload,
    principal: AdminPrincipal,
    session: DbSession,
) -> UserSummary:
    if session.scalar(select(User.id).where(User.username == payload.username)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已被使用")
    administrator = session.get(User, principal.user_id)
    if administrator is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    user = User(
        username=payload.username,
        display_name=payload.display_name,
        phone=payload.phone,
        email=payload.email,
        employment_date=payload.employment_date,
        role=UserRole.COUNSELOR,
        password_hash=hash_password(payload.password),
        password_changed_at=datetime.now(UTC),
        must_change_password=True,
    )
    session.add(user)
    session.flush()
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="teacher_account_created",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()
    return _user_summary(user)


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
