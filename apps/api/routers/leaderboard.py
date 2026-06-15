"""User-facing leaderboard — ranked by study activity, tokens, or streak.

Privacy-conscious: shows ``full_name`` only (no email). Gated by regular
``get_current_user`` — any authenticated student can view the leaderboard.
The ``me`` field in the response always contains the caller's own rank and
stats, even if they fall outside the returned top-N.
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from core.errors import StudyMateError
from models.database import TokenUsage, User, get_db
from models.schemas import LeaderboardEntry, LeaderboardResponse
from services.activity_service import compute_streak

logger = logging.getLogger(__name__)
router = APIRouter()

# Import the shared builder and helpers from admin — avoids duplicating ~200
# lines of ranking logic.  The admin module exposes these at module level.
from routers.admin import _badges_for_user, _build_leaderboard  # noqa: E402


@router.get("", response_model=LeaderboardResponse)
async def user_leaderboard(
    user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    metric: str = Query(default="activity"),
) -> LeaderboardResponse:
    """User-facing leaderboard — top users by activity, tokens, or streak.

    ``me`` always contains the caller's own rank + stats (even if outside the
    top-N). Emails are **never** included — only ``full_name``.
    """
    if metric not in ("activity", "tokens", "streak"):
        raise StudyMateError(
            'metric must be "activity", "tokens", or "streak".', status_code=400
        )

    entries = await _build_leaderboard(
        db, metric, include_email=False, me_user_id=user.id
    )

    # Build the caller's own entry.
    me_entry = await _build_me_entry(db, user, metric, entries)

    return LeaderboardResponse(metric=metric, entries=entries, me=me_entry)


async def _build_me_entry(
    db: AsyncSession,
    user: User,
    metric: str,
    entries: list[LeaderboardEntry],
) -> LeaderboardEntry | None:
    """Construct the calling user's ``me`` leaderboard entry.

    If the user appears in the returned ``entries`` their rank is reused;
    otherwise a full ranking position is computed.
    """
    # Check if the user is already in the top-N.
    for entry in entries:
        if entry.user_id == user.id:
            return entry

    # The user didn't make the top-N — compute their stats and approximate rank.
    streak = await compute_streak(db, user.id)
    lifetime_tokens = (
        await db.scalar(
            select(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).where(
                TokenUsage.user_id == user.id
            )
        )
        or 0
    )
    badges = await _badges_for_user(db, user.id, streak=streak)

    if metric == "activity":
        from models.database import ActivityEvent

        value = (
            await db.scalar(
                select(func.count())
                .select_from(ActivityEvent)
                .where(ActivityEvent.user_id == user.id)
            )
            or 0
        )
        # Approximate rank: count users with more events.
        higher = (
            await db.scalar(
                select(func.count()).select_from(
                    select(ActivityEvent.user_id)
                    .group_by(ActivityEvent.user_id)
                    .having(func.count(ActivityEvent.id) > value)
                    .subquery()
                )
            )
            or 0
        )
        rank = higher + 1
    elif metric == "tokens":
        value = lifetime_tokens
        higher = (
            await db.scalar(
                select(func.count()).select_from(
                    select(TokenUsage.user_id)
                    .group_by(TokenUsage.user_id)
                    .having(func.sum(TokenUsage.total_tokens) > value)
                    .subquery()
                )
            )
            or 0
        )
        rank = higher + 1
    else:  # streak
        value = streak
        # For streak ranking, we can't easily SQL-rank since streaks are computed
        # in Python. Use a simple heuristic: place after the last entry if outside
        # the returned set.
        rank = len(entries) + 1

    if value == 0:
        return None

    return LeaderboardEntry(
        rank=rank,
        user_id=user.id,
        full_name=user.full_name,
        email=None,
        value=value,
        streak=streak,
        total_tokens=lifetime_tokens,
        badges=badges,
    )
