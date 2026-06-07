# Task 2.3 — Core Migration

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat migration SQL awal Sprint 2: 9 tabel core + `audit_logs`, enums selaras `@vibenovel/shared`, RLS, triggers, indexes — tanpa seed, remote push, atau perubahan app source.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `supabase/README.md`
- `supabase/config.toml`
- `.agents/rules/00-read-first.md`
- `.agents/rules/01-document-navigation-map.md`
- `.agents/rules/02-sprint-discipline.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/migrations/00001_sprint2_core.sql` | Created — full migration |
| `supabase/README.md` | Updated — dokumentasi migration 00001 |
| `.agent-logs/sprint-2/task-2.3-core-migration.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, `apps/api`, `packages/shared`, routes, UI, seed.

## Commands run

| Command | Result |
|---|---|
| `supabase --version` | PASS — 2.104.0 |
| `docker --version` | FAIL — Docker tidak terpasang / tidak di PATH |
| `supabase db reset` | FAIL — Docker Desktop prerequisite tidak tersedia |
| `npm run typecheck` | tidak dijalankan (no TS source changes) |
| `npm run build:web` | tidak dijalankan |
| `supabase db push` | tidak dijalankan (explicit scope ban) |
| `git diff --stat` | dijalankan — README modified; migration untracked |

## Results

- Migration `00001_sprint2_core.sql` dibuat (~550 baris): extensions, 27 enum types, 10 tables, indexes, triggers, RLS policies, grants.
- Local `supabase db reset` **tidak diverifikasi runtime** karena Docker tidak tersedia.
- Pemeriksaan statis: struktur SQL mengikuti doc 27/28 dan shared enums; circular FK `ai_proposals` ↔ `facts` diselesaikan dengan deferred ALTER.

## Decisions

- **Enums tambahan** di luar daftar minimal user: `project_entry_path`, `character_importance`, `character_source`, `speech_rule_source` — diperlukan kolom tabel, selaras shared.
- **`audit_logs.action`** memakai enum `audit_action` (bukan `event_type` text di doc 28 draft).
- **`audit_logs`** field `before_data` / `after_data` jsonb per spec Task 2.3; append-only (no UPDATE/DELETE policy untuk authenticated).
- **`facts` DELETE** tidak ada policy — deprecate via `canon_status`.
- **`credit_balances`** authenticated SELECT only; INSERT/UPDATE via service role (seed Task 2.4 / admin).
- **Partial unique index** `projects_one_active_per_owner_idx` WHERE `is_active = true`.
- **`is_project_owner`** SECURITY DEFINER untuk hindari recursion RLS.
- **Child tables** ON DELETE CASCADE dari `projects`; `audit_logs` FK SET NULL on delete.

## Limitations

- Migration belum di-apply lokal (Docker missing).
- Belum ada trigger `auth.users` → `profiles` insert (Task 2.6).
- Foundation lock saat `is_locked = true` hanya di API layer — belum DB trigger reject update.
- `GRANT DELETE` ke `authenticated` pada semua tabel — RLS tetap membatasi; facts/audit_logs tanpa DELETE policy.
- Enum Postgres harus di-sync manual jika shared enums berubah (belum ada codegen).
- `output_style_preference` enum dibuat tetapi kolom belum dipakai di tabel (settings pakai `default_output_style text`).

## Next recommended task

**Task 2.4 — Seed script (dev/demo)**

Seed `demo-project-001` dari mock Sprint 1 ke DB lokal setelah `supabase db reset` berhasil (perlu Docker). Facts hanya confirmed canon; minimal 1 `ai_proposal` status `proposed`.