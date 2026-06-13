"""Admin router — system stats, user management, and document management.

Every route is gated by ``get_current_admin``; role changes and user deletion
additionally require ``get_current_super_admin``. The single super_admin account
(SUPER_ADMIN_EMAIL) can never be demoted, role-changed, or deleted via the API.

Routes are declared WITHOUT the ``/admin`` prefix — it is applied once at
registration in ``main.py`` (matching every other router in this app).
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Float, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import (
    get_current_admin,
    get_current_super_admin,
    get_vector_store,
)
from core.errors import (
    ConflictError,
    DocumentNotFoundError,
    ForbiddenError,
    StudyMateError,
)
from models.database import (
    ChatMessage,
    DailyTokenUsage,
    Document,
    QuizSession,
    SummaryHistory,
    TokenUsage,
    User,
    UserActivity,
    get_db,
)
from models.schemas import (
    AdminDocumentListItem,
    AdminDocumentListResponse,
    AdminOverviewResponse,
    AdminUserDeleteResponse,
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    DailyCount,
    DailyTokenTrend,
    DeleteResponse,
    MajorBreakdown,
    TopUploader,
    UserResponse,
)
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)
router = APIRouter()

# Pagination ceiling — protects the DB from an unbounded page size.
_MAX_PAGE = 100
# How far back the dashboard time series reach.
_TREND_DAYS = 30


def _today():
    """Current UTC calendar day — matches the token quota window."""
    return datetime.now(UTC).date()


def _like_pattern(term: str) -> str:
    """Build a contains-pattern for ILIKE with LIKE metacharacters escaped.

    Escapes ``\\``, ``%`` and ``_`` in the user-supplied term so they match
    literally instead of acting as wildcards. Use with ``ilike(pattern, escape="\\")``.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _utc_date(col):
    """``DATE`` of a timestamptz column, evaluated in UTC.

    ``func.date(timestamptz)`` casts using the DB session's TimeZone setting, which
    is not guaranteed to be UTC. The token quota window and ``_today()`` are pinned
    to UTC, so the dashboard time-series must bucket in UTC too — otherwise events
    near midnight UTC land in the wrong day and drift from the quota counters.
    """
    return func.date(func.timezone("UTC", col))


def _is_protected_super_admin(user: User) -> bool:
    """True if ``user`` is the protected super-admin account.

    Keyed off SUPER_ADMIN_EMAIL (the single source of truth) as well as the stored
    role, so the configured account is protected even in the window before a login
    has self-healed its role — e.g. right after SUPER_ADMIN_EMAIL is pointed at an
    existing plain-user account that hasn't logged in since.
    """
    if user.role == "super_admin":
        return True
    return bool(settings.SUPER_ADMIN_EMAIL) and user.email == settings.SUPER_ADMIN_EMAIL


# Stats


