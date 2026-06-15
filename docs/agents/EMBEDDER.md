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

`Embedder` is constructed with `api_keys: list[str]` — the primary key plus optional
`GOOGLE_API_KEY_2` / `GOOGLE_API_KEY_3` fallbacks (blanks are filtered; at least one is
required). It builds one `GoogleGenerativeAIEmbeddings` client per key and fails over
between them on daily-quota exhaustion.

```python
from langchain_google_genai import GoogleGenerativeAIEmbeddings

EMBEDDING_MODEL = "models/gemini-embedding-2"

class Embedder:
    def __init__(self, api_keys: list[str]) -> None:
        valid = [k for k in api_keys if k and k.strip()]
        if not valid:
            raise ConfigurationError("At least one Google API key is required.")
        self._clients = [
            GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL, google_api_key=SecretStr(k))
            for k in valid
        ]
        self._current_idx = 0
        self._exhausted_at: dict[int, float] = {}  # key index -> time it hit daily quota

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts (batched). Used during document upload."""
        ...

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query. Used during retrieval."""
        ...
```

All API calls go through `_call_with_retry`, which handles both rate-limit backoff and
multi-key daily-quota failover (see *Error Handling* below).

---

## Batching Strategy

For large documents with many chunks (100+), embeddings are processed in batches to
maximise throughput and stay within the embedding API's per-request limits:

```python
EMBEDDING_BATCH_SIZE = 100          # texts per API call
EMBEDDING_BATCH_DELAY_SECONDS = 0.2 # light courtesy pause between batches

async def embed_texts_batched(self, texts: list[str]) -> list[list[float]]:
    results: list[list[float]] = []
    for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[i : i + EMBEDDING_BATCH_SIZE]
        batch_embeddings = await self._client.aembed_documents(batch)
        results.extend(batch_embeddings)
        # token-per-minute gated, not RPM — so spacing is light, not the throttle
        await asyncio.sleep(EMBEDDING_BATCH_DELAY_SECONDS)
    return results
```

### Model input limits (per Google docs)

| Model | Max input tokens **per text** | Status |
|---|---|---|
| `gemini-embedding-2` (current) | **8,192** (shared across modalities; silently truncates over-limit input) | Recommended |
| `gemini-embedding-001` | 2,048 | Available, *not recommended* for new projects |

Our chunks are ~500 tokens (`DEFAULT_CHUNK_SIZE`), so **individual chunks are never
truncated** on either model. Free-tier embedding quota is gated by **tokens-per-minute**,
not requests-per-minute — which is why `EMBEDDING_BATCH_DELAY_SECONDS` is a light courtesy
pause (set it to `0` to disable) and real rate-limit hits are handled reactively by
`_call_with_retry`'s backoff. The two embedding models live in **incompatible** vector
spaces; switching models requires re-embedding every stored document.

> **Ingestion runs in the background.** `embed_texts` is invoked from a FastAPI
> background task (see `DOCUMENT_PROCESSOR.md`), *not* inline in the upload request, so a
> long document's embedding run can no longer exceed the platform request timeout.

---

## Error Handling

| Condition | Response |
|---|---|
| Empty text list | Return `[]` (not an error) |
| Empty string in text list | Skip it, log warning |
| **Daily-quota 429** (`PerDay` quotaId) | Mark current key exhausted, switch to the next available key, retry immediately |
| All keys' daily quota exhausted | Raise `QuotaExhaustedError` (**429**) → router returns 429 "try again later" |
| **RPM rate limit** (per-minute 429) | Exponential backoff on the *same* key (up to 5 attempts; honors Google's `retryDelay` when present) |
| Google API error (network, 5xx, non-quota) | Raise `ServiceUnavailableError` (**503**) |
| No valid keys supplied | Raise `ConfigurationError("At least one Google API key is required.")` |

### Multi-key failover & time-aware exhaustion

The free-tier daily quota is **per key**, so on a daily-quota error the embedder switches
keys rather than waiting. Key order: `GOOGLE_API_KEY` → `GOOGLE_API_KEY_2` →
`GOOGLE_API_KEY_3`. A key marked exhausted is skipped only for `_QUOTA_RESET_SECONDS`
(**24h**) after it failed, then becomes eligible again automatically — no process restart
required. (Google's RPD quota resets at midnight Pacific / 08:00 UTC; a 24h cooldown
clears it safely regardless of when the key was exhausted.)

> **Status-code note:** the embedder raises **429** (`QuotaExhaustedError`) when all keys
> are exhausted; the generator raises **503** in the equivalent case (its public methods
> normalize all failures to 503). See `GENERATION_AGENT.md`.

---

## Configuration Constants

```python
# apps/api/core/config.py

EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_BATCH_SIZE = 100            # texts per embedding request
EMBEDDING_BATCH_DELAY_SECONDS = 0.2   # proactive pause between batches (0 = off)
```

---

## Key Design Decisions

- **Same model for chunks and queries** — `gemini-embedding-2` is used for both to ensure vectors exist in the same semantic space. Using different models would make cosine similarity meaningless.
- **Async methods** — all embedding calls are async to avoid blocking FastAPI's event loop during document upload.
- **`langchain-google-genai`** is used as the wrapper rather than calling the `google-genai` SDK directly, because LangChain's `GoogleGenerativeAIEmbeddings` class handles API key injection, retry logic, and async support cleanly.
- **Batch size of 100** balances throughput against the embedding API's per-request limits. A 200-chunk document requires 2 API calls rather than 200. Larger batches mean fewer round-trips, which shortens total ingestion time (now run in the background, but still bounded by worker capacity).
- **Multiple API keys** — accepts a list of keys and fails over on daily-quota exhaustion. This is a free-tier mitigation for a no-revenue student project; the clean long-term path is a single paid key. Per-key daily quotas are intended to be per-project, so using extra keys purely to extend quota is a gray area under Google's terms.

---

## What This Agent Does NOT Do

- Does not call Qdrant
- Does not call Gemini for text generation
- Does not parse PDFs
- Does not handle HTTP routing
- Does not decide which texts to embed — it receives them from the caller
