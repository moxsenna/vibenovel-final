# 43 — Pre-AI Hardening Verification Report

**Sprint:** Sprint 7.8 — Pre-AI Hardening  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md), [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)

Dokumen ini adalah **laporan penutupan resmi** hardening pre-AI (Task 7.8–7.8.4 + verifikasi 7.8.6). Dibaca sebelum merencanakan Sprint 8 AI/OpenRouter. Bukan implementasi AI — hanya verifikasi audit, transaction-like guards, smoke orchestration, dan keputusan gate.

**Work logs:** `.agent-logs/sprint-7/task-7.8-pre-ai-hardening-plan.md` … `task-7.8.6-pre-ai-hardening-verification-report.md`

---

## 1. Hardening Summary

### Tujuan hardening pre-AI

Menutup risiko operasional sebelum integrasi OpenRouter / AI generation:

- **Audit trail** untuk aksi canon-changing dan export
- **Atomicity** pada workflow multi-tabel P0 (foundation lock, delta extract, proposal accept)
- **Smoke consolidation** agar regresi Sprint 2–7 dapat dijalankan satu perintah lokal
- **Kebijakan CI** terdokumentasi (typecheck/build di GHA; runtime smoke lokal)

### Scope task 7.8–7.8.4

| Task | Scope | Status |
|---|---|---|
| **7.8** | Rencana hardening (`docs/41`) | ✅ Closed |
| **7.8.1** | Audit enum + coverage plan (`docs/42`) | ✅ Closed |
| **7.8.2** | Migration `00007`, P0+P1 audit writers, smoke audit asserts | ✅ Closed |
| **7.8.3** | `transaction.ts`, P0 transaction-like hardening | ✅ Closed |
| **7.8.4** | `smoke:all:local` / `:full` consolidation (9 phases) | ✅ Closed |
| **7.8.5** | CI E2E / nightly workflow | ⏸ Deferred (non-blocking) |
| **7.8.6** | Laporan verifikasi ini (`docs/43`) | ✅ Closed |

### Status akhir

Pre-AI hardening **siap ditutup**. Sprint 1–7 artifact flow (idea → publish package) tetap utuh; tidak ada perubahan product behavior selain audit writes dan transaction-like guards pada path P0.

### Kenapa dilakukan sebelum Sprint 8 AI/OpenRouter

AI production memperbesar surface area: prompt logging, provider metadata, credit deduction, volume prose, dan forensik canon. Tanpa audit P0, compensation pada promotion, dan smoke suite lengkap, regresi leak/canon boundary sulit dideteksi sebelum dan sesudah AI diaktifkan.

---

## 2. Completed Hardening Items

### 7.8 — Pre-AI hardening plan

- Deliverable: [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)
- Audit gap matrix, transaction priority matrix, CI/smoke strategy, task breakdown 7.8.1–7.8.6
- Keputusan: hardening wajib sebelum OpenRouter; CI full E2E tidak dipaksa di PR gate

### 7.8.1 — Audit enum + coverage plan

- Deliverable: [`docs/42-audit-action-enum-and-coverage-plan.md`](42-audit-action-enum-and-coverage-plan.md)
- 37 `audit_action` baru + 16 `audit_entity_type` baru (desain)
- Coverage matrix P0/P1/P2, payload standard, `correlationId` batch strategy
- Migration `00007` strategy (implementasi di 7.8.2)

### 7.8.2 — Audit log implementation

- Migration: `supabase/migrations/00007_audit_enum_extension.sql`
- Shared mirror: `AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES` di `packages/shared/src/enums.ts`
- Helper: `apps/api/src/services/audit-snapshot.ts` (sanitizer + compact snapshots)
- Writer updates: `foundation-lock`, `chapter-delta`, `summary-proposal-linker`, `summary-proposal-review`, `proposal-canon-promotion`, `chapter-summary-approval`, `publish-package`, `publish-package-update`
- Smoke audit asserts: `sprint6-smoke-api.ps1` (+5 steps), `sprint7-smoke-api.ps1` (+3 steps)

### 7.8.3 — Transaction-like P0 hardening

