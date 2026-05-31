# Frontend ↔ Backend Integration Plan

**Goal:** Wire the Next.js frontend to the real FastAPI backend, remove all mocks
and the `USE_MOCKS` toggle, and **build out the backend so every feature in the UI
has a real data source** — then enforce a strict invariant in both directions.

**Status:** ✅ Executed. Backend additions, mock removal, and full page wiring are
complete; frontend builds clean (`tsc` + `next build`), backend imports clean (ruff +
app import + schema/parser checks). See [apps/api/README.md](../apps/api/README.md) and
[apps/web/README.md](../apps/web/README.md) for the resulting architecture.

> **One manual step remains:** run `alembic upgrade head` in `apps/api` to apply the
> `users.major` + `user_activity` migration before starting the updated backend.

---

## 0. The Invariant (the rule this plan enforces)

> **Every backend field must be rendered in the frontend, and every frontend
> element must map to a real backend field. No orphans on either side.**

Approach is now **build, don't trim**: instead of deleting UI we can't back, we add
the backend for it. Only things that are genuinely impossible/out-of-scope (see §6
removals) get removed.

---

## 1. Executive Summary

- **Backend is correct but incomplete for the full UI.** Every endpoint in `API.md`
  works and its schemas match `lib/types.ts`. But the UI shows features with **no
  backend source** (stats, streak, summary formats, profile settings) — we will
  build those.
- **Frontend ignores the API.** `USE_MOCKS` only gates `AuthProvider`. Every dashboard
  page renders hardcoded data + fake `setTimeout` bars and never calls `lib/api.ts`
  (which is complete and correct). Wiring = rewriting pages to call the API + deleting
  mocks.

---

## 2. Confirmed Decisions

| Topic | Decision | Implication |
|---|---|---|
| Study streak | **Dedicated `user_activity` table** | New table + migration; log a row per user action (date-keyed) |
| XP / points | **Remove entirely** | Drop XP from dashboard/profile UI; keep real counts + streak |
| Profile settings | **Name + major only** | `PATCH /auth/me`; **`major` is a NEW `User` column** (see §3.4); theme → localStorage; notifications toggles + help-ticket save **removed** |
| Summary formats | **Current 6** | Bullet Points, Key Concepts, Study Guide, Flashcards, Cheat Sheet, Mind Map — all backed |
| Single doc | **`GET /documents/{doc_id}`** | Small addition |
| Stats | **`GET /stats`** | Real counts + streak |

---

## 3. Backend Build Plan

### 3.1 How summary formats work (answer to "the format depends on what?")

The format is controlled by **three things together**, not the prompt alone — modeled
on your existing `_parse_and_validate_quiz`:

1. **Prompt `OUTPUT FORMAT` block** (swapped per format) — tells Gemini which JSON
   *shape* to produce. The grounding rules in `SYSTEM_PROMPT` stay identical for all
   formats; only this block changes.
2. **JSON-enforced client** — `_primary_client_json` (already configured with
   `response_mime_type: "application/json"` in
   [generator.py](../apps/api/services/generator.py:61)) guarantees parseable JSON.
3. **A Pydantic schema + validator per format** — so a malformed AI response fails
   loudly (like `_parse_and_validate_quiz`) instead of breaking the UI.

So: **format = system-prompt OUTPUT block + response schema + validator.** The AI is
the engine; the prompt is what's swapped; the schema is what makes it safe. The
frontend just sends `format` and renders the structured object it gets back.

**Per-format output shapes:**

| `format` | Returned `structured` shape |
|---|---|
| `bullets` | `string[]` (key takeaways) |
| `key_concepts` | `[{ title, description }]` (accordion) |
| `study_guide` | `{ bullets: string[], concepts: [{title, description}] }` |
| `flashcards` | `[{ front, back }]` |
| `cheat_sheet` | `{ formulas: [{label, value}], definitions: [{term, meaning}] }` |
| `mind_map` | `{ root, branches: [{ label, children: string[] }] }` |

**Schema changes** in [schemas.py](../apps/api/models/schemas.py):
- `SummaryRequest.format: Literal[...] = "bullets"`.
- `SummaryResponse` keeps `summary: str` (plain fallback) **and** adds
  `format: str` + `structured: <union>` so the FE can render the rich view and always
  has a text fallback.

**Generator changes** in [generator.py](../apps/api/services/generator.py):
- `generate_summary(topic, context, format)` selects the OUTPUT block per format and
  returns `(structured_obj, context_sufficient)`.
- Add `_parse_and_validate_summary(text, format)` mirroring the quiz validator.

> Rollout note: land `bullets`/`key_concepts`/`study_guide` (text) first, then the
> visual three (`flashcards`/`cheat_sheet`/`mind_map`). Reduces risk.

