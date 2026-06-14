"""Pydantic request/response models for all API endpoints.

All route handlers must return typed Pydantic models — never raw dicts.
Grouped by feature area matching the API contract in docs/API.md.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from core.config import settings

# Health


class HealthResponse(BaseModel):
    """GET /health response."""

    status: str = "ok"
    version: str = "1.0.0"


# Auth


class SignupRequest(BaseModel):
    """POST /auth/signup request body."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    """POST /auth/login request body."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """POST /auth/refresh request body."""

    refresh_token: str


class UserResponse(BaseModel):
    """User profile data returned in auth and /auth/me responses."""

    id: UUID
    email: str
    full_name: str
    major: str | None = None
    is_pro: bool = False
    role: str = "user"
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """PATCH /auth/me request body — editable profile fields.

    Both fields are optional; only the ones supplied are updated. Email is
    intentionally immutable and not accepted here.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    major: str | None = Field(default=None, max_length=255)


class AuthResponse(BaseModel):
    """POST /auth/signup response — user + tokens."""

    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    """POST /auth/login and /auth/refresh response — tokens only."""

    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


# Documents


class UploadResponse(BaseModel):
    """POST /documents/upload response."""

    doc_id: UUID
    filename: str
    page_count: int
    chunk_count: int
    status: str = "processed"


class DocumentInfo(BaseModel):
    """Single document entry in the document list."""

    doc_id: UUID
    filename: str
    page_count: int
    chunk_count: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    """GET /documents response."""

    documents: list[DocumentInfo]


class DeleteResponse(BaseModel):
    """DELETE /documents/{doc_id} response."""

    doc_id: UUID
    deleted: bool = True


# Shared — Source info (used by chat, summary, quiz)


class SourceInfo(BaseModel):
    """A source chunk reference returned with generated responses."""

    filename: str
    page_number: int
    similarity_score: float
    text_preview: str


class GenerationMeta(BaseModel):
    """Metadata about the LLM generation call — returned with every generation response.

    Gives the frontend full transparency on which model was used, the performance
    tier, token consumption, whether the result was a cache hit, and how many
    retrieval chunks were fed to the model.
    """

    model_used: str
    performance_mode: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached: bool = False
    retrieval_chunks_used: int = 0


# Chat


class ChatRequest(BaseModel):
    """POST /chat request body."""

    query: str = Field(..., min_length=1)
    doc_id: UUID | None = None
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=30,
        description=(
            "Number of context chunks to retrieve. "
            "If omitted, defaults to the performance mode's optimal value "
            "(e.g. 10 for 'high', 5 for 'low')."
        ),
    )


class ChatResponse(BaseModel):
    """POST /chat response."""

    answer: str
    context_sufficient: bool
    sources: list[SourceInfo]
    meta: GenerationMeta | None = None


# Summary

# All supported summary output formats. Adding a new format means: (1) add it here,
# (2) add its prompt OUTPUT block + validator in services/generator.py, (3) render
# its `structured` shape in the frontend summary page.
SummaryFormat = Literal[
    "bullets",
    "key_concepts",
    "study_guide",
    "flashcards",
    "cheat_sheet",
    "mind_map",
    # Rich free-form markdown (headings, tables, nested lists) — the premium format,
    # rendered with the same markdown renderer the chat page uses. Carries no
    # `structured` payload; the content lives entirely in `summary`.
    "tabular",
]


class SummaryRequest(BaseModel):
    """POST /summary/generate request body."""

    topic: str = Field(..., min_length=1)
    doc_id: UUID | None = None
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=30,
        description=(
            "Number of context chunks to retrieve. "
            "If omitted, defaults to the performance mode's optimal value."
        ),
    )
    format: SummaryFormat = "bullets"
    full_document: bool = False


# Structured sub-shapes — one per format. The frontend renders these directly.


class ConceptItem(BaseModel):
    """A titled concept block (key_concepts / study_guide)."""

    title: str
    description: str


class Flashcard(BaseModel):
    """A single flashcard (flashcards)."""

    front: str
    back: str


