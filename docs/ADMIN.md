# Admin Panel Spec

**Backend files:**
- `apps/api/core/config.py` — `SUPER_ADMIN_EMAIL` setting
- `apps/api/models/database.py` — `User.role` column + `is_admin_or_super` / `effective_is_pro` properties
- `apps/api/services/auth_service.py` — auto super-admin assignment on signup/login
- `apps/api/core/dependencies.py` — `get_current_admin`, `get_current_super_admin`
- `apps/api/core/errors.py` — `ForbiddenError` (403), `ConflictError` (409)
- `apps/api/routers/admin.py` — all admin endpoints
- `apps/api/scripts/promote_admin.py` — CLI to promote/demote admins
- `apps/api/migrations/versions/c3d5e7f9a1b3_add_user_role.py` — adds the `role` column

**Frontend files:**
- `apps/web/lib/types.ts` — admin response/request types
- `apps/web/lib/api.ts` — `api.admin.*` client methods
- `apps/web/components/layout/AdminGuard.tsx` — role gate
- `apps/web/components/shared/AdminToast.tsx` — success/error toast
- `apps/web/components/shared/ConfirmDialog.tsx` — confirmation modal (now tone-aware)
- `apps/web/app/dashboard/admin/` — overview, users, user-detail, and documents pages
- `apps/web/app/dashboard/admin/users/[id]/page.tsx` — per-user usage + audit trail
- `apps/web/app/dashboard/components/DashboardNav.tsx` — conditional Admin nav link

**Role:** Give admins a system overview dashboard and tools to manage users and documents, gated by role on both the server and the UI.

---

## Roles

Three roles live in the `users.role` column (default `"user"`):

| Role | Granted by | Capabilities |
|---|---|---|
| `user` | default | Normal app access only. |
| `admin` | super admin (UI/CLI) | View overview stats, manage users (tier only), manage all documents. Receives Pro token limits. |
| `super_admin` | `SUPER_ADMIN_EMAIL` env, automatically | Everything an admin can do, **plus** changing roles and deleting users. |

### The single super admin

There is exactly **one** super admin — the account whose email equals `SUPER_ADMIN_EMAIL`.

- **On signup:** if the email matches, the account is created with `role = "super_admin"` and `is_pro = True`.
- **On login:** if the email matches but the role drifted (e.g. created before the env was set), it self-heals to `super_admin` on the next login.
- **Immutable:** no API call can change or delete the super admin. The PATCH and DELETE user endpoints reject it with `409 Conflict`.
- **Never assignable:** neither the PATCH endpoint nor the CLI can set a role to `"super_admin"` — only `"user"` or `"admin"`.

Leaving `SUPER_ADMIN_EMAIL` blank disables auto-assignment entirely.

---

## Token tier (`effective_is_pro`)

Admins automatically get the Pro daily token limit (500k) without their `is_pro`
flag being set. This is handled by the `User.effective_is_pro` property
(`is_pro or is_admin_or_super`), which is what the quota-bearing routers read:

```python
@property
def effective_is_pro(self) -> bool:
    """Tier used for token quotas — admins always get pro limits."""
    return self.is_pro or self.is_admin_or_super
```

`chat.py`, `summary.py`, `quiz.py`, `stats.py`, and `usage.py` all pass
`current_user.effective_is_pro` into `reserve_tokens` / `get_usage_summary`.

### Role → tier sync

So the stored `is_pro` column never disagrees with the displayed tier, the
PATCH endpoint **syncs tier to role**: promoting a user to `admin` also sets
`is_pro = True`. Demoting back to `user` leaves `is_pro` untouched (a user who
paid for Pro keeps it). For admins promoted *before* this sync existed (whose
`is_pro` is still stale `False`), the overview's **Pro user count** is computed
as `is_pro OR role in (admin, super_admin)`, so the "Tier breakdown" pie and the
per-user list always agree without a data migration.

---

## Dependencies (route gates)

Both gates wrap `get_current_user` (no extra DB query) and raise `ForbiddenError` (403):

