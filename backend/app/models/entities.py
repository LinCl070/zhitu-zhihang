"""PostgreSQL entities for the approved employment-planning data boundary."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class UserRole(StrEnum):
    STUDENT = "student"
    COUNSELOR = "counselor"
    ADMIN = "admin"


class JobStage(StrEnum):
    EXPLORING = "exploring"
    PREPARING = "preparing"
    APPLYING = "applying"


class JobStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    EXPIRED = "expired"


class PlanStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"


def enum_values(enum_class: type[StrEnum]) -> list[str]:
    """Keep ORM enum serialization aligned with the lowercase PostgreSQL enum values."""

    return [member.value for member in enum_class]


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=enum_values), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CounselorStudentAccess(Base):
    __tablename__ = "counselor_student_access"
    __table_args__ = (
        UniqueConstraint("counselor_id", "student_id", name="uq_counselor_student_access"),
        Index("ix_counselor_student_access_counselor_id", "counselor_id"),
        Index("ix_counselor_student_access_student_id", "student_id"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    counselor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CareerProfile(Base):
    __tablename__ = "career_profiles"

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    major: Mapped[str] = mapped_column(String(100), nullable=False)
    skills: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    projects: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    target_roles: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    target_cities: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    job_stage: Mapped[JobStage] = mapped_column(
        Enum(JobStage, name="job_stage", values_callable=enum_values), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class JobPosting(Base):
    __tablename__ = "job_postings"
    __table_args__ = (
        Index("ix_job_postings_status_valid_until", "status", "valid_until"),
        Index("ix_job_postings_city", "city"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    employment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    preferred_majors: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    project_signals: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    source_title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500))
    published_on: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", values_callable=enum_values), nullable=False
    )
    demo_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class MatchResult(Base):
    __tablename__ = "match_results"
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="ck_match_results_score_range"),
        Index("ix_match_results_profile_id", "profile_id"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("career_profiles.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[UUID] = mapped_column(ForeignKey("job_postings.id"), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    score_breakdown: Mapped[dict[str, int]] = mapped_column(JSONB, nullable=False)
    gaps: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ActionPlan(Base):
    __tablename__ = "action_plans"
    __table_args__ = (Index("ix_action_plans_student_id", "student_id"),)

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    match_id: Mapped[UUID] = mapped_column(ForeignKey("match_results.id"), nullable=False)
    items: Mapped[list[dict[str, str]]] = mapped_column(JSONB, nullable=False)
    status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, name="plan_status", values_callable=enum_values), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeacherAdvice(Base):
    __tablename__ = "teacher_advice"
    __table_args__ = (
        Index("ix_teacher_advice_student_id", "student_id"),
        Index("ix_teacher_advice_counselor_id", "counselor_id"),
    )

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    counselor_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action_plan_id: Mapped[UUID] = mapped_column(
        ForeignKey("action_plans.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_created_at", "created_at"),)

    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_role: Mapped[UserRole | None] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=enum_values)
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    metadata_json: Mapped[dict[str, str]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
