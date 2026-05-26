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

        chunks: list[DocumentChunk] = []
        total_extracted_characters = 0

        # Extract and split page by page
        for page_idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if not text:
                continue

            cleaned_text = self._clean_text(text)
            total_extracted_characters += len(cleaned_text)

            # Split clean page text
            page_splits = self._splitter.split_text(cleaned_text)

            for split in page_splits:
                # Enforce minimum chunk length constraints
                if len(split) < settings.MIN_CHUNK_LENGTH:
                    continue

                chunk_id = str(uuid4())
                token_count = self._approximate_tokens(split)

                chunks.append(
                    DocumentChunk(
                        chunk_id=chunk_id,
                        doc_id=doc_id,
                        filename=filename,
                        page_number=page_idx,
                        text=split,
                        token_count=token_count,
                    )
                )

        # Reject image-only PDFs
        if total_extracted_characters == 0:
            raise ValueError(
                "PDF appears to be a scanned image. Text extraction is not supported."
            )

        return chunks

    def _clean_text(self, text: str) -> str:
        """Normalize whitespaces, strip headers/footers, and clean text."""
        # Simple whitespace normalization
        lines = [line.strip() for line in text.splitlines()]
        cleaned_lines = [line for line in lines if line]
        return " ".join(cleaned_lines)
