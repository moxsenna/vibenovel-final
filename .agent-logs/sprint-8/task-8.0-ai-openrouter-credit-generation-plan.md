# Task 8.0 — AI/OpenRouter & Credit-Gated Generation Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-8
**Status:** completed

## Task goal

Create Sprint 8 implementation plan (`docs/44`) for safe, credit-gated AI generation via OpenRouter/model router abstraction. Plan only — no migration, API, or provider calls.

## Files read

- `README.md`
- `docs/43-pre-ai-hardening-verification-report.md`
- `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`
- `docs/40-sprint-7-verification-report.md`
- `docs/38-sprint-6-verification-report.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `apps/api/src/services/context-packet-builder.ts`
- `apps/api/src/services/context-packet-safety.ts`
- `apps/api/src/services/write-session.ts` (referenced via routes/grep)
- `apps/api/src/services/chapter-beat.ts`
- `apps/api/src/services/prose-draft.ts`
- `apps/api/src/services/chapter-summary.ts`
- `apps/api/src/services/chapter-delta.ts` (referenced)
- `apps/api/src/services/publish-package-generator.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts` (partial)
- `supabase/migrations/` (00001–00007)
- `scripts/sprint5/6/7-smoke-api.ps1` (referenced)
- `apps/api/src/services/credit.ts`
- `apps/api/src/env.ts`
- `apps/api/src/routes/write.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md` | **Created** — 16-section Sprint 8 plan |
| `README.md` | Sprint 8 plan section + doc navigation |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 8.0 ✅; Sprint 8 register |
| `.agent-logs/sprint-8/task-8.0-ai-openrouter-credit-generation-plan.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build` | tidak dijalankan — docs-only task |

## Results

- `docs/44` created with all required sections (goal, scope, DB, credit, router, safety, flows, API, web, tests, audit, risks, tasks, acceptance, first coding task).
- Phased rollout: A prose beat → B rewrite → C publish optional → D/E deferred.
- MVP credit: fixed cost, debit before provider, refund on provider/safety failure.
- Model router: API-only, env-gated, quality tier mapping, allowlist.
- First coding task: **8.1** data model + credit ledger.

## Decisions

1. **Dedicated `/api/projects/:id/ai/*` routes** — centralize credit/audit/generation.
2. **Reuse `chapter_prose_versions`** — no separate `ai_generation_outputs` table for MVP.
3. **No `model_router_configs` table** — env + code allowlist for Sprint 8.
4. **Summary/delta AI deferred** — stub generators remain until validator stronger.
5. **`AI_GENERATION_ENABLED=false` default** — 503 when disabled.
6. **Refund on safety rejection** — MVP user-trust policy (documented in plan).
7. **Mock provider env** for local smoke without OpenRouter spend.

## Limitations

- No migration/API/UI code in Task 8.0.
- True Postgres RPC for credit atomicity recommended in 8.1 but not designed in SQL yet.
- Credit cost numbers are proposed defaults — tunable in implementation.
- Background queue out of scope.

## Next recommended task

**Task 8.1** — AI Generation Data Model + Credit Ledger (`00008` migration + shared types + audit enum extend).