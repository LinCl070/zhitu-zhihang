"""Add minimal counselor advice records.

Revision ID: 20260723_0003
Revises: 20260721_0002
Create Date: 2026-07-23 22:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260723_0003"
down_revision = "20260721_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teacher_advice",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("counselor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["counselor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["action_plan_id"], ["action_plans.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_teacher_advice_student_id", "teacher_advice", ["student_id"])
    op.create_index("ix_teacher_advice_counselor_id", "teacher_advice", ["counselor_id"])


def downgrade() -> None:
    op.drop_index("ix_teacher_advice_counselor_id", table_name="teacher_advice")
    op.drop_index("ix_teacher_advice_student_id", table_name="teacher_advice")
    op.drop_table("teacher_advice")
