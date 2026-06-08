# Task 9.9 — Sprint 9 Smoke Orchestrator Consolidation + Optional Live Spot Check

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Extend `smoke:all:local` to include Sprint 9 API baseline + web mock (13 phases total). Document `:full` playbook. Add optional `-LiveSpotCheck` hook in `sprint9-smoke-api.ps1`. Verify orchestrator PASS with safe default env. No product code changes.

## Files read

- `scripts/smoke-all-local.ps1`, `scripts/sprint9-smoke-api.ps1`, `scripts/sprint9-smoke-web.ps1`
- `package.json`, `README.md`, `scripts/README.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/49-sprint-9-verification-report.md`
- `.agent-logs/sprint-9/task-9.7-sprint-9-safety-regression.md`

## Files created/changed

| Path | Change |
|---|---|
| `scripts/smoke-all-local.ps1` | **Modified** — phases 1–6 API (add Sprint 9), phases 7–13 web (add Sprint 9); `:full` docs; em dash parse fix in `Write-Host` strings |
| `scripts/sprint9-smoke-api.ps1` | **Modified** — `-LiveSpotCheck` switch + live-provider path when mock off (optional manual use) |
| `.agent-logs/sprint-9/task-9.9-smoke-orchestrator-live-spot-check.md` | **Created** — this log |
| `README.md` | Task 9.9 complete; `smoke:all:local` 13 phases; next task 10.0 |
| `scripts/README.md` | Orchestrator 13-phase table + Task 9.9 notes |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 9.9 addressed; deferred table update |
| `docs/49-sprint-9-verification-report.md` | Post-close addendum §14 (Task 9.9) |

**Not committed:** `apps/api/.dev.vars`, `apps/web/.env.local`

## Tooling fix (non-blocking, resolved)

First `npm run smoke:all:local` attempt failed PowerShell parse: em dash (`—`) inside `Write-Host` strings in `smoke-all-local.ps1` (`Missing closing '}'`). Replaced with ASCII hyphen in executable strings.

## Smoke run 1 — timeout (tooling / environment)

| Item | Detail |
|---|---|
| Command | `npm run smoke:all:local` (background, prior session) |
| Duration | ~12 min stuck on Phase 1 |
| Symptom | `GET /health` on :8787 timed out (10s); sprint2 child had ESTABLISHED socket but API unresponsive |
| Action | Killed smoke PIDs (52904, 46112, 63028); stopped hung listener on :8787; restarted single `dev:api` |
| Result | **TIMEOUT / tooling issue** — not a product FAIL |

## Smoke run 2 — verified PASS

| Item | Detail |
|---|---|
| Command | `npm run smoke:all:local` |
| Prerequisites | Single `dev:api` on :8787 (PID 60296), `dev:web` on :5173, safe env |
| Result | **13/13 PASS**, exit code **0**, elapsed **1.9m** |

| Phase | Suite | Result | Elapsed |
|---|---|---|---|
| 1 | API Sprint 2 (base regression) | PASS | 15.5s |
| 2 | API Sprint 5 (write room safety) | PASS | 15.3s |
| 3 | API Sprint 6 (summary safety) | PASS | 21.6s |
| 4 | API Sprint 7 (publish safety) | PASS | 21.4s |
| 5 | API Sprint 8 (AI prose baseline) | PASS | 5.4s |
| 6 | API Sprint 9 (rewrite + publish copy baseline) | PASS | 5.4s |
| 7 | Web Sprint 3 (intake/foundation) | PASS | 7.4s |
| 8 | Web Sprint 4 (outline) | PASS | 4.2s |
| 9 | Web Sprint 5 (write) | PASS | 3.9s |
| 10 | Web Sprint 6 (summary) | PASS | 4.0s |
| 11 | Web Sprint 7 (publish) | PASS | 3.8s |
| 12 | Web Sprint 8 (write AI mock) | PASS | 3.9s |
| 13 | Web Sprint 9 (credit/rewrite/publish AI mock) | PASS | 4.4s |

## smoke:all:local:full

**NOT RUN**

Reason: full mode requires manual env switch (`VITE_USE_MOCKS=false` + restart `dev:web`; optional `AI_GENERATION_ENABLED=true` for success E2E). API-mode matrix was already explicitly verified in Task 9.7 with dedicated env switching. Task 9.9 scope is safe-default orchestrator consolidation; forcing `:full` would leave env non-mock and risk flaky dual-env runs without adding coverage beyond 9.7.

## Live OpenRouter spot check

**NOT RUN**

Reason: optional P2; avoids OpenRouter cost and key exposure. `-LiveSpotCheck` switch added to `sprint9-smoke-api.ps1` for future manual use (`npm run smoke:api:sprint9 -- -MockMode success -LiveSpotCheck` with `AI_PROVIDER_MOCK=false`).

## Environment final (safe default restored)

| Setting | Value |
|---|---|
| `AI_GENERATION_ENABLED` | `false` |
| `AI_PROVIDER_MOCK` | `true` |
| `AI_PROVIDER_MOCK_MODE` | `success` |
| `VITE_USE_MOCKS` | `true` |
| `GET /api/health` | `aiGenerationEnabled=false`, `aiProviderMock=true` |

## Resolved non-blocking

- PowerShell em dash parse error in `smoke-all-local.ps1`
- `smoke:all:local` missing Sprint 9 phases (now 13/13)
- Hung API on :8787 during long smoke (mitigation: single listener before re-run)
- `docs/36` / `scripts/README` orchestrator phase count outdated

## Remaining non-blocking

- `smoke:all:local:full` local/manual only; env-switching playbook documented, not auto-run
- Live rewrite/publish copy OpenRouter spot check
- CI API-mode E2E (write/rewrite/publish AI)
- True DB RPC credit + attempt atomicity before production
- Topup / payment / admin credit dashboard (Sprint 10+)

## Next recommended task

**Task 10.0** — Production Readiness / Monetization Plan (after 9.9 hygiene; discuss true RPC credit hardening before deploy).