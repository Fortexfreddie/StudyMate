"""Application settings loaded from environment variables.

All configuration is centralised here via pydantic-settings.
Import ``settings`` — never use ``os.getenv()`` directly.
"""

from typing import Annotated, Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API
    APP_NAME: str = "StudyMate API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    # Comma-separated list in the env (e.g. CORS_ORIGINS=http://localhost:3000,https://app.vercel.app)
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors_origins(cls, v: object) -> object:
        """Allow CORS_ORIGINS to be provided as a comma-separated string in .env."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database
    DATABASE_URL: str  # required — e.g., postgresql+asyncpg://...

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def coerce_database_url(cls, v: object) -> object:
        """Ensure the database URL uses the asyncpg driver and lacks invalid params."""
        if isinstance(v, str):
            # Strip schema parameters which cause asyncpg errors
            if "?schema=" in v:
                v = v.split("?schema=")[0]
            elif "&schema=" in v:
                v = v.split("&schema=")[0]

            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
            # Standardize standard postgres driver if supplied
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    # Admin
    # The single super-admin account. On signup/login the user whose email matches
    # this is auto-assigned role "super_admin" and pro tier. Empty disables it.
    SUPER_ADMIN_EMAIL: str = ""

    # JWT
    JWT_SECRET_KEY: str  # required — long random string
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google AI
    GOOGLE_API_KEY: str  # required — no default
    # Optional fallback keys — used in order when the previous key's daily
    # embedding quota is exhausted. Leave blank to disable.
    GOOGLE_API_KEY_2: str = ""
    GOOGLE_API_KEY_3: str = ""

    # Gemini Models — primary/fallback for the "high" performance tier (default)
    # GEMINI_PRIMARY_MODEL: str = "gemini-3.1-pro-preview"
    # GEMINI_FALLBACK_MODEL: str = "gemini-3-flash-preview"
    GEMINI_PRIMARY_MODEL: str = "gemini-3.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"
    GENERATION_TEMPERATURE: float = 0.3
    MAX_RETRIES: int = 1  # number of primary model retries for transient errors
    RETRY_DELAY_SECONDS: int = 2
    # When the quiz parser rejects the first generation, a stricter reformat prompt
    # is sent. If True, that reprompt is a single primary-model call (no internal
    # transient-retry or fallback), capping worst-case LLM calls per quiz request.
    # Set False to let the reprompt use the full MAX_RETRIES + fallback path.
    QUIZ_REPROMPT_SINGLE_ATTEMPT: bool = True

    # Performance tier model overrides (medium/low use cheaper, faster models)
    # GEMINI_MEDIUM_MODEL: str = "gemini-3-flash-preview"
    GEMINI_MEDIUM_MODEL: str = "gemini-3.5-flash"
    GEMINI_LOW_MODEL: str = "gemini-3.1-flash-lite"

    # Token usage limits (per calendar-day window resetting at 00:00 UTC, per user)
    FREE_DAILY_TOKEN_LIMIT: int = 50_000
    PRO_DAILY_TOKEN_LIMIT: int = 500_000
    # Document upload (page) limits — a SEPARATE per-user/day quota from tokens.
    # Uploads consume the embedding model (gemini-embedding), which has its own
    # Google-side quota (requests/day + tokens/minute) distinct from the generation
    # model that tokens are billed against. Counting pages — not tokens — keeps the
    # two dimensions independent so a heavy uploader can't silently drain a user's
    # chat/summary/quiz budget (and vice versa). Same 00:00 UTC reset window.
    FREE_DAILY_PAGE_LIMIT: int = 50
    PRO_DAILY_PAGE_LIMIT: int = 1_000
    # Embedding
    EMBEDDING_MODEL: str = "models/gemini-embedding-2"
    # Texts sent per embedding request. gemini-embedding-2 accepts up to 8,192
    # input tokens *per text*; our chunks are ~500 tokens, so even large batches
    # stay well within limits. Bigger batch = fewer round-trips = faster ingestion,
    # which matters because ingestion runs against the platform request window.
    EMBEDDING_BATCH_SIZE: int = 100
    # Proactive pause between embedding batches. The free-tier embedding quota is
    # gated by tokens-per-minute, not requests-per-minute, so heavy per-batch
    # spacing is unnecessary — real rate-limit hits are caught reactively with
    # exponential backoff in the embedder. Kept small to avoid bloating the total
    # ingestion time (set to 0 to disable proactive spacing entirely).
    EMBEDDING_BATCH_DELAY_SECONDS: float = 0.2
    # Qdrant
    QDRANT_URL: str  # required — no default
    QDRANT_API_KEY: str  # required — no default
    COLLECTION_NAME: str = "studymate_chunks"
    VECTOR_SIZE: int = 3072
    UPSERT_BATCH_SIZE: int = 100

    # Document Processing
    DEFAULT_CHUNK_SIZE: int = 500
    DEFAULT_CHUNK_OVERLAP: int = 50
    MIN_CHUNK_LENGTH: int = 50
    MAX_UPLOAD_SIZE_MB: int = 20

    # Retrieval
    DEFAULT_TOP_K: int = 5
    RETRIEVAL_SIMILARITY_THRESHOLD: float = 0.35
    # Hard ceiling on chunks pulled for a full-document (sequential) summary. Unlike
    # top_k — which caps *similarity* retrieval — full-document mode reads the whole
    # document in page order, so it must not be bound by the user's retrieval slider.
    # This ceiling is a safety bound only: it stops a pathologically large document
    # from overflowing the LLM context window and spiking token cost. A typical
    # lecture PDF is well under this, so it is never truncated in practice.
    FULL_DOCUMENT_MAX_CHUNKS: int = 500

    # Quiz
    DEFAULT_QUIZ_QUESTIONS: int = 5
    MAX_QUIZ_QUESTIONS: int = 30

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Singleton instance — import this everywhere
settings = Settings()  # type: ignore[call-arg]


# Performance mode configuration — maps each mode to model, thinking, and top_k.
# This is a module-level constant (not a Settings field) because it's a derived
# lookup table, not an environment variable.
PERFORMANCE_MODES: dict[str, dict[str, Any]] = {
    "low": {
        "primary": settings.GEMINI_LOW_MODEL,
        "fallback": settings.GEMINI_LOW_MODEL,
        "thinking": "minimal",
        "default_top_k": 5,
        "max_top_k": 10,
    },
    "medium": {
        "primary": settings.GEMINI_MEDIUM_MODEL,
        "fallback": settings.GEMINI_LOW_MODEL,
        "thinking": "low",
        "default_top_k": 8,
        "max_top_k": 15,
    },
    "high": {
        "primary": settings.GEMINI_PRIMARY_MODEL,
        "fallback": settings.GEMINI_FALLBACK_MODEL,
        "thinking": "medium",
        "default_top_k": 10,
        "max_top_k": 20,
    },
    "very_high": {
        "primary": settings.GEMINI_PRIMARY_MODEL,
        "fallback": settings.GEMINI_FALLBACK_MODEL,
        "thinking": "high",
        "default_top_k": 15,
        "max_top_k": 25,
    },
    "max": {
        "primary": settings.GEMINI_PRIMARY_MODEL,
        "fallback": settings.GEMINI_PRIMARY_MODEL,
        "thinking": "high",
        "default_top_k": 20,
        "max_top_k": 30,
    },
}
