# Agent Spec: Embedder

**File:** `apps/api/services/embedder.py`  
**Role:** Convert text (document chunks or user queries) into vector embeddings using Google's embedding model.

---

## Responsibility

This agent owns **all embedding operations**. It wraps the Google embedding API and provides two functions: batch embedding for document chunks during upload, and single embedding for user queries during retrieval.

---

## Inputs

### For Batch Embedding (document upload)

| Parameter | Type | Description |
|---|---|---|
| `texts` | `list[str]` | List of chunk text strings to embed |

### For Single Embedding (query)

| Parameter | Type | Description |
|---|---|---|
| `text` | `str` | A single text string (the user's query) to embed |

---

## Outputs

### Batch Embedding
Returns `list[list[float]]` — one vector per input text.

### Single Embedding
Returns `list[float]` — a single vector.

---

## Implementation

```python
from langchain_google_genai import GoogleGenerativeAIEmbeddings

EMBEDDING_MODEL = "models/gemini-embedding-001"

class Embedder:
    def __init__(self, api_key: str) -> None:
        self._client = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            google_api_key=api_key,
        )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Used during document upload."""
        return await self._client.aembed_documents(texts)

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query. Used during retrieval."""
        return await self._client.aembed_query(text)
```

---

## Batching Strategy

For large documents with many chunks (100+), embeddings are processed in batches to avoid API timeouts and rate limits:

```python
EMBEDDING_BATCH_SIZE = 50  # chunks per API call

async def embed_texts_batched(self, texts: list[str]) -> list[list[float]]:
    results: list[list[float]] = []
    for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[i : i + EMBEDDING_BATCH_SIZE]
        batch_embeddings = await self._client.aembed_documents(batch)
        results.extend(batch_embeddings)
    return results
```

---

## Error Handling

| Condition | Response |
|---|---|
| Empty text list | Return `[]` (not an error) |
| Empty string in text list | Skip it, log warning |
| Google API rate limit (429) | Retry with exponential backoff (max 3 attempts) |
| Google API error (network, 5xx) | Raise `ServiceUnavailableError("Embedding service is unavailable. Try again.")` |
| Invalid API key | Raise `ConfigurationError("Google API key is invalid or missing.")` |

---

## Configuration Constants

```python
# apps/api/core/config.py

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_BATCH_SIZE = 50
```

---

## Key Design Decisions

- **Same model for chunks and queries** — `gemini-embedding-001` is used for both to ensure vectors exist in the same semantic space. Using different models would make cosine similarity meaningless.
- **Async methods** — all embedding calls are async to avoid blocking FastAPI's event loop during document upload.
- **`langchain-google-genai`** is used as the wrapper rather than calling the `google-genai` SDK directly, because LangChain's `GoogleGenerativeAIEmbeddings` class handles API key injection, retry logic, and async support cleanly.
- **Batch size of 50** balances throughput against API rate limits. A 200-chunk document requires 4 API calls rather than 200.

---

## What This Agent Does NOT Do

- Does not call Qdrant
- Does not call Gemini for text generation
- Does not parse PDFs
- Does not handle HTTP routing
- Does not decide which texts to embed — it receives them from the caller
