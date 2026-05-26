# Automated Study Companion & Quiz Generator — Project Plan

**Project:** Design and Implementation of an Automated Study Companion and Quiz Generator Using RAG  
**Institution:** Federal University of Technology, Owerri  
**Author:** Ekwem Kamsiyochukwu Fredrick (20211268555)

---

## 1. What We're Building

A full-stack web application where a student uploads their PDF lecture notes and the system:

1. **Parses & chunks** the PDF into semantically coherent segments
2. **Embeds** each chunk into a vector space using Google's embedding model
3. **Stores** the vectors in a vector database (Qdrant)
4. **Retrieves** the top-k most relevant chunks using cosine similarity when a student queries
5. **Generates** — using Google Gemini, strictly constrained to retrieved context — either:
   - A direct answer to a question (chat)
   - A concise summary of a topic
   - Multiple-choice quiz questions with 4 options and a correct answer indicated

This is a RAG (Retrieval-Augmented Generation) architecture — the LLM never hallucinates because it can only use what was retrieved from the student's own document.

---

## 2. Tech Stack

| Layer | Technology | Version | Why |
|---|---|---|---|
| Frontend | Next.js + React + TypeScript | 16.x | SSR, Turbopack, React Compiler, Vercel deploy |
| Styling | Tailwind CSS | 4.x | Utility-first, CSS-native config |
| Backend | Python + FastAPI | >=0.136.0 | Best AI/ML ecosystem, async support |
| Relational DB | PostgreSQL (Neon free tier) | — | User accounts, chat history, quiz history |
| Auth | JWT (PyJWT, passlib) | — | Stateless token-based authentication |
| ORM & Migrations| SQLAlchemy + Alembic | >=2.0.0 | Async ORM, schema version control |
| RAG Orchestration | LangChain | >=1.3.0 | Pre-built RAG chains, loaders, splitters |
| LLM (primary) | Google Gemini API (`gemini-3-flash-preview`) | — | Free tier, large context |
| LLM (fallback) | Google Gemini API (`gemini-3.1-flash-lite`) | — | Free tier, lighter/faster |
| Embeddings | Google `gemini-embedding-001` | — | Stable, 100+ languages, same provider as LLM |
| Google SDK | `langchain-google-genai` | >=4.2.0 | Wraps `google-genai` SDK, LangChain native |
| Vector DB | Qdrant (Cloud free tier) | client >=1.18.0 | No monthly R/W limits, payload filtering, open source |
| PDF Parsing | pypdf | >=6.12.0 | Lightweight, no external dependencies |
| Config | pydantic-settings | >=2.14.0 | Typed env var management |
| Deployment | Vercel (frontend) + Railway or Render (backend) | — | Free tiers, HTTPS, auto-deploy |

---

## 3. System Architecture (5 Layers)

```
[Student Browser]
      │
      ▼
┌─────────────────────────────┐
│  PRESENTATION LAYER         │  Next.js 16 + React + Tailwind v4
│  • Login / Signup           │
│  • Upload PDF               │
│  • Chat / Query input       │
│  • Quiz display + history   │
│  • Summary display          │
└────────────┬────────────────┘
             │ REST API (HTTP/JSON) + JWT Auth
             ▼
┌─────────────────────────────┐
│  AUTH + HISTORY LAYER       │  FastAPI + PostgreSQL
│  • User signup/login        │
│  • JWT token management     │
│  • Chat & Quiz history      │
│  • Document ownership       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  DOCUMENT PROCESSING LAYER  │  FastAPI + pypdf + LangChain
│  • PDF text extraction      │
│  • Chunking (500t / 50 overlap)│
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  EMBEDDING & STORAGE LAYER  │  gemini-embedding-001 + Qdrant
│  • Embed each chunk         │
│  • Store vectors + metadata │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  RETRIEVAL LAYER            │  Qdrant semantic search
│  • Embed user query         │
│  • Cosine similarity search │
│  • Return top-5 chunks      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  GENERATION LAYER           │  Google Gemini API
│  • Prompt engineering       │
│  • Constrained generation   │
│  • Auto-retry with fallback │
│  • Quiz / Summary output    │
└─────────────────────────────┘
```

