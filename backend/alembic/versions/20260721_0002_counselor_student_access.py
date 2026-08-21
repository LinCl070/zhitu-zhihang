"""Add counselor-to-student authorization records.

Revision ID: 20260721_0002
Revises: 20260721_0001
Create Date: 2026-07-21 00:30:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260721_0002"
down_revision = "20260721_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "counselor_student_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("counselor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["counselor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("counselor_id", "student_id", name="uq_counselor_student_access"),
    )
    op.create_index(
        "ix_counselor_student_access_counselor_id",
        "counselor_student_access",
        ["counselor_id"],
    )
    op.create_index(
        "ix_counselor_student_access_student_id",
        "counselor_student_access",
        ["student_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_counselor_student_access_student_id", table_name="counselor_student_access")
    op.drop_index("ix_counselor_student_access_counselor_id", table_name="counselor_student_access")
    op.drop_table("counselor_student_access")
