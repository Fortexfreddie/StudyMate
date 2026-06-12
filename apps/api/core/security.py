import hashlib
from datetime import UTC, datetime, timedelta
from typing import cast

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from core.config import settings

# Password hashing
ph = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash."""
    try:
        return cast(bool, ph.verify(hashed_password, plain_password))
    except VerifyMismatchError:
        return False


# JWT tokens


def create_access_token(user_id: str) -> str:
    """Create a short-lived access token."""
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Create a longer-lived refresh token.

    Returns (token_string, token_hash) where the token_hash is stored in the DB.
    """
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    token_str = jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    token_hash = hashlib.sha256(token_str.encode()).hexdigest()
    return token_str, token_hash


def decode_token(token: str) -> dict[str, object]:
    """Decode and validate a JWT token.

    Raises ``InvalidTokenError`` on failure (expired, malformed, bad signature).
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return cast(dict[str, object], payload)
