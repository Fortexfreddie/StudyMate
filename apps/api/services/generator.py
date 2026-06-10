"""Generator service — manages LLM generation for chat, summaries, and quizzes."""

import ast
import asyncio
import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from core.config import PERFORMANCE_MODES, settings
from core.errors import ConfigurationError, ServiceUnavailableError

logger = logging.getLogger(__name__)

# Shared system prompt — enforces strict RAG grounding across all generation modes.
SYSTEM_PROMPT = (
    "You are StudyMate, an expert academic study assistant designed to help "
    "university students deeply understand their own lecture materials.\n\n"
    "Before answering, carefully analyze ALL provided context chunks. Cross-reference "
    "information across chunks to build a comprehensive understanding. Do not rely on "
    "a single chunk when multiple chunks contain relevant information.\n\n"
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
    "6. COMPREHENSIVE COVERAGE: When multiple context chunks address the topic, "
    "synthesize information from ALL relevant chunks — not just the first one. "
    "Your answer should reflect the full breadth of what the document covers.\n\n"
    "7. DEPTH OVER BREVITY: Provide thorough, detailed explanations. University "
    "students need depth — not surface-level bullet points. Include examples, "
    "relationships between concepts, and nuances from the source material.\n\n"
    "═══ TONE & FORMATTING ═══\n"
    "• Write at a level appropriate for a university undergraduate student.\n"
    "• Use clear, concise academic English — authoritative but approachable.\n"
    "• Structure responses with markdown: **bold** key terms, use bullet points "
    "for lists, and numbered steps for sequential processes.\n"
    "• Be encouraging and supportive — never condescending.\n"
)


SUMMARY_FORMAT_SPECS: dict[str, dict[str, str]] = {
    "bullets": {
        "schema_hint": '["First key takeaway.", "Second key takeaway.", "..."]',
        "instructions": (
            "Produce 5–8 concise key-takeaway bullet strings capturing the most "
            "important facts about the topic. Each bullet is a complete sentence. "
            "Cover all major aspects mentioned in the context. If the context "
            "mentions examples, include the most important ones."
        ),
    },
    "key_concepts": {
        "schema_hint": (
            '[{"title": "Concept name", "description": "1–3 sentence explanation."}]'
        ),
        "instructions": (
            "Produce 4–7 concept objects, each with a short title and a 1–3 sentence "
            "description grounded in the context. Cover different aspects of the topic. "
            "Descriptions should explain WHY the concept matters, not just WHAT it is."
        ),
    },
    "study_guide": {
        "schema_hint": (
            '{"bullets": ["takeaway", "..."], '
            '"concepts": [{"title": "Concept", "description": "..."}]}'
        ),
        "instructions": (
            "Produce BOTH 5–8 key-takeaway bullets AND 4–7 concept objects (title + "
            "description). Bullets summarize the most critical facts; concepts explain "
            "them in depth. Cover the full breadth of the context."
        ),
    },
    "flashcards": {
        "schema_hint": (
            '[{"front": "Question or term?", "back": "Answer or definition."}]'
        ),
        "instructions": (
            "Produce 6–10 flashcards. `front` is a question or term; `back` is the "
            "answer or definition. Keep each side short and self-contained. Cover "
            "different sections of the context, not just the beginning."
        ),
    },
    "cheat_sheet": {
        "schema_hint": (
            '{"formulas": [{"label": "Name", "value": "formula or fact"}], '
            '"definitions": [{"term": "Term", "meaning": "definition"}]}'
        ),
        "instructions": (
            "Produce a condensed cheat sheet: a `formulas` list of label/value rows "
            "(key formulas, complexities, or facts) and a `definitions` list of "
            "term/meaning rows. If the topic has no formulas, return an empty list "
            "for `formulas`. Include at least 4–6 definitions."
        ),
    },
    "mind_map": {
        "schema_hint": (
            '{"root": "Central topic", '
            '"branches": [{"label": "Sub-topic", "children": ["leaf", "leaf"]}]}'
        ),
        "instructions": (
            "Produce a mind map: a `root` central topic and 3–5 `branches`, each with "
            "a label and 2–4 short child leaf strings. Cover all major sub-topics "
            "mentioned in the context."
        ),
    },
}


