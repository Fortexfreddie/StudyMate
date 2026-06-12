"""Rate limiting configuration using SlowAPI.

Provides per-endpoint rate limiting with proper JSON error responses.
Uses in-memory storage — suitable for single-instance deployments.
For multi-instance, swap to Redis-backed storage or use infrastructure-level
rate limiting (Nginx, Cloudflare, AWS WAF).
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Rate limit strings — centralised for easy tuning.
AUTH_LIMIT = "5/minute"
LLM_LIMIT = "10/minute"
UPLOAD_LIMIT = "5/minute"
REFRESH_LIMIT = "10/minute"

# Limiter singleton — keyed by client IP address.
limiter = Limiter(key_func=get_remote_address)


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Return a clean JSON 429 response when the rate limit is exceeded."""
    retry_after = getattr(exc, "retry_after", None)
    detail = "Rate limit exceeded. Please slow down and try again."
    if retry_after:
        detail = f"Rate limit exceeded. Try again in {retry_after} seconds."

    return JSONResponse(
        status_code=429,
        content={"detail": detail},
        headers={"Retry-After": str(retry_after or 60)},
    )
