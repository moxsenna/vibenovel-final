# Task 6.2 — Chapter Summary Generation Stub API

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Membuat API untuk generate chapter summary deterministic/stub dari prose draft current versions yang sudah `ready_for_summary`. API persist `chapter_summaries` dan `chapter_summary_items`. Tanpa delta extraction, tanpa `ai_proposals`, tanpa approval workflow, tanpa SummaryPage, tanpa OpenRouter/AI.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `supabase/migrations/00005_sprint6_chapter_summary_delta.sql`
- `supabase/migrations/00004_sprint5_write_room.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/prose-draft.ts`
- `apps/api/src/services/write-session.ts`
- `apps/api/src/services/chapter-beat.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/routes/write.ts`
- `apps/api/README.md`
- `scripts/sprint5-smoke-api.ps1`
- `apps/web/src/mocks/summary.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/routes/summary.ts` | Created — summary route group (list, generate, detail, by-chapter) |
| `apps/api/src/routes/index.ts` | Updated — register `registerSummaryRoutes` |
| `apps/api/src/services/chapter-summary.ts` | Created — list/detail/by-chapter/generate with versioning |
| `apps/api/src/services/chapter-summary-generator.ts` | Created — deterministic `summary_stub_v1` generator |
| `apps/api/src/services/summary-snapshot.ts` | Created — ready_for_summary gates + beat/prose snapshot |
| `apps/api/src/services/summary-safety.ts` | Created — prose leak markers + output safety asserts |
| `apps/api/src/lib/mappers.ts` | Updated — `ChapterSummaryRow`/`ChapterSummaryItemRow` mappers |
| `apps/api/README.md` | Updated — Task 6.2 summary API section |
| `scripts/sprint6-smoke-api.ps1` | Created — Sprint 6 API smoke (16 steps) |
| `package.json` | Updated — `smoke:api:sprint6` alias |
| `.agent-logs/sprint-6/task-6.2-chapter-summary-generation-stub-api.md` | Created (log ini) |

**Tidak diubah:** web UI, migrations, shared types (Task 6.1), delta/proposal/approval routes, OpenRouter, credit deduction.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS (16/16) |
| `npm run smoke:web:write` | tidak dijalankan — out of scope Task 6.2 (no UI change) |

## Results

- Semua endpoint summary terdaftar dan dilindungi `authMiddleware`.
- `POST /summary/generate` gate `ready_for_summary` enforced (409 dengan `details.missing`).
- Stub generator persist `chapter_summaries` + `chapter_summary_items`; `regenerate=false` idempotent; `regenerate=true` supersede v1 → v2.
- Tidak ada mutasi canon (facts/characters/open_loops/reveals) dan tidak ada `ai_proposals` baru.
- Response tidak expose `proseText`, `planningTruth`, `packet_json`.
- Sprint 2 + Sprint 5 + Sprint 6 smoke semua PASS.

## Decisions

1. **Approved summary regenerate → 409** — approval workflow Task 6.4; regenerate pada summary `approved` ditolak dengan `details.missing: ["summary_approved"]`.
2. **List endpoint default `is_current=true`** — filter `status` opsional override; list include `itemCount` bukan full items.
3. **`current_prose_version_ids` di response** — disertakan di summary row (version IDs only, bukan prose text) untuk traceability stub.
4. **Safety pada prose input → 400** — leak markers di prose draft reject sebelum insert; output summary juga di-scan via `assertSummaryTextSafe`.
5. **By-chapter endpoint** — return `{ summary: null, items: [] }` jika belum ada summary (bukan 404).

## Limitations

- Generator `summary_stub_v1` deterministic only — synopsis dari first-sentence prose snippets + outline fallback.
- Tidak ada `chapter_deltas`, `ai_proposals`, summary approval, atau `chapter_writing_states.summarized`.
- `character_change` / `new_fact_candidate` items hanya sebagai review hints (safety item), bukan proposal.
- `smoke:web:write` tidak dijalankan (no frontend change).
- Remote deploy / migration push tidak dilakukan.

## Next recommended task

**Task 6.3 — Chapter Delta + Proposal Extraction API** — extract deltas dari summary items, enqueue `ai_proposals`, tanpa approval/promotion (Task 6.4).