class CheatSheetFormula(BaseModel):
    """A formula/fact row in a cheat sheet."""

    label: str
    value: str


class CheatSheetDefinition(BaseModel):
    """A definition row in a cheat sheet."""

    term: str
    meaning: str


class CheatSheet(BaseModel):
    """Structured cheat-sheet output."""

    formulas: list[CheatSheetFormula]
    definitions: list[CheatSheetDefinition]


class MindMapBranch(BaseModel):
    """A first-level branch of a mind map, with leaf children."""

    label: str
    children: list[str]


class MindMap(BaseModel):
    """Structured mind-map output."""

    root: str
    branches: list[MindMapBranch]


class StudyGuide(BaseModel):
    """Combined bullets + concepts output (study_guide)."""

    bullets: list[str]
    concepts: list[ConceptItem]


# The structured payload is one of the per-format shapes above. Kept as a permissive
# union so the single endpoint can return any format; the `format` field tells the
# client which shape to expect.
SummaryStructured = (
    list[str]
    | list[ConceptItem]
    | list[Flashcard]
    | StudyGuide
    | CheatSheet
    | MindMap
    | None
)


class SummaryResponse(BaseModel):
    """POST /summary/generate response.

    `summary` is always a plain-text/markdown rendering (a safe fallback the UI can
    always show). `structured` carries the format-specific shape for rich rendering;
    `format` echoes which shape `structured` holds.
    """

    summary: str
    format: SummaryFormat
    structured: SummaryStructured = None
    context_sufficient: bool
    sources: list[SourceInfo]
    meta: GenerationMeta | None = None


# Quiz


class QuizGenerateRequest(BaseModel):
    """POST /quiz/generate request body."""

    topic: str = Field(..., min_length=1)
    doc_id: UUID | None = None
    num_questions: int = Field(default=settings.DEFAULT_QUIZ_QUESTIONS, ge=1)
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=30,
        description=(
            "Number of context chunks to retrieve. "
            "If omitted, defaults to the performance mode's optimal value."
        ),
    )

    @field_validator("num_questions")
    @classmethod
    def _cap_num_questions(cls, v: int) -> int:
        """Enforce the configurable upper bound from settings.MAX_QUIZ_QUESTIONS.

        Pydantic's Field(le=...) needs a literal at class-definition time, so the
        runtime config value is enforced here instead — making config the single
        source of truth for the cap.
        """
        if v > settings.MAX_QUIZ_QUESTIONS:
            raise ValueError(
                f"num_questions must be at most {settings.MAX_QUIZ_QUESTIONS}."
            )
        return v


class QuizQuestion(BaseModel):
    """A single multiple-choice question in a quiz."""

    question: str
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    explanation: str


class QuizGenerateResponse(BaseModel):
    """POST /quiz/generate response."""

    session_id: UUID
    topic: str
    questions: list[QuizQuestion]
    sources: list[SourceInfo]
    meta: GenerationMeta | None = None


class AnswerSubmission(BaseModel):
    """A single answer within a quiz submission."""

    question_index: int = Field(..., ge=0)
    selected_index: int = Field(..., ge=-1, le=3)


class QuizSubmitRequest(BaseModel):
    """POST /quiz/{session_id}/submit request body."""

    answers: list[AnswerSubmission] = Field(..., min_length=1)


class AnswerResult(BaseModel):
    """Result for a single question after submission."""

    question_index: int
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str


class QuizSubmitResponse(BaseModel):
    """POST /quiz/{session_id}/submit response."""

    session_id: UUID
    score: int
    total_questions: int
    results: list[AnswerResult]


# History


class ChatHistoryItem(BaseModel):
    """Single chat message in history."""

    id: UUID
    doc_id: UUID | None
    query: str
    answer: str
    context_sufficient: bool
    sources: list[SourceInfo] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    """GET /history/chat response — paginated."""

    messages: list[ChatHistoryItem]
    total: int
    limit: int
    offset: int