- Helper: `apps/api/src/services/transaction.ts` (`runWithCompensation`, `TransactionPlan`, `classifyTransactionFailure`)
- Hardened services: `foundation-lock`, `chapter-delta`, `summary-proposal-linker`, `summary-proposal-review`, `proposal-canon-promotion`
- Sprint 6 smoke: status invariants setelah failed accept, `canon_promotion_failed` audit

### 7.8.4 — Smoke orchestration consolidation

- Orchestrator: `scripts/smoke-all-local.ps1` — 9 phases, collect-failures summary, elapsed time
- `smoke:all:local`: Sprint 2/5/6/7 API + Sprint 3–7 web mock
- `smoke:all:local:full`: same + `-IncludeApiMode` pada semua web wrappers (termasuk summary/publish)
- Docs: `scripts/README.md`, root `README.md`, `docs/36`

---

## 3. Audit Log Verification

### Infrastructure

| Item | Status |
|---|---|
| Migration `00007` | ✅ Applied locally (`supabase db reset`) |
| 37 `audit_action` baru | ✅ Enum extended per `docs/42` |
| 16 `audit_entity_type` baru | ✅ Enum extended per `docs/42` |
| `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES` shared mirror | ✅ `packages/shared/src/enums.ts` |
| `audit-snapshot` sanitizer | ✅ `apps/api/src/services/audit-snapshot.ts` |
| Audit insert failure → HTTP 500 | ✅ Fail closed on P0 paths |

### P0 coverage (implemented + smoke-verified)

| Workflow | Actions |
|---|---|
| Foundation lock lifecycle | `foundation_lock_started`, `foundation_locked`, `foundation_lock_failed` |
| Chapter delta extract | `chapter_delta_extracted` |
| Summary proposal link | `summary_proposal_linked` (+ legacy `ai_proposal_created` per proposal) |
| Summary proposal accept/reject | `summary_proposal_accepted`, `summary_proposal_rejected` |
| Canon promotion | `canon_promotion_applied`, `canon_promotion_failed` |
| Publish package export | `publish_package_exported` |

### P1 coverage (implemented)

| Workflow | Actions |
|---|---|
| Summary approve | `chapter_summary_approved` (replaces `project_updated` on approve path) |
| Publish package generated/regenerated | `publish_package_generated`, `publish_package_regenerated` |
| Publish fields/checklist update | `publish_package_updated`, `publish_checklist_updated` |

### P2 deferred (enum ready, writers not added)

- Intake / concept / foundation proposal generate full audit writers
- Outline generate/edit/approve/lock audit writers
- Write room: `writing_session_started`, `chapter_beats_generated`, `context_packet_built`, `chapter_ready_for_summary`
- `prose_version_created`, `prose_version_made_current`
- `chapter_summary_generated` (generate path — enum exists, writer not wired)

---

## 4. Transaction / Atomicity Verification

### True DB transaction

**Belum implemented.** Cloudflare Worker + PostgREST tidak mendukung `BEGIN/COMMIT` arbitrer tanpa Supabase RPC/stored procedures. Deferred ke pre-production deploy.

### Transaction-like strategy (implemented — Option B)

`apps/api/src/services/transaction.ts` — validate-all-before-write + compensation runner.

| Workflow | Hardening |
|---|---|
| Foundation lock | Preflight readiness → promote → lock row → `workflow_phase`; unlock foundation on phase failure; `foundation_lock_failed` on write failure |
| Delta extract + proposal link | Preflight drafts → insert delta → batch proposals/links; delete new delta if linking fails |
| Proposal accept + canon promotion | Preflight → promote canon → `canon_promotion_applied` → mark `accepted`; compensate newly created canon on status failure |

### Invariants (enforced + smoke-tested)

| Invariant | Verification |
|---|---|
| Proposal cannot become `accepted` if promotion fails | Sprint 6 smoke: reveal without `confirmHighRisk` stays `proposed`; `canon_promotion_failed` audit |
| Foundation `is_locked = true` only after intended writes succeed | Lock flow smoke + `foundation_lock_failed` on abort |
| Delta extract does not return success with partial links | Link batch compensation; new delta deleted on link failure |

