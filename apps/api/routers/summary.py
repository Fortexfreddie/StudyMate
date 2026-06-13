"""Summary API Router — implements grounded topic summary synthesis."""

import logging
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PERFORMANCE_MODES
from core.dependencies import get_current_user, get_generator, get_retriever
from core.errors import StudyMateError
from core.rate_limit import LLM_LIMIT, limiter
from models.database import Document, SummaryHistory, User, get_db
from models.schemas import GenerationMeta, SourceInfo, SummaryRequest, SummaryResponse
from services.activity_service import record_activity
from services.generator import Generator
from services.retriever import Retriever
from services.token_service import (
    estimate_request_tokens,
    reconcile_tokens,
    record_token_usage,
    release_tokens,
    reserve_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Summary"])


@router.post(
    "/generate",
    response_model=SummaryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a grounded topic summary",
)
@limiter.limit(LLM_LIMIT)
async def generate_summary(
    request: Request,
    payload: SummaryRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
    retriever: Retriever = Depends(get_retriever),  # noqa: B008
    generator: Generator = Depends(get_generator),  # noqa: B008
) -> SummaryResponse:
    """Request a rich markdown summary of a specific academic topic.

    The summary is synthesized strictly from the context of the selected document
    (or globally if doc_id is null).
    """
    # 1. Compute effective top_k — user's explicit value wins, otherwise use mode default
    effective_top_k = (
        payload.top_k if payload.top_k is not None else generator.default_top_k
    )

    # 1.5. Verify document ownership / retrieve allowed doc IDs for security
    user_doc_ids = None
    if payload.doc_id is not None:
        stmt_doc = select(Document).where(
            Document.id == payload.doc_id, Document.user_id == current_user.id
        )
        doc_res = await db.execute(stmt_doc)
        if not doc_res.scalar_one_or_none():
            raise StudyMateError(
                "Document not found or access denied.", status_code=404
            )
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

    # 2. Check for a cached response.
    #    Only doc-scoped summaries are cacheable: a document's content is immutable
    #    once uploaded. Global summaries (doc_id is None) span the user's whole —
    #    mutable — document set and can go stale when a new doc is added, so they
    #    are never served from cache.
    cached_msg = None
    if payload.doc_id is not None and not payload.full_document:
        stmt = (
            select(SummaryHistory)
            .where(
                SummaryHistory.user_id == current_user.id,
                SummaryHistory.doc_id == payload.doc_id,
                func.lower(func.trim(SummaryHistory.topic))
                == payload.topic.strip().lower(),
                SummaryHistory.format == payload.format,
                SummaryHistory.performance_mode == generator.performance_mode,
                SummaryHistory.context_sufficient,
            )
            .order_by(SummaryHistory.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        cached_msg = result.scalar_one_or_none()

    if cached_msg:
        logger.info(
            "Cache HIT for topic summary '%s' (User: %s, Doc: %s, Top-K: %s).",
            payload.topic,
            current_user.id,
            payload.doc_id,
            effective_top_k,
        )

        new_msg = SummaryHistory(
            user_id=current_user.id,
            doc_id=payload.doc_id,
            topic=payload.topic,
            summary_text=cached_msg.summary_text,
            format=payload.format,
            structured=cached_msg.structured,
            context_sufficient=cached_msg.context_sufficient,
            sources=cached_msg.sources,
            performance_mode=generator.performance_mode,
        )
        db.add(new_msg)
        await record_activity(db, current_user.id)
        await db.commit()
        await db.refresh(new_msg)

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

        return SummaryResponse(
            summary=cached_msg.summary_text,
            format=payload.format,
            structured=cast(Any, cached_msg.structured),
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

    if payload.full_document and payload.doc_id is None:
        raise StudyMateError(
            "A specific document must be selected to generate a full document summary.",
            status_code=400,
        )

    # 3. Retrieve matching chunks from Qdrant for context
    if payload.full_document and payload.doc_id is not None:
        matched_chunks = await retriever.retrieve_document_sequential(
            doc_id=payload.doc_id,
            top_k=effective_top_k,
        )
    else:
        matched_chunks = await retriever.retrieve_relevant_chunks(
            query=payload.topic,
            doc_id=payload.doc_id,
            doc_ids=user_doc_ids,
            top_k=effective_top_k,
        )

    # 4. Reserve the estimated token cost atomically BEFORE the LLM call.
    context_text = " ".join(str(c.get("text") or "") for c in matched_chunks)
    estimate = estimate_request_tokens(context_text, payload.topic, "summary")
    allowed, _used, limit = await reserve_tokens(
        current_user.id, current_user.effective_is_pro, estimate
    )
    if not allowed:
        raise StudyMateError(
            f"Daily token limit reached ({limit:,} tokens). Upgrade to Pro for more.",
            status_code=403,
        )

    # 5. Synthesize the format-specific topic summary using Gemini. On failure,
    #    refund the reservation and surface a 503 — never persist or charge it.
    try:
        (
            summary,
            structured,
            context_sufficient,
            usage,
        ) = await generator.generate_summary(
            topic=payload.topic,
            context=matched_chunks,
            summary_format=payload.format,
        )
    except Exception:
        await release_tokens(current_user.id, estimate)
        raise

    # 6. Reconcile the reservation against actual usage + log the per-request row.
    await reconcile_tokens(
        current_user.id, estimate, int(usage.get("total_tokens", 0) or 0)
    )
    await record_token_usage(
        db, current_user.id, usage, "summary", generator.performance_mode
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

    # 7. Save the generated summary in the SummaryHistory table
    db_message = SummaryHistory(
        user_id=current_user.id,
        doc_id=payload.doc_id,
        topic=payload.topic,
        summary_text=summary,
        format=payload.format,
        structured=structured,
        context_sufficient=context_sufficient,
        sources=sources_dict,
        performance_mode=generator.performance_mode,
    )
    db.add(db_message)
    await record_activity(db, current_user.id)
    await db.commit()
    await db.refresh(db_message)

    logger.info(
        "Generated summary saved to history (Message ID: %s, Format: %s, Context Sufficient: %s)",
        db_message.id,
        payload.format,
        context_sufficient,
    )

    return SummaryResponse(
        summary=summary,
        format=payload.format,
        structured=structured,
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
