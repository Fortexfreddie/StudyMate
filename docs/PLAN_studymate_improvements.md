# StudyMate Improvements — Phased Plan

Tracking doc for the batch requested 2026-06-14. Each phase is independently
testable; we verify before moving on. Check items off as they land.

Legend: ✅ uses existing data · 🟡 needs a DB migration / new instrumentation · 🔒 privacy-sensitive

---

## Phase 1 — `<br>` rendering fix (summary + chat tables) ✅ DONE (2026-06-14)
**Problem:** Literal `<br>` shows inside tabular-summary table cells (see screenshot).
**Root cause:** `react-markdown` ignores raw HTML by default (no `rehype-raw`), and the
`_TABULAR_INSTRUCTIONS` prompt tells the model to use `<br>` inside cells.

**Approach (chosen: belt-and-suspenders, no raw-HTML/XSS surface):**
1. Backend prompt — stop instructing `<br>`. In `services/generator.py`
   `_TABULAR_INSTRUCTIONS`, replace the "use `<br>` inside a cell" guidance with
   "keep cells concise; use short clauses separated by '; ', or split into more rows."
2. Frontend render — defensively convert any stray `<br>` / `<br/>` to real newlines
   before rendering, scoped to our markdown components (in `SourceReferences.tsx`,
   pre-process the `text` prop of `RichMarkdown` / `InlineMarkdown`). Do **not** add
   `rehype-raw` (avoids opening LLM output to arbitrary HTML injection).

**Files:** `apps/api/services/generator.py`, `apps/web/components/shared/SourceReferences.tsx`
**Test:** Regenerate a tabular summary with multi-point cells → cells wrap on real lines,
no literal `<br>`. Old summaries already in history also render clean (frontend handles it).

---

## Phase 2 — Tutor "smart examples" ✅ DONE (2026-06-14)
**Goal:** Chat + summary should add worked examples **when they aid understanding**, not
always and not never. Keep current grounded behaviour; add judgement.

**Approach (prompt-only):** Add a short rule to the chat `generate_answer` system
instruction and the summary instructions:
> "When a concept is abstract, procedural, or commonly misunderstood, include a brief
> concrete example or analogy **grounded in the document context** to aid understanding.
> Use examples judiciously — skip them for simple/self-evident points. Never invent
> facts for an example; if the context has no basis for one, explain plainly instead."

**Files:** `apps/api/services/generator.py` (SYSTEM_PROMPT or per-method instruction).
**Test:** Ask chat about an abstract concept → gets an example; ask a trivial factual
question → no forced example. Summaries show examples only where useful.

---

## Phase 3 — Admin: richer stats from EXISTING data ✅ DONE (2026-06-14)
No migrations. Extend current endpoints/schemas; wire into the admin UI.

**Shipped:** new `GET /admin/users/{id}/profile` (signup, last_active, last_login
placeholder, lifetime counts of docs/chunks/chats/summaries/quizzes, avg quiz score,
summary-format breakdown, performance-mode breakdown, tokens-by-model, lifetime tokens);
`last_active` added to the user list (table col + mobile card); `summary_format` added to
the activity timeline (schema, SQL union, badge). User rows were already clickable. Top
uploaders already capped at 10. Frontend: profile panel (count tiles + Account meta +
breakdowns) on the user detail page, format badge in the activity log.

### 3a. User list (`GET /admin/users`)
- Already returns `document_count`, `created_at`. **Add:** `last_active` (max
  `UserActivity.activity_date` per user, via subquery join like the existing doc_count).
- Frontend: make each row clickable → user detail page (route already exists:
  `app/dashboard/admin/users/[id]/page.tsx`).
- Confirm pagination is enforced (it is: `limit`/`offset`, `_MAX_PAGE`). Top-uploaders
  list (overview) — verify it's capped; if it returns all, cap to top N.

### 3b. User detail (`GET /admin/users/{id}/usage` + a small new summary block)
Surface, per user (🔒 metadata only — no message/answer/summary bodies):
- signup date (`created_at`), last active, tier, role, major
- total documents, total chats, total summaries, total quizzes (counts)
- **summary types used** (group `SummaryHistory.format`)
- **perf modes used** (group `TokenUsage.performance_mode`)
- **tokens by model** (already in `tokens_by_model`) — label which is primary/fallback
- avg quiz score / quizzes taken (from `Quiz` + answers)

### 3c. Recent activity timeline (`GET /admin/users/{id}/activity`)
- Already a privacy-conscious interleaved feed (chat/summary/quiz metadata + 80-char
  preview). **Add** the summary `format` to summary rows so the timeline shows
  "generated a *cheat_sheet* summary of …". Keep previews truncated.

**Files:** `apps/api/routers/admin.py`, `apps/api/models/schemas.py`,
`apps/web/app/dashboard/admin/{users/page.tsx, users/[id]/page.tsx, page.tsx}`
**Test:** Open admin → users list shows last-active + is clickable → detail page shows
counts, summary types, perf modes, models; timeline shows summary format. No private
content is exposed.

---

## Phase 4 — Admin: stats that NEED a migration ✅ DONE (2026-06-14: all three)

**Migration:** `d4e6f8a0b2c4_add_login_and_generation_metrics` (down_revision
`c3d5e7f9a1b3`). Adds 4 nullable columns; applied to local DB.

| Want | Shipped |
|---|---|
| **Last login** | `User.last_login_at`; stamped in `AuthService.login`; shown on admin profile (falls back to "Not tracked yet" until the user logs in again). |
| **Time-to-generate + chunks** | `TokenUsage.generation_ms` + `chunks_used`; timed around the generator call in chat/summary/quiz routers and passed through `record_token_usage`; admin profile shows per-type avg generation time + avg chunks. |
| **Cache stats** | Investigated: langchain `usage_metadata.input_token_details.cache_read` IS exposed. Captured as `TokenUsage.cached_tokens` in the generator; admin profile shows lifetime cached-token total. Note: StudyMate doesn't configure explicit context caching, so this is often 0 (implicit caching only). |

**DEPLOY NOTE:** handled automatically — Render's start command is
`alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`, so the migration
runs on deploy before the server boots. Local DB already migrated. Just deploy.

**Tested:** migration applied; all 4 columns confirmed via inspector; `/profile`
endpoint returns the new fields (empty/None for users predating instrumentation —
correct). New values populate as users log in and generate.

---

## Phase 5 — Profile tooltip overlap (mobile) ✅ DONE (2026-06-14)
**Problem:** The Performance Level info tooltip renders above/behind the bottom app bar
(see 2nd screenshot) and gets clipped.
**Approach:** In the performance-level selector component, fix the tooltip
positioning/z-index/overflow so it opens within the viewport (e.g. position below the
trigger or raise z-index above the app bar and allow overflow). Find the component under
`app/dashboard/.../profile` or a shared tooltip.
**Test:** On a narrow viewport, open the tooltip → fully visible, not clipped by the app bar.

---

## Suggested order & checkpoints
1. **Phase 1** (br) — quick visual win, test in summary page.
2. **Phase 2** (examples) — prompt tweak, test chat + summary.
3. **Phase 5** (tooltip) — small, isolated UI fix.
4. **Phase 3** (admin, no migration) — the bulk; test admin pages.
5. **Phase 4** (admin migrations) — only the items you greenlight.

Privacy stance held throughout: admin sees **counts, types, timings, dates, models** —
never the student's actual questions, answers, or summary bodies (existing 80-char
preview is the only text, and it stays).
