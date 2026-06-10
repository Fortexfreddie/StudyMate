"""Quiz API Router — implements quiz generation and submission endpoints."""

import logging
import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_generator, get_retriever
from core.errors import StudyMateError
from core.rate_limit import LLM_LIMIT, limiter
from models.database import Document, QuizAnswer, QuizSession, User, get_db
from models.schemas import (
    AnswerResult,
    GenerationMeta,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizQuestion,
    QuizSubmitRequest,
    QuizSubmitResponse,
    SourceInfo,
)
from services.activity_service import record_activity
from services.generator import Generator
from services.retriever import Retriever
from services.token_service import check_token_budget, record_token_usage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Quiz"])


@router.post(
    "/generate",
    response_model=QuizGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a multiple-choice academic quiz",
)
@limiter.limit(LLM_LIMIT)
async def generate_quiz(
    request: Request,
    payload: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
    retriever: Retriever = Depends(get_retriever),  # noqa: B008
    generator: Generator = Depends(get_generator),  # noqa: B008
) -> QuizGenerateResponse:
    """Generate a custom multiple-choice study quiz on a topic.

    The questions are synthesized strictly from the retrieved document context.
    A quiz session is created in the database to track submission and grading.
    """
    # 0. Check token budget
    allowed, remaining, limit = await check_token_budget(
        db, current_user.id, current_user.is_pro
    )
    if not allowed:
        raise StudyMateError(
            f"Daily token limit reached ({limit:,} tokens). Upgrade to Pro for more.",
            status_code=403,
        )

    logger.info(
        "User %s initiated quiz generation on topic: '%s' (doc_id: %s, count: %d, mode: %s)",
        current_user.id,
        payload.topic,
        payload.doc_id,
        payload.num_questions,
        generator.performance_mode,
    )

    # 1. Compute effective top_k — user's explicit value wins, otherwise use mode default
    effective_top_k = payload.top_k if payload.top_k is not None else generator.default_top_k

    # 1.5. Verify document ownership / retrieve allowed doc IDs for security
    user_doc_ids = None
    if payload.doc_id is not None:
        stmt_doc = select(Document).where(
            Document.id == payload.doc_id, Document.user_id == current_user.id
        )
        doc_res = await db.execute(stmt_doc)
        if not doc_res.scalar_one_or_none():
            raise StudyMateError("Document not found or access denied.", status_code=404)
    else:
        # Global query: fetch all doc IDs owned by user to restrict search
        stmt_docs = select(Document.id).where(Document.user_id == current_user.id)
        docs_res = await db.execute(stmt_docs)
        user_doc_ids = list(docs_res.scalars().all())
        if not user_doc_ids:
            raise StudyMateError(
                "You haven't uploaded any documents yet. Please upload study materials first.",
                status_code=400,
            )

    # 2. Retrieve highly relevant grounding context chunks
    matched_chunks = await retriever.retrieve_relevant_chunks(
        query=payload.topic,
        doc_id=payload.doc_id,
        doc_ids=user_doc_ids,
        top_k=effective_top_k,
    )

    # 3. Command Gemini to generate structured multiple-choice questions
    generated_questions, usage = await generator.generate_quiz(
        topic=payload.topic,
        context=matched_chunks,
        num_questions=payload.num_questions,
    )

    # 4. Record token usage (best-effort)
    await record_token_usage(
        db, current_user.id, usage, "quiz", generator.performance_mode
    )

    # 5. Store the full session in the database
    db_session = QuizSession(
        user_id=current_user.id,
        doc_id=payload.doc_id,
        topic=payload.topic,
        total_questions=len(generated_questions),
        questions=generated_questions,
        score=0,
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)

    # 6. Map sources to API schema
    sources: list[SourceInfo] = []
    for chunk in matched_chunks:
        filename = chunk.get("filename") or "Unknown Document"
        page = int(chunk.get("page_number") or 1)
        score = float(chunk.get("score") or 0.0)
        text = chunk.get("text") or ""

        sources.append(
            SourceInfo(
                filename=filename,
                page_number=page,
                similarity_score=score,
                text_preview=text[:200] + "..." if len(text) > 200 else text,
            )
        )

    # 7. Format the Pydantic quiz questions list for the response
    response_questions = [
        QuizQuestion(
            question=item["question"],
            options=item["options"],
            correct_index=item["correct_index"],
            explanation=item["explanation"],
        )
        for item in generated_questions
    ]

    logger.info(
        "Quiz session successfully saved to DB (Session ID: %s, Questions: %d)",
        db_session.id,
        db_session.total_questions,
    )

    return QuizGenerateResponse(
        session_id=db_session.id,
        topic=db_session.topic,
        questions=response_questions,
        sources=sources,
        meta=GenerationMeta(
            model_used=str(usage.get("model_used", "")),
            performance_mode=generator.performance_mode,
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
            total_tokens=int(usage.get("total_tokens", 0)),
            cached=False,
            retrieval_chunks_used=len(matched_chunks),
        ),
    )


