# Task 10.12 — Duitku Callback + Idempotent Grant

**Date:** 2026-06-09  
**Sprint:** sprint-10  
**Status:** completed

## Task goal

Implement Duitku POP callback route with form-urlencoded parsing, MD5 signature validation, idempotent webhook event processing, and credit grant via existing `grantCreditsForPaymentSession`. Callback is the sole Duitku grant path; redirect never grants.

## Files read

- `docs/57`, `docs/56`, `docs/55`, `docs/52`, `docs/36`
- `.agent-logs/sprint-10/task-10.10-*.md`, `task-10.11-*.md`
- `apps/api/src/services/duitku-pop-client.ts`, `process-mayar-payment-webhook.ts`
- `payment-webhook-event.ts`, `credit-topup-grant.ts`, `mayar-webhook.ts`
- `routes/payment-webhooks.ts`, `env.ts`
- `scripts/sprint10-duitku-smoke-api.ps1`, `sprint10-smoke-api.ps1`
- Duitku POP docs + [duitku-php Pop.php](https://github.com/duitkupg/duitku-php/blob/master/Duitku/Pop.php)

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/lib/md5.ts` | **Created** — MD5 hex for callback signature |
| `apps/api/src/services/duitku-callback.ts` | **Created** — parse, validate, normalize |
| `apps/api/src/services/process-duitku-payment-callback.ts` | **Created** — grant orchestration |
| `apps/api/src/routes/payment-webhooks.ts` | Added `POST /api/payments/duitku/callback` |
| `apps/api/src/env.ts` | Smoke callback fixture helpers + health flag |
| `scripts/sprint10-duitku-smoke-api.ps1` | Callback fixture matrix A–H |
| `docs/58-duitku-callback-idempotent-grant-report.md` | **Created** |
| `.agent-logs/sprint-10/task-10.12-duitku-callback-idempotent-grant.md` | **Created** |
| `apps/api/.dev.vars.example`, `README.md`, `docs/36`, `docs/56`, `docs/57`, `scripts/README.md`, `apps/api/README.md` | Task 10.12 pointers |

**Not changed:** `credit-topup-grant.ts`, Mayar webhook behavior, migrations, topup UI

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint10:duitku` | PASS (15 PASS, 0 FAIL) |
| `npm run smoke:api:sprint10` | PASS (25/25) |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5`–`sprint9` | PASS |
| `npm run smoke:web:topup` | PASS |
| `npm run smoke:all:local` | PASS (14/14 phases) |
| Live Duitku sandbox callback | **tidak dijalankan** — no real credentials |

## Results

- Callback route parses form-urlencoded, validates MD5 signature per PHP lib
- Grant only on `resultCode=00` + valid signature + amount/order match
- Fixture smoke matrix A–H PASS (development smoke credentials auto-enabled)
- Mayar/mock sprint10 regression PASS
- No Duitku production GO claim

## Decisions

- Callback signature: **MD5**(`merchantCode+amount+merchantOrderId+merchantKey`) per official PHP lib (not HMAC)
- Development auto-enables smoke fixture credentials when real Duitku keys unset
- `merchantOrderId` = `credit_topup_orders.id` UUID
- Reuse existing audit actions — no migration
- Invalid signature / wrong merchant / mismatch → failed event, no grant

## Limitations

- Live Duitku sandbox callback not verified with real provider
- Smoke fixture key is local-only documented constant (not production)
- Production payment NOT ENABLED

## Next recommended task

**Task 10.13 — Duitku Sandbox Live Smoke** — optional real credentials, live checkout + callback capture