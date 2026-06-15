# Agent Spec: Document Processor

**File:** `apps/api/services/pdf_processor.py`  
**Role:** Ingest a raw PDF file and return clean, chunked text segments ready for embedding.

---

## Responsibility

This agent owns **everything between "file uploaded" and "chunks ready for embedding"**. It touches no vector DB and calls no LLM.

---

## Inputs

| Parameter | Type | Description |
|---|---|---|
| `file_bytes` | `bytes` | Raw bytes of the uploaded PDF file |
| `filename` | `str` | Original filename (used for metadata) |
| `doc_id` | `str` | UUID from PostgreSQL `documents` table |
| `chunk_size` | `int` | Token count per chunk (default: 500) |
| `chunk_overlap` | `int` | Overlap between adjacent chunks (default: 50) |

---

## Outputs

Returns a list of `DocumentChunk` objects:

```python
@dataclass
class DocumentChunk:
    chunk_id: str          # UUID generated per chunk
    doc_id: str            # UUID for the parent document
    filename: str          # Original PDF filename
    page_number: int       # Page the chunk was extracted from
    text: str              # The raw chunk text
    token_count: int       # Approximate token count of this chunk
```

---

## Processing Pipeline

```
[PDF bytes]
    │
    ▼
1. Validate file (is it a real PDF? not empty? not image-only?)
    │
    ▼
2. Extract + clean text per page using pypdf
   - Strip headers/footers if possible
   - Normalize whitespace (collapse multiple spaces/newlines)
   - Record each page's start offset in a (char_offset → page_number) map
    │
    ▼
3. Stitch all pages into ONE continuous string (joined by "\n\n")
    │
    ▼
4. Split the WHOLE document once using LangChain RecursiveCharacterTextSplitter
   - chunk_size = 500 tokens
   - chunk_overlap = 50 tokens
   - separators: ["\n\n", "\n", " ", ""]
    │
    ▼
5. Coalesce splits shorter than MIN_CHUNK_LENGTH (50 chars) into the PREVIOUS
   chunk (don't drop them)
    │
    ▼
6. Attribute each chunk to a page by matching its start offset against the
   page-boundary map (a chunk spanning a page break → its START page)
    │
    ▼
7. Return List[DocumentChunk]
```