@router.post(
    "/{session_id}/submit",
    response_model=QuizSubmitResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit answers and grade a quiz session",
)
async def submit_quiz(
    session_id: uuid.UUID,
    request: QuizSubmitRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> QuizSubmitResponse:
    """Submit answers for an active quiz session to be graded.

    Grades each selection using the stored correct_index from the generation,
    logs individual answers to the database, and updates the session score.
    The grading is done server-side — the client never sees correct answers
    until after submission.
    """
    logger.info(
        "User %s submitted answers for quiz session %s",
        current_user.id,
        session_id,
    )

    # 1. Retrieve the quiz session
    result = await db.execute(
        select(QuizSession).where(
            QuizSession.id == session_id,
            QuizSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise StudyMateError("Quiz session not found.", status_code=404)

    # Check if quiz has already been submitted
    answers_exist_stmt = select(func.count(QuizAnswer.id)).where(
        QuizAnswer.session_id == session_id
    )
    answers_exist_result = await db.execute(answers_exist_stmt)
    if answers_exist_result.scalar_one() > 0:
        raise StudyMateError(
            "Quiz session has already been submitted.",
            status_code=status.HTTP_409_CONFLICT,
        )

    # 2. Map submissions by question index for quick lookup
    submission_map = {ans.question_index: ans.selected_index for ans in request.answers}

    # 3. Grade each question — using the stored correct_index from generation
    results: list[AnswerResult] = []
    correct_count = 0

    for idx, question in enumerate(session.questions):
        selected_idx = submission_map.get(idx)
        if selected_idx is None:
            # Default to -1 (guaranteed wrong) if the student skipped
            selected_idx = -1

        correct_val = question.get("correct_index", 0)
        correct_idx = int(correct_val) if isinstance(correct_val, int | str) else 0

        # Clamp correct_idx to valid range [0, 3]
        correct_idx = max(0, min(3, correct_idx))

        is_correct = selected_idx == correct_idx
        explanation = str(question.get("explanation") or "")

        if is_correct:
            correct_count += 1

        results.append(
            AnswerResult(
                question_index=idx,
                selected_index=max(0, selected_idx),  # Clamp for response schema
                correct_index=correct_idx,
                is_correct=is_correct,
                explanation=explanation,
            )
        )

        # Persist separate answer row
        db_answer = QuizAnswer(
            session_id=session.id,
            question_index=idx,
            selected_index=max(0, selected_idx),
            correct_index=correct_idx,
            is_correct=is_correct,
        )
        db.add(db_answer)

    # 4. Update and commit quiz session score
    session.score = correct_count
    await record_activity(db, current_user.id)
    await db.commit()

    logger.info(
        "Quiz session %s graded: %d/%d correct",
        session.id,
        correct_count,
        session.total_questions,
    )

    return QuizSubmitResponse(
        session_id=session.id,
        score=correct_count,
        total_questions=session.total_questions,
        results=results,
    )