### 3.2 `GET /documents/{doc_id}` — single document
Mirror `list_documents` in [documents.py](../apps/api/routers/documents.py): filter by
`id` + `user_id`, 404 via `DocumentNotFoundError`, return existing `DocumentInfo`.
Needed by: document detail, chat/quiz/summary headers.

### 3.3 `GET /stats` — dashboard rings + profile stats
New `routers/stats.py`, registered in [main.py](../apps/api/main.py). New
`StatsResponse` schema:
- `documents_uploaded` = `COUNT(documents WHERE user_id)`
- `quizzes_taken` = `COUNT(quiz_sessions WHERE user_id)`
- `summaries_generated` = `COUNT(chat_history WHERE user_id AND query LIKE 'Summary request:%')`
  *(summaries persist as chat rows with that prefix — [summary.py](../apps/api/routers/summary.py:146))*
- `current_streak` = computed from `user_activity` (§3.4)
- *(optional)* `average_quiz_score`, `chats_count`
- **No XP** (removed per decision).

### 3.4 Schema changes (migration required)
Two changes to [database.py](../apps/api/models/database.py) + one Alembic migration:

1. **`User.major`** — new nullable `String(255)` column. Required because the profile
   "Study Major / Institution" field must persist (decision: name + major). Add to
   `UserResponse` + signup is unaffected (nullable).
2. **`UserActivity`** — new table for streaks:
   ```
   user_activity(id, user_id FK, activity_date DATE, created_at)
   unique(user_id, activity_date)   # one row per user per day
   ```
   Write a row (idempotent upsert) whenever a user uploads, chats, summarizes, or
   submits a quiz. Streak = count of consecutive days up to today.

   *Implementation: a small `record_activity(db, user_id)` helper called from the
   upload/chat/summary/quiz routers. Keep it best-effort (never fail the main action
   if the activity write fails).*

### 3.5 `PATCH /auth/me` — editable profile
New route in [auth.py](../apps/api/routers/auth.py): accept `{full_name?, major?}`,
update the `User` row, return `UserResponse`. Email stays immutable (UI already
disables it). Add `UpdateProfileRequest` schema.

### 3.6 Quiz question cap → 30, config-driven
**Decision: raise the cap to 30, with `MAX_QUIZ_QUESTIONS` as the single source of
truth.** Today the cap is a hardcoded `le=10` literal in
[schemas.py](../apps/api/models/schemas.py:170), and the existing
`MAX_QUIZ_QUESTIONS=10` in [config.py](../apps/api/core/config.py:80) is **dead config
— never referenced**. This refactor fixes that inconsistency.

- **config.py:** `MAX_QUIZ_QUESTIONS: int = 30`.
- **schemas.py:** drop the `le=10` literal; keep `Field(default=5, ge=1)` and add a
  `@field_validator("num_questions")` that raises `ValueError(f"num_questions max is
  {settings.MAX_QUIZ_QUESTIONS}")` when exceeded. *(Pydantic `Field(le=...)` can't read
  a runtime config value, so a validator is the only way to make config authoritative.)*
- **Full surface to update** (every place that currently says/assumes 10):
  - [schemas.py:170](../apps/api/models/schemas.py:170) — the real cap
  - [config.py:80](../apps/api/core/config.py:80) — wire it in (was dead)
  - [types.ts:107](../apps/web/lib/types.ts:107) + quiz UI — FE validation ≤30
  - Docs: [API.md](API.md), [CONFIG.md](CONFIG.md),
    [GENERATION_AGENT.md](agents/GENERATION_AGENT.md), [README.md](../README.md)
    ("max: 10" → "max: 30")
- **Quiz UI:** preset chips (5/10/15/20/30), all ≤30, with a subtle "larger quizzes
  take longer" hint near high counts. Existing 503/422 retry states cover the higher
  failure rate at 30.

### 3.7 CORS
`CORS_ORIGINS=["http://localhost:3000"]` — add the Vercel origin for prod
([config.py](../apps/api/core/config.py:18)).

---

## 4. Frontend Wiring Plan

