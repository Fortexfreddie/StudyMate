"""Document-upload (page) quota — atomic reservation, reconciliation, release.

The upload analogue of ``token_service``'s quota machinery. Uploads consume the
embedding model, whose Google-side quota (requests/day + tokens/minute) is
*separate* from the generation tokens billed against the chat/summary/quiz model.
So upload cost is metered in **pages**, in its own counter table
(``daily_page_usage``), independent of ``daily_token_usage``.

Lifecycle of one upload:

1. ``reserve_pages`` — atomically add the PDF's page count to today's counter
   *before* the ingestion background task is scheduled. If that pushes the user
   over their daily page limit, the reservation is rolled back and the upload is
   rejected with a 403 *before* any embedding work begins.
2. (background parse → embed → index happens)
3. ``reconcile_pages`` — adjust the counter by ``actual - estimate`` once the real
   extractable page count is known (a scanned/partial PDF may yield fewer pages),
   OR ``release_pages`` to refund the whole hold if ingestion failed.

``reserve``/``reconcile``/``release`` each commit in their own session so the hold
is visible to other concurrent uploads immediately, independent of the calling
router's request-scoped transaction. The atomic ``INSERT ... ON CONFLICT DO
UPDATE`` (with arithmetic done in PostgreSQL under the row lock) prevents the
lost-update / check-then-act races a Python read-modify-write would allow — the
same reasoning as ``token_service._adjust``.
"""

import logging
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.database import DailyPageUsage, async_session

logger = logging.getLogger(__name__)


def _today() -> date:
    """The current UTC calendar day used as the quota window key."""
    return datetime.now(UTC).date()


def _limit_for(is_pro: bool) -> int:
    """Resolve the daily page limit for a user's tier."""
    return settings.PRO_DAILY_PAGE_LIMIT if is_pro else settings.FREE_DAILY_PAGE_LIMIT


async def current_pages_used(db: AsyncSession, user_id: UUID) -> int:
    """Read today's authoritative reserved-page total for a user."""
    result = await db.scalar(
        select(DailyPageUsage.reserved_pages).where(
            DailyPageUsage.user_id == user_id,
            DailyPageUsage.usage_date == _today(),
        )
    )
    return result or 0


def page_limit_for(is_pro: bool) -> int:
    """Public accessor for a tier's daily page limit (used by /usage)."""
    return _limit_for(is_pro)


async def _adjust(session: AsyncSession, user_id: UUID, day: date, delta: int) -> None:
    """Add ``delta`` (may be negative) to today's page counter, clamped at >= 0.

    The arithmetic runs **atomically in PostgreSQL** —
    ``SET reserved_pages = GREATEST(0, reserved_pages + :delta)`` — inside a single
    ``INSERT ... ON CONFLICT DO UPDATE`` so the row lock serializes concurrent
    adjustments and no update is lost. Operates on an existing session without
    committing; caller commits. Mirrors ``token_service._adjust``.
    """
    stmt = (
        pg_insert(DailyPageUsage)
        .values(
            user_id=user_id,
            usage_date=day,
            reserved_pages=max(0, delta),
        )
        .on_conflict_do_update(
            constraint="uq_daily_page_usage_day",
            set_={
                "reserved_pages": func.greatest(
                    0, DailyPageUsage.reserved_pages + delta
                ),
                "updated_at": func.now(),
            },
        )
    )
    await session.execute(stmt)


async def reserve_pages(
    user_id: UUID, is_pro: bool, pages: int
) -> tuple[bool, int, int]:
    """Atomically reserve ``pages`` against today's upload quota.

    Returns ``(allowed, reserved_total, limit)``. When ``allowed`` is False the
    reservation has already been rolled back, so the caller must reject the upload
    without calling ``reconcile``/``release``.

    Allows the upload that *crosses* the threshold to proceed only if the balance
    *before* this reservation was still under the limit — i.e. the user had some
    budget left — matching ``token_service.reserve_tokens``.
    """
    pages = max(1, pages)
    limit = _limit_for(is_pro)
    today = _today()

    async with async_session() as session:
        stmt = (
            pg_insert(DailyPageUsage)
            .values(user_id=user_id, usage_date=today, reserved_pages=pages)
            .on_conflict_do_update(
                constraint="uq_daily_page_usage_day",
                set_={
                    "reserved_pages": DailyPageUsage.reserved_pages + pages,
                    "updated_at": func.now(),
                },
            )
            .returning(DailyPageUsage.reserved_pages)
        )
        new_total = await session.scalar(stmt) or pages

        prior = new_total - pages
        if prior >= limit:
            # No budget remained before this upload — refund and reject.
            await _adjust(session, user_id, today, -pages)
            await session.commit()
            return False, prior, limit

        await session.commit()
        return True, new_total, limit


async def reconcile_pages(user_id: UUID, estimate: int, actual: int) -> None:
    """True up today's counter by ``actual - estimate`` after a successful upload.

    Best-effort: a reconciliation failure must not break the (already successful)
    upload. Leaving the held estimate in place errs toward *over*-counting — safe
    for a quota guard.
    """
    delta = actual - estimate
    if delta == 0:
        return
    try:
        async with async_session() as session:
            await _adjust(session, user_id, _today(), delta)
            await session.commit()
    except Exception:
        logger.warning(
            "Failed to reconcile page reservation for user %s (delta=%s, non-fatal).",
            user_id,
            delta,
            exc_info=True,
        )


async def release_pages(user_id: UUID, pages: int) -> None:
    """Refund a previously reserved page count when ingestion did not complete.

    Called when the background ingestion task fails before the document is indexed.
    Best-effort.
    """
    if pages <= 0:
        return
    try:
        async with async_session() as session:
            await _adjust(session, user_id, _today(), -pages)
            await session.commit()
    except Exception:
        logger.warning(
            "Failed to release page reservation for user %s (pages=%s, non-fatal).",
            user_id,
            pages,
            exc_info=True,
        )
