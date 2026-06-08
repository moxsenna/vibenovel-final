# Task 6.3 — Chapter Delta + Proposal Extraction API

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Membuat API untuk mengekstrak chapter delta dari `chapter_summary` + `chapter_summary_items`, lalu membuat `ai_proposals` sebagai kandidat perubahan canon dengan junction `chapter_summary_proposals`. Tanpa summary approval, tanpa proposal promotion, tanpa SummaryPage, tanpa OpenRouter/AI.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `supabase/migrations/00005_sprint6_chapter_summary_delta.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/chapter-summary.ts`
- `apps/api/src/services/chapter-summary-generator.ts`
- `apps/api/src/services/summary-snapshot.ts`
- `apps/api/src/services/summary-safety.ts`
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/fact.ts`
- `apps/api/src/services/character.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/routes/summary.ts`
- `apps/api/README.md`
- `scripts/sprint6-smoke-api.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/chapter-delta-extractor.ts` | Created — deterministic `chapter_delta_v1_stub` + proposal drafts (max 5) |
| `apps/api/src/services/summary-proposal-linker.ts` | Created — insert `ai_proposals` + `chapter_summary_proposals` links |
| `apps/api/src/services/chapter-delta.ts` | Created — extract/get delta/get linked proposals |
| `apps/api/src/services/summary-safety.ts` | Updated — `assertDeltaJsonSafe`, `assertProposalPayloadSafe` |
| `apps/api/src/lib/mappers.ts` | Updated — `ChapterDeltaRow`, `ChapterSummaryProposalRow`, `LinkedProposalSummary` |
| `apps/api/src/routes/summary.ts` | Updated — 3 delta/proposal endpoints |
| `apps/api/README.md` | Updated — Task 6.3 section |
| `scripts/sprint6-smoke-api.ps1` | Updated — 14 delta/proposal smoke steps (30 total) |
| `.agent-logs/sprint-6/task-6.3-chapter-delta-proposal-extraction-api.md` | Created (log ini) |

**Tidak diubah:** web UI, migrations, shared types, summary approval, proposal accept/promotion, OpenRouter.

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
| `npm run smoke:api:sprint6` | PASS (30/30) |

## Results

- POST delta extract, GET delta, GET linked proposals tersedia dan dilindungi auth.
- Delta + proposals persist; `regenerate=false` idempotent; `regenerate=true` + linked proposals → 409.
- Summary `approved` ditolak untuk extract; hanya `generated`/`reviewing`.
- 1 proposal `fact` dibuat dari `new_fact_candidate` item (stub flow); status tetap `proposed`.
- Tidak ada mutasi canon; tidak ada proposal acceptance.
- Response tidak expose `proseText`, `planningTruth`, `packet_json`.

## Decisions

1. **`regenerate=true` ditolak jika linked proposals ada** — menghindari duplikasi/merge kompleks di Task 6.3; dokumentasi sebagai limitation.
2. **Delta JSON mengikuti `ChapterDeltaPayload` shared** — bukan flat structure dari spec; selaras Task 6.1 types.
3. **Max 5 proposals per extraction** — cap noisy queue; skip synopsis/emotional/ending_hook items.
4. **Risk high untuk fact** — kata sensitif (rahasia, selingkuh, hamil, mati, dll.) + reveal proposals selalu high.
5. **GET proposals return safe excerpt** — `payloadExcerpt` whitelist keys only; tidak full raw payload.

## Limitations

- Extractor deterministic stub only — bukan AI/NLP production.
- `regenerate=true` tidak update delta jika proposals sudah linked (409).
- Tidak ada summary approval workflow (Task 6.4).
- Tidak ada proposal promotion/canon accept pada accept (Task 6.4).
- SummaryPage integration belum (Task 6.5).
- Remote deploy / migration push tidak dilakukan.

## Next recommended task

**Task 6.4 — Summary Approval + Proposal Promotion API** — approve summary, accept/reject linked proposals dengan canon promotion eksplisit.