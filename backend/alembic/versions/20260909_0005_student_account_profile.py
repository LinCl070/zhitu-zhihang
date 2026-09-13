"""Add required profile fields for newly registered students.

Revision ID: 20260909_0005
Revises: 20260909_0004
Create Date: 2026-09-09 00:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20260909_0005"
down_revision = "20260909_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("student_number", sa.String(length=10), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=254), nullable=True))
    op.add_column("users", sa.Column("enrollment_year", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_users_student_number", "users", ["student_number"])
    op.create_check_constraint(
        "ck_users_student_number_format",
        "users",
        "student_number IS NULL OR student_number ~ '^[0-9]{10}$'",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_student_number_format", "users", type_="check")
    op.drop_constraint("uq_users_student_number", "users", type_="unique")
    op.drop_column("users", "enrollment_year")
    op.drop_column("users", "email")
    op.drop_column("users", "phone")
    op.drop_column("users", "student_number")
