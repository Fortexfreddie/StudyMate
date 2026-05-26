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

from core.config import settings
from core.dependencies import get_qdrant_client
from core.errors import StudyMateError
from models.database import engine
from models.schemas import HealthResponse
from routers import auth, chat, documents, history, quiz, summary
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

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# Health check


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Public health check endpoint."""
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
    )


# Router includes (Phase 2)
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/chat")
app.include_router(summary.router, prefix="/summary")
app.include_router(quiz.router, prefix="/quiz")
app.include_router(history.router, prefix="/history")
