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
│   ├── dependencies.py        # FastAPI DI: get_current_user, get_db, cached services
│   ├── errors.py              # StudyMateError hierarchy → JSON error responses
│   ├── middleware.py          # SecurityHeadersMiddleware (OWASP headers, CSP)
│   ├── rate_limit.py          # slowapi limiter + 429 handler
│   └── security.py            # JWT encode/decode, password hashing
├── models/
│   ├── database.py            # SQLAlchemy models + async engine/session
│   └── schemas.py             # Pydantic request/response models (typed API contract)
├── routers/                   # One module per feature; thin — no business logic
│   ├── auth.py                # signup, login, refresh, logout, GET/PATCH me
│   ├── documents.py           # upload, list, get one, delete
│   ├── chat.py                # RAG Q&A
│   ├── summary.py             # format-aware summaries
│   ├── quiz.py                # generate + submit/grade
│   ├── history.py             # paginated chat / quiz / summary history
│   ├── stats.py               # aggregate metrics + streak
│   ├── usage.py               # daily token consumption
│   └── admin.py               # admin: overview stats, user + document management
├── services/                  # ALL business logic lives here
│   ├── auth_service.py        # credentials, token issuance, rotation, pruning
│   ├── pdf_processor.py       # pypdf extraction + LangChain chunking
│   ├── embedder.py            # Google embedding calls (batched)
│   ├── vector_store.py        # Qdrant upsert/search/delete
│   ├── retriever.py           # embed query → cosine search → filter
│   ├── generator.py           # Gemini prompts, JSON parsing, retry/fallback
│   ├── token_service.py       # atomic quota reserve/reconcile + usage logging
│   └── activity_service.py    # record_activity + compute_streak (study streaks)
├── migrations/                # Alembic migrations
└── scripts/
    ├── wipe_db.py             # Full reset of Postgres + Qdrant
    └── promote_admin.py       # Promote/demote a user's admin role
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

Verify: `curl http://localhost:8000/health` → `{"status":"ok","version":"1.0.0"}` (liveness).
Readiness (probes Postgres + Qdrant): `curl http://localhost:8000/health/ready` →
`{"status":"ready","checks":{"database":"ok","qdrant":"ok"}}` (200), or `503` if a dependency is down.
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
| **`token_usage`** | Append-only per-request LLM token consumption log | `id`, `user_id`, `input_tokens`, `output_tokens`, `total_tokens`, `model_used`, `request_type` (chat/summary/quiz), `performance_mode`, `created_at` |
| **`daily_token_usage`** | Atomic per-user/per-day quota counter (authoritative balance) | `id`, `user_id`, `usage_date`, `reserved_tokens`, unique `(user_id, usage_date)`, `updated_at` |

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
**`POST /auth/logout`** → 200 → `{ "success": true }` — revokes the supplied refresh token (idempotent). Body: `{ "refresh_token": "..." }`. The short-lived access token is not server-revocable; it expires on its own.
**`GET /auth/me`** → 200 → user profile (now includes `major`)

**`PATCH /auth/me`** → 200 — update editable fields (email is immutable)
```json
// request — send only what changes
{ "full_name": "Ada L.", "major": "Computer Science" }
// response → updated user profile
```

### Documents

**`POST /documents/upload`** (`multipart/form-data`, field `file`) → **202** (async)
```json
{ "doc_id": "uuid", "filename": "notes.pdf", "page_count": null, "chunk_count": null, "status": "processing" }
```
Validation (type/extension/size/empty/`%PDF`) is inline; parsing + embedding + indexing
run in a **background task**. Poll `GET /documents/{doc_id}` until `status` is `ready`
(or `failed`, with `error_message`). Inline errors: `400` not a PDF/empty · `413` > 20MB ·
`415` bad content-type. A bad/scanned PDF surfaces as `status:"failed"`, not an HTTP error.

