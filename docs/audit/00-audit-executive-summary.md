# 00 - Audit Executive Summary

Tanggal audit: 2026-06-11

Scope audit ini read-only. Tidak ada perubahan kode aplikasi, schema, auth, Supabase, AI, credit, payment, atau refactor. Perubahan yang dibuat hanya file markdown di `docs/audit/`.

## Status repo dalam 1 halaman

| Area | Status audit |
|---|---|
| Tahap repo | Bukan Sprint 1 awal. Repo sudah berisi web, API, Supabase migrations, AI, credit, payment shell, staging/production docs, dan E2E. |
| Source of truth | `README.md`, `docs/63-updated-product-roadmap-after-sprint-11.md`, `docs/61-roadmap-and-sprint-number-reconciliation.md`, `docs/36-non-blocking-technical-debt-and-deferred-items.md`. |
| Frontend | `apps/web` adalah Vite React app dengan route lengkap: dashboard, intake, concepts, foundation, outline, write, summary, publish, settings, topup. |
| Backend | `apps/api` adalah Hono API dengan auth middleware, Supabase service role boundary, AI/model router, credit ledger, payment callbacks, dan route proyek/story. |
| Shared domain | `packages/shared` berisi domain model luas untuk Canonical Story State, outline, write room, context packet, chapter delta, publish, credit, payment. |
| Core package | `packages/core/README.md` hanya placeholder. Engine saat ini hidup di `apps/api/src/services`. |
| Database | `supabase/migrations/00001` sampai `00010` ada. RLS banyak tersedia. `00010` adalah atomic credit topup RPC dan menurut docs masih production-gated. |
| Mock boundary | Web mock masih ada di `apps/web/src/mocks` dan default dev `VITE_USE_MOCKS=true`. API mode memakai `VITE_USE_MOCKS=false`. |
| Test/build baseline | Typecheck dan build lulus. Tidak ada root `test` atau `lint` script. E2E ada, tetapi tidak dijalankan dalam audit ini karena butuh dev server/env kredensial yang terkendali. |
| Kondisi user-flow E2E terbaru | Banyak kegagalan yang dilaporkan cocok dengan auth/session API (`Invalid or expired access token`) dan beberapa gap produk seperti Draft Import serta foundation/outline AI yang belum sepenuhnya real. |

## Apakah siap lanjut?

Siap lanjut untuk hardening dan perbaikan flow produksi. Belum siap untuk public launch/payment umum tanpa memperbaiki auth/session stability, validator/repair, gate biaya, dan gap feature seperti Draft Import.

Repo tidak perlu "mulai Sprint 2"; Sprint 2 secara arsitektur sudah lama lewat. Yang tepat adalah sprint hardening pasca private beta.

## Top 10 findings

1. `README.md` dan `docs/63` secara eksplisit menyatakan `docs/26-current-sprint-plan.md` sudah historis, bukan task queue hidup.
2. `apps/web/src/routes/index.tsx` sudah punya route produk inti dari `/dashboard` sampai `/projects/:id/write`, `/summary`, `/publish`, `/settings`, dan `/credits/topup`.
3. `apps/web/src/components/layout/AppShell.tsx` sudah punya route guard API mode: signed-out user diarahkan ke `/login`.
4. Pesan E2E `Invalid or expired access token` berasal langsung dari `apps/api/src/middleware/auth.ts` ketika Supabase `auth.getUser(token)` gagal.
5. `apps/web/src/lib/api.ts` sudah mencoba refresh token sekali lalu clear local session jika token tetap invalid.
6. Settings quality mode sekarang disimpan via `localStorage` key `narraza.settings.qualityMode` dan via API `PUT /api/projects/:id/settings` ketika ada active project (`apps/web/src/hooks/useSettingsData.ts`).
7. Cost estimate numerik sudah ada di settings: `apps/web/src/pages/SettingsPage.tsx` menghitung biaya dari `apps/web/src/services/ai.ts`.
8. Concept generation punya jalur OpenRouter ketika `AI_GENERATION_ENABLED=true` dan `AI_PROVIDER_MOCK=false`, tetapi memakai billing alias `publish_copy` (`apps/api/src/services/concept.ts`) dan masih fallback deterministic saat AI tidak aktif.
9. Foundation proposal dan outline generation masih deterministic/stub-oriented: `foundation_stub_batch` di `apps/api/src/services/foundation-proposal.ts` dan `outline_stub_deterministic` di `apps/api/src/services/outline-generator.ts`.
10. Draft Import / Legacy Continuation belum punya route/page khusus di `apps/web/src/routes/index.tsx` dan masih ditandai deferred di `docs/63`.

## Top 10 risks

1. Auth/session drift produksi bisa memblokir semua flow AI karena semua route proyek memakai `authMiddleware`.
2. `VITE_USE_MOCKS` default true untuk dev bisa menyamarkan bug API jika env tidak jelas.
3. Foundation/outline belum sepenuhnya memakai AI real, sehingga flow "generate foundation/outline" bisa terasa template walau API sukses.
4. Draft Import belum diimplementasikan sebagai produk, sehingga test import draft tidak bisa lulus secara jujur tanpa scope baru.
5. Write Room bergantung pada outline terkunci; jika test account belum punya foundation/outline locked, UI benar akan menampilkan "Ruang Tulis belum tersedia".
6. Validator dan Safe Repair belum menjadi pipeline eksplisit dengan persisted `validation_reports`.
7. Character Knowledge Gate per-POV masih partial; Reveal Gate global lebih kuat daripada knowledge-per-character.
8. Production payment tetap gated; `00010` atomic grant tidak boleh diasumsikan aktif di production hanya karena file migration ada.
9. Tidak ada root lint/test script, sehingga CI build/typecheck belum cukup untuk mencegah regresi UI/API yang ditemukan E2E.
10. Build web menghasilkan single JS chunk 684.47 kB, berisiko untuk mobile jika tidak dipecah.

## Rekomendasi next step

1. Lakukan sprint "production story-flow stabilization": perbaiki auth/session/token refresh end-to-end, pastikan production API/web memakai Supabase project yang sama, dan rerun E2E user-flow yang gagal.
2. Setelah auth stabil, lanjutkan `10.31b`: real foundation proposal generation dan outline planning engine integration agar tidak lagi deterministic template.
3. Tambahkan test gate minimal untuk auth/settings/credit/write-room serta unit test safety core sebelum membuka user non-founder.

## Final verdict

**Verdict: NOT_READY_NEEDS_FIX**

Alasan:

- Bukan karena repo kosong. Repo justru sudah jauh melewati Sprint 1 dan Sprint 2.
- Verdict ini dipilih karena user-flow produksi yang dilaporkan masih gagal pada auth/session, foundation/outline/write-room, draft import, dan beberapa state UI.
- Aplikasi layak dilanjutkan, tetapi belum layak dianggap public-ready atau payment-ready.

Interpretasi praktis: jangan mulai Sprint 2; jangan menambah fitur besar dulu; kerjakan stabilisasi flow produksi dan gap yang menghalangi E2E.
