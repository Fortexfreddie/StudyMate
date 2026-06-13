# StudyMate Web (Frontend)

Next.js 16 frontend for StudyMate. Every screen reads and writes **live data** through
the FastAPI backend — there is no mock layer.

- **Framework:** Next.js 16 (App Router, Turbopack, React Compiler)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 (CSS-native config, design tokens)
- **Auth:** JWT in `localStorage`, attached as `Bearer` by the API client
- **State:** React `useState`/`useContext` + a small `useApi` fetch hook (no external store)

---

## Table of Contents
1. [Setup](#setup)
2. [Folder Layout](#folder-layout)
3. [Data Flow](#data-flow)
4. [The API Client (`lib/api.ts`)](#the-api-client-libapits)
5. [Auth & Protected Routes](#auth--protected-routes)
6. [The `useApi` Hook](#the-useapi-hook)
7. [Page-by-Page Wiring](#page-by-page-wiring)
8. [Loading / Empty / Error States](#loading--empty--error-states)
9. [What Was Removed (and why)](#what-was-removed-and-why)
10. [Conventions](#conventions)

---

## Setup

The frontend requires the backend running (see [../api/README.md](../api/README.md)).

```bash
cd apps/web
npm install
copy .env.example .env.local      # Windows  (cp on *nix)
npm run dev                       # http://localhost:3000
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Dev/start server port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

Build for production: `npm run build` → `npm run start`.

---

## Folder Layout

```
apps/web/
├── app/
│   ├── layout.tsx                 # Root layout (wraps AuthProvider)
│   ├── page.tsx                   # Landing
│   ├── login/ , signup/           # Auth pages (real /auth/* calls)
│   └── dashboard/
│       ├── layout.tsx             # ProtectedRoute + DashboardNav
│       ├── page.tsx               # Home: rings (stats), recent docs, streak CTA
│       ├── upload/                # documents.upload (multipart)
│       ├── documents/             # documents.list
│       ├── document/[id]/         # documents.get + delete
│       ├── chat/                  # chat.send + chat history
│       ├── quiz/                  # quiz.generate → submit (server-graded)
│       ├── summary/               # summary.generate (6 formats) + structured render
│       ├── history/               # merged chat + quiz history timeline
│       ├── profile/               # /auth/me, PATCH /auth/me, /stats, theme(localStorage)
│       ├── admin/                 # admin-only (AdminGuard): overview, users, documents
│       │   ├── layout.tsx         # wraps children in AdminGuard
│       │   ├── page.tsx           # overview: stat grid + Recharts (area/bar/pie)
│       │   ├── users/             # admin.listUsers + updateUser/deleteUser (modals)
│       │   ├── documents/         # admin.listDocuments + deleteDocument (modal)
│       │   └── components/        # AdminTabs, Badges, adminHelpers (chart palette)
│       └── components/            # DocumentCard, ProgressRing, …
├── components/
│   ├── providers/AuthProvider.tsx # Auth context (login/signup/logout/updateUser)
│   ├── layout/ProtectedRoute.tsx  # Redirects to /login when unauthenticated
│   ├── layout/AdminGuard.tsx      # Redirects non-admins out of /dashboard/admin
│   ├── dashboard/                 # PageHeader, GeneratingState
│   └── shared/                    # Button, Input, LoadingState, ConfirmDialog, AdminToast, …
└── lib/
    ├── api.ts                     # Typed API client + token mgmt (the ONLY fetch layer)
    ├── types.ts                   # Shared types — mirror backend schemas exactly
    ├── useApi.ts                  # Tiny GET hook: { data, isLoading, error, refetch }
    ├── format.ts                  # Pure formatters (titles, dates, doc colors)
    ├── user.ts                    # getFirstName / getInitials
    └── validation.ts              # Email/password validators
```

---

## Data Flow

```
Component
  → calls api.<group>.<method>()        (lib/api.ts — the only place fetch() runs)
      → request() attaches Bearer token, JSON/FormData headers
      → on 401: tries /auth/refresh once, retries, else clears tokens + throws
      → throws ApiClientError(status, detail) on non-2xx
  → component shows data / LoadingState / EmptyState / ErrorState
```

Rules (from CONVENTIONS.md):
- **No raw `fetch()` in components** — everything goes through `lib/api.ts`.
- **Types mirror the backend** — `lib/types.ts` matches `models/schemas.py` field for
  field, so the contract is checked at compile time.

---

## The API Client (`lib/api.ts`)

A single typed client grouped by feature. Token helpers (`getAccessToken`,
`setTokens`, `clearTokens`) read/write `localStorage`. The internal `request<T>()`:

- prefixes `NEXT_PUBLIC_API_URL`,
- adds `Authorization: Bearer <token>` when present,
- sets `Content-Type: application/json` (skips it for `FormData` uploads),
- on **401**, attempts a one-time refresh via `/auth/refresh` and retries,
- throws `ApiClientError(status, detail)` carrying the backend's `detail` message.

```ts
api.auth.signup(data)            api.documents.upload(file)     api.quiz.generate(data)
api.auth.login(data)             api.documents.list()           api.quiz.submit(id, data)
api.auth.refresh(token)          api.documents.get(docId)       api.history.chatHistory(p)
api.auth.me()                    api.documents.remove(docId)    api.history.quizHistory(p)
api.auth.updateProfile(data)     api.chat.send(data)            api.history.quizDetail(id)
api.stats.get()                  api.summary.generate(data)     api.admin.overview()
api.usage.get()                  api.admin.listUsers(p)         api.admin.updateUser(id, d)
api.admin.deleteUser(id)         api.admin.listDocuments(p)     api.admin.deleteDocument(id)
```

Example:
```ts
import { api, ApiClientError } from "@/lib/api";

try {
  const res = await api.quiz.generate({ topic, doc_id: docId, num_questions: 10 });
  // res.session_id, res.questions, res.sources …
} catch (err) {
  const message = err instanceof ApiClientError ? err.detail : "Something went wrong.";
}
```

---

## Auth & Protected Routes

- **`AuthProvider`** (`components/providers/AuthProvider.tsx`) holds `user` + auth
  actions. On mount it hydrates from `/auth/me` if a token exists. Exposes
  `login`, `signup`, `logout`, and `updateUser` (used after `PATCH /auth/me`).
- **`ProtectedRoute`** wraps the dashboard layout and redirects to `/login` when not
  authenticated (after the initial loading check).
- **Login/Signup** call the real `/auth/*` endpoints, store tokens, then route to
  `/dashboard`. (The old fake "Continue with Google" button was removed — there is no
  OAuth backend.)

---

## The `useApi` Hook

`lib/useApi.ts` is a minimal hook for GET-style reads:

```ts
const { data, isLoading, error, refetch } = useApi(() => api.documents.list(), []);
```

It runs the fetcher on mount (and when `deps` change), exposes loading/error state,
surfaces the backend's `detail` on failure, and provides `refetch` for retry buttons.
Mutations (upload, chat send, quiz submit, profile save) are called directly with
local `isLoading`/`error` state in the component.

---

## Page-by-Page Wiring

| Page | Reads | Writes | Notes |
|---|---|---|---|
| **Login / Signup** | — | `auth.login` / `auth.signup` | stores tokens, redirects to dashboard |
| **Dashboard home** | `documents.list`, `stats.get` | — | rings show real counts; streak CTA from stats |
| **Upload** | — | `documents.upload` | client-side PDF + 20MB check; redirects to the new doc; honest "processing" state |
| **Documents** | `documents.list` | — | loading/empty/error states; cards link to detail |
| **Document detail** | `documents.get` | `documents.remove` | actions to quiz/summary/chat; confirm-to-delete danger zone |
| **Chat** | `documents.get`, `history.chatHistory` | `chat.send` | renders `sources` + a "limited context" notice on `context_sufficient:false`; inline `Source #N` citations in the answer are clickable and scroll to / highlight the matching source card |
| **Quiz** | — | `quiz.generate` → `quiz.submit` | presets 5/10/15/20/30 (cap 30) with a "larger quizzes take longer" hint; **server-graded**; per-question review with explanations |
| **Summary** | `documents.get` | `summary.generate` | 6 format selector; renders each `structured` shape, falls back to plain text; supports full-document sequential overview summaries (bypassing similarity search); renders `sources` cards with clickable inline `Source #N` citations |
| **History** | `history.chatHistory`, `history.quizHistory` | — | merges chat/summary/quiz into one sortable, filterable, searchable timeline |
| **Profile** | `auth` (context), `stats.get`, `usage.get` | `auth.updateProfile` | name + major persist server-side; stats + streak real; daily token usage telemetry card; theme + performance saved to `localStorage` |
| **Admin · Overview** | `admin.overview` | — | admin-only; stat grid + Recharts (signups/DAU area, tokens-by-type bar, tier pie); colors read from CSS theme vars |
| **Admin · Users** | `admin.listUsers` | `admin.updateUser`, `admin.deleteUser` | search + role/tier filters; mobile cards / desktop table; tier/role/delete via `ConfirmDialog` + `AdminToast`; super-admin row protected; role + delete are super-admin only |
| **Admin · Documents** | `admin.listDocuments` | `admin.deleteDocument` | search by filename/owner; cards / table; delete via confirm modal |

### Example flow — Quiz (the most involved)

```
setup  → user picks topic (optional) + count (≤30)
       → api.quiz.generate({ topic, doc_id, num_questions })
generating → indeterminate GeneratingState (real RAG call, no fake %)
quiz   → render questions[].options; user selects per question
       → last question OR "Submit Now" → api.quiz.submit(session_id, { answers })
results → server returns score + results[]; show trophy, stats, and a
          per-question review with the correct option + explanation
```

### Example flow — Summary formats

```
setup  → pick a format (bullets | key_concepts | study_guide | flashcards | cheat_sheet | mind_map)
       → api.summary.generate({ topic, doc_id, format, full_document })
completed → StructuredSummary switches on res.format and renders res.structured
            (Flashcards flip, Mind Map branches, Cheat Sheet tables, …);
            if structured is null it shows res.summary (plain text).
            res.sources render as cards below; inline "Source #N" mentions
            link to them.
```

### Source citations (chat + summary)

The model cites retrieved chunks inline as `Source #N`, where `N` is the 1-based
index into the response's `sources` array. `components/shared/SourceReferences.tsx`
(`linkifySources` + `SourceCard`) turns each mention into a chip that, via the
`lib/useSourceCite.ts` hook, scrolls to and briefly highlights the matching card.
Mentions whose `N` exceeds the returned source count are left as plain text.

---

## Loading / Empty / Error States

Reusable components in `components/shared/`:

- **`LoadingState`** — spinner + label (lists, detail fetches).
- **`EmptyState`** — icon + title + description + optional action (no documents, no
  history, no search matches).
- **`ErrorState`** — alert + message + optional `onRetry` (wired to `useApi.refetch`).
- **`GeneratingState`** — used during real RAG calls; pass **no** `progress` for an
  indeterminate bar (we don't fake a percentage we can't measure).

`context_sufficient: false` from chat/summary is rendered as a clear "limited
context" notice — it's a valid state, not an error.

---

## What Was Removed (and why)

| Removed | Reason |
|---|---|
| `lib/mocks/` + `NEXT_PUBLIC_USE_MOCKS` + `lib/config.ts` | UI now uses live data only |
| Fake "Continue with Google" (login & signup) | no OAuth backend |
| XP badges (dashboard "+15 XP", profile) | no XP concept in the data model |
| Notification toggles **save** + Help ticket **submit** | no settings/mailer backend (FAQs kept as static content) |

Theme selection (including custom aesthetic themes like "Forest Night" and "Rosé Pine") persists to **localStorage** (a pure client preference — no backend
needed).

---

## Performance & Token Budget System

The web app integrates the newly introduced backend performance-tier system:
1. **Header Injection:** The API client automatically reads the current performance level from `localStorage` and injects it as `X-Performance-Mode` on every outgoing RAG request (`/chat`, `/summary`, `/quiz`).
2. **Dedicated Settings Screen:** A new "Performance Level" page inside the profile allows users to pick between `Low`, `Medium`, `High`, `Very High`, and `Max` tiers with custom micro-copy details and toasts.
3. **TelemetryProgressCard:** Renders real-time, daily token usage progress indicator relative to the student's account limit (Free vs. Pro). If the limit is reached, users see warnings and recommendations.

---

## Conventions

- Named exports, typed props, no `any` (use `unknown` + narrow).
- One component per file; group by feature.
- All API calls through `lib/api.ts`; all shared types in `lib/types.ts`.
- Tailwind design tokens (e.g. `bg-card-bg`, `text-text-muted`, `text-brand-primary`)
  — no hardcoded hex except the derived per-document accent palette in `lib/format.ts`.
- File references use clickable markdown links per the repo's house style.
