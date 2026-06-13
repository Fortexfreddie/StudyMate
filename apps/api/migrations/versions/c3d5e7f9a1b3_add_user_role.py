"""add_user_role

Adds the ``role`` column to ``users`` — one of "user" (default), "admin", or
"super_admin". Drives the admin-panel access gates. Existing rows backfill to
"user" via the server default.

Revision ID: c3d5e7f9a1b3
Revises: b2c4d6e8f0a1
Create Date: 2026-06-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d5e7f9a1b3"
down_revision: str | None = "b2c4d6e8f0a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "users",
        sa.Column(
            "role", sa.String(length=20), server_default="user", nullable=False
        ),
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_column("users", "role")