```python
async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin_or_super:
        raise ForbiddenError("Admin access required.")
    return user

async def get_current_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "super_admin":
        raise ForbiddenError("Super admin access required.")
    return user
```

---

## Endpoints

All routes are mounted under the `/admin` prefix. Every route requires at least
an admin; the gate column notes where super admin is required.

| Method | Endpoint | Gate | Description |
|---|---|---|---|
| GET | `/admin/stats/overview` | Admin | All aggregate metrics + 30-day time series |
| GET | `/admin/users` | Admin | Paginated users (search/filter/sort) |
| GET | `/admin/users/{user_id}/usage` | Admin | One user's token usage over a date window |
| GET | `/admin/users/{user_id}/activity` | Admin | One user's audit trail (metadata only) |
| PATCH | `/admin/users/{user_id}` | Admin (tier) / Super (role) | Update `is_pro` and/or `role` |
| DELETE | `/admin/users/{user_id}` | Super | Delete a user + purge their vectors |
| GET | `/admin/documents` | Admin | Paginated documents with owner info |
| DELETE | `/admin/documents/{doc_id}` | Admin | Delete any document + purge vectors |

### Query parameters

- **`/admin/users`:** `search` (email/name, ILIKE), `role`, `major`, `is_pro`,
  `sort_by` (`created_at` | `email` | `full_name` | `role`), `limit` (1–100,
  default 20), `offset`.
- **`/admin/documents`:** `search` (filename/owner name/owner email),
  `sort_by` (`uploaded_at` | `filename` | `chunk_count`), `limit`, `offset`.
- **`/admin/users/{user_id}/usage`:** `start`, `end` (inclusive ISO calendar
  days, UTC-bucketed; default = last 30 days), `request_type`
  (`chat` | `summary` | `quiz`).
- **`/admin/users/{user_id}/activity`:** `action_type`
  (`chat` | `summary` | `quiz`), `limit` (1–100, default 20), `offset`.

### Per-user usage (`GET /admin/users/{user_id}/usage`)

Returns `AdminUserUsageResponse`: window totals (total / input / output tokens,
request count), `tokens_by_type`, `tokens_by_model`, and a per-day `daily_tokens`
trend split by type (sparse — the frontend zero-fills gaps). All figures are
summed from the append-only `token_usage` log (not the live quota counter), so
historical numbers are stable. The window is bucketed in UTC to match
`/admin/stats/overview`.

### Per-user audit trail (`GET /admin/users/{user_id}/activity`)

Returns `AdminUserActivityResponse`: a paginated, time-ordered feed merging the
user's chat, summary, and quiz rows (unioned in SQL, paginated as one timeline).
Each `AdminActivityItem` carries **metadata only** — action type, timestamp,
document id/filename, performance mode, quiz score, and an **80-character
truncated preview** of the query (chat) or topic (summary/quiz).

> **Privacy by design.** This endpoint deliberately **never** returns full
> question text or model answer bodies. An admin can audit *what kind* of
> activity a user performed and its token cost — for abuse/cost monitoring —
> without reading a student's private study content. If full-content access is
> ever needed, it should be gated behind super admin, logged with a reason, and
> disclosed in the privacy policy (see `docs/`/the privacy page). The truncated
> preview is the maximum content exposure currently permitted.

### Status codes

| Code | Meaning |
|---|---|
| `400` | Invalid query/body (e.g. `limit > 100`) |
| `403` | Caller lacks the required role, or attempt to set role to `super_admin` |
| `404` | User/document not found |
| `409` | Attempt to modify or delete the protected super admin |
| `500` | Unexpected error (logged, never leaks a stack trace) |

### PATCH guards

- The target's role is checked first — a `super_admin` target → `409`.
- A `role` change requires the caller to be super admin → else `403`.
- `role` must be `"user"` or `"admin"` → else `403`.
- Promoting to `"admin"` also sets `is_pro = True` (tier follows role); demoting
  to `"user"` leaves `is_pro` as-is.
