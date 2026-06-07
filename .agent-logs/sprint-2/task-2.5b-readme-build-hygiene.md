# Task 2.5b — README & Build Hygiene Before Auth

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Memperbaiki dokumentasi status repo dan build script kecil sebelum Task 2.6 Auth Shell, agar README dan root scripts sesuai kondisi Sprint 2 sekarang. Tanpa perubahan behavior aplikasi, tanpa auth, tanpa CRUD, tanpa UI/migration/seed changes.

## Files read

- `README.md`
- `package.json` (root)
- `packages/shared/package.json`
- `apps/api/package.json`
- `apps/api/README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `README.md` | Updated — status Sprint 2, struktur repo, perintah root, progress table |
| `package.json` (root) | Updated — `build:api` menjalankan `build:shared` dulu |
| `.agent-logs/sprint-2/task-2.5b-readme-build-hygiene.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, `apps/api` source, migrations, seed, dependencies, UI routes.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS (shared → web → api) |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS (build:shared lalu wrangler dry-run) |

## Results

- README mencerminkan status aktual: web Sprint 1 complete, api scaffold 2.5, shared 2.1, supabase 2.3/2.4.
- Semua root scripts didokumentasikan: dev, typecheck (per-package), build (shared/web/api).
- `build:api` sekarang memastikan `@vibenovel/shared` `dist/` ada sebelum Worker bundle (exports `import` → `./dist/index.js`).
- Urutan `typecheck` tetap shared → web → api.
- Tidak ada dependency baru; tidak ada perubahan endpoint atau logic API.

## Decisions

- **`build:api` chain** — `npm run build:shared && npm run build -w @vibenovel/api` karena `packages/shared` runtime export mengarah ke `dist/index.js`.
- **README Sprint 2 table** — menambahkan progress 2.1–2.5b dan menandai 2.6 sebagai next; menghapus referensi usang "Sprint 1.5 legacy audit" sebagai langkah berikutnya.
- **Supabase section singkat** — link ke `supabase/README.md` tanpa menduplikasi detail migration.

## Limitations

- `apps/api/README.md` tidak diubah (sudah akurat untuk Task 2.5).
- Tidak ada perubahan `build:web` chain ke shared (web belum impor `@vibenovel/shared` di runtime).
- Tidak ada commit/push dalam scope task ini kecuali user meminta.

## Next recommended task

**Task 2.6 — Auth Shell + Profiles:** Supabase JWT validation, register/login/logout routes, `profiles` sync on first sign-in, `GET /api/me` dengan profile + credit balance; minimal web auth context tanpa redesign AppShell.