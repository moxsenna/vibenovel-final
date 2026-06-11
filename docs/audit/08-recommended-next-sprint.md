# 08 - Recommended Next Sprint

## Nama sprint yang direkomendasikan

Production Story-Flow Stabilization and Real Foundation/Outline Generation.

## Tujuan

Membuat flow yang sekarang gagal di E2E berjalan jujur di API/production-like mode:

- login/session stabil;
- konsep muncul 3 opsi;
- foundation proposal benar-benar muncul dan readiness naik;
- outline 10 bab dibuat dari locked foundation;
- write room terbuka saat precondition valid;
- settings/credit UI tidak stuck loading.

## Task urut prioritas

| Priority | Task | Scope |
|---|---|---|
| P0 | Auth/session production alignment | Pastikan web Supabase URL/key, API Supabase URL/anon/service role, token refresh, and logout route guard konsisten. |
| P0 | Rerun auth/settings regression | Pakai `auth-settings-regression.spec.ts` di production-like local env. |
| P0 | Stabilize concept generation E2E | Pastikan `Buat 3 Konsep Cerita` mengembalikan 3 konsep user-specific. |
| P0 | Real foundation proposal generator | Ganti reliance pada `foundation_stub_batch` untuk API mode real. |
| P0 | Real outline generator | Ganti `outline_stub_deterministic` dengan generator berdasarkan locked foundation. |
| P1 | Write-room test fixture | Siapkan project test sampai `outline_locked` sebelum membuka `/write`. |
| P1 | Credit/settings UI regression | Pastikan quality mode persists and cost estimates numeric. |
| P1 | Honest Draft Import gate | Jika belum dibangun, UI/test harus menyatakan "belum tersedia", bukan panel deteksi kosong yang tampak gagal. |
| P2 | Add CI subset | Masukkan auth/settings regression atau smoke minimal ke CI/nightly. |
| P2 | Bundle split | Code-split route-heavy web bundle. |

## Scope yang boleh

- Fix auth/session handling and production env alignment.
- Add/adjust tests for failed user flows.
- Implement real foundation and outline AI generation if explicitly accepted as next sprint.
- Improve honest locked/empty states.
- Add validation around existing API routes.

## Scope yang dilarang untuk sprint stabilisasi

- Enable production payment.
- Apply payment migration `00010` to production without founder gate.
- Add unrelated Creator Mode/Draft Import full implementation unless separately scoped.
- Move engine architecture to `packages/core` in the same sprint.
- Refactor large UI system unrelated to failed flows.

## Acceptance criteria

1. Signed-out API-mode visit to `/dashboard` redirects to `/login` and does not show user content.
2. Logout clears local session and dashboard cannot be accessed afterward.
3. Stale token either refreshes and retries once or clears session and redirects.
4. Concept generation returns exactly 3 concepts after a real intake message.
5. Foundation proposal generation creates proposal rows and readiness increases above 0%.
6. Lock foundation succeeds after required approvals.
7. Outline generation creates 10 chapters from the locked foundation, not static Nadira/Arman/Siska template.
8. Write room opens for a project with locked outline on desktop and mobile viewport.
9. Settings `Terbaik` persists after reload.
10. Settings and write/publish surfaces show numeric credit costs.

## Prompt siap pakai untuk next task

```text
Baca docs/audit/00 sampai docs/audit/09. Kerjakan sprint stabilisasi P0 saja: perbaiki auth/session production-like API mode, rerun auth-settings regression, lalu pastikan flow intake -> 3 concepts -> foundation proposal -> readiness -> outline generation -> write room bisa berjalan tanpa "Invalid or expired access token". Jangan enable payment. Jangan implement Draft Import penuh. Jangan refactor besar. Setelah perubahan, jalankan typecheck, build:web, build:api, dan E2E terkait, lalu tulis laporan hasil di docs/.
```