class SummaryHistoryItem(BaseModel):
    """Single summary in history."""

    id: UUID
    doc_id: UUID | None
    topic: str
    summary_text: str
    format: str
    context_sufficient: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SummaryHistoryResponse(BaseModel):
    """GET /history/summaries response — paginated."""

    summaries: list[SummaryHistoryItem]
    total: int
    limit: int
    offset: int


class SummaryDetailResponse(BaseModel):
    """GET /history/summaries/{summary_id} — a single saved summary, fully renderable.

    Unlike the list item, this carries the ``structured`` payload and ``sources`` so
    the summary page can restore the exact completed view (charts/cards/markdown +
    clickable source citations) from history without regenerating.
    """

    id: UUID
    doc_id: UUID | None
    topic: str
    summary: str  # the plain-text/markdown rendering (matches SummaryResponse.summary)
    format: SummaryFormat
    structured: SummaryStructured = None
    context_sufficient: bool
    sources: list[SourceInfo] = []
    created_at: datetime


class QuizHistoryItem(BaseModel):
    """Single quiz session in history list."""

    id: UUID
    doc_id: UUID | None
    topic: str
    total_questions: int
    score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class QuizHistoryResponse(BaseModel):
    """GET /history/quizzes response — paginated."""

    sessions: list[QuizHistoryItem]
    total: int
    limit: int
    offset: int


class QuizAnswerDetail(BaseModel):
    """Answer detail within a quiz session detail response."""

    question_index: int
    selected_index: int
    correct_index: int
    is_correct: bool

    model_config = {"from_attributes": True}


class QuizDetailResponse(BaseModel):
    """GET /history/quizzes/{session_id} response."""

    id: UUID
    topic: str
    total_questions: int
    score: int
    answers: list[QuizAnswerDetail]
    created_at: datetime

    model_config = {"from_attributes": True}


# Stats


class StatsResponse(BaseModel):
    """GET /stats response — aggregate study metrics for the current user.

    All counts are derived live from the database; nothing is precomputed/stored.
    `current_streak` is the number of consecutive active days up to today.
    `average_quiz_score` is a 0–100 percentage across all graded sessions.
    """

    documents_uploaded: int
    quizzes_taken: int
    summaries_generated: int
    chats_count: int
    current_streak: int
    average_quiz_score: float
    tokens_used_today: int = 0
    token_limit: int = 0
    is_pro: bool = False


# Usage


class UsageResponse(BaseModel):
    """GET /usage response — daily token consumption for the current user."""

    tokens_used_today: int
    token_limit: int
    tokens_remaining: int
    is_pro: bool
    usage_by_type: dict[str, int]
    reset_time: str


# Admin — building blocks for the overview dashboard


class MajorBreakdown(BaseModel):
    """One row of the users-by-major aggregate."""

    major: str
    count: int


class DailyCount(BaseModel):
    """A single (date, count) point in a 30-day time series (signups, docs, DAU)."""

    date: str  # ISO date (YYYY-MM-DD)
    count: int


class DailyTokenTrend(BaseModel):
    """A single day of token consumption split by request type."""

    date: str  # ISO date (YYYY-MM-DD)
    chat: int = 0
    summary: int = 0
    quiz: int = 0


class TopUploader(BaseModel):
    """A user ranked by document count, for the top-uploaders list."""

    user_id: UUID
    full_name: str
    email: str
    document_count: int


class AdminOverviewResponse(BaseModel):
    """GET /admin/stats/overview — every aggregate stat for the dashboard.

    Note: ``tokens_today_counter`` (the authoritative reserved quota counter) and
    ``tokens_today_logged`` (summed from the per-request log) measure different
    things and will not always match — the counter can read slightly higher due to
    reservation/reconciliation drift. Both are surfaced intentionally.
    """

    # User counts
    total_users: int
    total_admins: int
    total_pro_users: int
    users_by_role: dict[str, int]
    users_by_major: list[MajorBreakdown]
    # Activity
    active_users_today: int
    active_users_7d: int
    active_users_30d: int
    # Content counts
    total_documents: int
    total_chunks: int
    total_chats: int
    total_summaries: int
    total_quizzes: int
    average_quiz_score: float  # 0–100
    # Tokens
    lifetime_tokens: int
    tokens_today_logged: int
    tokens_today_counter: int
    tokens_by_type: dict[str, int]
    tokens_by_model: dict[str, int]
    # 30-day time series
    daily_signups: list[DailyCount]
    daily_documents: list[DailyCount]
    daily_active_users: list[DailyCount]
    daily_tokens: list[DailyTokenTrend]
    # Leaderboard
    top_uploaders: list[TopUploader]


