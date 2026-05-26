"""Generator service — manages LLM generation for chat, summaries, and quizzes."""

import asyncio
import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from core.config import settings
from core.errors import ConfigurationError, ServiceUnavailableError

logger = logging.getLogger(__name__)

# Shared system prompt — enforces strict RAG grounding across all generation modes.
SYSTEM_PROMPT = (
    "You are StudyMate, an expert academic study assistant designed to help "
    "university students deeply understand their own lecture materials.\n\n"
    "═══ ABSOLUTE GROUNDING RULES ═══\n"
    "These rules override ALL other instructions. You MUST follow them without exception:\n\n"
    "1. ONLY USE PROVIDED CONTEXT: You may ONLY use information explicitly stated "
    "in the CONTEXT chunks provided below. These chunks come directly from the "
    "student's own uploaded lecture notes and course materials.\n\n"
    "2. NO EXTERNAL KNOWLEDGE: You MUST NOT use any knowledge from your training "
    "data, the internet, general knowledge, or any source outside the provided "
    "context. If a fact is not in the context, you do not know it.\n\n"
    "3. ADMIT GAPS HONESTLY: If the provided context does not contain sufficient "
    "information to fully answer the question or complete the task, you MUST say "
    "so clearly. Never guess, speculate, infer beyond what is written, or fill "
    "gaps with outside knowledge.\n\n"
    "4. ZERO FABRICATION: Never fabricate or invent facts, definitions, formulas, "
    "equations, dates, names, statistics, or explanations under any circumstances.\n\n"
    "5. SOURCE ATTRIBUTION: When presenting information, reference the source "
    "(e.g., 'According to Source #2...' or 'As stated on Page 12...').\n\n"
    "═══ TONE & FORMATTING ═══\n"
    "• Write at a level appropriate for a university undergraduate student.\n"
    "• Use clear, concise academic English — authoritative but approachable.\n"
    "• Structure responses with markdown: **bold** key terms, use bullet points "
    "for lists, and numbered steps for sequential processes.\n"
    "• Be encouraging and supportive — never condescending.\n"
)


