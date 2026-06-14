"""Google AI Embedding service — converts PDF text chunks to vector representations.

Supports multiple API keys with automatic failover when a key's daily quota is
exhausted (``PerDay`` quota errors).  Per-minute (RPM) rate limits are still
retried with exponential backoff on the *current* key.
"""

import asyncio
import logging
import re
import time
from collections.abc import Callable
from typing import Any

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pydantic import SecretStr

from core.config import settings
from core.errors import ConfigurationError, QuotaExhaustedError, ServiceUnavailableError

logger = logging.getLogger(__name__)


class Embedder:
    """Wraps Google AI embeddings, supporting document batching and queries.

    Accepts one or more API keys.  When a daily-quota error is detected the
    embedder marks the current key as exhausted and transparently switches to the
    next available key.  RPM (per-minute) rate-limit errors are retried with
    exponential backoff on the same key.

    Exhaustion is time-aware: a key is considered exhausted only for
    ``_QUOTA_RESET_SECONDS`` (24h) after it hit its daily quota, then it becomes
    eligible again — so a long-running process recovers without a restart once
    Google's daily quota refills.
    """

    # How long a key stays marked exhausted before it's retried again. Google's
    # free-tier daily quota refills on a 24h cycle, so we wait one full window.
    _QUOTA_RESET_SECONDS: float = 24 * 60 * 60

    def __init__(self, api_keys: list[str]) -> None:
        # Filter out empty/blank keys
        valid_keys = [k for k in api_keys if k and k.strip()]
        if not valid_keys:
            raise ConfigurationError("At least one Google API key is required.")

        self._clients: list[GoogleGenerativeAIEmbeddings] = []
        for key in valid_keys:
            self._clients.append(
                GoogleGenerativeAIEmbeddings(
                    model=settings.EMBEDDING_MODEL,
                    google_api_key=SecretStr(key),  # type: ignore[call-arg]
                )
            )

        self._current_idx: int = 0
        # Maps a key index -> monotonic timestamp it hit its daily quota. A key is
        # treated as exhausted only until _QUOTA_RESET_SECONDS elapses, then it's
        # eligible again (Google's daily quota will have refilled by then).
        self._exhausted_at: dict[int, float] = {}

        logger.info(
            "Embedder initialised with %d API key(s).", len(self._clients)
        )


    # Public API
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of text segments asynchronously in batches.

        Avoids rate limits and handles retries with exponential backoff.
        """
        if not texts:
            return []

        results: list[list[float]] = []
        batch_size = settings.EMBEDDING_BATCH_SIZE
        delay_between_batches = 1.0

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            cleaned_batch: list[str] = []
            for txt in batch:
                if not txt.strip():
                    logger.warning("Empty string found in embedding batch. Skipping.")
                    continue
                cleaned_batch.append(txt)

            if not cleaned_batch:
                continue

            # Call API with standard exponential backoff retries
            batch_embeddings = await self._call_with_retry(
                "aembed_documents", cleaned_batch
            )
            # Cast batch_embeddings explicitly to list[list[float]] to satisfy Mypy
            results.extend(list(batch_embeddings))

            # Proactively space out embedding requests to maintain average rate <= 75 RPM
            if i + batch_size < len(texts):
                logger.info(
                    "Spacing out embedding batches to respect rate limits. Sleeping for %.2f seconds.",
                    delay_between_batches,
                )
                await asyncio.sleep(delay_between_batches)

        return results

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single search query string."""
        if not text.strip():
            raise ValueError("Query cannot be empty.")

        # Cast returned single embedding explicitly to list[float]
        res = await self._call_with_retry("aembed_query", text)
        return list(res)

    # Internals

    @staticmethod
    def _is_daily_quota_error(err_str: str) -> bool:
        """Return True only when the error indicates a *daily* (per-day) quota.

        This MUST be specific: a daily exhaustion marks the key unusable for 24h
        and triggers a key switch, whereas a per-minute (RPM) 429 just needs a
        short backoff on the SAME key. Google's *generic* 429 message
        ("You exceeded your current quota …") appears on BOTH error kinds, so it
        can NOT be used to tell them apart — matching it would misclassify every
        RPM throttle as a daily ban and burn through all keys on the first blip.

        Daily quotas are identified by ``PerDay`` in the ``quotaId`` / metric, e.g.
        ``EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier``. Per-minute
        quotas use ``PerMinute`` and carry a short ``retryDelay`` instead.
        """
        return "PerDay" in err_str

    @staticmethod
    def _is_rate_limited(err_str: str) -> bool:
        """Return True when the error is any kind of 429 / resource-exhausted."""
        return "429" in err_str or "ResourceExhausted" in err_str or "RESOURCE_EXHAUSTED" in err_str

    def _is_exhausted(self, idx: int) -> bool:
        """Whether key ``idx`` is currently within its daily-quota cooldown window.

        Expired entries are pruned so a key recovers automatically once Google's
        daily quota has had time to refill — no process restart required.
        """
        marked_at = self._exhausted_at.get(idx)
        if marked_at is None:
            return False
        if time.monotonic() - marked_at >= self._QUOTA_RESET_SECONDS:
            # Cooldown elapsed — key is eligible again.
            del self._exhausted_at[idx]
            return False
        return True

    def _next_available_key(self) -> int | None:
        """Return the index of the next non-exhausted key, or None."""
        for i in range(len(self._clients)):
            if not self._is_exhausted(i):
                return i
        return None

    async def _call_with_retry(
        self, method_name: str, *args: Any, **kwargs: Any
    ) -> Any:
        """Execute an embedding API call with smart retry logic.

        • **Daily quota** (``PerDay`` in error) → mark current key exhausted,
          switch to next key and retry immediately.  If all keys exhausted,
          raise ``QuotaExhaustedError`` (429) so the user gets a clear message.
        • **RPM rate limit** (per-minute 429) → exponential backoff on the
          same key, up to ``max_attempts``.
        • **Other errors** → fail immediately.
        """
        max_attempts = 5
        delay = settings.RETRY_DELAY_SECONDS

        for attempt in range(1, max_attempts + 1):
            client = self._clients[self._current_idx]
            func: Callable[..., Any] = getattr(client, method_name)

            try:
                return await func(*args, **kwargs)
            except Exception as e:
                err_str = str(e)

                if not self._is_rate_limited(err_str):
                    # Not a rate-limit error — fail immediately
                    logger.exception(
                        "Embedding API execution failed on attempt %s (non-retryable)",
                        attempt,
                    )
                    raise ServiceUnavailableError(
                        "Embedding service is unavailable. Try again."
                    ) from e

        
                # Daily quota exhausted — try switching keys
        
                if self._is_daily_quota_error(err_str):
                    self._exhausted_at[self._current_idx] = time.monotonic()
                    next_idx = self._next_available_key()

                    if next_idx is not None:
                        logger.warning(
                            "Daily quota exhausted on API key %d. "
                            "Switching to API key %d.",
                            self._current_idx + 1,
                            next_idx + 1,
                        )
                        self._current_idx = next_idx
                        # Don't count this as an attempt — retry immediately
                        # with the fresh key.
                        continue

                    # All keys exhausted — fail fast with clear message
                    logger.error(
                        "All %d API key(s) have exhausted their daily quota.",
                        len(self._clients),
                    )
                    raise QuotaExhaustedError(
                        "Daily embedding quota exhausted across all API keys. "
                        "Uploads will work again when the quota resets "
                        "(midnight Pacific Time). Please try again later."
                    ) from e

        
                # RPM / transient rate limit — backoff and retry same key
        
                if attempt < max_attempts:
                    # Prefer the explicit retry delay Google supplies in the
                    # error; fall back to our own exponential backoff when absent.
                    match = re.search(r"[Pp]lease retry in (\d+(?:\.\d+)?)s", err_str)
                    match_sec = re.search(r"retryDelay':\s*'(\d+)s'", err_str)
                    if match:
                        sleep_time = float(match.group(1)) + 1.0
                    elif match_sec:
                        sleep_time = float(match_sec.group(1)) + 1.0
                    else:
                        # No server-provided delay — use and then grow our backoff.
                        sleep_time = delay
                        delay *= 2

                    logger.warning(
                        "Embedding API rate limited (429). Retrying in "
                        "%.2f seconds (Attempt %s/%s)",
                        sleep_time,
                        attempt,
                        max_attempts,
                    )
                    await asyncio.sleep(sleep_time)
                    continue

                logger.exception(
                    "Embedding API execution failed on attempt %s", attempt
                )
                raise ServiceUnavailableError(
                    "Embedding service is unavailable. Try again."
                ) from e

        raise ServiceUnavailableError("Embedding service is unavailable. Try again.")
