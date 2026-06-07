# Task 6.0 — Chapter Summary, Chapter Delta & Canon Proposal Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Membuat rencana implementasi Sprint 6 secara detail sebelum coding: Chapter Summary, Chapter Delta & Canon Proposal Flow — mengubah SummaryPage dari mock menjadi persistence nyata, dengan canon boundary ketat (proposals only), tanpa OpenRouter, tanpa migration/API/web code.

## Files read

- `README.md`
- `docs/35-sprint-5-verification-report.md`
- `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/17-roadmap-sprint-plan-mvp-to-full.md` (Sprint 6 section)
- `docs/12-database-schema-and-data-model.md`
- `apps/api/src/services/prose-draft.ts`
- `apps/api/src/services/write-session.ts`
- `apps/api/src/services/context-packet-builder.ts` (partial)
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/fact.ts` (partial)
- `apps/api/src/services/character.ts` (partial)
- `apps/api/src/services/foundation.ts` (partial)
- `apps/api/src/services/foundation-lock.ts` (partial — promotion patterns)
- `apps/web/src/pages/SummaryPage.tsx`
- `apps/web/src/components/summary/` (all 10 files via glob + SummaryActionFooter read)
- `apps/web/src/mocks/summary.ts`
- `apps/web/src/types/summary.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `scripts/sprint5-smoke-api.ps1` (partial)
- `supabase/migrations/00001_sprint2_core.sql` (ai_proposals enum)
- `supabase/migrations/00003_sprint4_outline_planning.sql` (partial)
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-5/task-5.0-safe-write-room-context-packet-plan.md` (format reference)

## Files created/changed

| File | Action |
|---|---|
| `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md` | Created — Sprint 6 implementation plan (14 sections) |
| `.agent-logs/sprint-6/task-6.0-chapter-summary-delta-canon-proposal-plan.md` | Created (log ini) |
| `.agent-logs/sprint-6/` | Created folder |

**Tidak diubah:** migrations, API, web source, shared package code, README.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build:*` | tidak dijalankan — docs-only task |
| `supabase db reset` | tidak dijalankan — no migration yet |

## Results

- Sprint 6 plan document created with all 14 required sections per user spec.
- Proposed migration `00005` with 4 MVP tables: `chapter_summaries`, `chapter_deltas`, `chapter_summary_items`, `chapter_summary_proposals`.
- Reuse `ai_proposals` (no `canon_change_proposals`); extend enum with `open_loop_update`, `reveal_status_update`, `character_update`, `relationship_update`.
- Deferred physical tables: `chapter_open_loop_updates`, `chapter_reveal_updates`, `validation_reports`.
- Task breakdown: 6.1 (db+shared) → 6.2 summary stub → 6.3 delta+proposals → 6.4 approve+promotion → 6.5 web → 6.6 safety (blocker) → 6.7 verification.
- Canon boundary documented: prose/summary/delta ≠ canon; summary approve ≠ auto-accept proposals; explicit promotion on proposal accept only.
- Deterministic stub strategy: `summary_stub_v1` + `delta_stub_v1` from prose + beats + outline.
- Safety test matrix: 20 API tests + web E2E; Sprint 5 regression mandatory.
- API flow: ready_for_summary → generate → extract → review → approve summary (marker) / accept proposals (canon).

## Decisions

1. **Reuse `ai_proposals`** — single canon queue; extend types/sources in `00005` rather than new `canon_change_proposals` table.
2. **`chapter_summary_items` normalized** — parity `mockChapterSummary` UI sections; fact candidates labeled as proposals in UI.
3. **`chapter_summary_proposals` junction** — trace which proposals came from which summary generation batch.
4. **Summary approve ≠ proposal accept** — hard separation; `writing_sessions.completed` + `summarized` on approve only.
5. **Task 6.4 implements canon promotion** — extends Sprint 2 status-only accept; reuse `foundation-lock.ts` patterns for fact/character.
6. **High-risk reveal/open loop** — proposal with risk gate; no direct status PATCH from extractor.
7. **Stub only** — no OpenRouter; `generator_version` / `extractor_version` string constants.
8. **No `planning_truth` in summary API** — mapper redaction continues Sprint 4/5 pattern.
9. **Approved synopsis in Context Packet** — deferred post-6.5 explicit task (documented backlog).
10. **Task numbering 6.1–6.7** — aligns user spec and Sprint 5 pattern.

## Limitations

- Plan only — no schema, API, or web code written.
- Canon promotion detail for `relationship_update` MVP may be metadata-only until Sprint 11 speech rules engine.
- DB transaction wrapper for approve+promotion multi-step noted as P1 debt (docs/36).
- `npm run smoke:api:sprint6` script names proposed but not created until Task 6.6.
- README not updated in Task 6.0 (user did not request; Sprint 6 closure updates README in Task 6.7).

## Next recommended task

**Task 6.1 — Chapter Summary Data Model + Shared Types** (`00005` migration + `@vibenovel/shared` types). Jangan mulai Task 6.2 sampai Task 6.1 di-approve.