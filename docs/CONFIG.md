# Configuration Reference

**File:** `apps/api/core/config.py`  
**Role:** Single source of truth for all environment variables and configuration constants.

---

## Implementation

All configuration is loaded through `pydantic-settings`, which validates env vars at startup and provides typed access throughout the application.

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- API ---
    APP_NAME: str = "StudyMate API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Database ---
    DATABASE_URL: str  # required — e.g., postgresql+asyncpg://...

    # --- JWT ---
    JWT_SECRET_KEY: str  # required — long random string
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Google AI ---
    GOOGLE_API_KEY: str  # required — no default
    GOOGLE_API_KEY_2: str = ""  # optional fallback when key 1's daily quota is exhausted
    GOOGLE_API_KEY_3: str = ""  # optional fallback when key 2's daily quota is exhausted

    # --- Gemini Models (high tier = primary/fallback; medium/low tiers below) ---
    GEMINI_PRIMARY_MODEL: str = "gemini-3.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_MEDIUM_MODEL: str = "gemini-3.5-flash"
    GEMINI_LOW_MODEL: str = "gemini-3.1-flash-lite"
    GENERATION_TEMPERATURE: float = 0.3
    MAX_RETRIES: int = 1
    RETRY_DELAY_SECONDS: int = 2
    QUIZ_REPROMPT_SINGLE_ATTEMPT: bool = True

    # --- Token quotas (fixed UTC-day window, per user) ---
    FREE_DAILY_TOKEN_LIMIT: int = 50_000
    PRO_DAILY_TOKEN_LIMIT: int = 500_000

    # --- Embedding ---
    EMBEDDING_MODEL: str = "models/gemini-embedding-2"
    EMBEDDING_BATCH_SIZE: int = 100
    EMBEDDING_BATCH_DELAY_SECONDS: float = 0.2

    # --- Qdrant ---
    QDRANT_URL: str  # required — no default
    QDRANT_API_KEY: str  # required — no default
    COLLECTION_NAME: str = "studymate_chunks"
    VECTOR_SIZE: int = 3072
    UPSERT_BATCH_SIZE: int = 100

    # --- Document Processing ---
    DEFAULT_CHUNK_SIZE: int = 500
    DEFAULT_CHUNK_OVERLAP: int = 50
    MIN_CHUNK_LENGTH: int = 50
    MAX_UPLOAD_SIZE_MB: int = 20

    # --- Retrieval ---
    DEFAULT_TOP_K: int = 5
    RETRIEVAL_SIMILARITY_THRESHOLD: float = 0.35
    FULL_DOCUMENT_MAX_CHUNKS: int = 500

    # --- Quiz ---
    DEFAULT_QUIZ_QUESTIONS: int = 5
    MAX_QUIZ_QUESTIONS: int = 30  # enforced by a field_validator on QuizGenerateRequest

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Singleton instance — import this everywhere
settings = Settings()
```

---

## Environment Variables

### Required (no defaults — app crashes at startup if missing)

| Variable | Type | Description |
|---|---|---|
| `DATABASE_URL` | `str` | PostgreSQL connection string (local pgAdmin or Neon) |
| `JWT_SECRET_KEY` | `str` | Secret key for JWT token signing (long random string) |
| `GOOGLE_API_KEY` | `str` | Google AI Studio API key for Gemini and embedding calls |
| `QDRANT_URL` | `str` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | `str` | Qdrant Cloud API key |

### Optional (have defaults)

| Variable | Default | Description |
|---|---|---|
| `JWT_ALGORITHM` | `"HS256"` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `APP_NAME` | `"StudyMate API"` | Application name for health check |
| `APP_VERSION` | `"1.0.0"` | Version string for health check |
| `DEBUG` | `false` | Enable debug logging |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins (comma-separated in .env) |
| `GOOGLE_API_KEY_2` | `""` | Optional fallback API key — used when key 1's daily embedding quota is exhausted |
| `GOOGLE_API_KEY_3` | `""` | Optional fallback API key — used when key 2's daily embedding quota is exhausted |
| `GEMINI_PRIMARY_MODEL` | `"gemini-3.5-flash"` | Primary LLM (high/very_high/max tiers) |
| `GEMINI_FALLBACK_MODEL` | `"gemini-3.1-flash-lite"` | Fallback LLM on rate-limit / failover |
| `GEMINI_MEDIUM_MODEL` | `"gemini-3.5-flash"` | Primary LLM for the `medium` tier |
| `GEMINI_LOW_MODEL` | `"gemini-3.1-flash-lite"` | Primary LLM for the `low` tier |
| `GENERATION_TEMPERATURE` | `0.3` | LLM generation temperature |
| `MAX_RETRIES` | `1` | Primary-model transient-error retries before fallback |
| `RETRY_DELAY_SECONDS` | `2` | Seconds to wait between retries |
| `QUIZ_REPROMPT_SINGLE_ATTEMPT` | `true` | Quiz reformat reprompt = single LLM call (caps quiz calls at 4) |
| `FREE_DAILY_TOKEN_LIMIT` | `50000` | Free-tier daily token quota (fixed UTC-day window) |
| `PRO_DAILY_TOKEN_LIMIT` | `500000` | Pro-tier daily token quota |
| `EMBEDDING_MODEL` | `"models/gemini-embedding-2"` | Embedding model identifier (8,192-token input cap per text; chunks are ~500 tokens) |
| `EMBEDDING_BATCH_SIZE` | `100` | Texts per embedding API call (fewer round-trips = faster ingestion) |
| `EMBEDDING_BATCH_DELAY_SECONDS` | `0.2` | Proactive pause between embedding batches; `0` disables it (free-tier quota is token-per-minute gated, so spacing is light, not the throttle) |
| `COLLECTION_NAME` | `"studymate_chunks"` | Qdrant collection name |
| `VECTOR_SIZE` | `3072` | Embedding vector dimensions |
| `UPSERT_BATCH_SIZE` | `100` | Points per Qdrant upsert call |
| `DEFAULT_CHUNK_SIZE` | `500` | Token count per document chunk |
| `DEFAULT_CHUNK_OVERLAP` | `50` | Overlap tokens between chunks |
| `MIN_CHUNK_LENGTH` | `50` | Minimum characters to keep a chunk |
| `MAX_UPLOAD_SIZE_MB` | `20` | Maximum PDF upload size |
| `DEFAULT_TOP_K` | `5` | Default chunks to retrieve |
| `RETRIEVAL_SIMILARITY_THRESHOLD` | `0.35` | Minimum similarity score |
| `FULL_DOCUMENT_MAX_CHUNKS` | `500` | Safety ceiling on chunks read for a `full_document` summary (bypasses `top_k` and the threshold; bounds the LLM context window) |
| `DEFAULT_QUIZ_QUESTIONS` | `5` | Default MCQs per quiz request |
| `MAX_QUIZ_QUESTIONS` | `30` | Maximum MCQs per quiz request (authoritative — enforced via `field_validator`) |

---

## `.env.example`

```env
# === REQUIRED ===
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/studymate
JWT_SECRET_KEY=your-very-long-random-secret-key-at-least-32-chars
GOOGLE_API_KEY=your-google-api-key
QDRANT_URL=https://your-cluster-id.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# === OPTIONAL (uncomment to override defaults) ===
# DEBUG=true
# CORS_ORIGINS is a COMMA-SEPARATED string (not a JSON array):
# CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app
# ACCESS_TOKEN_EXPIRE_MINUTES=30
# REFRESH_TOKEN_EXPIRE_DAYS=7
# GEMINI_PRIMARY_MODEL=gemini-3.5-flash
# GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite
# GENERATION_TEMPERATURE=0.3
# COLLECTION_NAME=studymate_chunks
```

### Local Dev vs Production

```env
# Local (pgAdmin)
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/studymate

# Production (Neon)
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.us-east-2.aws.neon.tech/studymate?sslmode=require
```

Same env var — just change the connection string when deploying.

---

## Frontend Environment Variables

The Next.js frontend has its own `.env.local`:

```env
# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Only `NEXT_PUBLIC_` prefixed variables are exposed to the browser. The API URL is the only one needed.

---

## Usage Rules

1. **Import `settings` — never `os.getenv()`**
   ```python
   # ✅ Correct
   from core.config import settings
   model = settings.GEMINI_PRIMARY_MODEL

   # ❌ Wrong
   import os
   model = os.getenv("GEMINI_PRIMARY_MODEL")
   ```

2. **Inject via `Depends()` in routers** — services receive settings through dependency injection, not direct imports (for testability).

3. **`.env` is always in `.gitignore`** — never commit secrets.

4. **`.env.example` is committed** — shows all available variables with placeholder values.
