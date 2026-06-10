# StudyMate — Automated Study Companion & Quiz Generator

A full-stack web application that lets students upload PDF lecture notes and interact with them through AI-powered chat, summaries, and auto-generated quizzes — all grounded in their own documents using RAG (Retrieval-Augmented Generation).

**Institution:** Federal University of Technology, Owerri  
**Author:** Ekwem Kamsiyochukwu Fredrick

---

## Current Status

| Phase | Status |
|---|---|
| Phase 1 — Scaffolding & Infrastructure | ✅ Complete |
| Phase 2 — Backend Core (Auth, RAG, Endpoints) | ✅ Complete |
| Phase 3 — Frontend (Next.js) | ✅ Complete |
| Phase 4 — Integration (frontend wired to live API, mocks removed) | ✅ Complete |
| Phase 5 — Deployment | 🔲 Not started |

> **The frontend is now fully wired to the backend.** All mock data and the
> `NEXT_PUBLIC_USE_MOCKS` toggle have been removed — every screen reads and writes
> live data through the FastAPI backend. See [apps/web/README.md](apps/web/README.md)
> and [apps/api/README.md](apps/api/README.md) for component-level docs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React + TypeScript + Tailwind v4 |
| Backend | Python 3.11 + FastAPI + slowapi (rate limiter) |
| Database | PostgreSQL (Neon) + SQLAlchemy 2.0 + Alembic |
| Auth | JWT (PyJWT) + Argon2id |
| LLM | Google Gemini API (`gemini-3.1-pro-preview` with `gemini-3-flash-preview` fallback) |
| Embeddings | `gemini-embedding-2` |
| Vector DB | Qdrant Cloud |
| RAG | LangChain + Dynamic performance-based retrieval |
---

## Project Structure

```
StudyMate/
├── apps/
│   ├── web/          # Next.js frontend (Phase 3)
│   └── api/          # FastAPI backend
│       ├── core/     # Config, errors, security, dependencies
│       ├── models/   # SQLAlchemy models + Pydantic schemas
│       ├── routers/  # API route handlers
│       ├── services/ # Business logic (auth, PDF, embedding, RAG)
│       ├── migrations/  # Alembic database migrations
│       └── scripts/  # Utility scripts (DB wipe, etc.)
├── docs/             # Project documentation
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | ❌ | Health check |
| POST | `/auth/signup` | ❌ | Create a new account |
| POST | `/auth/login` | ❌ | Authenticate and receive tokens |
| POST | `/auth/refresh` | ❌ | Rotate refresh token and get a new access + refresh token pair |
| GET | `/auth/me` | ✅ | Get current user profile |
| PATCH | `/auth/me` | ✅ | Update editable profile fields (full_name, major) |
| POST | `/documents/upload` | ✅ | Upload + process a PDF |
| GET | `/documents` | ✅ | List all uploaded documents |
| GET | `/documents/{doc_id}` | ✅ | Get a single document's metadata |
| DELETE | `/documents/{doc_id}` | ✅ | Remove a document and its chunks |
| POST | `/chat` | ✅ | Send a query, get a RAG-grounded answer |
| POST | `/summary/generate` | ✅ | Generate a summary of a topic (6 formats) |
| POST | `/quiz/generate` | ✅ | Generate N MCQs (1–30) from a topic/document |
| POST | `/quiz/{session_id}/submit` | ✅ | Submit answers and calculate score |
| GET | `/history/chat` | ✅ | Get paginated chat history |
| GET | `/history/quizzes` | ✅ | Get paginated quiz history |
| GET | `/history/quizzes/{session_id}` | ✅ | Get detailed quiz session results |
| GET | `/history/summaries` | ✅ | Get paginated summary history |
| GET | `/stats` | ✅ | Aggregate study metrics (counts, streak, avg score) |
| GET | `/usage` | ✅ | Get current daily token usage and account limits |

> Full request/response examples for every endpoint live in
> [apps/api/README.md](apps/api/README.md) and [docs/API.md](docs/API.md).

---

## Getting Started

### Prerequisites

- Node.js 20+ (frontend)
- Python 3.11+ (backend)
- PostgreSQL (local pgAdmin or Neon free tier)
- Qdrant Cloud account (free tier)
- Google AI Studio API key

### Backend Setup

```bash
# Navigate to backend
cd apps/api

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
copy .env.example .env     # Windows
# cp .env.example .env     # macOS/Linux

