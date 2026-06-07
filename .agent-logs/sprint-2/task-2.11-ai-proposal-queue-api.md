# Task 2.11 — AI Proposal Queue API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat API manual untuk AI Proposal Queue — create, list, detail, patch, accept, reject, merge dengan canon guardrails. Accept hanya mengubah status (tanpa auto-promotion ke facts/characters/speech rules).

## Files read

- `README.md`
- `docs/23-legacy-vibenovel-audit.md` (referenced via sprint plan)
- `docs/24-feature-migration-map.md` (referenced via sprint plan)
- `docs/25-problem-coverage-matrix.md` (referenced via sprint plan)
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/services/fact.ts`
- `apps/api/src/services/character.ts`
- `apps/api/src/services/speech-rule.ts`
- `apps/api/src/lib/mappers.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.10-relationship-speech-rules-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/ai-proposal.ts` | Created — queue CRUD + lifecycle |
| `apps/api/src/routes/ai-proposals.ts` | Created — 7 endpoints |
| `apps/api/src/routes/index.ts` | Register proposal routes |
| `apps/api/src/lib/mappers.ts` | `AiProposalRow` mapper + aliases |
| `apps/api/src/errors.ts` | Added `AppError.conflict` (409) |
| `apps/api/README.md` | Proposal queue docs |
| `.agent-logs/sprint-2/task-2.11-ai-proposal-queue-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `apps/web`, facts/characters/speech rules on accept.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `GET proposals` tanpa token | PASS — 401 |
| `GET proposals` dengan JWT | PASS — 200 |
| `POST fact high risk` | PASS — 201 `proposed` |
| `POST source=openrouter/gemini` | PASS — 400 |
| `PATCH proposed` | PASS — 200 |
| `ACCEPT proposed` | PASS — `accepted` |
| `PATCH accepted` | PASS — 409 |
| `REJECT second` | PASS — `rejected` |
| `MERGE third` | PASS — `merged` |
| Seed project cross-user | PASS — 404 |

## Results

- 7 endpoint proposal queue protected auth.
- Default GET: `status=proposed` only; `includeResolved=true` untuk semua status.
- POST selalu `proposed`; body `status` ditolak.
- Accept/reject/merge explicit; tidak menulis canon tables.
- Resolved proposals immutable via PATCH (409).
- Audit: created, accepted, rejected, merged.

## Decisions

1. **Accept status-only:** Sesuai preferensi user — tidak auto-create fact/character/speech rule.
2. **Default list proposed only:** Queue UI bersih.
3. **Provider source rejection:** `openrouter`, `gemini`, `gpt`, dll. ditolak sebagai `source` value.
4. **Payload limits:** Max 8KB; block `full_prompt`, `prose`, `chapter_text`.
5. **PATCH audit:** Schema `audit_action` tidak punya `ai_proposal_updated` — PATCH tidak menulis audit (lifecycle actions audited).
6. **409 CONFLICT:** Untuk edit/transition pada proposal non-proposed.

## Limitations

- Accept tidak mempromosikan ke canon (Task 2.11b / Sprint 3).
- PATCH tidak menulis audit log (enum schema constraint).
- `result_fact_id` / `result_character_id` tidak di-set pada accept.
- Frontend proposal UI belum wired.
- Tidak ada automated integration test file.

## Next recommended task

**Task 2.12 — Credit balance read API** (`GET /api/me/credits` atau extend `/api/me`).