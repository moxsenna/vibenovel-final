# 36 — Non-blocking Technical Debt & Deferred Items

**Status:** Living register (Task 5.8)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Related:** [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md), [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md), [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md), [`scripts/README.md`](../scripts/README.md)

Dokumen ini membedakan **blocker**, **non-blocking debt**, dan **deferred product scope**. Bukan sprint plan — gunakan sebagai checklist sebelum Sprint 6 dan sebelum AI/production deploy.

---

## A. Purpose

| Label | Meaning |
|---|---|
| **Blocker** | Must fix before closing a sprint or shipping a milestone |
| **Non-blocking debt** | Known gap; safe to defer with documented risk |
| **Deferred** | Intentionally out of scope for current sprint |

Sprint 5 closed with **zero blockers**. Items below are non-blocking unless marked P0.

---

## B. Current Non-blocking Items

### Audit logs

| Item | Priority | Timing |
|---|---|---|
| No `audit_logs` for outline approve/lock | P2 | Before production deploy |
| No `audit_logs` for write session / prose save | P2 | During Sprint 6 or before production |
| No `audit_action` enum extension for write-room events | P2 | With audit_logs table |

### Smoke / CI

| Item | Priority | Timing |
|---|---|---|
| `smoke:api` = Sprint 2 only (17 steps) — Sprint 5 separate (`smoke:api:sprint5`) | P1 | **Addressed Task 5.8** — aliases added; consolidation optional later |
| API-mode web E2E not in GitHub Actions | P1 | Before production or dedicated CI runner |
| `sprint4-smoke-api.ps1` not wired to npm script | P2 | Nice-to-have alias `smoke:api:sprint4` |
| `make-current` prose endpoint not in Sprint 5 smoke | P2 | Before Sprint 6 if version switching critical |
| Linux/macOS bash port of PowerShell smokes | P2 | Before CI smoke adoption |

### DB transaction wrappers

| Item | Priority | Timing |
|---|---|---|
| **P0 transaction-like hardening** (foundation lock, delta+link, accept+canon) | P1 | ✅ **7.8.3** — `transaction.ts` + compensation; not true RPC |
| True Postgres RPC/`BEGIN` for P0 workflows | P1 | Before production deploy |
| Outline lock: plan + chapters + workflow_phase not in single transaction | P1 | Before production deploy |
| Prose save: version flip + word count + session touch not atomic | P1 | During Sprint 6 if summary ties to prose state |
| Context packet build + log insert (single insert today; acceptable MVP) | P2 | Before high-concurrency production |

### Web E2E coverage

| Item | Priority | Timing |
|---|---|---|
| Sprint 3 API-mode E2E optional (`-IncludeApiMode`) | P2 | Before production CI |
| Playwright `/summary` + `/publish` mock + local API-mode | **Addressed Sprint 6–7** | `smoke:web:summary`, `smoke:web:publish` |
| API-mode web E2E not in GitHub Actions | P1 | Before production or dedicated CI runner |
| Mock/API mode require different `VITE_USE_MOCKS` + dev:web restart | P1 | Documented; manual discipline |

### UI deferred items

| Item | Priority | Timing |
|---|---|---|
| Write Room AI assistant CTAs disabled | P1 | Before AI/OpenRouter |
| Open loop / reveal CRUD UI display-only on outline | P2 | Post-MVP |
| Chapter selector Bab 2–10 read-only minimal | P2 | During Sprint 6+ |
| No prose delete endpoint / UI | P2 | Nice-to-have |

### Summary / canon deferred

| Item | Priority | Timing |
|---|---|---|
| No `chapter_summaries` table | P0 | **Addressed Sprint 6** |
| SummaryPage still mock Sprint 1 | P0 | **Addressed Sprint 6** |
| `ready_for_summary` marker only — no canon promotion | P0 | **Addressed Sprint 6** |
| No Chapter Delta / canon proposal flow | P0 | **Addressed Sprint 6** |

### Publish package deferred (Sprint 7 — now addressed)

| Item | Priority | Timing |
|---|---|---|
| No `publish_packages` table | P0 | **Addressed Sprint 7** (`00006`) |
| PublishPage still mock Sprint 1 | P0 | **Addressed Sprint 7** (`usePublishData`) |
| No publish package API | P0 | **Addressed Sprint 7** (generate/fields/checklist/mark-exported) |
| No publish safety smoke | P1 | **Addressed Sprint 7** (`smoke:api:sprint7`, `smoke:web:publish`) |

### Publish / KBM still deferred (non-blocking)

| Item | Priority | Timing |
|---|---|---|
| No auto-post KBM | P0 | By design — manual copy only |
| No UI regenerate publish package | P2 | Optional UX; API `regenerate=true` exists |
| No chapter picker on PublishPage | P2 | Default Bab 1 only |
| No export audit log event | P1 | Before production deploy |
| Checklist incomplete does not block mark-exported | P2 | Warning only (MVP) |
| Clipboard content not asserted in E2E | P2 | Copy button presence only |

### Write Room limitations

| Item | Priority | Timing |
|---|---|---|
| Draft prose is not canon | By design | Until Sprint 6 approval |
| `ai_generated` prose source reserved (400) | By design | Before AI generation |
| No beat-level AI generation | P1 | Before AI/OpenRouter |
| `regenerate=true` beats blocked when prose exists | P2 | Documented guard |

### Context Packet limitations

| Item | Priority | Timing |
|---|---|---|
| Safety enforced in API + smoke, **not** DB constraints on `packet_json` | P1 | Before production if paranoid hardening needed |
| Full Reveal Gate breadcrumb compiler deferred (MVP: `reader_facing_hint`) | P1 | Before AI writer |
| Character Knowledge Gate partial (canon facts only) | P1 | Before AI writer |
| Packet max 64 KB — truncation flag only | P2 | Scale testing later |

