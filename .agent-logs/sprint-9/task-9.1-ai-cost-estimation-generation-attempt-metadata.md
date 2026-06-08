# Task 9.1 — AI Cost Estimation + Generation Attempt Cost Metadata

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Populate `generation_attempts.estimated_cost_usd` when provider returns token usage, using internal allowlist-only model cost map. Internal observability only — no change to fixed credit billing.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `docs/47-live-openrouter-staging-smoke-report.md`
- `docs/45-sprint-8-verification-report.md`
- `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `apps/api/src/services/model-router.ts`
- `apps/api/src/services/openrouter-client.ts`
- `apps/api/src/services/prose-beat-generation.ts`
- `apps/api/src/services/generation-attempt.ts`
- `apps/api/src/services/ai-credit-policy.ts`
- `apps/api/src/services/credit-ledger.ts` (via imports)
- `apps/api/src/services/mock-ai-provider.ts`
- `scripts/sprint8-smoke-api.ps1`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/model-cost-map.ts` | **Created** — `calculateEstimatedCostUsd`, `getModelCostConfig` |
| `apps/api/src/services/generation-attempt.ts` | Extended `markGenerationAttemptSucceeded` — `estimated_cost_usd` + cost metadata merge |
| `apps/api/src/services/prose-beat-generation.ts` | Wire cost estimation after provider success |
| `scripts/sprint8-smoke-api.ps1` | Assert mock `estimated_cost_usd=0`, metadata leak guard, optional live path |
| `apps/api/README.md` | Cost observability section + `model-cost-map.ts` in services table |
| `README.md` | Task 9.1 ✅, next task 9.2 |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 9.1 addressed note |
| `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` | Status + gap update |
| `.agent-logs/sprint-9/task-9.1-ai-cost-estimation-generation-attempt-metadata.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint8` (mock success, AI enabled) | PASS 20/0/3 |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | PASS 14/0/4 |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | PASS 14/0/4 |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 68/68 |
| `npm run smoke:api:sprint7` | PASS 53/53 |
| `npm run smoke:all:local` | tidak dijalankan — web phases need dev:web; API regression already PASS |
| Live OpenRouter cost spot check | NOT RUN — optional; mock path verified |

## Results

- `estimated_cost_usd` written on prose beat success path.
- Mock provider: `estimated_cost_usd = 0`, metadata `costEstimateApproximate: true`, `mockProvider: true`.
- OpenRouter + mapped model: computed USD from tokens (when implemented path used).
- Unknown model: `null` + `costEstimateReason: model_not_in_cost_map`.
- `credit_cost` / debit / refund unchanged.
- Sprint 8 smoke new steps: `estimated_cost_usd mock` PASS, `attempt metadata leak guard` PASS.

## Decisions

1. **Mock policy:** `estimatedCostUsd = 0` (not null) with `mockProvider: true` — distinguishes mock from live; smoke asserts zero.
2. **Pricing source:** `google/gemini-2.5-flash` verified from OpenRouter model page (2026-06-08): $0.30/M input, $2.50/M output. URL documented in code comment + `apps/api/README.md` — no runtime fetch.
3. **Other allowlisted models omitted** — `google/gemini-2.0-flash-001`, `google/gemini-flash-latest` not priced (unreliable/unavailable per `docs/47`); returns `model_not_in_cost_map`.
4. **No frontend exposure** — `toGenerationAttemptSafeSummary` unchanged; smoke reads DB via service role only.
5. **Metadata merge** — preserve existing attempt metadata (e.g. `qualityMode`) on success update.

## Limitations

- Cost map only includes verified `google/gemini-2.5-flash`; other allowlist models return null until manually verified and added.
- Live OpenRouter cost smoke not run in this session.
- `estimated_cost_usd` not exposed in API safe summary response.
- Rewrite/publish paths not wired yet (Task 9.3/9.5).
- Pricing static — must re-verify when OpenRouter changes rates or allowlist expands.

## Next recommended task

**Task 9.2** — Credit UI minimal (WritePage balance/cost display, no topup).