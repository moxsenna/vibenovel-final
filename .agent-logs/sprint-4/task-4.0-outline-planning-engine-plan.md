# Task 4.0 — Outline Planning Engine Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat rencana implementasi Sprint 4 secara detail sebelum coding: Outline Planning Engine (season/arc minimal, 10 chapter outline, hooks, retention, open loops, reveal schedule, lock workflow). Tanpa migration, API, web code, OpenRouter, atau prose writer.

## Files read

- `README.md`
- `docs/17-roadmap-sprint-plan-mvp-to-full.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `docs/10-reader-retention-and-unlockability-system.md`
- `docs/06-reveal-gate-and-future-leak-prevention.md`
- `docs/07-context-packet-and-ai-writing-workflow.md`
- `apps/web/src/pages/OutlinePage.tsx`
- `apps/web/src/mocks/outline.ts`
- `apps/web/src/types/outline.ts`
- `apps/web/src/components/outline/` (structure)
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `supabase/migrations/00002_sprint3_intake_concepts.sql` (workflow_phase pattern)
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `docs/32-sprint-4-outline-planning-engine-implementation-plan.md` | Created — Sprint 4 implementation plan (13 sections) |
| `.agent-logs/sprint-4/task-4.0-outline-planning-engine-plan.md` | Created (log ini) |

**Tidak diubah:** migrations, API, web source, shared package code, README.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build:*` | tidak dijalankan — docs-only task |
| `supabase db reset` | tidak dijalankan — no migration yet |

## Results

- Sprint 4 plan document created with all 13 required sections.
- Proposed migration `00003` with 4 MVP tables: `outline_plans`, `chapter_outlines`, `open_loops`, `planned_reveals`.
- Task breakdown: 4.1 (db+shared) → 4.2 stub generate → 4.3 chapter CRUD → 4.4 loops/reveals → 4.5 lock → 4.6 web → 4.7 verification.
- Planner/writer boundary documented per docs 06/07.
- Foundation locked gate documented as hard prerequisite.

## Decisions

1. **Gabung Task 4.1 db + shared types** — satu task migration gate seperti Sprint 3.1.
2. **`outline_plans` bukan `story_arcs` terpisah di MVP** — season label + arc summary di plan row; multi-season defer Full Phase 2.
3. **`chapter_outlines` bukan `chapters` prose** — hindari konflik dengan Sprint 5 prose table naming.
4. **`planned_reveals.planning_truth` planner-only** — UI/API list redact; align Reveal Gate doc 06.
5. **Extend `workflow_phase`** — tambah `outline`, `outline_locked` (bukan enum terpisah).
6. **Beat contracts explicit out** — Sprint 5 per roadmap doc 17.
7. **Stub generator parity** — target `mockOutline` demo "Istri yang Mereka Buang".
8. **Retention hints computed** — cache JSON di `outline_plans.retention_summary`, bukan tabel scores.

## Limitations

- Plan only — no schema/API/web implementation.
- Unlock outline workflow tidak dirinci (defer post-4.5).
- Bab 11+ batch generation tidak di MVP Sprint 4.
- Automated unlockability/suffering fatigue detectors = heuristic summary only, not full validator.

## Next recommended task

**Task 4.1 — Outline Planning Data Model + Shared Types** (`00003_sprint4_outline_planning.sql`, shared enums/domain, seed parity `mockOutline`).