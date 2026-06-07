# Task 5.0 — Safe Write Room & Context Packet Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-5
**Status:** completed

## Task goal

Membuat rencana implementasi Sprint 5 secara detail sebelum coding: Safe Write Room & Context Packet — workflow persistence nyata, context aman per bab aktif, beats/session/prose storage, tanpa OpenRouter, tanpa prose AI production, tanpa migration/API/web code.

## Files read

- `README.md`
- `docs/33-sprint-4-verification-report.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/06-reveal-gate-and-future-leak-prevention.md`
- `docs/07-context-packet-and-ai-writing-workflow.md`
- `docs/12-database-schema-and-data-model.md`
- `docs/26-current-sprint-plan.md` (Sprint 5 section — penomoran task berbeda, dicatat)
- `apps/api/src/services/outline.ts`
- `apps/api/src/services/outline-generator.ts`
- `apps/api/src/services/chapter-outline.ts`
- `apps/api/src/services/outline-tracking.ts`
- `apps/api/src/services/outline-lock.ts`
- `apps/api/src/services/outline-snapshot.ts`
- `apps/web/src/pages/WritePage.tsx`
- `apps/web/src/components/writer/` (WriterBeatList, WriterEditorPanel, WriterAssistantPanel, WriterMobileLayout)
- `apps/web/src/mocks/chapter.ts`
- `apps/web/src/types/chapter.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `supabase/migrations/00003_sprint4_outline_planning.sql`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-4/task-4.0-outline-planning-engine-plan.md` (format reference)

## Files created/changed

| File | Action |
|---|---|
| `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md` | Created — Sprint 5 implementation plan (14 sections) |
| `.agent-logs/sprint-5/task-5.0-safe-write-room-context-packet-plan.md` | Created (log ini) |
| `.agent-logs/sprint-5/` | Created folder |

**Tidak diubah:** migrations, API, web source, shared package code, README.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build:*` | tidak dijalankan — docs-only task |
| `supabase db reset` | tidak dijalankan — no migration yet |

## Results

- Sprint 5 plan document created with all 14 required sections per user spec.
- Proposed migration `00004` with 5 MVP tables: `writing_sessions`, `chapter_writing_states`, `chapter_beats`, `chapter_prose_versions`, `context_packet_logs`.
- `chapter_generation_attempts` documented as backlog (defer pre-OpenRouter).
- Task breakdown: 5.1 (db+shared) → 5.2 context packet → 5.3 session/beats → 5.4 prose → 5.5 web → 5.6 safety tests (blocker) → 5.7 verification.
- Context Packet boundary documented in detail per docs 06/07 — `planning_truth` never in packet; breadcrumb MVP from `reader_facing_hint` only.
- Writer/planner boundary: backend-only packet build; frontend must not assemble from outline bundle.
- Safety test matrix: 18 tests for `sprint5-smoke-api.ps1`.
- Canon guardrails: draft prose ≠ canon; no fact mutation from write flow.

## Decisions

1. **`chapter_writing_states` terpisah dari `chapter_outlines`** — planning row Sprint 4 tetap immutable dari Write Room; prose lifecycle sendiri.
2. **`chapter_prose_versions` bukan `prose_versions` generik dulu** — scoped ke beat; rename/unify di Full Version jika perlu.
3. **Context packet di-log ke `context_packet_logs`** — audit trail + smoke test substrate; UI hanya preview redacted.
4. **Breadcrumb compiler MVP = `reader_facing_hint` only** — tidak translate `planning_truth` di Sprint 5; full compiler Sprint 6+.
5. **Task numbering mengikuti user spec (5.1–5.7)** — bukan `docs/26` numbering (Beat Contract 5.1); catatan divergensi di plan doc.
6. **Task 5.6 adalah blocker** — no prose AI writer task sebelum safety tests PASS.
7. **AI assistant UI tetap disabled** — manual save + stub only; no OpenRouter UI.
8. **Beat stub parity `mockChapterDraft`** — 5 beats Bab 1 "Makan Malam yang Dingin".
9. **`workflow_phase` extend `writing` opsional** — gate utama tetap `outline_locked`.
10. **Previous continuity = outline summaries only** — accepted prose summaries dari Sprint 6.

## Limitations

- Plan only — no schema/API/web implementation.
- Full Beat Contract schema (docs/26 Task 5.1) dilipat ke `chapter_beats.must_include/must_not_include` lite — full contract table backlog.
- Character Knowledge Gate (`unknown/suspects/knows`) deferred — MVP canon facts list only.
- `smoke:web:write` Playwright optional di 5.7 (pattern Task 4.8).
- Unlock outline / re-edit setelah write started — tidak dirinci (defer).

## Next recommended task

**Task 5.1 — Write Room Data Model + Shared Types** (`00004_sprint5_write_room.sql`, shared enums/domain, seed beats Bab 1 parity `mockChapterDraft`).