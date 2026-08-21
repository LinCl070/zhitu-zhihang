"""Role and resource ownership checks shared by protected API endpoints."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.demo import SessionPrincipal
from app.models.entities import CareerProfile, CounselorStudentAccess, UserRole
from app.services.audit import record_audit_event


def require_student_ownership(
    session: Session,
    principal: SessionPrincipal,
    student_id: UUID,
    resource_type: str,
    resource_id: UUID,
) -> None:
    if principal.role is UserRole.STUDENT and principal.user_id == student_id:
        return
    _record_denial(session, principal, resource_type, resource_id)


def get_readable_career_profile(
    session: Session, principal: SessionPrincipal, profile_id: UUID
) -> CareerProfile:
    profile = session.get(CareerProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Career profile not found",
        )

    if principal.role is UserRole.STUDENT and principal.user_id == profile.student_id:
        return profile
    if principal.role is UserRole.COUNSELOR and _has_counselor_access(
        session, principal.user_id, profile.student_id
    ):
        return profile

    _record_denial(session, principal, "career_profile", profile.id)
    raise AssertionError("_record_denial always raises")


def _has_counselor_access(session: Session, counselor_id: UUID, student_id: UUID) -> bool:
    statement = select(CounselorStudentAccess.id).where(
        CounselorStudentAccess.counselor_id == counselor_id,
        CounselorStudentAccess.student_id == student_id,
    )
    return session.scalar(statement) is not None


def _record_denial(
    session: Session, principal: SessionPrincipal, resource_type: str, resource_id: UUID
) -> None:
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="access_denied",
        resource_type=resource_type,
        resource_id=resource_id,
    )
    session.commit()
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
