# Task 3.0 — Sprint 3 Story Foundation Flow Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat rencana implementasi Sprint 3 secara detail sebelum coding: intake → concepts → foundation proposal → readiness → lock, dengan canon guardrails dan tanpa OpenRouter/AI production dulu.

## Files read

- `README.md`
- `docs/23-legacy-vibenovel-audit.md` (partial via grep + sprint refs)
- `docs/24-feature-migration-map.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/26-current-sprint-plan.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `apps/api/README.md`
- `apps/web/src/pages/IntakePage.tsx`
- `apps/web/src/pages/ConceptsPage.tsx`
- `apps/web/src/pages/FoundationPage.tsx`
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/foundation.ts`
- `apps/api/src/services/project.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `docs/30-sprint-3-story-foundation-flow-implementation-plan.md` | Created — Sprint 3 plan |
| `README.md` | Updated — Sprint 3 planning link + next step |
| `.agent-logs/sprint-3/task-3.0-story-foundation-flow-plan.md` | Created (log ini) |

**Tidak diubah:** migrations, API source, web source, seed, CI workflows.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build:*` | tidak dijalankan — docs-only task |
| `npm run smoke:api` | tidak dijalankan — docs-only task |

## Results

- Dokumen `docs/30` mencakup 13 section wajib: goal, scope, DB design (4 tabel baru), AI boundary (stub first), flow, API tasks 3.1–3.7, web scope, canon guardrails, problem coverage, out of scope, acceptance, risks, first coding task.
- Keputusan: **no OpenRouter/model router** di Sprint 3; deterministic backend stub sampai proposal+lock jelas.
- Model router task dari doc 26 **deferred** — tidak masuk scope Sprint 3 user.
- First coding task: **3.1 migration intake/concepts**.

## Decisions

1. **`story_concepts` table terpisah** — concept options bukan `ai_proposals` atau `facts`.
2. **`detected_signals` table terpisah** — bukan JSONB di session; mendukung confirm/dismiss.
3. **Canon promotion di 3.4** — extend accept proposal dari status-only (2.11) ke transaction promotion.
4. **Lock tidak auto-accept proposals** — user review eksplisit default.
5. **Agent replies via API stub** — bukan frontend LLM; endpoint `agent-reply` backend-only.
6. **Task numbering** mengikuti user request (3.1 migration … 3.7 verification), bukan doc 26 model-router numbering.

## Limitations

- Plan belum include SQL final atau OpenAPI spec — mengikuti pola Sprint 2 (implement per task).
- Readiness formula detail (weights per field) akan diputuskan di Task 3.4 implementation.
- Bash smoke port untuk Sprint 3 deferred ke Task 3.7.

## Next recommended task

**Task 3.1 — Intake & Concept Data Model Migration** (`00002_sprint3_intake_concepts.sql` + shared types).