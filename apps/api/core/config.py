"""Application settings loaded from environment variables.

All configuration is centralised here via pydantic-settings.
Import ``settings`` — never use ``os.getenv()`` directly.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API
    APP_NAME: str = "StudyMate API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    # Comma-separated list in the env (e.g. CORS_ORIGINS=http://localhost:3000,https://app.vercel.app)
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

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

    # JWT
    JWT_SECRET_KEY: str  # required — long random string
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google AI
    GOOGLE_API_KEY: str  # required — no default

    # Gemini Models
    GEMINI_PRIMARY_MODEL: str = "gemini-3-flash-preview"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"
    GENERATION_TEMPERATURE: float = 0.3
    MAX_RETRIES: int = 2
    RETRY_DELAY_SECONDS: int = 2

    # Embedding
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    EMBEDDING_BATCH_SIZE: int = 50

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
    RETRIEVAL_SIMILARITY_THRESHOLD: float = 0.60

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
