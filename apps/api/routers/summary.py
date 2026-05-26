"""Summary API Router — implements grounded topic summary synthesis."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_generator, get_retriever
from models.database import ChatMessage, User, get_db
from models.schemas import SourceInfo, SummaryRequest, SummaryResponse
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
    logger.info(
        "User %s requested topic summary: '%s' (doc_id: %s)",
        current_user.id,
        request.topic,
        request.doc_id,
    )

    # 1. Retrieve matching chunks from Qdrant for context
    matched_chunks = await retriever.retrieve_relevant_chunks(
        query=request.topic,
        doc_id=request.doc_id,
        top_k=request.top_k,
    )

    # 2. Synthesize structured topic summary using Gemini
    summary, context_sufficient = await generator.generate_summary(
        topic=request.topic,
        context=matched_chunks,
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

    # 4. Save the generated summary in the chat history table as a summary message
    summary_query = f"Summary request: {request.topic}"
    db_message = ChatMessage(
        user_id=current_user.id,
        doc_id=request.doc_id,
        query=summary_query,
        answer=summary,
        context_sufficient=context_sufficient,
        sources=sources_dict,
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)

    logger.info(
        "Generated summary saved to history (Message ID: %s, Context Sufficient: %s)",
        db_message.id,
        context_sufficient,
    )

    return SummaryResponse(
        summary=summary,
        context_sufficient=context_sufficient,
        sources=sources,
    )
