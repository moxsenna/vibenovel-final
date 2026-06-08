# Task 8.3 — Credit Debit/Refund Service

**Date:** 2026-06-08
**Sprint:** sprint-8
**Status:** completed

## Task goal

Internal credit preflight, debit, refund, and append-only ledger service for future AI generation (Task 8.4). No public routes, no OpenRouter, no AI output persistence.

## Pre-task check: sprint6-smoke-api.ps1

| Check | Result |
|---|---|
| Script vs 7.8.3 hardening | **Intact** — audit + transaction assertions present |
| Live run `smoke:api:sprint6` | **68/68 PASS** |
| Task 8.2 log said 59/59 | **Salah tulis laporan** — corrected in `task-8.2-model-router-openrouter-shell.md`; script not rolled back |

## Files read

- `README.md`, `docs/44`, `docs/43` (partial), `docs/36` (partial)
- `supabase/migrations/00008_sprint8_ai_generation_credit.sql`
- `apps/api/src/services/credit.ts`, `credit-ledger.ts` (new)
- `apps/api/src/routes/credits.ts`
- `apps/api/src/services/transaction.ts`, `audit.ts`, `audit-snapshot.ts`
- `apps/api/src/services/model-router.ts`, `ai-generation-types.ts` (context)
- `packages/shared/src/enums.ts`, `domain.ts`
- `scripts/sprint5/6/7-smoke-api.ps1` (sprint6 verified)
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/ai-credit-policy.ts` | **Created** — fixed credit costs |
| `apps/api/src/services/credit-ledger.ts` | **Created** — debit/refund + idempotency + audit |
| `apps/api/src/services/credit.ts` | `preflightCreditBalance` |
| `apps/api/src/lib/mappers.ts` | `CreditLedgerRow`, `mapCreditLedgerRow` |
| `apps/api/README.md` | § Credit ledger service |
| `README.md`, `docs/36` | Task 8.3 ✅ |
| `.agent-logs/sprint-8/task-8.2-model-router-openrouter-shell.md` | sprint6 count correction |
| `.agent-logs/sprint-8/task-8.3-credit-debit-refund-service.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:api:sprint6` | PASS — 68/68 |
| `npm run smoke:api:sprint7` | PASS — 53/53 |

## Results

- Credit cost policy + ledger service implemented internal-only.
- Idempotency via `attempt_id` + `reason` + `direction` query (no migration).
- `TransactionPlan` compensation on balance update failure.
- Audit `credit_debited` / `credit_refunded` with sanitized metadata.
- No public credit mutation or AI routes added.

## Decisions

1. **No migration** — idempotency via ledger query, not unique index on metadata.
2. **No balance auto-create** — missing row → `INSUFFICIENT_CREDIT` (402).
3. **Optimistic balance update** — `eq(balance, expected)` to detect concurrent change → 409.
4. **Refund requires prior debit** — `generation_debit` for same `attempt_id`.
5. **Compensation** — delete ledger row on balance update failure (internal service-role only).
6. **monthly_used unchanged** — schema has field; MVP debit does not increment (deferred).

## Limitations

- No true Postgres RPC — concurrent debits may race; document + defer to pre-production.
- No sprint8 credit smoke until Task 8.4 (no public route to exercise service).
- `grantCreditsInternal` not implemented — use seed/smoke service-role insert if needed.
- Refund amount not validated against debit amount (MVP trusts caller in 8.4).

## Next recommended task

**Task 8.4** — Prose Beat Generation API (`POST /ai/generate-prose`, orchestration + attempt rows).