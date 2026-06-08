# Task 7.8.1 — Audit Action Enum + Audit Coverage Plan

**Date:** 2026-06-08  
**Sprint:** sprint-7 (pre-AI hardening)  
**Status:** completed

## Task goal

Desain final `audit_action` / `audit_entity_type` additions, coverage matrix P0/P1/P2, payload standard, correlation strategy, migration `00007` plan. Docs only — no audit writers, no service changes, no migration file.

## Files read

| Path | Purpose |
|---|---|
| `README.md` | Sprint 7.8 status |
| `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md` | Parent hardening plan |
| `docs/40-sprint-7-verification-report.md` | Smoke baseline |
| `docs/38-sprint-6-verification-report.md` | Summary/canon context |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Debt register |
| `supabase/migrations/00001_sprint2_core.sql` | Existing audit enums |
| `packages/shared/src/enums.ts` | No audit enums today |
| `apps/api/src/services/audit.ts` | Writer + local unions |
| `apps/api/src/services/foundation-lock.ts` | P0 lock audit today |
| `apps/api/src/services/outline-lock.ts` | No audit |
| `apps/api/src/services/prose-draft.ts` | No audit |
| `apps/api/src/services/chapter-delta.ts` | No audit |
| `apps/api/src/services/chapter-summary-approval.ts` | Generic project_updated |
| `apps/api/src/services/summary-proposal-review.ts` | ai_proposal_accepted/rejected |
| `apps/api/src/services/proposal-canon-promotion.ts` | No audit |
| `apps/api/src/services/publish-package.ts` | No audit |
| `apps/api/src/services/publish-package-update.ts` | No audit |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `docs/42-audit-action-enum-and-coverage-plan.md` | **Created** — full enum + coverage design |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | 7.8.1 ✅, link docs/42, docs/43 for 7.8.6 |
| `README.md` | Sprint 7.8.1 row, next task 7.8.2, docs/42 link |
| `.agent-logs/sprint-7/task-7.8.1-audit-action-enum-coverage-plan.md` | This log |

No application source. No migration. No `packages/shared` change.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only, shared untouched |
| `npm run typecheck:shared` | tidak dijalankan — shared untouched |

## Results

- 37 new `audit_action` values + 16 new `audit_entity_type` values finalized.
- `foundation_locked` documented as existing (enhance metadata in 7.8.2).
- Coverage matrix: 4 P0 workflows, remainder P1/P2.
- Migration `00007` draft skeleton in docs/42 §8 — not applied.
- Shared enum mirror deferred to 7.8.2 (recommended).
- Verification report renumbered to `docs/43` for task 7.8.6.

## Decisions

1. **User-specified action names** — `story_concepts_generated`, `planned_reveal_updated`, `canon_promotion_applied`, etc.
2. **`metadata.correlationId` sufficient for MVP** — no `batch_id` column.
3. **Dual-write legacy actions** — `ai_proposal_accepted` + `summary_proposal_accepted` during transition.
4. **docs/42 = enum plan** — hardening verification moves to docs/43.
5. **Fail closed** on audit insert for all canon/export paths (recommended).

## Limitations

- No migration SQL file committed.
- No `audit-snapshot.ts` helper yet (7.8.2).
- P2 intake writers may be timeboxed in 7.8.2.
- GIN index on `metadata.correlationId` deferred.

## Next recommended task

**Task 7.8.2** — Implement audit logs for canon-changing and export actions (migration `00007` + P0 writers).