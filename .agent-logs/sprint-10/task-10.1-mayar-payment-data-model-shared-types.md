# Task 10.1 — Mayar/Payment Data Model + Shared Types

**Date:** 2026-06-08
**Sprint:** sprint-10
**Status:** completed

## Task goal

Create Sprint 10 payment topup schema foundation: migration `00009`, shared enums/types, seed credit packages, audit enum extensions. No Mayar HTTP, checkout API, webhook, grant service, or UI.

## Files read

- `README.md`
- `docs/50-sprint-10-production-readiness-mayar-monetization-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `.agent-logs/sprint-10/task-10.0-production-readiness-mayar-monetization-plan.md`
- `supabase/migrations/00008_sprint8_ai_generation_credit.sql`
- `supabase/README.md`
- `packages/shared/src/enums.ts`, `domain.ts`, `index.ts`
- `packages/shared/README.md`
- `apps/api/src/services/audit.ts`, `audit-snapshot.ts` (pattern reference)
- `apps/api/src/services/credit-ledger.ts`, `credit.ts` (no changes)
- `package.json`, `scripts/smoke-all-local.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `supabase/migrations/00009_sprint10_payment_topup.sql` | **Created** — enums, 3 tables, audit extend, seed 4 packages, RLS |
| `packages/shared/src/enums.ts` | Sprint 10 enums + audit actions/entities |
| `packages/shared/src/domain.ts` | `CreditTopupProduct`, `CreditTopupOrder`, `PaymentWebhookEvent`, `CreditTopupCheckoutSnapshot` |
| `packages/shared/src/index.ts` | Barrel exports |
| `supabase/README.md` | Migration 00009 section |
| `packages/shared/README.md` | Sprint 10 guardrails |
| `README.md` | Sprint 10 task table; 10.1 ✅; next 10.2 |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Topup schema addressed |
| `docs/50-sprint-10-production-readiness-mayar-monetization-plan.md` | §21 Task 10.1 status |
| `apps/api/README.md` | Placeholder env names (no values) |
| `.agent-logs/sprint-10/task-10.1-mayar-payment-data-model-shared-types.md` | **Created** — this log |

**Not changed:** `credit-ledger.ts`, AI routes, `apps/api/.dev.vars`, `apps/web/.env.local`

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** (wrangler dry-run) |
| `supabase db reset` | **PASS** — `00009` applied |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 68/68 |
| `npm run smoke:api:sprint7` | **PASS** — 53/53 |
| `npm run smoke:api:sprint8` | **PASS** — 8 PASS, 5 NOT RUN |
| `npm run smoke:api:sprint9` | **PASS** — 10 PASS, 11 NOT RUN |
| `npm run smoke:all:local` | **PASS** — 13/13, exit 0, ~1.3m |

## DB verification (post `supabase db reset`)

| Check | Result |
|---|---|
| `credit_topup_products` count | **4** |
| `credit_topup_orders` count | **0** |
| `payment_webhook_events` count | **0** |
| Seed slugs | starter, creator, pro, studio |
| Prices (IDR) | 39000, 99000, 199000, 399000 |
| Credits / bonus | 100/0, 300/20, 700/50, 1500/150 |
| `metadata.proposalPricing` | **true** all rows |
| RLS enabled | **true** on all 3 tables |
| Audit actions added | 7 payment/topup actions in `audit_action` enum |

## Decisions

1. **`credit_ledger_direction` unchanged** — use existing `credit` for topup grant in Task 10.3.
2. **`CREDIT_LEDGER_TOPUP_REASONS`** in shared (`credit_topup`, `welcome_bonus`) — API `CREDIT_LEDGER_REASONS` unchanged until 10.3.
3. **`user_id` FK → `profiles(id)`** — consistent with `credit_balances` / `generation_attempts`.
4. **`payment_webhook_events` no authenticated GRANT** — operational service_role only.
5. **`credit_topup_orders` owner SELECT only** — no authenticated INSERT/UPDATE/DELETE policies.
6. **Seed uses `ON CONFLICT (slug) DO UPDATE`** — idempotent on db reset.
7. **Provider as text** default `mayar` — `PAYMENT_PROVIDERS` const in shared for typing.

## Limitations

- No checkout API, webhook endpoint, Mayar client, grant service, audit writers, mappers, or UI.
- No `CREDIT_TOPUP_ENABLED` in `env.ts` yet (Task 10.2).
- Welcome bonus not seeded — deferred.
- True DB RPC for grant still P1 before production.

## Next recommended task

**Task 10.2 — Payment Provider Abstraction + Mayar Invoice Create Shell** (`mayar-client.ts`, mock provider, `POST /api/credits/topup/checkout`, `GET products`).