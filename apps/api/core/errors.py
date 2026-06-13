"""Custom exception hierarchy for the entire backend.

Every error that can reach a user must:
1. Have a clear, human-readable message
2. Map to a specific HTTP status code
3. Be caught and converted to an HTTPException by the global handler in main.py
"""


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


class ForbiddenError(StudyMateError):
    """Raised when an authenticated user lacks permission for an action."""

    def __init__(self, message: str = "You do not have permission for this action.") -> None:
        super().__init__(message=message, status_code=403)


class ConflictError(StudyMateError):
    """Raised when an action conflicts with a protected resource (e.g. the super admin)."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=409)


class DocumentNotFoundError(StudyMateError):
    """Raised when a requested document does not exist."""

    def __init__(self, doc_id: str) -> None:
        super().__init__(
            message=f"Document '{doc_id}' not found.",
            status_code=404,
        )
