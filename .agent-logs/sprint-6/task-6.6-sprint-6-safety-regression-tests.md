# Task 6.6 — Sprint 6 Safety & Regression Tests

**Date:** 2026-06-08
**Sprint:** sprint-6
**Status:** completed

## Task goal

Menambahkan dan memperkuat safety/regression tests untuk Sprint 6 flow (summary generation, delta extraction, proposal review, explicit canon promotion) serta regression Sprint 5 leak guards. Tanpa fitur produk baru, publish package, atau OpenRouter.

## Files read

- `README.md`
- `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
- `docs/35-sprint-5-verification-report.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `scripts/sprint6-smoke-api.ps1`, `sprint5-smoke-api.ps1`, `sprint5-smoke-web.ps1`
- `apps/web/e2e/sprint5-write-flow.spec.ts`, `sprint6-summary-flow.spec.ts`
- `apps/api/src/services/chapter-summary.ts`, `chapter-delta.ts`, `chapter-summary-approval.ts`, `summary-proposal-review.ts`, `proposal-canon-promotion.ts`
- `apps/web/src/hooks/useSummaryData.ts`, `services/summary.ts`, `pages/SummaryPage.tsx`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `scripts/sprint6-smoke-api.ps1` | Extended — 59 safety steps (was 43); leak guards, canon guards, approval lifecycle, cross-user |
| `apps/web/e2e/sprint6-summary-flow.spec.ts` | Extended — DOM leak patterns, canon overclaim guard, high-risk disabled, fact accept/reject |
| `scripts/sprint6-smoke-web.ps1` | Updated — Task 6.6 header comment |
| `README.md` | Updated — `smoke:api:sprint6`, verification checklist |
| `scripts/README.md` | Updated — Task 6.6 smoke descriptions |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Updated — Sprint 6 smoke refs, publish deferred S7, confirmHighRisk UI gap |
| `.agent-logs/sprint-6/task-6.6-sprint-6-safety-regression-tests.md` | Created (log ini) |

**Tidak diubah:** migrations, backend product logic (kecuali tidak ada bug ditemukan), publish package, OpenRouter, UI redesign.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS (59/59) |
| `npm run smoke:web` | PASS (3 mock; API NOT RUN) |
| `npm run smoke:web:write` | PASS (mock; API NOT RUN) |
| `npm run smoke:web:summary` | PASS (mock; API NOT RUN) |
| `npm run smoke:web:summary -- -IncludeApiMode` | PASS (11/11 mock + API full flow) |

## Results

### API safety (sprint6-smoke-api.ps1 — 59 steps)

**A. Summary generation:** 401 no token, 409 before ready, 200 after ready, leak guard (incl. provider/model/token), no canon mutation (facts/chars/speech_rules/loops/reveals), regenerate idempotent + supersedes v1.

**B. Delta/proposal:** 401 no token, extract 200, leak guards, safe excerpt response, all linked+proposed, no accept on extract, no canon mutation, idempotent extract, regenerate blocked (409) while proposals exist.

**C. Summary approval:** 401 no token, approve 200, no canon mutation, proposalCounts.accepted=0, proposals remain proposed, session completed, writing state summarized, approve idempotent.

**D. Proposal review:** accept before approve 409, reveal without confirmHighRisk 409, reject no canon mutation, accept fact +1 canon + link accepted, accept leak guard, accept idempotent, reject accepted 409.

**E. Cross-user:** list/detail/delta/proposals/approve/accept/reject → 404.

**F. Sprint 5 regression:** `smoke:api:sprint5` 49/49 PASS unchanged.

### Web E2E (sprint6-summary-flow.spec.ts)

- **Mock:** `/summary` renders, no leak markers in DOM.
- **API mode:** generate → extract → approve → proposal panel persists → fact accept status → reject → no leaks, no canon overclaim copy, high-risk Terima disabled when badge present.

## Decisions

1. **Extended existing sprint6 script** — tidak membuat script terpisah; satu entry `smoke:api:sprint6`.
2. **Delta regenerate=true** — didokumentasikan via smoke: blocked 409 saat linked proposals exist (sesuai `chapter-delta.ts`).
3. **Canon overclaim E2E** — assert teks "tidak otomatis memasukkan" ada; forbidden overclaim patterns absent.
4. **docs/36 refresh** — hapus outdated "SummaryPage still mock" / "no chapter_summaries"; tambah publish S7 defer.

## Limitations

- API-mode summary/web E2E tidak di GitHub Actions CI (deferred).
- `confirmHighRisk` UI belum ada — high-risk reveal hanya disabled di web + API 409.
- `smoke:all:local` belum include sprint6 (optional future hygiene).
- Prose leak marker false-positive risk untuk fictional text containing `model`/`token` (documented in docs/36).

## Bugs found/fixed

Tidak ada bug produk baru ditemukan selama Task 6.6. Semua tests PASS tanpa perubahan backend/frontend logic.

## Next recommended task

**Task 6.7** — Sprint 6 verification report (`docs/38` atau penutupan sprint per plan), lalu Sprint 7 publish package (deferred).