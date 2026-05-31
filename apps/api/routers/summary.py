"""Summary API Router — implements grounded topic summary synthesis."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_generator, get_retriever
from models.database import ChatMessage, User, get_db
from models.schemas import SourceInfo, SummaryRequest, SummaryResponse
from services.activity_service import record_activity
from services.generator import Generator
from services.retriever import Retriever

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Summary"])


@router.post(
    "/generate",
    response_model=SummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a grounded topic summary",
)
async def generate_summary(
    request: SummaryRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
    retriever: Retriever = Depends(get_retriever),  # noqa: B008
    generator: Generator = Depends(get_generator),  # noqa: B008
) -> SummaryResponse:
    """Request a rich markdown summary of a specific academic topic.

    The summary is synthesized strictly from the context of the selected document (or globally if doc_id is null).
    """
    # 0. Check for a cached response for the exact same summary topic (case-insensitive and trimmed)
    # in the context of this specific user, document scope, and top_k context limit.
    from sqlalchemy import func, select

    # Format-aware cache key: different formats of the same topic are distinct rows,
    # so a cache hit always matches the requested format. The stored history `query`
    # keeps the legacy "Summary request:" prefix (the /stats summary count keys on
    # it) and appends the format for disambiguation.
    summary_query = f"Summary request: {request.topic} [format={request.format}]"

    stmt = (
        select(ChatMessage)
        .where(
            ChatMessage.user_id == current_user.id,
            ChatMessage.doc_id == request.doc_id,
            func.lower(func.trim(ChatMessage.query)) == summary_query.strip().lower(),
            ChatMessage.context_sufficient,
            func.jsonb_array_length(ChatMessage.sources) == request.top_k,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    cached_msg = result.scalar_one_or_none()

    if cached_msg:
        logger.info(
            "Cache HIT for topic summary '%s' (User: %s, Doc: %s, Top-K: %s). Reusing cached summary.",
            request.topic,
            current_user.id,
            request.doc_id,
            request.top_k,
        )

        # Save a new history entry reflecting this duplicate interaction
        new_msg = ChatMessage(
            user_id=current_user.id,
            doc_id=request.doc_id,
            query=summary_query,
            answer=cached_msg.answer,
            context_sufficient=cached_msg.context_sufficient,
            sources=cached_msg.sources,
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

        # Structured payload is not persisted, so a cache hit returns the cached
        # plain text with structured=None; the frontend renders the text fallback.
        return SummaryResponse(
            summary=cached_msg.answer,
            format=request.format,
            structured=None,
            context_sufficient=cached_msg.context_sufficient,
            sources=cached_sources,
        )

    # 1. Retrieve matching chunks from Qdrant for context
    matched_chunks = await retriever.retrieve_relevant_chunks(
        query=request.topic,
        doc_id=request.doc_id,
        top_k=request.top_k,
    )

    # 2. Synthesize the format-specific topic summary using Gemini
    summary, structured, context_sufficient = await generator.generate_summary(
        topic=request.topic,
        context=matched_chunks,
        summary_format=request.format,
    )

    # 3. Format matched chunks into API response sources
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

    # 4. Save the generated summary in the chat history table as a summary message.
    # Reuse the format-aware key built at the top so the cache lookup matches.
    db_message = ChatMessage(
        user_id=current_user.id,
        doc_id=request.doc_id,
        query=summary_query,
        answer=summary,
        context_sufficient=context_sufficient,
        sources=sources_dict,
    )
    db.add(db_message)
    await record_activity(db, current_user.id)
    await db.commit()
    await db.refresh(db_message)

    logger.info(
        "Generated summary saved to history (Message ID: %s, Format: %s, Context Sufficient: %s)",
        db_message.id,
        request.format,
        context_sufficient,
    )

    return SummaryResponse(
        summary=summary,
        format=request.format,
        structured=structured,
        context_sufficient=context_sufficient,
        sources=sources,
    )
