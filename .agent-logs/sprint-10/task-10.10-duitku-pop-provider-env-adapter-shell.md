# Task 10.10 — Duitku POP Provider Env + Adapter Shell

**Date:** 2026-06-09  
**Sprint:** sprint-10  
**Status:** completed

## Task goal

Implement Duitku POP as second payment provider foundation for VibeNovel credit topup: env bindings, `PAYMENT_PROVIDER` selector, `duitku-pop-client.ts` createInvoice shell (signature + response mapper), smoke precheck, documentation. No callback/grant, no production enablement, no Mayar removal.

## Files read

- `docs/50`, `docs/52`, `docs/53`, `docs/54`, `docs/55`, `docs/36`
- `.agent-logs/sprint-10/task-10.9-duitku-provider-spike-feasibility.md`
- `.agents/rules/09-agent-work-logs.md`
- `apps/api/src/env.ts`, `services/payment-provider.ts`, `payment-provider-types.ts`
- `services/mayar-client.ts`, `mock-payment-provider.ts`, `credit-topup.ts`, `credit-topup-grant.ts`
- `apps/api/src/routes/credits.ts`, `payment-webhooks.ts`
- `apps/api/.dev.vars.example`, `apps/api/README.md`
- `packages/shared/src/enums.ts`, `domain.ts`, `index.ts`
- `scripts/sprint10-smoke-api.ps1`, `package.json`
- `apps/web/src/pages/CreditTopupPage.tsx`, `CreditTopupReturnPage.tsx`
- Duitku POP docs: https://docs.duitku.com/pop/id/

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/duitku-pop-client.ts` | **Created** — createInvoice, HMAC signature, response mapper |
| `scripts/sprint10-duitku-smoke-api.ps1` | **Created** — precheck + optional `-LiveCreate` |
| `docs/56-duitku-pop-provider-adapter-shell.md` | **Created** — Task 10.10 report |
| `.agent-logs/sprint-10/task-10.10-duitku-pop-provider-env-adapter-shell.md` | **Created** — this log |
| `apps/api/src/env.ts` | `PAYMENT_PROVIDER`, Duitku env helpers, health booleans |
| `apps/api/src/services/payment-provider.ts` | Route `duitku` → `createDuitkuPopInvoice` |
| `apps/api/src/services/payment-provider-types.ts` | `provider: "duitku"` |
| `apps/api/src/services/credit-topup.ts` | `getPaymentReturnBaseUrl`, sandbox mobile placeholder |
| `packages/shared/src/enums.ts` | `PAYMENT_PROVIDERS.duitku` |
| `apps/api/.dev.vars.example` | Duitku env name placeholders |
| `package.json` | `smoke:api:sprint10:duitku` |
| `docs/55-duitku-provider-spike-and-migration-feasibility.md` | §15 addendum: POP selected, V2 deferred |
| `docs/36`, `docs/50`, `README.md`, `scripts/README.md`, `apps/api/README.md` | Task 10.10 pointers |

**Not changed:** `credit-topup-grant.ts`, callback routes, migrations, topup UI (no redesign), `.dev.vars` values (gitignored)

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS (after fixing unused import/const) |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint10` | PASS (25 PASS, 0 FAIL) |
| `npm run smoke:api:sprint10:duitku` | PASS (4 PASS, 0 FAIL; live steps NOT RUN — mock mode) |
| `npm run smoke:api` | PASS (17 PASS) |
| `npm run smoke:api:sprint5` | PASS (49 PASS) |
| `npm run smoke:api:sprint6` | PASS (68 PASS) |
| `npm run smoke:api:sprint7` | PASS (53 PASS) |
| `npm run smoke:api:sprint8` | PASS (8 PASS, 5 NOT RUN — AI disabled) |
| `npm run smoke:api:sprint9` | PASS (10 PASS, 11 NOT RUN — AI disabled) |
| `npm run smoke:web:topup` | PASS (2 PASS) |
| `npm run smoke:all:local` | PASS (14 phases PASS) |
| `-LiveCreate` sandbox invoice | **tidak dijalankan** — no Duitku credentials in local `.dev.vars` |

## Results

- `PAYMENT_PROVIDER=duitku` routes to Duitku POP client when mock off
- Health exposes `paymentProvider`, `duitkuEnv`, `hasDuitkuMerchantCode`, `hasDuitkuMerchantKey` — no secrets
- Duitku smoke precheck PASS with mock mode (live steps skipped as designed)
- Mayar + mock regression unchanged (sprint10 smoke PASS)
- No callback grant, no balance mutation from Duitku path
- Fixed PowerShell parse error in duitku smoke script (em dash in string → ASCII hyphen)

## Decisions

- **POP selected for MVP; V2 deferred** (founder clarification documented in docs/55 §15)
- Default `PAYMENT_PROVIDER` when unset: `mayar` (backward compatible)
- `PAYMENT_PROVIDER_MOCK=true` still wins over selector
- Create signature: HMAC_SHA256 per POP docs (`merchantCode + timestamp`)
- `merchantOrderId` = VibeNovel order UUID; `providerTransactionId` = Duitku `reference`
- `paymentMethod=""` so user picks method on Duitku hosted page
- `payloadSafe` stores `paymentUrlDomain` only, not full tokenized URL
- Callback signature deferred to 10.12 (PHP lib uses MD5 — verify then)

## Limitations

- No `POST /api/payments/duitku/callback` route
- No sandbox `-LiveCreate` verified (credentials not configured locally)
- Create signature may need sandbox tuning if API rejects HMAC vs PHP lib SHA256 concat
- `customerMobile` required for Duitku invoice create (sandbox placeholder when sandbox mode)
- Production payment NOT ENABLED
- No Duitku GO claim

## Next recommended task

**Task 10.11 — Duitku Checkout Integration** — end-to-end checkout when `PAYMENT_PROVIDER=duitku`, verify pending order + `paymentUrl` in smoke; still no grant.