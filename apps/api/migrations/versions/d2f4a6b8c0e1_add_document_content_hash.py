"""add_document_content_hash

Adds a nullable ``content_hash`` column (SHA-256 hex digest of the uploaded PDF
bytes) to ``documents``, plus a composite index on ``(user_id, content_hash)``.

This powers per-user upload deduplication: when a user re-uploads byte-identical
content (e.g. accidentally, or from a second browser tab while the first upload is
still processing), the existing document is returned instead of re-parsing and
re-embedding it — which previously double-charged the daily page quota and burned
embedding quota twice, and left two duplicate rows in the user's document list.

Existing rows predate the column and remain NULL; a NULL hash never matches, so old
documents are simply treated as unique (no backfill needed — we can't recompute a
hash without the original bytes, which are not stored).

Revision ID: d2f4a6b8c0e1
Revises: c1e3f5a7b9d2
Create Date: 2026-06-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2f4a6b8c0e1"
down_revision: str | None = "c1e3f5a7b9d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "documents",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_documents_user_content_hash",
        "documents",
        ["user_id", "content_hash"],
    )


def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index("ix_documents_user_content_hash", table_name="documents")
    op.drop_column("documents", "content_hash")
