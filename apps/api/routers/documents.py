"""Documents router — handles uploading, listing, and deleting academic PDFs."""

import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import (
    get_current_user,
    get_embedder,
    get_pdf_processor,
    get_vector_store,
)
from core.errors import DocumentNotFoundError
from core.rate_limit import UPLOAD_LIMIT, limiter
from models.database import Document, User, get_db
from models.schemas import (
    DeleteResponse,
    DocumentInfo,
    DocumentListResponse,
    UploadResponse,
)
from services.activity_service import record_activity
from services.embedder import Embedder
from services.pdf_processor import PDFProcessor
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(UPLOAD_LIMIT)
async def upload_document(
    request: Request,
    file: UploadFile,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    pdf_processor: PDFProcessor = Depends(get_pdf_processor),  # noqa: B008
    embedder: Embedder = Depends(get_embedder),  # noqa: B008
    vector_store: VectorStore = Depends(get_vector_store),  # noqa: B008
) -> UploadResponse:
    """Upload an academic PDF document, parse, chunk, embed, and store in vector DB."""
    # 1. Validate file content-type and extension
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted.",
        )
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a .pdf extension.",
        )

    file_bytes = await file.read()
    file_size_mb = len(file_bytes) / (1024 * 1024)
    if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File too large. Max size allowed is {settings.MAX_UPLOAD_SIZE_MB}MB."
            ),
        )

    # 2. Extract plain text page-by-page and split into chunks
    doc_id = uuid4()
    filename = file.filename or "unknown.pdf"

    try:
        chunks = pdf_processor.process_pdf(
            file_bytes=file_bytes,
            filename=filename,
            doc_id=str(doc_id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    # 3. Create document record in database
    db_doc = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=filename,
        page_count=len(set(c.page_number for c in chunks)),
        chunk_count=len(chunks),
    )

    db.add(db_doc)
    await db.flush()  # Lock document ID inside the transaction

    # 4. Embed clean text chunks and store in Qdrant
    chunk_texts = [c.text for c in chunks]
    try:
        vectors = await embedder.embed_texts(chunk_texts)
        await vector_store.upsert_chunks(chunks, vectors)
    except Exception as e:
        logger.exception("Ingestion vector indexing failed.")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to index document chunks.",
        ) from e

    # Record today's study activity for the streak (best-effort, before commit)
    await record_activity(db, current_user.id)

    try:
        await db.commit()
    except Exception as e:
        logger.exception(
            "Database commit failed for document upload. Rolling back vector store."
        )
        try:
            await vector_store.delete_by_doc_id(str(doc_id))
        except Exception:
            logger.exception(
                "Failed to delete vectors from Qdrant on rollback cleanup."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save document metadata.",
        ) from e

    await db.refresh(db_doc)

    return UploadResponse(
        doc_id=db_doc.id,
        filename=db_doc.filename,
        page_count=db_doc.page_count,
        chunk_count=db_doc.chunk_count,
        status="processed",
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> DocumentListResponse:
    """Retrieve all uploaded documents metadata owned by the logged-in user."""
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
    )
    db_docs = result.scalars().all()

    docs_info = [
        DocumentInfo(
            doc_id=doc.id,
            filename=doc.filename,
            page_count=doc.page_count,
            chunk_count=doc.chunk_count,
            uploaded_at=doc.uploaded_at,
        )
        for doc in db_docs
    ]
    return DocumentListResponse(documents=docs_info)


@router.get("/{doc_id}", response_model=DocumentInfo)
async def get_document(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> DocumentInfo:
    """Retrieve a single document's metadata. Only the owner may access it."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    db_doc = result.scalar_one_or_none()

    if db_doc is None:
        raise DocumentNotFoundError(str(doc_id))

    if db_doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this document.",
        )

    return DocumentInfo(
        doc_id=db_doc.id,
        filename=db_doc.filename,
        page_count=db_doc.page_count,
        chunk_count=db_doc.chunk_count,
        uploaded_at=db_doc.uploaded_at,
    )


@router.delete("/{doc_id}", response_model=DeleteResponse)
async def delete_document(
    doc_id: UUID,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
    vector_store: VectorStore = Depends(get_vector_store),  # noqa: B008
) -> DeleteResponse:
    """Delete document metadata in PG and purge matching vectors from Qdrant."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    db_doc = result.scalar_one_or_none()

    if db_doc is None:
        raise DocumentNotFoundError(str(doc_id))

    # Access control check
    if db_doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this document.",
        )

    # Delete relational rows (links delete automatically via CASCADE / SET NULL)
    await db.delete(db_doc)
    await db.commit()

    # Purge vectors from Qdrant (after successful DB commit)
    try:
        await vector_store.delete_by_doc_id(str(doc_id))
    except Exception:
        logger.exception(
            "Failed to purge vectors from Qdrant for document %s (non-fatal).",
            doc_id,
        )

    return DeleteResponse(doc_id=doc_id, deleted=True)
