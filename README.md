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
| Phase 3 — Frontend (Next.js) | 🔲 Not started |
| Phase 4 — Integration & Polish | 🔲 Not started |
| Phase 5 — Deployment | 🔲 Not started |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React + TypeScript + Tailwind v4 |
| Backend | Python 3.11 + FastAPI |
| Database | PostgreSQL (Neon) + SQLAlchemy 2.0 + Alembic |
| Auth | JWT (PyJWT) + bcrypt |
| LLM | Google Gemini API (`gemini-3-flash-preview`) |
| Embeddings | `gemini-embedding-001` |
| Vector DB | Qdrant Cloud |
| RAG | LangChain |

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
| POST | `/auth/refresh` | ❌ | Get a new access token |
| GET | `/auth/me` | ✅ | Get current user profile |
| POST | `/documents/upload` | ✅ | Upload + process a PDF |
| GET | `/documents` | ✅ | List all uploaded documents |
| DELETE | `/documents/{doc_id}` | ✅ | Remove a document and its chunks |
| POST | `/chat` | ✅ | Send a query, get a RAG-grounded answer |
| POST | `/summary/generate` | ✅ | Generate a summary of a topic |
| POST | `/quiz/generate` | ✅ | Generate N MCQs from a topic/document |
| POST | `/quiz/{session_id}/submit` | ✅ | Submit answers and calculate score |
| GET | `/history/chat` | ✅ | Get paginated chat history |
| GET | `/history/quizzes` | ✅ | Get paginated quiz history |
| GET | `/history/quizzes/{session_id}` | ✅ | Get detailed quiz session results |

---

## Getting Started

### Prerequisites

- Python 3.11+
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
  "top_k": 5
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
