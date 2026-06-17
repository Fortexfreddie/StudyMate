"""add_quiz_session_sources

Adds a nullable ``sources`` JSONB column to ``quiz_sessions``. Quiz generation
retrieves grounding chunks and returns them as citations, but until now they were
never persisted — so a quiz reopened from history showed no sources, unlike summaries
and chat. This stores the same source blob shape used by ``chat_history.sources`` and
``summaries.sources``. Older rows predate the column and remain NULL (rendered as no
citations).

Revision ID: b9d1f3a5c7e9
Revises: b3d5f7a9c1e3
Create Date: 2026-06-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b9d1f3a5c7e9"
down_revision: str | None = "b3d5f7a9c1e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "quiz_sessions",
        sa.Column("sources", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("quiz_sessions", "sources")
