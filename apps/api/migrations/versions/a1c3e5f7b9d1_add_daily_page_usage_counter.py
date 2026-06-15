"""add_daily_page_usage_counter

Adds the ``daily_page_usage`` atomic per-user/per-day **page** quota counter.
Document uploads consume the embedding model, whose Google-side quota
(requests/day + tokens/minute) is separate from the generation tokens tracked by
``daily_token_usage``. This table meters upload cost in pages so the two quotas
stay independent. Same atomic reserve/reconcile/release design as
``daily_token_usage`` — see ``services/page_quota_service.py``.

Revision ID: a1c3e5f7b9d1
Revises: f7a9c1d3b5e7
Create Date: 2026-06-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c3e5f7b9d1"
down_revision: str | None = "f7a9c1d3b5e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        "daily_page_usage",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("reserved_pages", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_daily_page_usage_day"),
    )
    op.create_index(
        op.f("ix_daily_page_usage_user_id"),
        "daily_page_usage",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f("ix_daily_page_usage_user_id"), table_name="daily_page_usage")
    op.drop_table("daily_page_usage")
