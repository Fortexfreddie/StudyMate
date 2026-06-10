# StudyMate API (Backend)

FastAPI backend for StudyMate — handles authentication, PDF ingestion, the RAG
pipeline (retrieval + generation), history, and aggregate stats. Every AI response
is grounded **strictly** in the student's own uploaded documents.

- **Framework:** FastAPI (Python 3.11+)
- **DB:** PostgreSQL + SQLAlchemy 2.0 (async) + Alembic
- **Vector DB:** Qdrant Cloud
- **LLM:** Google Gemini (`gemini-3.5-flash` primary, `gemini-3.1-flash-lite` fallback)
- **Embeddings:** `gemini-embedding-2`
- **Auth:** JWT (PyJWT) + Argon2id password hashing + Token Rotation
- **Rate Limiting:** slowapi (5 req/min auth, 10 req/min LLM)

---

## Table of Contents
1. [Architecture & Folder Layout](#architecture--folder-layout)
2. [Request Lifecycle](#request-lifecycle)
3. [Setup & Running](#setup--running)
4. [Database Schema](#database-schema)
5. [Endpoint Reference (with examples)](#endpoint-reference-with-examples)
6. [The RAG Pipeline](#the-rag-pipeline)
7. [Performance Modes & top_k](#performance-modes--top_k)
8. [Summary Formats — how they work](#summary-formats--how-they-work)
9. [Study Streak & Stats](#study-streak--stats)
10. [Caching](#caching)
11. [Error Handling](#error-handling)
12. [Configuration](#configuration)
13. [Development](#development)

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
| `chat_history` | Chat Q&A pairs (grounded) | `id`, `user_id`, `doc_id`, `query`, `answer`, `context_sufficient`, `sources` (JSONB), `performance_mode`, `created_at` |
| `quiz_sessions` | A generated quiz | `id`, `user_id`, `doc_id`, `topic`, `total_questions`, `questions` (JSONB), `score`, `created_at` |
| `quiz_answers` | Per-question grade after submit | `id`, `session_id`, `question_index`, `selected_index`, `correct_index`, `is_correct`, `created_at` |
| `user_activity` | One row per user per active day (for streaks) | `user_id`, `activity_date`, unique `(user_id, activity_date)` |
| `refresh_tokens` | Active refresh tokens (token rotation) | `id`, `user_id`, `token_hash` (unique), `expires_at`, `is_revoked`, `created_at` |
| `summary_history` | Generated summaries (cached & paginated) | `id`, `user_id`, `doc_id`, `topic`, `summary_text`, `format`, `structured` (JSONB), `context_sufficient`, `sources` (JSONB), `performance_mode`, `created_at` |
| **`token_usage`** | Granular per-request LLM token consumption tracking | `id`, `user_id`, `tokens_used`, `model_used`, `performance_mode`, `request_type` (chat/summary/quiz), `created_at` |

**Migration for this integration:** Run `alembic upgrade head` before starting the server. This applies all migrations including `372dee4b2ff1_combined_auth_and_summaries` which updates indexes, adds Argon2 password hashing support, refresh token rotation table, and summary history table.

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
**`POST /auth/refresh`** → 200 → `{ access_token, refresh_token, token_type }` (rotates both tokens)
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
// request  (doc_id optional — omit to search all docs; top_k optional — omit to use mode default)
{ "query": "What is cognitive load theory?", "doc_id": "uuid", "top_k": 10 }
// response
{ "answer": "Cognitive load theory posits…",
  "context_sufficient": true,
  "sources": [ { "filename": "notes.pdf", "page_number": 12, "similarity_score": 0.91, "text_preview": "…" } ],
  "meta": { "model_used": "gemini-3.5-flash", "performance_mode": "high",
            "input_tokens": 3811, "output_tokens": 622, "total_tokens": 4433,
            "cached": false, "retrieval_chunks_used": 10 } }
```

### Summary

**`POST /summary/generate`** → 201
```json
// request  (format optional, default "bullets"; top_k optional — omit to use mode default)
{ "topic": "Vector databases", "doc_id": "uuid", "format": "flashcards" }
// response
{ "summary": "- …plain text fallback…",
  "format": "flashcards",
  "structured": [ { "front": "…", "back": "…" } ],
  "context_sufficient": true,
  "sources": [ … ],
  "meta": { "model_used": "gemini-3.5-flash", "performance_mode": "high",
            "input_tokens": 2100, "output_tokens": 850, "total_tokens": 2950,
            "cached": false, "retrieval_chunks_used": 10 } }
```
See [Summary Formats](#summary-formats--how-they-work) for every `structured` shape.

### Quiz

**`POST /quiz/generate`** → 201  (`num_questions` 1–30, default 5; `top_k` optional)
```json
{ "topic": "RAG", "doc_id": "uuid", "num_questions": 5 }
// → { session_id, topic, questions: [ { question, options[4], correct_index, explanation } ], sources,
//     meta: { model_used, performance_mode, input_tokens, output_tokens, total_tokens, cached, retrieval_chunks_used } }
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
**`GET /history/summaries?doc_id=&limit=10&offset=0`** → `{ summaries[], total, limit, offset }`

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

1. **Embed query** — the user's query/topic is embedded with `gemini-embedding-2`.
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

## Performance Modes & top_k

Every generation request uses a **performance mode** (set via the `X-Performance-Mode`
request header, default `high`). Each mode controls the model, thinking depth, and
default retrieval `top_k`.

| Mode | Primary Model | Fallback Model | Thinking | Default `top_k` | Max `top_k` |
|---|---|---|---|---|---|
| `low` | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | minimal | 5 | 10 |
| `medium` | `gemini-3.5-flash` | `gemini-3.1-flash-lite` | low | 8 | 15 |
| **`high`** (default) | **`gemini-3.5-flash`** | **`gemini-3.1-flash-lite`** | **medium** | **10** | **20** |
| `very_high` | `gemini-3.5-flash` | `gemini-3.1-flash-lite` | high | 15 | 25 |
| `max` | `gemini-3.5-flash` | `gemini-3.5-flash` | high | 20 | 30 |

### How `top_k` works

`top_k` controls how many document chunks are retrieved from Qdrant and fed to the
model as context.

- **Omit `top_k`** → the performance mode's default is used (e.g. `10` for `high`)
- **Set `top_k` explicitly** (e.g. `"top_k": 5`) → your value is used, regardless of mode
- Valid range: **1–30**

```json
// Omit top_k → mode default (10 in high mode)
{ "query": "What is X?" }

// Explicit top_k → uses exactly 5
{ "query": "What is X?", "top_k": 5 }
```

### Generation Metadata (`meta`)

Every chat, summary, and quiz response includes a `meta` object with transparency
into the generation:

| Field | Type | Description |
|---|---|---|
| `model_used` | string | Actual Gemini model used (e.g. `gemini-3.5-flash`) |
| `performance_mode` | string | Active tier: `low` / `medium` / `high` / `very_high` / `max` |
| `input_tokens` | int | Tokens consumed by prompt + context |
| `output_tokens` | int | Tokens in the generated response |
| `total_tokens` | int | Sum of input + output |
| `cached` | bool | `true` if served from DB cache (no LLM call) |
| `retrieval_chunks_used` | int | Number of RAG chunks fed to the model |

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
`/stats` derives every other number live from the DB: document/quiz counts, summary count (directly from the `summary_history` table), genuine chat count (directly from the `chat_history` table), and average quiz score as a percentage.
> XP/gamification is intentionally **not** implemented — there is no XP concept in the
> data model.

---

## Caching
- `/chat` checks the `chat_history` table for an identical prior Q&A request (matching user, `doc_id`, normalized query, and performance mode).
- `/summary/generate` checks the `summary_history` table for an identical prior summary request (matching user, `doc_id`, normalized topic, `format`, and performance mode).
- If cached data is found, the result is served directly from the database with `meta.cached: true`, reducing latency from ~3-5 seconds to ~10-20 milliseconds. Since structured summaries are persisted in the database, cached summary responses return the fully populated structured payload.
- *Note:* Caching does not strictly filter on `top_k` or the source array length. This ensures consistent cache hits even if the number of retrieved chunks varies slightly or falls below the similarity threshold.
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
