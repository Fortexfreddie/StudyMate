# Agent Spec: Generation Agent

**File:** `apps/api/services/generator.py`  
**Role:** Take retrieved document chunks and a user intent, then call Google Gemini to produce a grounded summary, answer, or quiz.

---

## Responsibility

This agent owns the **final generation step** of the RAG pipeline. It assembles prompts from retrieved context and enforces the constraint that Gemini must only use the provided chunks — never its pre-trained knowledge.

---

## Interface (actual)

`Generator` is constructed with `(api_key, performance_mode="high")` and exposes three
async methods. Each is a **separate method** (there is no `mode` parameter), context is
a `list[dict]` of retrieved chunks, and each returns a **tuple** (not a dataclass). All
generation uses Gemini **JSON mode** (`response_mime_type="application/json"`).

### `generate_answer(query, context) -> (answer, context_sufficient, usage)`

| Field | Type | Description |
|---|---|---|
| `answer` | `str` | Grounded markdown answer |
| `context_sufficient` | `bool` | False when the context didn't cover the question |
| `usage` | `dict` | `{input_tokens, output_tokens, total_tokens, model_used}` |

### `generate_summary(topic, context, summary_format="bullets") -> (plain_text, structured, context_sufficient, usage)`

`summary_format` is one of `bullets`, `key_concepts`, `study_guide`, `flashcards`,
`cheat_sheet`, `mind_map` (see `SUMMARY_FORMAT_SPECS`). `structured` is the
format-specific shape (or `None` if validation fails / context insufficient);
`plain_text` is always a safe markdown fallback.

### `generate_quiz(topic, context, num_questions=5) -> (questions, usage)`

`num_questions` default `5`, **max `30`** (`MAX_QUIZ_QUESTIONS`, enforced by a
`field_validator` on `QuizGenerateRequest`). `questions` is a `list[dict]` with keys
`question`, `options` (exactly 4), `correct_index` (0–3), `explanation`.

On a generation/parse failure all three methods raise `ServiceUnavailableError` (503);
the router releases the token reservation and persists nothing.

### Retry / fallback / error classification

`_call_llm_with_retry` classifies failures: **rate-limit (429)** → immediate fallback;
**transient (503/empty/malformed)** → retry primary up to `MAX_RETRIES` then fallback;
**fatal (auth/permission/invalid-argument)** → fail fast. The quiz stricter-reprompt
uses a single primary call when `QUIZ_REPROMPT_SINGLE_ATTEMPT=true` (worst case 4 LLM
calls per quiz request).

---

## Prompt Templates

### System Prompt (shared across all modes)

Defined as the `SYSTEM_PROMPT` constant in `services/generator.py`:

```
You are StudyMate, an expert academic study assistant designed to help
university students deeply understand their own lecture materials.

═══ ABSOLUTE GROUNDING RULES ═══
These rules override ALL other instructions. You MUST follow them without exception:

1. ONLY USE PROVIDED CONTEXT: You may ONLY use information explicitly stated
   in the CONTEXT chunks provided below. These chunks come directly from the
   student's own uploaded lecture notes and course materials.

2. NO EXTERNAL KNOWLEDGE: You MUST NOT use any knowledge from your training
   data, the internet, general knowledge, or any source outside the provided
   context. If a fact is not in the context, you do not know it.

3. ADMIT GAPS HONESTLY: If the provided context does not contain sufficient
   information to fully answer the question or complete the task, you MUST say
   so clearly. Never guess, speculate, infer beyond what is written, or fill
   gaps with outside knowledge.

4. ZERO FABRICATION: Never fabricate or invent facts, definitions, formulas,
   equations, dates, names, statistics, or explanations under any circumstances.

5. SOURCE ATTRIBUTION: When presenting information, reference the source
   (e.g., 'According to Source #2...' or 'As stated on Page 12...').

═══ TONE & FORMATTING ═══
• Write at a level appropriate for a university undergraduate student.
• Use clear, concise academic English — authoritative but approachable.
• Structure responses with markdown: bold key terms, use bullet points
  for lists, and numbered steps for sequential processes.
• Be encouraging and supportive — never condescending.
```

> **Note:** The templates below are illustrative of the grounding *philosophy*. The
> actual implementation appends a strict `OUTPUT FORMAT` JSON block to `SYSTEM_PROMPT`
> and calls Gemini in JSON mode — see `generate_answer` / `generate_summary` /
> `generate_quiz` and `SUMMARY_FORMAT_SPECS` in `services/generator.py` for the
> authoritative prompts.

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

- For **chat/summary**: Call the LLM with `"No document context available."`. The system prompt instructs the model to respond gracefully without a flat refusal, guiding the user back to the document topic and setting `context_sufficient=False` as a quality signal badge.
- For **quiz**: Raise `ValueError("Insufficient context to generate quiz questions on this topic.")` — do NOT call Gemini.

---

## Model Fallback & Retry Strategy

The generation agent uses a two-model strategy to handle rate limits gracefully:

```python
# Model configuration (from core/config.py) — the "high" tier; medium/low tiers
# use GEMINI_MEDIUM_MODEL / GEMINI_LOW_MODEL (see PERFORMANCE_MODES).
GEMINI_PRIMARY_MODEL = "gemini-3.5-flash"
GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite"
MAX_RETRIES = 1
RETRY_DELAY_SECONDS = 2
QUIZ_REPROMPT_SINGLE_ATTEMPT = True
```

### Retry flow (errors are classified, not matched by substring):
1. Call primary model.
2. **Rate-limit (429)** → fail over to the fallback model immediately.
3. **Transient (503/empty/malformed)** → retry primary up to `MAX_RETRIES`, then fallback.
4. **Fatal (auth/permission/invalid-argument)** → fail fast, no retry/fallback.
5. If the fallback also fails → raise `ServiceUnavailableError` (503).

For **quiz generation**, there is an additional outer retry path:
1. If the first generation is unparseable → retry once with a stricter reformat prompt.
2. With `QUIZ_REPROMPT_SINGLE_ATTEMPT=true`, that reprompt is a single primary call
   (no internal retry/fallback), capping worst-case LLM calls at **4** per quiz request.
3. If still unparseable → raise `ServiceUnavailableError` (503).

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
| Quiz JSON parse failure | Retry once with stricter prompt; if still fails, raise `ServiceUnavailableError` (503) |
| Gemini returns out-of-context content | Log warning — this is a prompt engineering failure, flag for review |

---

## Configuration Constants

```python
# apps/api/core/config.py

GEMINI_PRIMARY_MODEL = "gemini-3.5-flash"
GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite"
DEFAULT_QUIZ_QUESTIONS = 5
MAX_QUIZ_QUESTIONS = 30          # authoritative — enforced by a field_validator
GENERATION_TEMPERATURE = 0.3    # Low temperature = more factual, less creative
MAX_RETRIES = 1
RETRY_DELAY_SECONDS = 2
QUIZ_REPROMPT_SINGLE_ATTEMPT = True
```

Temperature is intentionally low (0.3) because factual accuracy is more important than creative variety in an academic grounding system.

---

## What This Agent Does NOT Do

- Does not call Qdrant
- Does not perform any retrieval
- Does not parse PDFs
- Does not handle HTTP routing
- Does not store any results