---

## 4. Monorepo Folder Structure

```
StudyMate/
├── apps/
│   ├── web/                        # Next.js 16 frontend
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing / upload
│   │   │   ├── chat/page.tsx       # Chat with document
│   │   │   └── quiz/page.tsx       # Quiz mode
│   │   ├── components/
│   │   │   ├── upload/
│   │   │   │   └── UploadDropzone.tsx
│   │   │   ├── chat/
│   │   │   │   └── ChatWindow.tsx
│   │   │   ├── quiz/
│   │   │   │   └── QuizCard.tsx
│   │   │   └── summary/
│   │   │       └── SummaryPanel.tsx
│   │   ├── lib/
│   │   │   ├── api.ts              # Backend API client
│   │   │   └── types.ts            # Shared TypeScript types
│   │   ├── public/
│   │   ├── .env.local
│   │   ├── next.config.ts
│   │   └── tsconfig.json
│   │
│   └── api/                        # FastAPI backend
│       ├── routers/
│       │   ├── auth.py             # Auth endpoints (signup, login)
│       │   ├── documents.py        # /documents endpoints
│       │   ├── chat.py             # /chat endpoint
│       │   ├── quiz.py             # /quiz endpoint
│       │   ├── summary.py          # /summary endpoint
│       │   └── history.py          # Chat/quiz history
│       ├── services/
│       │   ├── auth_service.py     # Password hashing & JWT
│       │   ├── pdf_processor.py    # Extraction + chunking
│       │   ├── embedder.py         # Google embedding calls
│       │   ├── vector_store.py     # Qdrant operations
│       │   ├── retriever.py        # Semantic search logic
│       │   └── generator.py        # Gemini generation + prompts
│       ├── models/
│       │   ├── schemas.py          # Pydantic request/response models
│       │   └── database.py         # SQLAlchemy models + engine
│       ├── core/
│       │   ├── config.py           # Settings (env vars)
│       │   ├── dependencies.py     # FastAPI dependency injection
│       │   ├── errors.py           # Custom exception hierarchy
│       │   └── security.py         # JWT and password utils
│       ├── migrations/             # Alembic migrations
│       ├── main.py                 # App entry point
│       ├── requirements.txt
│       └── .env
│
├── docs/
│   ├── PROJECT_PLAN.md             # This file
│   ├── CONVENTIONS.md              # Code style & conventions
│   ├── API.md                      # API contract (endpoints)
│   ├── CONFIG.md                   # Environment variables reference
│   ├── ERRORS.md                   # Error hierarchy
│   ├── DATABASE.md                 # DB schema & ORM
│   ├── AUTH.md                     # Auth & JWT specs
│   └── agents/
│       ├── DOCUMENT_PROCESSOR.md
│       ├── RETRIEVAL_AGENT.md
│       ├── GENERATION_AGENT.md
│       ├── EMBEDDER.md
│       └── VECTOR_STORE.md
│
└── README.md
```

---

## 5. Development Phases

### Phase 1 — Project Scaffolding & Infrastructure
1. Monorepo structure, envs, configs
2. FastAPI app setup with CORS and health check
3. Pydantic schemas for all API contracts
4. Custom error hierarchy
5. PostgreSQL DB setup with SQLAlchemy + Alembic models
6. Qdrant Cloud collection setup
7. Git repo with branch strategy

### Phase 2 — Backend Core (RAG Pipeline & Auth)

#### Phase 2A — User Authentication & Account Security
1. Implement `AuthService` logic (signup, login, token refresh)
2. Create `/auth/signup`, `/auth/login`, `/auth/refresh`, and `/auth/me` routers
3. Wire and test authentication endpoints with mock/real DB

#### Phase 2B — Document Ingestion Pipeline
1. Implement `PDFProcessor` service using `pypdf` and LangChain text splitting
2. Implement `Embedder` service using Google Generative AI Embeddings
3. Implement `VectorStore` service using async Qdrant client
4. Create `/documents/upload`, `/documents` (list), and `/documents/{doc_id}` (delete) routers
5. Wire and test upload ingestion (PDF -> text -> chunks -> embeddings -> Qdrant + PG metadata)

