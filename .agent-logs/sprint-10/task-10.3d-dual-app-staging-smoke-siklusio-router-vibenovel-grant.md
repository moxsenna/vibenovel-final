# Task 10.3d — Dual-App Staging Smoke: Siklusio Router → VibeNovel Grant

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed (local cross-repo PASS)

## Goal

Verify end-to-end that Siklusio `POST /api/payment/webhook` forwards `extraData.app=vibenovel` + `flow=credit_topup` to VibeNovel, and VibeNovel grants credits exactly once with duplicate idempotency.

## Files created/changed

| Path | Change |
|---|---|
| `scripts/sprint10-dual-app-smoke.ps1` | **Created** — cross-repo smoke orchestrator |
| `package.json` | `smoke:api:sprint10:dual-app` script |
| `apps/api/.dev.vars` | `CREDIT_TOPUP_ENABLED=true` (gitignored, not committed) |
| `docs/50` §26 | Task 10.3d status |
| `docs/36` | Router + forward-token deferred items |
| `README.md` | 10.3c/10.3d status |

**Siklusio (gitignored `.dev.vars` only):** router env for local dev — see Siklusio work log.

## Env mode (no secrets logged)

### VibeNovel API (`apps/api/.dev.vars`)

| Variable | Value |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` |
| `AI_GENERATION_ENABLED` | `false` |
| `AI_PROVIDER_MOCK` | `true` |

### Siklusio backend (`.dev.vars`)

| Variable | Value |
|---|---|
| `MAYAR_MULTI_APP_ROUTER_ENABLED` | `true` |
| `VIBENOVEL_MAYAR_WEBHOOK_URL` | `http://127.0.0.1:8787/api/payments/mayar/webhook` |
| `MAYAR_WEBHOOK_TOKEN` | local smoke token (configured, not logged) |
| `MAYAR_API_KEY` | local dummy (webhook path only) |

**Mayar dashboard URL:** unchanged (still Siklusio production URL).

## Cross-repo smoke results

Command: `npm run smoke:api:sprint10:dual-app`

| Step | Result |
|---|---|
| VibeNovel pending checkout (`starter`) | **PASS** |
| Siklusio forward `routed=vibenovel` | **PASS** — HTTP 200 |
| VibeNovel grant once | **PASS** — balance 0→100, ledger `credit_topup` ×1, `paid_at` set |
| Audit `payment_webhook_processed` + `credit_topup_granted` | **PASS** |
| Duplicate same payload | **PASS** — balance/ledger unchanged |
| Non-vibenovel (siklusio / unknown / legacy) | **PASS** — not forwarded; VN events/ledger unchanged |
| Forward failure 502 live | **NOT RUN** — 10.3c unit test `vibenovelWebhookForward.test.ts` |

**Summary:** PASS=13 FAIL=0 NOT RUN=1 (forward failure live)

## Token/header validation

VibeNovel `POST /api/payments/mayar/webhook` does **not** validate `X-VibeNovel-Forward-Token` today. Siklusio may send forward headers; optional token is deferred hardening (documented in `docs/36`).

## Regression commands

| Command | Result |
|---|---|
| `npm run smoke:api:sprint10:dual-app` | **PASS** — 13/13 |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** — 24/24 |
| `npm run smoke:all:local` | **PASS** — 13/13 |
| Siklusio `npm run typecheck:backend` | **PASS** |
| Siklusio `npm test` | **PASS** |

## Rollback

- Siklusio: `MAYAR_MULTI_APP_ROUTER_ENABLED=false`
- Mayar dashboard: no change

## Known limitations

- Local smoke only — staging/prod replay still required before production router enable
- Forward failure 502 not re-tested live (unit test coverage)
- No `X-VibeNovel-Forward-Token` validation on VibeNovel webhook

## Next recommended task

**Task 10.4 — Credit Topup UI** (local router path verified; staging Go/No-Go before prod enable).