class Generator:
    """Orchestrates structured generations using Google Gemini 3 models."""

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ConfigurationError("Google API key is invalid or missing.")

        # Initialize the primary generation client (plain)
        self._primary_client = ChatGoogleGenerativeAI(
            model=settings.GEMINI_PRIMARY_MODEL,
            google_api_key=SecretStr(api_key),
            temperature=settings.GENERATION_TEMPERATURE,
        )

        # Initialize the primary generation client (JSON enforced)
        self._primary_client_json = ChatGoogleGenerativeAI(
            model=settings.GEMINI_PRIMARY_MODEL,
            google_api_key=SecretStr(api_key),
            temperature=settings.GENERATION_TEMPERATURE,
            model_kwargs={"response_mime_type": "application/json"},
        )

        # Initialize the fallback generation client (plain)
        self._fallback_client = ChatGoogleGenerativeAI(
            model=settings.GEMINI_FALLBACK_MODEL,
            google_api_key=SecretStr(api_key),
            temperature=settings.GENERATION_TEMPERATURE,
        )

        # Initialize the fallback generation client (JSON enforced)
        self._fallback_client_json = ChatGoogleGenerativeAI(
            model=settings.GEMINI_FALLBACK_MODEL,
            google_api_key=SecretStr(api_key),
            temperature=settings.GENERATION_TEMPERATURE,
            model_kwargs={"response_mime_type": "application/json"},
        )

    async def generate_answer(
        self, query: str, context: list[dict[str, Any]]
    ) -> tuple[str, bool]:
        """Generates a grounded answer from retrieved context chunks.

        Returns a tuple of (answer, context_sufficient).
        """
        # Format the context chunks
        context_text = self._format_context(context)

        system_instruction = (
            SYSTEM_PROMPT
            + "\n═══ OUTPUT FORMAT ═══\n"
            "Format your response as a JSON object with exactly these keys:\n"
            "{\n"
            '  "answer": "Your rich, well-formatted markdown response with bold keywords, bullet points, or lists.",\n'
            '  "context_sufficient": true\n'
            "}\n\n"
            "If the provided context does not contain enough facts to answer the question, return:\n"
            "{\n"
            '  "answer": "The uploaded document does not contain enough information to answer this question.",\n'
            '  "context_sufficient": false\n'
            "}\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        try:
            response_text = await self._call_llm_with_retry(
                system_instruction, f"Question: {query}", require_json=True
            )
            parsed = json.loads(response_text)
            answer = parsed.get("answer", "").strip()
            context_sufficient = bool(parsed.get("context_sufficient", False))
            return answer, context_sufficient
        except Exception:
            logger.exception("Failed to parse or generate chat response from LLM.")
            return (
                "I encountered an error generating an answer based on your document. Please try again.",
                False,
            )

    async def generate_summary(
        self, topic: str, context: list[dict[str, Any]]
    ) -> tuple[str, bool]:
        """Generates a structured markdown summary grounded in context chunks."""
        context_text = self._format_context(context)

        system_instruction = (
            SYSTEM_PROMPT
            + "\n═══ OUTPUT FORMAT ═══\n"
            "Format your response as a JSON object with exactly these keys:\n"
            "{\n"
            '  "summary": "Your rich, highly structured study summary in markdown (using headers, bullet points, and key takeaways).",\n'
            '  "context_sufficient": true\n'
            "}\n\n"
            "Structure the summary with:\n"
            "- A one-sentence definition or overview\n"
            "- 3–5 key points\n"
            "- Any important relationships or mechanisms described\n\n"
            "If the provided context does not contain enough facts to summarize this topic, return:\n"
            "{\n"
            '  "summary": "The uploaded document does not contain relevant information on this topic to generate a summary.",\n'
            '  "context_sufficient": false\n'
            "}\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        try:
            response_text = await self._call_llm_with_retry(
                system_instruction, f"Topic to Summarize: {topic}", require_json=True
            )
            parsed = json.loads(response_text)
            summary = parsed.get("summary", "").strip()
            context_sufficient = bool(parsed.get("context_sufficient", False))
            return summary, context_sufficient
        except Exception:
            logger.exception("Failed to parse or generate summary from LLM.")
            return (
                "I encountered an error generating a topic summary based on your document. Please try again.",
                False,
            )

    async def generate_quiz(
        self, topic: str, context: list[dict[str, Any]], num_questions: int = 5
    ) -> list[dict[str, Any]]:
        """Generates a structured multiple-choice quiz strictly from context."""
        context_text = self._format_context(context)

        system_instruction = (
            SYSTEM_PROMPT
            + "\n═══ QUIZ GENERATION RULES ═══\n"
            f"Generate exactly {num_questions} multiple-choice questions.\n"
            "Each question must test understanding of a concept explicitly stated in the context.\n"
            "Distractors must be plausible but clearly wrong based on the context.\n\n"
            "Your output MUST be a valid JSON array of question objects (and nothing else). "
            "Do not wrap in markdown code blocks.\n"
            "Each question object MUST have exactly these keys:\n"
            "{\n"
            '  "question": "Clear, concise academic question text",\n'
            '  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],\n'
            '  "correct_index": 0,\n'
            '  "explanation": "Detailed explanation of why this option is correct, referencing facts from the document."\n'
            "}\n\n"
            "Guidelines:\n"
            "1. You MUST supply exactly 4 options per question.\n"
            "2. The correct_index must be an integer from 0 to 3 matching the correct option index.\n"
            "3. The correct answer must be unambiguously supported by the context.\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        prompt = f"Generate a {num_questions}-question quiz on this topic: {topic}"

        # First attempt
        try:
            response_text = await self._call_llm_with_retry(
                system_instruction, prompt, require_json=True
            )
            return self._parse_and_validate_quiz(response_text, num_questions)
        except Exception as first_error:
            logger.warning(
                "First attempt of quiz generation parsing failed: %s. Retrying with a stricter constraint.",
                str(first_error),
            )

            # Stricter prompt retry on primary client
            retry_instruction = (
                "CRITICAL: You failed to return a valid JSON array matching the required format in your previous attempt.\n"
                "You must return ONLY a raw valid JSON array. Do not output any preamble or postamble text.\n"
                f"Create exactly {num_questions} questions based on this context:\n"
                f"{context_text}\n\n"
                "JSON Schema to follow strictly:\n"
                "[\n"
                "  {\n"
                '    "question": "Question text?",\n'
                '    "options": ["Option 0", "Option 1", "Option 2", "Option 3"],\n'
                '    "correct_index": 0,\n'
                '    "explanation": "Why correct"\n'
                "  }\n"
                "]"
            )

            try:
                response_text = await self._call_llm_with_retry(
                    retry_instruction, prompt, require_json=True
                )
                return self._parse_and_validate_quiz(response_text, num_questions)
            except Exception as final_error:
                logger.exception("Final attempt at quiz generation failed.")
                raise ServiceUnavailableError(
                    "Failed to generate a valid quiz. Please try again."
                ) from final_error

    def _format_context(self, context: list[dict[str, Any]]) -> str:
        """Helper to format retrieval results into a readable context block."""
        if not context:
            return "No document context available."

        blocks = []
        for idx, chunk in enumerate(context):
            filename = chunk.get("filename", "Unknown File")
            page = chunk.get("page_number", "?")
            text = chunk.get("text", "").strip()
            blocks.append(
                f"[Source #{idx + 1} | Document: {filename} | Page {page}]\n{text}"
            )
        return "\n\n".join(blocks)

    def _parse_and_validate_quiz(
        self, response_text: str, expected_count: int
    ) -> list[dict[str, Any]]:
        """Parses the generated text as JSON and validates the quiz schema."""
        # Clean any accidental markdown codeblock wrapper
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()

        data = json.loads(cleaned_text)
        if not isinstance(data, list):
            raise ValueError("Quiz output is not a JSON array.")

        validated: list[dict[str, Any]] = []
        for idx, item in enumerate(data):
            q_text = item.get("question", "").strip()
            options = item.get("options", [])
            correct_idx = item.get("correct_index")
            explanation = item.get("explanation", "").strip()

            if not q_text:
                raise ValueError(f"Question {idx} is missing 'question' text.")
            if not isinstance(options, list) or len(options) != 4:
                raise ValueError(
                    f"Question {idx} does not have exactly 4 options: {options}"
                )
            if not isinstance(correct_idx, int) or correct_idx < 0 or correct_idx > 3:
                raise ValueError(
                    f"Question {idx} has invalid correct_index: {correct_idx}"
                )

            validated.append(
                {
                    "question": q_text,
                    "options": [str(opt).strip() for opt in options],
                    "correct_index": correct_idx,
                    "explanation": explanation or "Grounded factual answer.",
                }
            )

        return validated

    async def _call_llm_with_retry(
        self, system_instruction: str, user_prompt: str, require_json: bool = False
    ) -> str:
        """Executes LLM generation with rate-limiting retries and primary -> fallback model failover."""
        max_attempts = settings.MAX_RETRIES + 1
        delay = settings.RETRY_DELAY_SECONDS

        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=user_prompt),
        ]

        # Try with primary model first, then fall back on final failure or repeat rate limits
        for attempt in range(1, max_attempts + 1):
            try:
                # Select correct model and variant
                if attempt < max_attempts:
                    client = (
                        self._primary_client_json
                        if require_json
                        else self._primary_client
                    )
                else:
                    client = (
                        self._fallback_client_json
                        if require_json
                        else self._fallback_client
                    )

                response = await client.ainvoke(messages)
                content = str(response.content).strip()

                # Treat empty response as a retryable failure
                if not content:
                    raise ValueError("LLM returned an empty or whitespace response.")

                # If JSON is required, validate it now to trigger retry on malformed outputs
                if require_json:
                    try:
                        json.loads(content)
                    except json.JSONDecodeError as json_err:
                        raise ValueError(
                            f"LLM returned malformed JSON: {json_err}"
                        ) from json_err

                return content

            except Exception as e:
                err_str = str(e)
                is_rate_limited = "429" in err_str or "ResourceExhausted" in err_str

                if is_rate_limited and attempt < max_attempts:
                    logger.warning(
                        "LLM API rate limited (429). Retrying in "
                        "%s seconds (Attempt %s/%s)",
                        delay,
                        attempt,
                        max_attempts,
                    )
                    await asyncio.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue

                if attempt == max_attempts:
                    logger.exception(
                        "LLM generation failed permanently after fallback client attempt."
                    )
                    raise ServiceUnavailableError(
                        "Generation service is currently overloaded. Please try again."
                    ) from e

                # For other errors, wait standard delay and retry
                logger.warning(
                    "LLM Generation attempt %s failed: %s. Retrying...",
                    attempt,
                    err_str,
                )
                await asyncio.sleep(delay)

        raise ServiceUnavailableError("Generation service is currently overloaded.")
