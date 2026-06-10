# 61 — Roadmap & Sprint Number Reconciliation (Task 11.0b)

**Date:** 2026-06-09  
**Status:** Closed — docs-only  
**Related:** [`docs/63-updated-product-roadmap-after-sprint-11.md`](63-updated-product-roadmap-after-sprint-11.md) (updated product roadmap), [`docs/26-current-sprint-plan.md`](26-current-sprint-plan.md) (historical), [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md), [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md), [`.agent-logs/sprint-11/task-11.0b-roadmap-sprint-number-reconciliation.md`](../.agent-logs/sprint-11/task-11.0b-roadmap-sprint-number-reconciliation.md)

This document reconciles the **original product roadmap** (`docs/26`, `docs/17`) with **actual implementation sprint numbering** used in the repo since Sprint 2 backend work. It prevents agents from restarting Task 1.17 or “Sprint 2 Data Model” when execution has already moved to Sprint 5–11.

**No product code changed.** Payment blocked items remain blocked.

---

## 1. Executive Summary

| Document | Role today |
|---|---|
| [`docs/63-updated-product-roadmap-after-sprint-11.md`](63-updated-product-roadmap-after-sprint-11.md) | **Updated product roadmap** — vision + actual state + execution phases (Task 11.1c) |
| [`docs/26-current-sprint-plan.md`](26-current-sprint-plan.md) | **Historical product roadmap** — vision, problem framing, future features (Draft Import, Voice Learning, etc.) |
| [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md) | **Historical MVP→Full outline** — Sprint 1 task breakdown; superseded for execution tracking |
| **README.md** | **Primary execution status** — what is built, closed sprints, next tasks |
| **docs/36** | **Blocked / deferred register** |
| **docs/53, 49, 45, 35, …** | **Sprint closure reports** — authoritative per-sprint outcomes |
| **This doc (docs/61)** | **Numbering map** — old roadmap sprint N ↔ actual implementation sprint N |

**Key message:** There is no product contradiction. The old plan assumed a linear path from Stitch parity → data model → features. Implementation instead delivered **backend-first safety rails**, then **AI + credits**, then **payment/topup**, then **staging** — using **technical sprint numbers** (2–11) that **do not align 1:1** with the old roadmap’s Sprint 8–11 labels.

**Do not** use `docs/26` “Current Status” (Task 1.17 next, Sprint 2 next) as the execution tracker.

---

## 2. Why the mismatch happened

1. **Roadmap written before full backend** — `docs/26` (last updated 2026-06-08) still lists Sprint 1.1–1.16 complete and Task 1.17 / Sprint 2 as next, while the repo already has migrations through `00009`, Cloudflare API, and 14-phase local smoke.

2. **Two numbering schemes** — Original roadmap mixed **Sprint 1 sub-tasks** (1.1–1.17), **Sprint 1.5** (legacy audit), and **product sprints 2–12** (data model → draft import). Implementation adopted **sequential technical sprints** starting at Sprint 2 (data model API) without updating `docs/26` in lockstep.

3. **Safety-first split** — After Stitch parity, work prioritized **Context Packet / Write Room safety** (actual Sprint 5), **summary/delta/canon** (Sprint 6), **publish package** (Sprint 7) before broad “validator suite” or “creator mode.”

4. **Monetization emerged as its own arc** — Credit ledger + OpenRouter costs (Sprint 8–9) expanded into **Sprint 10 payment/topup** (Mayar + Duitku) because public callback and sandbox smoke became real blockers — not in the old Sprint 8 “Credit System only” scope.

5. **Staging re-used “Sprint 11”** — Old roadmap Sprint 11 = Voice Learning. Actual Sprint 11 = **staging deploy + public callback readiness** — same number, different meaning.

6. **Deferred features preserved** — Draft Import, full Voice DNA, Creator Mode editors, Analytics were **not removed** from product intent; they were **deferred** while core pipeline + monetization shipped.

---

## 3. Old roadmap vs actual implementation map