# Edit .env with your actual credentials
# Then run database migrations
alembic upgrade head

# Start the server
uvicorn main:app --reload --port 8000
```

### Verify

```bash
# Health check
curl http://localhost:8000/health
# → {"status": "ok", "version": "1.0.0"}
```

### Frontend Setup

The frontend is a Next.js 16 app in `apps/web`. **It talks to the live FastAPI
backend** — start the backend first (above), then:

```bash
# Navigate to frontend
cd apps/web

# Install dependencies
npm install

# Copy environment variables
copy .env.example .env.local     # Windows
# cp .env.example .env.local     # macOS/Linux

# Start the development server
npm run dev
```

Open the app at the port set in `.env.local` (default **http://localhost:3000**).

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Next.js dev/start server listens on |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend the UI calls |

> The mock layer and `NEXT_PUBLIC_USE_MOCKS` flag have been **removed**. The UI now
> requires a running backend. See [apps/web/README.md](apps/web/README.md) for the
> full data-flow and page-by-page wiring.

---

## Testing the API

Open the interactive Swagger docs at **http://localhost:8000/docs** or use Postman. Below are copy-paste test payloads for every endpoint.

### Step 1 — Create an Account

**`POST /auth/signup`**
```json
{
  "email": "test@futo.edu.ng",
  "password": "testpassword123",
  "full_name": "Test Student"
}
```

Copy the `access_token` from the response. In Swagger, click **Authorize** (🔒) at the top and paste:
```
Bearer eyJ...your_access_token_here
```

### Step 2 — Login (if you already signed up)

**`POST /auth/login`**
```json
{
  "email": "test@futo.edu.ng",
  "password": "testpassword123"
}
```

### Step 3 — Check Your Profile

**`GET /auth/me`**  
No body needed — just make sure you're authorized.

### Step 4 — Refresh Token

**`POST /auth/refresh`**
```json
{
  "refresh_token": "eyJ...your_refresh_token_here"
}
```

### Step 5 — Upload a PDF

**`POST /documents/upload`**  
In Swagger: click "Try it out", select a PDF file from your machine.  
In Postman: set body to `form-data`, key = `file`, type = File, select a PDF.

> **Tip:** Use any lecture note PDF — the system will extract text, chunk it, embed it, and store it in Qdrant.

Copy the `doc_id` from the response — you'll need it for the next steps.

### Step 6 — List Your Documents

**`GET /documents`**  
No body needed. Returns all your uploaded documents.

### Step 7 — Chat with Your Document

**`POST /chat`**
```json
{
  "query": "What are the main topics covered in this document?",
  "doc_id": "paste-your-doc-id-here",
  "top_k": 5
}
```

Without `doc_id` (searches all your documents):
```json
{
  "query": "Explain the key concepts",
  "top_k": 5
}
```

### Step 8 — Generate a Summary

**`POST /summary/generate`**
```json
{
  "topic": "Introduction and Overview",
  "doc_id": "paste-your-doc-id-here",
  "top_k": 5,
  "format": "bullets"
}
```

`format` is one of: `bullets`, `key_concepts`, `study_guide`, `flashcards`,
`cheat_sheet`, `mind_map` (default `bullets`). The response includes a plain-text
`summary` (always) **and** a `structured` object shaped to the requested format —
for example, `format: "flashcards"` returns:

```json
{
  "summary": "- What is LIFO? — Last In, First Out…",
  "format": "flashcards",
  "structured": [
    { "front": "What is LIFO?", "back": "Last In, First Out — the Stack principle." }
  ],
  "context_sufficient": true,
  "sources": [ { "filename": "notes.pdf", "page_number": 4, "similarity_score": 0.9, "text_preview": "…" } ]
}
```

### Step 9 — Generate a Quiz

**`POST /quiz/generate`**
```json
{
  "topic": "Key concepts from the lecture",
  "doc_id": "paste-your-doc-id-here",
  "num_questions": 5,
  "top_k": 5
}
```

`num_questions` accepts **1–30** (configurable via `MAX_QUIZ_QUESTIONS`). Larger
quizzes take longer to generate and may hit the LLM's token/JSON limits, in which
case the backend retries with a stricter prompt and the fallback model.

Copy the `session_id` from the response to submit answers.

### Step 10 — Submit Quiz Answers

**`POST /quiz/{session_id}/submit`**  
Replace `{session_id}` in the URL with the one from Step 9.

```json
{
  "answers": [
    { "question_index": 0, "selected_index": 1 },
    { "question_index": 1, "selected_index": 0 },
    { "question_index": 2, "selected_index": 2 },
    { "question_index": 3, "selected_index": 3 },
    { "question_index": 4, "selected_index": 1 }
  ]
}
```

### Step 11 — View Chat History

**`GET /history/chat`**  
Optional query params: `?limit=10&offset=0&doc_id=your-doc-id`

### Step 12 — View Quiz History

**`GET /history/quizzes`**  
Optional query params: `?limit=10&offset=0&doc_id=your-doc-id`

### Step 13 — View Quiz Details

**`GET /history/quizzes/{session_id}`**  
Replace `{session_id}` with a quiz session ID from Step 12.

### Step 14 — Delete a Document

**`DELETE /documents/{doc_id}`**  
Replace `{doc_id}` with the document UUID. This removes the document from PostgreSQL and purges all its vectors from Qdrant.

### Step 15 — View Aggregate Stats

**`GET /stats`**  
No body needed. Returns real counts plus your study streak:
```json
{
  "documents_uploaded": 3,
  "quizzes_taken": 5,
  "summaries_generated": 2,
  "chats_count": 11,
  "current_streak": 4,
  "average_quiz_score": 82.0
}
```

### Step 16 — Update Your Profile

**`PATCH /auth/me`**  (email is immutable; only the supplied fields change)
```json
{ "full_name": "Updated Name", "major": "Computer Science & Engineering" }
```

---

## End-to-End Flow

How a single study session moves through the system:

```
┌──────────┐  signup/login   ┌────────────────────────────────────────────┐
│ Browser  │ ───────────────▶│ /auth/*  → JWT access + refresh tokens       │
│ (Next.js)│◀─────────────── │  (stored in localStorage, sent as Bearer)    │
└────┬─────┘                 └────────────────────────────────────────────┘
     │ upload PDF (multipart)
     ┌────────────────────────────────────────────────────────────────────────┐
│ /documents/upload                                                       │
│   pypdf extract → LangChain chunk (500/50) → gemini-embedding-2         │
│   → Qdrant upsert (vectors) + PostgreSQL row (metadata)                 │
│   → records a study-activity day (for streaks)                          │
└────┬───────────────────────────────────────────────────────────────────┘
     │ ask / summarize / quiz   (each carries doc_id + Bearer token)
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ RETRIEVE  embed query → Qdrant cosine search (top-k, ≥0.60) → chunks    │
│ GENERATE  Gemini, grounded strictly in chunks (primary → fallback)      │
│           • /chat     → answer + sources + context_sufficient           │
│           • /summary  → plain text + structured(format) + sources       │
│           • /quiz     → MCQs (server-graded on submit)                  │
│ PERSIST   chat_history / quiz_sessions / quiz_answers + activity        │
└────┬───────────────────────────────────────────────────────────────────┘
     │ history & stats
     ▼
   /history/* (timeline)   /stats (dashboard rings, streak, averages)
```

Key guarantees:
- **Grounded only:** the LLM may use *only* retrieved chunks; if the document lacks
  the answer it returns `context_sufficient: false` and the UI shows a clear notice.
- **Server-side grading:** quiz scores are computed by `/quiz/{id}/submit`, never in
  the browser.
- **Caching:** identical chat/summary requests (same `doc_id` + `top_k`) are served
  from history instead of re-calling the LLM.

---

## Performance & Cost Optimization

To prevent burning excessive LLM tokens, balance generation quality with execution speed, and ensure high-availability under load, StudyMate implements several performance engineering mechanisms:

### 1. Dynamic Performance-Tier System
Users can toggle between five performance modes inside their profile (persisted in local storage and attached via the `X-Performance-Mode` header):
*   **Low Level (Flash Lite):** Uses `gemini-3.1-flash-lite` with thinking turned off. Dynamic RAG settings: `default_top_k=5`, `max_top_k=10`. Optimized for rapid, lightweight operations.
*   **Medium Level (Flash):** Uses `gemini-3-flash-preview` with lightweight thinking. Dynamic RAG settings: `default_top_k=8`, `max_top_k=15`.
*   **High Level (Pro - Default):** Uses `gemini-3.1-pro-preview` with medium thinking. Dynamic RAG settings: `default_top_k=10`, `max_top_k=20`. Highly recommended for optimal academic reasoning.
*   **Very High Level (Pro + Deep Thinking):** Uses `gemini-3.1-pro-preview` with deep reasoning settings. Dynamic RAG settings: `default_top_k=15`, `max_top_k=25`.
*   **Max Level (Pro + Max Thinking):** Uses `gemini-3.1-pro-preview` with maximum reasoning/depth. Dynamic RAG settings: `default_top_k=20`, `max_top_k=30` for extensive data extraction.

### 2. Interactive Context Depth (K) Control
*   **Real-time Override:** In Chat, Summary, and Quiz screens, the user can manually override the dynamic default `top_k` value using an interactive slider.
*   **Dynamic Sliders:** The slider's range dynamically adjusts to clamp between a minimum of `5` chunks and the **performance tier's absolute maximum (`max_top_k`)**, ensuring that users are visually guided within the bounds of their active performance capabilities.

### 3. Tiered Daily Token Limits
To prevent database strain and manage LLM API pricing:
*   **Free Users:** Capped at **50,000** total daily tokens.
*   **Pro Users:** Capped at **500,000** total daily tokens.
*   **Budget Validation:** Verification happens synchronously on all generative requests (`/chat`, `/summary`, `/quiz`). Exceeding the quota issues a premium upgrade prompt modal or toast notice.

### 4. Query-Level Database Caching
For repetitive questions and summaries:
- **Unified History Caching:** If a student submits the exact same query or summary request within the same scope (`doc_id`), the backend skips the semantic search and LLM generation phases, serving the response directly from the database history.
- **Strict Context Checks:** To guarantee complete accuracy, the cache is context-aware. If the `top_k` chunk parameter changes between requests, the backend automatically bypasses the cache to retrieve a fresh, more complete context list.
- **Ultra-Low Latency:** Reduces duplicate generation time from **3-5 seconds** down to a microscopic **10-20 milliseconds**!

---

## Development

### Linting & Formatting

```bash
cd apps/api

# Lint
ruff check .

# Auto-fix lint issues
ruff check --fix .

# Format
ruff format .

# Type check
mypy .
```

### Database Migrations

```bash
cd apps/api

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Wipe & Reset Both Databases

To completely reset both PostgreSQL and Qdrant (drops all tables, deletes the vector collection, re-runs migrations, and re-creates the collection with indexes):

```bash
cd apps/api
python scripts/wipe_db.py
```

> **⚠️ Warning:** This permanently deletes ALL data — users, documents, chat history, quiz sessions, and all stored vectors. You will be prompted to confirm before execution.

---

## Documentation

See the `docs/` directory for detailed specifications:

- [PROJECT_PLAN.md](docs/PROJECT_PLAN.md) — Full project plan and architecture
- [API.md](docs/API.md) — API contract (all endpoints)
- [CONFIG.md](docs/CONFIG.md) — Environment variables reference
- [DATABASE.md](docs/DATABASE.md) — Database schema and ORM
- [AUTH.md](docs/AUTH.md) — Authentication and JWT specs
- [ERRORS.md](docs/ERRORS.md) — Error handling hierarchy
- [CONVENTIONS.md](docs/CONVENTIONS.md) — Code style and conventions
