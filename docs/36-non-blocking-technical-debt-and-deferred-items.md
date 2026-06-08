# 36 — Non-blocking Technical Debt & Deferred Items

**Status:** Living register (Task 5.8)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Related:** [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md), [`scripts/README.md`](../scripts/README.md)

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
| Outline lock: plan + chapters + workflow_phase not in single transaction | P1 | Before production deploy |
| Prose save: version flip + word count + session touch not atomic | P1 | During Sprint 6 if summary ties to prose state |
| Context packet build + log insert (single insert today; acceptable MVP) | P2 | Before high-concurrency production |

### Web E2E coverage

| Item | Priority | Timing |
|---|---|---|
| Sprint 3 API-mode E2E optional (`-IncludeApiMode`) | P2 | Before Sprint 6 full-browser regression |
| No Playwright coverage for `/summary`, `/publish` | P2 | Sprint 6+ |
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
| No `chapter_summaries` table | P0 | **Sprint 6** |
| SummaryPage still mock Sprint 1 | P0 | **Sprint 6** |
| `ready_for_summary` marker only — no canon promotion | P0 | **Sprint 6** |
| No Chapter Delta / canon proposal flow | P0 | **Sprint 6** |

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
| No `chapter_generation_attempts` table | P1 | Pre-OpenRouter task |
| No credit deduction on generation | P1 | Sprint 8 per roadmap |
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
| **Sprint 7** | Publish package / KBM export |
| **Before AI generation** | OpenRouter, validator, reveal gate compiler, audit logs + DB transactions |
| **Before production deploy** | DB transactions, CI smoke strategy, remote Supabase/Worker, secrets hygiene |

---

## E. Important Current Items (quick reference)

1. **`smoke:api`** remains Sprint 2 regression — use **`smoke:api:sprint5`** (Write Room) and **`smoke:api:sprint6`** (summary/delta/approval safety, Task 6.6).
2. **API-mode web E2E** not in GitHub Actions — local `npm run smoke:web:write -- -IncludeApiMode` and `npm run smoke:web:summary -- -IncludeApiMode`.
3. **No audit logs** for outline/write/summary operations (summary approve uses `project_updated` metadata).
4. **No DB transaction wrapper** for multi-step prose/outline/summary workflows.
5. **Publish package deferred Sprint 7** — SummaryPage API mode covers summary/delta/proposal review only.
6. **High-risk reveal `confirmHighRisk` UI** not in web — API requires manual confirm; accept disabled in UI.
7. **Prose leakage markers** may false-positive on rare fictional text containing `model`/`token`/`provider`.
8. **No prose delete endpoint**.
9. **Context Packet safety** — API/smoke only, not DB-enforced.
10. **Seed GoTrue login quirk** — smokes use ephemeral signup.

---

## Related documents

- [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md)
- [`scripts/README.md`](../scripts/README.md)
- [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md)