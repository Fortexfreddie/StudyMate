# API Contract

**Base URL (dev):** `http://localhost:8000`  
**Base URL (prod):** `https://<your-railway-app>.up.railway.app`

All requests/responses use `application/json` unless noted.  
All error responses follow: `{ "detail": "Human-readable error message" }`

**Authentication:** Unless marked as public, all endpoints require a valid JWT access token in the `Authorization: Bearer <token>` header. Missing or invalid tokens return `401`.

**Performance mode:** Generation endpoints (`/chat`, `/summary/generate`, `/quiz/generate`) accept an optional `X-Performance-Mode` header — one of `low`, `medium`, `high` (default), `very_high`, `max`. It selects the model tier, thinking depth, and the default `top_k`. Invalid/missing values fall back to `high`.

**Generation metadata:** Every chat / summary / quiz response includes a `meta` object: `{ model_used, performance_mode, input_tokens, output_tokens, total_tokens, cached, retrieval_chunks_used }`. (Omitted from individual examples below for brevity.)

**`top_k`:** Optional on generation endpoints. When omitted it defaults to the **performance mode's** value (e.g. `10` for `high`, `5` for `low`) — not a fixed `5`. Valid range `1–30`.

---

## Health Check

### `GET /health`

**Response 200:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Documents

### `POST /documents/upload` 🔒
Accept a PDF and process it **asynchronously**. Validation that can fail fast
(content-type, `.pdf` extension, size cap, empty file, `%PDF` header) runs inline and
returns an immediate `4xx`. The expensive work — extraction → chunking → embedding →
storage in Qdrant — runs in a **background task**, and the endpoint returns `202` right
away. This keeps the request short so a long PDF can't exceed the platform request timeout
and leave the client hanging. Poll `GET /documents/{doc_id}` until `status` is `ready` (or
`failed`).

**Request:** `multipart/form-data`
- `file`: PDF binary (required)

**Response 202 (Accepted):**
```json
{
  "doc_id": "uuid-v4-string",
  "filename": "lecture_notes.pdf",
  "page_count": null,
  "chunk_count": null,
  "status": "processing"
}
```

`page_count` / `chunk_count` are `null` until processing completes. `status` is one of
`processing` | `ready` | `failed`.

**Errors (inline, synchronous):**
- `400` — not a PDF (missing `%PDF` header), empty file, or wrong extension
- `413` — file too large (> 20MB)
- `415` — unsupported content-type
- `500` — could not create the document record

> A *parse* failure (image-only/scanned PDF, 0 readable pages) or an embedding/indexing
> failure is **not** an HTTP error here — it surfaces later as `status: "failed"` on the
> document, with a human-readable `error_message`.

---

### `GET /documents` 🔒
List all documents for the current user (any status).

**Response 200:**
```json
{
  "documents": [
    {
      "doc_id": "uuid",
      "filename": "lecture_notes.pdf",
      "page_count": 24,
      "chunk_count": 87,
      "status": "ready",
      "error_message": null,
      "uploaded_at": "2026-05-19T10:00:00Z"
    }
  ]
}
```

---

### `GET /documents/{doc_id}` 🔒
Get a single document's metadata — **also the polling endpoint** the client uses to track
ingestion progress after an upload. Only the document owner can access it.

**Response 200:**
```json
{
  "doc_id": "uuid",
  "filename": "lecture_notes.pdf",
  "page_count": 24,
  "chunk_count": 87,
  "status": "ready",
  "error_message": null,
  "uploaded_at": "2026-05-19T10:00:00Z"
}
```

`status` ∈ `processing` | `ready` | `failed`. When `failed`, `error_message` explains why
and the counts stay `null`.

**Errors:**
- `403` — not the document owner
- `404` — doc_id not found

---

### `DELETE /documents/{doc_id}` 🔒
Remove a document and all its chunks from the vector store. Only the document owner can delete.

**Response 200:**
```json
{ "doc_id": "uuid", "deleted": true }
```

**Errors:**
- `401` — not authenticated or not the document owner
- `404` — doc_id not found

---

## Chat

### `POST /chat` 🔒
Ask a question grounded in an uploaded document. Response is saved to chat history.

**Request body:**
```json
{
  "query": "What is cognitive load theory?",
  "doc_id": "uuid",
  "top_k": 5
}
```

- `doc_id` — optional. Omit to search all documents.
- `top_k` — optional. Defaults to the performance mode's value (10 for `high`). See top of doc.

