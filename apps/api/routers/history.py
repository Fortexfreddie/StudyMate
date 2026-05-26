"""History API Router — implements student learning history queries."""

import logging
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.dependencies import get_current_user
from core.errors import StudyMateError
from models.database import ChatMessage, QuizSession, User, get_db
from models.schemas import (
    ChatHistoryItem,
    ChatHistoryResponse,
    QuizAnswerDetail,
    QuizDetailResponse,
    QuizHistoryItem,
    QuizHistoryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["History"])


@router.get(
    "/chat",
    response_model=ChatHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated chat conversation history",
)
async def get_chat_history(
    limit: int = Query(default=10, ge=1, le=100),  # noqa: B008
    offset: int = Query(default=0, ge=0),  # noqa: B008
    doc_id: uuid.UUID | None = Query(default=None),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> ChatHistoryResponse:
    """Retrieve the logged list of past grounded Q&A conversations."""
    logger.info(
        "User %s requested chat history (limit: %d, offset: %d, doc_id: %s)",
        current_user.id,
        limit,
        offset,
        doc_id,
    )

    # 1. Base query for message count
    count_stmt = select(func.count(ChatMessage.id)).where(
        ChatMessage.user_id == current_user.id
    )
    if doc_id is not None:
        count_stmt = count_stmt.where(ChatMessage.doc_id == doc_id)

    count_result = await db.execute(count_stmt)
    total_count = count_result.scalar_one()

    # 2. Query for actual rows
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(desc(ChatMessage.created_at))
        .limit(limit)
        .offset(offset)
    )
    if doc_id is not None:
        stmt = stmt.where(ChatMessage.doc_id == doc_id)

    result = await db.execute(stmt)
    messages = result.scalars().all()

    # 3. Map database models to pydantic schema
    response_items = [
        ChatHistoryItem(
            id=msg.id,
            doc_id=msg.doc_id,
            query=msg.query,
            answer=msg.answer,
            context_sufficient=msg.context_sufficient,
            created_at=msg.created_at,
        )
        for msg in messages
    ]

    return ChatHistoryResponse(
        messages=response_items,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/quizzes",
    response_model=QuizHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated quiz history",
)
async def get_quiz_history(
    limit: int = Query(default=10, ge=1, le=100),  # noqa: B008
    offset: int = Query(default=0, ge=0),  # noqa: B008
    doc_id: uuid.UUID | None = Query(default=None),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> QuizHistoryResponse:
    """Retrieve the logged list of past study quiz sessions and scores."""
    logger.info(
        "User %s requested quiz history (limit: %d, offset: %d, doc_id: %s)",
        current_user.id,
        limit,
        offset,
        doc_id,
    )

    # 1. Base query for sessions count
    count_stmt = select(func.count(QuizSession.id)).where(
        QuizSession.user_id == current_user.id
    )
    if doc_id is not None:
        count_stmt = count_stmt.where(QuizSession.doc_id == doc_id)

    count_result = await db.execute(count_stmt)
    total_count = count_result.scalar_one()

    # 2. Query for session rows
    stmt = (
        select(QuizSession)
        .where(QuizSession.user_id == current_user.id)
        .order_by(desc(QuizSession.created_at))
        .limit(limit)
        .offset(offset)
    )
    if doc_id is not None:
        stmt = stmt.where(QuizSession.doc_id == doc_id)

    result = await db.execute(stmt)
    sessions = result.scalars().all()

    response_items = [
        QuizHistoryItem(
            id=sess.id,
            doc_id=sess.doc_id,
            topic=sess.topic,
            total_questions=sess.total_questions,
            score=sess.score,
            created_at=sess.created_at,
        )
        for sess in sessions
    ]

    return QuizHistoryResponse(
        sessions=response_items,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/quizzes/{session_id}",
    response_model=QuizDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get graded quiz session details",
)
async def get_quiz_detail(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> QuizDetailResponse:
    """Retrieve the full details of a specific graded quiz session.

    This includes topic, score, and individual graded questions & student answers.
    """
    logger.info(
        "User %s requested details for quiz session %s",
        current_user.id,
        session_id,
    )

    # 1. Fetch session and eager load its answer relationships
    stmt = (
        select(QuizSession)
        .options(selectinload(QuizSession.answers))
        .where(
            QuizSession.id == session_id,
            QuizSession.user_id == current_user.id,
        )
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise StudyMateError("Quiz session not found.", status_code=404)

    # 2. Map answer relationships to Pydantic details
    response_answers = [
        QuizAnswerDetail(
            question_index=ans.question_index,
            selected_index=ans.selected_index,
            correct_index=ans.correct_index,
            is_correct=ans.is_correct,
        )
        for ans in session.answers
    ]

    return QuizDetailResponse(
        id=session.id,
        topic=session.topic,
        total_questions=session.total_questions,
        score=session.score,
        answers=response_answers,
        created_at=session.created_at,
    )
