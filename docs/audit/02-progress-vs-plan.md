# 02 - Progress vs Plan

Status legend: DONE, PARTIAL, MOCK ONLY, NOT STARTED, BLOCKED, RISKY / NEEDS REVIEW.

## Ringkasan

Progress klaim di `README.md` dan `docs/63` sebagian besar cocok dengan kode. Ketidakcocokan utama bukan "fitur inti belum ada", tetapi:

- beberapa fitur yang roadmap lama anggap future memang masih deferred, terutama Draft Import, full Voice DNA, Creator Mode, analytics;
- foundation proposal dan outline masih deterministic/stub-heavy;
- validator/repair belum jadi pipeline eksplisit;
- production payment masih gated;
- auth/session production flow sedang terbukti rapuh oleh E2E.

## Progress table

| Sprint/Task | Claimed status | Actual code status | Evidence/path | Gap | Recommendation |
|---|---|---|---|---|---|
| Sprint 0 docs/rules | Done | DONE | `docs/01-20`, `.agents/rules/*` | Source of truth banyak | Pakai README + docs/63/61/36 sebagai urutan baca. |
| Sprint 1 frontend parity | Done | DONE | `apps/web/src/pages/*`, `apps/web/src/components/*`, `stitch-reference/*` | Mock masih tersedia untuk demo | Jaga `VITE_USE_MOCKS=false` di API/prod mode. |
| Sprint 2 backend/data/auth | Done | DONE | `supabase/migrations/00001_sprint2_core.sql`, `apps/api/src/middleware/auth.ts`, `routes/projects.ts` | Production token/session drift masih mungkin | Tambah E2E auth real dan monitor 401. |
| Sprint 3 intake/concepts/foundation | Done | PARTIAL/DONE | `routes/intake.ts`, `routes/concepts.ts`, `services/intake.ts`, `services/concept.ts`, `services/foundation-proposal.ts` | Intake/concept punya OpenRouter path; foundation masih `foundation_stub_batch` | Prioritaskan real foundation proposal generation. |
| Sprint 4 outline planning | Done | PARTIAL/DONE | `routes/outline.ts`, `services/outline-generator.ts`, `00003_sprint4_outline_planning.sql` | Outline generator masih `outline_stub_deterministic` | Prioritaskan real outline generator dari locked foundation. |
| Sprint 5 write room/context packet | Done | DONE | `routes/write.ts`, `services/context-packet-builder.ts`, `services/context-packet-safety.ts`, `00004_sprint5_write_room.sql` | Write room butuh outline locked; test account bisa salah precondition | Seed/prepare test project sampai `outline_locked`. |
| Sprint 6 summary/delta/canon proposal | Done | DONE/PARTIAL | `services/chapter-summary*.ts`, `chapter-delta*.ts`, `summary-proposal-review.ts`, `00005` | Validator full belum ada | Tambah validator report dan output gate. |
| Sprint 7 publish package | Done | DONE | `routes/publish.ts`, `services/publish-package*.ts`, `00006` | Auto-post KBM by design tidak ada | Tetap manual copy. |
| Sprint 8 AI/OpenRouter/credits | Done | DONE | `routes/ai.ts`, `services/model-router.ts`, `openrouter-client.ts`, `credit-ledger.ts`, `00008` | Env gate menentukan aktif/tidak; cost cap belum terlihat | Audit runtime env dan limit pemakaian. |
| Sprint 9 rewrite/publish copy/credit UI | Done | DONE | `services/prose-rewrite-generation.ts`, `publish-copy-ai-generation.ts`, `apps/web/src/services/ai.ts` | Rewrite bukan Safe Repair validator-driven | Pisahkan rewrite tool vs repair pipeline. |
| Sprint 10 payment/topup | Closed/gated | PARTIAL/BLOCKED for production | `00009`, `00010`, `routes/credits.ts`, `payment-webhooks.ts`, `docs/73`, `docs/77` | Production payment tidak boleh dianggap aktif | Jangan enable sampai `00010` dan founder Go jelas. |
| Sprint 10.29 mock-flow removal | GO | PARTIAL/DONE | `docs/91-remove-misleading-mock-flow-report.md`, `docs/93`, `apps/web/src/lib/env.ts` | Mock default dev masih true | Harus diverifikasi build prod tidak fallback mock. |
| Sprint 10.31a real intake/concept | GO | PARTIAL/DONE | `docs/94`, `docs/95`, `services/intake.ts`, `services/concept.ts` | E2E terbaru masih melihat invalid token | Stabilkan auth/session sebelum menilai AI output. |
| Draft Import / Legacy Continuation | Deferred | NOT STARTED | Tidak ada route/page draft import di `apps/web/src/routes/index.tsx`; `docs/63` menandai deferred | E2E draft import tidak bisa lulus jujur | Jadikan sprint terpisah setelah core story flow stabil. |
| Creator Mode advanced controls | Deferred | PARTIAL/NOT STARTED | Settings quality mode ada; full Story Bible/reveal editor tidak ada | "Advanced creator mode" saat ini sebatas quality tier | Definisikan Creator Mode sebelum test. |
| Full validator + safe repair | Deferred/partial | PARTIAL | `context-packet-safety.ts`, `summary-safety.ts`, `publish-safety.ts`, `ai-prompt-safety.ts` | Tidak ada `validation_reports` table/pipeline | Hardening sebelum public AI. |
| CI quality gate | Basic | PARTIAL | `.github/workflows/ci.yml` hanya typecheck/build | E2E/smoke tidak di CI | Tambah regression suite minimal. |

## Mapping user-flow E2E terbaru

| Flow gagal | Status audit | Evidence | Aksi berikut |
|---|---|---|---|
| Generate 3 concepts | RISKY / NEEDS REVIEW | Auth error berasal dari `authMiddleware`; concept generation real path ada di `services/concept.ts` | Fix token/session/prod Supabase alignment, lalu rerun. |
| Foundation + outline | PARTIAL | Foundation/outline masih stub-heavy | Setelah auth fixed, implement real foundation/outline generation. |
| Logout | NEEDS REVIEW | Guard ada di `AppShell.tsx`; signOut local di `AuthContext.tsx`; link "Lanjut ke dashboard" masih ada di `LoginPage.tsx` | Rerun E2E; cek browser storage dan route guard production mode. |
| Settings Terbaik persists | LIKELY FIXED / NEEDS VERIFY | `useSettingsData.ts` localStorage + API PUT; E2E regression exists | Rerun `auth-settings-regression.spec.ts`. |
| Credit estimate loading | LIKELY FIXED / NEEDS VERIFY | `SettingsPage.tsx` passes numeric `costEstimates`; `SettingsUsageSection.tsx` renders numbers | Rerun settings E2E. |
| Draft import | NOT STARTED | No route/page | Do not claim fixed; plan future sprint. |
| Accept generated prose / Write Room | NEEDS PRECONDITION | WritePage blocks when outline not locked | Seed project to `outline_locked` and fix auth. |
| Mobile write room | NEEDS PRECONDITION | Same write-room gate; `WriterMobileLayout.tsx` exists | Rerun after locked outline project. |

## Verdict terhadap plan lama

Jangan mulai Sprint 2. Jangan ulang seluruh roadmap. Repo butuh stabilization sprint dan targeted feature gap closure, terutama auth/session, real foundation/outline AI, write-room test preconditions, dan validator hardening.
