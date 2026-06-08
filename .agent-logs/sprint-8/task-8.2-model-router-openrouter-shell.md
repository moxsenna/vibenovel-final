# Task 8.2 — Model Router + OpenRouter Shell

**Date:** 2026-06-08
**Sprint:** sprint-8
**Status:** completed

## Task goal

Create model router abstraction, OpenRouter client shell, mock provider for local smoke, env validation/flags, and safety boundary. AI disabled by default. No public AI endpoint, no credit mutation, no output persistence.

## Files read

- `README.md`
- `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `docs/43-pre-ai-hardening-verification-report.md` (partial)
- `docs/36-non-blocking-technical-debt-and-deferred-items.md` (partial)
- `apps/api/src/env.ts`
- `apps/api/.dev.vars.example`
- `apps/api/src/errors.ts`
- `apps/api/src/services/context-packet-builder.ts` (referenced)
- `apps/api/src/services/context-packet-safety.ts`
- `apps/api/src/services/audit.ts` (referenced)
- `apps/api/src/services/audit-snapshot.ts` (partial)
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts` (partial)
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/ai-generation-types.ts` | **Created** — internal AI types |
| `apps/api/src/services/ai-prompt-safety.ts` | **Created** — prompt/output safety asserts |
| `apps/api/src/services/model-router.ts` | **Created** — allowlist, resolve, generate boundary |
| `apps/api/src/services/openrouter-client.ts` | **Created** — OpenRouter shell |
| `apps/api/src/services/mock-ai-provider.ts` | **Created** — deterministic mock provider |
| `apps/api/src/env.ts` | AI env helpers + safe health flags |
| `apps/api/.dev.vars.example` | Full AI env names (commented) |
| `apps/api/README.md` | § AI model router shell |
| `README.md` | Task 8.2 ✅ |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | 8.2 register update |
| `.agent-logs/sprint-8/task-8.2-model-router-openrouter-shell.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:api:sprint6` | PASS — 59/59 (truncated in console) |
| `npm run smoke:api:sprint7` | PASS — 53/53 |
| `npm run smoke:all:local` | tidak dijalankan — not required |

## Results

- Three provider-boundary services created; no routes wired.
- `AI_GENERATION_ENABLED` defaults false → `503 AI_DISABLED`.
- Model allowlist enforced; client cannot pass arbitrary model.
- Health exposes `aiGenerationEnabled`, `aiProviderMock`, `hasOpenRouterApiKey` (booleans only).
- All regression smokes green.

## Decisions

1. **Separate `ai-generation-types.ts` + `ai-prompt-safety.ts`** — shared between router, mock, OpenRouter client.
2. **Mock when `AI_PROVIDER_MOCK=true`** — routes to `mock` provider even if OpenRouter key present.
3. **Tier env overrides** — `AI_MODEL_HEMAT/SEIMBANG/TERBAIK` validated against `MODEL_ALLOWLIST`.
4. **Logging** — only `promptHash`, model, tokens, latency, `error_code`; never prompt or key.
5. **No audit writers** — deferred to Task 8.4 when attempts exist.
6. **Retries** — `AI_MAX_RETRIES` default 1 for transient OpenRouter errors only.

## Limitations

- No `POST /api/projects/:id/ai/generate-prose` (Task 8.4).
- No credit debit/refund (Task 8.3).
- No `generation_attempts` rows written.
- No live OpenRouter integration test without key + enabled env.
- Production prompt assembly not implemented (Task 8.4).
- `smoke:api:sprint8` not created yet (Task 8.6).

## Next recommended task

**Task 8.3** — Credit Debit/Refund Service (idempotent ledger + balance update).