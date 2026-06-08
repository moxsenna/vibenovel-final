# Task 9.2b — Credit UI Regression Stabilization

**Date:** 2026-06-08  
**Sprint:** sprint-9  
**Status:** completed  
**Parent:** Task 9.2 credit UI minimal

## Goal

Close verification gaps for Task 9.2 before Task 9.3. Stabilize local environment and rerun deferred API/web regressions. No new product features.

## Environment stabilized

| Check | Result |
|---|---|
| Docker Desktop | Running (4.76.0) |
| `supabase status` | Running — Kong `54321`, DB `54322` |
| `npm run dev:api` | Running `http://127.0.0.1:8787` |
| `GET /api/health` | `ok=true`, all Supabase flags true |
| `npm run dev:web` | Running `http://localhost:5173`, `VITE_USE_MOCKS=false` |
| Safe API env restored | `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` |

**Note:** `apps/api/.dev.vars` toggled locally for sprint8 mock runs; restored to safe defaults; not committed.

## Commands run

| Command | Result |
|---|---|
| `npm run smoke:api:sprint7` | **PASS 53/53** |
| `npm run smoke:api:sprint8` (baseline, AI disabled) | **PASS 8/8** (5 NOT RUN mock paths — expected) |
| `npm run smoke:api:sprint8 -- -MockMode success` | **PASS 20/20** (3 SKIP wrong mode) |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | **PASS 14/14** (4 SKIP) |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | **PASS 14/14** (4 SKIP) |
| `npm run smoke:web:write-ai -- -IncludeApiMode -SkipMockMode` | **PASS 12/12** (1 SKIP AI success — AI disabled by design) |
| `npm run smoke:web:credit-ui` | **PASS** (mock hides credit card) |
| Insufficient credit web E2E | **NOT RUN** — no dedicated Playwright spec; API `402 INSUFFICIENT_CREDIT` verified in sprint8 success smoke; client guard in `useWriteRoomData` |
| `npm run smoke:all:local` | **PASS 11/11** (1.1m) |

## API-mode web E2E mode

Ran with **AI disabled** (safe default env):

- Credit balance card visible (`Saldo Kredit`, biaya, sisa, top-up copy)
- No prompt/context/provider/`estimated_cost_usd` leak
- AI button enabled → click → safe `AI generation belum aktif` message
- AI mock prose success path **SKIP** (`AI_GENERATION_ENABLED=false`) — acceptable per 9.2b scope

## Bugfix (test stabilization only)

**File:** `apps/web/e2e/sprint8-write-ai-flow.spec.ts`

**Issue:** `prepareWriteRoomApi` race / Playwright strict-mode violation when beats already exist (second API-mode test).

**Fix:** Poll write-room readiness with `expect(...).toPass()` instead of `.or().toBeVisible()` on multiple locators.

## Files changed

| Path | Change |
|---|---|
| `apps/web/e2e/sprint8-write-ai-flow.spec.ts` | E2E helper stabilization |
| `apps/api/.dev.vars` | Local env toggles only (gitignored, restored) |
| `.agent-logs/sprint-9/task-9.2b-credit-ui-regression-stabilization.md` | This log |
| `.agent-logs/sprint-9/task-9.2-credit-ui-minimal.md` | Verification addendum |

## Task 9.2 approval checklist

| Criterion | Status |
|---|---|
| `smoke:api:sprint7` PASS | ✅ 53/53 |
| `smoke:api:sprint8` PASS | ✅ baseline + success |
| `fail_provider` PASS | ✅ |
| `unsafe_output` PASS | ✅ |
| `smoke:web:credit-ui` mock PASS | ✅ |
| API-mode credit UI PASS | ✅ |
| No new product feature | ✅ |
| Work log updated | ✅ |

**Task 9.2 approved for handoff to Task 9.3.**

## Next recommended task

**Task 9.3** — Prose Rewrite API (`POST /api/projects/:id/ai/rewrite-prose`).