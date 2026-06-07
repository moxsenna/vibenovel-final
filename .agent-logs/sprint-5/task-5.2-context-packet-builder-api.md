# Task 5.2 — Context Packet Builder API

**Date:** 2026-06-08
**Sprint:** sprint-5
**Status:** completed

## Task goal

Membuat backend Context Packet Builder aman: POST build + persist `context_packet_logs`, GET preview redacted. Gate `outline_locked` / foundation locked. Tanpa Writing Session API, Beat API, Prose API, web, OpenRouter, AI generation.

## Files read

- `README.md`
- `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
- `docs/33-sprint-4-verification-report.md`
- `supabase/migrations/00004_sprint5_write_room.sql`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `apps/api/src/services/outline.ts`, `outline-snapshot.ts`, `chapter-outline.ts`, `outline-tracking.ts`, `project.ts`
- `apps/api/src/lib/mappers.ts`, `middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/context-packet-safety.ts` | Created — hash, assertWriterPacketSafe, forbidden concepts |
| `apps/api/src/services/write-snapshot.ts` | Created — gate + snapshot loader (no planning_truth SELECT) |
| `apps/api/src/services/context-packet-builder.ts` | Created — build, persist, preview |
| `apps/api/src/routes/write.ts` | Created — POST/GET endpoints |
| `apps/api/src/routes/index.ts` | Register write routes |
| `apps/api/src/lib/mappers.ts` | ChapterBeatRow, PlannedRevealSafeRow mappers |
| `apps/api/README.md` | Context Packet section |
| `scripts/sprint5-smoke-api.ps1` | Created — runtime verification (14 tests) |
| `.agent-logs/sprint-5/task-5.2-context-packet-builder-api.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, migrations, `packages/shared` (types sudah Task 5.1).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run dev:api` | Running (restart for new routes) |
| `scripts/sprint5-smoke-api.ps1` | PASS — 14/14 |
| `npm run smoke:web:outline` | tidak dijalankan |

## Results

- POST `/api/projects/:id/write/context-packet` builds slice-only packet, asserts safety, inserts `context_packet_logs`, returns preview + safety meta.
- GET `/api/projects/:id/write/context-packet/:logId/preview` returns redacted preview only.
- Gate 409 with `details.missing` when outline/foundation not ready.
- `planned_reveals` queried without `planning_truth` column.
- Chapter 1 packet excludes chapter 2+ title in API response.
- Canon counts unchanged post-build (smoke verified).

## Decisions

1. **`write-snapshot.ts` separate from `outline-snapshot.ts`** — write gate allows `outline_locked` OR `writing`; does not require generate-only flow.
2. **`PlannedRevealSafeRow`** — explicit SELECT columns excluding `planning_truth`.
3. **SHA-256 via `crypto.subtle`** — canonical sorted JSON for `packet_hash`.
4. **`assertWriterPacketSafe` before INSERT** — unsafe packet → 500, no log row.
5. **Response never includes `packetJson`** — only `WriterContextPacketPreview` + safety flags.
6. **`writing_session_id` null** — deferred to Task 5.3.
7. **Breadcrumb MVP** — `reader_facing_hint` only when `forbidden_before_chapter <= current`; no `planning_truth` translation.
8. **Open loop payoff redaction** — hide `readerFacingHint` when payoff chapter > current.

## Limitations

- No Writing Session / Beat / Prose APIs (Task 5.3–5.4).
- No beatId cross-chapter validation beyond DB FK scope (beat must match chapter_outline_id).
- GET preview re-runs safety on stored packet without future-title list (forbidden-key check only).
- `smoke:web:outline` not re-run.
- Sprint 5 smoke script not wired to `package.json` yet (Task 5.6/5.7).

## Next recommended task

**Task 5.3 — Chapter Beat / Session API** (`writing_sessions`, beat generate/load, link optional `writing_session_id` on context packet).