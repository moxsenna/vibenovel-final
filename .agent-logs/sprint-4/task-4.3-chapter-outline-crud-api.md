# Task 4.3 — Chapter Outline CRUD API

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat API untuk membaca dan memperbarui `chapter_outlines` secara manual (list, detail, PATCH) agar outline hasil generator bisa ditinjau/diedit sebelum outline dikunci. Tanpa open loop/reveal CRUD, outline lock workflow, web integration, AI, atau prose writer.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `apps/api/src/services/outline.ts`, `outline-generator.ts`, `outline-snapshot.ts`
- `apps/api/src/lib/mappers.ts`, `middleware/auth.ts`, `services/project.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/chapter-outline.ts` | Created — list, get, PATCH + validation + locked guard |
| `apps/api/src/routes/outline.ts` | Updated — 3 chapter outline endpoints |
| `apps/api/README.md` | Updated — chapter outline CRUD docs |
| `.agent-logs/sprint-4/task-4.3-chapter-outline-crud-api.md` | Created (log ini) |

**Tidak diubah:** migration, seed, web UI, open loop/reveal CRUD, outline lock API, mappers.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Chapter outline runtime verification | PASS — 11/11 |

**Tidak dijalankan:** `supabase db reset` (tidak diperlukan — no schema change).

## Results

### Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/projects/:id/outline/chapters` | JWT | `{ chapters: [] }` if no plan; else ordered list; `?status=`, `?chapterNumber=` |
| GET | `/api/projects/:id/outline/chapters/:chapterId` | JWT | Single `ChapterOutline` camelCase |
| PATCH | `/api/projects/:id/outline/chapters/:chapterId` | JWT | Manual edit; 409 if plan `locked` |

### PATCH allowed fields

`title`, `summary`, `purpose`, `chapterFunction`, `emotionalDirection`, `hook`, `endingHook`, `miniVictory`, `status`, `markers`, `metadata` (light JSON).

Rejected: `chapterNumber`, `outlinePlanId`, `projectId`, `planningTruth`, prose fields (`chapterText`, `prose`, `body`, …).

### Runtime verification (11/11 PASS)

1. GET chapters no token → 401
2. GET chapters list → 10 chapters
3. GET chapter detail → 200
4. PATCH title/endingHook/miniVictory → 200
5. GET confirms update
6. PATCH invalid chapterFunction → 400
7. PATCH chapterText/planningTruth → 400
8. Canon counts unchanged after PATCH
9. Cross-user chapter → 404
10. PATCH when plan locked (via `supabase db query --local`) → 409
11. GET when plan locked → 200

## Decisions

1. **Service terpisah `chapter-outline.ts`** — outline.ts tetap fokus generate/bundle; CRUD chapter tidak membesarkan file.
2. **Routes di `outline.ts`** — prefix `/outline/chapters` konsisten; tidak perlu file route baru.
3. **List tanpa plan → `chapters: []`** — 200 untuk UI generate CTA.
4. **No audit** — `audit_action` belum punya chapter outline events; documented limitation.
5. **Locked guard hanya PATCH** — GET tetap allowed.

## Limitations

- No POST create / DELETE chapter outline (out of Task 4.3 scope).
- No outline unlock or lock workflow API (Task 4.5).
- No automatic sync ke `open_loops` / `planned_reveals` on PATCH.
- No audit log for chapter edits.
- `smoke:api` regression tidak cover chapter endpoints.

## Next recommended task

**Task 4.4 — Reveal & open loop tracking API** (`GET/POST/PATCH .../outline/open-loops`, `.../reveals` dengan `planning_truth` redaction di list).