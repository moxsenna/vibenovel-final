# Task 9.3 — Prose Rewrite API

**Date:** 2026-06-08  
**Sprint:** sprint-9  
**Status:** completed

## Goal

Credit-gated `POST /api/projects/:id/ai/rewrite-prose` — rewrite existing beat prose into a new draft version following Sprint 8 generate-prose patterns. No WritePage UI.

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/prose-rewrite-prompt.ts` | **Created** — rewrite mode mapping + safe prompt builder |
| `apps/api/src/services/prose-rewrite-generation.ts` | **Created** — orchestration (auth, idempotency, debit/refund, persist) |
| `apps/api/src/routes/ai.ts` | Register `rewrite-prose` route |
| `apps/api/src/services/prose-draft.ts` | `getCurrentProseVersionRowForBeat`, `saveAiRewrittenProseVersionForOwner` |
| `apps/api/src/services/generation-attempt.ts` | `generationType` on create; `estimatedCostUsd` in safe summary; audit metadata |
| `apps/api/src/services/prose-beat-generation.ts` | Pass `generationType: prose_beat` to create attempt |
| `scripts/sprint9-smoke-api.ps1` | **Created** |
| `package.json` | `smoke:api:sprint9` |
| `apps/api/README.md`, `README.md`, `docs/36`, `docs/48`, `scripts/README.md` | Task 9.3 docs |
| `.agent-logs/sprint-9/task-9.3-prose-rewrite-api.md` | This log |

## Endpoint behavior

`POST /api/projects/:id/ai/rewrite-prose` (auth)

- Requires `writingSessionId` + (`proseVersionId` or `beatId`)
- `beatId` only → loads current prose; `NO_PROSE_TO_REWRITE` (409) if none
- `rewriteMode` required; `custom` requires `instruction` (≤500)
- `qualityMode` optional, default `seimbang`
- Rejects forbidden body fields (prompt, packet_json, model, etc.)
- `AI_GENERATION_ENABLED=false` → `503 AI_DISABLED`

## Rewrite modes

| Mode | Internal instruction |
|---|---|
| `improve_emotion` | Deepen emotion, keep facts |
| `tighten_pacing` | Sharpen movement, cut drag |
| `natural_dialogue` | Natural dialogue, keep speaker intent |
| `shorter` | Compress without losing key beats |
| `longer` | Expand sensory/emotional detail, no new facts |
| `custom` | Bounded user instruction + canon constraints |

## Credit / debit / refund

- Policy: `prose_rewrite` — hemat **3** / seimbang **6** / terbaik **12**
- Debit before provider call
- Refund on: provider failure, unsafe output, persistence failure
- No refund on success (user may dislike output)
- `estimated_cost_usd` internal only on attempt row

## Idempotency

- Unique `user_id` + `idempotency_key` on `generation_attempts`
- Succeeded replay → existing prose version + attempt, **no second debit**, `idempotentReplay: true`
- Pending/running → `409 GENERATION_IN_PROGRESS`
- Failed same key → `422 GENERATION_FAILED` (new key required; documented)

## Prose persistence

- Reuses `prose-draft.ts` pattern
- `source=ai_generated` (no migration — no `ai_rewrite` enum)
- Metadata: `generationType=prose_rewrite`, `rewriteMode`, `sourceProseVersionId`, `generationAttemptId`
- Source version unchanged; new version `is_current=true`
- Draft artifact only — no canon mutation

## Safety / leak

- Prompt hash only; no raw prompt stored/returned
- Context packet via log id; no `packet_json` / `planningTruth` in response
- `assertProviderOutputSafe` on model output
- Audit `ai_output_persisted` includes generationType + ids, no prose text

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run typecheck:api` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint9` (baseline) | PASS 8/8 |
| `npm run smoke:api:sprint9 -- -MockMode success` | PASS 26/26 |
| `npm run smoke:api:sprint9 -- -MockMode fail_provider` | PASS 19/19 |
| `npm run smoke:api:sprint9 -- -MockMode unsafe_output` | PASS 19/19 |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 68/68 |
| `npm run smoke:api:sprint7` | PASS 53/53 |
| `npm run smoke:api:sprint8` | PASS 8/8 (baseline) |
| `npm run smoke:all:local` | PASS 11/11 (~57s) |
| Live OpenRouter rewrite | **NOT RUN** |

## Limitations

- No WritePage rewrite UI (Task 9.4)
- No live OpenRouter rewrite smoke
- Failed idempotency key cannot be retried with same key
- `source` enum stays `ai_generated`; rewrite distinguished via metadata

## Next recommended task

**Task 9.4** — WritePage rewrite UI (wire Perbaiki Teks buttons to `rewrite-prose`).