### Remaining limitations

| Limitation | Risk | Mitigation path |
|---|---|---|
| Partial foundation promotion theoretical risk | Mid-promotion failure may leave some canon rows | True RPC before production |
| Delta regenerate not fully reverted | Update path may leave delta without proposals if link fails after update | Prefer delete compensation for new inserts only; RPC later |
| Character/reveal promotion not fully compensatable | Update (non-create) paths cannot roll back on status failure | Documented; manual recovery |
| Outline lock / prose save / publish regenerate | Not covered by 7.8.3 | P1 before production deploy |

---

## 5. Smoke / CI Verification

### API smokes (latest verified — Task 7.8.4, 8 Juni 2026)

| Suite | Steps | Result |
|---|---|---|
| `npm run smoke:api` | 17/17 | **PASS** |
| `npm run smoke:api:sprint5` | 49/49 | **PASS** |
| `npm run smoke:api:sprint6` | 68/68 | **PASS** |
| `npm run smoke:api:sprint7` | 53/53 | **PASS** |

### Local orchestrator (Task 7.8.4)

| Suite | Phases | Result |
|---|---|---|
| `npm run smoke:all:local` | 9/9 (API 1–4 + web mock 5–9) | **PASS** (~1.3m) |
| `npm run smoke:all:local:full` | 9/9 + API-mode web on all wrappers | **PASS** (~2.5m) |

**Full mode** includes API-mode web summary/publish (`-IncludeApiMode` passed to `sprint6-smoke-web.ps1`, `sprint7-smoke-web.ps1`, and sprint3/4/5 web wrappers).

### CI

| Scope | Status |
|---|---|
| GitHub Actions (`.github/workflows/ci.yml`) | **typecheck + build only** |
| Full Supabase/Playwright smoke | **Local/manual only** — not in GHA |
| Task 7.8.5 (CI E2E nightly) | **Deferred** — non-blocking per hardening closure |

---

## 6. Security / Leak Guard Verification

### Audit payload sanitizer (`audit-snapshot.ts`)

| Forbidden in audit payloads | Enforced |
|---|---|
| Token / service role / API key | ✅ |
| Raw prose / `content_text` | ✅ |
| `packet_json` | ✅ |
| `planningTruth` / `planning_truth` | ✅ |
| `full_prompt` | ✅ |
| Long publish copy (caption/teaser) | ✅ — length/metadata only |

### Regression smoke coverage (unchanged behavior, still PASS)

| Guard | Smoke suite |
|---|---|
| Context Packet preview-only; no `packet_json` in response/DOM | Sprint 5 API + web (`smoke:api:sprint5`, `smoke:web:write`) |
| Summary leak guards (no prose/packet/planning truth) | Sprint 6 API + web (`smoke:api:sprint6`, `smoke:web:summary`) |
| Publish leak guards + overclaim rejection | Sprint 7 API + web (`smoke:api:sprint7`, `smoke:web:publish`) |

### Known residual risks (non-blocking)

- Context Packet safety: API + smoke only — **not** DB constraint on `packet_json`
- Marker false positives: `model`/`token`/`provider` substring in fictional prose/publish copy
- AI prompt logging policy: **not defined** — required in Sprint 8 plan

---

## 7. Remaining Non-Blocking Debt

| Item | Priority | Notes |
|---|---|---|
| CI E2E not in GitHub Actions | P1 | Task 7.8.5 deferred; local smoke suite complete |
| Bash/Linux smoke port | P2 | Prerequisite for Linux CI |
| True DB transactions (RPC) | P1 | Before production deploy |
| P2 audit writers (intake/outline/write) | P2 | Enum ready |
| GIN index on `metadata.correlationId` | P2 | Query optimization deferred |
| `confirmHighRisk` UI | P2 | API requires manual confirm |
| Chapter picker / publish regenerate UI | P2 | API `regenerate=true` exists |
| OpenRouter / model router / credit deduction | P0 for AI | **Not started** — Sprint 8 scope |
| Production deploy / remote migrations | P0 for prod | Not done |
| Instruction Compliance Validator production | P1 | Before trusting AI writer output |

