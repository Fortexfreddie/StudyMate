"""Stats API Router — aggregate study metrics for the dashboard and profile.

Every value is computed live from PostgreSQL. Summaries are persisted as chat rows
whose query is prefixed with ``Summary request:`` (see routers/summary.py), so the
summaries count keys on that prefix and the chat count excludes them.
"""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from models.database import ChatMessage, Document, QuizSession, User, get_db
from models.schemas import StatsResponse
from services.activity_service import compute_streak
from services.token_service import get_usage_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Stats"])

# Prefix that marks a chat_history row as a generated summary rather than a chat.
SUMMARY_QUERY_PREFIX = "Summary request:"


@router.get(
    "",
    response_model=StatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Aggregate study metrics for the current user",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> StatsResponse:
    """Return real document/quiz/summary/chat counts, streak, average score, and token usage."""
    user_id = current_user.id

    # Documents uploaded
    documents_uploaded = await db.scalar(
        select(func.count(Document.id)).where(Document.user_id == user_id)
    )

    # Quiz sessions taken + average score (as a percentage across graded sessions)
    quizzes_taken = await db.scalar(
        select(func.count(QuizSession.id)).where(QuizSession.user_id == user_id)
    )
    avg_ratio = await db.scalar(
        select(
            func.avg(
                QuizSession.score * 1.0 / func.nullif(QuizSession.total_questions, 0)
            )
        ).where(QuizSession.user_id == user_id)
    )
    average_quiz_score = round(float(avg_ratio) * 100, 1) if avg_ratio else 0.0

    # Summaries generated (chat rows flagged with the summary prefix)
    summaries_generated = await db.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.user_id == user_id,
            ChatMessage.query.like(f"{SUMMARY_QUERY_PREFIX}%"),
        )
    )

    # Genuine chats = all chat rows minus the summary-flagged ones
    total_chat_rows = await db.scalar(
        select(func.count(ChatMessage.id)).where(ChatMessage.user_id == user_id)
    )
    chats_count = (total_chat_rows or 0) - (summaries_generated or 0)

    current_streak = await compute_streak(db, user_id)

    # Token usage for today
    usage = await get_usage_summary(db, user_id, current_user.is_pro)

    logger.info(
        "Stats for user %s: docs=%s quizzes=%s summaries=%s chats=%s streak=%s tokens=%s/%s",
        user_id,
        documents_uploaded,
        quizzes_taken,
        summaries_generated,
        chats_count,
        current_streak,
        usage.tokens_used_today,
        usage.token_limit,
    )

    return StatsResponse(
        documents_uploaded=documents_uploaded or 0,
        quizzes_taken=quizzes_taken or 0,
        summaries_generated=summaries_generated or 0,
        chats_count=chats_count,
        current_streak=current_streak,
        average_quiz_score=average_quiz_score,
        tokens_used_today=usage.tokens_used_today,
        token_limit=usage.token_limit,
        is_pro=current_user.is_pro,
    )
