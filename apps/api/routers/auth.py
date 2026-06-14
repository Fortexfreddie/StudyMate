"""Authentication routers — signup, login, refresh, and profile endpoints."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from core.rate_limit import AUTH_LIMIT, REFRESH_LIMIT, limiter
from models.database import User, get_db
from models.schemas import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from services.auth_service import AuthService

router = APIRouter()


@router.post(
    "/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit(AUTH_LIMIT)
async def signup(
    request: Request,
    payload: SignupRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> AuthResponse:
    """Create a new user account and log them in."""
    auth_service = AuthService(db)
    user, access, refresh = await auth_service.signup(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    # Cast/construct the UserResponse and AuthResponse
    user_resp = UserResponse.model_validate(user)
    return AuthResponse(user=user_resp, access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(AUTH_LIMIT)
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    """Authenticate and receive access + refresh token pairs."""
    auth_service = AuthService(db)
    access, refresh = await auth_service.login(
        email=payload.email, password=payload.password
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(REFRESH_LIMIT)
async def refresh(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    """Acquire a fresh access token using a valid refresh token."""
    auth_service = AuthService(db)
    access, refresh = await auth_service.refresh(refresh_token=payload.refresh_token)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/logout", status_code=status.HTTP_200_OK)
@limiter.limit(REFRESH_LIMIT)
async def logout(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> dict[str, bool]:
    """Revoke a refresh token. Idempotent — always returns success.

    The short-lived access token is not server-side revocable; it expires on its
    own. This kills the long-lived refresh credential so it can't mint new access
    tokens. Clients should also discard both tokens locally.
    """
    auth_service = AuthService(db)
    await auth_service.logout(refresh_token=payload.refresh_token)
    return {"success": True}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserResponse:
    """Get the current logged-in user profile details."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> UserResponse:
    """Update editable profile fields (full_name, major).

    Only fields present in the request are changed; email is immutable. Returns the
    updated profile.
    """
    if payload.full_name is None and payload.major is None:
        return UserResponse.model_validate(current_user)

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.major is not None:
        # Trim surrounding whitespace; a whitespace-only value clears the field to
        # NULL. Casing is preserved (the admin breakdown groups case-insensitively),
        # so stored majors stay clean without rewriting what the user typed.
        major = payload.major.strip()
        current_user.major = major or None

    await db.commit()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)
