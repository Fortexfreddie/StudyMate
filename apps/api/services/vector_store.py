"""Vector Store service — manages indexing, searches, and deletion in Qdrant."""

import logging

from qdrant_client.async_qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from core.config import settings
from core.errors import ServiceUnavailableError
from services.pdf_processor import DocumentChunk

logger = logging.getLogger(__name__)


class VectorStore:
    """Handles async CRUD operations and semantic search against Qdrant collection."""

    def __init__(self, client: AsyncQdrantClient) -> None:
        self._client = client
        self._collection = settings.COLLECTION_NAME

    async def ensure_collection_exists(self) -> None:
        """Create collection and construct payload index on startup if not present."""
        try:
            exists = await self._client.collection_exists(self._collection)
            if not exists:
                logger.info(
                    "Qdrant collection '%s' does not exist. Creating.", self._collection
                )
                # Create collection with Cosine similarity distance and 3072 dims
                await self._client.create_collection(
                    collection_name=self._collection,
                    vectors_config=VectorParams(
                        size=settings.VECTOR_SIZE,
                        distance=Distance.COSINE,
                    ),
                )

                # Create payload index on doc_id field for fast filtered searches
                await self._client.create_payload_index(
                    collection_name=self._collection,
                    field_name="doc_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                logger.info("Qdrant collection and indexes created successfully.")
            else:
                logger.debug("Qdrant collection '%s' already exists.", self._collection)
        except Exception as e:
            logger.exception("Failed to connect or initialize Qdrant collection.")
            raise ServiceUnavailableError("Vector store is not initialized.") from e

    async def upsert_chunks(
        self, chunks: list[DocumentChunk], vectors: list[list[float]]
    ) -> int:
        """Store chunk vectors and payloads in Qdrant in batches."""
        if not chunks or not vectors:
            return 0

        if len(chunks) != len(vectors):
            raise ValueError("Chunks count must exactly match vectors count.")

        points: list[PointStruct] = []
        for idx, chunk in enumerate(chunks):
            points.append(
                PointStruct(
                    id=chunk.chunk_id,
                    vector=vectors[idx],
                    payload={
                        "chunk_id": chunk.chunk_id,
                        "doc_id": chunk.doc_id,
                        "filename": chunk.filename,
                        "page_number": chunk.page_number,
                        "text": chunk.text,
                        "token_count": chunk.token_count,
                    },
                )
            )

        batch_size = settings.UPSERT_BATCH_SIZE
        try:
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                await self._client.upsert(
                    collection_name=self._collection,
                    points=batch,
                )
            logger.info("Successfully upserted %s chunks to Qdrant.", len(points))
            return len(points)
        except Exception as e:
            logger.exception("Failed to upsert chunks into Qdrant.")
            raise ServiceUnavailableError("Failed to store document vectors.") from e

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        doc_id: str | None = None,
        score_threshold: float = 0.60,
    ) -> list[dict]:  # type: ignore[type-arg]
        """Retrieve most similar points from Qdrant, filtered by threshold."""
        query_filter = None
        if doc_id:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="doc_id",
                        match=MatchValue(value=doc_id),
                    )
                ]
            )

        try:
            results = await self._client.query_points(
                collection_name=self._collection,
                query=query_vector,
                query_filter=query_filter,
                limit=top_k,
                score_threshold=score_threshold,
            )

            matched_chunks: list[dict] = []  # type: ignore[type-arg]
            for point in results.points:
                payload = point.payload or {}
                matched_chunks.append(
                    {
                        "chunk_id": payload.get("chunk_id"),
                        "doc_id": payload.get("doc_id"),
                        "filename": payload.get("filename"),
                        "page_number": payload.get("page_number"),
                        "text": payload.get("text"),
                        "score": point.score,
                    }
                )

            return matched_chunks
        except Exception as e:
            logger.exception("Failed to query vectors from Qdrant.")
            raise ServiceUnavailableError(
                "Vector store is unavailable. Try again."
            ) from e

    async def delete_by_doc_id(self, doc_id: str) -> int:
        """Purge all chunks belonging to a document from Qdrant."""
        try:
            # Delete points using payload match filter
            res = await self._client.delete(
                collection_name=self._collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="doc_id",
                            match=MatchValue(value=doc_id),
                        )
                    ]
                ),
            )
            logger.info(
                "Successfully requested purge for doc_id '%s' in Qdrant.", doc_id
            )
            return 1 if res else 0
        except Exception as e:
            logger.exception("Failed to delete points from Qdrant.")
            raise ServiceUnavailableError(
                "Vector store is unavailable. Try again."
            ) from e
