"""Documents router — handles uploading, listing, and deleting academic PDFs."""

import io
import logging
from uuid import UUID, uuid4

import pypdf
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import (
    get_current_user,
    get_embedder,
    get_qdrant_client,
    get_vector_store,
)
from core.errors import DocumentNotFoundError
from core.rate_limit import UPLOAD_LIMIT, limiter
from models.database import Document, User, async_session, get_db
from models.schemas import (
    DeleteResponse,
    DocumentInfo,
    DocumentListResponse,
    UploadResponse,
)
from services.activity_service import record_activity
from services.page_quota_service import (
    reconcile_pages,
    release_pages,
    reserve_pages,
)
from services.pdf_processor import PDFProcessor
from services.vector_store import VectorStore

logger = logging.getLogger(__name__)
router = APIRouter()


async def _process_document_ingestion(
    doc_id: UUID,
    file_bytes: bytes,
    filename: str,
    user_id: UUID,
    reserved_pages: int,
) -> None:
    """Background task: parse → embed → index a document, then flip its status.

    Runs *after* the upload response has been sent (HTTP 202), so the slow
    embedding work no longer blocks the request and can't trip the platform's
    request timeout. Creates its own DB session, embedder, and vector store
    because the request-scoped ones are gone once the response is returned.

    ``reserved_pages`` is the page-quota hold placed inline by ``upload_document``.
    On success it is reconciled to the real extractable page count (a scanned or
    partial PDF may yield fewer pages); on *any* failure the full hold is released
    so a failed upload doesn't permanently consume the user's daily page budget.

    On any failure the document row is marked ``status="failed"`` with a
    human-readable ``error_message``, and any partially-written vectors are
    purged so Qdrant doesn't accumulate orphans.
    """
    embedder = get_embedder()
    vector_store = VectorStore(get_qdrant_client())
    pdf_processor = PDFProcessor()

    async def _mark_failed(message: str) -> None:
        """Flip the row to failed, purge orphan vectors, and refund the page hold."""
        # Refund the full page reservation — ingestion produced no usable document.
        await release_pages(user_id, reserved_pages)
        try:
            await vector_store.delete_by_doc_id(str(doc_id))
        except Exception:
            logger.exception("Failed to purge vectors for failed doc %s.", doc_id)
        try:
            async with async_session() as session:
                row = await session.get(Document, doc_id)
                if row is not None:
                    row.status = "failed"
                    row.error_message = message
                    await session.commit()
        except Exception:
            logger.exception("Failed to mark doc %s as failed.", doc_id)

    try:
        chunks = pdf_processor.process_pdf(
            file_bytes=file_bytes,
            filename=filename,
            doc_id=str(doc_id),
        )
    except ValueError as e:
        # Bad/scanned/empty PDF — a permanent failure, surfaced to the user.
        await _mark_failed(str(e))
        return
    except Exception:
        logger.exception("Background PDF parsing failed for doc %s.", doc_id)
        await _mark_failed("Failed to read the PDF. Please try a different file.")
        return

    chunk_texts = [c.text for c in chunks]
    try:
        vectors = await embedder.embed_texts(chunk_texts)
    except Exception:
        logger.exception("Background embedding failed for doc %s.", doc_id)
        await _mark_failed(
            "Failed to embed document — the embedding service may be rate "
            "limited. Please delete this and try again later."
        )
        return

    if vectors and len(vectors[0]) != settings.VECTOR_SIZE:
        logger.error(
            "Embedding dimension mismatch for doc %s: got %d, expected %d.",
            doc_id,
            len(vectors[0]),
            settings.VECTOR_SIZE,
        )
        await _mark_failed("Embedding configuration error. Please contact support.")
        return

    try:
        await vector_store.upsert_chunks(chunks, vectors)
    except Exception:
        logger.exception("Background vector indexing failed for doc %s.", doc_id)
        await _mark_failed("Failed to index document chunks. Please try again.")
        return

    # Success — record real counts and flip to ready in a short transaction.
    real_pages = len(set(c.page_number for c in chunks))
    try:
        async with async_session() as session:
            row = await session.get(Document, doc_id)
            if row is None:
                # Row was deleted (e.g. user cancelled) while we processed — clean up
                # and refund the page hold since the document no longer exists.
                await vector_store.delete_by_doc_id(str(doc_id))
                await release_pages(user_id, reserved_pages)
                return
            row.page_count = real_pages
            row.chunk_count = len(chunks)
            row.status = "ready"
            row.error_message = None
            await session.commit()
        # True the page-quota hold up to the actual extractable page count (the
        # inline reservation used the raw PDF page count, which may be higher for a
        # partially-scanned document).
        await reconcile_pages(user_id, reserved_pages, real_pages)
        logger.info("Document %s ingested: %d chunks ready.", doc_id, len(chunks))
    except Exception:
        logger.exception("Failed to finalize doc %s after indexing.", doc_id)
        await _mark_failed("Failed to save document metadata.")


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit(UPLOAD_LIMIT)
async def upload_document(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> UploadResponse:
    """Accept an academic PDF and process it asynchronously.

    Validation that can fail fast (content-type, extension, size cap, emptiness)
    happens inline so the client gets an immediate 4xx. The expensive work —
    parsing, embedding, and indexing — is handed to a background task and the
    endpoint returns HTTP 202 with ``status="processing"`` right away. This keeps
    the request short so a long PDF can no longer exceed the platform's request
    timeout and leave the upload UI spinning indefinitely. The client polls
    ``GET /documents/{doc_id}`` until ``status`` is "ready" or "failed".
    """
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

    # Read the upload in bounded chunks so an oversized file is rejected after
    # ~MAX_UPLOAD_SIZE_MB of I/O instead of being fully buffered into memory first
    # (prevents a trivial OOM/DoS via a giant upload).
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    byte_chunks: list[bytes] = []
    total_read = 0
    while True:
        chunk = await file.read(1024 * 1024)  # 1 MiB at a time
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File too large. Max size allowed is {settings.MAX_UPLOAD_SIZE_MB}MB."
                ),
            )
        byte_chunks.append(chunk)
    file_bytes = b"".join(byte_chunks)

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Cheap structural sanity check so a non-PDF is rejected synchronously rather
    # than only surfacing as a "failed" document after the background task runs.
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF document.",
        )

    # 2. Read the page count from the PDF *inline* (cheap, local, no embedding) and
    #    reserve it against the user's daily page quota BEFORE doing any expensive
    #    work or persisting anything. Uploads consume the embedding model, whose
    #    Google-side quota is separate from generation tokens — so this is its own
    #    page-based daily limit. The reservation is reconciled to the real
    #    extractable page count (or released) by the background task.
    try:
        page_count_estimate = len(pypdf.PdfReader(io.BytesIO(file_bytes)).pages)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a valid PDF document.",
        ) from e
    if page_count_estimate == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF contains no readable pages.",
        )

    allowed, pages_used, page_limit = await reserve_pages(
        current_user.id, current_user.effective_is_pro, page_count_estimate
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Daily upload limit reached ({pages_used}/{page_limit} pages). "
                "Your upload allowance resets at midnight UTC. Upgrade to Pro for a "
                "larger daily limit."
            ),
        )

    # 3. Create the document row up front in the "processing" state and record the
    #    study-activity for today, then commit. The heavy lifting happens after the
    #    response is sent.
    doc_id = uuid4()
    filename = file.filename or "unknown.pdf"

    db_doc = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=filename,
        page_count=None,
        chunk_count=None,
        status="processing",
    )
    db.add(db_doc)
    await record_activity(db, current_user.id)

    try:
        await db.commit()
    except Exception as e:
        logger.exception("Failed to create processing document row.")
        await db.rollback()
        # The page hold was placed before this commit — refund it so a failed
        # upload doesn't permanently consume the user's daily allowance.
        await release_pages(current_user.id, page_count_estimate)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start document upload. Please try again.",
        ) from e

    # 4. Schedule the parse → embed → index pipeline to run after the response. The
    #    task reconciles the page hold to the real page count (or releases it on
    #    failure), so it needs the user id and the reserved estimate.
    background_tasks.add_task(
        _process_document_ingestion,
        doc_id,
        file_bytes,
        filename,
        current_user.id,
        page_count_estimate,
    )

    return UploadResponse(
        doc_id=doc_id,
        filename=filename,
        page_count=None,
        chunk_count=None,
        status="processing",
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
            status=doc.status,
            error_message=doc.error_message,
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
        status=db_doc.status,
        error_message=db_doc.error_message,
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
