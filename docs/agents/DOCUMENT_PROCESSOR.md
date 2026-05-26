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
2. Extract text per page using pypdf
   - Strip headers/footers if possible
   - Normalize whitespace (collapse multiple spaces/newlines)
    │
    ▼
3. Split into chunks using LangChain RecursiveCharacterTextSplitter
   - chunk_size = 500 tokens
   - chunk_overlap = 50 tokens
   - separators: ["\n\n", "\n", " ", ""]
    │
    ▼
4. Discard chunks shorter than MIN_CHUNK_LENGTH (50 characters)
    │
    ▼
5. Attach metadata to each chunk (doc_id, page_number, filename)
    │
    ▼
6. Return List[DocumentChunk]
```

---

## Error Handling

| Condition | Response |
|---|---|
| File is not a PDF | Raise `ValueError("File must be a PDF document.")` |
| PDF is empty (0 pages) | Raise `ValueError("PDF contains no readable pages.")` |
| PDF is image-only (0 text extracted) | Raise `ValueError("PDF appears to be a scanned image. Text extraction is not supported.")` |
| Extraction partially fails on some pages | Log warning, skip failed pages, continue |

---

## Configuration Constants

All values are loaded from `apps/api/core/config.py` via `pydantic-settings`:

```python
# apps/api/core/config.py (defaults)

DEFAULT_CHUNK_SIZE = 500        # tokens
DEFAULT_CHUNK_OVERLAP = 50      # tokens
MIN_CHUNK_LENGTH = 50           # characters — discard chunks shorter than this
MAX_UPLOAD_SIZE_MB = 20         # maximum PDF upload size
```

The `PDFProcessor` class reads `settings.DEFAULT_CHUNK_SIZE` and `settings.DEFAULT_CHUNK_OVERLAP` in its constructor.

---

## Key Design Decisions

- **LangChain `RecursiveCharacterTextSplitter`** is used instead of a fixed character splitter because it respects natural sentence/paragraph boundaries, which is critical for preserving academic context across chunk boundaries.
- **Overlap of 50 tokens** ensures sentences that span a chunk boundary are present in both adjacent chunks, preventing retrieval from missing split context.
- **Page number metadata** is stored with each chunk so retrieved content can reference its source page — important for academic credibility.
- **`doc_id` is provided by the caller** (the UUID from the PostgreSQL `documents` table) and shared across all chunks of the same document, enabling per-document filtering in the vector store and linking to `chat_history`.
- **`pypdf`** (lowercase) is the correct pip package name — the old `PyPDF2` has been renamed.

---

## What This Agent Does NOT Do

- Does not call the Gemini API
- Does not call Qdrant
- Does not generate embeddings
- Does not store anything
- Does not touch the HTTP request/response layer
