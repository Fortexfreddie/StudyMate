"""FastAPI dependency injection — shared resources for route handlers."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from qdrant_client.async_qdrant_client import AsyncQdrantClient
from sqlalchemy import select, update
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

# Presence heartbeat throttle — update User.last_seen_at at most once per this many
# seconds per user. Keeps "online" detection accurate without writing on every
# authenticated request.
_HEARTBEAT_THROTTLE_SECONDS = 60

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

    # Block suspended accounts at the request layer — a suspended user's existing
    # access token must stop working immediately, not just at their next login.
    if user.is_suspended:
        raise AuthenticationError("Your account has been suspended.")

    await _touch_last_seen(db, user)

    return user


async def _touch_last_seen(db: AsyncSession, user: User) -> None:
    """Throttled presence heartbeat — stamp ``last_seen_at`` for "online" detection.

    Updates at most once per ``_HEARTBEAT_THROTTLE_SECONDS`` per user so this adds
    no more than one tiny UPDATE per minute to a user's request stream. Fully
    best-effort: a heartbeat failure must never turn a valid request into a 500, so
    it rolls back its own partial write and swallows the error.
    """
    now = datetime.now(UTC)
    last_seen = user.last_seen_at
    if last_seen is not None and (now - last_seen) <= timedelta(
        seconds=_HEARTBEAT_THROTTLE_SECONDS
    ):
        return
    try:
        await db.execute(
            update(User).where(User.id == user.id).values(last_seen_at=now)
        )
        await db.commit()
        user.last_seen_at = now
    except Exception:
        await db.rollback()
        logger.warning(
            "Failed to update last_seen_at for user %s (non-fatal).",
            user.id,
            exc_info=True,
        )


async def get_current_admin(
    user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """Require an admin or super_admin. Reuses the user already loaded above.
    
    Dynamically strips super_admin privileges if the env variable changed.
    """
    super_admin_email = settings.SUPER_ADMIN_EMAIL.strip().lower()
    is_configured_super = bool(super_admin_email) and (user.email == super_admin_email)
    
    # If they are a DB super_admin but NOT the configured env super_admin, they are functionally demoted to user
    if user.role == "super_admin" and bool(super_admin_email) and not is_configured_super:
        raise ForbiddenError("Admin access required.")

    if not user.is_admin_or_super and not is_configured_super:
        raise ForbiddenError("Admin access required.")
    return user


async def get_current_super_admin(
    user: User = Depends(get_current_user),  # noqa: B008
) -> User:
    """Require the super_admin — for role changes and user deletion.
    
    Dynamically enforces that only the configured env SUPER_ADMIN_EMAIL has access.
    """
    super_admin_email = settings.SUPER_ADMIN_EMAIL.strip().lower()
    is_configured_super = bool(super_admin_email) and (user.email == super_admin_email)

    if not is_configured_super:
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

    The Embedder is stateless (just wraps API-keyed clients), so constructing
    fresh ``GoogleGenerativeAIEmbeddings`` on every request was pure overhead.
    Passes all configured API keys so the embedder can failover on daily quota.
    """
    global _embedder
    if _embedder is None:
        # Primary key plus any configured fallbacks, in priority order.
        # Embedder filters out blanks, so unset fallbacks are harmless.
        api_keys = [
            settings.GOOGLE_API_KEY,
            settings.GOOGLE_API_KEY_2,
            settings.GOOGLE_API_KEY_3,
        ]
        _embedder = Embedder(api_keys=api_keys)
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
    """Dependency injector for Generator — uses request's performance mode and caches instances.

    Passes the primary key plus any configured fallbacks so the generator can
    fail over to another key when one key's daily quota is exhausted. The
    Generator filters out blanks, so unset fallbacks are harmless.
    """
    if performance_mode not in _generator_cache:
        api_keys = [
            settings.GOOGLE_API_KEY,
            settings.GOOGLE_API_KEY_2,
            settings.GOOGLE_API_KEY_3,
        ]
        _generator_cache[performance_mode] = Generator(
            api_keys=api_keys, performance_mode=performance_mode
        )
    return _generator_cache[performance_mode]
