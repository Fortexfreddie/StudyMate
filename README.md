# StudyMate — Automated Study Companion & Quiz Generator

A full-stack web application that lets students upload PDF lecture notes and interact with them through AI-powered chat, summaries, and auto-generated quizzes — all grounded in their own documents using RAG (Retrieval-Augmented Generation).

**Institution:** Federal University of Technology, Owerri  
**Author:** Ekwem Kamsiyochukwu Fredrick

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
├── docs/             # Project documentation
└── README.md
```

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
# Then run the server
uvicorn main:app --reload --port 8000
```

### Verify

```bash
# Health check
curl http://localhost:8000/health
# → {"status": "ok", "version": "1.0.0"}
```

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