**`GET /documents`** → 200 → `{ "documents": [ { doc_id, filename, page_count, chunk_count, status, error_message, uploaded_at } ] }` (counts `null` until `ready`)

**`GET /documents/{doc_id}`** → 200 → single `DocumentInfo` (also the upload-progress poll endpoint; carries `status`). `404` if missing, `403` if not owner.

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
// request  (format optional, default "bullets"; top_k optional — omit to use mode default; full_document optional — default false)
{ "topic": "Vector databases", "doc_id": "uuid", "format": "flashcards", "full_document": false }
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
Skipped questions (no submission for that index) are recorded with `selected_index: -1`
and graded as incorrect — distinct from a deliberate choice of option A (`0`).

### History

**`GET /history/chat?doc_id=&limit=10&offset=0`** → `{ messages[], total, limit, offset }` — each message includes a `sources` array (same `SourceInfo` shape as `POST /chat`; empty array for rows persisted before this field was added)
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

### Admin

All `/admin/*` routes require an admin (`get_current_admin`); role changes and
user deletion additionally require the super admin (`get_current_super_admin`).
The `SUPER_ADMIN_EMAIL` account is auto-assigned `super_admin` + pro on
signup/login and can never be modified or deleted via the API.

| Method | Endpoint | Gate | Description |
|---|---|---|---|
| GET | `/admin/stats/overview` | Admin | System-wide aggregate metrics + 30-day series |
| GET | `/admin/users` | Admin | Paginated users (`search`, `role`, `major`, `is_pro`, `sort_by`, `limit`≤100, `offset`); includes `last_active` |
| GET | `/admin/users/{user_id}/profile` | Admin | One user's robust detail — counts, dates (signup/last-active/last-login), summary formats, perf modes, models, avg generation time/chunks, cached tokens (metadata only) |
| GET | `/admin/users/{user_id}/usage` | Admin | One user's token usage (`start`, `end`, `request_type`) |
| GET | `/admin/users/{user_id}/activity` | Admin | One user's audit trail — metadata only (`action_type`, `limit`≤100, `offset`) |
| PATCH | `/admin/users/{user_id}` | Admin (`is_pro`) / Super (`role`) | Update tier and/or role |
| DELETE | `/admin/users/{user_id}` | Super | Delete user + purge their vectors |
| GET | `/admin/documents` | Admin | Paginated documents with owner info |
| DELETE | `/admin/documents/{doc_id}` | Admin | Delete any document + purge its vectors |

**`PATCH /admin/users/{user_id}`** body (both fields optional) → 200 `UserResponse`
```json
{ "is_pro": true, "role": "admin" }
```

Guards: target super admin → `409`; `role` change by a non-super-admin → `403`;
`role` not in `("user", "admin")` → `403`. Promoting to `admin` also sets
`is_pro = True` so the stored tier matches the displayed one; demoting to `user`
leaves the tier untouched. Admins always receive the Pro token limit via
`User.effective_is_pro` regardless of the stored flag.

**`GET /admin/users/{user_id}/usage`** → 200 `AdminUserUsageResponse`: window
totals, `tokens_by_type`, `tokens_by_model`, and a per-day `daily_tokens` trend,
all summed from the append-only `token_usage` log over an inclusive UTC date
window (defaults to the last 30 days).

**`GET /admin/users/{user_id}/activity`** → 200 `AdminUserActivityResponse`: a
paginated, time-ordered feed merging the user's chat/summary/quiz rows into
**metadata-only** records — action type, timestamp, document, performance mode,
quiz score, and an 80-char truncated query/topic `preview`. Full question text
and answer bodies are never returned (privacy by design — see
[docs/ADMIN.md](../../docs/ADMIN.md)).

Full roles/super-admin/UI spec: [docs/ADMIN.md](../../docs/ADMIN.md). Promote
admins from the CLI with `python scripts/promote_admin.py <email> [--demote]`.

---

## The RAG Pipeline

