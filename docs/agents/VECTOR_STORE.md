# Agent Spec: Vector Store

**File:** `apps/api/services/vector_store.py`  
**Role:** Manage all interactions with the Qdrant vector database — storing, searching, and deleting document chunk embeddings.

---

## Responsibility

This agent owns **all Qdrant operations**. No other service touches Qdrant directly. It provides a clean interface for upserting document vectors, searching by semantic similarity, and removing documents.

---

## Qdrant Collection Setup

A single collection is used for all documents. Multi-document support is handled via payload filtering on `doc_id`.

```python
COLLECTION_NAME = "studymate_chunks"

# Collection configuration
VECTOR_SIZE = 3072          # gemini-embedding-001 default output dimensions
DISTANCE_METRIC = "Cosine"  # Cosine similarity for semantic search
```

### Payload Schema

Each point stored in Qdrant carries the following payload alongside its vector:

```python
{
    "chunk_id": "uuid-string",
    "doc_id": "uuid-string",
    "filename": "lecture_notes.pdf",
    "page_number": 12,
    "text": "The raw chunk text content...",
    "token_count": 487
}
```

---

## Operations

### 1. Initialize Collection

Create the collection if it doesn't exist. Called once at app startup.

```python
async def ensure_collection_exists(self) -> None:
    """Create the collection if it doesn't already exist."""
    # Check if collection exists
    # If not, create with vector_size=3072, distance=Cosine
```

### 2. Upsert Chunks

Store document chunks with their embeddings after a PDF upload.

```python
async def upsert_chunks(
    self,
    chunks: list[DocumentChunk],
    vectors: list[list[float]],
) -> int:
    """
    Store chunk vectors and metadata in Qdrant.
    Returns the number of points upserted.
    """
    # Build Qdrant PointStruct list
    # Each point: id=chunk.chunk_id, vector=vectors[i], payload={...}
    # Upsert in batches of UPSERT_BATCH_SIZE
```

### 3. Search

Find the most similar chunks to a query vector, optionally filtered by document.

```python
async def search(
    self,
    query_vector: list[float],
    top_k: int = 5,
    doc_id: str | None = None,
    score_threshold: float = 0.60,
) -> list[dict]:
    """
    Search for the top-k most similar chunks.
    Returns list of dicts with: chunk_id, doc_id, filename, page_number, text, score.
    Results below score_threshold are excluded.
    """
    # Build filter: if doc_id provided, filter by doc_id in payload
    # Run search with score_threshold
    # Map results to list of dicts
```

### 4. Delete by Document

Remove all chunks belonging to a specific document.

```python
async def delete_by_doc_id(self, doc_id: str) -> int:
    """
    Delete all points with the given doc_id.
    Returns the number of points deleted.
    """
    # Use Qdrant filter delete: match doc_id in payload
```



## Batching

Large uploads are upserted in batches to avoid Qdrant request size limits:

```python
UPSERT_BATCH_SIZE = 100  # points per upsert call
```

---

## Error Handling

| Condition | Response |
|---|---|
| Qdrant connection failure | Raise `ServiceUnavailableError("Vector store is unavailable. Try again.")` |
| Collection does not exist (search/delete) | Raise `ServiceUnavailableError("Vector store is not initialized.")` |
| Upsert failure | Raise `ServiceUnavailableError("Failed to store document vectors.")` |
| Empty vectors list | Return 0 (not an error) |
| doc_id not found (delete) | Return 0 (not an error — idempotent delete) |

---

## Configuration Constants

```python
# apps/api/core/config.py

QDRANT_URL = "https://your-cluster.cloud.qdrant.io"
QDRANT_API_KEY = "your-api-key"
COLLECTION_NAME = "studymate_chunks"
VECTOR_SIZE = 3072
UPSERT_BATCH_SIZE = 100
```

---

## Qdrant Client Setup

```python
from qdrant_client import QdrantClient
from qdrant_client.async_qdrant_client import AsyncQdrantClient

def get_qdrant_client(url: str, api_key: str) -> AsyncQdrantClient:
    """Create an async Qdrant client for use with FastAPI."""
    return AsyncQdrantClient(url=url, api_key=api_key)
```

The async client is used because all Qdrant operations happen inside FastAPI async route handlers. Using the sync client would block the event loop.

---

## Key Design Decisions

- **Single collection for all documents** — simpler than one collection per document. Multi-document isolation is handled via `doc_id` payload filtering, which Qdrant executes efficiently using payload indexes.
- **Payload index on `doc_id`** — should be created at collection init time for fast filtered searches.
- **Cosine distance** — matches the similarity metric used in the retrieval agent's threshold logic.
- **Vector size 3072** — this is the default output dimension of `gemini-embedding-001`. If using a different dimension (e.g., 768 via MRL), update this constant.
- **Async client** — Qdrant provides `AsyncQdrantClient` specifically for frameworks like FastAPI.
- **Idempotent deletes** — deleting a non-existent doc_id returns 0, not an error. This simplifies cleanup logic.

---

## Qdrant Cloud Free Tier Limits

| Resource | Limit |
|---|---|
| RAM | 1 GB |
| Disk | 4 GB |
| vCPU | 0.5 |
| Vectors (uncompressed, 3072-dim) | ~125,000 |
| Inactivity suspension | After 1 week |
| Inactivity deletion | After 4 weeks |

> For this project's scope (30 students, each uploading 1-3 PDFs with ~100-500 chunks each), the free tier capacity is more than sufficient.

---

## What This Agent Does NOT Do

- Does not generate embeddings — receives them from the Embedder
- Does not call Gemini
- Does not parse PDFs
- Does not handle HTTP routing
- Does not apply similarity thresholds — that's the Retriever's job (though Qdrant's `score_threshold` parameter is used as a pre-filter for efficiency)
