"""Role-scoped teacher assistance and administrator governance routes."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.demo import DbSession, SessionPrincipal, require_roles
from app.models.entities import (
    ActionPlan,
    AuditEvent,
    CareerProfile,
    CounselorStudentAccess,
    JobPosting,
    TeacherAdvice,
    User,
    UserRole,
)
from app.services.audit import record_audit_event
from app.services.governance import read_source_registry

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])
CounselorPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.COUNSELOR))]
AdminPrincipal = Annotated[SessionPrincipal, Depends(require_roles(UserRole.ADMIN))]


class PlanSummary(BaseModel):
    id: UUID
    status: str
    created_at: datetime


class AdviceSummary(BaseModel):
    id: UUID
    action_plan_id: UUID
    content: str
    created_at: datetime


class CounselorStudentSummary(BaseModel):
    student_id: UUID
    display_name: str
    major: str
    target_roles: list[str]
    target_cities: list[str]
    job_stage: str
    plans: list[PlanSummary]
    advice: list[AdviceSummary]


class AdvicePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    action_plan_id: UUID
    content: str = Field(min_length=1, max_length=500)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Advice must contain visible text")
        return normalized


class AdviceResponse(BaseModel):
    id: UUID
    student_id: UUID
    action_plan_id: UUID
    content: str
    created_at: datetime


class JobGovernanceRow(BaseModel):
    id: UUID
    title: str
    city: str
    published_on: str
    valid_until: str
    status: str
    source_title: str
    demo_only: bool


class AuditSummary(BaseModel):
    id: UUID
    actor_role: str | None
    action: str
    resource_type: str
    resource_id: UUID | None
    created_at: datetime


class DemoUserSummary(BaseModel):
    id: UUID
    display_name: str
    role: str


class AdminOverview(BaseModel):
    jobs: list[JobGovernanceRow]
    sources: list[dict[str, str]]
    audits: list[AuditSummary]
    students: list[DemoUserSummary]
    counselors: list[DemoUserSummary]


class GrantAccessPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    counselor_id: UUID
    student_id: UUID


@router.get("/counselor/students", response_model=list[CounselorStudentSummary])
def read_counselor_students(
    principal: CounselorPrincipal, session: DbSession
) -> list[CounselorStudentSummary]:
    student_ids = session.scalars(
        select(CounselorStudentAccess.student_id).where(
            CounselorStudentAccess.counselor_id == principal.user_id
        )
    ).all()
    if not student_ids:
        return []
    profiles = session.scalars(
        select(CareerProfile).where(CareerProfile.student_id.in_(student_ids))
    ).all()
    users = {
        user.id: user
        for user in session.scalars(select(User).where(User.id.in_(student_ids))).all()
    }
    result: list[CounselorStudentSummary] = []
    for profile in profiles:
        plans = session.scalars(
            select(ActionPlan)
            .where(ActionPlan.student_id == profile.student_id)
            .order_by(ActionPlan.created_at.desc())
        ).all()
        advice = session.scalars(
            select(TeacherAdvice)
            .where(
                TeacherAdvice.student_id == profile.student_id,
                TeacherAdvice.counselor_id == principal.user_id,
            )
            .order_by(TeacherAdvice.created_at.desc())
        ).all()
        user = users[profile.student_id]
        result.append(
            CounselorStudentSummary(
                student_id=profile.student_id,
                display_name=user.display_name,
                major=profile.major,
                target_roles=profile.target_roles,
                target_cities=profile.target_cities,
                job_stage=profile.job_stage.value,
                plans=[
                    PlanSummary(id=plan.id, status=plan.status.value, created_at=plan.created_at)
                    for plan in plans
                ],
                advice=[
                    AdviceSummary(
                        id=item.id,
                        action_plan_id=item.action_plan_id,
                        content=item.content,
                        created_at=item.created_at,
                    )
                    for item in advice
                ],
            )
        )
    return result


@router.post(
    "/counselor/advice",
    response_model=AdviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_advice(
    payload: AdvicePayload, principal: CounselorPrincipal, session: DbSession
) -> AdviceResponse:
    _require_counselor_access(session, principal.user_id, payload.student_id)
    plan = session.get(ActionPlan, payload.action_plan_id)
    if plan is None or plan.student_id != payload.student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action plan not found")
    advice = TeacherAdvice(
        counselor_id=principal.user_id,
        student_id=payload.student_id,
        action_plan_id=plan.id,
        content=payload.content,
    )
    session.add(advice)
    session.flush()
    record_audit_event(
        session,
        actor_id=principal.user_id,
        actor_role=principal.role,
        action="teacher_advice_created",
        resource_type="teacher_advice",
        resource_id=advice.id,
    )
    session.commit()
    return AdviceResponse(
        id=advice.id,
        student_id=advice.student_id,
        action_plan_id=advice.action_plan_id,
        content=advice.content,
        created_at=advice.created_at,
    )


@router.get("/admin/overview", response_model=AdminOverview)
def read_admin_overview(_: AdminPrincipal, session: DbSession) -> AdminOverview:
    jobs = session.scalars(
        select(JobPosting).order_by(JobPosting.valid_until, JobPosting.title)
    ).all()
    audits = session.scalars(
        select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(50)
    ).all()
    users = session.scalars(select(User).order_by(User.display_name)).all()
    return AdminOverview(
        jobs=[
            JobGovernanceRow(
                id=job.id,
                title=job.title,
                city=job.city,
                published_on=job.published_on.isoformat(),
                valid_until=job.valid_until.isoformat(),
                status=job.status.value,
                source_title=job.source_title,
                demo_only=job.demo_only,
            )
            for job in jobs
        ],
        sources=read_source_registry(),
        audits=[
            AuditSummary(
                id=event.id,
                actor_role=event.actor_role.value if event.actor_role else None,
                action=event.action,
                resource_type=event.resource_type,
                resource_id=event.resource_id,
                created_at=event.created_at,
            )
            for event in audits
        ],
        students=[_user_summary(user) for user in users if user.role is UserRole.STUDENT],
        counselors=[_user_summary(user) for user in users if user.role is UserRole.COUNSELOR],
    )


@router.post("/admin/counselor-access", status_code=status.HTTP_201_CREATED)
def grant_counselor_access(
    payload: GrantAccessPayload, principal: AdminPrincipal, session: DbSession
) -> dict[str, str]:
    student = session.get(User, payload.student_id)
    counselor = session.get(User, payload.counselor_id)
    if student is None or student.role is not UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if counselor is None or counselor.role is not UserRole.COUNSELOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Counselor not found")
    existing = session.scalar(
        select(CounselorStudentAccess.id).where(
            CounselorStudentAccess.counselor_id == payload.counselor_id,
            CounselorStudentAccess.student_id == payload.student_id,
        )
    )
    if existing is None:
        session.add(
            CounselorStudentAccess(
                counselor_id=payload.counselor_id,
                student_id=payload.student_id,
            )
        )
        record_audit_event(
            session,
            actor_id=principal.user_id,
            actor_role=principal.role,
            action="counselor_access_granted",
            resource_type="student_access",
            resource_id=payload.student_id,
        )
        session.commit()
    return {"status": "granted"}


def _require_counselor_access(session: Session, counselor_id: UUID, student_id: UUID) -> None:
    access = session.scalar(
        select(CounselorStudentAccess.id).where(
            CounselorStudentAccess.counselor_id == counselor_id,
            CounselorStudentAccess.student_id == student_id,
        )
    )
    if access is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access is not granted",
        )


def _user_summary(user: User) -> DemoUserSummary:
    return DemoUserSummary(id=user.id, display_name=user.display_name, role=user.role.value)
