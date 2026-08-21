"""Demonstration-only authentication and authorization endpoints."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.demo import (
    SessionPrincipal,
    create_demo_session,
    get_current_principal,
    require_roles,
)
from app.db.session import get_db_session
from app.models.entities import AuditEvent, CounselorStudentAccess, User, UserRole
from app.services.audit import record_audit_event
from app.services.authorization import get_readable_career_profile

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])
DbSession = Annotated[Session, Depends(get_db_session)]
CurrentPrincipal = Annotated[SessionPrincipal, Depends(get_current_principal)]
AdminPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.ADMIN))]


class DemoLoginRequest(BaseModel):
    identity: Literal["student-a", "student-b", "counselor", "admin"]


class DemoSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    display_name: str
    role: UserRole


class DemoUserResponse(BaseModel):
    id: UUID
    display_name: str
    role: UserRole


class CareerProfileResponse(BaseModel):
    id: UUID
    student_id: UUID
    major: str
    skills: list[str]
    projects: list[str]
    target_roles: list[str]
    target_cities: list[str]
    job_stage: str


class AuditEventResponse(BaseModel):
    id: UUID
    actor_role: UserRole | None
    action: str
    resource_type: str
    resource_id: UUID | None
    created_at: datetime


@router.post("/sessions", response_model=DemoSessionResponse, status_code=status.HTTP_201_CREATED)
def start_demo_session(payload: DemoLoginRequest, session: DbSession) -> DemoSessionResponse:
    token, principal = create_demo_session(session, payload.identity)
    return DemoSessionResponse(
        access_token=token,
        expires_at=principal.expires_at,
        display_name=principal.display_name,
        role=principal.role,
    )


@router.get("/me", response_model=DemoUserResponse)
def read_current_user(principal: CurrentPrincipal) -> DemoUserResponse:
    return DemoUserResponse(
        id=principal.user_id,
        display_name=principal.display_name,
        role=principal.role,
    )


@router.get("/career-profiles/{profile_id}", response_model=CareerProfileResponse)
def read_career_profile(
    profile_id: UUID,
    principal: CurrentPrincipal,
    session: DbSession,
) -> CareerProfileResponse:
    profile = get_readable_career_profile(session, principal, profile_id)
    return CareerProfileResponse(
        id=profile.id,
        student_id=profile.student_id,
        major=profile.major,
        skills=profile.skills,
        projects=profile.projects,
        target_roles=profile.target_roles,
        target_cities=profile.target_cities,
        job_stage=profile.job_stage.value,
    )


@router.post("/counselor-access/{student_id}", status_code=status.HTTP_201_CREATED)
def grant_counselor_access(
    student_id: UUID,
    counselor_id: UUID,
    principal: AdminPrincipal,
    session: DbSession,
) -> dict[str, str]:
    student = session.get(User, student_id)
    counselor = session.get(User, counselor_id)
    if student is None or student.role is not UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if counselor is None or counselor.role is not UserRole.COUNSELOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Counselor not found")

    existing = session.scalar(
        select(CounselorStudentAccess.id).where(
            CounselorStudentAccess.counselor_id == counselor_id,
            CounselorStudentAccess.student_id == student_id,
        )
    )
    if existing is None:
        session.add(CounselorStudentAccess(counselor_id=counselor_id, student_id=student_id))
        record_audit_event(
            session,
            actor_id=principal.user_id,
            actor_role=principal.role,
            action="counselor_access_granted",
            resource_type="student_access",
            resource_id=student_id,
        )
        session.commit()
    return {"status": "granted"}


@router.get("/audit-events", response_model=list[AuditEventResponse])
def read_audit_events(
    _: AdminPrincipal,
    session: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[AuditEventResponse]:
    events = session.scalars(
        select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    ).all()
    return [
        AuditEventResponse(
            id=event.id,
            actor_role=event.actor_role,
            action=event.action,
            resource_type=event.resource_type,
            resource_id=event.resource_id,
            created_at=event.created_at,
        )
        for event in events
    ]