#### Phase 2C — Semantic Retrieval & RAG Generation
1. Implement `Retriever` service with cosine similarity pre-filtering (0.60 threshold)
2. Implement `Generator` service with prompt templates for chat, summary, and quiz modes
3. Support two-model fallback retry (primary model to fallback on 429)
4. Implement defensive JSON output parsing for multiple-choice quiz questions

#### Phase 2D — Conversational & Evaluation Features
1. Create `/chat` router (grounded RAG query, save to history)
2. Create `/summary/generate` router (grounded summary query, save to history)
3. Create `/quiz/generate` and `/quiz/{session_id}/submit` routers (grounded quiz session orchestration)
4. Create `/history/chat` and `/history/quizzes` (including quiz details) routers
5. End-to-end local validation of full RAG operations

### Phase 3 — Frontend
1. Next.js 16 app setup with Tailwind v4 + TypeScript
2. PDF upload page with drag-and-drop
3. API client layer (`lib/api.ts`)
4. Chat/Q&A interface
5. Summary request UI
6. Quiz card UI with option selection + answer reveal
7. Quiz score tracker (session state)
8. Document management (list uploaded docs, select active, delete)

### Phase 4 — Integration & Polish
1. End-to-end integration tests
2. Error handling (missing context, Gemini failures, bad PDFs)
3. Loading states and skeleton UI
4. Mobile responsiveness
5. Environment variable hardening
6. Code cleanup per CONVENTIONS.md

### Phase 5 — Deployment
1. Deploy backend to Railway or Render
2. Deploy frontend to Vercel
3. HTTPS and environment variable configuration
4. Production smoke test

### Phase 6 — Evaluation (Chapter 4)
1. Deploy to production URLs
2. Create Google Forms questionnaire (5 dimensions × Likert scale)
3. Recruit 30 undergraduate students (purposive sampling, multi-department)
4. Students interact with system using their own lecture PDFs
5. Administer questionnaire immediately after interaction
6. Data analysis: frequency/percentage, mean scores, Cronbach's alpha
7. Generate bar charts and tables for Chapter 4
8. Draft Chapter 4 findings narrative

---

## 6. API Contract (Summary)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/documents/upload` | Upload + process a PDF |
| GET | `/documents` | List all uploaded documents |
| DELETE | `/documents/{doc_id}` | Remove a document and its chunks |
| POST | `/chat` | Send a query, get a RAG-grounded answer |
| POST | `/quiz/generate` | Generate N MCQs from a topic/document |
| POST | `/quiz/{session_id}/submit` | Submit answers and calculate score |
| POST | `/summary/generate` | Generate a summary of a topic |

---

## 7. Key Configuration Values

| Parameter | Value | Reason |
|---|---|---|
| Chunk size | 500 tokens | Evaluated optimal for retrieval quality |
| Chunk overlap | 50 tokens | Prevents boundary sentence loss |
| Top-k retrieval | 5 chunks | Balances context richness vs. token budget |
| Similarity threshold | 0.60 | Filters out low-quality matches |
| LLM (primary) | `gemini-3-flash-preview` | Free tier, Preview, strong instruction-following |
| LLM (fallback) | `gemini-3.1-flash-lite` | Free tier, GA, lighter |
| Embedding model | `gemini-embedding-001` | Same provider = consistent vector space |
| Generation temperature | 0.3 | Low = more factual, less creative |
| Max quiz questions | 10 | Upper bound per request |
| Default quiz questions | 5 | Default per request |

---

## 8. Constraints & Rules

- The LLM **must never** generate outside of retrieved context. The system prompt enforces this.
- If retrieved context is insufficient, Gemini must say so — not fabricate.
- All quiz outputs must be **structured JSON** parsed by the backend before returning to the frontend.
- PDF only — no image, audio, or video ingestion.
- On rate-limit errors (429), the system automatically retries with the fallback model before surfacing an error.
