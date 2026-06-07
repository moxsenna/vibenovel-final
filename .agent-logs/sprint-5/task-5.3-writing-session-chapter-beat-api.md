# Task 5.3 — Writing Session & Chapter Beat API

## Task goal

Implement Sprint 5 Task 5.3: API untuk start/resume writing session, load/generate chapter beats (deterministic stub), light beat PATCH, dan mark session `ready_for_summary`. No prose draft API, no UI, no OpenRouter/AI.

## Files read

- README.md
- docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md
- docs/33-sprint-4-verification-report.md
- supabase/migrations/00004_sprint5_write_room.sql
- packages/shared/src/enums.ts
- packages/shared/src/domain.ts
- apps/api/src/services/context-packet-builder.ts
- apps/api/src/services/context-packet-safety.ts
- apps/api/src/services/write-snapshot.ts
- apps/api/src/services/project.ts
- apps/api/src/lib/mappers.ts
- apps/api/src/middleware/auth.ts
- apps/api/README.md
- apps/web/src/mocks/chapter.ts
- .agents/rules/09-agent-work-logs.md
- apps/api/src/routes/write.ts (Task 5.2 baseline)
- apps/api/src/services/chapter-outline.ts (PATCH validation patterns)
- supabase/seed.sql (Bab 1 beat seed)
- scripts/sprint5-smoke-api.ps1

## Files created/changed

| Path | Note |
|---|---|
| `apps/api/src/services/write-session.ts` | **Created** — session start/resume, GET detail, PATCH, ready-for-summary |
| `apps/api/src/services/chapter-beat.ts` | **Created** — beat list, stub generate, PATCH; `STUB_BEAT_TEMPLATES` |
| `apps/api/src/routes/write.ts` | **Extended** — 7 new endpoints (sessions + beats) |
| `apps/api/src/lib/mappers.ts` | **Extended** — `WritingSessionRow`, `ChapterWritingStateRow` mappers |
| `apps/api/README.md` | **Updated** — Task 5.3 endpoint docs + structure |
| `scripts/sprint5-smoke-api.ps1` | **Extended** — 13 new smoke steps for Task 5.3 |

## Commands run

```bash
npm run typecheck:api          # PASS
npm run typecheck              # PASS
npm run build:shared           # PASS
npm run build:web              # PASS
npm run build:api              # PASS (wrangler dry-run)
npm run smoke:api              # PASS (17/17)
powershell -File scripts/sprint5-smoke-api.ps1  # PASS (27/27, 2nd run; 1st run failed on transient project insert 500)
```

## Results

| Check | Result |
|---|---|
| typecheck:api | PASS |
| typecheck (shared/web/api) | PASS |
| build:shared | PASS |
| build:web | PASS |
| build:api | PASS |
| smoke:api (sprint2) | PASS 17/17 |
| sprint5-smoke-api.ps1 | PASS 27/27 (retry after transient `projects insert failed`) |

Runtime verification (sprint5 smoke):

- POST session no token → 401
- POST session on outline_locked project → 200/201 active
- POST session again → same session (idempotent)
- GET session → 200 with safe chapter summary, beatsCount
- GET beats before generate → []
- POST beats/generate → 5 beats
- POST beats/generate regenerate=false → existing (created=false)
- PATCH beat status/direction → 200
- PATCH beat proseText → 400
- PATCH session activeBeatId → 200
- POST ready-for-summary → 200
- Canon fact/character counts unchanged
- Cross-user session → 404

## Decisions

1. **Gate reuse:** `assertWriteRoomGates` from `write-snapshot.ts` — same 409 `details.missing` as Task 5.2.
2. **Session idempotency:** Partial unique index `writing_sessions_one_active_per_chapter_idx`; race on insert handled with 23505 retry fetch.
3. **Beat generate scope:** Beats keyed by `chapter_outline_id`; `regenerate=false` returns existing chapter beats and links `writing_session_id` if null.
4. **regenerate=true:** Deletes chapter beats only when no `chapter_prose_versions` rows; clears `active_beat_id` on session.
5. **Stub beats:** 5 templates parity seed/mock Bab 1 titles; all new generated beats `status=empty` (seed may have `draft` on beat 1).
6. **ready_for_summary:** Marker only — requires ≥1 beat; no summary/canon writes.
7. **No auto context packet** on beat generate (per user preference).
8. **workflow_phase:** Set to `writing` only when creating new session from `outline_locked`.

## Limitations

- No prose draft persistence API (Task 5.4).
- No WritePage integration, OpenRouter, AI generation, model router, full validator.
- No chapter summary / canon update on ready-for-summary.
- No audit_logs for session/beat operations.
- `regenerate=true` hard-deletes beats (no soft archive).
- Seed project Bab 1 may already have 5 beats — generate returns existing without re-stubbing.
- First sprint5 smoke run hit transient `projects insert failed` (500); retry passed.

## Next recommended task

**Task 5.4 — Prose Draft API:** persist `chapter_prose_versions` per beat, reject planningTruth in body, link context packet log id optional, still no canon mutation until Sprint 6 summary.