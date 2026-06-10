"""Chat API Router — implements the RAG conversation endpoint."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PERFORMANCE_MODES
from core.dependencies import get_current_user, get_generator, get_retriever
from core.errors import StudyMateError
from core.rate_limit import LLM_LIMIT, limiter
from models.database import ChatMessage, User, get_db
from models.schemas import ChatRequest, ChatResponse, GenerationMeta, SourceInfo
from services.activity_service import record_activity
from services.generator import Generator
from services.retriever import Retriever
from services.token_service import check_token_budget, record_token_usage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat"])


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Chat with documents using RAG",
)
@limiter.limit(LLM_LIMIT)
async def chat_with_docs(
    request: Request,
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
    retriever: Retriever = Depends(get_retriever),  # noqa: B008
    generator: Generator = Depends(get_generator),  # noqa: B008
) -> ChatResponse:
    """Submit a query to chat with uploaded study materials.

    If `doc_id` is supplied, the conversation is grounded strictly within that document.
    If `doc_id` is omitted, the retrieval executes globally across all user documents.
    """
    # 0. Check token budget before any expensive work
    allowed, remaining, limit = await check_token_budget(
        db, current_user.id, current_user.is_pro
    )
    if not allowed:
        raise StudyMateError(
            f"Daily token limit reached ({limit:,} tokens). Upgrade to Pro for more.",
            status_code=403,
        )

    # 1. Compute effective top_k — user's explicit value wins, otherwise use mode default
    effective_top_k = payload.top_k if payload.top_k is not None else generator.default_top_k

    # 2. Check for a cached response
    stmt = (
        select(ChatMessage)
        .where(
            ChatMessage.user_id == current_user.id,
            ChatMessage.doc_id == payload.doc_id,
            func.lower(func.trim(ChatMessage.query)) == payload.query.strip().lower(),
            ChatMessage.context_sufficient,
            ChatMessage.performance_mode == generator.performance_mode,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    cached_msg = result.scalar_one_or_none()

    if cached_msg:
        logger.info(
            "Cache HIT for query '%s' (User: %s, Doc: %s). Reusing cached answer.",
            payload.query,
            current_user.id,
            payload.doc_id,
        )

        # Save a new history entry reflecting this duplicate interaction
        new_msg = ChatMessage(
            user_id=current_user.id,
            doc_id=payload.doc_id,
            query=payload.query,
            answer=cached_msg.answer,
            context_sufficient=cached_msg.context_sufficient,
            sources=cached_msg.sources,
            performance_mode=generator.performance_mode,
        )
        db.add(new_msg)
        await record_activity(db, current_user.id)
        await db.commit()
        await db.refresh(new_msg)

        # Map DB sources back to Pydantic schemas
        cached_sources = []
        if cached_msg.sources:
            for s in cached_msg.sources:
                p_val = s.get("page_number")
                s_val = s.get("similarity_score")
                page = int(p_val) if isinstance(p_val, int | str) else 1
                score = float(s_val) if isinstance(s_val, float | int | str) else 0.0

                cached_sources.append(
                    SourceInfo(
                        filename=str(s.get("filename") or "Unknown Document"),
                        page_number=page,
                        similarity_score=score,
                        text_preview=str(s.get("text_preview") or ""),
                    )
                )

        return ChatResponse(
            answer=cached_msg.answer,
            context_sufficient=cached_msg.context_sufficient,
            sources=cached_sources,
            meta=GenerationMeta(
                model_used=str(
                    PERFORMANCE_MODES.get(
                        cached_msg.performance_mode or "high", {}
                    ).get("primary", "cached")
                ),
                performance_mode=generator.performance_mode,
                cached=True,
                retrieval_chunks_used=len(cached_sources),
            ),
        )

    # 3. Retrieve the most relevant chunks from Qdrant
    matched_chunks = await retriever.retrieve_relevant_chunks(
        query=payload.query,
        doc_id=payload.doc_id,
        top_k=effective_top_k,
    )

    # 4. Synthesize the grounded response using Gemini
    answer, context_sufficient, usage = await generator.generate_answer(
        query=payload.query,
        context=matched_chunks,
    )

    # 5. Record token usage (best-effort)
    await record_token_usage(
        db, current_user.id, usage, "chat", generator.performance_mode
    )

    # 6. Format matched chunks into API response sources
    sources: list[SourceInfo] = []
    sources_dict: list[dict[str, Any]] = []

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

        sources_dict.append(
            {
                "filename": filename,
                "page_number": page,
                "similarity_score": score,
                "text_preview": text,
            }
        )

    # 7. Save the interaction into the PostgreSQL database history
    db_message = ChatMessage(
        user_id=current_user.id,
        doc_id=payload.doc_id,
        query=payload.query,
        answer=answer,
        context_sufficient=context_sufficient,
        sources=sources_dict,
        performance_mode=generator.performance_mode,
    )
    db.add(db_message)
    await record_activity(db, current_user.id)
    await db.commit()
    await db.refresh(db_message)

    logger.info(
        "Chat interaction saved to history (Message ID: %s, Context Sufficient: %s)",
        db_message.id,
        context_sufficient,
    )

    return ChatResponse(
        answer=answer,
        context_sufficient=context_sufficient,
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
