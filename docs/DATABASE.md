# Database Spec

**Files:**  
- `apps/api/models/database.py` — SQLAlchemy models + engine setup  
- `apps/api/migrations/` — Alembic migration scripts

**Role:** Manage all relational data — users, document metadata, chat history, and quiz results. Vectors stay in Qdrant.

---

## Responsibility

This module owns **all PostgreSQL interactions**. It defines the data models, manages the async database engine, provides session injection via FastAPI `Depends()`, and handles schema migrations through Alembic.

---

## Data Split

| Data | Storage | Why |
|---|---|---|
| User accounts | PostgreSQL | Relational, auth queries |
| Document metadata | PostgreSQL | Ownership, listing, timestamps |
| Chat history | PostgreSQL | Per-user query logs, full text storage |
| Quiz sessions + answers | PostgreSQL | Score tracking, per-question results |
| Document chunk vectors | Qdrant | Semantic similarity search |
| Chunk text + metadata | Qdrant payload | Retrieved during search, no need to duplicate |

`doc_id` (UUID) is the shared key between PostgreSQL's `documents` table and Qdrant's `studymate_chunks` collection.

---

## SQLAlchemy Models

```python
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="owner")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user")
    quiz_sessions: Mapped[list["QuizSession"]] = relationship(back_populates="user")


class Document(Base):
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
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    performance_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="high"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="chat_messages")


class QuizSession(Base):
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
    questions: Mapped[list] = mapped_column(JSONB, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="quiz_sessions")
    answers: Mapped[list["QuizAnswer"]] = relationship(back_populates="session")


class QuizAnswer(Base):
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


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class SummaryHistory(Base):
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
    structured: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    context_sufficient: Mapped[bool] = mapped_column(Boolean, default=True)
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    performance_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="high"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped["User"] = relationship(back_populates="summaries")
```

---

## Engine & Session Setup

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Engine — created once at app startup
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async database session per request."""
    async with async_session() as session:
        yield session
```

---

## Cascade Behavior

| Parent Deleted | Effect on Children |
|---|---|
| User deleted | All their documents, chat history, quiz sessions deleted (`CASCADE`) |
| Document deleted | Chat messages and quiz sessions keep `doc_id = NULL` (`SET NULL`) |
| Quiz session deleted | All quiz answers deleted (`CASCADE`) |

---

## Alembic Setup

Migrations are managed with Alembic (async mode):

```bash
# Initialize (one-time)
alembic init -t async migrations

# Create migration after model changes
alembic revision --autogenerate -m "add users and documents tables"

# Apply migrations
alembic upgrade head
```

The `migrations/env.py` must import all models from `models/database.py` so Alembic can detect schema changes:

```python
from models.database import Base
target_metadata = Base.metadata
```

---

## Development vs Production

| Environment | DATABASE_URL |
|---|---|
| **Local dev** | `postgresql+asyncpg://postgres:password@localhost:5432/studymate` |
| **Production** | `postgresql+asyncpg://user:pass@ep-xxx.us-east-2.aws.neon.tech/studymate?sslmode=require` |

Same env var, same code. Just change the `.env` file for deployment.

---

## Key Design Decisions

- **SQLAlchemy 2.0 with `Mapped` types** — fully typed models with IDE autocomplete. No legacy `Column()` syntax.
- **`asyncpg` driver** — highest-performance async PostgreSQL driver. Required because all routes are async in FastAPI.
- **`expire_on_commit=False`** — prevents lazy-load errors after commit in async sessions.
- **`pool_pre_ping=True`** — automatically reconnects stale connections (important for Neon's scale-to-zero which drops idle connections).
- **JSONB for sources** — the `sources` field in chat history stores the array of source objects as native PostgreSQL JSON. No need for a separate join table.
- **UUID primary keys** — consistent with Qdrant's `doc_id` and `chunk_id` format. No auto-incrementing integers.
- **Document.id is NOT auto-generated** — it receives the same UUID that was generated during PDF processing and used in Qdrant, maintaining the shared key.

---

## What This Module Does NOT Do

- Does not store vector embeddings — that's Qdrant
- Does not handle authentication logic — that's `core/security.py`
- Does not contain business logic — just data models and session management
- Does not handle HTTP routing
