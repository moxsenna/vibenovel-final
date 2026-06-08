# Task 7.8.3 — Transaction Wrapper Strategy + P0 Workflows

## Task goal

Harden multi-step P0 workflows (foundation lock, delta extract + proposal link, proposal accept + canon promotion) with transaction-like atomicity before AI/OpenRouter. Prefer validate-all-before-write + compensation over full Postgres RPC.

## Files read

- `README.md`
- `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`
- `docs/42-audit-action-enum-and-coverage-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/src/services/foundation-lock.ts`
- `apps/api/src/services/chapter-delta.ts`
- `apps/api/src/services/summary-proposal-linker.ts`
- `apps/api/src/services/summary-proposal-review.ts`
- `apps/api/src/services/proposal-canon-promotion.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/services/audit-snapshot.ts`
- `scripts/sprint6-smoke-api.ps1`
- `scripts/sprint7-smoke-api.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/transaction.ts` | **Created** — `runWithCompensation`, `TransactionPlan`, `classifyTransactionFailure` |
| `apps/api/src/services/foundation-lock.ts` | Validate-all-before-write; phase-failure unlock compensation; `foundation_lock_failed` |
| `apps/api/src/services/chapter-delta.ts` | Preflight drafts; delete new delta on link failure |
| `apps/api/src/services/summary-proposal-linker.ts` | Preflight + batch compensation on partial link insert |
| `apps/api/src/services/summary-proposal-review.ts` | Preflight → promote → audit applied → accept; compensate on status failure |
| `apps/api/src/services/proposal-canon-promotion.ts` | `preflightPromotionToCanon`, `compensateCanonPromotion` |
| `scripts/sprint6-smoke-api.ps1` | Status assertions after failed accept; `canon_promotion_failed` audit; unsupported relationship accept |
| `apps/api/README.md` | Transaction strategy section (7.8.3) |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | 7.8.3 status + limitation updates |

## Commands run

- `npm run typecheck:api` — PASS
- `npm run typecheck` — PASS (shared + web + api)
- `npm run build:shared` — PASS
- `npm run build:web` — PASS
- `npm run build:api` — PASS (wrangler dry-run)
- `npm run smoke:api` — **17/17 PASS**
- `npm run smoke:api:sprint5` — **49/49 PASS**
- `npm run smoke:api:sprint6` — **68/68 PASS** (9 new transaction-hardening assertions)
- `npm run smoke:api:sprint7` — **53/53 PASS**

## Results

All verification PASS. Sprint 6 new assertions: accept-before-approve stays proposed, reveal-without-confirm stays proposed + `canon_promotion_failed` audit, reject-accepted status unchanged. `relationship accept unsupported` runs when stub emits `relationship_update` proposal (conditional).

## Decisions

1. **Option B (transaction-like hardening)** — True Supabase RPC deferred; Worker + PostgREST cannot `BEGIN/COMMIT` without stored procedures.
2. **Accept invariant** — Canon promotion before `accepted` status; compensation only for newly `created` entities on status-update failure.
3. **Foundation lock** — Full promotion rollback not attempted; unlock foundation on `workflow_phase` failure only.
4. **Delta extract** — Delete compensation for **new** delta rows only; regenerate update path limitation documented.

## Limitations

- No true DB transactions on P0 paths.
- Foundation lock mid-promotion partial canon possible.
- Delta regenerate may leave delta without proposals if linking fails after update.
- Character/reveal updates not compensatable on accept status failure.
- Outline lock, prose save, publish regenerate still without transaction wrapper.

## Verification re-run (session confirm)

- `npm run typecheck` / builds — PASS
- `smoke:api` — 17/17 PASS
- `smoke:api:sprint5` — 49/49 PASS
- `smoke:api:sprint6` — 68/68 PASS
- `smoke:api:sprint7` — 53/53 PASS

## Next recommended task

**7.8.4** — Consolidate `smoke:all:local` to include Sprint 6/7 API + summary/publish web smokes.