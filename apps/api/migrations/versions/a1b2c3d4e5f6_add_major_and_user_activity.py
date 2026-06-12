"""Add User.major column and user_activity table

Adds:
- ``users.major`` (nullable) — study major / institution, editable via PATCH /auth/me
- ``user_activity`` table — one row per user per day, used to compute study streaks

Revision ID: a1b2c3d4e5f6
Revises: 6081ef6675da
Create Date: 2026-05-31 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "6081ef6675da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    # 1. New editable profile column (nullable — existing rows get NULL)
    op.add_column(
        "users",
        sa.Column("major", sa.String(length=255), nullable=True),
    )

    # 2. Activity log for streak computation — one row per user per calendar day
    op.create_table(
        "user_activity",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "activity_date", name="uq_user_activity_day"),
    )
    # Index to make per-user streak scans fast (ordered by date)
    op.create_index(
        "ix_user_activity_user_date",
        "user_activity",
        ["user_id", "activity_date"],
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index("ix_user_activity_user_date", table_name="user_activity")
    op.drop_table("user_activity")
    op.drop_column("users", "major")