Implemented across `retriever.py` + `generator.py`, called by chat/summary/quiz:

1. **Embed query** — the user's query/topic is embedded with `gemini-embedding-2`.
2. **Retrieve** — Qdrant cosine search returns the top-k chunks for the user
   (filtered by `doc_id` when supplied), dropping anything below the
   `RETRIEVAL_SIMILARITY_THRESHOLD` (0.35). If `full_document` is true for a summary, similarity search is bypassed entirely in favor of page-sequential document chunks.
3. **Generate** — `generator.py` builds a prompt with a strict grounding
   `SYSTEM_PROMPT` (no outside knowledge, admit gaps transparently without refusing, no fabrication) plus the
   retrieved context, and calls Gemini with **JSON mode** enforced.
4. **Retry/fallback** — failures are classified: **rate-limit/quota (429)** triggers a fast fallback to the secondary model immediately; **transient errors** (503, empty/malformed) retry the primary model (governed by `MAX_RETRIES`, default `1`) after `RETRY_DELAY_SECONDS` before falling back; **fatal errors** (auth/permission/invalid-argument — e.g. bad API key) fail fast with no retry or fallback. If generation ultimately fails, a `503` is raised (the token reservation is released and nothing is persisted).
5. **Persist** — on success the interaction is saved to `chat_history` / `summary_history` / `quiz_sessions`, token usage is reconciled and logged, and a study-activity day is recorded. (Full-document summaries bypass the history cache lookup).

`context_sufficient: false` is returned (not as a refusal, but as a quality signal) when the retrieved context is missing direct answers — the generator still synthesizes the best answer using related context and the UI displays a quality notice.

---

## Multi-Tenancy Security Boundaries

The RAG pipeline enforces strict user-level data isolation:
- **Document Ownership Checks:** When a request is submitted with a specific `doc_id` (for chat, summary, or quiz generation), the system queries the database to verify the document exists and belongs to the authenticated user. Requests targeting unauthorized `doc_id`s result in a `404 Not Found` response.
- **Global Search Isolation:** If `doc_id` is omitted for a global search/generation, the system retrieves the IDs of all documents owned by the active user and restricts the Qdrant query using a `MatchAny` payload filter. If the user has not uploaded any documents, a `400 Bad Request` is returned immediately.

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
- **Only document-scoped requests are cached.** A document's content is immutable once uploaded, so a cached `(doc_id, query/topic, mode)` result is always safe. **Global requests (`doc_id` omitted) are never served from cache**, because they span the user's whole document set — a cached global answer would go stale the moment a new document is uploaded.
- *Note:* Caching does not strictly filter on `top_k` or the source array length. This ensures consistent cache hits even if the number of retrieved chunks varies slightly or falls below the similarity threshold.

---

## Token Quotas (atomic reserve / reconcile)

Each user has a daily token limit (`FREE_DAILY_TOKEN_LIMIT` / `PRO_DAILY_TOKEN_LIMIT`)
enforced against a **fixed calendar-day window that resets at 00:00 UTC** (not a
sliding 24-hour window).

Enforcement is **atomic** to prevent concurrent requests from collectively
overshooting the limit (`services/token_service.py`):

1. **Estimate** — a cheap, local char-based estimate of the request's token cost
   (input ≈ chars⁄4 + a fixed per-type output budget). No extra API call.