Updated register: [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)

---

## 8. Sprint 8 Gate Decision

| Question | Decision | Rationale |
|---|---|---|
| **Is Sprint 8 planning allowed?** | **YES** | Hardening 7.8.2–7.8.4 + 7.8.6 complete; smoke regression PASS; audit P0 + transaction-like P0 in place |
| **Is Sprint 8 production AI allowed?** | **NO** (not yet) | Model router, OpenRouter env boundary, credit deduction, `chapter_generation_attempts`, prompt leak policy, and AI smoke strategy must be planned and approved first |

**Interpretation:**

- Hardening **cukup untuk merencanakan** Sprint 8 AI/OpenRouter (Task 8.0 plan).
- Hardening **belum cukup** untuk deploy AI production tanpa Sprint 8 safety/credit/provider design.

**Sprint 8 gate checklist (minimum met):**

- ✅ 7.8.2 audit P0 paths
- ✅ 7.8.3 transaction P0 paths
- ✅ 7.8.4 `smoke:all:local` updated
- ✅ 7.8.6 verification report
- ⏸ 7.8.5 CI nightly — optional / deferred

---

## 9. Recommended Next Task

### Task 8.0 — AI/OpenRouter & Credit-Gated Generation Implementation Plan

**Bukan coding langsung.** Rencana Sprint 8 harus mencakup:

| Area | Plan requirement |
|---|---|
| Model router | Provider selection, fallback policy, env boundaries |
| OpenRouter | API key handling (never in repo/logs), request shape |
| Credit deduction | Ledger integration, idempotent charge per attempt |
| `chapter_generation_attempts` table | Schema, status, retry metadata |
| Prompt leak policy | No raw prompt in audit/logs/responses |
| Provider/model metadata | Safe fields only in audit + API responses |
| Cost estimation | Pre-flight credit check / estimate |
| Retry/failure handling | Bounded retries, failure audit, no partial canon |
| Canon safety | No `ai_direct` canon mutation; proposals-only path |
| Smoke tests | API + optional web E2E for generation stubs |

Deliverable: `docs/44-sprint-8-ai-openrouter-implementation-plan.md` (or equivalent per sprint numbering).

---

## 10. Verification Checklist

Commands from latest verification runs (8 Juni 2026):

| Command | Result | Session |
|---|---|---|
| `npm run typecheck` | **PASS** | 7.8.6 (this report) |
| `npm run build:shared` | **PASS** | 7.8.4 |
| `npm run build:web` | **PASS** | 7.8.4 |
| `npm run build:api` | **PASS** | 7.8.4 |
| `npm run smoke:api` | **PASS** 17/17 | 7.8.4 |
| `npm run smoke:api:sprint5` | **PASS** 49/49 | 7.8.4 |
| `npm run smoke:api:sprint6` | **PASS** 68/68 | 7.8.4 |
| `npm run smoke:api:sprint7` | **PASS** 53/53 | 7.8.4 |
| `npm run smoke:all:local` | **PASS** 9/9 | 7.8.4 |
| `npm run smoke:all:local:full` | **PASS** 9/9 | 7.8.4 |

**Prerequisites for smoke:** Docker + `supabase start`, `dev:api`, `dev:web`, Playwright chromium; full mode additionally `VITE_USE_MOCKS=false` + restart `dev:web`.

---

## 11. Closure Decision

| Question | Answer |
|---|---|
| **Pre-AI hardening ready to close?** | **YES** |
| **Blockers** | None for hardening closure |
| **Non-blocking limitations** | True DB RPC, CI E2E (7.8.5), P2 audit writers, AI/provider/credit (Sprint 8) |

**Closure statement:** Sprint 7.8 pre-AI hardening is **closed**. Proceed to **Task 8.0** (AI/OpenRouter plan only). Do **not** start Sprint 8 implementation or production AI until plan approved.

---

## Related documents

- [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)
- [`docs/42-audit-action-enum-and-coverage-plan.md`](42-audit-action-enum-and-coverage-plan.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md)
- [`scripts/README.md`](../scripts/README.md)
- [`apps/api/README.md`](../apps/api/README.md)