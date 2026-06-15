"""add_document_ingestion_status

Asynchronous upload pipeline. Adds:
  * ``documents.status`` — ingestion lifecycle: "processing" | "ready" | "failed".
  * ``documents.error_message`` — human-readable failure reason (NULL otherwise).

Also makes ``documents.page_count`` / ``documents.chunk_count`` nullable, since
they are unknown while a freshly-uploaded document is still being parsed/embedded
in the background.

Existing rows are all fully-processed documents, so ``status`` backfills to
"ready" via the server default (new rows are created "processing" by the app).

Revision ID: e5f7a9c1d3b5
Revises: d4e6f8a0b2c4
Create Date: 2026-06-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f7a9c1d3b5"
down_revision: str | None = "d4e6f8a0b2c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade database schema."""
    op.add_column(
        "documents",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="ready",
        ),
    )
    op.add_column(
        "documents",
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index(
        op.f("ix_documents_status"), "documents", ["status"], unique=False
    )
    # page_count / chunk_count are unknown until background processing completes.
    op.alter_column("documents", "page_count", existing_type=sa.Integer(), nullable=True)
    op.alter_column("documents", "chunk_count", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    """Downgrade database schema."""
    # Backfill any NULLs so the columns can return to NOT NULL.
    op.execute("UPDATE documents SET page_count = 0 WHERE page_count IS NULL")
    op.execute("UPDATE documents SET chunk_count = 0 WHERE chunk_count IS NULL")
    op.alter_column(
        "documents", "chunk_count", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "documents", "page_count", existing_type=sa.Integer(), nullable=False
    )
    op.drop_index(op.f("ix_documents_status"), table_name="documents")
    op.drop_column("documents", "error_message")
    op.drop_column("documents", "status")
