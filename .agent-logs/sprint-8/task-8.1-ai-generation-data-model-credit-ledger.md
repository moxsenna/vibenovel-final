# Task 8.1 — AI Generation Data Model + Credit Ledger

**Date:** 2026-06-08
**Sprint:** sprint-8
**Status:** completed

## Task goal

Create additive migration `00008` for `generation_attempts` and `credit_ledger`, mirror enums/types in `@vibenovel/shared`, extend audit enums, add AI env variable names to templates. No provider calls, no RPC debit/refund, no API routes, no UI.

## Files read

- `README.md`
- `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `docs/43-pre-ai-hardening-verification-report.md` (partial)
- `docs/36-non-blocking-technical-debt-and-deferred-items.md` (partial)
- `supabase/migrations/00001_sprint2_core.sql` (partial)
- `supabase/migrations/00004_sprint5_write_room.sql`
- `supabase/migrations/00007_audit_enum_extension.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts` (partial)
- `packages/shared/src/index.ts`
- `packages/shared/README.md`
- `apps/api/.dev.vars.example`
- `apps/api/src/env.ts`
- `apps/api/README.md` (partial)
- `scripts/smoke-all-local.ps1` (partial)
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `supabase/migrations/00008_sprint8_ai_generation_credit.sql` | **Created** — enums, tables, indexes, RLS, audit extend |
| `packages/shared/src/enums.ts` | `GENERATION_*`, `CREDIT_LEDGER_DIRECTIONS`, audit extend |
| `packages/shared/src/domain.ts` | `GenerationAttempt`, `CreditLedgerEntry` |
| `packages/shared/src/index.ts` | Barrel exports |
| `packages/shared/README.md` | Sprint 8 guardrails + status |
| `apps/api/.dev.vars.example` | AI env names (commented) |
| `apps/api/src/env.ts` | `AppBindings` optional AI fields (names only) |
| `supabase/README.md` | Migration `00008` section |
| `README.md` | Sprint 8.1 ✅, table count 30 |
| `.agent-logs/sprint-8/task-8.1-ai-generation-data-model-credit-ledger.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `supabase db reset` | PASS — `00008` applied, seed OK |
| `npm run typecheck` | PASS — shared, web, api |

## Results

- Migration `00008` created additive: 3 PG enums, 2 tables, indexes, RLS, `set_updated_at` on `generation_attempts` only.
- `supabase db reset` applied all migrations including `00008_sprint8_ai_generation_credit.sql`.
- `npm run typecheck` PASS across shared/web/api.
- `credit_ledger` append-only: no `updated_at`, no authenticated write policies.
- Audit enum extended per `docs/44` §12: 6 actions + 2 entity types.
- Shared types mirror schema; no RPC, no service mutation, no routes.
- No secrets committed.

## Decisions

1. **No RPC in 8.1** — debit/refund deferred to Task 8.3 per plan recommendation.
2. **generation_attempts SELECT** — `is_project_owner(project_id) OR user_id = auth.uid()` for initiator visibility.
3. **credit_ledger** — authenticated SELECT own rows only; mutations service_role only.
4. **Partial index** — `(project_id, user_id) WHERE status = 'running'` for stale-running cleanup later.
5. **AppBindings extended** — type names only in `env.ts`; no runtime AI logic yet.
6. **Full audit list** — user prompt truncated at `generation`; applied full set from `docs/44` §12.

## Limitations

- No `debitCredits` / `refundCredits` service (Task 8.3).
- No model router, OpenRouter client, AI endpoints (Task 8.2+).
- No seed rows for attempts/ledger.
- No smoke script changes (Task 8.6).
- `estimated_cost_usd` stored as numeric — TS type `number` (acceptable MVP).

## Next recommended task

**Task 8.2** — Model Router + OpenRouter Shell (disabled by default, mock provider).