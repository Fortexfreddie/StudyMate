"""SQLAlchemy 2.0 models and async database engine.

All relational data lives here — users, documents, chat history, quiz sessions.
Vector embeddings are stored in Qdrant (not here).

``doc_id`` (UUID) is the shared key between PostgreSQL and Qdrant.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from core.config import settings

# Base class


class Base(DeclarativeBase):
    """Base class for all ORM models."""


# Models


class User(Base):
    """Registered user account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Study major / institution — editable via PATCH /auth/me. Nullable: not
    # collected at signup, so existing accounts have no value until they set one.
    major: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Pro tier flag — False = free (50k tokens/day), True = pro (500k tokens/day).
    # Flip manually or wire to a payment system later.
    is_pro: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    # Access role — "user" (default), "admin", or "super_admin". Drives the admin
    # panel gates. There is at most one super_admin (the SUPER_ADMIN_EMAIL account).
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="user"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Most recent successful login. NULL for accounts created before login tracking
    # and for users who have never logged in since it was added.
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # passive_deletes=True lets the database's ON DELETE CASCADE remove children
    # instead of SQLAlchemy eagerly NULL-ing their FKs in Python. Without it,
    # `db.delete(user)` tries to UPDATE these children's non-nullable user_id to
    # NULL and raises an IntegrityError — which is exactly what broke admin user
    # deletion. The FK columns already declare ondelete="CASCADE".
    documents: Mapped[list["Document"]] = relationship(
        back_populates="owner", passive_deletes=True
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="user", passive_deletes=True
    )
    quiz_sessions: Mapped[list["QuizSession"]] = relationship(
        back_populates="user", passive_deletes=True
    )
    activity: Mapped[list["UserActivity"]] = relationship(
        back_populates="user", passive_deletes=True
    )
    token_usage: Mapped[list["TokenUsage"]] = relationship(
        back_populates="user", passive_deletes=True
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", passive_deletes=True
    )
    summaries: Mapped[list["SummaryHistory"]] = relationship(
        back_populates="user", passive_deletes=True
    )

    @property
    def is_admin_or_super(self) -> bool:
        """True for any account that can access the admin panel."""
        return self.role in ("admin", "super_admin")

    @property
    def effective_is_pro(self) -> bool:
        """Tier used for token quotas — admins always get pro limits."""
        return self.is_pro or self.is_admin_or_super


class Document(Base):
    """Uploaded PDF document metadata.

    The ``id`` is NOT auto-generated — it receives the same UUID that was
    created during PDF processing and used as the Qdrant filter key.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # page_count / chunk_count are NULL while a document is still "processing" —
    # they're only known once the background embedding task finishes parsing.
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Ingestion lifecycle. A document is created "processing", flips to "ready"
    # once chunks are embedded + indexed, or "failed" if ingestion errored. The
    # frontend polls this so the upload request never has to stay open for the
    # full (potentially multi-minute) embedding run — which is what was tripping
    # the platform's request timeout and leaving the UI spinning forever.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="ready", index=True
    )
    # Human-readable reason when status == "failed" (NULL otherwise).
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="documents")


class ChatMessage(Base):
    """Persisted chat interaction — one query/answer pair."""

    __tablename__ = "chat_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    context_sufficient: Mapped[bool] = mapped_column(Boolean, default=True)
    sources: Mapped[list[dict[str, object]] | None] = mapped_column(
        JSONB, nullable=True
    )
    performance_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="high"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="chat_messages")


class QuizSession(Base):
    """A quiz generation session — holds questions and tracks score."""

    __tablename__ = "quiz_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    questions: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="quiz_sessions")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="session", passive_deletes=True
    )


class QuizAnswer(Base):
    """Individual answer within a quiz session."""

    __tablename__ = "quiz_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_index: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped["QuizSession"] = relationship(back_populates="answers")


class UserActivity(Base):
    """One row per user per calendar day on which they performed any study action.

    Used to compute the study streak. A row is written (idempotently) whenever the
    user uploads a document, chats, generates a summary, or submits a quiz. The
    unique (user_id, activity_date) constraint guarantees at most one row per day,
    so repeated actions on the same day collapse to a single record.
    """

    __tablename__ = "user_activity"
    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_user_activity_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="activity")


class TokenUsage(Base):
    """Per-request token usage log for billing and rate limiting.

    Each LLM call (chat, summary, quiz) writes a row with the input/output
    token counts returned by Gemini's usage_metadata. The daily aggregate
    is checked before each request to enforce free/pro tier limits.
    """

    __tablename__ = "token_usage"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    request_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "chat" | "summary" | "quiz"
    performance_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="high"
    )
    # Wall-clock time (ms) spent inside the generator for this request — the perf
    # signal admins care about. NULL for legacy rows written before this existed.
    generation_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Number of retrieval chunks fed to the model as context (NULL for legacy/quiz
    # paths that don't pass it through).
    chunks_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Input tokens Gemini billed at the cached rate (usage_metadata cache_read).
    # Often 0 since we don't configure explicit context caching, but captured for
    # visibility. NULL for legacy rows.
    cached_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(back_populates="token_usage")


class DailyTokenUsage(Base):
    """Atomic per-user, per-day token counter used to enforce daily quotas.

    Unlike ``token_usage`` (an append-only per-request *log*), this table holds a
    single mutable running total per ``(user_id, usage_date)``. Quota enforcement
    increments ``reserved_tokens`` atomically *before* an LLM call (via
    ``INSERT ... ON CONFLICT DO UPDATE ... RETURNING``) so concurrent requests can
    never collectively overshoot the limit, and reconciles it to the actual token
    count *after* the call. See ``services/token_service.py``.
    """

    __tablename__ = "daily_token_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_daily_token_usage_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Running total of tokens reserved/consumed today. Reservations bump this up
    # front; reconciliation adjusts it by (actual - estimate); failures release it.
    reserved_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DailyPageUsage(Base):
    """Atomic per-user, per-day **page** counter used to enforce upload quotas.

    The document-upload analogue of ``DailyTokenUsage``: a single mutable running
    total of PDF pages a user has uploaded today, per ``(user_id, usage_date)``.
    Uploads consume the embedding model — a different Google quota than the
    generation tokens tracked by ``DailyTokenUsage`` — so the two are counted
    separately. Enforcement reserves the page count atomically *before* scheduling
    ingestion (via ``INSERT ... ON CONFLICT DO UPDATE ... RETURNING``) so concurrent
    uploads can never collectively overshoot the limit, then reconciles to the real
    extractable page count after parsing (or releases the hold on failure). See
    ``services/page_quota_service.py``.
    """

    __tablename__ = "daily_page_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_daily_page_usage_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Running total of pages reserved/uploaded today. Reservations bump this up
    # front; reconciliation adjusts it by (actual - estimate); failures release it.
    reserved_pages: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RefreshToken(Base):
    """Stores hashed active refresh tokens to enforce rotation & revoking."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class SummaryHistory(Base):
    """Dedicated table for persisted summaries history."""

    __tablename__ = "summary_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(String(50), nullable=False)
    structured: Mapped[dict[str, object] | list[object] | None] = mapped_column(
        JSONB, nullable=True
    )
    context_sufficient: Mapped[bool] = mapped_column(Boolean, default=True)
    sources: Mapped[list[dict[str, object]] | None] = mapped_column(
        JSONB, nullable=True
    )
    performance_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="high"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(back_populates="summaries")


# Async engine & session

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async database session per request."""
    async with async_session() as session:
        yield session
