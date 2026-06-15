"""add_suspension_presence_activity_events

Adds the backend support for the admin engagement features:

* ``users.is_suspended`` / ``users.suspended_at`` — soft account suspension,
  enforced at the auth layer (login + every authenticated request).
* ``users.last_seen_at`` — presence heartbeat used for "online" detection; written
  (throttled) by ``get_current_user``.
* ``activity_events`` — append-only per-action event stream powering the live
  activity feed and most-active rankings. Distinct from ``user_activity`` (one row
  per user per day, used for streaks). Starts empty and fills going forward — no
  backfill.

Revision ID: b3d5f7a9c1e3
Revises: a1c3e5f7b9d1
Create Date: 2026-06-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3d5f7a9c1e3"
down_revision: str | None = "a1c3e5f7b9d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "users",
        sa.Column(
            "is_suspended",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "activity_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("doc_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["doc_id"], ["documents.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_activity_events_user_id"),
        "activity_events",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_activity_events_doc_id"),
        "activity_events",
        ["doc_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_activity_events_created_at"),
        "activity_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(
        op.f("ix_activity_events_created_at"), table_name="activity_events"
    )
    op.drop_index(op.f("ix_activity_events_doc_id"), table_name="activity_events")
    op.drop_index(op.f("ix_activity_events_user_id"), table_name="activity_events")
    op.drop_table("activity_events")

    op.drop_column("users", "last_seen_at")
    op.drop_column("users", "suspended_at")
    op.drop_column("users", "is_suspended")
