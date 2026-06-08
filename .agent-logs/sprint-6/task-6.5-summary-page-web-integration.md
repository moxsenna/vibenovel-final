# Task 6.5 — SummaryPage Web Integration

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Menghubungkan halaman `/projects/:id/summary` ke API Sprint 6 secara minimal dan aman: load/generate summary, extract delta/proposals, approve summary, accept/reject linked proposals, dengan mock fallback tetap tersedia. Tanpa redesign UI Sprint 1, tanpa OpenRouter/AI generation.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `apps/api/src/routes/summary.ts`
- `apps/api/src/services/chapter-summary.ts`
- `apps/api/src/services/chapter-delta.ts`
- `apps/api/src/services/chapter-summary-approval.ts`
- `apps/api/src/services/summary-proposal-review.ts`
- `apps/web/src/pages/SummaryPage.tsx`
- `apps/web/src/components/summary/`
- `apps/web/src/mocks/summary.ts`
- `apps/web/src/lib/api.ts`, `env.ts`, `project-context.ts`
- `apps/web/src/hooks/useWriteRoomData.ts` (fallback pattern)
- `scripts/sprint6-smoke-api.ps1`, `sprint5-smoke-web.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/web/src/services/summary.ts` | Created — API client (list/get/by-chapter, generate, delta, proposals, approve, accept/reject) |
| `apps/web/src/lib/summary-mappers.ts` | Created — API → UI mapper + leak guard on displayed text |
| `apps/web/src/hooks/useSummaryData.ts` | Created — mock/api/api-fallback hook with workflow actions |
| `apps/web/src/components/summary/SummaryWorkflowActions.tsx` | Created — Buat Ringkasan / Ekstrak Perubahan CTAs |
| `apps/web/src/components/summary/SummaryProposalReviewPanel.tsx` | Created — minimal proposal review (Terima/Tolak, high-risk badge) |
| `apps/web/src/pages/SummaryPage.tsx` | Updated — wire hook + workflow + proposal panel |
| `apps/web/src/components/summary/SummaryActionFooter.tsx` | Updated — optional `onApprove`, hint, `showPublishLink` |
| `apps/web/src/components/summary/index.ts` | Updated — export new components |
| `apps/web/e2e/sprint6-summary-flow.spec.ts` | Created — mock + API mode Playwright |
| `scripts/sprint6-smoke-web.ps1` | Created — web E2E smoke for `/summary` |
| `package.json` | Updated — `smoke:web:summary` |
| `apps/web/package.json` | Updated — `test:e2e:sprint6` |
| `apps/web/.env.example` | Updated — Task 6.5 comment |
| `README.md` | Updated — Task 6.5 integration note |
| `scripts/README.md` | Updated — smoke index |
| `apps/api/src/services/write-session.ts` | Updated — integration bugfix: resume `ready_for_summary` session (not only `active`) |
| `.agent-logs/sprint-6/task-6.5-summary-page-web-integration.md` | Created (log ini) |

**Tidak diubah:** migrations, publish package, OpenRouter, model router, credit deduction, Task 6.6+.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS (43/43) |
| `npm run smoke:web` | PASS (3 mock; API NOT RUN) |
| `npm run smoke:web:write` | PASS (mock; API NOT RUN) |
| `npm run smoke:web:summary` | PASS (mock; API NOT RUN) |
| `npm run smoke:web:summary -- -IncludeApiMode` | PASS (mock + API full flow 11/11) |

## Results

- SummaryPage API mode: load by chapter, generate, extract, approve, accept/reject wired.
- Mock fallback preserved (`VITE_USE_MOCKS=true` → full Sprint 1 mock).
- No login / API down → mock + `IntegrationNotice`.
- `planningTruth` / `packet_json` / `prose_text` not rendered (mapper + panel excerpt guard).
- Summary approve does not auto-accept proposals; high-risk reveal accept disabled (no `confirmHighRisk` UI).
- Integration bugfix: `startWritingSession` no longer spawns duplicate active session when chapter already `ready_for_summary`.

## Decisions

1. **Reuse Sprint 1 layout** — hanya tambah `SummaryWorkflowActions` + `SummaryProposalReviewPanel`; tidak redesign.
2. **`useSummaryData` pattern** — mengikuti `useWriteRoomData`: `mock` / `api` / `api-fallback`.
3. **Chapter default** — Bab 1 dari outline bundle; `startWritingSession` untuk cek readiness + `writingSessionId` generate.
4. **`hasDelta`** — true setelah extract atau jika linked proposals ada saat load.
5. **Proposal accept gate** — UI disable Terima sampai summary approved; copy jelas approve ≠ canon.
6. **High-risk reveal** — badge "Butuh konfirmasi manual"; Terima disabled; tidak auto-confirm.
7. **Backend mini-fix** — `fetchActiveSessionForChapter` mencakup `ready_for_summary` agar SummaryPage tidak reset session.

## Limitations

- Tidak ada UI `confirmHighRisk` untuk reveal berisiko tinggi.
- Satu chapter default (Bab 1); belum ada chapter picker di SummaryPage.
- `getDelta` tidak dipoll terpisah saat load — `hasDelta` dari linked proposals count.
- API-mode web E2E tidak di GitHub Actions CI (deferred, sama pola Sprint 5).
- `smoke:web:summary -IncludeApiMode` memerlukan `VITE_USE_MOCKS=false` + restart `dev:web`.

## Next recommended task

**Task 6.6** — Publish package web integration (atau task berikutnya per `docs/37`), setelah user approve Task 6.5.