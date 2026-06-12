"""Token usage tracking — atomic quota reservation, recording, and aggregation.

Quota enforcement uses a two-table design:

* ``daily_token_usage`` — a single mutable counter row per ``(user_id, usage_date)``.
  This is the **authoritative** balance used to enforce the daily limit. It is
  mutated atomically (``INSERT ... ON CONFLICT DO UPDATE ... RETURNING``) in its
  own short transaction so concurrent requests can never collectively overshoot.
* ``token_usage`` — an append-only per-request *log* (input/output/total tokens,
  model, request type). Powers the ``/usage`` by-type breakdown and stats.

Lifecycle of one generation request:

1. ``estimate_request_tokens`` — cheap, local char-based pre-flight estimate.
2. ``reserve_tokens`` — atomically add the estimate to today's counter. If that
   pushes the user over their limit, the reservation is released and the request
   is rejected *before* any expensive LLM call.
3. (LLM call happens)
4. ``reconcile_tokens`` — adjust the counter by ``actual - estimate`` and write
   the per-request log row, OR ``release_tokens`` on failure to refund the hold.

``reserve``/``reconcile``/``release`` each commit in their own session so the
hold is visible to other concurrent requests immediately, independent of the
calling router's request-scoped transaction.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.database import DailyTokenUsage, TokenUsage, async_session

logger = logging.getLogger(__name__)

# Fixed per-request output-token budget by request type, added to the measured
# input estimate at reservation time. Output is the variable, unmeasurable-ahead
# part of the cost; these are deliberately generous so the reservation rarely
# *under*-counts (reconciliation corrects any drift after the call anyway).
_OUTPUT_BUDGET_BY_TYPE: dict[str, int] = {
    "chat": 1200,
    "summary": 2000,
    "quiz": 3000,
}
_DEFAULT_OUTPUT_BUDGET = 1500


@dataclass
class UsageSummary:
    """Daily token usage snapshot returned by ``get_usage_summary``."""

    tokens_used_today: int
    token_limit: int
    by_type: dict[str, int]  # {"chat": 1200, "summary": 3400, "quiz": 500}
    reset_time: datetime


def _today() -> date:
    """The current UTC calendar day used as the quota window key."""
    return datetime.now(UTC).date()


def _day_boundaries() -> tuple[datetime, datetime]:
    """Return (start_of_today_utc, start_of_tomorrow_utc) for the day window."""
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def _limit_for(is_pro: bool) -> int:
    """Resolve the daily token limit for a user's tier."""
    return settings.PRO_DAILY_TOKEN_LIMIT if is_pro else settings.FREE_DAILY_TOKEN_LIMIT


