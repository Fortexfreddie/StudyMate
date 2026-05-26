"""Authentication service — business logic for signup, login, and refresh."""

from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import AuthenticationError
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from models.database import User


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
        refresh_token = create_refresh_token(user_id_str)

        return user, access_token, refresh_token

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
        refresh_token = create_refresh_token(user_id_str)

        return access_token, refresh_token

    async def refresh(self, refresh_token: str) -> str:
        """Validate a refresh token and generate a new access token.

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

        # Verify user still exists in DB
        result = await self._db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise AuthenticationError("User not found.")

        # Return a fresh access token
        return create_access_token(str(user.id))