### 4.1 Mock removal inventory
| File | Mock content | Action |
|---|---|---|
| [lib/config.ts](../apps/web/lib/config.ts) | `USE_MOCKS` | delete export |
| [lib/mocks/](../apps/web/lib/mocks/) | all | delete dir; move `getDocumentTitle`/`formatUploadedAt*` → `lib/format.ts` |
| [AuthProvider.tsx](../apps/web/components/providers/AuthProvider.tsx) | `USE_MOCKS` branches | remove; keep real path |
| [login/page.tsx](../apps/web/app/login/page.tsx) | fake Google login | remove button |
| [dashboard/page.tsx](../apps/web/app/dashboard/page.tsx) | `MOCK_DOCUMENTS`, static rings, fake activity | `documents.list()`, `stats.get()`, `history.*` |
| [documents/page.tsx](../apps/web/app/dashboard/documents/page.tsx) | `MOCK_DOCUMENTS` | `documents.list()` |
| [document/[id]/page.tsx](../apps/web/app/dashboard/document/[id]/page.tsx) | `getMockDocument` | `documents.get(id)` |
| [upload/page.tsx](../apps/web/app/dashboard/upload/page.tsx) | fake upload | `documents.upload(file)` |
| [chat/page.tsx](../apps/web/app/dashboard/chat/page.tsx) | hardcoded convo + setTimeout | `chat.send()` + `history.chatHistory()` |
| [quiz/page.tsx](../apps/web/app/dashboard/quiz/page.tsx) | `MOCK_QUESTIONS`, client scoring | rewrite → `quiz.generate/submit` |
| [summary/page.tsx](../apps/web/app/dashboard/summary/page.tsx) | 6 mock datasets | `summary.generate({format})` → render real `structured` |
| [history/page.tsx](../apps/web/app/dashboard/history/page.tsx) | `initialItems` | merge `chatHistory()` + `quizHistory()` |
| [profile/page.tsx](../apps/web/app/dashboard/profile/page.tsx) | stats/streak/settings | `user` + `stats.get()`; `PATCH /auth/me`; theme localStorage |
| `.env.local`, `.env.example` | `NEXT_PUBLIC_USE_MOCKS` | remove var |

### 4.2 `lib/api.ts` + `types.ts` additions
- `documents.get(docId)` → `DocumentInfo`
- `stats.get()` → `StatsResponse`
- `auth.updateProfile({full_name?, major?})` → `User`
- `summary.generate` gains `format`; `SummaryResponse` gains `format` + `structured`
- `User` type gains `major?: string`

### 4.3 Big rewrites
- **Quiz**: setup (presets ≤30 + "larger quizzes take longer" hint) →
  `quiz.generate()` → play → `quiz.submit()` → real `results` with explanations.
  Handle 422 (bad JSON) / 503 (overloaded) with retry.
- **Summary**: format selector drives `summary.generate({format})`; render each
  `structured` shape from real data; always fall back to `summary` text.
- **Chat**: `chat.send()` + hydrate prior turns from `history.chatHistory({doc_id})`;
  render `sources`; handle `context_sufficient=false`.

---

## 5. Phased Execution

**Phase A — Backend (unblocks FE):**
A1 migration: `User.major` + `user_activity` table.
A2 `GET /documents/{doc_id}`.
A3 `GET /stats` + `record_activity` helper wired into upload/chat/summary/quiz.
A4 `PATCH /auth/me`.
A5 summary formats (text trio first, visual trio second).
A6 `lib/api.ts`/`types.ts` client additions.

**Phase B — Strip mocks:** delete `lib/mocks/`, `USE_MOCKS`, env var, fake Google;
extract formatters to `lib/format.ts`; clean `AuthProvider`.

**Phase C — Wire RAG core:** upload → documents list/detail → chat → quiz (highest
value, real loop).

**Phase D — Wire the rest:** summary (formats) → history (merged) → dashboard +
profile (stats/streak, editable profile).

**Phase E — Polish/prod:** honest loading/empty/error states everywhere; CORS Vercel
origin; full smoke test against a running backend.

---

## 6. Removals (things we are NOT backing — delete from UI)

Per decisions, these have no backend and get removed (not faked):
- **XP badges** on dashboard ("+15 XP") and any XP on profile.
- **Notification toggles** (AI reminders / push / weekly digest) — no backend; remove
  the save action (and the toggles, or mark clearly non-functional).
- **Help & Support ticket submit** — no backend mailer; remove submit (keep FAQs as
  static content, which is fine — it's not data).
- **Theme apply** persists to **localStorage only** (no backend), which is acceptable
  since it's a pure client preference.

Everything else in the UI gets a real backend source.

---

## 7. Integration Risks / Watch-outs
- **30-question quizzes** stress Gemini's token budget and JSON parsing — higher
  422/503 rate; the retry path in `generate_quiz` (primary → stricter retry →
  fallback) already exists, and the UI hint sets expectations.
- **Real RAG latency** (embedding + Gemini + fallback) — replace fake % bars with
  honest pending states.
- **`context_sufficient=false`** must render as a real "not enough context" state
  across chat/summary/quiz, not an error.
- **Quiz 422/503** need a retry affordance.
- **Empty account** (zero docs/history) — every list hits `EmptyState`; rings handle 0.
- **UUID routing** — kill hardcoded slug routes (e.g. history's
  `/dashboard/document/data-structures`).
- **Activity writes best-effort** — never fail the primary action if the streak write
  fails.
- **Migration ordering** — `User.major` + `user_activity` must migrate before the new
  routes deploy.

---

## 8. Open Decisions
*All resolved.* The plan is ready to execute on approval.
