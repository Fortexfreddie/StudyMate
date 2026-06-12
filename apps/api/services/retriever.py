"""Retriever service — orchestrates semantic similarity searches against Qdrant."""

import logging
import uuid
from typing import Any

from core.config import settings
from services.embedder import Embedder
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)


class Retriever:
    """Handles query embedding generation and semantic vector search orchestration."""

    def __init__(self, vector_store: VectorStore, embedder: Embedder) -> None:
        self.vector_store = vector_store
        self.embedder = embedder

    async def retrieve_relevant_chunks(
        self,
        query: str,
        doc_id: uuid.UUID | None = None,
        doc_ids: list[uuid.UUID] | None = None,
        top_k: int | None = None,
        score_threshold: float | None = None,
    ) -> list[dict[str, Any]]:
        """Embeds the query, searches Qdrant, and filters by similarity score."""
        target_top_k = top_k if top_k is not None else settings.DEFAULT_TOP_K
        target_threshold = (
            score_threshold
            if score_threshold is not None
            else settings.RETRIEVAL_SIMILARITY_THRESHOLD
        )

        doc_id_str = str(doc_id) if doc_id is not None else None
        doc_ids_str = [str(d) for d in doc_ids] if doc_ids is not None else None

        logger.info(
            "Performing semantic retrieval for query: '%s' (doc_id: %s, doc_ids_count: %s, top_k: %d, threshold: %.2f)",
            query,
            doc_id_str,
            len(doc_ids_str) if doc_ids_str is not None else "None",
            target_top_k,
            target_threshold,
        )

        # 1. Generate search query embedding
        query_vector = await self.embedder.embed_query(query)

        # 2. Query the vector store
        matched_chunks = await self.vector_store.search(
            query_vector=query_vector,
            top_k=target_top_k,
            doc_id=doc_id_str,
            doc_ids=doc_ids_str,
            score_threshold=target_threshold,
        )

        logger.info("Retrieved %d matching chunks from Qdrant.", len(matched_chunks))
        return matched_chunks

    async def retrieve_document_sequential(
        self,
        doc_id: uuid.UUID,
        top_k: int | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve chunks from a specific document ordered by page number, bypass similarity threshold."""
        target_top_k = top_k if top_k is not None else settings.DEFAULT_TOP_K
        doc_id_str = str(doc_id)

        logger.info(
            "Performing sequential document retrieval for doc_id: %s (limit: %d)",
            doc_id_str,
            target_top_k,
        )

        matched_chunks = await self.vector_store.get_chunks_by_doc_id(
            doc_id=doc_id_str,
            limit=target_top_k,
        )

        logger.info("Retrieved %d sequential chunks from Qdrant.", len(matched_chunks))
        return matched_chunks
