"""StudyMate API — FastAPI application entry point.

Sets up:
- CORS middleware
- Global exception handler for StudyMateError
- Health check endpoint
- Router includes (added in Phase 2)
- Lifespan handler for startup/shutdown
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from core.config import settings
from core.dependencies import get_qdrant_client
from core.errors import StudyMateError
from core.middleware import SecurityHeadersMiddleware
from core.rate_limit import limiter, rate_limit_exceeded_handler
from models.database import async_session, engine
from models.schemas import HealthResponse
from routers import (
    admin,
    auth,
    chat,
    documents,
    history,
    leaderboard,
    quiz,
    stats,
    summary,
    usage,
)
from services.vector_store import VectorStore

# Logging

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# Lifespan — startup / shutdown


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown events."""
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)

    # Initialize Qdrant collection and indices if a valid URL is provided
    try:
        qdrant_client = get_qdrant_client()
        vector_store = VectorStore(qdrant_client)
        await vector_store.ensure_collection_exists()
    except Exception as e:
        logger.error("Failed to connect or initialize Qdrant collection: %s", e)

    yield
    # Dispose the database engine on shutdown
    await engine.dispose()
    logger.info("Shutdown complete.")


# App instance

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)  # type: ignore[arg-type]

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)

# Global exception handler


@app.exception_handler(StudyMateError)
async def studymate_error_handler(
    request: Request, exc: StudyMateError
) -> JSONResponse:
    """Convert all StudyMateError subclasses to JSON error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Normalize any unhandled exception to the standard {"detail": ...} shape.

    Guarantees the API's "all errors are {detail}" contract even for unexpected
    failures (DB errors, bugs, OOM), and never leaks a stack trace to the client.
    The full traceback is logged server-side for debugging.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# Health check


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness check — confirms the process is up. Does not probe dependencies."""
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
    )


@app.get("/health/ready")
async def readiness_check() -> JSONResponse:
    """Readiness check — probes Postgres and Qdrant so deploy/health gates can tell
    whether the service can actually serve traffic (not just that the process is up).

    Returns 200 with per-dependency status when both are reachable, else 503.
    """
    checks: dict[str, str] = {}

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        logger.warning("Readiness: database probe failed: %s", e)
        checks["database"] = "unavailable"

    try:
        client = get_qdrant_client()
        await client.collection_exists(settings.COLLECTION_NAME)
        checks["qdrant"] = "ok"
    except Exception as e:
        logger.warning("Readiness: qdrant probe failed: %s", e)
        checks["qdrant"] = "unavailable"

    ready = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ready" if ready else "not_ready", "checks": checks},
    )


# Router includes
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(summary.router, prefix="/summary", tags=["Summary"])
app.include_router(quiz.router, prefix="/quiz", tags=["Quiz"])
app.include_router(history.router, prefix="/history", tags=["History"])
app.include_router(stats.router, prefix="/stats", tags=["Stats"])
app.include_router(usage.router, prefix="/usage", tags=["Usage"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(leaderboard.router, prefix="/leaderboard", tags=["Leaderboard"])
