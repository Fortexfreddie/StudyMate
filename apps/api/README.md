# StudyMate API (Backend)

FastAPI backend for StudyMate — handles authentication, PDF ingestion, the RAG
pipeline (retrieval + generation), history, and aggregate stats. Every AI response
is grounded **strictly** in the student's own uploaded documents.

- **Framework:** FastAPI (Python 3.11+)
- **DB:** PostgreSQL + SQLAlchemy 2.0 (async) + Alembic
- **Vector DB:** Qdrant Cloud
- **LLM:** Google Gemini (`gemini-3-flash-preview` primary, `gemini-3.1-flash-lite` fallback)
- **Embeddings:** `gemini-embedding-001`
- **Auth:** JWT (PyJWT) + bcrypt password hashing

---

## Table of Contents
1. [Architecture & Folder Layout](#architecture--folder-layout)
2. [Request Lifecycle](#request-lifecycle)
3. [Setup & Running](#setup--running)
4. [Database Schema](#database-schema)
5. [Endpoint Reference (with examples)](#endpoint-reference-with-examples)
6. [The RAG Pipeline](#the-rag-pipeline)
7. [Summary Formats — how they work](#summary-formats--how-they-work)
8. [Study Streak & Stats](#study-streak--stats)
9. [Caching](#caching)
10. [Error Handling](#error-handling)
11. [Configuration](#configuration)
12. [Development](#development)

---

## Architecture & Folder Layout

```
apps/api/
├── main.py                    # App entry: CORS, exception handler, router includes, lifespan
├── core/
│   ├── config.py              # pydantic-settings — ALL env vars (single source of truth)
│   ├── dependencies.py        # FastAPI DI: get_current_user, get_db, services
│   ├── errors.py              # StudyMateError hierarchy → JSON error responses
│   └── security.py            # JWT encode/decode, password hashing
├── models/
│   ├── database.py            # SQLAlchemy models + async engine/session
│   └── schemas.py             # Pydantic request/response models (typed API contract)
├── routers/                   # One module per feature; thin — no business logic
│   ├── auth.py                # signup, login, refresh, GET/PATCH me
│   ├── documents.py           # upload, list, get one, delete
│   ├── chat.py                # RAG Q&A
│   ├── summary.py             # format-aware summaries
│   ├── quiz.py                # generate + submit/grade
│   ├── history.py             # paginated chat & quiz history
│   └── stats.py               # aggregate metrics + streak
├── services/                  # ALL business logic lives here
│   ├── auth_service.py        # credentials, token issuance
│   ├── pdf_processor.py       # pypdf extraction + LangChain chunking
│   ├── embedder.py            # Google embedding calls (batched)
│   ├── vector_store.py        # Qdrant upsert/search/delete
│   ├── retriever.py           # embed query → cosine search → filter
│   ├── generator.py           # Gemini prompts, JSON parsing, retry/fallback
│   └── activity_service.py    # record_activity + compute_streak (study streaks)
├── migrations/                # Alembic migrations
└── scripts/wipe_db.py         # Full reset of Postgres + Qdrant
```

**Layering rule (enforced):** routers are thin and call `services/`; business logic
never lives in a router. Pydantic models in `schemas.py` are the only thing returned
from handlers — never raw dicts.

---

## Request Lifecycle

```
HTTP request
  → CORS middleware (main.py)
  → route handler (routers/*)            ← depends on get_current_user (JWT) for protected routes
      → get_db yields an async session   (one per request)
      → calls into services/*            (retriever, generator, vector_store, …)
      → returns a typed Pydantic model
  → StudyMateError (if raised) → global handler → {"detail": "..."} + status code
  → JSON response
```

Auth: protected routes depend on `get_current_user`
([core/dependencies.py](core/dependencies.py)), which decodes the `Authorization:
Bearer <token>` header, verifies it's an **access** token, and loads the `User` row.
Failures raise `AuthenticationError` → `401`.

---

## Setup & Running

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on *nix)
pip install -r requirements.txt

copy .env.example .env           # then fill in real credentials
alembic upgrade head             # create/upgrade tables

uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","version":"1.0.0"}`
Interactive docs: **http://localhost:8000/docs** (Swagger) — click **Authorize** and
paste `Bearer <access_token>` after signup/login.

---

## Database Schema

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | `id`, `email` (unique), `password_hash`, `full_name`, `major` (nullable), **`is_pro`** (bool, defaults to False), timestamps |
| `documents` | Uploaded PDFs (metadata only; vectors live in Qdrant) | `id` (= Qdrant key), `user_id`, `filename`, `page_count`, `chunk_count`, `uploaded_at` |
| `chat_history` | Q&A pairs **and** summaries | `id`, `user_id`, `doc_id`, `query`, `answer`, `context_sufficient`, `sources` (JSONB) |
| `quiz_sessions` | A generated quiz | `id`, `user_id`, `doc_id`, `topic`, `total_questions`, `questions` (JSONB), `score` |
| `quiz_answers` | Per-question grade after submit | `session_id`, `question_index`, `selected_index`, `correct_index`, `is_correct` |
| `user_activity` | One row per user per active day (for streaks) | `user_id`, `activity_date`, unique `(user_id, activity_date)` |
| **`token_usage`** | Granular per-request LLM token consumption tracking | `id`, `user_id`, `tokens_used`, `model_used`, `performance_mode`, `request_type` (chat/summary/quiz), `created_at` |

> **Summaries share `chat_history`.** A summary row's `query` is prefixed
> `Summary request: <topic> [format=<fmt>]`. The `/stats` summary count and the
> history timeline key on that prefix to separate summaries from chats.

**Migration for this integration:** `migrations/versions/369f827eaf12_add_user_is_pro_and_token_usage_table.py`
adds `users.is_pro` and the `token_usage` table. Run `alembic upgrade head` before starting the server.

---

## Endpoint Reference (with examples)

All protected routes require `Authorization: Bearer <access_token>`.
All errors return `{ "detail": "human-readable message" }`.

### Auth

**`POST /auth/signup`** → 201
```json
// request
{ "email": "s@futo.edu.ng", "password": "secret12", "full_name": "Ada Lovelace" }
// response
{ "user": { "id": "uuid", "email": "...", "full_name": "...", "major": null, "created_at": "..." },
  "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer" }
```

**`POST /auth/login`** → 200 → `{ access_token, refresh_token, token_type }`
**`POST /auth/refresh`** → 200 → `{ access_token, token_type }` (refresh_token is null)
**`GET /auth/me`** → 200 → user profile (now includes `major`)

**`PATCH /auth/me`** → 200 — update editable fields (email is immutable)
```json
// request — send only what changes
{ "full_name": "Ada L.", "major": "Computer Science" }
// response → updated user profile
```

### Documents

**`POST /documents/upload`** (`multipart/form-data`, field `file`) → 201
```json
{ "doc_id": "uuid", "filename": "notes.pdf", "page_count": 24, "chunk_count": 87, "status": "processed" }
```
Errors: `400` not a PDF/empty/image-only · `413` > 20MB · `500` indexing failure.

**`GET /documents`** → 200 → `{ "documents": [ { doc_id, filename, page_count, chunk_count, uploaded_at } ] }`

**`GET /documents/{doc_id}`** → 200 → single `DocumentInfo`. `404` if missing, `403` if not owner.

**`DELETE /documents/{doc_id}`** → 200 → `{ "doc_id": "uuid", "deleted": true }` (also purges Qdrant vectors).

### Chat

**`POST /chat`** → 201
```json
// request  (doc_id optional — omit to search all docs; top_k optional, default 5)
{ "query": "What is cognitive load theory?", "doc_id": "uuid", "top_k": 5 }
// response
{ "answer": "Cognitive load theory posits…",
  "context_sufficient": true,
  "sources": [ { "filename": "notes.pdf", "page_number": 12, "similarity_score": 0.91, "text_preview": "…" } ] }
```

### Summary

**`POST /summary/generate`** → 201
```json
// request  (format optional, default "bullets")
{ "topic": "Vector databases", "doc_id": "uuid", "top_k": 5, "format": "flashcards" }
// response
{ "summary": "- …plain text fallback…",
  "format": "flashcards",
  "structured": [ { "front": "…", "back": "…" } ],
  "context_sufficient": true,
  "sources": [ … ] }
```
See [Summary Formats](#summary-formats--how-they-work) for every `structured` shape.

### Quiz

**`POST /quiz/generate`** → 201  (`num_questions` 1–30, default 5)
```json
{ "topic": "RAG", "doc_id": "uuid", "num_questions": 5, "top_k": 5 }
// → { session_id, topic, questions: [ { question, options[4], correct_index, explanation } ], sources }
```

**`POST /quiz/{session_id}/submit`** → 200  (scoring happens **here**, server-side)
```json
// request
{ "answers": [ { "question_index": 0, "selected_index": 1 } ] }
// response
{ "session_id": "uuid", "score": 4, "total_questions": 5,
  "results": [ { "question_index": 0, "selected_index": 1, "correct_index": 1, "is_correct": true, "explanation": "…" } ] }
```
Skipped questions default to index 0 and are graded as answered.

### History

**`GET /history/chat?doc_id=&limit=10&offset=0`** → `{ messages[], total, limit, offset }`
**`GET /history/quizzes?doc_id=&limit=10&offset=0`** → `{ sessions[], total, limit, offset }`
**`GET /history/quizzes/{session_id}`** → full graded detail.

### Stats

**`GET /stats`** → 200
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

### Usage Telemetry

**`GET /usage`** → 200
```json
{
  "tokens_used_today": 12500,
  "token_limit": 50000,
  "tokens_remaining": 37500,
  "is_pro": false,
  "usage_by_type": {
    "chat": 4500,
    "summary": 8000,
    "quiz": 0
  },
  "reset_time": "2026-06-01T00:00:00Z"
}
```

---

## The RAG Pipeline

Implemented across `retriever.py` + `generator.py`, called by chat/summary/quiz:

1. **Embed query** — the user's query/topic is embedded with `gemini-embedding-001`.
2. **Retrieve** — Qdrant cosine search returns the top-k chunks for the user
   (filtered by `doc_id` when supplied), dropping anything below the
   `RETRIEVAL_SIMILARITY_THRESHOLD` (0.60).
3. **Generate** — `generator.py` builds a prompt with a strict grounding
   `SYSTEM_PROMPT` (no outside knowledge, admit gaps, no fabrication) plus the
   retrieved context, and calls Gemini with **JSON mode** enforced.
4. **Retry/fallback** — on rate-limits (429) or malformed JSON it retries with
   exponential backoff, then falls back from the primary to the lighter model.
5. **Persist** — the interaction is saved to `chat_history` / `quiz_sessions`, and
   a study-activity day is recorded.

`context_sufficient: false` is returned (not an error) when the retrieved context
doesn't cover the question — the frontend renders this as a clear notice.

---

## Summary Formats — how they work

A format is **not** just a prompt tweak. Each format is the combination of three
things (see `generator.py`):

1. **A prompt `OUTPUT FORMAT` block** (in `SUMMARY_FORMAT_SPECS`) telling Gemini the
   exact JSON shape to place under a `structured` key. The grounding rules are
   identical across formats; only this block changes.
2. **The JSON-enforced client** (`response_mime_type: application/json`) guaranteeing
   parseable output.
3. **A validator** (`_validate_summary_structure`) that normalizes/checks the shape
   per format. If validation fails, the response degrades gracefully to
   `structured: null` and the plain-text `summary` is still returned.

| `format` | `structured` shape |
|---|---|
| `bullets` | `string[]` |
| `key_concepts` | `[{ title, description }]` |
| `study_guide` | `{ bullets: string[], concepts: [{ title, description }] }` |
| `flashcards` | `[{ front, back }]` |
| `cheat_sheet` | `{ formulas: [{ label, value }], definitions: [{ term, meaning }] }` |
| `mind_map` | `{ root, branches: [{ label, children: string[] }] }` |

**To add a new format:** (1) add it to `SummaryFormat` in `schemas.py`, (2) add a
`SUMMARY_FORMAT_SPECS` entry + a branch in `_validate_summary_structure`, (3) render
the new shape in the frontend summary page.

---

## Study Streak & Stats

`services/activity_service.py`:

- **`record_activity(db, user_id)`** — called from upload, chat, summary, and quiz
  submit. Inserts a `user_activity` row for today with `ON CONFLICT DO NOTHING`
  (idempotent — at most one row per user per day). **Best-effort:** it never raises,
  so a streak-tracking failure can't break the primary action.
- **`compute_streak(db, user_id)`** — counts consecutive active days ending today (or
  yesterday, leniently). A gap resets the streak to 0.

`/stats` derives every other number live from the DB: document/quiz counts, summary
count (chat rows with the `Summary request:` prefix), genuine chat count (total chat
rows minus summaries), and average quiz score as a percentage.

> XP/gamification is intentionally **not** implemented — there is no XP concept in the
> data model.

---

## Caching

`/chat` and `/summary/generate` check `chat_history` for an identical prior request
(same user, `doc_id`, normalized query, and matching `top_k` via
`jsonb_array_length(sources)`). On a hit, the saved answer is returned without
re-running retrieval or the LLM (≈10–20 ms vs 3–5 s). Summaries include the `format`
in their cache key so different formats don't collide; the structured payload isn't
persisted, so a cached summary returns `structured: null` + the cached plain text.

---

## Error Handling

`core/errors.py` defines a `StudyMateError` hierarchy; `main.py` converts any raised
subclass into `{ "detail": message }` with the right status:

| Exception | Status | When |
|---|---|---|
| `DocumentProcessingError` | 400 | PDF unparseable / image-only |
| `AuthenticationError` | 401 | bad/expired token or credentials |
| `DocumentNotFoundError` | 404 | doc_id missing |
| `GenerationError` | 422 | unparseable quiz JSON after retry |
| `ServiceUnavailableError` | 503 | Gemini/Qdrant/embedding unreachable |
| `ConfigurationError` | 500 | required config missing |

---

## Configuration

All env vars are defined and validated in `core/config.py` (never use `os.getenv`
directly). See [docs/CONFIG.md](../../docs/CONFIG.md) for the full reference. Notable
ones touched by this integration:

| Var | Default | Notes |
|---|---|---|
| `MAX_QUIZ_QUESTIONS` | `30` | **Now authoritative** — enforced by a `field_validator` on `QuizGenerateRequest` |
| `DEFAULT_QUIZ_QUESTIONS` | `5` | default `num_questions` |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | accepts a comma-separated string in `.env` (add the Vercel URL for prod) |
| `RETRIEVAL_SIMILARITY_THRESHOLD` | `0.60` | min cosine score to keep a chunk |

---

## Development

```bash
ruff check .            # lint
ruff format .           # format
mypy .                  # type check
alembic revision --autogenerate -m "msg"   # new migration
alembic upgrade head                       # apply
python scripts/wipe_db.py                  # ⚠ full reset (Postgres + Qdrant)
```
