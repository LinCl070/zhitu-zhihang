"""Add simulation_runs table for ABM experiment persistence.

Revision ID: 20261016_0007
Revises: 20260914_0006
Create Date: 2026-10-16 00:00:00
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261016_0007"
down_revision = "20260914_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(length=20), nullable=False),
        sa.Column("results", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("adopted_scenario", sa.String(length=40), nullable=True),
        sa.Column("adopted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_simulation_runs_created_at", "simulation_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_simulation_runs_created_at", table_name="simulation_runs")
    op.drop_table("simulation_runs")
