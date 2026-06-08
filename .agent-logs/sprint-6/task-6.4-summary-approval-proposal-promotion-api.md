# Task 6.4 — Summary Approval + Proposal Promotion API

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Membuat workflow approval untuk chapter summary dan review linked proposals. Summary approval menandai summary/chapter sebagai approved/summarized tanpa canon promotion otomatis. Canon berubah hanya jika user secara eksplisit accept proposal tertentu.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `supabase/migrations/00005_sprint6_chapter_summary_delta.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/chapter-summary.ts`
- `apps/api/src/services/chapter-delta.ts`
- `apps/api/src/services/summary-proposal-linker.ts`
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/fact.ts`
- `apps/api/src/services/character.ts`
- `apps/api/src/services/speech-rule.ts`
- `apps/api/src/services/outline-tracking.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/routes/summary.ts`
- `apps/api/README.md`
- `scripts/sprint6-smoke-api.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/chapter-summary-approval.ts` | Created — approve summary + lifecycle markers |
| `apps/api/src/services/summary-proposal-review.ts` | Created — accept/reject linked proposals |
| `apps/api/src/services/proposal-canon-promotion.ts` | Created — type-specific canon promotion |
| `apps/api/src/services/summary-proposal-linker.ts` | Updated — `getOwnedLinkedProposal` helper |
| `apps/api/src/services/chapter-delta-extractor.ts` | Updated — high-risk fact also emits reveal proposal (smoke/high-risk path) |
| `apps/api/src/routes/summary.ts` | Updated — approve/accept/reject endpoints |
| `apps/api/README.md` | Updated — Task 6.4 section |
| `scripts/sprint6-smoke-api.ps1` | Updated — approval/promotion smoke steps (43 total) |
| `.agent-logs/sprint-6/task-6.4-summary-approval-proposal-promotion-api.md` | Created (log ini) |

**Tidak diubah:** web UI, migrations, publish package, OpenRouter, merge endpoint.

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
| `npm run smoke:api:sprint6` | PASS (43/43) |

## Results

- POST approve, POST accept, POST reject tersedia dan dilindungi auth.
- Summary approval: `approved` + `summarized` + session `completed`; tidak mutasi canon.
- Accept fact proposal setelah approve: creates `facts` confirmed row.
- Reject linked proposal: status rejected, no canon mutation.
- Reveal accept tanpa `confirmHighRisk` → 409.
- Accept sebelum approve → 409 `summary_not_approved`.
- Cross-user approve/accept → 404.

## Decisions

1. **Audit log pakai `project_updated`** — enum `audit_action` DB belum extend; hindari migration di Task 6.4.
2. **Accept requires summary approved** — gate `summary_not_approved` sebelum promotion.
3. **Promotion order: canon first, then mark accepted** — tanpa DB transaction; limitation didokumentasikan.
4. **Reveal high-risk** — wajib `confirmHighRisk=true` + `targetEntityId`; tanpa confirm → 409.
5. **Character/relationship promotion minimal** — character append description; relationship hanya jika payload lengkap; else 409.
6. **Approve idempotent** — summary sudah `approved` → 200 `alreadyApproved=true`.
7. **Merge endpoint skipped** — gunakan generic proposal merge Sprint 2 jika perlu; tidak di Task 6.4.

## Limitations

- Tidak ada multi-table DB transaction — jika promotion sukses tapi status update gagal, inconsistency possible (rare).
- `audit_action` enum belum punya `chapter_summary_approved` — metadata di `project_updated`.
- `character_update`/`relationship_update` promotion terbatas pada payload shape delta stub.
- `reveal_status_update` butuh `targetEntityId` + confirm; smoke reveal ditolak/reject tanpa promote reveal.
- Merge endpoint tidak diimplementasi.
- SummaryPage integration belum (Task 6.5).
- Remote deploy/migration push tidak dilakukan.

## Next recommended task

**Task 6.5 — SummaryPage Web Integration** — API mode + mock fallback; tampilkan summary, delta, linked proposals, approve/accept/reject UI minimal.