"""FastAPI dependency injection — shared resources for route handlers."""

import logging
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PERFORMANCE_MODES, settings
from core.errors import AuthenticationError, ForbiddenError
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
_embedder: Embedder | None = None

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

    # A malformed `sub` (not a valid UUID) is a bad token, not a server error —
    # validate before the DB query so it returns 401 rather than a 500 from asyncpg.
    try:
        user_uuid = UUID(str(user_id))
    except (ValueError, TypeError):
        raise AuthenticationError("Invalid token.") from None

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthenticationError("User not found.")

    return user


async def get_current_admin(
    user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """Require an admin or super_admin. Reuses the user already loaded above."""
    if not user.is_admin_or_super:
        raise ForbiddenError("Admin access required.")
    return user


async def get_current_super_admin(
    user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """Require the super_admin — for role changes and user deletion."""
    if user.role != "super_admin":
        raise ForbiddenError("Super admin access required.")
    return user


def get_performance_mode(
    x_performance_mode: str | None = Header(default="high", alias="X-Performance-Mode"),
) -> str:
    """Extract performance mode from the X-Performance-Mode header.

    Falls back to 'high' if the header is missing or contains an invalid value.
    Accepts a plain ``str`` (not a ``Literal``) so an unknown value falls back
    gracefully here rather than being rejected with a 422 before this runs.
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
    """Dependency injector for Embedder — cached singleton.

    The Embedder is stateless (just wraps an API-keyed client), so constructing a
    fresh ``GoogleGenerativeAIEmbeddings`` on every request was pure overhead.
    """
    global _embedder
    if _embedder is None:
        _embedder = Embedder(api_key=settings.GOOGLE_API_KEY)
    return _embedder


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
