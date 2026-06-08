# Task 7.0 — Publish Package / KBM Export Flow Implementation Plan

**Date:** 2026-06-08  
**Sprint:** sprint-7  
**Status:** completed

## Task goal

Menyusun rencana implementasi Sprint 7 (planning only) sebelum coding: mengubah PublishPage dari mock menjadi paket publikasi nyata dengan copy-ready KBM fields, tanpa auto-post, migration, API, atau integrasi web.

Deliverables:
- `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md`
- Work log ini

## Files read

| Path | Purpose |
|---|---|
| `README.md` | Sprint 6 closure; Sprint 7 sebagai task berikutnya |
| `docs/38-sprint-6-verification-report.md` | Handoff: approved summary + summarized → publish input |
| `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md` | Pola struktur plan doc (14 sections) |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Deferred publish; timing Sprint 7 |
| `docs/15-publish-package-and-growth-tools.md` | Product scope publish package |
| `docs/13-api-routes-and-backend-workflow.md` | API candidate route naming |
| `apps/web/src/pages/PublishPage.tsx` | Sprint 1 mock-only layout |
| `apps/web/src/mocks/publishPackage.ts` | Parity target fields |
| `apps/web/src/types/publishPackage.ts` | Web `PublishPackage` interface |
| `apps/web/src/components/publish/*` | Reuse components (copy, checklist, preview) |
| `apps/web/src/hooks/useSummaryData.ts` | Pola integrasi API mode Sprint 6 |
| `apps/api/src/services/chapter-summary.ts` | Summary service + approved gate pattern |
| `apps/api/src/services/chapter-delta.ts` | Delta service — excluded from publish sources |
| `apps/api/src/services/chapter-summary-generator.ts` | Stub generator pattern |
| `apps/api/src/services/prose-draft.ts` | `PROSE_LEAKAGE_MARKERS` reuse |
| `apps/api/src/services/summary-snapshot.ts` | Snapshot loading pattern |
| `packages/shared/src/domain.ts` | `ChapterSummary`, `ChapterOutline` types |
| `packages/shared/src/enums.ts` | `CHAPTER_SUMMARY_STATUSES`, status patterns |
| `.agents/rules/09-agent-work-logs.md` | Format log wajib |

## Files created/changed

| Path | Note |
|---|---|
| `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` | **Created** — full Sprint 7 plan (14 sections) |
| `.agent-logs/sprint-7/task-7.0-publish-package-kbm-export-plan.md` | **Created** — this work log |

Tidak ada perubahan source code, migration, API, atau PublishPage.

## Commands run

| Command | Result |
|---|---|
| `mkdir .agent-logs/sprint-7` | PASS |
| `npm run typecheck` | tidak dijalankan (scope docs-only) |
| `npm run build` | tidak dijalankan (scope docs-only) |
| `supabase db reset` | tidak dijalankan (no migration in 7.0) |

## Results

- Sprint 7 implementation plan document created with all 14 required sections.
- Agent work log created per `09-agent-work-logs.md`.
- Scope explicitly excludes coding, migration, API, web integration, KBM auto-post, OpenRouter.
- Recommended first coding task: **Task 7.1 — Publish Package Data Model + Shared Types**.

## Decisions

1. **Single table MVP (`publish_packages`)** — kolom teks eksplisit + `checklist_json` + `tags text[]`; defer `publish_package_fields` dan `publish_checklist_items` normalized tables.
2. **Gate ganda:** `chapter_summaries.status = approved` AND `chapter_writing_states.status = summarized`.
3. **Source boundary:** approved summary utama; prose excerpt only; N+1 hook safe slice; tidak baca `chapter_deltas`, `ai_proposals`, `context_packet_logs`, `planning_truth`.
4. **Stub version:** `publish_stub_v1` — deterministic, no credits, `safety_flags.stubGenerated` always true.
5. **API route prefix:** `/api/projects/:id/publish/*` — selaras pola Sprint 6 `/summary/*`.
6. **Export = local marker only** — `mark-exported` updates row status; no platform API.
7. **Web pattern:** `usePublishData` mirroring `useSummaryData`; reuse existing `components/publish/*` without redesign.

## Limitations

- Plan only — no schema migration file, no shared type additions, no routes, no tests yet.
- Checklist toggle UX (read-only vs interactive PATCH) left to Task 7.3/7.4 minimal implementation choice.
- `WORKFLOW_PHASES.publishing` marked optional — may defer to Sprint 8.
- README not updated (user scope: docs/log only).

## Next recommended task

**Task 7.1 — Publish Package Data Model + Shared Types**

- Migration `00006_sprint7_publish_package.sql`
- `@vibenovel/shared` enums + `PublishPackage` domain type
- `supabase db reset` verification gate before Task 7.2