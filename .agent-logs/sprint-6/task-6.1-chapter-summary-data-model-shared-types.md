# Task 6.1 — Chapter Summary Data Model + Shared Types

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Membuat data model Sprint 6 (migration `00005` + shared types/enums) untuk chapter summaries, chapter deltas, summary items, dan junction summary↔ai_proposals. Tanpa API, tanpa web, tanpa proposal promotion service.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `supabase/migrations/00004_sprint5_write_room.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/mocks/summary.ts`
- `apps/web/src/pages/SummaryPage.tsx`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/migrations/00005_sprint6_chapter_summary_delta.sql` | Created — 4 tables, 5 enums, ai_proposal enum extend, RLS, triggers |
| `packages/shared/src/enums.ts` | Updated — Sprint 6 enums + AI_PROPOSAL_TYPES/SOURCES extend |
| `packages/shared/src/domain.ts` | Updated — ChapterSummary, ChapterDelta, items, payload types |
| `packages/shared/src/index.ts` | Updated — barrel exports |
| `supabase/seed.sql` | Updated — comment: no Sprint 6 summary seed |
| `supabase/README.md` | Updated — migration 00005 section |
| `packages/shared/README.md` | Updated — Sprint 6 canon guardrails |
| `.agent-logs/sprint-6/task-6.1-chapter-summary-data-model-shared-types.md` | Created (log ini) |

**Tidak diubah:** API routes, web UI, mappers, docs/37 (material alignment — status enum uses user spec `generated/reviewing` not docs/37 `ready_for_review`).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `supabase db reset` | PASS — migrations 00001–00005 + seed |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:web:write` | PASS — mock 3/3; API-mode NOT RUN |

## Results

- Migration `00005` applies cleanly on `supabase db reset`.
- 4 new tables + 5 new enums + safe `ai_proposal_type`/`ai_proposal_source` extensions.
- Shared Sprint 6 types exported from `@vibenovel/shared`.
- No Sprint 6 seed rows — comment added to `seed.sql`.
- Sprint 2 and Sprint 5 smoke regression PASS after schema change.
- No API/web feature code changed.

## Decisions

1. **ChapterSummaryStatus per user spec** — `draft`, `generated`, `reviewing`, `approved`, `superseded` (not docs/37 `ready_for_review`).
2. **`is_current` + partial unique** on `chapter_summaries` — one current summary per chapter outline.
3. **`summary_version` + unique(chapter_outline_id, summary_version)** — supports regenerate without losing history.
4. **`current_prose_version_ids uuid[]`** — snapshot reference on summary row per user schema.
5. **Reuse `ai_proposals`** — junction via `chapter_summary_proposals`; no `canon_change_proposals` table.
6. **No seed for Sprint 6 tables** — runtime generation in Task 6.2.
7. **No triggers** — schema-only guardrails; promotion deferred to Task 6.4 service.
8. **Item types per user spec** — 12 `chapter_summary_item_type` values aligned with mock sections.

## Limitations

- No API mappers for new tables yet (Task 6.2+).
- `docs/37` status naming differs slightly (`ready_for_review` vs `reviewing`) — implementation follows Task 6.1 user spec.
- No `workflow_phase` `summarizing` extend in 6.1 — deferred to API task if needed.
- Canon promotion on proposal accept still status-only from Sprint 2 — Task 6.4.

## Next recommended task

**Task 6.2 — Chapter Summary Generation Stub API**. Jangan mulai sampai Task 6.1 di-approve.