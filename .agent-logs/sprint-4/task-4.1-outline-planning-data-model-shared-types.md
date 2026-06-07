# Task 4.1 — Outline Planning Data Model + Shared Types

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat migration database dan shared types/enums Sprint 4 untuk outline planning: `outline_plans`, `chapter_outlines`, `open_loops`, `planned_reveals`, extend `workflow_phase`. Data model + seed only — no API, no web, no AI.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `docs/25-problem-coverage-matrix.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`, `domain.ts`, `index.ts`
- `apps/web/src/mocks/outline.ts`
- `apps/web/src/pages/OutlinePage.tsx`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/migrations/00003_sprint4_outline_planning.sql` | Created |
| `packages/shared/src/enums.ts` | Updated — Sprint 4 enums + workflow extend |
| `packages/shared/src/domain.ts` | Updated — OutlinePlan, ChapterOutline, OpenLoop, PlannedReveal |
| `packages/shared/src/index.ts` | Updated — exports |
| `supabase/seed.sql` | Updated — outline plan, 10 chapters, 3 loops, 3 reveals |
| `supabase/README.md` | Updated — migration 00003 section |
| `packages/shared/README.md` | Updated — Sprint 4 note |
| `.agent-logs/sprint-4/task-4.1-outline-planning-data-model-shared-types.md` | Created (log ini) |

**Tidak diubah:** API routes/services, web pages, OpenRouter, prose tables.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `supabase db reset` | PASS — 00001 + 00002 + 00003 + seed |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:web` | PASS — 3/3 mock Playwright (API mode NOT RUN) |

## Results

### Migration 00003

- Extended `workflow_phase`: `outline`, `outline_locked` (safe DO blocks)
- 8 new PostgreSQL enums aligned with shared package
- 4 tables with RLS owner-only, `set_updated_at` triggers, grants
- Constraints: unique `outline_plans.project_id`, unique `(outline_plan_id, chapter_number)`, `forbidden_before_chapter > 0`

### Seed (post reset)

| Table | Rows (demo project) |
|---|---|
| outline_plans | 1 |
| chapter_outlines | 10 |
| open_loops | 3 |
| planned_reveals | 3 |
| projects.workflow_phase | `outline` |

Foundation/intake/concepts seed unchanged (foundation `is_locked=false` preserved).

### Shared types exported

- Enums: `OUTLINE_PLAN_STATUSES`, `CHAPTER_OUTLINE_STATUSES`, `CHAPTER_FUNCTIONS`, `CHAPTER_EMOTIONS`, `OPEN_LOOP_STATUSES`, `PLANNED_REVEAL_STATUSES`, `REVEAL_RISK_LEVELS`, `RETENTION_MARKER_TYPES`
- `WORKFLOW_PHASES` extended
- Domain: `OutlinePlan`, `ChapterOutline`, `ChapterOutlineMarker`, `OpenLoop`, `PlannedReveal`

## Decisions

1. **`outline_plans` unique per project** — MVP one plan row; matches doc 32 + user spec.
2. **`chapter_outlines` not `chapters`** — reserve `chapters` for prose Sprint 5+.
3. **`open_loops.importance` uses `fact_importance`** — user spec said `default medium` but enum is minor/major/core; used `major` default, `core` for key loops.
4. **`retention_summary` as text** — per user column spec (not jsonb).
5. **`markers` jsonb** — array of `{type, label}` using `retention_marker_type` values.
6. **Seed workflow_phase `outline`** — outline data present; foundation lock status not altered.
7. **`planned_reveals.planning_truth`** — seeded with planner-only strings; doc comments in shared + migration.

## Limitations

- No API mappers or routes for new tables.
- No web integration; `OutlinePage` still uses mock.
- `payoff_chapter_outline_id` not set in seed (payoff beyond Bab 10).
- `audit_action` enum not extended for outline events.
- API-mode Playwright not run in this session.

## Next recommended task

**Task 4.2 — Outline generation stub API** (`GET/POST /api/projects/:id/outline`, foundation-locked gate, deterministic stub from canon snapshot).