| Old roadmap item | Original meaning | Actual implementation status | Current disposition |
|---|---|---|---|
| Sprint 0 Blueprint | Docs, rules, repo | ✅ Completed | Absorbed — `docs/`, `.agents/rules/`, README |
| Sprint 1 Stitch frontend parity | UI mock parity with Stitch | ✅ Completed (Tasks 1.1–1.16 per README) | Closed — real API integration in Sprints 2–7 |
| Task 1.17 Visual polish | Dashboard/foundation/outline UI tweaks from manual review | ⚠️ **Uncertain / partial** — some readiness/outline UI evolved in Sprint 3–4 API integration; dedicated 1.17 checklist not verified as a single closure task | **Deferred** as explicit task; do not reopen Sprint 1 architecture |
| Sprint 1.5 Legacy audit | Audit old VibeNovel, migration map, problem matrix | ✅ Documentation exists — [`docs/23`](23-legacy-vibenovel-audit.md), [`docs/24`](24-feature-migration-map.md), [`docs/25`](25-problem-coverage-matrix.md) | Closed (docs); not a runtime feature |
| Sprint 2 Data model | Projects, canon tables, RLS foundation | ✅ Completed & expanded — Sprint 2 API + migrations `00001`–`00002`+, verification [`docs/29`](29-sprint-2-verification-report.md) | Closed — continued in later migrations |
| Sprint 3 Intake / foundation | Real intake → concepts → foundation flow | ✅ Implemented — [`docs/30`](30-sprint-3-story-foundation-flow-implementation-plan.md), [`docs/31`](31-sprint-3-verification-report.md) | Closed |
| Sprint 4 Planning / KBM outline | Outline engine, lock, approve | ✅ Implemented — [`docs/32`](32-sprint-4-outline-planning-engine-implementation-plan.md), [`docs/33`](33-sprint-4-verification-report.md) | Closed |
| Sprint 5 Safe beat writer | Beat-level writing MVP | ✅ Implemented as **Safe Write Room + Context Packet** (not prose AI in 5) — [`docs/34`](34-sprint-5-safe-write-room-context-packet-implementation-plan.md), [`docs/35`](35-sprint-5-verification-report.md) | Closed — prose AI deferred to Sprint 8 |
| Sprint 6 Validator / repair / chapter delta | Validation + delta extraction | ✅ **Partial alignment** — chapter summary, delta, proposals, canon promotion — [`docs/37`](37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md), Sprint 6 closure in verification chain; full automated validator/repair suite **not** complete | **Partial** — delta/canon path closed; validator suite deferred |
| Sprint 7 Publish package | KBM export package | ✅ Completed — [`docs/39`](39-sprint-7-publish-package-kbm-export-implementation-plan.md), [`docs/40`](40-sprint-7-verification-report.md) | Closed |
| Sprint 8 Credit system & cost control | Ledger, preflight, deduct/refund | ✅ **Expanded** — Sprint 8 = AI prose beat generation + credit debit/refund + OpenRouter — [`docs/44`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md), [`docs/45`](45-sprint-8-verification-report.md) | Closed (AI+credits); topup payment is Sprint 10 |
| Sprint 9 Creator mode | Story Bible / advanced editors | ❌ **Not done** as specified in `docs/26` | **Deferred** — actual Sprint 9 = Credit UI + rewrite + publish copy AI ([`docs/48`](48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md), [`docs/49`](49-sprint-9-verification-report.md)) |
| Sprint 10 Draft import | Paste/upload draft, extract facts | ❌ **Not done** | **Deferred** — actual Sprint 10 = Payment/topup Mayar/Duitku ([`docs/50`](50-sprint-10-production-readiness-mayar-monetization-plan.md), [`docs/53`](53-sprint-10-verification-report.md)) |
| Sprint 11 Voice learning | Style profile, voice cards, rewrite tools | ⚠️ **Partial** — prose rewrite + publish copy AI (Sprint 9); full Voice DNA / style profile learning **not** done | **Deferred** (voice) — actual Sprint 11 = Staging/public callback ([`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md), [`docs/62`](62-staging-deploy-mode-a-report.md)) |
| Sprint 12 Analytics / growth | Usage analytics, growth loops | ⚠️ **Partial** — `generation_attempts`, `estimated_cost_usd`, audit logs; no full analytics dashboard | **Deferred** |

---

## 4. Current actual implementation timeline

Execution sprints closed or in progress (technical numbering):

| Sprint | Focus | Closure / status doc |
|---|---|---|
| **2** | Data model API, auth, projects, foundation | [`docs/29`](29-sprint-2-verification-report.md) |
| **3** | Intake, concepts, foundation proposals, lock | [`docs/31`](31-sprint-3-verification-report.md) |
| **4** | Outline planning engine | [`docs/33`](33-sprint-4-verification-report.md) |
| **5** | Write Room, context packet, beats/prose persistence (no AI) | [`docs/35`](35-sprint-5-verification-report.md) |
| **6** | Chapter summary, delta, proposals, canon promotion | Sprint 6 verification (see [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)) |
| **7** | Publish package, checklist, export marker | [`docs/40`](40-sprint-7-verification-report.md) |
| **8** | AI prose beat generation, credit debit/refund, WritePage AI | [`docs/45`](45-sprint-8-verification-report.md) |
| **9** | Credit UI, prose rewrite, publish copy AI | [`docs/49`](49-sprint-9-verification-report.md) |
| **10** | Payment/topup Mayar + Duitku, webhook/callback grant, ops | [`docs/53`](53-sprint-10-verification-report.md); live provider **BLOCKED** ([`docs/59`](59-duitku-sandbox-live-smoke-report.md)) |
| **11** | Staging deploy, public callback readiness | [`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md), [`docs/62`](62-staging-deploy-mode-a-report.md) — Mode A **GO**; Supabase secrets pending |

Post–Sprint 10 payment tasks (same arc, not new sprint numbers): 10.8–10.13 Duitku/Mayar live smokes, fixture PASS, live BLOCKED.

---

## 5. Current source of truth

Use this order when onboarding an agent:

1. **README.md** — top-level “what’s done” and next recommended task  
2. **docs/63** — updated product roadmap (vision + gaps + execution phases)  
3. **docs/61** (this file) — old vs actual sprint mapping  
4. **docs/36** — blocked + deferred register  
5. **Sprint closure reports** — `docs/29`, `31`, `33`, `35`, `40`, `45`, `49`, `53`, …  
6. **Sprint 11 staging** — `docs/60`, `docs/62`  
7. **docs/26 + docs/17** — **historical product vision only** — not execution queue

---

## 6. Deferred features from original roadmap

Still valid product intent; **not** implemented as specified in `docs/26`:

- **Draft Import / Legacy Continuation** (old Sprint 10)
- **Full Voice Learning / Voice DNA / style profile** (old Sprint 11)
- **Creator Mode** — Story Bible editor, Locked Facts, Reveal Schedule, etc. (old Sprint 9)
- **Analytics / Growth layer** (old Sprint 12)
- **Cover / title / reader feedback** tooling (mentioned in roadmap threads)
- **Full validator + automated repair suite** (old Sprint 6 scope beyond summary/delta)
- **Task 1.17** dedicated visual polish pass (may overlap with later UI work — not tracked as closed)
- **Mobile-specific advanced polish** (if beyond current responsive Stitch parity)

---

## 7. Blocked payment / staging items (retained)

Do not clear these because of roadmap reconciliation:

| Item | Status |
|---|---|
| Duitku live sandbox | **BLOCKED** — credentials + public callback ([`docs/59`](59-duitku-sandbox-live-smoke-report.md)) |
| Mayar live sandbox | **BLOCKED** — no sandbox key + public webhook ([`docs/54`](54-mayar-staging-live-execution-report.md)) |
| Production payment | **NOT READY** ([`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md)) |
| Staging Mode A deploy | **GO** shell — [`docs/62`](62-staging-deploy-mode-a-report.md); hosted **Supabase secrets not set** |
| True DB RPC atomic grant | **Deferred** P1 |
| Refund/chargeback SOP | **Deferred** |
| Admin payment dashboard | **Deferred** |
| `GET /api/credits/topup/orders/:id` | **Deferred** |
| CI / automated staging smoke | **Deferred** — Task 11.2 |

---

## 8. Updated nearest priority order

Execution queue (replaces `docs/26` “Task 1.17 next”):

| Priority | Task | Notes |
|---|---|---|
| 1 | **11.2** | Staging smoke harness + hosted Supabase secrets + web rebuild |
| 2 | **10.13b** | Duitku sandbox live (Mode B) after public callback + credentials |
| 3 | **10.8b** | Mayar sandbox live (parallel path) |
| 4 | **10.14** | Payment provider decision report (when scheduled) |
| 5 | **Then** | Resume deferred **product** roadmap items — Draft Import, Voice Learning, Creator Mode, Analytics — only after payment/staging gates clear |

**Completed since old plan was written:** Task **11.1** Mode A staging deploy — see [`docs/62`](62-staging-deploy-mode-a-report.md).

---

## 9. Agent warning

```
⚠️  DO NOT use docs/26-current-sprint-plan.md "Current Status" to:
    - Restart Task 1.17 as the next coding task
    - Restart Sprint 2 Data Model
    - Assume Sprint 10 = Draft Import or Sprint 11 = Voice Learning

✅  DO use:
    - README.md for current execution status
    - docs/61 (this file) for sprint number mapping
    - docs/36 for blocked/deferred items
    - Sprint closure reports (docs/29–53, 62) for verified outcomes
```

---

## 10. Document maintenance

When closing a new implementation sprint:

1. Update **README.md** sprint table  
2. Add/update **closure report** in `docs/`  
3. Append **docs/36** if new deferred/blockers  
4. Optionally add a row to **§3** of this doc — do **not** rewrite `docs/26` execution status unless doing a deliberate product-roadmap refresh (keep historical banner).

---

*Authored Task 11.0b — 9 Juni 2026. Docs-only; no code changes.*