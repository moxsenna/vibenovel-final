# Task 2.8 — Project Settings API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat API persistence untuk `project_settings`: authenticated owner dapat GET dan PUT preferensi project (mode kualitas, format, gaya output, target panjang). Tanpa frontend wiring, tanpa foundation/characters/facts API.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/services/audit.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.7-project-persistence-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/project-settings.ts` | Created — GET/upsert + validation |
| `apps/api/src/routes/project-settings.ts` | Created — GET + PUT endpoints |
| `apps/api/src/routes/index.ts` | Register settings routes |
| `apps/api/src/lib/mappers.ts` | `ProjectSettingsRow` mapper + response aliases |
| `apps/api/src/services/audit.ts` | Added `beforeData` / `afterData` support |
| `apps/api/src/services/project.ts` | Export `getOwnedProjectRow` for reuse |
| `apps/api/README.md` | Settings endpoints documentation |
| `.agent-logs/sprint-2/task-2.8-project-settings-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `apps/web`, foundation/characters/facts API, credit balance.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm install` | tidak dijalankan — tidak ada dependency baru |
| `GET /api/projects/:id/settings` tanpa token | PASS — 401 |
| `GET settings` dengan JWT + project sendiri | PASS — 200, default `seimbang` |
| `PUT qualityMode: terbaik` | PASS — 200 |
| `PUT qualityMode: hemat` | PASS — 200 |
| `PUT qualityMode: gemini-pro` | PASS — 400 |
| `GET settings` setelah PUT | PASS — `hemat` tersimpan |
| Seed project settings user lain | PASS — 404 |
| `git push` / remote deploy / migration push | tidak dijalankan |

## Results

- `GET /api/projects/:id/settings` dan `PUT /api/projects/:id/settings` tersedia.
- Auth middleware wajib; ownership via `getOwnedProjectRow` (id + owner_id).
- GET membuat default settings jika belum ada.
- PUT upsert/update dengan validasi enum shared constants.
- Response camelCase + aliases (`qualityMode`, `mobileFormatPreference`, dll.).
- Audit `settings_updated` dengan `changedFields`, `before_data`, `after_data` ringkas.
- Raw model/provider strings ditolak (400).

## Decisions

1. **Schema-bound fields:** `quality_tier`, `output_style_preference`, `default_format`, `target_length_band` di `project_settings`.
2. **`defaultLanguage`:** Disimpan di `profiles.default_language` (user-level); disertakan di GET/PUT response context.
3. **`defaultGenre`:** Disimpan di `projects.genre` (project-level, kolom ada).
4. **`defaultReaderTarget`:** Ditolak 400 — hanya ada di `story_foundations` (Task 2.9).
5. **`metadata` PUT:** Ditolak 400 — tidak ada kolom metadata di `project_settings`.
6. **API aliases:** Terima `qualityMode`/`qualityTier`, `mobileFormatPreference`/`defaultFormat`, `targetLengthPlan`/`targetLengthBand`.
7. **Export `getOwnedProjectRow`:** Reuse ownership guard dari Task 2.7.

## Limitations

- `defaultReaderTarget` belum persist (foundation API deferred).
- `defaultLanguage` user-level di `profiles`, bukan per-project di schema.
- Frontend Settings belum terhubung API.
- Tidak ada automated integration test file.
- `defaultOutputStyle` di response adalah label display; enum asli di `outputStylePreference`.

## Next recommended task

**Task 2.9 — Story foundation + characters + facts API** (`GET/PUT /projects/:id/foundation`, characters/facts CRUD manual).