2. **Reserve** — the estimate is added to the user's `daily_token_usage` counter in a
   single atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`. If the post-increment
   total exceeds the limit, the reservation is rolled back and the request is rejected
   with `403` **before** any LLM call. Concurrent requests serialize on the counter row.
3. **Generate** — the LLM call runs.
4. **Reconcile / release** — on success the counter is trued up by
   `(actual − estimate)` and a per-request row is written to the `token_usage` log; on
   failure the full estimate is released so a failed generation is never charged.

`GET /usage` and `GET /stats` report `tokens_used_today` from the authoritative
counter; the per-type breakdown comes from the `token_usage` log.

---

## Error Handling

`core/errors.py` defines a `StudyMateError` hierarchy; `main.py` converts any raised
subclass into `{ "detail": message }` with the right status:

| Exception | Status | When |
|---|---|---|
| `DocumentProcessingError` | 400 | PDF unparseable / image-only |
| `AuthenticationError` | 401 | bad/expired/malformed token or credentials |
| `DocumentNotFoundError` | 404 | doc_id missing |
| `GenerationError` | 422 | (defined; reserved for unparseable generation) |
| `ServiceUnavailableError` | 503 | Gemini/Qdrant/embedding unreachable, or generation failed after retries (chat, summary, **and** quiz) |
| `ConfigurationError` | 500 | required config missing |

Any **unhandled** exception is caught by a catch-all handler in `main.py` and
normalized to `{ "detail": "An unexpected error occurred. Please try again." }` with
status `500` — no stack trace is leaked to the client (it is logged server-side).
On a generation failure, chat and summary now behave like quiz: they raise `503`,
do **not** persist a history row, and do **not** charge tokens (the reservation is
released).

---

## Configuration

All env vars are defined and validated in `core/config.py` (never use `os.getenv`
directly). See [docs/CONFIG.md](../../docs/CONFIG.md) for the full reference. Notable
ones touched by this integration:

| Var | Default | Notes |
|---|---|---|
| `GOOGLE_API_KEY_2`, `GOOGLE_API_KEY_3` | `""` | Optional fallback Google AI keys. Both the embedder and the generator fail over to the next key when a key's **daily** quota is exhausted (per-key daily limit). Order: `GOOGLE_API_KEY` → `_2` → `_3`. Exhaustion is time-aware (24h cooldown, auto-recovers without restart) |
| `MAX_RETRIES` | `1` | Max primary model retries for transient errors (503/empty/malformed responses) before falling back |
| `QUIZ_REPROMPT_SINGLE_ATTEMPT` | `true` | When the quiz parser rejects the first generation, the stricter reformat reprompt is a single primary-model call (no internal retry/fallback). Caps worst-case LLM calls per quiz request at 4 (was 6). Set `false` to let the reprompt use the full `MAX_RETRIES` + fallback path |
| `FREE_DAILY_TOKEN_LIMIT` | `50000` | Daily token quota for free-tier users (fixed UTC-day window) |
| `PRO_DAILY_TOKEN_LIMIT` | `500000` | Daily token quota for pro-tier users |
| `MAX_QUIZ_QUESTIONS` | `30` | **Authoritative** — enforced by a `field_validator` on `QuizGenerateRequest` |
| `DEFAULT_QUIZ_QUESTIONS` | `5` | default `num_questions` |
| `MAX_UPLOAD_SIZE_MB` | `20` | Upload size cap; enforced via bounded chunked reads (oversized files rejected without full buffering) |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | accepts a comma-separated string in `.env` (add the Vercel URL for prod) |
| `RETRIEVAL_SIMILARITY_THRESHOLD` | `0.35` | min cosine score to keep a chunk |

> **TODO — explicit caching (when on a single key):** The multi-key fallback above
> (`GOOGLE_API_KEY_2/3`) is a free-tier daily-quota mitigation. **When the app moves to a
> single paid key** (no daily cap, so multi-key failover is dropped), refactor the
> generator to use Gemini **explicit context caching** for the shared `SYSTEM_PROMPT` and
> large repeated document context — it bills cached input tokens ~75% cheaper. It is
> deliberately **not** used today because explicit caches are scoped per project/key, so a
> key failover would cold-miss the cache (the two features conflict). Until then we rely on
> Gemini's automatic **implicit** caching, surfaced in admin as `cached_tokens`. Code
> anchor: `services/generator.py` → `_call_llm_with_retry` usage-metadata block
> (`TODO(explicit-caching)`).

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
