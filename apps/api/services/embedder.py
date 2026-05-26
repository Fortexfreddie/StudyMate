"""Google AI Embedding service — converts PDF text chunks to vector representations."""

import asyncio
import logging
from collections.abc import Callable
from typing import Any

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pydantic import SecretStr

from core.config import settings
from core.errors import ConfigurationError, ServiceUnavailableError

logger = logging.getLogger(__name__)


class Embedder:
    """Wraps Google AI embeddings, supporting document batching and queries."""

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ConfigurationError("Google API key is invalid or missing.")

        self._client = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=SecretStr(api_key),
        )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of text segments asynchronously in batches.

        Avoids rate limits and handles retries with exponential backoff.
        """
        if not texts:
            return []

        results: list[list[float]] = []
        batch_size = settings.EMBEDDING_BATCH_SIZE

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            # Clean batch to remove empty strings (log warning if found)
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
                self._client.aembed_documents, cleaned_batch
            )
            # Cast batch_embeddings explicitly to list[list[float]] to satisfy Mypy
            results.extend(list(batch_embeddings))

        return results

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single search query string."""
        if not text.strip():
            raise ValueError("Query cannot be empty.")

        # Cast returned single embedding explicitly to list[float]
        res = await self._call_with_retry(self._client.aembed_query, text)
        return list(res)

    async def _call_with_retry(
        self, func: Callable[..., Any], *args: Any, **kwargs: Any
    ) -> Any:
        """Execute embedding API call with exponential backoff on 429 rate limit."""
        max_attempts = settings.MAX_RETRIES + 1
        delay = settings.RETRY_DELAY_SECONDS

        for attempt in range(1, max_attempts + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                err_str = str(e)
                # Check for rate limiting / Google resource exhaustion (429)
                is_rate_limited = "429" in err_str or "ResourceExhausted" in err_str

                if is_rate_limited and attempt < max_attempts:
                    logger.warning(
                        "Embedding API rate limited (429). Retrying in "
                        "%s seconds (Attempt %s/%s)",
                        delay,
                        attempt,
                        max_attempts,
                    )
                    await asyncio.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue

                logger.exception(
                    "Embedding API execution failed on attempt %s", attempt
                )
                raise ServiceUnavailableError(
                    "Embedding service is unavailable. Try again."
                ) from e

        raise ServiceUnavailableError("Embedding service is unavailable. Try again.")
