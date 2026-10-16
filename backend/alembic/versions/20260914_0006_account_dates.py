"""Add precise enrollment and employment dates to user profiles.

Revision ID: 20260914_0006
Revises: 20260909_0005
Create Date: 2026-09-14 00:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20260914_0006"
down_revision = "20260909_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("enrollment_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("employment_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "employment_date")
    op.drop_column("users", "enrollment_date")
