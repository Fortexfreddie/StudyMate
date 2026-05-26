# API Contract

**Base URL (dev):** `http://localhost:8000`  
**Base URL (prod):** `https://<your-railway-app>.up.railway.app`

All requests/responses use `application/json` unless noted.  
All error responses follow: `{ "detail": "Human-readable error message" }`

**Authentication:** Unless marked as public, all endpoints require a valid JWT access token in the `Authorization: Bearer <token>` header. Missing or invalid tokens return `401`.

---

## Health Check

### `GET /health`

**Response 200:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Documents

### `POST /documents/upload` 🔒
Upload and process a PDF. Triggers: extraction → chunking → embedding → storage in Qdrant. Document is linked to the authenticated user.

**Request:** `multipart/form-data`
- `file`: PDF binary (required)

**Response 201:**
```json
{
  "doc_id": "uuid-v4-string",
  "filename": "lecture_notes.pdf",
  "page_count": 24,
  "chunk_count": 87,
  "status": "processed"
}
```

**Errors:**
- `400` — not a PDF, empty file, image-only PDF
- `413` — file too large (> 20MB)
- `503` — embedding service unavailable

---

### `GET /documents` 🔒
List all processed documents for the current user.

**Response 200:**
```json
{
  "documents": [
    {
      "doc_id": "uuid",
      "filename": "lecture_notes.pdf",
      "page_count": 24,
      "chunk_count": 87,
      "uploaded_at": "2026-05-19T10:00:00Z"
    }
  ]
}
```

---

### `DELETE /documents/{doc_id}` 🔒
Remove a document and all its chunks from the vector store. Only the document owner can delete.

**Response 200:**
```json
{ "doc_id": "uuid", "deleted": true }
```

**Errors:**
- `401` — not authenticated or not the document owner
- `404` — doc_id not found

---

## Chat

### `POST /chat` 🔒
Ask a question grounded in an uploaded document. Response is saved to chat history.

**Request body:**
```json
{
  "query": "What is cognitive load theory?",
  "doc_id": "uuid",
  "top_k": 5
}
```

- `doc_id` — optional. Omit to search all documents.
- `top_k` — optional. Default: 5.

**Response 201:**
```json
{
  "answer": "Cognitive load theory posits that...",
  "context_sufficient": true,
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 12,
      "similarity_score": 0.91,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

**Errors:**
- `400` — empty or too-short query
- `401` — not authenticated
- `503` — generation service unavailable

---

## Summary

### `POST /summary/generate` 🔒
Generate a structured summary of a topic from a document. Response is saved to chat history.

**Request body:**
```json
{
  "topic": "Vector Databases and Embeddings",
  "doc_id": "uuid",
  "top_k": 5
}
```

- `doc_id` — optional. Omit to search all documents.
- `top_k` — optional. Default: 5.

**Response 201:**
```json
{
  "summary": "A vector embedding converts text into a high-dimensional numerical...",
  "context_sufficient": true,
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 8,
      "similarity_score": 0.88,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

**Errors:**
- `400` — empty topic
- `401` — not authenticated
- `503` — generation service unavailable

---

## Quiz

### `POST /quiz/generate` 🔒
Generate multiple-choice questions from a topic in a document. Creates a quiz session.

**Request body:**
```json
{
  "topic": "Retrieval-Augmented Generation",
  "doc_id": "uuid",
  "num_questions": 5,
  "top_k": 5
}
```

- `doc_id` — optional. Omit to search all documents.
- `num_questions` — optional. Default: 5, max: 10.
- `top_k` — optional. Default: 5.

**Response 201:**
```json
{
  "session_id": "uuid",
  "topic": "Retrieval-Augmented Generation",
  "questions": [
    {
      "question": "What does RAG combine to reduce hallucinations?",
      "options": [
        "A) Keyword search and grammar correction",
        "B) Parametric memory and a retrieved external knowledge base",
        "C) A fine-tuned model and a relational database",
        "D) Tokenization and semantic parsing"
      ],
      "correct_index": 1,
      "explanation": "According to the lecture notes, RAG combines parametric memory (the LLM) with non-parametric memory (a dense vector index) to ground generation in retrieved content."
    }
  ],
  "sources": [
    {
      "filename": "lecture_notes.pdf",
      "page_number": 5,
      "similarity_score": 0.93,
      "text_preview": "First 150 chars of chunk..."
    }
  ]
}
```

**Errors:**
- `400` — num_questions out of range, empty topic
- `401` — not authenticated
- `422` — Gemini returned unparseable quiz JSON (after retry)
- `503` — generation service unavailable

---

### `POST /quiz/{session_id}/submit` 🔒
Submit answers for a quiz session. Calculates the score and saves the results.

**Request body:**
```json
{
  "answers": [
    {
      "question_index": 0,
      "selected_index": 1
    }
  ]
}
```

**Response 200:**
```json
{
  "session_id": "uuid",
  "score": 4,
  "total_questions": 5,
  "results": [
    {
      "question_index": 0,
      "selected_index": 1,
      "correct_index": 1,
      "is_correct": true,
      "explanation": "According to the lecture notes..."
    }
  ]
}
```

**Errors:**
- `400` — missing answers or invalid format
- `401` — not authenticated
- `404` — session_id not found

---

## Auth (Public)

### `POST /auth/signup`
Create a new user account.

**Request body:**
```json
{
  "email": "student@futo.edu.ng",
  "password": "securepassword123",
  "full_name": "Ekwem Kamsiyochukwu"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "student@futo.edu.ng",
    "full_name": "Ekwem Kamsiyochukwu",
    "created_at": "2026-05-25T10:00:00Z"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `400` — email already registered, password too short (min 8 chars)
- `422` — invalid request body

---

### `POST /auth/login`
Authenticate and receive tokens.

**Request body:**
```json
{
  "email": "student@futo.edu.ng",
  "password": "securepassword123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `401` — invalid email or password

---

### `POST /auth/refresh`
Get a new access token using a refresh token.

**Request body:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `401` — invalid or expired refresh token

---

### `GET /auth/me` 🔒
Get current user profile.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "student@futo.edu.ng",
  "full_name": "Ekwem Kamsiyochukwu",
  "created_at": "2026-05-25T10:00:00Z"
}
```

---

## History 🔒

### `GET /history/chat`
Get the current user's chat history, paginated.

**Query params:**
- `doc_id` — optional. Filter by document.
- `limit` — optional. Default: 10, max: 100.
- `offset` — optional. Default: 0.

**Response 200:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "doc_id": "uuid",
      "query": "What is cognitive load theory?",
      "answer": "Cognitive load theory posits that...",
      "context_sufficient": true,
      "created_at": "2026-05-25T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /history/quizzes`
Get the current user's quiz session history.

**Query params:**
- `doc_id` — optional. Filter by document.
- `limit` — optional. Default: 10, max: 100.
- `offset` — optional. Default: 0.

**Response 200:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "doc_id": "uuid",
      "topic": "Retrieval-Augmented Generation",
      "total_questions": 5,
      "score": 4,
      "created_at": "2026-05-25T11:00:00Z"
    }
  ],
  "total": 8,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /history/quizzes/{session_id}`
Get detailed results for a specific quiz session.

**Response 200:**
```json
{
  "id": "uuid",
  "topic": "Retrieval-Augmented Generation",
  "total_questions": 5,
  "score": 4,
  "answers": [
    {
      "question_index": 0,
      "selected_index": 1,
      "correct_index": 1,
      "is_correct": true
    }
  ],
  "created_at": "2026-05-25T11:00:00Z"
}
```

**Errors:**
- `404` — session_id not found
