# Task 3.3 — Concept Options API

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat API untuk `story_concepts`: list, generate stub 3 options, detail, update ringan, select concept. Deterministic/stub only — no OpenRouter, no foundation proposal, no web integration.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/intake.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/concept.ts` | Created |
| `apps/api/src/routes/concepts.ts` | Created |
| `apps/api/src/routes/index.ts` | Updated — register concepts routes |
| `apps/api/src/lib/mappers.ts` | Updated — StoryConcept mapper + ProjectRow workflow fields |
| `apps/api/src/services/project.ts` | Updated — PROJECT_SELECT includes workflow fields |
| `apps/api/README.md` | Updated — concept endpoints docs |
| `.agent-logs/sprint-3/task-3.3-concept-options-api.md` | Created (log ini) |

**Tidak diubah:** web, migrations, shared package, smoke script, foundation/proposal services.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Manual concepts API runtime test | PASS |

## Results

### Runtime verification

| Check | Result |
|---|---|
| GET concepts tanpa token | 401 |
| POST generate | 201, 3 concepts, `created=true` |
| GET concepts | 3 concepts |
| GET detail | 200 |
| PATCH proposed | 200 |
| POST select | `status=selected`, `workflowPhase=foundation` |
| GET project | `selectedConceptId` + `workflowPhase=foundation` |
| PATCH selected | 409 |
| Cross-user seed project | 404 |

**Note:** After select, only 1 active concept remains (selected); second generate without `regenerate` creates new batch (by design — idempotency applies when ≥3 active proposed/selected).

## Decisions

1. **Single service** `concept.ts` — tidak dipecah.
2. **Generate idempotency:** `regenerate=false` + ≥3 active (proposed|selected) → return existing; else insert 3 new.
3. **regenerate=true:** reject old `proposed` only; `selected` tidak diubah.
4. **PATCH selected → 409** — tidak boleh edit concept terpilih di Task 3.3.
5. **Select:** clear old selected → reject other proposed → set target selected → update project pointer.
6. **No audit_logs** — `audit_action` enum belum punya concept actions.
7. **ProjectRow extended** — `workflowPhase`, `selectedConceptId` di semua project SELECT.

## Limitations

- Stub generator template-based — bukan AI/NLP.
- Tidak ada audit log untuk concept generate/select.
- Setelah select, active count < 3 sehingga generate tanpa regenerate bisa membuat batch baru.
- Sprint 2 smoke belum cover concept endpoints.
- Generate tidak membaca `story_foundations` secara eksplisit (hanya signals + project title/genre).

## Next recommended task

**Task 3.4 — Foundation proposal + readiness service** (`generate-from-concept`, readiness calculator, canon promotion extend).