@router.get("/stats/overview", response_model=AdminOverviewResponse)
async def overview(
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> AdminOverviewResponse:
    """Aggregate every dashboard metric. All counts are derived live from the DB."""
    today = _today()
    window_start = today - timedelta(days=_TREND_DAYS - 1)

    # Scalar user counts
    total_users = await db.scalar(select(func.count()).select_from(User)) or 0
    total_admins = (
        await db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role.in_(("admin", "super_admin")))
        )
        or 0
    )
    total_pro_users = (
        await db.scalar(
            select(func.count()).select_from(User).where(User.is_pro.is_(True))
        )
        or 0
    )

    role_rows = await db.execute(
        select(User.role, func.count()).group_by(User.role)
    )
    users_by_role = {role: int(count) for role, count in role_rows}

    major_rows = await db.execute(
        select(User.major, func.count())
        .where(User.major.isnot(None))
        .group_by(User.major)
        .order_by(func.count().desc())
    )
    users_by_major = [
        MajorBreakdown(major=major, count=int(count)) for major, count in major_rows
    ]

    # Active-user windows (distinct users with any activity in the period)
    async def _active_since(start) -> int:
        return (
            await db.scalar(
                select(func.count(func.distinct(UserActivity.user_id))).where(
                    UserActivity.activity_date >= start
                )
            )
            or 0
        )

    active_users_today = await _active_since(today)
    active_users_7d = await _active_since(today - timedelta(days=6))
    active_users_30d = await _active_since(window_start)

    # Content counts
    total_documents = await db.scalar(select(func.count()).select_from(Document)) or 0
    total_chunks = (
        await db.scalar(select(func.coalesce(func.sum(Document.chunk_count), 0))) or 0
    )
    total_chats = await db.scalar(select(func.count()).select_from(ChatMessage)) or 0
    total_summaries = (
        await db.scalar(select(func.count()).select_from(SummaryHistory)) or 0
    )
    total_quizzes = await db.scalar(select(func.count()).select_from(QuizSession)) or 0

    # Average score as a 0–100 percentage across graded sessions. Uses the same
    # float-cast + NULLIF guard as the per-user /stats query so both endpoints
    # compute "average score" identically (NULLIF makes a zero-question session's
    # ratio NULL, which AVG ignores — no integer division, no div-by-zero).
    avg_ratio = await db.scalar(
        select(
            func.avg(
                cast(QuizSession.score, Float)
                / func.nullif(QuizSession.total_questions, 0)
            )
        )
    )
    average_quiz_score = round(float(avg_ratio) * 100, 1) if avg_ratio else 0.0

    # Tokens
    lifetime_tokens = (
        await db.scalar(select(func.coalesce(func.sum(TokenUsage.total_tokens), 0)))
        or 0
    )
    day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    tokens_today_logged = (
        await db.scalar(
            select(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).where(
                TokenUsage.created_at >= day_start
            )
        )
        or 0
    )
    tokens_today_counter = (
        await db.scalar(
            select(func.coalesce(func.sum(DailyTokenUsage.reserved_tokens), 0)).where(
                DailyTokenUsage.usage_date == today
            )
        )
        or 0
    )
    type_rows = await db.execute(
        select(TokenUsage.request_type, func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .group_by(TokenUsage.request_type)
    )
    tokens_by_type = {rtype: int(total) for rtype, total in type_rows}
    model_rows = await db.execute(
        select(TokenUsage.model_used, func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .group_by(TokenUsage.model_used)
    )
    tokens_by_model = {model: int(total) for model, total in model_rows}

    # 30-day time series — each fills only the days that have data; the frontend
    # zero-fills the gaps so the chart axis stays continuous.
    signup_rows = await db.execute(
        select(_utc_date(User.created_at), func.count())
        .where(User.created_at >= window_start)
        .group_by(_utc_date(User.created_at))
    )
    daily_signups = [DailyCount(date=str(d), count=int(c)) for d, c in signup_rows]

    doc_rows = await db.execute(
        select(_utc_date(Document.uploaded_at), func.count())
        .where(Document.uploaded_at >= window_start)
        .group_by(_utc_date(Document.uploaded_at))
    )
    daily_documents = [DailyCount(date=str(d), count=int(c)) for d, c in doc_rows]

    dau_rows = await db.execute(
        select(UserActivity.activity_date, func.count(func.distinct(UserActivity.user_id)))
        .where(UserActivity.activity_date >= window_start)
        .group_by(UserActivity.activity_date)
    )
    daily_active_users = [DailyCount(date=str(d), count=int(c)) for d, c in dau_rows]

    token_trend_rows = await db.execute(
        select(
            _utc_date(TokenUsage.created_at),
            TokenUsage.request_type,
            func.coalesce(func.sum(TokenUsage.total_tokens), 0),
        )
        .where(TokenUsage.created_at >= window_start)
        .group_by(_utc_date(TokenUsage.created_at), TokenUsage.request_type)
    )
    trend_by_date: dict[str, dict[str, int]] = {}
    for d, rtype, total in token_trend_rows:
        trend_by_date.setdefault(str(d), {})[rtype] = int(total)
    daily_tokens = [
        DailyTokenTrend(
            date=d,
            chat=by_type.get("chat", 0),
            summary=by_type.get("summary", 0),
            quiz=by_type.get("quiz", 0),
        )
        for d, by_type in sorted(trend_by_date.items())
    ]

    # Top uploaders
    uploader_rows = await db.execute(
        select(User.id, User.full_name, User.email, func.count(Document.id))
        .join(Document, Document.user_id == User.id)
        .group_by(User.id, User.full_name, User.email)
        .order_by(func.count(Document.id).desc())
        .limit(10)
    )
    top_uploaders = [
        TopUploader(user_id=uid, full_name=name, email=email, document_count=int(count))
        for uid, name, email, count in uploader_rows
    ]

    return AdminOverviewResponse(
        total_users=total_users,
        total_admins=total_admins,
        total_pro_users=total_pro_users,
        users_by_role=users_by_role,
        users_by_major=users_by_major,
        active_users_today=active_users_today,
        active_users_7d=active_users_7d,
        active_users_30d=active_users_30d,
        total_documents=total_documents,
        total_chunks=total_chunks,
        total_chats=total_chats,
        total_summaries=total_summaries,
        total_quizzes=total_quizzes,
        average_quiz_score=average_quiz_score,
        lifetime_tokens=lifetime_tokens,
        tokens_today_logged=tokens_today_logged,
        tokens_today_counter=tokens_today_counter,
        tokens_by_type=tokens_by_type,
        tokens_by_model=tokens_by_model,
        daily_signups=daily_signups,
        daily_documents=daily_documents,
        daily_active_users=daily_active_users,
        daily_tokens=daily_tokens,
        top_uploaders=top_uploaders,
    )


# Users


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    major: str | None = Query(default=None),
    is_pro: bool | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    limit: int = Query(default=20, ge=1, le=_MAX_PAGE),
    offset: int = Query(default=0, ge=0),
) -> AdminUserListResponse:
    """Paginated user list with search, filtering, and a per-user document count."""
    doc_count = (
        select(Document.user_id, func.count(Document.id).label("doc_count"))
        .group_by(Document.user_id)
        .subquery()
    )

    filters = []
    if search:
        pattern = _like_pattern(search)
        filters.append(
            or_(
                User.email.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
            )
        )
    if role:
        filters.append(User.role == role)
    if major:
        filters.append(User.major == major)
    if is_pro is not None:
        filters.append(User.is_pro.is_(is_pro))

    total = (
        await db.scalar(select(func.count()).select_from(User).where(*filters)) or 0
    )

    # Whitelist sort columns so the query param can't reach an arbitrary attribute.
    sort_columns = {
        "created_at": User.created_at,
        "email": User.email,
        "full_name": User.full_name,
        "role": User.role,
    }
    order_col = sort_columns.get(sort_by, User.created_at)

    rows = await db.execute(
        select(User, func.coalesce(doc_count.c.doc_count, 0))
        .outerjoin(doc_count, doc_count.c.user_id == User.id)
        .where(*filters)
        .order_by(order_col.desc() if sort_by == "created_at" else order_col.asc())
        .limit(limit)
        .offset(offset)
    )

    users = [
        AdminUserListItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            major=u.major,
            is_pro=u.is_pro,
            role=u.role,
            document_count=int(dc),
            created_at=u.created_at,
        )
        for u, dc in rows
    ]
    return AdminUserListResponse(users=users, total=total, limit=limit, offset=offset)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: AdminUserUpdateRequest,
    admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> UserResponse:
    """Update a user's tier and/or role.

    ``is_pro`` requires admin; ``role`` requires super_admin. The super_admin
    account is immutable, and "super_admin" can never be assigned.
    """
    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise StudyMateError("User not found.", status_code=404)

    # The protected super-admin can never be modified through the API.
    if _is_protected_super_admin(target):
        raise ConflictError("The super admin account cannot be modified.")

    if payload.role is not None:
        if admin.role != "super_admin":
            raise ForbiddenError("Only the super admin can change roles.")
        if payload.role not in ("user", "admin"):
            raise ForbiddenError('Role must be "user" or "admin".')
        target.role = payload.role

    if payload.is_pro is not None:
        target.is_pro = payload.is_pro

    await db.commit()
    await db.refresh(target)
    return UserResponse.model_validate(target)