**Response 201:**
```json
{
  "answer": "Cognitive load theory posits that...",
  "context_sufficient": true,
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 12,
      "similarity_score": 0.91,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

**Errors:**
- `400` — empty or too-short query
- `401` — not authenticated
- `503` — generation service unavailable

---

## Summary

### `POST /summary/generate` 🔒
Generate a structured summary of a topic from a document. Response is saved to summary history.

**Request body:**
```json
{
  "topic": "Vector Databases and Embeddings",
  "doc_id": "uuid",
  "top_k": 5,
  "format": "bullets",
  "full_document": false
}
```

- `doc_id` — optional. Omit to search all documents.
- `top_k` — optional. Defaults to the performance mode's value (10 for `high`). See top of doc.
- `format` — optional. Default: `bullets`. One of: `bullets`, `key_concepts`,
  `study_guide`, `flashcards`, `cheat_sheet`, `mind_map`.
- `full_document` — optional. Default: `false`. If `true`, the similarity threshold is bypassed and the entire document is read page-sequentially to build the summary.

**Response 201:**
```json
{
  "summary": "A vector embedding converts text into a high-dimensional numerical...",
  "format": "bullets",
  "structured": [
    "Embeddings map text to high-dimensional vectors.",
    "Cosine similarity ranks chunks by closeness to the query."
  ],
  "context_sufficient": true,
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 8,
      "similarity_score": 0.88,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

`summary` is always present (plain text/markdown fallback). `structured` carries the
format-specific shape and is `null` on a context gap or if the model's structure
failed validation. The `structured` shape per `format`:

| `format` | `structured` |
|---|---|
| `bullets` | `string[]` |
| `key_concepts` | `[{ title, description }]` |
| `study_guide` | `{ bullets: string[], concepts: [{ title, description }] }` |
| `flashcards` | `[{ front, back }]` |
| `cheat_sheet` | `{ formulas: [{ label, value }], definitions: [{ term, meaning }] }` |
| `mind_map` | `{ root, branches: [{ label, children: string[] }] }` |

**Errors:**
- `400` — empty topic
- `401` — not authenticated
- `503` — generation service unavailable

---

## Quiz

### `POST /quiz/generate` 🔒
Generate multiple-choice questions from a topic in a document. Creates a quiz session.

**Request body:**
```json
{
  "topic": "Retrieval-Augmented Generation",
  "doc_id": "uuid",
  "num_questions": 5,
  "top_k": 5
}
```

- `doc_id` — optional. Omit to search all documents.
- `num_questions` — optional. Default: 5, max: 30 (configurable via `MAX_QUIZ_QUESTIONS`).
- `top_k` — optional. Defaults to the performance mode's value (10 for `high`). See top of doc.

**Response 201:**
```json
{
  "session_id": "uuid",
  "topic": "Retrieval-Augmented Generation",
  "questions": [
    {
      "question": "What does RAG combine to reduce hallucinations?",
      "options": [
        "A) Keyword search and grammar correction",
        "B) Parametric memory and a retrieved external knowledge base",
        "C) A fine-tuned model and a relational database",
        "D) Tokenization and semantic parsing"
      ],
      "correct_index": 1,
      "explanation": "According to the lecture notes, RAG combines parametric memory (the LLM) with non-parametric memory (a dense vector index) to ground generation in retrieved content."
    }
  ],
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 5,
      "similarity_score": 0.93,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

**Errors:**
- `400` — num_questions out of range, empty topic
- `401` — not authenticated
- `422` — Gemini returned unparseable quiz JSON (after retry)
- `503` — generation service unavailable

---

### `POST /quiz/{session_id}/submit` 🔒
Submit answers for a quiz session. Calculates the score and saves the results.

**Request body:**
```json
{
  "answers": [
    {
      "question_index": 0,
      "selected_index": 1
    }
  ]
}
```

**Response 200:**
```json
{
  "session_id": "uuid",
  "score": 4,
  "total_questions": 5,
  "results": [
    {
      "question_index": 0,
      "selected_index": 1,
      "correct_index": 1,
      "is_correct": true,
      "explanation": "According to the lecture notes..."
    }
  ]
}
```

Grading is server-side. A question with no submission is **skipped**: it is recorded
with `selected_index: -1` and graded incorrect — distinct from deliberately choosing
option A (`0`). Submitting twice for the same session returns `409`.

**Errors:**
- `400` — missing answers or invalid format
- `401` — not authenticated
- `404` — session_id not found
- `409` — quiz session already submitted

---

## Auth (Public)

### `POST /auth/signup`
Create a new user account.

**Request body:**
```json
{
  "email": "student@futo.edu.ng",
  "password": "securepassword123",
  "full_name": "Ekwem Kamsiyochukwu"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "student@futo.edu.ng",
    "full_name": "Ekwem Kamsiyochukwu",
    "major": null,
    "is_pro": false,
    "created_at": "2026-05-25T10:00:00Z"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `400` — email already registered, password too short (min 8 chars)
- `422` — invalid request body

---

### `POST /auth/login`
Authenticate and receive tokens.

**Request body:**
```json
{
  "email": "student@futo.edu.ng",
  "password": "securepassword123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `401` — invalid email or password

---

### `POST /auth/refresh`
Rotate the refresh token and get a new access token.

**Request body:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `401` — invalid, expired, or reused refresh token

---

### `POST /auth/logout`
Revoke a refresh token. Idempotent — always returns success, even for an unknown or
already-expired token. The short-lived access token is not server-revocable; it
expires on its own. Clients should discard both tokens locally.

**Request body:**
```json
{ "refresh_token": "eyJ..." }
```

**Response 200:**
```json
{ "success": true }
```

---

### `GET /auth/me` 🔒
Get current user profile.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "student@futo.edu.ng",
  "full_name": "Ekwem Kamsiyochukwu",
  "major": "Computer Science",
  "is_pro": false,
  "created_at": "2026-05-25T10:00:00Z"
}
```

---

### `PATCH /auth/me` 🔒
Update editable profile fields. Email is immutable. Send only the fields you want to
change.

**Request body:**
```json
{
  "full_name": "Ekwem K. Fredrick",
  "major": "Computer Science & Engineering"
}
```

- `full_name` — optional. 1–255 chars.
- `major` — optional. Max 255 chars.

**Response 200:** the updated user profile (same shape as `GET /auth/me`).

---

## Stats 🔒

### `GET /stats`
Aggregate study metrics for the current user. All values are computed live from the
database.

**Response 200:**
```json
{
  "documents_uploaded": 3,
  "quizzes_taken": 5,
  "summaries_generated": 2,
  "chats_count": 11,
  "current_streak": 4,
  "average_quiz_score": 82.0,
  "tokens_used_today": 12500,
  "token_limit": 50000,
  "is_pro": false
}
```

- `current_streak` — consecutive active days up to today (0 if today/yesterday had no activity).
- `average_quiz_score` — mean score across graded sessions, as a 0–100 percentage.
- `tokens_used_today` / `token_limit` — today's consumption vs. the user's tier limit.

---

## Usage 🔒

### `GET /usage`
Daily token consumption for the current user. The window is a **fixed calendar day
that resets at 00:00 UTC**.

**Response 200:**
```json
{
  "tokens_used_today": 12500,
  "token_limit": 50000,
  "tokens_remaining": 37500,
  "is_pro": false,
  "usage_by_type": { "chat": 4500, "summary": 8000, "quiz": 0 },
  "reset_time": "2026-06-12T00:00:00+00:00"
}
```

- `tokens_used_today` is the authoritative daily counter; `usage_by_type` is derived
  from the per-request usage log.

---

## History 🔒

### `GET /history/chat`
Get the current user's chat history, paginated.

**Query params:**
- `doc_id` — optional. Filter by document.
- `limit` — optional. Default: 10, max: 100.
- `offset` — optional. Default: 0.

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "doc_id": "uuid",
      "query": "What is cognitive load theory?",
      "answer": "Cognitive load theory posits that...",
      "context_sufficient": true,
      "sources": [
        { "filename": "lecture_notes.pdf", "page_number": 12, "relevance_score": 0.91, "excerpt": "Cognitive load theory..." }
      ],
      "created_at": "2026-05-25T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

> `sources` is the same `SourceInfo` array returned by `POST /chat`. For older rows stored before this field was added, `sources` is an empty array `[]`.

---

### `GET /history/quizzes`
Get the current user's quiz session history.

**Query params:**
- `doc_id` — optional. Filter by document.
- `limit` — optional. Default: 10, max: 100.
- `offset` — optional. Default: 0.

**Response 200:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "doc_id": "uuid",
      "topic": "Retrieval-Augmented Generation",
      "total_questions": 5,
      "score": 4,
      "created_at": "2026-05-25T11:00:00Z"
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /history/quizzes/{session_id}`
Get detailed results for a specific quiz session.

**Response 200:**
```json
{
  "id": "uuid",
  "topic": "Retrieval-Augmented Generation",
  "total_questions": 5,
  "score": 4,
  "answers": [
    {
      "question_index": 0,
      "selected_index": 1,
      "correct_index": 1,
      "is_correct": true
    }
  ],
  "created_at": "2026-05-25T11:00:00Z"
}
```

**Errors:**
- `404` — session_id not found

---

### `GET /history/summaries` 🔒
Get the current user's summary generation history, paginated.

**Query params:**
- `doc_id` — optional. Filter by document.
- `limit` — optional. Default: 10, max: 100.
- `offset` — optional. Default: 0.

**Response 200:**
```json
{
  "summaries": [
    {
      "id": "uuid",
      "doc_id": "uuid",
      "topic": "Vector Databases and Embeddings",
      "summary_text": "A vector embedding converts text into...",
      "format": "bullets",
      "context_sufficient": true,
      "created_at": "2026-05-25T11:30:00Z"
    }
  ],
  "total": 14,
  "limit": 20,
  "offset": 0
}
```

