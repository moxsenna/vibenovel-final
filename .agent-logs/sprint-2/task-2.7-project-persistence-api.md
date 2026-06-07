# Task 2.7 — Project Persistence API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat API persistence untuk projects: authenticated user dapat create, list, detail, update, dan soft-archive project miliknya sendiri. Tanpa frontend wiring, tanpa settings/foundation API penuh, tanpa Task 2.8+.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/me.ts`
- `apps/api/src/lib/supabase.ts`
- `apps/api/src/services/profile.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.6-auth-shell-profiles.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/audit.ts` | Created — append-only `audit_logs` writer |
| `apps/api/src/services/project.ts` | Created — CRUD + validation + ownership guards |
| `apps/api/src/routes/projects.ts` | Created — 5 project endpoints |
| `apps/api/src/routes/index.ts` | Register project routes |
| `apps/api/src/lib/mappers.ts` | Added `ProjectRow` → `Project` mapper |
| `apps/api/README.md` | Project endpoints + security notes |
| `.agent-logs/sprint-2/task-2.7-project-persistence-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `apps/web` UI/routes, settings/foundation API, credit deduction, OpenRouter.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm install` | tidak dijalankan — tidak ada dependency baru |
| `npm run dev:api` | PASS |
| `GET /api/projects` tanpa token | PASS — 401 |
| `POST /api/projects` dengan JWT baru | PASS — 201 setelah profile sync |
| `GET /api/projects` | PASS — project muncul |
| `GET /api/projects/:id` | PASS — detail |
| `PATCH /api/projects/:id` | PASS — title/status updated |
| `DELETE /api/projects/:id` | PASS — `isActive: false` |
| `GET /api/projects` setelah archive | PASS — count 0 (default) |
| `GET /api/projects?includeArchived=true` | PASS — count 1 |
| `GET /api/projects/:seedId` user lain | PASS — 404 |
| `git push` / remote deploy / migration push | tidak dijalankan |

## Results

- 5 endpoint `/api/projects` protected by `authMiddleware`.
- Service role + explicit `owner_id` filter pada semua operasi.
- Cross-user access → 404 (tidak bocorkan kepemilikan).
- POST create: profile sync dulu (`getOrCreateProfileForAuthUser`), lalu insert project + default `project_settings`.
- Audit: `project_created` on create; `project_updated` on patch/archive (archive metadata `reason: "archive"`).
- Archive via DELETE — soft only (`is_active = false`), tidak hard delete.
- Default list excludes `is_active = false`; `includeArchived=true` includes all.

## Decisions

1. **Archive tanpa enum `archived`:** `project_status` hanya `draft | in_progress | published`. Archive = `is_active = false` + audit metadata. List default filter `is_active = true`.
2. **DELETE bukan hard delete:** Sesuai guardrail; row tetap di DB.
3. **Service role + owner filter:** Konsisten Task 2.6; tidak percaya body `owner_id`.
4. **Profile sync on POST:** FK `projects.owner_id → profiles` — user baru wajib profile sebelum insert project.
5. **`is_active` on create:** `true` hanya jika user belum punya active project (unique index `projects_one_active_per_owner_idx`).
6. **`isActive` PATCH true:** Deactivate project aktif lain milik user yang sama sebelum activate.
7. **`targetLengthPlan`:** Disimpan di `project_settings.target_length_band`, bukan kolom `projects`.

## Limitations

- Tidak ada `project_status = archived` di schema — archive indistinguishable dari inactive non-active project kecuali audit log.
- `POST /projects/:id/activate` belum ada (deferred).
- Settings read/update penuh (Task 2.8) belum ada — hanya default row on create + `targetLengthPlan` via PATCH.
- Frontend dashboard belum terhubung API.
- Seed user `penulis@contoh.id` login via GoTrue tidak diverifikasi ulang; runtime test memakai signup user baru.
- Tidak ada integration test file otomatis — verifikasi manual HTTP.

## Next recommended task

**Task 2.8 — Project settings API** (`GET/PUT /projects/:id/settings`, quality tier validation, persist Hemat/Seimbang/Terbaik).