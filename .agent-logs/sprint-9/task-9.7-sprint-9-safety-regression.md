# Task 9.7 — Sprint 9 Safety Regression

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Full safety regression for Sprint 9 before sprint closure: prove AI features (cost metadata, credit UI, prose rewrite, publish copy AI) remain safe — idempotency, refund, no leak, no canon mutation, no auto-apply, no auto-post. No new features.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `.agent-logs/sprint-9/task-9.1` through `task-9.6b` work logs
- `scripts/sprint8-smoke-api.ps1`, `scripts/sprint9-smoke-api.ps1`, `scripts/sprint9-smoke-web.ps1`, `scripts/smoke-all-local.ps1`
- `apps/web/e2e/sprint9-*.spec.ts`, `apps/web/e2e/sprint8-write-ai-flow.spec.ts`
- `apps/api/src/routes/ai.ts`, `apps/web/src/hooks/useWriteRoomData.ts`, `apps/web/src/hooks/usePublishData.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `.agent-logs/sprint-9/task-9.7-sprint-9-safety-regression.md` | **Created** — this log |
| `README.md` | Task 9.7 status → complete |
| `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` | Task 9.7 status |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 9.7 safety regression note |
| `scripts/README.md` | Sprint 9.7 full verification env-switching section |

**Not committed (local only):** `apps/api/.dev.vars`, `apps/web/.env.local` — toggled during matrix; restored to safe defaults.

**No product code changes** — all smokes PASS without bugfixes.

## Environment status

| Check | Result |
|---|---|
| `docker ps` | Supabase stack healthy (db, kong, auth, rest, etc.) |
| `supabase status` | Local dev running |
| `GET /api/health` (start) | `aiGenerationEnabled=false`, `aiProviderMock=true` |
| `GET /api/health` (end) | `aiGenerationEnabled=false`, `aiProviderMock=true` |
| Web mock default | `VITE_USE_MOCKS=true` (restored) |
| API env final | `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` |

## API smoke matrix results

### Baseline (AI disabled default)

| Command | Result |
|---|---|
| `smoke:api` | 17/17 PASS |
| `smoke:api:sprint5` | 49/49 PASS |
| `smoke:api:sprint6` | 68/68 PASS |
| `smoke:api:sprint7` | 53/53 PASS |
| `smoke:api:sprint8` | 8 PASS, 5 NOT RUN |
| `smoke:api:sprint9` | 10 PASS, 11 NOT RUN |

### Sprint 8 mock modes (`AI_GENERATION_ENABLED=true`, restart `dev:api` per mode)

| Command | Result |
|---|---|
| `smoke:api:sprint8 -- -MockMode success` | 20 PASS, 0 FAIL |
| `smoke:api:sprint8 -- -MockMode fail_provider` | 14 PASS, 0 FAIL |
| `smoke:api:sprint8 -- -MockMode unsafe_output` | 14 PASS, 0 FAIL |

### Sprint 9 mock modes

| Command | Result |
|---|---|
| `smoke:api:sprint9 -- -MockMode success` | 46 PASS, 0 FAIL |
| `smoke:api:sprint9 -- -MockMode fail_provider` | 31 PASS, 0 FAIL |
| `smoke:api:sprint9 -- -MockMode unsafe_output` | 30 PASS, 0 FAIL |

## Web mock matrix results

All PASS (mock only; API-mode NOT RUN per script default):

| Command | Result |
|---|---|
| `smoke:web` | 3 PASS |
| `smoke:web:write` | 3 PASS |
| `smoke:web:write-ai` | 3 PASS |
| `smoke:web:credit-ui` | 5 PASS |
| `smoke:web:rewrite` | 5 PASS |
| `smoke:web:publish` | 3 PASS |
| `smoke:web:publish-ai` | 3 PASS |
| `smoke:web:sprint9` | 5 PASS |

## API-mode success matrix results

Env: `VITE_USE_MOCKS=false`, `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success`, restart `dev:api` + `dev:web`.

| Command | Result |
|---|---|
| `smoke:web:write-ai -- -IncludeApiMode` | 13 PASS — credit labels + mock prose in editor |
| `smoke:web:rewrite -- -IncludeApiMode` | 18 PASS — rewrite controls + mock success + publish AI success |
| `smoke:web:publish-ai -- -IncludeApiMode` | 14 PASS — panel + suggestions + apply |
| `smoke:web:sprint9 -- -IncludeApiMode` | 18 PASS — full Sprint 9 web API-mode |

Verified: suggestions appear; package fields unchanged before **Terapkan**; apply updates field via PATCH; no DOM leak.

## API-mode disabled matrix results

Env: `AI_GENERATION_ENABLED=false`, `VITE_USE_MOCKS=false`, restart `dev:api`.

| Command | Result |
|---|---|
| `smoke:web:write-ai -- -IncludeApiMode` | 13 PASS — AI disabled safe message; credit UI visible |
| `smoke:web:rewrite -- -IncludeApiMode` | 18 PASS — rewrite + publish disabled paths |
| `smoke:web:publish-ai -- -IncludeApiMode` | 14 PASS — publish AI disabled safe message |

## smoke:all:local result

| Command | Result |
|---|---|
| `smoke:all:local` | **11/11 PASS** (~1.0m) — API Sprint 2/5/6/7/8 baseline + Web Sprint 3–8 mock |
| `smoke:all:local:full` | **NOT RUN** — orchestrator lacks Sprint 9 web phases; API-mode matrix verified explicitly in this task with dedicated env switching; `:full` requires `VITE_USE_MOCKS=false` incompatible with safe mock default end state |

## Safety assertions summary

### API / DB (verified via smoke scripts)

| Assertion | Status |
|---|---|
| No raw prompt stored | PASS — leak guards in sprint5/8/9 smokes |
| No `packet_json` in generation_attempt metadata | PASS |
| No `planningTruth`/`planning_truth` exposed | PASS |
| No OpenRouter key in responses/logs | PASS |
| No raw provider body exposed | PASS |
| `estimated_cost_usd` internal only | PASS — mock success populates; not in API response |
| `credit_cost` fixed and unchanged | PASS — debit amounts verified (5/6 per tier) |
| Idempotency no double debit | PASS — sprint8/9 success smokes |
| Refund on provider failure | PASS — `fail_provider` smokes |
| Refund on unsafe output | PASS — `unsafe_output` smokes |
| No canon mutation (prose/rewrite/publish copy) | PASS |
| Publish copy does not mutate `publish_packages` until PATCH | PASS — sprint9 API + web E2E |
| Publish AI does not create `ai_proposals` | PASS |
| No auto-post KBM | PASS — sprint7 static check |

### DOM (verified via Playwright leak patterns)

| Assertion | Status |
|---|---|
| No prompt / packet_json / planningTruth | PASS |
| No provider raw/body | PASS |
| No `estimated_cost_usd` | PASS |
| No generation attempt raw metadata | PASS |
| No OpenRouter key | PASS |

## Optional live spot check

**NOT RUN** — mock safety matrix fully PASS; live OpenRouter call deferred to avoid cost and secret exposure. Non-blocking per task spec.

## Bugs fixed

None — no code changes required.

## Known limitations

- `smoke:all:local` does not include Sprint 9 API/web scripts (Sprint 9 verified separately in this task).
- `smoke:all:local:full` not run — env switching + missing Sprint 9 phases in orchestrator.
- **Terapkan Semua** publish apply not covered by dedicated E2E (single-field apply verified in 9.6b/9.7).
- Sprint 9 API baseline leaves AI success paths NOT RUN at default env (by design).
- Multiple stale `dev:api` background processes observed; single listener on :8787 required for correct health flags.
- CI does not run API-mode web E2E (local dual-env only).

## Next recommended task

**Task 9.8** — Sprint 9 verification report (`docs/49-sprint-9-verification-report.md`).