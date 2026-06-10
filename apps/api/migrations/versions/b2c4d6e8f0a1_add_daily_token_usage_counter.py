"""add_daily_token_usage_counter

Adds the ``daily_token_usage`` atomic per-user/per-day quota counter table.
This complements (does not replace) the append-only ``token_usage`` log: the new
table holds a single mutable running total per user per day so quota checks can
reserve tokens atomically before an LLM call and reconcile afterwards, closing
the concurrent-burst race in the old SUM-based check.

Revision ID: b2c4d6e8f0a1
Revises: 372dee4b2ff1
Create Date: 2026-06-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c4d6e8f0a1"
down_revision: str | None = "372dee4b2ff1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        "daily_token_usage",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("reserved_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_daily_token_usage_day"),
    )
    op.create_index(
        op.f("ix_daily_token_usage_user_id"),
        "daily_token_usage",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_daily_token_usage_user_id"), table_name="daily_token_usage")
    op.drop_table("daily_token_usage")