### Seed / Auth local quirks

| Item | Priority | Timing |
|---|---|---|
| Seed user `penulis@contoh.id` password login not used in smoke (GoTrue SQL seed quirk) | P2 | Local dev only |
| Ephemeral smoke users created each run (no cleanup) | P2 | Local dev only |

### Future AI / OpenRouter prerequisites

| Item | Priority | Timing |
|---|---|---|
| No OpenRouter / model router | P0 | Explicit task before AI prose |
| No `chapter_generation_attempts` table | P1 | **Addressed 8.1** — `generation_attempts` table; service logic Task 8.3+ |
| No credit deduction on generation | P1 | Sprint 8 — schema ✅ 8.1; debit/refund service Task 8.3 |
| No Instruction Compliance Validator production | P1 | Sprint 6+ |
| Possible false positives: `model`/`token`/`provider` substring in fictional prose | P2 | Refine markers before AI |

---

## C. Priority Labels

| Label | Definition |
|---|---|
| **P0** | Required before next major milestone (Sprint 6 canon, production, or AI) |
| **P1** | Should address before AI generation or production deploy |
| **P2** | Nice-to-have; acceptable for local MVP development |

---

## D. Suggested Timing

| Window | Focus |
|---|---|
| **Before Sprint 6** | Local smoke consolidation (Task 5.8 ✅), verification checklist, debt register |
| **During Sprint 6** | ✅ Summary/canon tables, SummaryPage API, Chapter Delta (closed — `docs/38`) |
| **Sprint 7** | ✅ Publish package / KBM export stub (closed — `docs/40`) |
| **Sprint 7.8 (plan ✅)** | [`docs/41`](41-pre-ai-hardening-audit-transactions-ci-plan.md) — audit/transaction/smoke/CI strategy; implement via 7.8.1–7.8.6 |
| **Before AI generation** | **P1 hardening implement:** 7.8.2–7.8.4 + 7.8.6 ✅ closed (`docs/43`) |
| **After hardening** | **Task 8.1+** implement AI per [`docs/44`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md) |
| **Before production deploy** | DB transactions, CI smoke strategy, remote Supabase/Worker, secrets hygiene |

---

## E. Important Current Items (quick reference)

1. **`smoke:api`** remains Sprint 2 regression — add **`smoke:api:sprint5`**, **`smoke:api:sprint6`**, **`smoke:api:sprint7`** for Write Room, summary, and publish safety.
2. **API-mode web E2E** not in GitHub Actions — local `-IncludeApiMode` for write/summary/publish smokes.
3. **Audit logs P0/P1** — foundation lock, delta, canon promotion, publish export/update, summary approve ✅ (**7.8.2**). Outline/write/intake P2 writers still pending.
4. **P0 transaction-like hardening** ✅ (**7.8.3**) — validate-all-before-write + compensation on foundation lock, delta+link, accept+canon. **True DB RPC** still **P1** before production; outline/prose/publish paths unchanged.
5. **Publish package API + UI + smoke complete Sprint 7** — no auto-post KBM; manual copy + `mark-exported` marker only (`docs/40`).
6. **No UI regenerate publish package** — API supports regenerate; chapter picker Bab 1 default only.
7. **High-risk reveal `confirmHighRisk` UI** not in web — API requires manual confirm; accept disabled in UI.
8. **Prose/publish leakage markers** may false-positive on rare fictional text containing `model`/`token`/`provider`.
9. **No prose delete endpoint**; export audit via `publish_package_exported` ✅ (7.8.2).
10. **Context Packet safety** — API/smoke only, not DB-enforced.
11. **CI** — typecheck/build only; full smokes local-only — strategy in `docs/41` §5; **7.8.4–7.8.5**.
12. **`smoke:all:local`** ✅ — includes Sprint 6/7 API + summary/publish web mock (**7.8.4**). **`smoke:all:local:full`** API-mode local/manual only (not CI).
13. **Seed GoTrue login quirk** — smokes use ephemeral signup.

---

## F. Pre-AI Hardening Task Register (from `docs/41`)

| Task | Scope | Status |
|---|---|---|
| **7.8** | Hardening plan document | ✅ Plan complete (`docs/41`) |
| **7.8.1** | Audit action enum + coverage map | ✅ Design complete (`docs/42`) |
| **7.8.2** | Audit writers for canon/export P0 paths | ✅ Implemented (`00007`, P0+P1 writers) |
| **7.8.3** | Transaction wrapper + P0 workflows | ✅ Implemented (`transaction.ts`, P0 hardening, sprint6 smoke assertions) |
| **7.8.4** | `smoke:all:local` include Sprint 6/7 | ✅ Consolidated (`smoke-all-local.ps1` 9 phases; `:full` passes `-IncludeApiMode` to web) |
| **7.8.5** | CI E2E feasibility / optional nightly | Pending |
| **7.8.6** | Hardening verification report (`docs/43`) | ✅ Closed |
| **8.0** | AI/OpenRouter & credit-gated generation plan | ✅ [`docs/44`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md) |
| **8.1** | `generation_attempts` + `credit_ledger` migration | ✅ `00008` + shared types |

**Sprint 8 gate:** Plan approved (`docs/44`). Production AI **not** until 8.4+ with env enabled + smokes PASS.

---

## Related documents

- [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md)
- [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md)
- [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)
- [`docs/42-audit-action-enum-and-coverage-plan.md`](42-audit-action-enum-and-coverage-plan.md)
- [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md)
- [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)
- [`scripts/README.md`](../scripts/README.md)
- [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md)