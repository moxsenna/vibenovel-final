# Task 5.1 — Write Room Data Model + Shared Types

**Date:** 2026-06-08
**Sprint:** sprint-5
**Status:** completed

## Task goal

Membuat data model Sprint 5 untuk Write Room: migration `00004`, shared types/enums, seed Bab 1 beats parity `mockChapterDraft`. Tanpa API, web, Context Packet Builder, OpenRouter, atau AI generation.

## Files read

- `README.md`
- `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
- `docs/33-sprint-4-verification-report.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/mocks/chapter.ts`
- `apps/web/src/pages/WritePage.tsx`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/migrations/00004_sprint5_write_room.sql` | Created — 5 tables, 4 enums, RLS, partial uniques, deferred FKs |
| `packages/shared/src/enums.ts` | Extended — `writing` workflow phase + Sprint 5 status/source enums |
| `packages/shared/src/domain.ts` | Extended — WritingSession, ChapterBeat, WriterContextPacket, etc. |
| `packages/shared/src/index.ts` | Extended — barrel exports Sprint 5 |
| `supabase/seed.sql` | Extended — `chapter_writing_states` Bab 1 + 5 `chapter_beats` |
| `supabase/README.md` | Updated — migration 00004 section |
| `packages/shared/README.md` | Updated — Sprint 5 guardrails |
| `.agent-logs/sprint-5/task-5.1-write-room-data-model-shared-types.md` | Created (log ini) |

**Tidak diubah:** `apps/api`, `apps/web` source, `docs/34` (no material divergence).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `supabase db reset` | PASS — migrations 00001–00004 + seed |
| `supabase db query` (row counts) | PASS — chapter_beats=5, chapter_writing_states=1, writing_sessions=0 |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:web:outline` | PASS — 3 PASS, 1 NOT RUN (API mode) |

## Results

- Migration `00004` applied cleanly on `supabase db reset`.
- Shared package exports all Sprint 5 enums and domain types.
- Seed: 5 beats Bab 1 (`a0000000-...-911`), 1 `chapter_writing_states` (`not_started`).
- No prose versions, no context_packet_logs, no writing_sessions seeded (by design).
- Sprint 2 regression smoke unchanged PASS.

## Decisions

1. **`chapter_writing_states` 1:1 dengan `chapter_outline_id`** — UNIQUE constraint on outline row; prose lifecycle separate from planning.
2. **Deferred FKs** — `writing_sessions.active_beat_id` and `chapter_prose_versions.context_packet_log_id` added after dependent tables exist.
3. **Partial unique indexes** — one `active` session per chapter outline; one `is_current` prose per beat.
4. **`CONTEXT_PACKET_BUILDER_VERSIONS` as string const** — not a PostgreSQL enum; DB column `builder_version text`.
5. **`WriterContextPacket` full shape in shared** — ready for Task 5.2 builder; preview type for web later.
6. **Seed beat titles** — user-spec short labels (Makan malam dimulai, …) with mock summary/direction parity.
7. **`workflow_phase=outline` unchanged in seed** — outline lock still via API flow; Write Room gate documented for Task 5.2+.

## Limitations

- No API routes, mappers, or services.
- No `chapter_generation_attempts` or `validation_reports` tables.
- DB cannot enforce `packet_json` free of `planningTruth` — documented as API responsibility.
- `smoke:web:outline` API-mode (`-IncludeApiMode`) NOT RUN.
- Remote migration push not performed.

## Next recommended task

**Task 5.2 — Context Packet Builder API** (`context-packet-builder.ts`, POST context-packet endpoint, `context_packet_logs` persistence, gate `outline_locked`).