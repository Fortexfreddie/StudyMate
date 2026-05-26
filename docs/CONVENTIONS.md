# Code Conventions & Standards

> These rules apply to every file in this project. No exceptions.

---

## Runtime Requirements

| Tool | Minimum Version |
|---|---|
| Python | 3.11+ |
| Node.js | 20.9+ (LTS) |
| TypeScript | 5.1+ |

---

## General

- **English only** — all variable names, comments, commits, and docs
- **No commented-out code** in commits — delete it or use a branch
- **No `console.log` / `print` in production code** — use proper logging (Python: `logging` stdlib, frontend: remove before commit)
- **Every function must do one thing** — if you're writing `and` in a function name, split it
- **No magic numbers** — extract to named constants or config
- **Fail loudly** — never silently swallow exceptions
- **Pin dependencies** — `requirements.txt` with exact versions, `package-lock.json` committed

---

## Python (Backend — FastAPI)

### Style
- Follows **PEP 8** strictly
- **Ruff** for both linting and formatting (line length: 88)
- **isort** via Ruff for import ordering
- **Type hints on every function signature** — no bare `def func(x):`

### Naming
| Thing | Convention | Example |
|---|---|---|
| Variables | `snake_case` | `chunk_size` |
| Functions | `snake_case` | `extract_text_from_pdf()` |
| Classes | `PascalCase` | `DocumentProcessor` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_CHUNK_SIZE = 500` |
| Pydantic models | `PascalCase` | `UploadResponse` |
| Dataclasses | `PascalCase` | `DocumentChunk` |
| Files/modules | `snake_case` | `pdf_processor.py` |

### Data Modeling
- **API request/response models** → Pydantic `BaseModel` in `models/schemas.py`
- **Internal data objects** → `@dataclass` (simpler, less overhead)
- Never return raw dicts from route handlers — always return typed Pydantic models

### Structure Rules
```python
# ✅ Good — typed, single-purpose, descriptive
async def embed_text_chunk(chunk: str) -> list[float]:
    """Convert a text chunk to a vector embedding via Google API."""
    ...

# ❌ Bad — no types, vague name, does multiple things
def process(x):
    ...
```

### FastAPI Specifics
- All route handlers in `routers/` — never in `main.py`
- All business logic in `services/` — never in routers
- All Pydantic schemas in `models/schemas.py`
- Use `Depends()` for all shared resources (DB clients, config)
- Always return typed Pydantic response models — never raw dicts

### Error Handling
```python
# ✅ Raise HTTPException with clear messages
raise HTTPException(
    status_code=400,
    detail="PDF could not be parsed. Ensure the file is not scanned/image-only."
)

# ✅ Use custom exception classes from core/errors.py
raise ServiceUnavailableError("Generation service unavailable. Try again.")

# ❌ Never bare except
try:
    ...
except:
    pass
```

### Environment Variables
- All env vars loaded through `core/config.py` using `pydantic-settings`
- Never call `os.getenv()` directly in service files
- All secrets in `.env` — `.env` is always in `.gitignore`
- Provide `.env.example` with placeholder values

### Logging
- Use Python's `logging` stdlib
- One logger per module: `logger = logging.getLogger(__name__)`
- Log at appropriate levels: `DEBUG` for pipeline details, `INFO` for operations, `WARNING` for recoverable issues, `ERROR` for failures
- The RAG pipeline must be observable — each stage logs what it does

---

## TypeScript (Frontend — Next.js 16)

### Style
- **ESLint + Prettier** enforced
- `strict: true` in `tsconfig.json`
- No `any` type — use `unknown` and narrow, or define a proper interface

### Naming
| Thing | Convention | Example |
|---|---|---|
| Variables | `camelCase` | `chunkSize` |
| Functions | `camelCase` | `generateQuiz()` |
| Components | `PascalCase` | `QuizCard.tsx` |
| Types/Interfaces | `PascalCase` | `QuizQuestion` |
| Constants | `UPPER_SNAKE_CASE` | `API_BASE_URL` |
| Files (components) | `PascalCase` | `UploadDropzone.tsx` |
| Files (utils/hooks) | `camelCase` | `useDocumentStore.ts` |

### Next.js 16 Specifics
- **Async params required** — all `Page`, `Layout`, and `Route Handler` components that read `params` or `searchParams` must `await` them
- **React Compiler is stable** — do not use manual `useMemo` or `useCallback` unless profiling shows a specific need; the compiler handles memoization automatically
- **Turbopack is default** — no webpack configuration needed
- **`proxy.ts`** replaces `middleware.ts` for network-boundary proxy logic

### Component Rules
```tsx
// ✅ Named export, typed props, no inline styles
interface QuizCardProps {
  question: QuizQuestion;
  onAnswer: (optionIndex: number) => void;
}

export function QuizCard({ question, onAnswer }: QuizCardProps) {
  ...
}

// ❌ Default export with untyped props and inline styles
export default function Card(props) {
  return <div style={{ color: 'red' }}>...</div>
}
```

### API Layer
- All backend calls go through `lib/api.ts` — never `fetch()` raw in components
- All API functions are `async` and return typed responses
- All errors are caught and surfaced via a consistent error state pattern

### State
- Prefer React's built-in `useState` / `useReducer` for local state
- For cross-component state use React Context — no external state library unless clearly justified
- No state in server components

---

## File & Folder Rules

- One component per file
- Group by **feature** inside `components/` (e.g., `components/upload/`, `components/quiz/`)
- `lib/` — pure utility functions and API client only
- `types.ts` — shared TypeScript interfaces used across multiple components

---

## Git Conventions

### Commit Message Format
```
<type>(<scope>): <short description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`

Examples:
```
feat(api): add PDF upload endpoint with chunking
fix(retriever): handle empty query string edge case
docs(agents): add GENERATION_AGENT.md
refactor(generator): extract prompt templates to constants
```

### Branch Strategy
```
main          → production-ready only
dev           → active development, merged into main via PR
feat/<name>   → feature branches, merged into dev
fix/<name>    → bug fix branches
```

---

## What "Clean" Means Here

1. **Every module has one clear responsibility**
2. **No file exceeds ~200 lines** — split it if it does
3. **No business logic in route handlers or React components**
4. **All prompts are constants** — not inline strings scattered in code
5. **The RAG pipeline is observable** — each stage logs what it does
6. **Errors tell the user something useful** — not "Internal Server Error"
