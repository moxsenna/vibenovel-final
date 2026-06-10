# Task 10.3 — Mayar Webhook + Idempotent Credit Grant

**Date:** 2026-06-08
**Sprint:** sprint-10
**Status:** completed

## Task goal

Implement `POST /api/payments/mayar/webhook` (public, no JWT), persist/dedupe `payment_webhook_events`, process `payment.received`/paid mock payloads, and grant credits via `credit_ledger direction=credit` + `credit_balances` update + order `paid` — idempotent, no UI/admin, no live Mayar sandbox.

## Files read

- `README.md`, `docs/50`, `docs/36`, task-10.1/10.2 work logs
- `supabase/migrations/00009_sprint10_payment_topup.sql`
- `apps/api/src/routes/credits.ts`, `credit-topup.ts`, `payment-provider.ts`, `mayar-client.ts`, `mock-payment-provider.ts`
- `apps/api/src/services/credit-ledger.ts`, `credit.ts`, `audit.ts`, `audit-snapshot.ts`, `transaction.ts`
- `apps/api/src/lib/mappers.ts`, `apps/api/src/routes/index.ts`
- `scripts/sprint10-smoke-api.ps1`, `package.json`, `.agents/rules/09-agent-work-logs.md`
- Mayar docs: webhook integration, invoice detail (reference)

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/mayar-webhook.ts` | **Created** — tolerant parser, safe JSON, `payload_hash` |
| `apps/api/src/services/payment-webhook-event.ts` | **Created** — insert/dedupe, status updates, audit |
| `apps/api/src/services/credit-topup-grant.ts` | **Created** — `grantCreditsForPaymentSession` |
| `apps/api/src/services/process-mayar-payment-webhook.ts` | **Created** — orchestrator |
| `apps/api/src/routes/payment-webhooks.ts` | **Created** — `POST /api/payments/mayar/webhook` |
| `apps/api/src/routes/index.ts` | Register payment webhook routes |
| `apps/api/src/services/audit.ts` | `userId` optional (`string \| null`) for webhook audits |
| `apps/api/src/lib/mappers.ts` | `mapPaymentWebhookEventRow` |
| `apps/api/src/services/audit-snapshot.ts` | Extra forbidden keys (webhook/PII) |
| `scripts/sprint10-smoke-api.ps1` | Webhook smoke cases + `Get-RestRowCount` fix |
| `README.md`, `apps/api/README.md`, `docs/36`, `docs/50`, `scripts/README.md` | Docs |
| `.agent-logs/sprint-10/task-10.3-mayar-webhook-idempotent-credit-grant.md` | **Created** |

**Not changed:** migrations, AI debit/refund, checkout shell behavior (except bugfixes), `apps/api/.dev.vars` (not committed)

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api:sprint10` (disabled baseline) | **PASS** — 9/9 |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** — 22/22 (env `CREDIT_TOPUP_ENABLED=true` + API restart) |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 68/68 |
| `npm run smoke:api:sprint7` | **PASS** — 53/53 |
| `npm run smoke:api:sprint8` | **PASS** — 8 PASS, 5 NOT RUN |
| `npm run smoke:api:sprint9` | **PASS** — 10 PASS, 11 NOT RUN |
| `npm run smoke:all:local` | **PASS** — 13/13, ~1.2m |

## Results

### Webhook route

- `POST /api/payments/mayar/webhook` — public JSON; `503 TOPUP_DISABLED` when `CREDIT_TOPUP_ENABLED=false`
- Safe JSON response (no raw provider payload, no secrets)
- Duplicate `payload_hash` → `200` `{ ok: true, duplicate: true }`

### Parser / event persistence

- `mayar-webhook.ts` — `payment.received`, mock shape, sanitized `payload_safe_json`, SHA-256 `payload_hash`
- `payment_webhook_events` insert with unique `provider + payload_hash`; statuses `received/processed/ignored/failed`
- Audit: `payment_webhook_received` (with `user_id` when order resolvable), `payment_webhook_processed`, `payment_webhook_failed`

### Grant behavior

- `grantCreditsForPaymentSession` — order `pending` + `payment_url` required; amount/provider id validation
- `credit_ledger direction=credit`, `reason=credit_topup`, `metadata.orderId` idempotency
- `credit_balances.balance += credits_to_grant`; order `status=paid`, `paid_at` set
- Audit `credit_topup_granted`; compensation on partial failure via `TransactionPlan`

### DB verification (mock `payment.received`)

| Check | Result |
|---|---|
| `credit_topup_orders.status` | `paid`, `paid_at` not null |
| `payment_webhook_events.processing_status` | `processed` on success |
| `credit_balances` | +`credits_to_grant` (starter +100) |
| `credit_ledger` | 1 row `direction=credit`, `reason=credit_topup` |
| Duplicate webhook | no second ledger row; balance unchanged |
| Amount mismatch / unknown order | no grant; event `failed` |
| Non-paid event | `ignored`; no grant |

## Decisions

1. **Webhook gated same as checkout** — `CREDIT_TOPUP_ENABLED=false` → `503 TOPUP_DISABLED` on webhook too.
2. **Unknown order / amount mismatch** — store event `failed`, return `200 ok:true` (avoid provider retry storms).
3. **Non-`payment.received` or unpaid** — `ignored`, no grant.
4. **Grant idempotency** — `payload_hash` dedupe + order `paid` + existing ledger `metadata.orderId` query (no migration).
5. **Audit `user_id` on receive** — resolve order before persist when `extraData.orderId`/provider ids available.
6. **No signature verification** — deferred until Mayar documents mechanism (Task 10.5).
7. **Transaction hardening** — `TransactionPlan` compensation; true Postgres RPC still recommended pre-production.

## Limitations

- Exact live Mayar `payment.received` JSON not captured — tolerant parser + mock shape only (Task 10.5).
- Webhook signature verification not implemented.
- True DB RPC atomicity not implemented — compensation runner only.
- No topup UI, no admin dashboard, no live Mayar sandbox smoke.
- `apps/api/.dev.vars` not committed.

## Next recommended task

**Task 10.4 — Topup UI** — product list, mock checkout redirect, pending/paid polling; no admin dashboard.