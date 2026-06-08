# Task 8.4 — Prose Beat Generation API

**Date:** 2026-06-08
**Sprint:** sprint-8
**Status:** completed

## Task goal

First credit-gated AI generation endpoint: `POST /api/projects/:id/ai/generate-prose` with orchestration (context packet, generation attempt, debit/refund, mock provider, output safety, `ai_generated` prose persistence). No canon mutation, no prompt/context leak, AI disabled by default.

## Files read

- `README.md`, `docs/44`, `docs/43`, `docs/36`
- `supabase/migrations/00008_sprint8_ai_generation_credit.sql`
- `apps/api/src/services/model-router.ts`, `openrouter-client.ts`, `mock-ai-provider.ts`
- `apps/api/src/services/ai-prompt-safety.ts`, `ai-generation-types.ts`, `ai-credit-policy.ts`
- `apps/api/src/services/credit-ledger.ts`, `credit.ts`, `context-packet-builder.ts`, `context-packet-safety.ts`
- `apps/api/src/services/write-session.ts`, `chapter-beat.ts`, `prose-draft.ts`, `audit.ts`, `audit-snapshot.ts`
- `apps/api/src/routes/index.ts`, `errors.ts`, `apps/api/README.md`
- `scripts/sprint5/6/7-smoke-api.ps1`, `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/routes/ai.ts` | **Created** — `POST /ai/generate-prose` |
| `apps/api/src/routes/index.ts` | Register `registerAiRoutes` |
| `apps/api/src/services/prose-beat-generation.ts` | **Created** — orchestration + validation |
| `apps/api/src/services/generation-attempt.ts` | **Created** — attempt lifecycle + audits |
| `apps/api/src/services/prose-generation-prompt.ts` | **Created** — safe prompt from packet log |
| `apps/api/src/services/prose-draft.ts` | `saveAiGeneratedProseVersionForOwner` |
| `apps/api/src/services/context-packet-builder.ts` | Export `parsePacketJson` |
| `scripts/sprint8-smoke-api.ps1` | **Created** — resilient smoke (Wait-ApiReady, bootstrap guards) |
| `package.json` | `smoke:api:sprint8` alias |
| `apps/api/README.md`, `README.md`, `scripts/README.md`, `docs/36` | Task 8.4 docs |
| `apps/api/.dev.vars.example` | AI env names (no values) |
| `.agent-logs/sprint-8/task-8.4-prose-beat-generation-api.md` | This log |

## Endpoint behavior

`POST /api/projects/:id/ai/generate-prose` (auth required):

1. Gate `AI_GENERATION_ENABLED` → else `503 AI_DISABLED`
2. Validate body (UUIDs, qualityMode, idempotencyKey; reject model/provider/cost/prompt fields)
3. Ownership + active/paused writing session
4. `buildContextPacketForOwner` + log row (no `packet_json` in response)
5. `buildProseBeatPrompt` → `promptHash` only (no raw prompt stored/logged)
6. `createGenerationAttempt` → `debitCreditsForAttempt` → `generateWithModelRouter` → `saveAiGeneratedProseVersionForOwner` → mark succeeded
7. Idempotency: succeeded replay returns existing version; in-progress `409`; failed same key `422`
8. Refund on provider/safety/persist failure

## Generation attempt lifecycle

| Status | Trigger |
|---|---|
| `pending` | `createGenerationAttempt` insert |
| `running` | After successful debit |
| `succeeded` | Prose persisted; `output_entity_type=chapter_prose_version` |
| `failed` | Insufficient credit, provider error, unsafe output, persist error |

Audits: `generation_attempt_created`, `generation_attempt_succeeded`, `generation_attempt_failed`, `ai_output_persisted` — sanitized metadata only.

## Credit debit/refund behavior

- Cost from `getCreditCostForGeneration(prose_beat, qualityMode)` — hemat=5
- Debit before provider call; `402 INSUFFICIENT_CREDIT` if no balance row or low balance
- Refund via `refundCreditsForAttempt` on provider/safety/persist failure
- Idempotent ledger per `attempt_id` + `reason` + `direction` — no double debit on replay

## Prompt/context safety

- Prompt built from safe `WriterContextPacket` fields only (no planningTruth, no packet dump)
- `assertPromptSafeForProvider` + `assertProviderOutputSafe` before/after provider
- Response: version + `generationAttempt` summary + `creditBalance` — no raw prompt/packet_json/planningTruth
- `contextPacketLogId` in version response is allowed (not a leak marker)

## Prose persistence behavior

- Internal `saveAiGeneratedProseVersionForOwner` sets `source=ai_generated`
- Public `POST .../write/beats/:id/prose` still rejects `ai_generated` from client
- Links `context_packet_log_id`; updates beat status via existing helpers
- No canon/proposal/summary mutation; no `ready_for_summary` auto-mark

## Smoke coverage

| Mode | Env | Result |
|---|---|---|
| success (`-MockMode auto`) | `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` | **18 PASS**, 3 SKIP |
| fail_provider | `AI_PROVIDER_MOCK_MODE=fail_provider` + restart | **14 PASS**, 4 SKIP |
| unsafe_output | `AI_PROVIDER_MOCK_MODE=unsafe_output` + restart | **14 PASS**, 4 SKIP |

Smoke fixes applied: `Wait-ApiReady` poll, bootstrap `exit 1` on failure, Unicode em-dash removed (broke PS function parsing), leak guard uses field-specific patterns.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint8` (success) | PASS — 18/18 executable |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | PASS — 14/14 executable |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | PASS — 14/14 executable |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:api:sprint6` | PASS — 68/68 |
| `npm run smoke:api:sprint7` | PASS — 53/53 |

## Decisions

1. Idempotency at `generation_attempts` by `user_id` + `idempotency_key` before debit
2. Failed same-key returns `422 GENERATION_FAILED` — user must supply new key
3. `generationAttempt` safe summary includes provider/model (not a leak — no raw body)
4. Credit seed in smoke via service role REST (not logged)
5. Smoke modes require separate `dev:api` restart per `AI_PROVIDER_MOCK_MODE`

## Limitations

- Live OpenRouter **not tested** — mock provider only
- No WritePage AI button (Task 8.5)
- No publish/rewrite/summary-delta AI endpoints
- No UI integration
- True Postgres RPC for atomic credit mutation still deferred (`TransactionPlan` compensation only)
- No balance auto-create for new users — smoke seeds via service role
- `monthly_used` not incremented on debit (MVP)

## Env final state (local, gitignored)

```
AI_GENERATION_ENABLED=false
AI_PROVIDER_MOCK=true
AI_PROVIDER_MOCK_MODE=success
```

`dev:api` restarted with AI disabled default after smoke runs.

## Next recommended task

**Task 8.5** — WritePage AI button (credit cost display, loading states, call `generate-prose` from UI). Out of scope for 8.4.