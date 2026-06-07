# Task 4.5 — Outline Approve & Lock Workflow API

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat workflow approve/lock untuk outline plan: `POST .../outline/approve` dan `POST .../outline/lock` dengan readiness checks, locked guard integration (Tasks 4.3–4.4), `workflow_phase=outline_locked`, tanpa canon mutation, web integration, atau prose writer.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `apps/api/src/services/outline.ts`, `chapter-outline.ts`, `outline-tracking.ts`, `project.ts`
- `apps/api/src/services/foundation-lock.ts`, `foundation-readiness.ts` (patterns)
- `apps/api/src/lib/mappers.ts`, `middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/outline-lock.ts` | Created — readiness calculator, approve, lock |
| `apps/api/src/routes/outline.ts` | Updated — approve + lock endpoints |
| `apps/api/README.md` | Updated — Task 4.5 docs |
| `.agent-logs/sprint-4/task-4.5-outline-approve-lock-workflow-api.md` | Created (log ini) |

**Tidak diubah:** migration, seed, shared types, web UI, smoke:api script, audit_action enum.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Task 4.5 runtime verification (local) | PASS — 14/14 |

## Results

### Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| POST | `/api/projects/:id/outline/approve` | JWT | Review readiness; set plan `reviewing`, chapters `approved`; return `canLock` |
| POST | `/api/projects/:id/outline/lock` | JWT | Full lock checks; set plan `locked`, chapters `locked`, `workflow_phase=outline_locked` |

### Approve behavior

- Preconditions: plan exists, not locked, ≥1 chapter, all chapters have title + summary + hook/endingHook
- Sets `outline_plans.status = reviewing`
- Sets passing chapters to `approved` (skips already `locked`)
- Returns `{ outlinePlan, chapters, checks, canLock }`
- Does not lock

### Lock behavior

- `calculateOutlineLockReadiness` / `getOutlineLockReadinessForOwner` checks:
  - foundationLocked, outlineExists, notAlreadyLocked, chapterCount, allChaptersHaveBasics, hooksEveryChapter, summariesEveryChapter, miniVictoryCadence (≥3), openLoopsEnough (≥2), plannedRevealsEnough (≥2), noPlanningTruthExposed
- On pass: `outline_plans.status=locked`, `locked_at=now`, all chapters `locked`, `projects.workflow_phase=outline_locked`
- On fail: 409 with `checks`, `missing`, `failedChecks`, `readinessScore`
- Already locked: 409 for approve and lock

### Runtime verification (14/14 PASS)

1. POST approve no token → 401
2. POST lock no token → 401
3. Approve without outline → 409
4. Lock without outline → 409
5. Bootstrap + POST approve → 200, status=reviewing, canLock=true
6. POST lock → 200, plan=locked, wf=outline_locked, chapters=locked
7. POST lock again → 409
8. POST approve when locked → 409
9. PATCH chapter when locked → 409
10. POST open-loop when locked → 409
11. GET outline → 200, planningTruth redacted
12. Canon counts unchanged
13. Cross-user lock → 404

## Decisions

1. **Service terpisah `outline-lock.ts`** — mirror `foundation-lock.ts`; `outline.ts` tetap generate/bundle.
2. **Approve → `reviewing`** — enum tidak punya `approved` di plan level; `reviewing` = siap final check.
3. **Lock chapters → `locked`** — bukan `approved`; konsisten dengan plan locked.
4. **Active loop/reveal counts** — exclude `dropped` / `cancelled`.
5. **No audit** — per task preference; workflow_phase update tanpa audit log.

## Limitations

- No outline unlock API (future task).
- No `GET .../outline/readiness` dedicated endpoint (readiness embedded in approve `canLock` and lock 409).
- No audit_logs for approve/lock.
- `smoke:api` tidak cover approve/lock endpoints.
- No DB transaction wrapper on lock (plan + chapters + workflow_phase).

## Next recommended task

**Task 4.6 — Web OutlinePage integration** (`apps/web` services/hooks, wire `OutlinePage.tsx` API mode + mock fallback).