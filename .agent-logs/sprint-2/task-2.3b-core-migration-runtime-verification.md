# Task 2.3b — Core Migration Runtime Verification & Fix

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed (runtime-approved)

## Task goal

Verifikasi runtime migration `00001_sprint2_core.sql` via `supabase db reset` lokal; perbaiki error SQL/RLS/constraint jika ada. Tanpa seed, remote push, atau perubahan app.

## Files read

- `supabase/migrations/00001_sprint2_core.sql`
- `docs/28-supabase-rls-policy-draft.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/migrations/00001_sprint2_core.sql` | Updated — `output_style_preference` enum column; `is_project_owner` dipindah setelah `CREATE TABLE projects` |
| `.gitignore` | Updated — ignore `supabase/.branches/`, `supabase/.temp/` |
| `.agent-logs/sprint-2/task-2.3b-core-migration-runtime-verification.md` | Updated (log ini) |

**Tidak diubah:** `apps/web`, `apps/api`, `packages/shared`, seed, UI.

## Commands run

| Command | Result |
|---|---|
| `supabase --version` | PASS — 2.104.0 |
| `docker --version` (awal) | FAIL — tidak di PATH / belum terinstal |
| `winget install Docker.DockerDesktop` | PASS — Docker Desktop 4.76.0 terinstal |
| `docker desktop start` | PASS — engine perlu start eksplisit setelah install |
| `supabase start` | PASS (setelah fix migration) — pertama gagal karena SQL error |
| `supabase db reset` | **PASS** — `Applying migration 00001_sprint2_core.sql` → `Finished supabase db reset` |
| `supabase db push` | tidak dijalankan |
| `git status` | dijalankan |
| `git diff --stat` | dijalankan |

## Runtime timeline

### 1. Docker awalnya belum tersedia

- Task 2.3: `docker` tidak dikenali; `supabase db reset` gagal dengan pipe `docker_engine` tidak ditemukan.
- Task 2.3b awal: sama — verifikasi diblokir environment.

### 2. Docker Desktop diinstal via winget

```txt
winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
→ Successfully installed (4.76.0)
```

### 3. Docker engine perlu start eksplisit

- Install saja tidak cukup — `docker info` gagal sampai `docker desktop start` dijalankan.
- Antara sesi terminal, engine kadang mati; workaround: `docker desktop start` + tunggu `docker ps` OK dalam satu command chain.

### 4. Migration error pertama (SQL)

Saat `supabase start` / apply migration:

```txt
ERROR: relation "public.projects" does not exist (SQLSTATE 42P01)
At statement: CREATE OR REPLACE FUNCTION public.is_project_owner(...)
         FROM public.projects p
```

### 5. Penyebab

Fungsi `is_project_owner()` didefinisikan di section **Helpers** sebelum `CREATE TABLE public.projects`, sehingga Postgres menolak referensi ke relasi yang belum ada.

### 6. Fix

- Pindahkan `CREATE OR REPLACE FUNCTION public.is_project_owner(...)` ke **setelah** `CREATE TABLE projects` + trigger `projects_set_updated_at`.
- `set_updated_at()` tetap di awal (tidak referensi tabel domain).

### 7. Hasil akhir

```txt
Applying migration 00001_sprint2_core.sql...
NOTICE: extension "pgcrypto" already exists, skipping
WARN: no files matched pattern: supabase/seed.sql   ← normal, seed belum ada
Finished supabase db reset on branch main.
```

**`supabase db reset` PASS** — migration 00001 runtime-approved.

## Fix lain (Task 2.3b awal, sudah termasuk di 00001)

| Issue | Fix |
|---|---|
| `project_settings.default_output_style` pakai `text` | Kolom → `output_style_preference public.output_style_preference NOT NULL DEFAULT 'warm_emotional'` |

## Pemeriksaan konsistensi (post-fix)

| Check | Status |
|---|---|
| RLS child via `is_project_owner(project_id)` | ✅ |
| `audit_logs` append-only untuk authenticated | ✅ |
| `facts.source` tanpa jalur AI direct | ✅ |
| `ai_proposals.status` default `proposed` | ✅ |
| `facts.canon_status` default `confirmed` | ✅ |
| Enum shared vs Postgres | ✅ |

## Decisions

- Migration tetap satu file `00001` (belum pernah applied sukses sebelum fix).
- `supabase/.branches/` dan `supabase/.temp/` di-`.gitignore` — artefak CLI lokal, bukan source of truth.
- Tidak commit nilai key dari output `supabase start`.

## Limitations

- `packages/shared` `ProjectSettings.defaultOutputStyle` masih `string` — diselaraskan saat integrasi API.
- Trigger `auth.users` → `profiles` belum ada (Task 2.6).
- Peringatan `Skipping migration .gitkeep` — normal.
- Docker harus di-start manual sebelum perintah Supabase di mesin dev ini.

## Next recommended task

**Task 2.4 — Seed script (dev/demo)** — setelah checkpoint git Task 2.3 + 2.3b.