"""Authentication routers — signup, login, refresh, and profile endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from models.database import User, get_db
from models.schemas import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from services.auth_service import AuthService

router = APIRouter()


@router.post(
    "/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
async def signup(
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
async def login(
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
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> TokenResponse:
    """Acquire a fresh access token using a valid refresh token."""
    auth_service = AuthService(db)
    access = await auth_service.refresh(refresh_token=payload.refresh_token)
    return TokenResponse(access_token=access, refresh_token=None)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UserResponse:
    """Get the current logged-in user profile details."""
    return UserResponse.model_validate(current_user)
