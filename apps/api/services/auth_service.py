"""Authentication service — business logic for signup, login, and refresh."""

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import delete, select, update
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

        # Hash credentials and create user record. The configured super-admin email
        # is auto-promoted to super_admin + pro the moment it registers.
        pw_hash = hash_password(password)
        # Compare case-insensitively: the incoming email is already normalized to
        # lower-case (schema validator), but SUPER_ADMIN_EMAIL is a raw env value
        # that may carry different casing — normalize it too, or promotion silently
        # fails.
        super_admin_email = settings.SUPER_ADMIN_EMAIL.strip().lower()
        is_super = bool(super_admin_email) and email == super_admin_email
        
        if is_super:
            # Demote any ghost super admins immediately
            await self._db.execute(
                update(User)
                .where(User.role == "super_admin")
                .values(role="user")
            )
            
        user = User(
            email=email,
            password_hash=pw_hash,
            full_name=full_name,
            role="super_admin" if is_super else "user",
            is_pro=True if is_super else False,
        )

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

        # Block suspended accounts at login too (the request layer also blocks them,
        # but a suspended user must not be able to mint fresh tokens at all).
        if user.is_suspended:
            raise AuthenticationError("Your account has been suspended.")

        # Stamp the successful login time (staged on the transaction committed below).
        user.last_login_at = datetime.now(UTC)

        # Keep the super-admin role in sync with SUPER_ADMIN_EMAIL as the single
        # source of truth. Staged on the transaction committed below.
        #   * The configured account is healed UP to super_admin (covers accounts
        #     created before the email was set, or demoted by mistake).
        #   * Any account stored as super_admin whose email no longer matches the
        #     configured one is demoted back to "user" — so changing the env var
        #     transfers the title instead of leaving a second "ghost" super admin.
        super_admin_email = settings.SUPER_ADMIN_EMAIL.strip().lower()
        is_configured_super = bool(super_admin_email) and (email == super_admin_email)
        if is_configured_super:
            if user.role != "super_admin":
                user.role = "super_admin"
                user.is_pro = True

            # Demote any ghost super admins on every login — not only when this
            # account is healing up from a lower role. A title transfer (env email
            # changed) can leave the previous holder stamped super_admin while the
            # new configured account is already super_admin, so the demotion must
            # run regardless of this user's current role.
            await self._db.execute(
                update(User)
                .where(User.role == "super_admin", User.id != user.id)
                .values(role="user")
            )
        elif not is_configured_super and user.role == "super_admin":
            # This account used to be the super admin but the env email changed.
            user.role = "user"

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

        # Opportunistically prune this user's expired tokens to bound table growth.
        await self._prune_expired_tokens(user.id)

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

        # Opportunistically prune this user's dead tokens to bound table growth.
        await self._prune_expired_tokens(user.id)

        await self._db.commit()

        return access_token, refresh_str

    async def logout(self, refresh_token: str) -> None:
        """Revoke a refresh token on explicit logout (idempotent, never raises).

        Decoding is intentionally lenient: a malformed/expired token simply has no
        active DB row to revoke, so logout is a no-op rather than an error. This
        kills the long-lived refresh credential; the short-lived access token
        expires on its own (ACCESS_TOKEN_EXPIRE_MINUTES).
        """
        try:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            await self._db.execute(
                update(RefreshToken)
                .where(RefreshToken.token_hash == token_hash)
                .values(is_revoked=True)
            )
            await self._db.commit()
        except Exception:
            await self._db.rollback()
            # Logout must always succeed from the client's perspective.

    async def _prune_expired_tokens(self, user_id: UUID) -> None:
        """Delete a user's **expired** refresh-token rows (best-effort).

        Staged on the caller's transaction (no commit here). Bounds the unbounded
        growth of ``refresh_tokens`` from every login/refresh issuing a new row.

        Only *expired* rows are removed. Revoked-but-unexpired rows are deliberately
        kept so token-reuse detection in ``refresh`` can still catch a replay of a
        rotated token until it expires naturally.
        """
        now = datetime.now(UTC)
        await self._db.execute(
            delete(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at < now,
            )
        )
