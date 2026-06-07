# Task 2.2 — Supabase Setup & RLS Policy Draft

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Menyiapkan struktur Supabase dan rancangan RLS Sprint 2 sebelum migration tabel core. Fokus setup, dokumentasi, policy draft — tanpa apply migration, tanpa backend/API production, tanpa ubah source app.

## Files read

- `README.md`
- `docs/22-sprint-1-verification-report.md` (status Sprint 1)
- `docs/23-legacy-vibenovel-audit.md` (guardrail legacy)
- `docs/24-feature-migration-map.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/26-current-sprint-plan.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `.agents/rules/00-read-first.md`
- `.agents/rules/01-document-navigation-map.md`
- `.agents/rules/02-sprint-discipline.md`
- `.agents/rules/09-agent-work-logs.md`
- `supabase/README.md` (placeholder sebelumnya)
- `.gitignore`

## Files created/changed

| File | Action |
|---|---|
| `supabase/README.md` | Updated — tujuan, workflow migration, larangan secret |
| `supabase/config.toml` | Created — minimal local Supabase CLI config |
| `supabase/migrations/.gitkeep` | Created — placeholder (no SQL migration) |
| `supabase/seed/.gitkeep` | Created — placeholder untuk Task 2.4 |
| `docs/28-supabase-rls-policy-draft.md` | Created — RLS draft lengkap sections A–H |
| `.agent-logs/sprint-2/task-2.2-supabase-setup-rls-policy-draft.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, `apps/api`, `packages/shared`, routes, UI.

## Commands run

| Command | Result |
|---|---|
| `npm install` | tidak dijalankan (scope docs/config only) |
| `npm run typecheck` | tidak dijalankan (no package source changes) |
| `npm run build:web` | tidak dijalankan |
| `supabase start` | tidak dijalankan (no local CLI apply in 2.2) |
| `supabase link` | tidak dijalankan |
| `supabase db push` | tidak dijalankan |
| `git diff --stat` | dijalankan — verifikasi scope |

## Results

- Folder `supabase/` siap: `config.toml`, `migrations/`, `seed/`, README.
- `docs/28` mencakup 9 tabel core + keputusan `audit_logs` (ya, Task 2.3).
- RLS draft per tabel: SELECT/INSERT/UPDATE/DELETE pseudocode.
- Ownership model: `profiles.id = auth.uid()`, `projects.owner_id = auth.uid()`, child via `is_project_owner(project_id)`.
- Canon guardrails dan security notes terdokumentasi.
- Tidak ada migration SQL final 9 tabel.
- Tidak ada secret/env value ditulis.

## Decisions

- **`audit_logs` ditambahkan** sebagai tabel ke-10 ringan di Task 2.3 (append-only, API insert only).
- **Tidak membuat `00001_sprint2_core.sql`** di Task 2.2 — hanya `.gitkeep` di `migrations/`.
- **`config.toml`** menggunakan `project_id = "vibenovel-local"` untuk dev lokal; belum link remote.
- **Canon writes sensitif** (`facts` insert user, accept proposal) direkomendasikan lewat service role API meskipun RLS owner bisa mengizinkan client — konsistensi audit + transaction.
- **`facts` DELETE denied** di RLS draft — deprecate via status, align `FACT_CANON_STATUSES`.
- Helper function `is_project_owner(project_id)` direncanakan di migration 2.3 untuk DRY policies.

## Limitations

- RLS masih pseudocode — SQL `CREATE POLICY` final belum ada sampai Task 2.3.
- `supabase start` belum diverifikasi (CLI mungkin belum terpasang di mesin dev).
- Tidak ada `.env.example` dibuat (di luar scope eksplisit task; nama variabel hanya di README/doc 28).
- Remote Supabase project belum dibuat/dilink.
- Enum Postgres belum di-generate dari shared — checklist di appendix doc 28 untuk 2.3.

## Next recommended task

**Task 2.3 — Core migration (9 tables + audit_logs)**

Buat `supabase/migrations/00001_sprint2_core.sql` dengan PK/FK, indexes, CHECK constraints selaras `@vibenovel/shared`, helper `is_project_owner`, RLS policies dari doc 28. Test lokal `supabase db reset` — **tanpa** remote push tanpa approval user.