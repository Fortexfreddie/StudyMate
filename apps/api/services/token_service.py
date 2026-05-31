"""Token usage tracking — budget checks, recording, and daily aggregation.

Provides three core functions used by every LLM-calling router:
1. ``check_token_budget`` — fail-fast guard before an expensive generation call.
2. ``record_token_usage`` — persist the token counts *after* a successful call.
3. ``get_usage_summary``  — aggregate today's consumption for the GET /usage endpoint.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.database import TokenUsage

logger = logging.getLogger(__name__)


@dataclass
class UsageSummary:
    """Daily token usage snapshot returned by ``get_usage_summary``."""

    tokens_used_today: int
    token_limit: int
    by_type: dict[str, int]  # {"chat": 1200, "summary": 3400, "quiz": 500}
    reset_time: datetime


def _day_boundaries() -> tuple[datetime, datetime]:
    """Return (start_of_today_utc, start_of_tomorrow_utc) for the rolling window."""
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


async def _get_daily_total(db: AsyncSession, user_id: UUID) -> int:
    """Sum total_tokens for a user in the current UTC day."""
    start, end = _day_boundaries()
    result = await db.scalar(
        select(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).where(
            TokenUsage.user_id == user_id,
            TokenUsage.created_at >= start,
            TokenUsage.created_at < end,
        )
    )
    return result or 0


async def check_token_budget(
    db: AsyncSession, user_id: UUID, is_pro: bool
) -> tuple[bool, int, int]:
    """Check whether the user is within their daily token budget.

    Returns ``(allowed, remaining, limit)`` where ``allowed`` is False when the
    user has exceeded their tier limit and the request should be blocked.
    """
    limit = (
        settings.PRO_DAILY_TOKEN_LIMIT if is_pro else settings.FREE_DAILY_TOKEN_LIMIT
    )
    used = await _get_daily_total(db, user_id)
    remaining = max(0, limit - used)
    allowed = used < limit
    return allowed, remaining, limit


async def record_token_usage(
    db: AsyncSession,
    user_id: UUID,
    usage: dict[str, int | str],
    request_type: str,
    performance_mode: str,
) -> None:
    """Persist a token usage row after a successful LLM call.

    ``usage`` must contain ``input_tokens``, ``output_tokens``,
    ``total_tokens``, and ``model_used`` — as returned by the generator.
    Best-effort: failures here are logged but never propagated.
    """
    try:
        row = TokenUsage(
            user_id=user_id,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            model_used=usage.get("model_used", "unknown"),
            request_type=request_type,
            performance_mode=performance_mode,
        )
        db.add(row)
        # Caller commits as part of its own transaction.
    except Exception:
        logger.warning(
            "Failed to record token usage for user %s (non-fatal).",
            user_id,
            exc_info=True,
        )


async def get_usage_summary(
    db: AsyncSession, user_id: UUID, is_pro: bool
) -> UsageSummary:
    """Build a daily usage summary for the GET /usage endpoint."""
    start, end = _day_boundaries()
    limit = (
        settings.PRO_DAILY_TOKEN_LIMIT if is_pro else settings.FREE_DAILY_TOKEN_LIMIT
    )

    # Total tokens used today
    total_used = await _get_daily_total(db, user_id)

    # Breakdown by request type
    rows = await db.execute(
        select(
            TokenUsage.request_type,
            func.coalesce(func.sum(TokenUsage.total_tokens), 0),
        )
        .where(
            TokenUsage.user_id == user_id,
            TokenUsage.created_at >= start,
            TokenUsage.created_at < end,
        )
        .group_by(TokenUsage.request_type)
    )
    by_type: dict[str, int] = {}
    for request_type, total in rows:
        by_type[request_type] = int(total)

    return UsageSummary(
        tokens_used_today=total_used,
        token_limit=limit,
        by_type=by_type,
        reset_time=end,
    )