> **Why split the whole document, not page-by-page?** The earlier version split each
> page's text in isolation, which (a) **severed** any paragraph crossing a page boundary —
> `chunk_overlap` could not bridge it — and (b) **permanently dropped** short trailing
> splits (e.g. a page's closing sentence under 50 chars). Splitting the stitched document
> once lets overlap carry across page breaks; coalescing short tails keeps that content
> searchable. Page numbers are preserved via the offset map.

---

## Asynchronous ingestion (upload flow)

`PDFProcessor` itself is synchronous and unchanged, but **how it's invoked changed**.
Parsing → embedding → indexing used to run *inline inside the `POST /documents/upload`
request*. For a long (but under-20MB) PDF that work can take minutes — longer than the
hosting platform's HTTP request timeout — so the request was killed mid-flight and the
upload UI spun forever while users blamed their network. That was the real bug behind
"documents not uploading even though they're under the limit".

The pipeline now runs **after** the response is returned:

```
POST /documents/upload
  ├─ validate (type, extension, size cap, non-empty, %PDF magic)  ── fast, inline → 4xx on failure
  ├─ INSERT documents row  status="processing"  (page/chunk counts NULL)
  ├─ schedule BackgroundTask: _process_document_ingestion(doc_id, bytes, filename)
  └─ return 202 Accepted  { status: "processing" }      ← request ends here, fast

[background]  parse → embed → upsert to Qdrant
  ├─ success → UPDATE row: page_count, chunk_count, status="ready"
  └─ failure → purge any vectors, UPDATE row: status="failed", error_message=<reason>
```

The client polls `GET /documents/{doc_id}` (every ~3s) until `status` is `ready` or
`failed`. The document detail page renders a live "processing" banner, a "failed" banner
with the reason, and only enables the chat/summary/quiz actions once `ready`.

**Document lifecycle states** (`documents.status`): `processing` → `ready` | `failed`.
The background task owns its own DB session, embedder, and vector store (the
request-scoped ones are gone once the 202 is sent).

---

## Error Handling

Because parsing now runs in the background, a *parse* error no longer becomes an HTTP 4xx
on the upload call — instead the document row is flipped to `status="failed"` with the
`ValueError` message stored in `error_message`, and the UI surfaces it. (Cheap structural
checks — content-type, `.pdf` extension, size cap, empty file, and the `%PDF` magic
header — still run inline so an obviously-wrong file is rejected synchronously.)

| Condition | Response |
|---|---|
| Not a PDF (content-type / extension / missing `%PDF`) | **Inline** `400` / `415` on upload |
| Over size cap | **Inline** `413` on upload |
| Empty file | **Inline** `400` on upload |
| PDF is empty (0 pages) | Background → `status="failed"`, message stored |
| PDF is image-only (0 text extracted) | Background → `status="failed"`, message stored |
| Embedding/indexing error | Background → purge vectors, `status="failed"`, message stored |
| Extraction partially fails on some pages | Log warning, skip failed pages, continue |

---

## Configuration Constants

All values are loaded from `apps/api/core/config.py` via `pydantic-settings`:

```python
# apps/api/core/config.py (defaults)

DEFAULT_CHUNK_SIZE = 500        # tokens
DEFAULT_CHUNK_OVERLAP = 50      # tokens
MIN_CHUNK_LENGTH = 50           # characters — splits shorter than this are merged into the previous chunk (not dropped)
MAX_UPLOAD_SIZE_MB = 20         # maximum PDF upload size
```

The `PDFProcessor` class reads `settings.DEFAULT_CHUNK_SIZE` and `settings.DEFAULT_CHUNK_OVERLAP` in its constructor.

---

## Key Design Decisions

- **LangChain `RecursiveCharacterTextSplitter`** is used instead of a fixed character splitter because it respects natural sentence/paragraph boundaries, which is critical for preserving academic context across chunk boundaries.
- **Overlap of 50 tokens** ensures sentences that span a chunk boundary are present in both adjacent chunks, preventing retrieval from missing split context. Because the whole document is split as one continuous string, this overlap now also bridges **page** boundaries — a paragraph flowing from one page to the next is no longer severed.
- **Chunk size of 500 tokens / 50 overlap (10%)** sits squarely in the recommended band for recursive splitting of academic/narrative text (400–512 tokens, 10–20% overlap). It is intentionally **not** enlarged to speed up ingestion: bigger chunks coarsen retrieval precision for chat/quiz/summary, and ingestion time scales with total tokens, not chunk count — so the throughput win comes from batching and async processing, not chunk size.
- **Short tails are merged, not dropped** — a split shorter than `MIN_CHUNK_LENGTH` is appended to the previous chunk instead of being discarded, so short trailing content (e.g. a page's closing sentence) stays searchable. The old per-page splitter silently dropped these.
- **Page number metadata** is derived from a `(char_offset → page_number)` map built during extraction; each chunk is attributed to the page it **starts** on (chunks spanning a page break pick their start page). Stored so retrieved content can reference its source page — important for academic credibility.
- **`doc_id` is provided by the caller** (the UUID from the PostgreSQL `documents` table) and shared across all chunks of the same document, enabling per-document filtering in the vector store and linking to `chat_history`.
- **`pypdf`** (lowercase) is the correct pip package name — the old `PyPDF2` has been renamed.

---

## What This Agent Does NOT Do

- Does not call the Gemini API
- Does not call Qdrant
- Does not generate embeddings
- Does not store anything
- Does not touch the HTTP request/response layer