def estimate_request_tokens(
    system_instruction: str, user_prompt: str, request_type: str
) -> int:
    """Estimate a request's total token cost for pre-flight reservation.

    Local and deterministic: input is approximated at ~4 chars/token (matching the
    PDF chunker's heuristic) plus a fixed per-type output budget. No network call —
    accuracy at reservation time is unimportant because ``reconcile_tokens`` trues
    the counter up to the real ``usage_metadata`` after the call.
    """
    input_chars = len(system_instruction) + len(user_prompt)
    input_estimate = max(1, input_chars // 4)
    output_budget = _OUTPUT_BUDGET_BY_TYPE.get(request_type, _DEFAULT_OUTPUT_BUDGET)
    return input_estimate + output_budget


async def _current_reserved(db: AsyncSession, user_id: UUID) -> int:
    """Read today's authoritative reserved-token total for a user."""
    today = _today()
    result = await db.scalar(
        select(DailyTokenUsage.reserved_tokens).where(
            DailyTokenUsage.user_id == user_id,
            DailyTokenUsage.usage_date == today,
        )
    )
    return result or 0


async def reserve_tokens(
    user_id: UUID, is_pro: bool, estimate: int
) -> tuple[bool, int, int]:
    """Atomically reserve ``estimate`` tokens against today's quota.

    Returns ``(allowed, reserved_total, limit)``. When ``allowed`` is False the
    reservation has already been rolled back, so the caller must reject the request
    without calling ``reconcile``/``release``.

    The increment and the resulting total are produced by a single atomic
    ``INSERT ... ON CONFLICT DO UPDATE ... RETURNING`` statement, so two concurrent
    callers are serialized by the row lock and cannot both slip past the limit.
    """
    limit = _limit_for(is_pro)
    today = _today()

    async with async_session() as session:
        stmt = (
            pg_insert(DailyTokenUsage)
            .values(user_id=user_id, usage_date=today, reserved_tokens=estimate)
            .on_conflict_do_update(
                constraint="uq_daily_token_usage_day",
                set_={
                    "reserved_tokens": DailyTokenUsage.reserved_tokens + estimate,
                    "updated_at": func.now(),
                },
            )
            .returning(DailyTokenUsage.reserved_tokens)
        )
        new_total = await session.scalar(stmt) or estimate

        # Allow the request that *crosses* the threshold to proceed only if the
        # balance *before* this reservation was still under the limit — i.e. the
        # user had some budget left. This mirrors the old `used < limit` guard
        # while making the spend atomic.
        prior = new_total - estimate
        if prior >= limit:
            # No budget remained before this call — refund and reject.
            await _adjust(session, user_id, today, -estimate)
            await session.commit()
            return False, prior, limit

        await session.commit()
        return True, new_total, limit


async def _adjust(session: AsyncSession, user_id: UUID, day: date, delta: int) -> None:
    """Add ``delta`` (may be negative) to today's counter, clamped at >= 0.

    Operates on an existing session without committing; caller commits.
    """
    row = await session.scalar(
        select(DailyTokenUsage).where(
            DailyTokenUsage.user_id == user_id,
            DailyTokenUsage.usage_date == day,
        )
    )
    if row is None:
        # Nothing to adjust against (shouldn't happen after a reserve, but be safe).
        if delta > 0:
            session.add(
                DailyTokenUsage(user_id=user_id, usage_date=day, reserved_tokens=delta)
            )
        return
    row.reserved_tokens = max(0, row.reserved_tokens + delta)


async def reconcile_tokens(user_id: UUID, estimate: int, actual: int) -> None:
    """True up today's counter by ``actual - estimate`` after a successful call.

    Best-effort: a reconciliation failure must not break the (already successful)
    request. The held estimate stays in place if this fails, which errs toward
    *over*-counting — safe for a quota guard.
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
            "Failed to reconcile token reservation for user %s (delta=%s, non-fatal).",
            user_id,
            delta,
            exc_info=True,
        )


async def release_tokens(user_id: UUID, estimate: int) -> None:
    """Refund a previously reserved estimate when the request did not consume it.

    Called when generation fails before producing billable usage. Best-effort.
    """
    if estimate <= 0:
        return
    try:
        async with async_session() as session:
            await _adjust(session, user_id, _today(), -estimate)
            await session.commit()
    except Exception:
        logger.warning(
            "Failed to release token reservation for user %s (estimate=%s, non-fatal).",
            user_id,
            estimate,
            exc_info=True,
        )


async def record_token_usage(
    db: AsyncSession,
    user_id: UUID,
    usage: dict[str, int | str],
    request_type: str,
    performance_mode: str,
) -> None:
    """Stage a per-request token-usage *log* row on the caller's transaction.

    This is the append-only audit log (``token_usage``), separate from the atomic
    quota counter. ``usage`` must contain ``input_tokens``, ``output_tokens``,
    ``total_tokens``, and ``model_used``. Best-effort: staging failures are logged,
    never propagated. The caller commits as part of its own transaction.
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
    """Build a daily usage summary for the GET /usage and /stats endpoints.

    ``tokens_used_today`` comes from the authoritative atomic counter;
    ``by_type`` comes from the per-request log (the counter has no type breakdown).
    """
    limit = _limit_for(is_pro)
    start, end = _day_boundaries()

    total_used = await _current_reserved(db, user_id)

    # Breakdown by request type, from the append-only log.
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