@router.delete("/users/{user_id}", response_model=AdminUserDeleteResponse)
async def delete_user(
    user_id: UUID,
    _super: User = Depends(get_current_super_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    vector_store: VectorStore = Depends(get_vector_store),  # noqa: B008
) -> AdminUserDeleteResponse:
    """Delete a user. CASCADE-deletes the rows, then purges each document's vectors.

    The PG delete is committed FIRST; vectors are purged only after the commit is
    durable (mirrors the single-document delete path). If the commit fails, both the
    DB rows and the Qdrant vectors are left intact — a worst case of orphaned
    *vectors* (harmless, logged) is preferable to live document rows whose vectors
    were already destroyed.
    """
    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise StudyMateError("User not found.", status_code=404)
    if _is_protected_super_admin(target):
        raise ConflictError("The super admin account cannot be deleted.")

    # Capture the owned document ids BEFORE the CASCADE removes the rows, so we can
    # purge their vectors from Qdrant after the DB change is committed.
    doc_ids = (
        await db.execute(select(Document.id).where(Document.user_id == user_id))
    ).scalars().all()

    await db.delete(target)
    await db.commit()

    # Purge Qdrant vectors only after the PG delete is durable.
    for doc_id in doc_ids:
        try:
            await vector_store.delete_by_doc_id(str(doc_id))
        except Exception:
            logger.exception(
                "Failed to purge vectors for document %s during user delete (non-fatal).",
                doc_id,
            )

    return AdminUserDeleteResponse(user_id=user_id, deleted=True)


# Documents


@router.get("/documents", response_model=AdminDocumentListResponse)
async def list_documents(
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    search: str | None = Query(default=None),
    sort_by: str = Query(default="uploaded_at"),
    limit: int = Query(default=20, ge=1, le=_MAX_PAGE),
    offset: int = Query(default=0, ge=0),
) -> AdminDocumentListResponse:
    """Paginated list of every document with owner info, searchable by filename/owner."""
    filters = []
    if search:
        pattern = _like_pattern(search)
        filters.append(
            or_(
                Document.filename.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
                User.email.ilike(pattern, escape="\\"),
            )
        )

    base = select(Document, User).join(User, Document.user_id == User.id).where(*filters)

    total = (
        await db.scalar(
            select(func.count())
            .select_from(Document)
            .join(User, Document.user_id == User.id)
            .where(*filters)
        )
        or 0
    )

    sort_columns = {
        "uploaded_at": Document.uploaded_at,
        "filename": Document.filename,
        "chunk_count": Document.chunk_count,
    }
    order_col = sort_columns.get(sort_by, Document.uploaded_at)

    rows = await db.execute(
        base.order_by(
            order_col.desc() if sort_by == "uploaded_at" else order_col.asc()
        )
        .limit(limit)
        .offset(offset)
    )
    documents = [
        AdminDocumentListItem(
            doc_id=doc.id,
            filename=doc.filename,
            page_count=doc.page_count,
            chunk_count=doc.chunk_count,
            uploaded_at=doc.uploaded_at,
            owner_id=owner.id,
            owner_name=owner.full_name,
            owner_email=owner.email,
        )
        for doc, owner in rows
    ]
    return AdminDocumentListResponse(
        documents=documents, total=total, limit=limit, offset=offset
    )


@router.delete("/documents/{doc_id}", response_model=DeleteResponse)
async def delete_document(
    doc_id: UUID,
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    vector_store: VectorStore = Depends(get_vector_store),  # noqa: B008
) -> DeleteResponse:
    """Delete any document (PG row + Qdrant vectors), regardless of owner."""
    doc = await db.scalar(select(Document).where(Document.id == doc_id))
    if doc is None:
        raise DocumentNotFoundError(str(doc_id))

    await db.delete(doc)
    await db.commit()

    try:
        await vector_store.delete_by_doc_id(str(doc_id))
    except Exception:
        logger.exception(
            "Failed to purge vectors from Qdrant for document %s (non-fatal).", doc_id
        )
    return DeleteResponse(doc_id=doc_id, deleted=True)
