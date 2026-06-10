"""Authentication service — business logic for signup, login, and refresh."""

import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.errors import AuthenticationError
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from models.database import RefreshToken, User


class AuthService:
    """Handles credentials verification, password hashing, and JWT tokens."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def signup(
        self, email: str, password: str, full_name: str
    ) -> tuple[User, str, str]:
        """Register a new user and generate access/refresh tokens.

        Raises:
            HTTPException: If email already exists or password is too short.
        """
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters.",
            )

        # Check duplicate email
        result = await self._db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered.",
            )

        # Hash credentials and create user record
        pw_hash = hash_password(password)
        user = User(email=email, password_hash=pw_hash, full_name=full_name)

        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)

        # Generate access and refresh tokens
        user_id_str = str(user.id)
        access_token = create_access_token(user_id_str)
        refresh_str, refresh_hash = create_refresh_token(user_id_str)

        # Save refresh token hash to DB
        expires_at = datetime.now(UTC) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        db_token = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
        )
        self._db.add(db_token)
        await self._db.commit()

        return user, access_token, refresh_str

    async def login(self, email: str, password: str) -> tuple[str, str]:
        """Verify user credentials and return (access_token, refresh_token).

        Raises:
            AuthenticationError: On invalid email or password.
        """
        result = await self._db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid email or password.")

        user_id_str = str(user.id)
        access_token = create_access_token(user_id_str)
        refresh_str, refresh_hash = create_refresh_token(user_id_str)

        # Save refresh token hash to DB
        expires_at = datetime.now(UTC) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        db_token = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
        )
        self._db.add(db_token)
        await self._db.commit()

        return access_token, refresh_str

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Validate a refresh token and generate a new access/refresh token pair.

        Enforces token rotation and reuse detection.
        Raises:
            AuthenticationError: On expired/invalid token or missing user.
        """
        try:
            payload = decode_token(refresh_token)
            user_id = payload.get("sub")
            token_type = payload.get("type")

            if user_id is None or token_type != "refresh":
                raise AuthenticationError("Token has expired or is invalid.")

        except InvalidTokenError:
            raise AuthenticationError("Token has expired or is invalid.") from None

        # Hash current token to lookup in DB
        current_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        result = await self._db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == current_hash)
        )
        db_token = result.scalar_one_or_none()

        # Token reuse detection
        if db_token is not None and db_token.is_revoked:
            # Revoke all tokens for this user immediately (indicates compromise)
            await self._db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == db_token.user_id)
                .values(is_revoked=True)
            )
            await self._db.commit()
            raise AuthenticationError("Token has been revoked.")

        now = datetime.now(UTC)
        if db_token is None or db_token.expires_at < now:
            raise AuthenticationError("Token has expired or is invalid.")

        # Verify user still exists in DB
        result = await self._db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise AuthenticationError("User not found.")

        # Revoke the used refresh token
        db_token.is_revoked = True

        # Generate a fresh access/refresh token pair
        user_id_str = str(user.id)
        access_token = create_access_token(user_id_str)
        refresh_str, refresh_hash = create_refresh_token(user_id_str)

        # Save new refresh token
        expires_at = datetime.now(UTC) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        new_db_token = RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
        )
        self._db.add(new_db_token)
        await self._db.commit()

        return access_token, refresh_str
