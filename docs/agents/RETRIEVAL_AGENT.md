# Agent Spec: Retrieval Agent

**File:** `apps/api/services/retriever.py`  
**Role:** Given a user query, find the most semantically relevant document chunks from the vector store.

---

## Responsibility

This agent owns the **semantic search step** of the RAG pipeline. It converts a query into a vector and retrieves the top-k most relevant chunks stored in Qdrant. It is the bridge between user intent and grounded context.

---

## Inputs

| Parameter | Type | Description |
|---|---|---|
| `query` | `str` | The student's natural language query or topic |
| `doc_id` | `str \| None` | If provided, search only within this document. If None, search across all documents. |
| `top_k` | `int` | Number of chunks to retrieve (default: 5) |

---

## Outputs

Returns a list of `RetrievedChunk` objects:

```python
@dataclass
class RetrievedChunk:
    chunk_id: str
    doc_id: str
    filename: str
    page_number: int
    text: str
    similarity_score: float     # Cosine similarity score (0.0 – 1.0)
```

---

## Pipeline

```
[User Query: string]
    │
    ▼
1. Validate query (not empty, not too short)
    │
    ▼
2. Embed query using gemini-embedding-2
   → returns query_vector: list[float]
3. Run cosine similarity search in Qdrant
   - Filter by doc_id if provided
   - Retrieve top_k results
    │
    ▼
4. Filter out results below similarity threshold (0.60)
    │
    ▼
5. Map Qdrant results → List[RetrievedChunk]
    │
    ▼
6. Return chunks (ordered by similarity_score DESC)
```

---

## Similarity Threshold

- Chunks with a similarity score below **0.60** are discarded, even if they are in the top-k.
- If all top-k results fall below the threshold, return an empty list and let the generation layer handle the "no relevant context found" case gracefully.
- This threshold is configurable via `RETRIEVAL_SIMILARITY_THRESHOLD` in `core/config.py`.

---

## Error Handling

| Condition | Response |
|---|---|
| Query is empty string | Raise `ValueError("Query cannot be empty.")` |
| Query is less than 3 characters | Raise `ValueError("Query is too short to retrieve meaningful results.")` |
| Qdrant connection failure | Raise `ServiceUnavailableError("Vector store is unavailable. Try again.")` |
| Embedding API failure | Raise `ServiceUnavailableError("Embedding service is unavailable. Try again.")` |
| No results above threshold | Return `[]` (empty list — not an error) |

---

## Configuration Constants

```python
# apps/api/core/config.py
DEFAULT_TOP_K = 5
RETRIEVAL_SIMILARITY_THRESHOLD = 0.60
```

---
## Key Design Decisions

- **Same embedding model for queries and chunks** (`gemini-embedding-2`) — this is critical. If chunks were embedded with one model and queries with another, similarity scores would be meaningless.
- **doc_id filtering** allows the student to constrain search to a single uploaded document, which is the primary use case. Searching all documents is the fallback for future multi-document sessions.
- **Similarity threshold** prevents low-quality matches from polluting the generation context. A chunk that scores 0.30 is essentially unrelated and should never reach Gemini.
- **Ordered by similarity score** so the most relevant chunk is always first — the generation layer uses this ordering when assembling the prompt.

---
## What This Agent Does NOT Do

- Does not call Gemini
- Does not generate any text
- Does not modify the vector store
- Does not handle the HTTP layer
- Does not know what the chunks will be used for (quiz, summary, or chat)
