"""add_quiz_session_submitted_at

Adds a nullable ``submitted_at`` timestamp to ``quiz_sessions``. Until now a quiz
session was persisted at *generation* time with ``score = 0``, making a freshly
generated-but-unanswered quiz indistinguishable from one that was submitted and
genuinely scored 0. That blocked a "resume an abandoned quiz" flow and cluttered
history with phantom 0/N results.

``submitted_at`` is NULL for a generated session and set once when the user submits.
Existing rows are backfilled: any session that already has answer rows is treated as
submitted (``submitted_at = created_at``), so pre-existing graded quizzes are not
suddenly surfaced as resumable. Sessions with no answers stay NULL (resumable).

Revision ID: c1e3f5a7b9d2
Revises: b9d1f3a5c7e9
Create Date: 2026-06-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1e3f5a7b9d2"
down_revision: str | None = "b9d1f3a5c7e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "quiz_sessions",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill: mark any session that already has answer rows as submitted so it is
    # not mistaken for a resumable (abandoned) session after this migration.
    op.execute(
        """
        UPDATE quiz_sessions qs
        SET submitted_at = qs.created_at
        WHERE EXISTS (
            SELECT 1 FROM quiz_answers qa WHERE qa.session_id = qs.id
        )
        """
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("quiz_sessions", "submitted_at")
