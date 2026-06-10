# Error Handling Reference

**File:** `apps/api/core/errors.py`  
**Role:** Unified error hierarchy for the entire backend. All custom exceptions are defined here.

---

## Design Principle

Every error that can reach a user must:
1. Have a **clear, human-readable message** — not "Internal Server Error"
2. Map to a **specific HTTP status code**
3. Be **caught and converted** to an `HTTPException` by the global exception handler

---

## Error Hierarchy

```python
class StudyMateError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DocumentProcessingError(StudyMateError):
    """Raised when PDF parsing or chunking fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=400)


class ServiceUnavailableError(StudyMateError):
    """Raised when an external service (Gemini, Qdrant, embedding) is unreachable."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=503)


class GenerationError(StudyMateError):
    """Raised when LLM generation fails (e.g., unparseable quiz JSON after retry)."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=422)


class ConfigurationError(StudyMateError):
    """Raised when required configuration is missing or invalid."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=500)


class AuthenticationError(StudyMateError):
    """Raised when authentication fails (invalid credentials, expired token)."""

    def __init__(self, message: str = "Authentication failed.") -> None:
        super().__init__(message=message, status_code=401)


class DocumentNotFoundError(StudyMateError):
    """Raised when a requested document does not exist."""

    def __init__(self, doc_id: str) -> None:
        super().__init__(
            message=f"Document '{doc_id}' not found.",
            status_code=404,
        )
```

---

## Global Exception Handlers

Registered in `main.py` to catch all `StudyMateError` subclasses and third-party exceptions (like slowapi's `RateLimitExceeded`) and convert them to proper HTTP responses:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from core.errors import StudyMateError

app = FastAPI()

@app.exception_handler(StudyMateError)
async def studymate_error_handler(request: Request, exc: StudyMateError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )
```

This ensures all errors follow the API contract: `{ "detail": "Human-readable error message" }`.

---

## Error Map by Service

### Document Processor (`services/pdf_processor.py`)

The PDF processor raises `ValueError` for validation failures. The router catches these and converts them to `HTTPException(400)`.

| Condition | Exception | HTTP Code |
|---|---|---|
| Not a PDF file | `ValueError("File must be a PDF document.")` | 400 |
| Empty PDF (0 pages) | `ValueError("PDF contains no readable pages.")` | 400 |
| Image-only PDF | `ValueError("PDF appears to be a scanned image. Text extraction is not supported.")` | 400 |
| File too large | `HTTPException(413, "File too large...")` — checked in router | 413 |

### Embedder (`services/embedder.py`)

| Condition | Exception | HTTP Code |
|---|---|---|
| API rate limit after retries | `ServiceUnavailableError("Embedding service is unavailable. Try again.")` | 503 |
| Network/5xx error | `ServiceUnavailableError("Embedding service is unavailable. Try again.")` | 503 |
| Invalid API key | `ConfigurationError("Google API key is invalid or missing.")` | 500 |

### Vector Store (`services/vector_store.py`)

| Condition | Exception | HTTP Code |
|---|---|---|
| Connection failure | `ServiceUnavailableError("Vector store is unavailable. Try again.")` | 503 |
| Collection not initialized | `ServiceUnavailableError("Vector store is not initialized.")` | 503 |
| Upsert failure | `ServiceUnavailableError("Failed to store document vectors.")` | 503 |

### Retriever (`services/retriever.py`)

| Condition | Exception | HTTP Code |
|---|---|---|
| Empty query | `ValueError` → caught by router → 400 | 400 |
| Query too short | `ValueError` → caught by router → 400 | 400 |
| Qdrant failure | `ServiceUnavailableError(...)` | 503 |
| Embedding failure | `ServiceUnavailableError(...)` | 503 |

### Generator (`services/generator.py`)

| Condition | Exception | HTTP Code |
|---|---|---|
| Empty chunks (no context) | Return result with `context_sufficient=False` — **not an error** | 200 |
| Rate limit after fallback retry | `ServiceUnavailableError("Generation service unavailable. Try again.")` | 503 |
| Network/5xx error | `ServiceUnavailableError("Generation service unavailable. Try again.")` | 503 |
| Quiz JSON parse failure after retry | `GenerationError("Failed to generate a valid quiz. Try again.")` | 422 |

### Auth Service (`services/auth_service.py`)

| Condition | Exception | HTTP Code |
|---|---|---|
| Email already registered | `HTTPException(400, "Email already registered.")` | 400 |
| Password too short | `HTTPException(400, "Password must be at least 8 characters.")` | 400 |
| Invalid email or password | `AuthenticationError("Invalid email or password.")` | 401 |
| Missing/invalid JWT token | `AuthenticationError("Token has expired or is invalid.")` | 401 |
| Expired JWT token | `AuthenticationError("Token has expired or is invalid.")` | 401 |
| User not found (from token) | `AuthenticationError("User not found.")` | 401 |

### Routers

| Condition | Exception | HTTP Code |
|---|---|---|
| Document not found | `DocumentNotFoundError(doc_id)` | 404 |
| Unauthorized access | `AuthenticationError(...)` | 401 |
| Invalid request body | Pydantic validation → automatic 422 | 422 |

---

## Router-Level Error Handling Pattern

Routers catch `ValueError` from services and convert them to `HTTPException`:

```python
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # ... call retriever and generator
        pass
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # StudyMateError subclasses are caught by the global handler
```

---

## What NOT to Do

```python
# ❌ Never bare except
try:
    ...
except:
    pass

# ❌ Never generic error messages
raise HTTPException(status_code=500, detail="Something went wrong")

# ❌ Never swallow and log silently
except Exception as e:
    logger.error(e)
    return None

# ✅ Always raise with a clear, user-facing message
raise ServiceUnavailableError("Generation service unavailable. Try again.")
```
