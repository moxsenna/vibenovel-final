# Task 10.2 — Payment Provider Abstraction + Mayar Invoice Create Shell

**Date:** 2026-06-08
**Sprint:** sprint-10
**Status:** completed

## Task goal

Payment provider abstraction, Mayar invoice create client, mock provider, `GET /api/credits/topup/products`, `POST /api/credits/topup/checkout` creating pending orders + invoice metadata. No webhook, no credit grant, no balance mutation, no UI.

## Files read

- `README.md`, `docs/50`, task-10.1 work log, migration `00009`
- `packages/shared` enums/domain/index
- `apps/api` env, routes/credits, credit.ts, credit-ledger.ts, audit*, mappers
- `scripts/sprint9-smoke-api.ps1`, `package.json`
- Mayar docs: introduction, invoice/create, invoice/detail

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/env.ts` | Topup/Mayar bindings + health flags |
| `apps/api/src/services/payment-provider-types.ts` | **Created** |
| `apps/api/src/services/payment-provider.ts` | **Created** |
| `apps/api/src/services/mayar-client.ts` | **Created** |
| `apps/api/src/services/mock-payment-provider.ts` | **Created** |
| `apps/api/src/services/credit-topup.ts` | **Created** |
| `apps/api/src/routes/credits.ts` | Topup products + checkout routes |
| `apps/api/src/lib/mappers.ts` | Topup row/summary mappers |
| `apps/api/src/services/audit-snapshot.ts` | Payment secret key stripping |
| `apps/api/.dev.vars.example` | Topup env placeholders |
| `scripts/sprint10-smoke-api.ps1` | **Created** |
| `package.json` | `smoke:api:sprint10` alias |
| `apps/api/README.md`, `README.md`, `docs/36`, `docs/50`, `scripts/README.md` | Docs |
| `.agent-logs/sprint-10/task-10.2-payment-provider-mayar-invoice-create-shell.md` | **Created** |

**Not changed:** `credit-ledger.ts`, `credit_balances` writers, AI routes, migrations, `apps/api/.dev.vars` (not committed)

## Decisions

1. **`GET products` allowed when topup disabled** — read-only catalog; checkout gated `503 TOPUP_DISABLED`.
2. **Idempotency replay** — same user + key + pending + `payment_url` → return existing (`idempotentReplay: true`), no second provider call.
3. **Idempotency conflict** — existing order same key without `payment_url` → `409 CONFLICT` (new key required).
4. **Provider failure** — order stays `pending` without `payment_url`; no balance/ledger mutation.
5. **Mobile** — sandbox/mock placeholder `081000000000`; live Mayar production → `400 MOBILE_REQUIRED` if no profile metadata phone/mobile.
6. **Forbidden checkout body fields** — rejected `400 BAD_REQUEST` (not silently ignored).
7. **Audit** — `credit_topup_checkout_created` + `payment_invoice_created`; no raw provider payload in audit.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api:sprint10` (disabled baseline) | **PASS** — 8/8 |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** — 14/14 (env + API restart) |
| `npm run smoke:api:sprint10 -- -MockMode fail_provider` | **PASS** — 8/8 (env + API restart) |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 68/68 |
| `npm run smoke:api:sprint7` | **PASS** — 53/53 |
| `npm run smoke:api:sprint8` | **PASS** — 8 PASS, 5 NOT RUN |
| `npm run smoke:api:sprint9` | **PASS** — 10 PASS, 11 NOT RUN |
| `npm run smoke:all:local` | **PASS** — 13/13, ~1.3m |

## DB verification (mock checkout)

| Check | Result |
|---|---|
| `credit_topup_orders` +1 | pending, mock_inv_* / mock_trx_* |
| `amount_idr` / `credits_to_grant` | server-side from product seed |
| `credit_balances` | unchanged |
| `credit_ledger` credit_topup rows | 0 |

## Limitations

- No webhook endpoint, `grantCreditsForPaymentSession`, topup UI, admin dashboard
- No live Mayar sandbox smoke (requires real key + `PAYMENT_PROVIDER_MOCK=false`)
- Rate limit checkout per user deferred
- Order status polling route deferred (10.3/10.4)

## Next recommended task

**Task 10.3 — Mayar Webhook + Idempotent Credit Grant**