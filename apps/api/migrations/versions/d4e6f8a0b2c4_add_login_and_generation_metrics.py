"""add_login_and_generation_metrics

Phase 4 admin analytics. Adds:
  * ``users.last_login_at`` — most recent successful login (NULL for never/legacy).
  * ``token_usage.generation_ms`` — wall-clock generation time per request (ms).
  * ``token_usage.chunks_used`` — retrieval chunks fed to the model.
  * ``token_usage.cached_tokens`` — input tokens billed at the cached rate.

All nullable; existing rows backfill to NULL (no value was recorded for them).

Revision ID: d4e6f8a0b2c4
Revises: c3d5e7f9a1b3
Create Date: 2026-06-14 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e6f8a0b2c4"
down_revision: str | None = "c3d5e7f9a1b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "token_usage",
        sa.Column("generation_ms", sa.Integer(), nullable=True),
    )
    op.add_column(
        "token_usage",
        sa.Column("chunks_used", sa.Integer(), nullable=True),
    )
    op.add_column(
        "token_usage",
        sa.Column("cached_tokens", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("token_usage", "cached_tokens")
    op.drop_column("token_usage", "chunks_used")
    op.drop_column("token_usage", "generation_ms")
    op.drop_column("users", "last_login_at")
