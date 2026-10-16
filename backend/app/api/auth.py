"""Account registration, login, password changes, and account lifecycle endpoints."""

import re
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select

from app.auth.passwords import (
    hash_password,
    hash_temporary_credential,
    normalize_username,
    validate_password,
    verify_password,
)
from app.auth.session import SESSION_TTL, CurrentPrincipal, DbSession, account_session_store
from app.models.entities import PasswordResetToken, User, UserRole
from app.services.audit import record_audit_event

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
_LOCK_THRESHOLD = 5
_LOCK_DURATION = timedelta(minutes=15)
_TEMPORARY_PASSWORD_TTL = timedelta(hours=24)
_STUDENT_NUMBER_PATTERN = re.compile(r"^\d{10}$")
_PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CredentialsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def normalized_username(cls, value: str) -> str:
        return normalize_username(value)


class StudentRegistrationPayload(CredentialsPayload):
    name: str = Field(min_length=1, max_length=100)
    student_number: str = Field(min_length=10, max_length=10)
    phone: str = Field(min_length=11, max_length=32)
    email: str = Field(min_length=3, max_length=254)
    enrollment_date: date
    password_confirmation: str = Field(min_length=1, max_length=128)

    @field_validator("name")
    @classmethod
    def normalized_name(cls, value: str) -> str:
        result = " ".join(value.split())
        if not result:
            raise ValueError("姓名不能为空")
        return result

    @field_validator("student_number")
    @classmethod
    def normalized_student_number(cls, value: str) -> str:
        result = value.strip()
        if not _STUDENT_NUMBER_PATTERN.fullmatch(result):
            raise ValueError("学号须为 10 位数字")
        return result

    @field_validator("phone")
    @classmethod
    def normalized_phone(cls, value: str) -> str:
        result = value.strip()
        if not _PHONE_PATTERN.fullmatch(result):
            raise ValueError("电话号码格式不正确")
        return result

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        result = value.strip().lower()
        if not _EMAIL_PATTERN.fullmatch(result):
            raise ValueError("联系邮箱格式不正确")
        return result

    @field_validator("enrollment_date")
    @classmethod
    def valid_enrollment_date(cls, value: date) -> date:
        if not date(1958, 1, 1) <= value <= date.today():
            raise ValueError("入学日期须在 1958-01-01 至今天之间")
        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    display_name: str
    role: UserRole
    must_change_password: bool


class UserSummary(BaseModel):
    id: str
    username: str
    display_name: str
    role: UserRole
    must_change_password: bool


class ChangePasswordPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)
    password_confirmation: str = Field(min_length=1, max_length=128)


@router.post("/register/student", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def register_student(payload: StudentRegistrationPayload, session: DbSession) -> UserSummary:
    _validate_new_password(payload.password, payload.password_confirmation)
    if session.scalar(select(User.id).where(User.username == payload.username)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已被使用")
    if (
        session.scalar(select(User.id).where(User.student_number == payload.student_number))
        is not None
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="学号已被使用")
    user = User(
        username=payload.username,
        display_name=payload.name,
        student_number=payload.student_number,
        phone=payload.phone,
        email=payload.email,
        enrollment_year=payload.enrollment_date.year,
        enrollment_date=payload.enrollment_date,
        role=UserRole.STUDENT,
        password_hash=hash_password(payload.password),
        password_changed_at=datetime.now(UTC),
    )
    session.add(user)
    session.flush()
    record_audit_event(
        session,
        actor_id=user.id,
        actor_role=user.role,
        action="student_registered",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()
    return _user_summary(user)


@router.post("/login", response_model=LoginResponse)
def login(payload: CredentialsPayload, session: DbSession) -> LoginResponse:
    user = session.scalar(select(User).where(User.username == payload.username))
    now = datetime.now(UTC)
    if (
        user is None
        or not user.is_active
        or (user.locked_until is not None and user.locked_until > now)
    ):
        _record_failed_login(session, user)
        raise _invalid_credentials()
    if not verify_password(payload.password, user.password_hash):
        _record_failed_login(session, user)
        raise _invalid_credentials()
    if user.must_change_password and not _has_valid_forced_change_credential(
        session, user, payload.password, now
    ):
        _record_failed_login(session, user)
        raise _invalid_credentials()
    user.failed_login_count = 0
    user.locked_until = None
    token, principal = account_session_store.issue(user)
    record_audit_event(
        session,
        actor_id=user.id,
        actor_role=user.role,
        action="account_login",
        resource_type="session",
        resource_id=None,
    )
    session.commit()
    return LoginResponse(
        access_token=token,
        expires_in=int(SESSION_TTL.total_seconds()),
        display_name=principal.display_name,
        role=principal.role,
        must_change_password=user.must_change_password,
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordPayload, principal: CurrentPrincipal, session: DbSession
) -> None:
    _validate_new_password(payload.new_password, payload.password_confirmation)
    user = session.get(User, principal.user_id)
    if user is None or not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码不正确")
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(UTC)
    user.must_change_password = False
    user.failed_login_count = 0
    user.locked_until = None
    session.execute(
        PasswordResetToken.__table__.update()
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=datetime.now(UTC))
    )
    account_session_store.revoke_user(user.id)
    record_audit_event(
        session,
        actor_id=user.id,
        actor_role=user.role,
        action="password_changed",
        resource_type="user",
        resource_id=user.id,
    )
    session.commit()


def create_temporary_password_record(
    session: DbSession, *, user: User, created_by: User, temporary_password: str
) -> None:
    user.password_hash = hash_password(temporary_password)
    user.password_changed_at = datetime.now(UTC)
    user.must_change_password = True
    user.failed_login_count = 0
    user.locked_until = None
    session.add(
        PasswordResetToken(
            user_id=user.id,
            created_by=created_by.id,
            token_hash=hash_temporary_credential(temporary_password),
            expires_at=datetime.now(UTC) + _TEMPORARY_PASSWORD_TTL,
        )
    )
    account_session_store.revoke_user(user.id)


def _has_valid_forced_change_credential(
    session: DbSession, user: User, password: str, now: datetime
) -> bool:
    has_unused_reset = session.scalar(
        select(PasswordResetToken.id).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    if has_unused_reset is None:
        return True
    return (
        session.scalar(
            select(PasswordResetToken.id).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.token_hash == hash_temporary_credential(password),
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
        )
        is not None
    )


def _record_failed_login(session: DbSession, user: User | None) -> None:
    if user is None:
        record_audit_event(
            session,
            actor_id=None,
            actor_role=None,
            action="login_failed",
            resource_type="session",
            resource_id=None,
        )
        session.commit()
        return
    user.failed_login_count += 1
    if user.failed_login_count >= _LOCK_THRESHOLD:
        user.failed_login_count = 0
        user.locked_until = datetime.now(UTC) + _LOCK_DURATION
    record_audit_event(
        session,
        actor_id=user.id,
        actor_role=user.role,
        action="login_failed",
        resource_type="session",
        resource_id=None,
    )
    session.commit()


def _validate_new_password(password: str, confirmation: str) -> None:
    if password != confirmation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="两次输入的密码不一致")
    try:
        validate_password(password)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def _invalid_credentials() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")


def _user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        must_change_password=user.must_change_password,
    )
