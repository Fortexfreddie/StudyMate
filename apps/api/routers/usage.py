"""Usage API Router — daily token consumption for the current user."""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from models.database import User, get_db
from models.schemas import UsageResponse
from services.token_service import get_usage_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Usage"])


@router.get(
    "",
    response_model=UsageResponse,
    status_code=status.HTTP_200_OK,
    summary="Get daily token usage for the current user",
)
async def get_usage(
    db: AsyncSession = Depends(get_db),  # noqa: B008
    current_user: User = Depends(get_current_user),  # noqa: B008
) -> UsageResponse:
    """Return how many tokens the user has consumed today and their tier limit."""
    summary = await get_usage_summary(db, current_user.id, current_user.effective_is_pro)

    return UsageResponse(
        tokens_used_today=summary.tokens_used_today,
        token_limit=summary.token_limit,
        tokens_remaining=max(0, summary.token_limit - summary.tokens_used_today),
        is_pro=current_user.effective_is_pro,
        usage_by_type=summary.by_type,
        reset_time=summary.reset_time.isoformat(),
    )
