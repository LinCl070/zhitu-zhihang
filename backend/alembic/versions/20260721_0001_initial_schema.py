"""Create the initial PostgreSQL schema for 职途智航.

Revision ID: 20260721_0001
Revises:
Create Date: 2026-07-21 00:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260721_0001"
down_revision = None
branch_labels = None
depends_on = None

user_role = postgresql.ENUM("student", "counselor", "admin", name="user_role", create_type=False)
job_stage = postgresql.ENUM(
    "exploring", "preparing", "applying", name="job_stage", create_type=False
)
job_status = postgresql.ENUM("draft", "published", "expired", name="job_status", create_type=False)
plan_status = postgresql.ENUM("active", "completed", name="plan_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (user_role, job_stage, job_status, plan_status):
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_table(
        "career_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("major", sa.String(length=100), nullable=False),
        sa.Column("skills", postgresql.JSONB(), nullable=False),
        sa.Column("projects", postgresql.JSONB(), nullable=False),
        sa.Column("target_roles", postgresql.JSONB(), nullable=False),
        sa.Column("target_cities", postgresql.JSONB(), nullable=False),
        sa.Column("job_stage", job_stage, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "job_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("employment_type", sa.String(length=50), nullable=False),
        sa.Column("required_skills", postgresql.JSONB(), nullable=False),
        sa.Column("preferred_majors", postgresql.JSONB(), nullable=False),
        sa.Column("project_signals", postgresql.JSONB(), nullable=False),
        sa.Column("source_title", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=500)),
        sa.Column("published_on", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("status", job_status, nullable=False),
        sa.Column("demo_only", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_job_postings_status_valid_until", "job_postings", ["status", "valid_until"])
    op.create_index("ix_job_postings_city", "job_postings", ["city"])
    op.create_table(
        "match_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("score_breakdown", postgresql.JSONB(), nullable=False),
        sa.Column("gaps", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("score >= 0 AND score <= 100", name="ck_match_results_score_range"),
        sa.ForeignKeyConstraint(["profile_id"], ["career_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["job_postings.id"]),
    )
    op.create_index("ix_match_results_profile_id", "match_results", ["profile_id"])
    op.create_table(
        "action_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("items", postgresql.JSONB(), nullable=False),
        sa.Column("status", plan_status, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["match_results.id"]),
    )
    op.create_index("ix_action_plans_student_id", "action_plans", ["student_id"])
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("actor_role", user_role),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=100), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True)),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_action_plans_student_id", table_name="action_plans")
    op.drop_table("action_plans")
    op.drop_index("ix_match_results_profile_id", table_name="match_results")
    op.drop_table("match_results")
    op.drop_index("ix_job_postings_city", table_name="job_postings")
    op.drop_index("ix_job_postings_status_valid_until", table_name="job_postings")
    op.drop_table("job_postings")
    op.drop_table("career_profiles")
    op.drop_table("users")

    bind = op.get_bind()
    for enum_type in (plan_status, job_status, job_stage, user_role):
        enum_type.drop(bind, checkfirst=True)
