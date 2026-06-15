"""normalize_user_emails_lowercase

Backfill existing ``users.email`` values to lower-case so they match the new
schema-level normalization (signup/login now lower-case + trim email before
querying). Without this, any account created before the fix with a mixed-case
email would no longer match its (now-lowercased) login input and the user would
be locked out.

The ``users.email`` column is a plain case-sensitive ``String`` with a UNIQUE
constraint, so two pre-existing rows could differ only by case (e.g.
``John@x.com`` and ``john@x.com``). Lowercasing both would violate the UNIQUE
constraint. Rather than silently merging/dropping an account, this migration
**aborts with a clear error** listing the colliding addresses so they can be
resolved manually before re-running.

Revision ID: f7a9c1d3b5e7
Revises: e5f7a9c1d3b5
Create Date: 2026-06-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7a9c1d3b5e7"
down_revision: str | None = "e5f7a9c1d3b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    bind = op.get_bind()

    # 1. Detect case-insensitive duplicate emails BEFORE mutating anything. If two
    #    rows would collapse to the same lower-cased address, lowercasing would
    #    break the UNIQUE constraint — abort with the offending addresses so they
    #    can be merged/renamed by hand first.
    collisions = bind.execute(
        sa.text(
            """
            SELECT lower(trim(email)) AS norm, count(*) AS n
            FROM users
            GROUP BY lower(trim(email))
            HAVING count(*) > 1
            """
        )
    ).fetchall()
    if collisions:
        offending = ", ".join(f"{row.norm} (x{row.n})" for row in collisions)
        raise RuntimeError(
            "Cannot normalize emails: case-insensitive duplicate accounts exist "
            f"and must be resolved manually first → {offending}"
        )

    # 2. Safe to backfill — lower-case + trim every stored email.
    op.execute("UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email))")


def downgrade() -> None:
    """Downgrade database schema.

    Lower-casing is irreversible (the original casing isn't stored anywhere), so
    this is intentionally a no-op rather than a fake restore.
    """
    pass
