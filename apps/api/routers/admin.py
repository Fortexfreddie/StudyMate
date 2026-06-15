"""Admin router — system stats, user management, and document management.

Every route is gated by ``get_current_admin``; role changes and user deletion
additionally require ``get_current_super_admin``. The single super_admin account
(SUPER_ADMIN_EMAIL) can never be demoted, role-changed, or deleted via the API.

Routes are declared WITHOUT the ``/admin`` prefix — it is applied once at
registration in ``main.py`` (matching every other router in this app).
"""

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import (
    Float,
    Integer,
    String,
    cast,
    func,
    literal_column,
    null,
    or_,
    select,
)
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
    DailyPageUsage,
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
    AdminActivityItem,
    AdminDocumentListItem,
    AdminDocumentListResponse,
    AdminOverviewResponse,
    AdminUserActivityResponse,
    AdminUserDeleteResponse,
    AdminUserListItem,
    AdminUserListResponse,
    AdminUserProfileResponse,
    AdminUserUpdateRequest,
    AdminUserUsageResponse,
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

    The ``'UTC'`` argument is rendered as an inline SQL literal (not a bound
    parameter) so the SELECT and GROUP BY expressions are byte-identical — Postgres
    matches GROUP BY targets by expression text, and a bound param ($1 vs $3) would
    make them look distinct and raise "must appear in the GROUP BY clause".
    """
    return func.date(func.timezone(literal_column("'UTC'"), col))


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
    # Effective Pro = stored is_pro OR an admin/super_admin role (admins always get
    # Pro limits via User.effective_is_pro). Counting role-based Pro here keeps the
    # "Tier breakdown" pie consistent with the per-user list, including admins who
    # were promoted before role→tier sync existed (so their is_pro column is stale).
    total_pro_users = (
        await db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                or_(
                    User.is_pro.is_(True),
                    User.role.in_(("admin", "super_admin")),
                )
            )
        )
        or 0
    )

    role_rows = await db.execute(
        select(User.role, func.count()).group_by(User.role)
    )
    users_by_role = {role: int(count) for role, count in role_rows}

    # Group majors case-insensitively so "Computer Science" and "Computer science"
    # collapse into one bucket. We key on lower(trim(major)) and surface a single
    # representative label per bucket (max() of the original spellings — stable and
    # avoids a second query). Blank/whitespace-only majors are excluded.
    major_key = func.lower(func.trim(User.major))
    major_rows = await db.execute(
        select(
            major_key.label("major_key"),
            func.max(User.major).label("display"),
            func.count().label("cnt"),
        )
        .where(User.major.isnot(None), func.trim(User.major) != "")
        .group_by(major_key)
        .order_by(func.count().desc())
    )
    users_by_major = [
        MajorBreakdown(major=display, count=int(cnt))
        for _key, display, cnt in major_rows
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

    # Pages
    lifetime_pages = (
        await db.scalar(select(func.coalesce(func.sum(Document.page_count), 0)))
        or 0
    )
    pages_today_logged = (
        await db.scalar(
            select(func.coalesce(func.sum(Document.page_count), 0)).where(
                Document.uploaded_at >= day_start
            )
        )
        or 0
    )
    pages_today_counter = (
        await db.scalar(
            select(func.coalesce(func.sum(DailyPageUsage.reserved_pages), 0)).where(
                DailyPageUsage.usage_date == today
            )
        )
        or 0
    )

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

    page_rows = await db.execute(
        select(_utc_date(Document.uploaded_at), func.coalesce(func.sum(Document.page_count), 0))
        .where(Document.uploaded_at >= window_start)
        .group_by(_utc_date(Document.uploaded_at))
    )
    daily_pages = [DailyCount(date=str(d), count=int(c)) for d, c in page_rows]

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
        select(
            User.id,
            User.full_name,
            User.email,
            func.count(Document.id),
            func.coalesce(func.sum(Document.page_count), 0)
        )
        .join(Document, Document.user_id == User.id)
        .group_by(User.id, User.full_name, User.email)
        .order_by(func.count(Document.id).desc())
        .limit(10)
    )
    top_uploaders = [
        TopUploader(
            user_id=uid,
            full_name=name,
            email=email,
            document_count=int(doc_count),
            page_count=int(page_count)
        )
        for uid, name, email, doc_count, page_count in uploader_rows
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
        lifetime_pages=lifetime_pages,
        pages_today_logged=pages_today_logged,
        pages_today_counter=pages_today_counter,
        daily_signups=daily_signups,
        daily_documents=daily_documents,
        daily_active_users=daily_active_users,
        daily_tokens=daily_tokens,
        daily_pages=daily_pages,
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
    """Paginated user list with search, filtering, per-user doc count and last-active."""
    doc_count = (
        select(
            Document.user_id,
            func.count(Document.id).label("doc_count"),
            func.coalesce(func.sum(Document.page_count), 0).label("page_count"),
        )
        .group_by(Document.user_id)
        .subquery()
    )
    last_active = (
        select(
            UserActivity.user_id,
            func.max(UserActivity.activity_date).label("last_active"),
        )
        .group_by(UserActivity.user_id)
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
        select(
            User,
            func.coalesce(doc_count.c.doc_count, 0),
            func.coalesce(doc_count.c.page_count, 0),
            last_active.c.last_active,
        )
        .outerjoin(doc_count, doc_count.c.user_id == User.id)
        .outerjoin(last_active, last_active.c.user_id == User.id)
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
            page_count=int(pc),
            created_at=u.created_at,
            last_active=la,
        )
        for u, dc, pc, la in rows
    ]
    return AdminUserListResponse(users=users, total=total, limit=limit, offset=offset)


@router.get("/users/{user_id}/profile", response_model=AdminUserProfileResponse)
async def user_profile(
    user_id: UUID,
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> AdminUserProfileResponse:
    """Robust per-user detail: lifecycle dates, lifetime counts, and metadata-only
    breakdowns (summary formats, performance modes, models). No private content.
    """
    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise StudyMateError("User not found.", status_code=404)

    # Lifetime content counts (scalar subqueries, one round-trip each).
    total_documents = (
        await db.scalar(
            select(func.count()).select_from(Document).where(Document.user_id == user_id)
        )
        or 0
    )
    total_pages = (
        await db.scalar(
            select(func.coalesce(func.sum(Document.page_count), 0)).where(Document.user_id == user_id)
        )
        or 0
    )
    total_chunks = (
        await db.scalar(
            select(func.coalesce(func.sum(Document.chunk_count), 0)).where(
                Document.user_id == user_id
            )
        )
        or 0
    )
    total_chats = (
        await db.scalar(
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.user_id == user_id)
        )
        or 0
    )
    total_summaries = (
        await db.scalar(
            select(func.count())
            .select_from(SummaryHistory)
            .where(SummaryHistory.user_id == user_id)
        )
        or 0
    )
    total_quizzes = (
        await db.scalar(
            select(func.count())
            .select_from(QuizSession)
            .where(QuizSession.user_id == user_id)
        )
        or 0
    )

    # Average quiz score (0–100) — same float-cast + NULLIF guard as the overview.
    avg_ratio = await db.scalar(
        select(
            func.avg(
                cast(QuizSession.score, Float)
                / func.nullif(QuizSession.total_questions, 0)
            )
        ).where(QuizSession.user_id == user_id)
    )
    average_quiz_score = round(float(avg_ratio) * 100, 1) if avg_ratio else 0.0

    # Breakdowns (metadata only).
    fmt_rows = await db.execute(
        select(SummaryHistory.format, func.count())
        .where(SummaryHistory.user_id == user_id)
        .group_by(SummaryHistory.format)
    )
    summary_formats = {fmt: int(c) for fmt, c in fmt_rows}

    mode_rows = await db.execute(
        select(TokenUsage.performance_mode, func.count())
        .where(TokenUsage.user_id == user_id)
        .group_by(TokenUsage.performance_mode)
    )
    performance_modes = {mode: int(c) for mode, c in mode_rows}

    model_rows = await db.execute(
        select(TokenUsage.model_used, func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .where(TokenUsage.user_id == user_id)
        .group_by(TokenUsage.model_used)
    )
    tokens_by_model = {model: int(total) for model, total in model_rows}
    lifetime_tokens = sum(tokens_by_model.values())

    # Performance metadata (Phase 4): per-type averages of the instrumented columns.
    # AVG ignores NULLs, so legacy/cached rows that never recorded these don't skew it.
    perf_rows = await db.execute(
        select(
            TokenUsage.request_type,
            func.avg(TokenUsage.generation_ms),
            func.avg(TokenUsage.chunks_used),
        )
        .where(TokenUsage.user_id == user_id)
        .group_by(TokenUsage.request_type)
    )
    avg_generation_ms: dict[str, int] = {}
    avg_chunks_used: dict[str, float] = {}
    for rtype, avg_ms, avg_chunks in perf_rows:
        if avg_ms is not None:
            avg_generation_ms[rtype] = round(float(avg_ms))
        if avg_chunks is not None:
            avg_chunks_used[rtype] = round(float(avg_chunks), 1)

    cached_tokens_total = (
        await db.scalar(
            select(func.coalesce(func.sum(TokenUsage.cached_tokens), 0)).where(
                TokenUsage.user_id == user_id
            )
        )
        or 0
    )

    last_active = await db.scalar(
        select(func.max(UserActivity.activity_date)).where(
            UserActivity.user_id == user_id
        )
    )

    return AdminUserProfileResponse(
        user_id=target.id,
        email=target.email,
        full_name=target.full_name,
        major=target.major,
        is_pro=target.effective_is_pro,
        role=target.role,
        created_at=target.created_at,
        last_active=last_active,
        last_login_at=target.last_login_at,
        total_documents=total_documents,
        total_pages=total_pages,
        total_chunks=total_chunks,
        total_chats=total_chats,
        total_summaries=total_summaries,
        total_quizzes=total_quizzes,
        average_quiz_score=average_quiz_score,
        summary_formats=summary_formats,
        performance_modes=performance_modes,
        tokens_by_model=tokens_by_model,
        lifetime_tokens=lifetime_tokens,
        avg_generation_ms=avg_generation_ms,
        avg_chunks_used=avg_chunks_used,
        cached_tokens_total=cached_tokens_total,
    )


@router.get("/users/{user_id}/usage", response_model=AdminUserUsageResponse)
async def user_usage(
    user_id: UUID,
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    start: date | None = Query(default=None),  # noqa: B008
    end: date | None = Query(default=None),  # noqa: B008
    request_type: str | None = Query(default=None),  # noqa: B008
) -> AdminUserUsageResponse:
    """One user's token consumption over a date window, from the append-only log.

    Aggregates the ``token_usage`` rows (not the live quota counter) so historical
    figures are stable. ``start``/``end`` are inclusive calendar days bucketed in
    UTC to match the rest of the dashboard; ``request_type`` optionally narrows to a
    single generation type.
    """
    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise StudyMateError("User not found.", status_code=404)

    today = _today()
    end_date = end or today
    start_date = start or (today - timedelta(days=_TREND_DAYS - 1))
    if start_date > end_date:
        raise StudyMateError("start must be on or before end.", status_code=400)

    # Inclusive window: [start 00:00 UTC, (end + 1 day) 00:00 UTC).
    window_start = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)
    window_end = datetime.combine(
        end_date + timedelta(days=1), datetime.min.time(), tzinfo=UTC
    )

    base_filters = [
        TokenUsage.user_id == user_id,
        TokenUsage.created_at >= window_start,
        TokenUsage.created_at < window_end,
    ]
    if request_type:
        if request_type not in ("chat", "summary", "quiz"):
            raise StudyMateError(
                'request_type must be "chat", "summary", or "quiz".', status_code=400
            )
        base_filters.append(TokenUsage.request_type == request_type)

    # Window totals
    totals_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(TokenUsage.total_tokens), 0),
                func.coalesce(func.sum(TokenUsage.input_tokens), 0),
                func.coalesce(func.sum(TokenUsage.output_tokens), 0),
                func.count(),
            ).where(*base_filters)
        )
    ).one()
    total_tokens, total_input, total_output, request_count = (int(v) for v in totals_row)

    type_rows = await db.execute(
        select(TokenUsage.request_type, func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .where(*base_filters)
        .group_by(TokenUsage.request_type)
    )
    tokens_by_type = {rtype: int(total) for rtype, total in type_rows}

    model_rows = await db.execute(
        select(TokenUsage.model_used, func.coalesce(func.sum(TokenUsage.total_tokens), 0))
        .where(*base_filters)
        .group_by(TokenUsage.model_used)
    )
    tokens_by_model = {model: int(total) for model, total in model_rows}

    # Per-day split by type, UTC-bucketed (sparse; frontend zero-fills gaps).
    trend_rows = await db.execute(
        select(
            _utc_date(TokenUsage.created_at),
            TokenUsage.request_type,
            func.coalesce(func.sum(TokenUsage.total_tokens), 0),
        )
        .where(*base_filters)
        .group_by(_utc_date(TokenUsage.created_at), TokenUsage.request_type)
    )
    trend_by_date: dict[str, dict[str, int]] = {}
    for d, rtype, total in trend_rows:
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

    # Pages over the window
    doc_filters = [
        Document.user_id == user_id,
        Document.uploaded_at >= window_start,
        Document.uploaded_at < window_end,
    ]
    doc_totals_row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Document.page_count), 0),
            ).where(*doc_filters)
        )
    ).one()
    document_count, total_pages = (int(v) for v in doc_totals_row)

    page_trend_rows = await db.execute(
        select(
            _utc_date(Document.uploaded_at),
            func.coalesce(func.sum(Document.page_count), 0),
        )
        .where(*doc_filters)
        .group_by(_utc_date(Document.uploaded_at))
    )
    daily_pages = [DailyCount(date=str(d), count=int(c)) for d, c in page_trend_rows]

    return AdminUserUsageResponse(
        user_id=target.id,
        email=target.email,
        full_name=target.full_name,
        is_pro=target.effective_is_pro,
        role=target.role,
        start_date=str(start_date),
        end_date=str(end_date),
        total_tokens=total_tokens,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        request_count=request_count,
        tokens_by_type=tokens_by_type,
        tokens_by_model=tokens_by_model,
        total_pages=total_pages,
        document_count=document_count,
        daily_tokens=daily_tokens,
        daily_pages=daily_pages,
    )


# Length of the truncated query/topic preview surfaced in the audit trail. Kept
# short on purpose: enough to recognise the activity, not enough to expose the
# student's full private question to an admin.
_PREVIEW_LEN = 80


def _preview(text: str | None) -> str:
    """Truncate a query/topic to a fixed-length, ellipsised preview for the audit log."""
    if not text:
        return ""
    text = text.strip()
    return text if len(text) <= _PREVIEW_LEN else text[: _PREVIEW_LEN - 1].rstrip() + "…"


@router.get("/users/{user_id}/activity", response_model=AdminUserActivityResponse)
async def user_activity(
    user_id: UUID,
    _admin: User = Depends(get_current_admin),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    action_type: str | None = Query(default=None),  # noqa: B008
    limit: int = Query(default=20, ge=1, le=_MAX_PAGE),
    offset: int = Query(default=0, ge=0),
) -> AdminUserActivityResponse:
    """A user's audit timeline as **metadata only** (privacy-conscious).

    Merges chat, summary, and quiz rows into a single time-ordered feed of metadata
    records — action type, timestamp, document, performance mode, quiz score, and an
    80-char truncated preview of the query/topic. It deliberately never returns full
    question text or answer bodies, so an admin can audit activity and cost without
    reading a student's private study content.

    The three sources are unioned in SQL and paginated together so the feed is a true
    interleaved timeline (not three separate paginated lists).
    """
    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise StudyMateError("User not found.", status_code=404)

    if action_type and action_type not in ("chat", "summary", "quiz"):
        raise StudyMateError(
            'action_type must be "chat", "summary", or "quiz".', status_code=400
        )

    # One SELECT per source, projected to a common shape, then UNION ALL. Every
    # branch must have matching column count AND types, so missing columns are typed
    # NULLs: quiz-only score/total_questions are NULL for chat/summary, quiz has no
    # performance_mode, and summary_format is set only on the summary branch. Column
    # names come from the first branch (chat).
    chat_q = select(
        ChatMessage.id.label("id"),
        literal_column("'chat'").label("kind"),
        ChatMessage.created_at.label("created_at"),
        ChatMessage.doc_id.label("doc_id"),
        ChatMessage.query.label("text"),
        ChatMessage.performance_mode.label("performance_mode"),
        cast(null(), String).label("summary_format"),
        cast(null(), Integer).label("score"),
        cast(null(), Integer).label("total_questions"),
    ).where(ChatMessage.user_id == user_id)

    summary_q = select(
        SummaryHistory.id,
        literal_column("'summary'"),
        SummaryHistory.created_at,
        SummaryHistory.doc_id,
        SummaryHistory.topic,
        SummaryHistory.performance_mode,
        SummaryHistory.format,
        cast(null(), Integer),
        cast(null(), Integer),
    ).where(SummaryHistory.user_id == user_id)

    quiz_q = select(
        QuizSession.id,
        literal_column("'quiz'"),
        QuizSession.created_at,
        QuizSession.doc_id,
        QuizSession.topic,
        cast(null(), String),
        cast(null(), String),
        QuizSession.score,
        QuizSession.total_questions,
    ).where(QuizSession.user_id == user_id)

    parts = {"chat": chat_q, "summary": summary_q, "quiz": quiz_q}
    selected = [parts[action_type]] if action_type else list(parts.values())
    unioned = selected[0] if len(selected) == 1 else selected[0].union_all(*selected[1:])
    feed = unioned.subquery("feed")

    total = await db.scalar(select(func.count()).select_from(feed)) or 0

    rows = await db.execute(
        select(feed, Document.filename.label("doc_filename"))
        .outerjoin(Document, Document.id == feed.c.doc_id)
        .order_by(feed.c.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    items = [
        AdminActivityItem(
            id=row["id"],
            action_type=row["kind"],
            created_at=row["created_at"],
            doc_id=row["doc_id"],
            doc_filename=row["doc_filename"],
            performance_mode=row["performance_mode"],
            preview=_preview(row["text"]),
            summary_format=row["summary_format"],
            score=row["score"],
            total_questions=row["total_questions"],
        )
        for row in rows.mappings()
    ]

    return AdminUserActivityResponse(
        user_id=target.id,
        email=target.email,
        full_name=target.full_name,
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


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
        # Keep the stored tier in sync with the role so the user list and the
        # "Tier breakdown" pie agree. Promoting to admin grants Pro outright;
        # demoting to plain user leaves the existing tier untouched (a user who
        # paid for Pro keeps it). This collapses the effective_is_pro override
        # into the stored column instead of recomputing it everywhere.
        if payload.role == "admin":
            target.is_pro = True

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
            status=doc.status,
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
