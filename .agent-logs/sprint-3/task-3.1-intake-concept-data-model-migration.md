# Task 3.1 — Intake & Concept Data Model Migration

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat migration database dan shared types/enums untuk flow Sprint 3: intake sessions, intake messages, detected signals, story concepts, selected concept pointer, dan workflow phase. Data model only — no API, no web, no AI.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/services/project.ts` (context only — not modified)
- `apps/web/src/mocks/intake.ts`, `apps/web/src/mocks/concepts.ts` (seed parity)
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `packages/shared/src/enums.ts` | Updated — Sprint 3 enums |
| `packages/shared/src/domain.ts` | Updated — Sprint 3 domain types + Project fields |
| `packages/shared/src/index.ts` | Updated — exports |
| `supabase/migrations/00002_sprint3_intake_concepts.sql` | Created |
| `supabase/seed.sql` | Updated — intake/concepts demo seed |
| `supabase/README.md` | Updated — migration 00002 section |
| `packages/shared/README.md` | Updated — Sprint 3 note |
| `.agent-logs/sprint-3/task-3.1-intake-concept-data-model-migration.md` | Created (log ini) |

**Tidak diubah:** API routes/services, web pages, CI, `docs/30` (schema Task 3.1 mengikuti user spec, bukan appendix doc 30).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | (see Results) |
| `npm run typecheck` | (see Results) |
| `npm run build:shared` | (see Results) |
| `npm run build:web` | (see Results) |
| `npm run build:api` | (see Results) |
| `supabase db reset` | (see Results) |
| `npm run smoke:api` | (see Results) |

## Results

| Command | Result |
|---|---|
| `npm run typecheck:shared` | PASS |
| `npm run typecheck` | PASS (shared, web, api) |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS (wrangler dry-run) |
| `supabase db reset` | PASS — migrations 00001 + 00002 applied, seed OK |
| `npm run smoke:api` | PASS — 17/17 steps |

## Decisions

1. **Enum values mengikuti user Task 3.1 spec** — bukan draft doc 30 (`chat`/`signals_ready` diganti `idea_collection`/`signal_detection`/dll.).
2. **`intake_messages` tanpa `updated_at`** — append-only chat per spec.
3. **Partial unique index** `story_concepts_one_selected_per_project_idx` — satu `selected` per project.
4. **`projects.selected_concept_id` FK** ditambahkan setelah `story_concepts` dibuat.
5. **Seed: 3 messages** (bukan 23) — mock Sprint 1 hanya punya 3 pesan; "23" di task diinterpretasi typo.
6. **Concept #3 selected** — judul "Istri yang Mereka Buang" selaras project demo + foundation seed.
7. **`audit_action` enum tidak diubah** — deferred ke Task 3.2/3.3.
8. **API mappers tidak diubah** — Task 3.2 akan extend `ProjectRow` / SELECT.

## Limitations

- No API routes or services for new tables.
- No web integration; `apps/web/src/types/` Sprint 1 mocks unchanged.
- `audit_action` values (`intake_session_created`, `concept_selected`, dll.) belum di migration — catat untuk 3.2/3.3.
- Doc 30 table field names (e.g. `pitch_short`, `intake_session_id` on concepts) differ slightly from implemented schema — doc 30 update optional later.

## Next recommended task

**Task 3.2 — API intake sessions & messages** (endpoints + stub agent reply + signal extract).