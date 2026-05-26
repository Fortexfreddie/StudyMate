# Agent Spec: Generation Agent

**File:** `apps/api/services/generator.py`  
**Role:** Take retrieved document chunks and a user intent, then call Google Gemini to produce a grounded summary, answer, or quiz.

---

## Responsibility

This agent owns the **final generation step** of the RAG pipeline. It assembles prompts from retrieved context and enforces the constraint that Gemini must only use the provided chunks — never its pre-trained knowledge.

---

## Inputs

### For Chat / Summary

| Parameter | Type | Description |
|---|---|---|
| `query` | `str` | The student's question or topic |
| `chunks` | `List[RetrievedChunk]` | Top-k retrieved chunks from the Retrieval Agent |
| `mode` | `Literal["chat", "summary"]` | Determines which prompt template to use |

### For Quiz Generation

| Parameter | Type | Description |
|---|---|---|
| `topic` | `str` | The topic or scope for quiz generation |
| `chunks` | `List[RetrievedChunk]` | Relevant retrieved chunks |
| `num_questions` | `int` | Number of MCQs to generate (default: 5, max: 10) |

---

## Outputs

### Chat / Summary
Returns a `GenerationResult`:

```python
@dataclass
class GenerationResult:
    content: str                        # Generated text (answer or summary)
    source_chunks: List[RetrievedChunk] # Chunks used as context
    context_sufficient: bool            # Whether context was adequate
```

### Quiz
Returns a `QuizResult`:

```python
@dataclass
class QuizQuestion:
    question: str
    options: list[str]      # Always exactly 4 options
    correct_index: int      # 0-based index of the correct option
    explanation: str        # Brief explanation grounded in the chunk

@dataclass
class QuizResult:
    questions: list[QuizQuestion]
    source_chunks: list[RetrievedChunk]
    topic: str
```

---

## Prompt Templates

### System Prompt (shared across all modes)

```
You are an academic study assistant. Your ONLY task is to help students understand their own lecture materials.

STRICT RULES:
1. You MUST answer ONLY using the context provided below.
2. You MUST NOT use any knowledge from your training data.
3. If the provided context does not contain enough information to answer, say exactly: 
   "The uploaded document does not contain enough information to answer this question."
4. Never fabricate facts, definitions, or explanations.
5. Keep your language clear and appropriate for a university student.
```

### Chat Prompt Template

```
CONTEXT FROM LECTURE NOTES:
{formatted_chunks}

STUDENT QUESTION:
{query}

Answer the student's question using ONLY the context above.
```

### Summary Prompt Template

```
CONTEXT FROM LECTURE NOTES:
{formatted_chunks}

TASK:
Write a clear, concise summary of the following topic as it is explained in the provided context: "{topic}"

Structure the summary with:
- A one-sentence definition or overview
- 3–5 key points
- Any important relationships or mechanisms described

Use ONLY the context provided.
```

### Quiz Prompt Template

```
CONTEXT FROM LECTURE NOTES:
{formatted_chunks}

TASK:
Generate exactly {num_questions} multiple-choice questions based STRICTLY on the context above.

OUTPUT FORMAT — respond with valid JSON only, no markdown, no extra text:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "..."
    }}
  ]
}}

RULES:
- Each question must test understanding of a concept explicitly stated in the context.
- Each question must have exactly 4 options.
- The correct answer must be unambiguously supported by the context.
- Distractors must be plausible but clearly wrong based on the context.
- Do NOT invent facts not present in the context.
```

---

## Context Assembly

Chunks are formatted before injection into the prompt:

```python
def format_chunks(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(
            f"[Chunk {i} — {chunk.filename}, Page {chunk.page_number}]\n{chunk.text}"
        )
    return "\n\n---\n\n".join(parts)
```

---

## Empty Context Handling

If `chunks` is an empty list (retrieval found nothing above threshold):

- For **chat/summary**: Return `GenerationResult` with `context_sufficient=False` and a fixed message — do NOT call Gemini.
- For **quiz**: Raise `ValueError("Insufficient context to generate quiz questions on this topic.")` — do NOT call Gemini.

Never call the LLM with an empty context.

---

## Model Fallback & Retry Strategy

The generation agent uses a two-model strategy to handle rate limits gracefully:

```python
# Model configuration (from core/config.py)
GEMINI_PRIMARY_MODEL = "gemini-3-flash-preview"       # Free tier, Preview
GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite"  # Free tier, GA
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 2
```

### Retry flow:
1. Call primary model (`gemini-3-flash-preview`)
2. If rate-limited (429) → wait `RETRY_DELAY_SECONDS` → retry with fallback model (`gemini-3.1-flash-lite`)
3. If fallback also fails → raise `ServiceUnavailableError`

For **quiz generation**, there is an additional retry path:
1. If the primary model returns unparseable JSON → retry once with a stricter prompt on the same model
2. If still unparseable → raise `GenerationError`

---

## Quiz Output Parsing

Gemini's JSON response must be parsed defensively:

```python
def parse_quiz_response(raw: str) -> list[QuizQuestion]:
    # 1. Strip markdown code fences if present
    # 2. Parse JSON
    # 3. Validate: questions is a list, each has required keys
    # 4. Validate: each options list has exactly 4 items
    # 5. Validate: correct_index is 0–3
    # If any validation fails: raise ValueError with a clear message
```

---

## Error Handling

| Condition | Response |
|---|---|
| Empty chunks list | Return "insufficient context" — do NOT call Gemini |
| Gemini API rate limit (429) | Retry with fallback model; if still fails, raise `ServiceUnavailableError` |
| Gemini API error (network, 5xx) | Raise `ServiceUnavailableError("Generation service unavailable. Try again.")` |
| Quiz JSON parse failure | Retry once with stricter prompt; if still fails, raise `GenerationError` |
| Gemini returns out-of-context content | Log warning — this is a prompt engineering failure, flag for review |

---

## Configuration Constants

```python
# apps/api/core/config.py

GEMINI_PRIMARY_MODEL = "gemini-3-flash-preview"
GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite"
DEFAULT_QUIZ_QUESTIONS = 5
MAX_QUIZ_QUESTIONS = 10
GENERATION_TEMPERATURE = 0.3    # Low temperature = more factual, less creative
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 2
```

Temperature is intentionally low (0.3) because factual accuracy is more important than creative variety in an academic grounding system.

---

## What This Agent Does NOT Do

- Does not call Qdrant
- Does not perform any retrieval
- Does not parse PDFs
- Does not handle HTTP routing
- Does not store any results