- `is_pro` requires only admin. An explicit `is_pro` in the same request is
  applied last, so it overrides the role-driven default if both are supplied.

### Deletion & vector purge

User and document deletion mirror the single-document delete path
(`documents.py`): Qdrant vectors are purged via `vector_store.delete_by_doc_id`,
then the PostgreSQL row is deleted (CASCADE removes documents, chat, quizzes,
etc.). Vector-purge failures are logged but non-fatal.

---

## Overview metrics

`GET /admin/stats/overview` returns `AdminOverviewResponse`. All values are
derived live from the database; nothing is precomputed.

User counts, role/major breakdowns, active-user windows (today / 7d / 30d),
content counts (documents, chunks, chats, summaries, quizzes), average quiz
score, token totals, and four 30-day time series (signups, documents, daily
active users, tokens by type) plus a top-10 uploaders leaderboard.

> **Token caveat:** `tokens_today_logged` (summed from the `token_usage` log) and
> `tokens_today_counter` (the authoritative `daily_token_usage` reserved counter)
> measure different things and will not always match — the counter can read
> slightly higher due to reservation/reconciliation drift. Both are surfaced
> intentionally; do not treat them as equal.

---

## CLI: promote / demote

```bash
cd apps/api
python scripts/promote_admin.py <email>            # promote to admin
python scripts/promote_admin.py <email> --demote   # demote back to user
```

Refuses to touch the `SUPER_ADMIN_EMAIL` account and never assigns
`"super_admin"`.

---

## Frontend

### Navigation & guard

- `DashboardNav` inserts an **Admin** link (Shield icon) between History and
  Profile, rendered only when `user.role` is `admin` or `super_admin`. The same
  conditional drives both the desktop sidebar and the mobile bottom bar.
- `AdminGuard` (in the `admin/layout.tsx`) redirects non-admins to `/dashboard`.
  This is UX only — the backend independently enforces every gate.

### Pages

- **`/dashboard/admin`** — overview: responsive stat grid (2-col mobile → 4-col
  desktop), Recharts area chart (signups & DAU), stacked bar chart (tokens by
  type), tier pie chart, users-by-major list, and the top-uploaders leaderboard.
- **`/dashboard/admin/users`** — search + role/tier filter chips; stacked cards on
  mobile, table on desktop; pagination with a result range. Actions run through
  confirmation modals. Each user's name links to their detail page.
- **`/dashboard/admin/users/[id]`** — per-user detail: token-usage stat tiles, a
  7d/30d/90d window selector, a stacked daily token chart, a tokens-by-model
  breakdown, and the metadata-only audit timeline (filterable by action type,
  paginated). No full query/answer content is shown.
- **`/dashboard/admin/documents`** — filename/owner search; cards on mobile, table
  on desktop; delete via confirmation modal; pagination.

### Modal-first actions

Every state-changing action (toggle Pro, change role, delete user, delete
document) opens a `ConfirmDialog` showing full context **before** any API call.
`ConfirmDialog` takes a `tone`:

- `"danger"` (default) — red, for deletions.
- `"neutral"` — gold, for non-destructive changes (tier/role).

The super admin's own row shows a "Protected" shield badge with no action
buttons; role-change and delete buttons are disabled for non-super admins.

### Toasts

`AdminToast` (extracted from the profile-page pattern) shows a `success` (gold)
or `error` (red) pill with `role="status"`, auto-dismissing after 3s. Every
action reports success and failure through it.

### Charts & theming

Charts read the live theme colors from CSS custom properties via the
`useChartPalette` hook, so they re-theme with the rest of the app instead of
hard-coding hex values.

---

## Setup

1. Set `SUPER_ADMIN_EMAIL` in `apps/api/.env`.
2. Apply the migration: `cd apps/api && alembic upgrade head`.
3. Register (or log in) with that email — it becomes the super admin automatically.
4. Promote additional admins from the Users page (super admin only) or via the CLI.
