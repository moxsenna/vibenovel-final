# Task 2.9 — Story Foundation + Characters + Facts API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat API persistence manual untuk Fondasi Cerita, Characters, dan Facts — owner authenticated dapat GET/PUT foundation, CRUD characters, CRUD/deprecate facts. Tanpa AI generation, tanpa proposal workflow, tanpa frontend wiring.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/project-settings.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/project-settings.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.8-project-settings-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/foundation.ts` | Created — GET bundle + PUT upsert + lock |
| `apps/api/src/services/character.ts` | Created — list/create/update/archive |
| `apps/api/src/services/fact.ts` | Created — list/create/update/deprecate + canon guard |
| `apps/api/src/routes/foundation.ts` | Created — GET/PUT foundation |
| `apps/api/src/routes/characters.ts` | Created — character CRUD |
| `apps/api/src/routes/facts.ts` | Created — fact CRUD |
| `apps/api/src/routes/index.ts` | Register new routes |
| `apps/api/src/lib/mappers.ts` | Foundation/Character/Fact mappers |
| `apps/api/README.md` | Endpoint documentation |
| `.agent-logs/sprint-2/task-2.9-foundation-characters-facts-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `apps/web`, speech rules API, AI proposals, credit balance.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm install` | tidak dijalankan — tidak ada dependency baru |
| `GET /foundation` tanpa token | PASS — 401 |
| `GET foundation` dengan JWT | PASS — 200 |
| `PUT foundation` | PASS — 200 |
| `POST character` | PASS — 201 |
| `PATCH character` | PASS — 200 |
| `POST fact source=user` | PASS — 201 |
| `POST fact source=ai_direct` | PASS — 400 |
| `POST fact source=openrouter` | PASS — 400 |
| `DELETE fact` | PASS — `canonStatus: deprecated` |
| Seed project cross-user | PASS — 404 |
| `git push` / remote deploy / migration push | tidak dijalankan |

## Results

- 10 endpoint baru (foundation 2, characters 4, facts 4) semua protected auth.
- Ownership via `getOwnedProjectRow` + child table `project_id` filter.
- GET foundation bundle: foundation + active characters + confirmed facts.
- Foundation lock enforcement pada core fields.
- Character DELETE = `status: archived`.
- Fact DELETE = `canon_status: deprecated` (no hard delete).
- AI direct sources ditolak pada facts POST.

## Decisions

1. **GET foundation creates default row** jika belum ada (konsisten Task 2.8 settings).
2. **workingTitle** di PUT foundation → update `projects.title` (field tidak ada di `story_foundations`).
3. **Character POST source** hanya `user`; `system_seed` reserved seed.
4. **Fact POST source** hanya `user` atau `system`.
5. **Speech rules** tidak disertakan di bundle (Task 2.10).
6. **Foundation audit:** `foundation_created` pada first persist, `foundation_locked` saat lock, else `foundation_updated`.

## Limitations

- `accepted_proposal` source tidak bisa dibuat manual via API (workflow Task 2.11).
- Speech rules tidak di bundle foundation.
- AI proposal queue belum terhubung.
- Frontend foundation page belum wired ke API.
- `defaultReaderTarget` tidak ada kolom terpisah di foundation PUT (gunakan `targetReader` text).
- Tidak ada automated integration test file.

## Next recommended task

**Task 2.10 — Relationship speech rules API** (`GET/POST/PATCH /projects/:id/speech-rules`).