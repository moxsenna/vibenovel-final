# Task 4.2 — Outline Generation Stub API

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Membuat API dasar outline planning: `GET /api/projects/:id/outline` dan `POST /api/projects/:id/outline/generate` dengan stub deterministic 10 bab (default) dari canon snapshot + foundation locked gate. Tanpa CRUD chapter penuh, tanpa web integration, tanpa AI/OpenRouter, tanpa canon mutation.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `supabase/migrations/00001_sprint2_core.sql`, `00002_sprint3_intake_concepts.sql`, `00003_sprint4_outline_planning.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `apps/api/src/services/project.ts`, `foundation.ts`, `fact.ts`, `character.ts`, `speech-rule.ts`
- `apps/api/src/lib/mappers.ts`, `middleware/auth.ts`
- `apps/api/README.md`
- `apps/web/src/mocks/outline.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-4/task-4.1-outline-planning-data-model-shared-types.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/lib/mappers.ts` | Updated — outline row mappers + `PlannedRevealPublic` redaction |
| `apps/api/src/services/outline-snapshot.ts` | Created — canon snapshot loader + foundation locked gate |
| `apps/api/src/services/outline-generator.ts` | Created — deterministic stub (mock parity, 24 loops, 24 reveals) |
| `apps/api/src/services/outline.ts` | Created — GET bundle + POST generate/regenerate logic |
| `apps/api/src/routes/outline.ts` | Created — outline route group |
| `apps/api/src/routes/index.ts` | Updated — register outline routes |
| `apps/api/README.md` | Updated — outline endpoints, guardrails, planning_truth redaction |
| `.agent-logs/sprint-4/task-4.2-outline-generation-stub-api.md` | Created (log ini) |

**Tidak diubah:** web UI/pages, OpenRouter, prose writer, chapter CRUD routes, open loop/reveal CRUD routes, migrations, seed.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `supabase db reset` | PASS — 00001 + 00002 + 00003 + seed |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:web` | PASS — 3/3 mock Playwright (API mode NOT RUN) |
| Outline runtime smoke (inline PowerShell session) | PASS — 8/8 |

## Results

### Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/projects/:id/outline` | JWT | Bundle: plan (null if none) + chapters + loops + reveals; `planningTruthRedacted: true` |
| POST | `/api/projects/:id/outline/generate` | JWT | Stub generate; foundation locked required; optional `targetChapterCount`, `regenerate`, `seasonLabel`, `arcSummary` |

### Outline generation behavior

- Reads canon snapshot: project, selected concept, locked foundation, characters, facts, speech rules (read-only).
- Default `targetChapterCount=10`; validates `1..50`.
- `regenerate=false`: returns existing plan if chapters exist.
- `regenerate=true`: deletes children (loops, reveals, chapters), updates plan, inserts fresh stub; rejected if plan `status=locked`.
- Inserts: 10 chapters (mock parity), 24 `open_loops`, 24 `planned_reveals`.
- Sets `workflow_phase=outline` when prior phase was `foundation_locked`.
- No writes to facts/characters/speech_rules/foundation/ai_proposals.

### Runtime verification (8/8 PASS)

1. GET outline no token → 401
2. Cross-user seed project GET → 404
3. POST generate without locked foundation → 409 (`Foundation must be locked before generating outline`)
4. POST generate after lock → 200/201, 10 chapters, 24 loops, 24 reveals
5. GET outline — `planningTruth` not in `plannedReveals`; bundle `planningTruthRedacted: true`
6. Canon counts unchanged post-generate (facts/characters/speech rules)
7. `regenerate=false` → existing (`created: false`)
8. `regenerate=true` → replaced draft (`regenerated: true`, new `seasonLabel`)

## Decisions

1. **GET returns 200 with `outlinePlan: null`** — UI generate CTA friendly (not 404).
2. **`planningTruth` omitted + per-reveal `planningTruthRedacted: true`** — default GET/generate response; raw truth stays DB-only until planner detail endpoint (Task 4.4+).
3. **24 loops / 24 reveals** — deterministic templates in `outline-generator.ts`; payoff chapter refs null when beyond batch.
4. **Regenerate deletes children** — acceptable for planning draft; blocked when plan locked.
5. **Audit** — only `project_updated` when advancing `workflow_phase`; no new `audit_action` enum (deferred).
6. **Extension chapters** — for `targetChapterCount > 10`, deterministic escalation template after mock Bab 1–10.

## Limitations

- No chapter outline CRUD (Task 4.3).
- No open loop / reveal CRUD (Task 4.4).
- No outline lock/approve API (Task 4.5).
- No web OutlinePage integration (Task 4.6).
- No `GET .../outline/readiness` (optional in doc 32).
- Sprint 2 `smoke:api` does not cover outline endpoints yet.
- `planned_reveals` detail endpoint with raw `planningTruth` not implemented (redacted only).

## Next recommended task

**Task 4.3 — Chapter outline CRUD API** (`GET/PATCH .../outline/chapters/:chapterId`, reject PATCH when plan locked).