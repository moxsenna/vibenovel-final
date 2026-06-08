# Task 7.8.4 — smoke:all:local consolidation

**Date:** 2026-06-08
**Sprint:** sprint-7
**Status:** completed

## Task goal

Update local smoke orchestrator (`smoke:all:local` / `smoke:all:local:full`) to include Sprint 6/7 API smokes and summary/publish web smokes. Scripts/docs only — no product behavior changes.

## Files read

- `README.md`
- `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `scripts/README.md`
- `package.json`
- `scripts/smoke-all-local.ps1` (prior Task 5.8 version)
- `scripts/sprint2-smoke-api.ps1`, `sprint5/6/7-smoke-api.ps1`
- `scripts/sprint3/4/5/6/7-smoke-web.ps1`
- `apps/web/package.json`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `scripts/smoke-all-local.ps1` | Rewritten for 9 phases, params, elapsed time, collect-failures summary |
| `scripts/README.md` | Updated smoke index + local suite section (7.8.4) |
| `README.md` | Updated `smoke:all:local` / `:full` descriptions |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Marked 7.8.4 done; updated item 12 |
| `.agent-logs/sprint-7/task-7.8.4-smoke-all-local-consolidation.md` | This log |

`package.json` — no change required (aliases already correct).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS (17 steps) |
| `npm run smoke:api:sprint5` | PASS (49 steps) |
| `npm run smoke:api:sprint6` | PASS (68 steps) |
| `npm run smoke:api:sprint7` | PASS (53 steps) |
| `npm run smoke:all:local` | PASS (9 phases, ~1.3m) |
| `npm run smoke:all:local:full` | PASS (9 phases + API-mode web, ~2.5m) |

## Results

- Orchestrator runs phases 1–9 in order: Sprint 2/5/6/7 API, then Sprint 3–7 web mock.
- `-IncludeApiMode` (`smoke:all:local:full`) passes flag to all five web wrappers (incl. summary/publish).
- Collect-failures mode with summary table (Phase, Suite, Result, Elapsed, Detail); exit 1 on any FAIL.
- Params: `-IncludeApiMode`, `-SkipWeb`, `-SkipApi`, `-WebBaseUrl`, `-ApiBaseUrl`.
- No secrets printed in orchestrator output.
- Fixed PowerShell parse errors (em-dash in string, `<->` operator) during verification.

## Decisions

- **Collect failures** (not fail-fast) per spec — run all phases, summarize at end.
- **Full mode** passes `-IncludeApiMode` to sprint3–7 web scripts (all documented as supporting API-mode); outline/write included as stable per `scripts/README.md`.
- **package.json** left unchanged — existing npm aliases already map to orchestrator correctly.
- **API scripts** receive `-ApiBaseUrl`; web scripts receive `-WebBaseUrl`, `-ApiBaseUrl`, and optional `-IncludeApiMode`.

## Limitations

- `smoke:all:local:full` remains local/manual only — not in GitHub Actions (Task 7.8.5 deferred per user scope).
- Switching mock ↔ API mode requires `VITE_USE_MOCKS` change + `dev:web` restart — documented, not automated.
- Multiple stale `dev:api`/`dev:web` terminal sessions observed in environment; verification succeeded against active servers on :8787/:5173.
- Bash port for Linux CI still pending (P2 per `docs/41`).

## Next recommended task

**Task 7.8.6** — Hardening verification report (`docs/43`), per Sprint 8 gate in `docs/36`. Do **not** start 7.8.5 (CI E2E) unless explicitly requested.