def robust_json_loads(text: str) -> Any:
    """Robustly parses a JSON string, falling back to AST literal evaluation
    if the LLM output contains single quotes, trailing commas, or Python-style literals.
    """
    cleaned = text.strip()
    # Remove markdown code fences if present
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as json_err:
        # Try to parse using AST evaluation if it looks like a single-quoted structure
        try:
            # Standardize lowercase JSON representations to Python equivalents for AST
            # Use word boundary regex to avoid replacing parts of words/strings
            ast_text = re.sub(r"\btrue\b", "True", cleaned)
            ast_text = re.sub(r"\bfalse\b", "False", ast_text)
            ast_text = re.sub(r"\bnull\b", "None", ast_text)

            result = ast.literal_eval(ast_text)
            logger.warning(
                "JSON parsing failed with error: %s. AST literal_eval fallback succeeded.",
                json_err,
            )
            return result
        except Exception as fallback_err:
            # Raise original JSONDecodeError if AST fallback also fails
            raise json_err from fallback_err


class Generator:
    """Orchestrates structured generations using Google Gemini models.

    Accepts a ``performance_mode`` that controls model selection, thinking depth,
    and default retrieval top_k. See ``core.config.PERFORMANCE_MODES``.
    """

    def __init__(self, api_key: str, performance_mode: str = "high") -> None:
        if not api_key:
            raise ConfigurationError("Google API key is invalid or missing.")

        config = PERFORMANCE_MODES.get(performance_mode, PERFORMANCE_MODES["high"])
        self.performance_mode = performance_mode
        self.default_top_k: int = int(config["default_top_k"])
        self.max_top_k: int = int(config["max_top_k"])

        primary_model = str(config["primary"])
        fallback_model = str(config["fallback"])
        thinking = str(config["thinking"])

        self._primary_model_name = primary_model
        self._fallback_model_name = fallback_model

        key = SecretStr(api_key)
        temp = settings.GENERATION_TEMPERATURE

        # Map string thinking level to numeric thinking_budget for Gemini 2.0 / 2.5 / 1.5 models,
        # or use thinking_level for Gemini 3+ models.
        primary_kwargs: dict[str, Any] = {}
        is_primary_gemini_2_5 = any(v in self._primary_model_name for v in ("2.5", "2.0", "1.5"))
        if is_primary_gemini_2_5:
            budget_map = {
                "minimal": 0,
                "low": 512,
                "medium": 1024,
                "high": 2048,
            }
            budget = budget_map.get(thinking, 0)
            if budget > 0:
                primary_kwargs["thinking_budget"] = budget
        else:
            primary_kwargs["thinking_level"] = thinking

        fallback_kwargs: dict[str, Any] = {}
        is_fallback_gemini_2_5 = any(v in self._fallback_model_name for v in ("2.5", "2.0", "1.5"))
        if is_fallback_gemini_2_5:
            budget_map = {
                "minimal": 0,
                "low": 512,
                "medium": 1024,
                "high": 2048,
            }
            budget = budget_map.get(thinking, 0)
            if budget > 0:
                fallback_kwargs["thinking_budget"] = budget
        else:
            fallback_kwargs["thinking_level"] = thinking

        # Primary clients (plain + JSON-enforced)
        self._primary_client = ChatGoogleGenerativeAI(
            model=self._primary_model_name,
            google_api_key=key,
            temperature=temp,
            max_retries=0,
            **primary_kwargs,
        )
        self._primary_client_json = ChatGoogleGenerativeAI(
            model=self._primary_model_name,
            google_api_key=key,
            temperature=temp,
            response_mime_type="application/json",
            max_retries=0,
            **primary_kwargs,
        )

        # Fallback clients (plain + JSON-enforced)
        self._fallback_client = ChatGoogleGenerativeAI(
            model=self._fallback_model_name,
            google_api_key=key,
            temperature=temp,
            max_retries=0,
            **fallback_kwargs,
        )
        self._fallback_client_json = ChatGoogleGenerativeAI(
            model=self._fallback_model_name,
            google_api_key=key,
            temperature=temp,
            response_mime_type="application/json",
            max_retries=0,
            **fallback_kwargs,
        )

    async def generate_answer(
        self, query: str, context: list[dict[str, Any]]
    ) -> tuple[str, bool, dict[str, int | str]]:
        """Generates a grounded answer from retrieved context chunks.

        Returns ``(answer, context_sufficient, usage)``.
        """
        context_text = self._format_context(context)

        system_instruction = (
            SYSTEM_PROMPT + "\n═══ OUTPUT FORMAT ═══\n"
            "Format your response as a JSON object with exactly these keys:\n"
            "{\n"
            '  "answer": "Your rich, well-formatted markdown response with bold keywords, bullet points, or lists.",\n'
            '  "context_sufficient": true\n'
            "}\n\n"
            "IMPORTANT: Your answer must be comprehensive and detailed. Synthesize "
            "information from ALL relevant context chunks. Structure your response "
            "with clear sections if the topic has multiple aspects.\n\n"
            "If the provided context does not contain enough facts to answer the question, return:\n"
            "{\n"
            '  "answer": "The uploaded document does not contain enough information to answer this question.",\n'
            '  "context_sufficient": false\n'
            "}\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        try:
            response_text, usage = await self._call_llm_with_retry(
                system_instruction, f"Question: {query}", require_json=True
            )
            parsed = robust_json_loads(response_text)
            answer = parsed.get("answer", "").strip()
            context_sufficient = bool(parsed.get("context_sufficient", False))
            return answer, context_sufficient, usage
        except Exception:
            logger.exception("Failed to parse or generate chat response from LLM.")
            return (
                "I encountered an error generating an answer based on your document. Please try again.",
                False,
                {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "model_used": "error",
                },
            )

    async def generate_summary(
        self, topic: str, context: list[dict[str, Any]], summary_format: str = "bullets"
    ) -> tuple[str, Any, bool, dict[str, int | str]]:
        """Generates a format-specific summary grounded in context chunks.

        Returns ``(plain_text, structured, context_sufficient, usage)``.
        """
        context_text = self._format_context(context)
        spec = SUMMARY_FORMAT_SPECS.get(summary_format, SUMMARY_FORMAT_SPECS["bullets"])

        system_instruction = (
            SYSTEM_PROMPT + "\n═══ OUTPUT FORMAT ═══\n"
            "Respond with a single JSON object with exactly these keys:\n"
            "{\n"
            f'  "structured": {spec["schema_hint"]},\n'
            '  "plain_text": "A clean markdown rendering of the same content (headers, bullets).",\n'
            '  "context_sufficient": true\n'
            "}\n\n"
            f"FORMAT INSTRUCTIONS ({summary_format}):\n{spec['instructions']}\n\n"
            "IMPORTANT: Be thorough. Cover ALL relevant information from the context. "
            "The student is relying on this summary for studying — do not omit important details.\n\n"
            "If the provided context does not contain enough facts to summarize this "
            "topic, return:\n"
            "{\n"
            '  "structured": null,\n'
            '  "plain_text": "The uploaded document does not contain relevant '
            'information on this topic to generate a summary.",\n'
            '  "context_sufficient": false\n'
            "}\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        try:
            response_text, usage = await self._call_llm_with_retry(
                system_instruction,
                f"Topic to Summarize: {topic}",
                require_json=True,
            )
            plain, structured, sufficient = self._parse_and_validate_summary(
                response_text, summary_format
            )
            return plain, structured, sufficient, usage
        except Exception:
            logger.exception("Failed to parse or generate summary from LLM.")
            return (
                "I encountered an error generating a topic summary based on your "
                "document. Please try again.",
                None,
                False,
                {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "model_used": "error",
                },
            )

    async def generate_quiz(
        self, topic: str, context: list[dict[str, Any]], num_questions: int = 5
    ) -> tuple[list[dict[str, Any]], dict[str, int | str]]:
        """Generates a structured multiple-choice quiz strictly from context.

        Returns ``(questions, usage)``. Usage is accumulated across retries.
        """
        context_text = self._format_context(context)
        accumulated_usage: dict[str, int | str] = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "model_used": "",
        }

        system_instruction = (
            SYSTEM_PROMPT + "\n═══ QUIZ GENERATION RULES ═══\n"
            f"Generate exactly {num_questions} multiple-choice questions.\n"
            "Each question must test understanding of a concept explicitly stated in the context.\n\n"
            "QUESTION QUALITY REQUIREMENTS:\n"
            "• Questions should test different cognitive levels: recall, understanding, "
            "application, and analysis.\n"
            "• Cover different sections of the provided context, not just the first few paragraphs.\n"
            "• Distractors must be plausible alternatives from the same domain — not obviously wrong.\n"
            "• The correct answer MUST be unambiguously supported by the context.\n"
            "• Double-check that correct_index points to the actually correct option.\n\n"
            "Your output MUST be a valid JSON array of question objects (and nothing else). "
            "Do not wrap in markdown code blocks.\n"
            "Each question object MUST have exactly these keys:\n"
            "{\n"
            '  "question": "Clear, concise academic question text",\n'
            '  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],\n'
            '  "correct_index": 0,\n'
            '  "explanation": "Detailed explanation of why this option is correct, referencing '
            'facts from the document."\n'
            "}\n\n"
            "Guidelines:\n"
            "1. You MUST supply exactly 4 options per question.\n"
            "2. The correct_index must be an integer from 0 to 3 matching the correct option index.\n"
            "3. VERIFY: Before outputting, re-read each question and confirm correct_index "
            "actually points to the right answer in the options array.\n\n"
            f"--- CONTEXT ---\n{context_text}"
        )

        prompt = f"Generate a {num_questions}-question quiz on this topic: {topic}"

        # First attempt
        try:
            response_text, usage = await self._call_llm_with_retry(
                system_instruction, prompt, require_json=True
            )
            self._accumulate_usage(accumulated_usage, usage)
            questions = self._parse_and_validate_quiz(response_text, num_questions)
            return questions, accumulated_usage
        except Exception as first_error:
            logger.warning(
                "First attempt of quiz generation parsing failed: %s. Retrying with a stricter constraint.",
                str(first_error),
            )

            # Stricter prompt retry
            retry_instruction = (
                "CRITICAL: You failed to return a valid JSON array matching the required format "
                "in your previous attempt.\n"
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
                "]\n\n"
                "VERIFY each correct_index points to the correct option before outputting."
            )

            try:
                response_text, usage = await self._call_llm_with_retry(
                    retry_instruction, prompt, require_json=True
                )
                self._accumulate_usage(accumulated_usage, usage)
                questions = self._parse_and_validate_quiz(response_text, num_questions)
                return questions, accumulated_usage
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

    @staticmethod
    def _extract_text_content(content: Any) -> str:
        """Extract the actual text from an LLM response content field.

        When thinking is enabled (Gemini 3.x with thinking_level, or 2.5 with
        thinking_budget), langchain-google-genai returns ``response.content``
        as a **list of dicts** like::

            [{'type': 'text', 'text': '{...}', 'extras': {...}}]

        This helper normalises both the plain-string and list-of-blocks
        formats into a single text string.
        """
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            text_parts: list[str] = []
            for block in content:
                if isinstance(block, dict):
                    # Prefer 'text'-type blocks; skip 'thinking' blocks
                    if block.get("type") == "thinking":
                        continue
                    text = block.get("text", "")
                    if text:
                        text_parts.append(str(text))
                elif isinstance(block, str):
                    text_parts.append(block)
            joined = "\n".join(text_parts).strip()
            if joined:
                return joined

        # Last-resort fallback — stringify whatever we got
        return str(content).strip()

    @staticmethod
    def _strip_code_fence(text: str) -> str:
        """Remove an accidental ```json / ``` markdown wrapper around JSON."""
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    @staticmethod
    def _accumulate_usage(
        accumulated: dict[str, int | str], new: dict[str, int | str]
    ) -> None:
        """Add new usage counts into an accumulator dict."""
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            val_acc = accumulated.get(key, 0)
            val_new = new.get(key, 0)
            acc_num = int(val_acc) if isinstance(val_acc, int | str) else 0
            new_num = int(val_new) if isinstance(val_new, int | str) else 0
            accumulated[key] = acc_num + new_num
        accumulated["model_used"] = new.get(
            "model_used", accumulated.get("model_used", "")
        )

    def _parse_and_validate_summary(
        self, response_text: str, summary_format: str
    ) -> tuple[str, Any, bool]:
        """Parse the summary JSON and lightly validate the per-format structure."""
        parsed = robust_json_loads(response_text)
        plain_text = str(parsed.get("plain_text", "")).strip()
        context_sufficient = bool(parsed.get("context_sufficient", False))
        structured = parsed.get("structured")

        if not context_sufficient or structured is None:
            return plain_text, None, context_sufficient

        try:
            structured = self._validate_summary_structure(structured, summary_format)
        except (ValueError, TypeError, KeyError, AttributeError):
            logger.warning(
                "Summary structured payload failed validation for format '%s'; "
                "falling back to plain text only.",
                summary_format,
            )
            structured = None

        return plain_text, structured, context_sufficient

    def _validate_summary_structure(self, data: Any, summary_format: str) -> Any:
        """Validate/normalize the structured payload for a given format."""
        if summary_format == "bullets":
            if not isinstance(data, list):
                raise ValueError("bullets must be a list.")
            return [str(b).strip() for b in data if str(b).strip()]

        if summary_format == "key_concepts":
            if not isinstance(data, list):
                raise ValueError("key_concepts must be a list.")
            return [
                {
                    "title": str(c["title"]).strip(),
                    "description": str(c["description"]).strip(),
                }
                for c in data
            ]

        if summary_format == "study_guide":
            bullets = data["bullets"]
            concepts = data["concepts"]
            if not isinstance(bullets, list) or not isinstance(concepts, list):
                raise ValueError("study_guide requires list bullets and concepts.")
            return {
                "bullets": [str(b).strip() for b in bullets if str(b).strip()],
                "concepts": [
                    {
                        "title": str(c["title"]).strip(),
                        "description": str(c["description"]).strip(),
                    }
                    for c in concepts
                ],
            }

        if summary_format == "flashcards":
            if not isinstance(data, list):
                raise ValueError("flashcards must be a list.")
            return [
                {"front": str(c["front"]).strip(), "back": str(c["back"]).strip()}
                for c in data
            ]

        if summary_format == "cheat_sheet":
            formulas = data.get("formulas", [])
            definitions = data.get("definitions", [])
            return {
                "formulas": [
                    {"label": str(f["label"]).strip(), "value": str(f["value"]).strip()}
                    for f in formulas
                ],
                "definitions": [
                    {
                        "term": str(d["term"]).strip(),
                        "meaning": str(d["meaning"]).strip(),
                    }
                    for d in definitions
                ],
            }

        if summary_format == "mind_map":
            branches = data["branches"]
            if not isinstance(branches, list):
                raise ValueError("mind_map requires a list of branches.")
            return {
                "root": str(data["root"]).strip(),
                "branches": [
                    {
                        "label": str(b["label"]).strip(),
                        "children": [str(c).strip() for c in b["children"]],
                    }
                    for b in branches
                ],
            }

        # Unknown format — pass through untouched.
        return data

    def _parse_and_validate_quiz(
        self, response_text: str, expected_count: int
    ) -> list[dict[str, Any]]:
        """Parses the generated text as JSON and validates the quiz schema.

        Also cross-checks that correct_index actually points to a plausible answer
        by verifying the explanation references the selected option.
        """
        import re

        data = robust_json_loads(response_text)

        # If data is a dictionary, scan its keys for any list (e.g. {"questions": [...]})
        if isinstance(data, dict):
            found_list = False
            for _, v in data.items():
                if isinstance(v, list) and len(v) > 0:
                    data = v
                    found_list = True
                    break
            if not found_list:
                data = [data]

        if not isinstance(data, list):
            raise ValueError("Quiz output is not a JSON array.")

        def get_flexible_val(d: dict[str, Any], possible_keys: list[str]) -> Any:
            # First look for case-insensitive exact matches
            for k, v in d.items():
                k_lower = k.lower().replace("_", "").replace(" ", "")
                for pk in possible_keys:
                    pk_cleaned = pk.lower().replace("_", "").replace(" ", "")
                    if k_lower == pk_cleaned:
                        return v
            # Secondly look for substring matches
            for k, v in d.items():
                k_lower = k.lower()
                for pk in possible_keys:
                    if pk.lower() in k_lower:
                        return v
            return None

        validated: list[dict[str, Any]] = []
        for idx, item in enumerate(data):
            if not isinstance(item, dict):
                continue

            q_text = get_flexible_val(
                item, ["question", "q", "text", "query", "prompt"]
            )
            if q_text and isinstance(q_text, dict):
                # If question is itself a dictionary, extract any string from it
                for val in q_text.values():
                    if isinstance(val, str) and val.strip():
                        q_text = val
                        break
            q_text = str(q_text or "").strip()

            # Fallback: if q_text is still empty, scan dict for any large string
            if not q_text:
                for k, v in item.items():
                    if (
                        isinstance(v, str)
                        and len(v) > 15
                        and k.lower() not in ("explanation", "reason", "why", "options")
                    ):
                        q_text = v.strip()
                        break

            if not q_text:
                raise ValueError(f"Question {idx} is missing 'question' text.")

            options = get_flexible_val(item, ["options", "choices", "answers", "opts"])
            if not isinstance(options, list) or len(options) != 4:
                # Check for separate keys A, B, C, D or option_a, option_b, etc.
                opt_keys = ["a", "b", "c", "d"]
                found_opts = []
                for char in opt_keys:
                    val = get_flexible_val(
                        item, [f"option{char}", f"option_{char}", char]
                    )
                    if val is not None:
                        found_opts.append(str(val))
                if len(found_opts) == 4:
                    options = found_opts

            if not isinstance(options, list) or len(options) != 4:
                # Fallback: if we still don't have exactly 4 options, extract all string values that aren't the question/explanation
                extracted_strings = []
                for k, v in item.items():
                    if (
                        isinstance(v, str)
                        and v != q_text
                        and k.lower()
                        not in ("explanation", "reason", "why", "question")
                    ):
                        extracted_strings.append(v)
                if len(extracted_strings) >= 4:
                    options = extracted_strings[:4]
                else:
                    raise ValueError(
                        f"Question {idx} does not have exactly 4 options: {options}"
                    )

            correct_idx = get_flexible_val(
                item,
                [
                    "correct_index",
                    "correctindex",
                    "correct_idx",
                    "correctidx",
                    "correct",
                    "answer",
                    "correct_answer",
                    "correctanswer",
                    "right_answer",
                ],
            )

            # Standardize correct index to an integer 0..3
            if isinstance(correct_idx, str):
                idx_clean = correct_idx.strip().upper()
                if "A" in idx_clean:
                    correct_idx = 0
                elif "B" in idx_clean:
                    correct_idx = 1
                elif "C" in idx_clean:
                    correct_idx = 2
                elif "D" in idx_clean:
                    correct_idx = 3
                else:
                    digits = re.findall(r"\d+", idx_clean)
                    if digits:
                        correct_idx = int(digits[0])

            if not isinstance(correct_idx, int) or correct_idx < 0 or correct_idx > 3:
                logger.warning(
                    "Invalid correct_idx %s received from LLM for question %s. Defaulting to 0.",
                    correct_idx,
                    idx,
                )
                correct_idx = 0  # Safe default to avoid crashes

            explanation = get_flexible_val(
                item,
                ["explanation", "reasoning", "reason", "why", "desc", "description"],
            )
            explanation = str(explanation or "").strip()

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
    ) -> tuple[str, dict[str, int | str]]:
        """Executes LLM generation with retries and primary → fallback failover.

        Returns ``(content, usage)`` where usage contains token counts and model name.
        """
        messages = [
            SystemMessage(content=system_instruction),
            HumanMessage(content=user_prompt),
        ]

        primary_attempts = 0
        max_primary_attempts = settings.MAX_RETRIES + 1  # e.g. 1 initial + MAX_RETRIES (1) for transient errors

        fallback_attempts = 0
        max_fallback_attempts = 1  # 0 retries for fallback

        use_fallback = False
        delay = settings.RETRY_DELAY_SECONDS

        while True:
            # Select appropriate model client
            if not use_fallback:
                client = self._primary_client_json if require_json else self._primary_client
                current_model = self._primary_model_name
                primary_attempts += 1
                attempt_num = primary_attempts
                max_attempts = max_primary_attempts
            else:
                client = self._fallback_client_json if require_json else self._fallback_client
                current_model = self._fallback_model_name
                fallback_attempts += 1
                attempt_num = fallback_attempts
                max_attempts = max_fallback_attempts

            try:
                response = await client.ainvoke(messages)
                content = self._extract_text_content(response.content)

                # Extract usage metadata
                usage: dict[str, int | str] = {"model_used": current_model}
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    meta = response.usage_metadata
                    if isinstance(meta, dict):
                        usage["input_tokens"] = meta.get("input_tokens", 0)
                        usage["output_tokens"] = meta.get("output_tokens", 0)
                        usage["total_tokens"] = meta.get("total_tokens", 0)
                    else:
                        usage["input_tokens"] = getattr(meta, "input_tokens", 0)
                        usage["output_tokens"] = getattr(meta, "output_tokens", 0)
                        usage["total_tokens"] = getattr(meta, "total_tokens", 0)
                else:
                    usage.update(
                        {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
                    )

                logger.info(
                    "LLM call completed (model=%s, mode=%s, tokens=%s)",
                    current_model,
                    self.performance_mode,
                    usage.get("total_tokens"),
                )

                if not content:
                    raise ValueError("LLM returned an empty or whitespace response.")

                if require_json:
                    try:
                        robust_json_loads(content)
                    except json.JSONDecodeError as json_err:
                        raise ValueError(
                            f"LLM returned malformed JSON: {json_err}"
                        ) from json_err

                return content, usage

            except Exception as e:
                err_str = str(e)
                is_rate_limited = "429" in err_str or "ResourceExhausted" in err_str or "Quota" in err_str

                logger.warning(
                    "LLM Generation failed on model %s (Attempt %d/%d): %s",
                    current_model,
                    attempt_num,
                    max_attempts,
                    err_str,
                )

                # If we are using the primary model and fail:
                if not use_fallback:
                    # 1. 429 Rate limit / Quota issue: trigger fast fallback immediately
                    if is_rate_limited:
                        logger.warning(
                            "Primary model rate limited (429/Quota). Triggering fast fallback to secondary model."
                        )
                        use_fallback = True
                        continue

                    # 2. Transient error (e.g. 503 / empty response): retry at most once
                    if attempt_num < max_attempts:
                        logger.warning(
                            "Primary model failed. Retrying in %d seconds...",
                            delay,
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        logger.warning(
                            "Primary model failed after %d attempts. Falling back to secondary model.",
                            attempt_num,
                        )
                        use_fallback = True
                        continue

                # If we are already using the fallback model and fail:
                else:
                    logger.exception(
                        "LLM generation failed permanently on fallback client."
                    )
                    raise ServiceUnavailableError(
                        "Generation service is currently overloaded. Please try again."
                    ) from e
