# Task 10.6 — Ops Minimal + Payment Safety Regression

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed

## Goal

Ops runbook, support checklist, smoke consolidation, and safety regression matrix for payment/topup before Sprint 10 closure. No production payment enablement.

## Files read

- `README.md`, `docs/50`, `docs/51`, `docs/36`, Tasks 10.1–10.5 work logs
- `scripts/sprint10-*.ps1`, `scripts/smoke-all-local.ps1`
- `apps/api/src/routes/credits.ts`, `payment-webhooks.ts`, payment services

## Files created/changed

| Path | Change |
|---|---|
| `docs/52-sprint-10-payment-ops-and-safety-regression.md` | **Created** — runbook A–D, support checklist, smoke matrix, safety assertions |
| `scripts/smoke-all-local.ps1` | Phase 14 — `sprint10-smoke-web.ps1` (mock only) |
| `README.md`, `docs/50`, `docs/51`, `docs/36`, `scripts/README.md`, `apps/api/README.md` | Task 10.6 status |

**Not implemented (deferred):** `GET /api/credits/topup/orders/:orderId`, admin dashboard

## Inspect endpoint decision

**Deferred.** `CreditTopupReturnPage` uses Refresh Saldo (`GET /api/credits/balance`) only. Owner order read documented as future contract in `docs/52` §F.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` / `build:web` / `build:api` | **PASS** |
| `npm run smoke:api:sprint10` | **PASS** 25/25 |
| `npm run smoke:web:topup` | **PASS** |
| `npm run smoke:api:sprint10:mayar-live` | **PASS** (precheck; live NOT RUN — no key) |
| `npm run smoke:api:sprint10:dual-app` | **PASS** 13/13 |
| `npm run smoke:api` | **PASS** 17/17 |
| `npm run smoke:api:sprint5`–`sprint9` | **PASS** |
| `npm run smoke:all:local` | **PASS** 14/14 phases |

## Results

- Ops runbook covers local safe, sandbox live, production gates, rollback.
- Support checklist docs-only (SQL examples, no admin UI).
- `smoke:all:local` includes Sprint 10 web topup mock (phase 14).
- Dual-app and live Mayar remain separate commands.
- Production status: **NOT PRODUCTION READY** / **PARTIAL GO** unchanged.

## Decisions

- No new API endpoints — minimize scope; balance refresh sufficient for MVP return UX.
- Orchestrator adds mock-only Sprint 10 web — no dual-app, no live Mayar in default suite.

## Limitations

- Live Mayar gates still operator-dependent (Task 10.5).
- CI smoke still local-only.
- Order status polling endpoint deferred.

## Next recommended task

**Task 10.7** — Sprint 10 verification report (closure doc).