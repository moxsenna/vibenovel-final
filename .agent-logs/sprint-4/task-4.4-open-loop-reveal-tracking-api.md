# Task 4.4 — Open Loop & Planned Reveal Tracking API

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat API CRUD untuk `open_loops` dan `planned_reveals` dalam outline planner — list/create/update/soft-delete dengan auth, ownership guard, locked plan guard, dan `planningTruth` redaction. Tanpa web integration, outline lock workflow API, writer context, AI, atau prose writer.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `apps/api/src/services/outline.ts`, `chapter-outline.ts`, `project.ts`
- `apps/api/src/lib/mappers.ts`, `middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-4/task-4.3-chapter-outline-crud-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/outline-tracking.ts` | Created — open loop + planned reveal CRUD, validation, locked guard |
| `apps/api/src/routes/outline.ts` | Updated — 8 tracking endpoints |
| `apps/api/README.md` | Updated — Task 4.4 docs, redaction policy, locked guard |
| `.agent-logs/sprint-4/task-4.4-open-loop-reveal-tracking-api.md` | Created (log ini) |

**Tidak diubah:** migration, seed, shared types, mappers (sudah ada `mapPlannedRevealPublic`), web UI, outline lock API (Task 4.5), smoke:api script.

## Commands run

| Command | Result |
|---|---|
| `git commit -m "feat: add chapter outline crud api"` | PASS (Task 4.3) |
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Task 4.4 runtime verification (local) | PASS — 16/16 |

**Tidak dijalankan:** `supabase db reset` (no schema change), remote deploy/migration push.

## Results

### Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/projects/:id/outline/open-loops` | JWT | `{ openLoops: [] }` if no plan; `?status=` filter |
| POST | `/api/projects/:id/outline/open-loops` | JWT | Create; `question` required; 201 |
| PATCH | `/api/projects/:id/outline/open-loops/:loopId` | JWT | Update allowed fields |
| DELETE | `/api/projects/:id/outline/open-loops/:loopId` | JWT | Soft drop (`status=dropped`) |
| GET | `/api/projects/:id/outline/reveals` | JWT | `{ reveals, planningTruthRedacted: true }`; `?status=`, `?riskLevel=` |
| POST | `/api/projects/:id/outline/reveals` | JWT | Create; `title` + `planningTruth` required; response redacted; 201 |
| PATCH | `/api/projects/:id/outline/reveals/:revealId` | JWT | Update; response redacted |
| DELETE | `/api/projects/:id/outline/reveals/:revealId` | JWT | Soft cancel (`status=cancelled`) |

### planningTruth redaction

- GET list: `mapPlannedRevealPublic` per item + top-level `planningTruthRedacted: true`
- POST/PATCH/DELETE responses: redacted via `mapPlannedRevealPublic`
- No `includeTruth` query param (Task 4.4 preference)
- `planningTruth` accepted on POST/PATCH body only (planner input)

### Locked plan guard

- `outline_plans.status=locked` → POST/PATCH/DELETE return `409` with `details.missing: ["outline_unlocked"]`
- GET allowed when locked

### Canon guardrails

- No mutation of `facts`, `characters`, `speech_rules`, `story_foundations`, `ai_proposals`
- No prose fields in metadata/body
- Chapter/fact/proposal refs validated against same project + outline plan

### Runtime verification (16/16 PASS)

Flow: signup → bootstrap (concepts → lock foundation → generate outline) → tracking CRUD tests.

1. GET open-loops no token → 401
2. GET reveals no token → 401
3. Bootstrap generate → 3 loops, 3 reveals
4. GET open-loops → 3
5. POST open-loop → 201
6. PATCH status paid_off → 200
7. GET reveals → 3, no `planningTruth`, `planningTruthRedacted=true`
8. POST reveal → 201, redacted
9. PATCH reveal → 200, redacted
10. Invalid chapter ref → 404
11. DELETE open-loop → dropped
12. DELETE reveal → cancelled
13. Canon counts unchanged
14. POST when plan locked (db) → 409
15. GET when locked → 200
16. Cross-user → 404

## Decisions

1. **Single service `outline-tracking.ts`** — open loops + planned reveals share plan/ref validation; avoids duplicating `chapter-outline.ts` helpers.
2. **Routes stay in `outline.ts`** — prefix `/outline/open-loops` dan `/outline/reveals` konsisten dengan Task 4.2–4.3.
3. **Reuse `mapPlannedRevealPublic`** — mapper sudah ada dari Task 4.2; tidak perlu mapper baru.
4. **Soft delete only** — open loop `dropped`, reveal `cancelled`; no hard DELETE.
5. **No `includeTruth`** — planner truth hanya via POST/PATCH body; tidak diexpose di GET (writer-safe boundary).

## Limitations

- No outline lock/unlock API (Task 4.5).
- No web OutlinePage integration (Task 4.6).
- No audit logs for tracking edits.
- `smoke:api` regression tidak cover tracking endpoints.
- Demo seed user `penulis@contoh.id` tidak bisa login GoTrue (known quirk); runtime test memakai signup user + bootstrap outline.
- No `includeTruth=true` owner detail endpoint (deferred).

## Next recommended task

**Task 4.5 — Outline lock workflow API** (`POST .../outline/approve`, `POST .../outline/lock`, `workflow_phase=outline_locked`).