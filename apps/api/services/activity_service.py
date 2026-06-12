"""Activity tracking — records study actions and computes the study streak.

A single ``user_activity`` row exists per user per calendar day. The helpers here
are deliberately best-effort: recording activity must never fail the primary action
(upload, chat, summary, quiz), so errors are swallowed and logged.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import UserActivity

logger = logging.getLogger(__name__)


async def record_activity(db: AsyncSession, user_id: UUID) -> None:
    """Mark today as an active study day for ``user_id`` (idempotent, best-effort).

    Uses an INSERT ... ON CONFLICT DO NOTHING so repeated calls within the same day
    are no-ops. Never raises — a failure here must not break the calling request.
    The caller is responsible for committing its own transaction; this only stages
    the insert (and the unique constraint makes a same-day duplicate harmless).
    """
    try:
        today_utc = datetime.now(UTC).date()
        stmt = (
            pg_insert(UserActivity)
            .values(user_id=user_id, activity_date=today_utc)
            .on_conflict_do_nothing(constraint="uq_user_activity_day")
        )
        await db.execute(stmt)
    except Exception:
        logger.warning(
            "Failed to record study activity for user %s (non-fatal).",
            user_id,
            exc_info=True,
        )


async def compute_streak(db: AsyncSession, user_id: UUID) -> int:
    """Return the number of consecutive days up to today the user was active.

    A streak is unbroken when there is an activity row for today (or, leniently,
    yesterday) and for each preceding day with no gaps. If the most recent activity
    is older than yesterday, the streak is 0.
    """
    result = await db.execute(
        select(UserActivity.activity_date)
        .where(UserActivity.user_id == user_id)
        .order_by(UserActivity.activity_date.desc())
        .limit(365)
    )
    active_days = result.scalars().all()
    if not active_days:
        return 0

    today = datetime.now(UTC).date()
    most_recent = active_days[0]

    # Allow the streak to count if the last active day is today or yesterday.
    # Otherwise the chain is broken and the streak has lapsed.
    if most_recent < today - timedelta(days=1):
        return 0

    streak = 0
    expected = most_recent
    for day in active_days:
        if day == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif day < expected:
            # Gap detected — the consecutive run ends here.
            break
    return streak
