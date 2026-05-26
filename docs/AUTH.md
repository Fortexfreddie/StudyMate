# Auth Spec

**Files:**  
- `apps/api/core/security.py` — JWT utilities, password hashing  
- `apps/api/services/auth_service.py` — Signup/login business logic  
- `apps/api/routers/auth.py` — Auth endpoints

**Role:** Handle user registration, login, token management, and route protection.

---

## Responsibility

This module owns **all authentication and authorization logic**. It provides password hashing, JWT token creation/verification, and a FastAPI dependency that protects routes.

---

## Password Hashing

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)
```

---

## JWT Token Management

```python
from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import PyJWTError
from core.config import settings


def create_access_token(user_id: str) -> str:
    """Create a short-lived access token."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a longer-lived refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
```

### Token Structure

**Access Token Payload:**
```json
{
  "sub": "user-uuid-string",
  "exp": 1716660000,
  "type": "access"
}
```

**Refresh Token Payload:**
```json
{
  "sub": "user-uuid-string",
  "exp": 1717200000,
  "type": "refresh"
}
```

---

## Route Protection

```python
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import decode_token
from core.errors import AuthenticationError
from models.database import User, get_db

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency — extracts and validates the current user from JWT."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if user_id is None or token_type != "access":
            raise AuthenticationError("Invalid token.")

    except InvalidTokenError:
        raise AuthenticationError("Token has expired or is invalid.") from None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthenticationError("User not found.")

    return user
```

### Usage in Routes

```python
from core.dependencies import get_current_user
from models.database import User

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    # current_user is guaranteed to be authenticated
    # Use current_user.id as the document owner
    ...
```

---

## API Endpoints

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
- `400` — email already registered, password too short
- `422` — invalid request body

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

### `GET /auth/me`

Get current user profile. **Requires auth.**

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

## Auth Service (Business Logic)

```python
# apps/api/services/auth_service.py

class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def signup(self, email: str, password: str, full_name: str) -> tuple[User, str, str]:
        """Create a new user and return (user, access_token, refresh_token)."""
        # 1. Check if email already exists
        # 2. Validate password (min 8 chars)
        # 3. Hash password
        # 4. Create User record
        # 5. Generate tokens
        # 6. Return (user, access_token, refresh_token)

    async def login(self, email: str, password: str) -> tuple[str, str]:
        """Verify credentials and return (access_token, refresh_token)."""
        # 1. Find user by email
        # 2. Verify password
        # 3. Generate tokens
        # 4. Return (access_token, refresh_token)

    async def refresh(self, refresh_token: str) -> str:
        """Validate refresh token and return a new access token."""
        # 1. Decode refresh token
        # 2. Verify type == "refresh"
        # 3. Verify user still exists
        # 4. Generate new access token
        # 5. Return access_token
```

---

## Password Requirements

| Rule | Value |
|---|---|
| Minimum length | 8 characters |
| Hashing algorithm | bcrypt |
| Hash storage | `password_hash` column in `users` table |

No complexity requirements (uppercase, special chars) — keep it simple for an MVP.

---

## Token Lifetimes

| Token | Lifetime | Purpose |
|---|---|---|
| Access token | 30 minutes | Short-lived, used for API requests |
| Refresh token | 7 days | Used to get new access tokens without re-login |

---

## Which Routes Need Auth?

| Route | Auth Required? |
|---|---|
| `GET /health` | ❌ |
| `POST /auth/signup` | ❌ |
| `POST /auth/login` | ❌ |
| `POST /auth/refresh` | ❌ |
| `GET /auth/me` | ✅ |
| `POST /documents/upload` | ✅ |
| `GET /documents` | ✅ (returns only user's docs) |
| `DELETE /documents/{doc_id}` | ✅ (only owner can delete) |
| `POST /chat` | ✅ (saves to history) |
| `POST /summary/generate` | ✅ (saves to history) |
| `POST /quiz/generate` | ✅ (creates quiz session) |
| `POST /quiz/{session_id}/submit` | ✅ (records answers) |
| `GET /history/chat` | ✅ |
| `GET /history/quizzes` | ✅ |

---

## Error Handling

| Condition | Exception | HTTP Code |
|---|---|---|
| Email already registered | `HTTPException(400, "Email already registered.")` | 400 |
| Password too short | `HTTPException(400, "Password must be at least 8 characters.")` | 400 |
| Invalid email or password | `AuthenticationError("Invalid email or password.")` | 401 |
| Missing/invalid token | `AuthenticationError("Token has expired or is invalid.")` | 401 |
| Expired token | `AuthenticationError("Token has expired or is invalid.")` | 401 |
| User not found (from token) | `AuthenticationError("User not found.")` | 401 |

---

## Configuration Constants

```python
# apps/api/core/config.py (additions)

JWT_SECRET_KEY: str          # required — long random string
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
REFRESH_TOKEN_EXPIRE_DAYS: int = 7
```

---

## Frontend Token Storage

The frontend (`apps/web`) should store tokens in `httpOnly` cookies (not `localStorage`) to prevent XSS attacks. The API client in `lib/api.ts` attaches the access token to every request:

```typescript
// lib/api.ts
const headers = {
  "Authorization": `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};
```

When a 401 is received, the client automatically tries to refresh using the refresh token before redirecting to login.

---

## What This Module Does NOT Do

- Does not store or query vector embeddings
- Does not interact with Qdrant
- Does not generate summaries or quizzes
- Does not parse PDFs