# Admin — user management


class AdminUserListItem(BaseModel):
    """A user row in the admin user list (never exposes the password hash)."""

    id: UUID
    email: str
    full_name: str
    major: str | None = None
    is_pro: bool
    role: str
    document_count: int
    created_at: datetime


class AdminUserListResponse(BaseModel):
    """GET /admin/users — paginated."""

    users: list[AdminUserListItem]
    total: int
    limit: int
    offset: int


class AdminUserUpdateRequest(BaseModel):
    """PATCH /admin/users/{user_id} — partial update of tier and/or role.

    Both optional; only supplied fields change. ``role`` may only be "user" or
    "admin" (the router rejects "super_admin"). ``is_pro`` requires admin; ``role``
    requires super_admin.
    """

    is_pro: bool | None = None
    role: str | None = None


# Admin — document management


class AdminDocumentListItem(BaseModel):
    """A document row in the admin document list, with owner info."""

    doc_id: UUID
    filename: str
    page_count: int
    chunk_count: int
    uploaded_at: datetime
    owner_id: UUID
    owner_name: str
    owner_email: str


class AdminDocumentListResponse(BaseModel):
    """GET /admin/documents — paginated."""

    documents: list[AdminDocumentListItem]
    total: int
    limit: int
    offset: int


class AdminUserDeleteResponse(BaseModel):
    """DELETE /admin/users/{user_id} response."""

    user_id: UUID
    deleted: bool = True


# Admin — per-user token usage


class AdminUserUsageResponse(BaseModel):
    """GET /admin/users/{user_id}/usage — one user's token consumption over a window.

    The window defaults to the last 30 days and is filterable via ``start``/``end``
    (and optionally ``request_type``). All token figures come from the append-only
    ``token_usage`` log, not the live quota counter, so they are stable historically.
    """

    user_id: UUID
    email: str
    full_name: str
    is_pro: bool
    role: str
    # Window echoed back so the client can label the chart axis.
    start_date: str  # ISO date (YYYY-MM-DD)
    end_date: str  # ISO date (YYYY-MM-DD)
    # Aggregates across the window
    total_tokens: int
    total_input_tokens: int
    total_output_tokens: int
    request_count: int
    tokens_by_type: dict[str, int]
    tokens_by_model: dict[str, int]
    # Per-day split by request type, for the trend chart (sparse — gaps zero-filled
    # client-side, matching the overview dashboard's convention).
    daily_tokens: list[DailyTokenTrend]


# Admin — per-user audit trail


class AdminActivityItem(BaseModel):
    """A single metadata record in a user's audit timeline.

    Deliberately metadata-only: it carries an 80-char truncated ``preview`` of the
    user's query/topic for context but never the full question text or the model's
    answer body, so an admin can audit *what kind* of activity happened and its cost
    without reading a student's private study content.
    """

    id: UUID
    action_type: str  # "chat" | "summary" | "quiz"
    created_at: datetime
    doc_id: UUID | None = None
    doc_filename: str | None = None
    performance_mode: str | None = None
    preview: str  # truncated query (chat) / topic (summary, quiz)
    # Quiz-only metadata; None for chat/summary.
    score: int | None = None
    total_questions: int | None = None


class AdminUserActivityResponse(BaseModel):
    """GET /admin/users/{user_id}/activity — paginated audit timeline (metadata only)."""

    user_id: UUID
    email: str
    full_name: str
    items: list[AdminActivityItem]
    total: int
    limit: int
    offset: int
