# Task 10.0 — Production Readiness / Monetization Plan (Mayar)

**Date:** 2026-06-08
**Sprint:** sprint-10
**Status:** completed

## Task goal

Docs-only Sprint 10 plan: production readiness + credit topup/monetization via Mayar Headless API. Cover architecture, data model, webhook idempotency, credit granting, UI/ops/smoke/env, task breakdown 10.1–10.7. No coding, migrations, endpoints, or env changes.

## Files read

- `README.md`
- `docs/49-sprint-9-verification-report.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `docs/47-live-openrouter-staging-smoke-report.md`
- `.agent-logs/sprint-9/task-9.9-smoke-orchestrator-live-spot-check.md`
- `apps/api/README.md` (structure + services index)
- `apps/api/src/services/credit-ledger.ts`
- `apps/api/src/services/credit.ts`
- `apps/api/src/services/ai-credit-policy.ts`
- `apps/api/src/routes/credits.ts`
- `apps/api/src/env.ts`
- `supabase/migrations/00008_sprint8_ai_generation_credit.sql`
- `supabase/migrations/00001_sprint2_core.sql` (credit_balances)
- `packages/shared/src/enums.ts` (CREDIT_LEDGER_DIRECTIONS, AUDIT_ACTIONS)
- `scripts/README.md`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`

## Mayar docs consulted (official URLs)

| Doc | URL |
|---|---|
| Introduction (auth, sandbox, base URL) | https://docs.mayar.id/api-reference/introduction |
| Create Invoice | https://docs.mayar.id/api-reference/invoice/create |
| Invoice detail/status | https://docs.mayar.id/api-reference/invoice/detail |
| Webhook integration | https://docs.mayar.id/integration/webhook |
| Register webhook URL | https://docs.mayar.id/api-reference/webhook/registerurlhook |

**Not consulted:** Mayar transaction history / webhook retry pages (optional; deferred to Task 10.5 sandbox).

## Files created/changed

| Path | Change |
|---|---|
| `docs/50-sprint-10-production-readiness-mayar-monetization-plan.md` | **Created** — Sprint 10 implementation plan (20 sections) |
| `.agent-logs/sprint-10/task-10.0-production-readiness-mayar-monetization-plan.md` | **Created** — this log |
| `README.md` | Link `docs/50`; next task → 10.1 |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Topup/payment → Sprint 10 plan link |

**No application code, migration, endpoint, or env file changes.**

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | **tidak dijalankan** — docs-only task |
| `npm run smoke:all:local` | **tidak dijalankan** — docs-only task |
| `npm run build:api` | **tidak dijalankan** — docs-only task |

## Results

| Item | Outcome |
|---|---|
| Sprint 10 plan document | **Created** — `docs/50` |
| Mayar API contract cited | Invoice create, detail, webhook, register |
| Data model proposal | Migration `00009` required; use existing `credit` ledger direction |
| Task breakdown | 10.1–10.7 defined |
| Secrets in repo | **None** |

## Decisions

1. **Use existing `credit_ledger_direction.credit`** for topup grants — no new enum value; `reason=credit_topup`. Migration `00008` already defines `credit`.
2. **Table name `credit_topup_orders`** over generic `payment_sessions` — aligns with domain; `provider=mayar` allows future providers.
3. **`CREDIT_TOPUP_ENABLED=false` default** — same safety pattern as `AI_GENERATION_ENABLED=false`.
4. **`PAYMENT_PROVIDER_MOCK=true` for local smoke** — mirrors `AI_PROVIDER_MOCK` pattern from Sprint 8.
5. **Grant only from webhook** (plus idempotent ops retry) — redirect does not grant credits.
6. **True DB RPC for grant path before production** — TransactionPlan acceptable for staging only (consistent with docs/36 P1).
7. **IDR package pricing marked proposal** — not final business decision.
8. **Mayar `extraData` maps** `orderId` + `productSlug`; compat fields `noCustomer`/`idProd` per Mayar doc examples.

## Limitations

- Exact Mayar `payment.received` webhook JSON not captured — requires Task 10.5 sandbox.
- Webhook signature verification not documented by Mayar in fetched pages — open question.
- README Sprint 10 task table row (10.1–10.7 status) deferred until tasks start.
- Refund/chargeback automation out of v1 scope.
- Welcome bonus abuse prevention sketched, not fully specified.

## Next recommended task

**Task 10.1 — Mayar/Payment Data Model + Shared Types** — migration `00009`, seed packages, audit enums, shared types; no Mayar HTTP yet.