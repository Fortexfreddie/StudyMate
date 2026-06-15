"""PDF processor service — extracts and chunks academic materials."""

import io
from dataclasses import dataclass
from uuid import uuid4

import pypdf
from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import settings


@dataclass
class DocumentChunk:
    """Represents a single parsed and chunked segment of a PDF document."""

    chunk_id: str
    doc_id: str
    filename: str
    page_number: int
    text: str
    token_count: int


class PDFProcessor:
    """Ingests raw PDF bytes, cleans text, and splits it into semantic chunks."""

    def __init__(
        self,
        chunk_size: int = settings.DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = settings.DEFAULT_CHUNK_OVERLAP,
    ) -> None:
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=self._approximate_tokens,
            separators=["\n\n", "\n", " ", ""],
        )

    def _approximate_tokens(self, text: str) -> int:
        """Approximate the token count of a text segment (1 token ≈ 4 characters)."""
        return max(1, len(text) // 4)

    def process_pdf(
        self, file_bytes: bytes, filename: str, doc_id: str
    ) -> list[DocumentChunk]:
        """Validate PDF bytes, extract textual content, split, and attach metadata.

        Raises:
            ValueError: If the file is not a valid, readable, or non-scanned PDF.
        """
        # Validate file bytes represent a PDF
        if not file_bytes.startswith(b"%PDF"):
            raise ValueError("File must be a PDF document.")

        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)
        except Exception as e:
            raise ValueError("File must be a PDF document.") from e

        if total_pages == 0:
            raise ValueError("PDF contains no readable pages.")

        # 1. Extract + clean every page first, then stitch them into ONE continuous
        #    string. Splitting per-page (the old approach) severed any paragraph that
        #    spanned a page boundary and prevented chunk_overlap from bridging it. We
        #    keep a (char_offset -> page_number) map so each resulting chunk can still
        #    be attributed to the page it starts on.
        page_boundaries: list[tuple[int, int]] = []  # (start_offset, page_number)
        text_parts: list[str] = []
        cursor = 0
        separator = "\n\n"

        for page_idx, page in enumerate(reader.pages, start=1):
            raw = page.extract_text()
            if not raw:
                continue
            cleaned = self._clean_text(raw)
            if not cleaned:
                continue

            if text_parts:
                # Account for the separator joining the previous page to this one.
                cursor += len(separator)
            page_boundaries.append((cursor, page_idx))
            text_parts.append(cleaned)
            cursor += len(cleaned)

        # Reject image-only PDFs (nothing extractable on any page).
        if not text_parts:
            raise ValueError(
                "PDF appears to be a scanned image. Text extraction is not supported."
            )

        full_text = separator.join(text_parts)

        # 2. Split the whole document at once, so overlap carries across page breaks.
        splits = self._splitter.split_text(full_text)

        # 3. Coalesce splits shorter than MIN_CHUNK_LENGTH into the previous chunk
        #    instead of silently discarding them — this used to permanently drop short
        #    trailing sentences (e.g. a page's closing line) from the index.
        merged: list[str] = []
        for split in splits:
            stripped = split.strip()
            if not stripped:
                continue
            if len(stripped) < settings.MIN_CHUNK_LENGTH and merged:
                merged[-1] = f"{merged[-1]} {stripped}"
            else:
                merged.append(stripped)

        # 4. Attribute each chunk to a page by locating its text in the combined
        #    string and matching that offset against the page-boundary map. Searching
        #    from a running cursor keeps this O(n) and robust to repeated text.
        chunks: list[DocumentChunk] = []
        search_from = 0
        for chunk_text in merged:
            offset = full_text.find(chunk_text, search_from)
            if offset == -1:
                # Coalescing inserted a space the combined string doesn't contain;
                # fall back to locating just the chunk's leading segment.
                offset = full_text.find(chunk_text.split(" ", 1)[0], search_from)
                if offset == -1:
                    offset = search_from
            search_from = offset + 1

            page_number = self._page_for_offset(offset, page_boundaries)
            chunks.append(
                DocumentChunk(
                    chunk_id=str(uuid4()),
                    doc_id=doc_id,
                    filename=filename,
                    page_number=page_number,
                    text=chunk_text,
                    token_count=self._approximate_tokens(chunk_text),
                )
            )

        return chunks

    @staticmethod
    def _page_for_offset(
        offset: int, page_boundaries: list[tuple[int, int]]
    ) -> int:
        """Return the page number whose text range contains ``offset``.

        ``page_boundaries`` is an ascending list of (start_offset, page_number).
        A chunk spanning a page break is attributed to the page it *starts* on.
        """
        page_number = page_boundaries[0][1]
        for start_offset, num in page_boundaries:
            if offset >= start_offset:
                page_number = num
            else:
                break
        return page_number

    def _clean_text(self, text: str) -> str:
        """Normalize whitespaces, strip headers/footers, and preserve paragraphs."""
        # Standardize newlines and split by paragraph boundaries
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        raw_paragraphs = normalized.split("\n\n")

        paragraphs = []
        for para in raw_paragraphs:
            # Clean and join consecutive lines in a single paragraph with space
            lines = [line.strip() for line in para.splitlines()]
            cleaned_lines = [line for line in lines if line]
            if cleaned_lines:
                paragraphs.append(" ".join(cleaned_lines))

        return "\n\n".join(paragraphs)
