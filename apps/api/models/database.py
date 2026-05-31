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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="owner")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user")
    quiz_sessions: Mapped[list["QuizSession"]] = relationship(back_populates="user")
    activity: Mapped[list["UserActivity"]] = relationship(back_populates="user")
    token_usage: Mapped[list["TokenUsage"]] = relationship(back_populates="user")


class Document(Base):
    """Uploaded PDF document metadata.

    The ``id`` is NOT auto-generated — it receives the same UUID that was
    created during PDF processing and used as the Qdrant filter key.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False)
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
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    doc_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    context_sufficient: Mapped[bool] = mapped_column(Boolean, default=True)
    sources: Mapped[list[dict[str, object]] | None] = mapped_column(
        JSONB, nullable=True
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
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    doc_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    questions: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="quiz_sessions")
    answers: Mapped[list["QuizAnswer"]] = relationship(back_populates="session")


class QuizAnswer(Base):
    """Individual answer within a quiz session."""

    __tablename__ = "quiz_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"), nullable=False
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
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
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
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="token_usage")


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
