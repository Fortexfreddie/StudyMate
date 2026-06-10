"""FastAPI dependency injection — shared resources for route handlers."""

import logging
from typing import Literal

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PERFORMANCE_MODES, settings
from core.errors import AuthenticationError
from core.security import decode_token
from models.database import User, get_db
from services.embedder import Embedder
from services.generator import Generator
from services.pdf_processor import PDFProcessor
from services.retriever import Retriever
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Shared client singletons
_qdrant_client: AsyncQdrantClient | None = None

# Valid performance mode keys
_VALID_MODES = frozenset(PERFORMANCE_MODES.keys())

# Cache for Generator instances
_generator_cache: dict[str, Generator] = {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> User:
    """Extract and validate the current user from a JWT access token."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if user_id is None or token_type != "access":
            raise AuthenticationError("Invalid token.")

    except InvalidTokenError:
        raise AuthenticationError("Token has expired or is invalid.") from None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthenticationError("User not found.")

    return user


def get_performance_mode(
    x_performance_mode: Literal["low", "medium", "high", "very_high", "max"]
    | None = Header(default="high", alias="X-Performance-Mode"),
) -> str:
    """Extract performance mode from the X-Performance-Mode header.

    Falls back to 'high' if the header is missing or contains an invalid value.
    """
    mode = (x_performance_mode or "high").lower().strip()
    return mode if mode in _VALID_MODES else "high"


def get_qdrant_client() -> AsyncQdrantClient:
    """Expose shared AsyncQdrantClient singleton."""
    global _qdrant_client
    if _qdrant_client is None:
        logger.info("Initializing AsyncQdrantClient with URL: %s", settings.QDRANT_URL)
        _qdrant_client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
            check_compatibility=False,
            timeout=60,
        )
    return _qdrant_client


def get_vector_store(
    client: AsyncQdrantClient = Depends(get_qdrant_client),  # noqa: B008
) -> VectorStore:
    """Dependency injector for VectorStore."""
    return VectorStore(client)


def get_embedder() -> Embedder:
    """Dependency injector for Embedder."""
    return Embedder(api_key=settings.GOOGLE_API_KEY)


def get_pdf_processor() -> PDFProcessor:
    """Dependency injector for PDFProcessor."""
    return PDFProcessor()


def get_retriever(
    vector_store: VectorStore = Depends(get_vector_store),  # noqa: B008
    embedder: Embedder = Depends(get_embedder),  # noqa: B008
) -> Retriever:
    """Dependency injector for Retriever."""
    return Retriever(vector_store, embedder)


def get_generator(
    performance_mode: str = Depends(get_performance_mode),  # noqa: B008
) -> Generator:
    """Dependency injector for Generator — uses request's performance mode and caches instances."""
    if performance_mode not in _generator_cache:
        _generator_cache[performance_mode] = Generator(
            api_key=settings.GOOGLE_API_KEY, performance_mode=performance_mode
        )
    return _generator_cache[performance_mode]
