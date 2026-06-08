# Task 7.8 — Pre-AI Hardening Plan (Audit, Transactions, CI)

**Date:** 2026-06-08  
**Sprint:** sprint-7 (bridge to hardening sprint)  
**Status:** completed

## Task goal

Membuat rencana hardening sebelum Sprint 8 AI/OpenRouter: audit logs, DB transaction strategy, smoke consolidation, CI E2E strategy, risk register. Plan only — no implementation.

## Files read

| Path | Purpose |
|---|---|
| `README.md` | Sprint 7 status, smoke commands |
| `docs/40-sprint-7-verification-report.md` | Closure + recommended hardening |
| `docs/38-sprint-6-verification-report.md` | Prior debt items |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | P1 debt register |
| `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` | Sprint 7 scope context |
| `apps/api/README.md` | Audit defer notes per route |
| `scripts/README.md` | Smoke index, CI note |
| `package.json` | smoke scripts |
| `.github/workflows/ci.yml` | CI scope |
| `.agent-logs/sprint-7/` | Tasks 7.0–7.6 handoff |
| `scripts/smoke-all-local.ps1` | Gap: no sprint6/7 |
| `apps/api/src/services/audit.ts` | Existing writer |
| `supabase/migrations/00001_sprint2_core.sql` | audit_action enum |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md` | **Created** — full hardening plan (10 sections) |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Link to docs/41; hardening task breakdown |
| `README.md` | Link docs/41; next task 7.8.1 |
| `.agent-logs/sprint-7/task-7.8-pre-ai-hardening-plan.md` | This log |

No application source code. No migration. No CI workflow changes.

## Commands run

| Command | Result |
|---|---|
| Build/typecheck | tidak dijalankan — docs-only task |

## Results

- `docs/41` created with audit gaps, transaction matrix, CI/smoke strategy, task 7.8.1–7.8.6 breakdown.
- Recommendation: implement hardening after plan approve; first task **7.8.1**.
- Sprint 8 gated on 7.8.2–7.8.4 + 7.8.6 minimum.

## Decisions

1. **Plan-only for 7.8** — no enum migration or transaction code in this task.
2. **P0 transactions:** foundation lock, delta extract, proposal accept.
3. **CI full E2E deferred** from PR gate — nightly/manual first (documented rationale).
4. **User preference B** — hardening before Sprint 8 AI.

## Limitations

- No bash smoke port designed in detail (referenced as P2).
- No migration SQL drafted (deferred to 7.8.1).
- `smoke:all:local` not updated yet (7.8.4).

## Next recommended task

**Task 7.8.1** — Audit Action Enum + Audit Coverage Plan (migration design + shared enum draft + service touch list).