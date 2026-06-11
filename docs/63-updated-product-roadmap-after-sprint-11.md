# 63 — Updated Product Roadmap After Sprint 11 (Task 11.1c)

**Date:** 2026-06-09  
**Status:** Active — product + execution roadmap  
**Related:** [`docs/26-current-sprint-plan.md`](26-current-sprint-plan.md) (historical vision), [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md) (historical MVP outline), [`docs/61-roadmap-and-sprint-number-reconciliation.md`](61-roadmap-and-sprint-number-reconciliation.md) (sprint numbering map), [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md) (blocked/deferred register), [`.agent-logs/sprint-11/task-11.1c-updated-product-roadmap-document.md`](../.agent-logs/sprint-11/task-11.1c-updated-product-roadmap-document.md)

**No product code changed.** This document absorbs the original product vision and reconciles it with actual implementation through Sprint 11.

---

## 1. Executive Summary

This roadmap **merges the original product vision** from [`docs/26`](26-current-sprint-plan.md) and [`docs/17`](17-roadmap-sprint-plan-mvp-to-full.md) with the **actual implementation state after Sprint 11** (staging deploy Mode A).

| Role | Document |
|---|---|
| **This doc (docs/63)** | Updated **product roadmap + execution priority guide** |
| **README.md** | Live **execution status** — what is built, closed tasks, next task |
| **docs/61** | **Sprint numbering map** — old roadmap sprint N ↔ actual sprint N |
| **docs/36** | **Blocked / deferred register** — do not clear without evidence |
| **docs/26 + docs/17** | **Historical vision only** — not the execution queue |
| **Sprint closure reports** | **Authoritative evidence** — `docs/29`, `31`, `33`, `35`, `38`, `40`, `45`, `49`, `53`, `62`, … |

**This roadmap is not a substitute for sprint closure reports.** Closure docs remain the proof of what was verified. This doc summarizes vision, gaps, and **recommended forward order**.

**The old roadmap remains valid as vision source** — Draft Import, Voice DNA, Creator Mode, Analytics are still product intent — but **must not be used as the execution queue**. Agents must not restart Task 1.17 or Sprint 2 Data Model because `docs/26` still lists them as "next."

**Next recommended task:** **10.31b** real story foundation generation or outline planning engine integration. **10.31a-hotfix closed GO** (attempt creation schema fix: [`docs/95`](docs/95-hotfix-generation-attempt-intake-assistant.md)); **10.31a closed GO** (real intake & concept generation pipeline: [`docs/94`](docs/94-real-intake-assistant-concept-generator-report.md)); **10.30a closed GO** (Phase 0 mock removal: [`docs/93`](docs/93-remove-initial-mock-hook-states-credit-route-report.md)); **10.30 closed GO** (structural repo audit: [`docs/92`](docs/92-structural-repo-audit-mock-real-boundary.md)). Payment gated ([`docs/73`](73-duitku-production-payment-enable-plan.md) / [`docs/77`](77-production-payment-preflight-migration-approval-gate.md)).

---

## 2. Brand & naming

| Item | Value |
|---|---|
| **Product brand (user-facing)** | **Narraza** |
| **Tagline** | Build long fiction without losing the plot. |
| **Historical names** | **VibeNovel** / **Novory** — legacy repo, code paths, and docs only; not product-facing |
| **Staging domain (temporary)** | `narraza.web.id` — MVP/staging; **not** final production brand domain |
| **Future production domain** | `narraza.id` — after product traction |

Repo folder `vibenovel-unified-blueprint` and internal package names (`@vibenovel/*`) remain unchanged until a dedicated rename sprint.

---

## 3. North Star Product

**Narraza** is an **AI Serial Fiction Production OS** for Indonesian serial writers — especially writers targeting **KBM-style mobile fiction**.

> Historical docs may still say "VibeNovel" — treat as the same product vision under the old working name.

It is **not** a generic AI chatbot or one-click novel generator. It is a production system where AI assists under strict story-state governance.

### Core architecture principles

```txt
AI is not the source of truth.
Canonical Story State is the source of truth.

Planner may know the future.
Writer must only know the safe present.

Future outline must not enter the writer prompt raw.
Context Packet Builder is the only gateway into AI writing.

AI-generated important facts must be proposals first.
User approval is required before canon changes.

Default UX must be beginner-friendly.
Advanced control is opt-in.

Return payment URL does not grant credits.
Payment grant happens only from server callback/webhook.
```

### User-facing constraints

- No BYOK as default.
- User-facing model choice: **Hemat / Seimbang / Terbaik** only.
- Raw provider/model IDs must not be shown to normal users.

---

## 4. Current Actual State After Sprint 11

What is **verified built** (local + fixture; staging shell deployed):

| Area | Status | Evidence |
|---|---|---|
| Monorepo, docs, agent rules | ✅ Done | README, `docs/`, `.agents/rules/` |
| Stitch frontend parity | ✅ Done | [`docs/22`](22-sprint-1-verification-report.md) |
| Backend API (Hono/Worker) | ✅ Done | Sprints 2–10 API |
| Auth, projects, foundation | ✅ Done | [`docs/29`](29-sprint-2-verification-report.md) |
| Intake / concept / foundation flow | ✅ Done | [`docs/31`](31-sprint-3-verification-report.md) |
| Outline / planning engine | ✅ Done | [`docs/33`](33-sprint-4-verification-report.md) |
| Write Room + context packet | ✅ Done | [`docs/35`](35-sprint-5-verification-report.md) |
| Chapter summary / delta / proposal / canon promotion | ✅ Done | [`docs/38`](38-sprint-6-verification-report.md) |
| Publish package (KBM export stub) | ✅ Done | [`docs/40`](40-sprint-7-verification-report.md) |
| AI prose beat generation | ✅ Done | [`docs/45`](45-sprint-8-verification-report.md) |
| Credit debit / refund | ✅ Done | [`docs/45`](45-sprint-8-verification-report.md) |
| Credit UI (saldo, biaya) | ✅ Done | [`docs/49`](49-sprint-9-verification-report.md) |
| Prose rewrite AI | ✅ Done | [`docs/49`](49-sprint-9-verification-report.md) |
| Publish copy AI (suggestion-first) | ✅ Done | [`docs/49`](49-sprint-9-verification-report.md) |
| Payment / topup Mayar + Duitku fixture flow | ✅ Done | [`docs/53`](53-sprint-10-verification-report.md) |
| Duitku callback idempotent grant (fixture) | ✅ Done | [`docs/58`](58-duitku-callback-idempotent-grant-report.md) |
| Credit topup UI | ✅ Done | [`docs/53`](53-sprint-10-verification-report.md) |
| Staging Mode A API + web shell | ✅ Done | [`docs/62`](62-staging-deploy-mode-a-report.md) |

### Explicitly NOT claimed as done

| Area | Why |
|---|---|
| Full production payment | Staging BCA VA **GO**; enable **plan** in [`docs/73`](73-duitku-production-payment-enable-plan.md); production **NOT ENABLED** until founder Go |
| Full voice learning / Voice DNA | Only rewrite tools exist; no style profile learning |
| Full validator suite | Summary/delta/safety exist; automated validators + repair agent incomplete |
| Draft import | Not started |
| Creator Mode | Not started (editors for Story Bible, Reveal Schedule, etc.) |
| Analytics dashboard / growth layer | Only audit/usage/cost observability primitives |

### Staging condition (post Task 11.6 — 2026-06-09)

| Surface | URL | Status |
|---|---|---|
| **API (primary)** | `https://api-staging.narraza.web.id` | **GO FULL** — AWS EC2 HTTPS, Mode A safe |
| **Web** | `https://vibenovel-web-staging.pages.dev` | **GO** — points to **AWS API** (`VITE_API_URL`) |
| **API fallback** | `https://vibenovel-api-staging.moxsenna.workers.dev` | **GO** — CF Worker regression baseline |
| **Supabase** | Hosted `jdxyhrnibmmwlbtbokqo` | **GO** — full staging smoke PASS (11.2b) |
| **Payment sandbox (Mode B)** | Duitku BCA VA real callback | **GO** — 10.13b/10.13c ([`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md), [`docs/71`](71-duitku-real-callback-signature-debug-report.md)); **rolled back Mode A** safe |

**Domain note:** `narraza.web.id` is temporary staging/MVP. Production target: `narraza.id`.

---

## 5. Original Roadmap Feature Coverage Matrix

Status legend: **Done** = closure report verified · **Partial** = subset shipped · **Deferred** = intentional backlog · **Blocked** = external/ops dependency · **Not started** = no implementation

| Original roadmap item | Original intent | Current status | Evidence docs | Gap | Recommended phase |
|---|---|---|---|---|---|
| **A. Sprint 0 — Blueprint** | Docs, rules, repo direction, agent guardrails | **Done** | README, `docs/`, `.agents/rules/` | None for Sprint 0 scope | — (closed) |
| **B. Sprint 1 — Stitch Frontend Parity** | Full UI mock parity with Stitch references (Tasks 1.1–1.16) | **Done** | [`docs/22`](22-sprint-1-verification-report.md), [`docs/21`](21-stitch-frontend-parity-plan.md) | Real API integration done in Sprints 2–7 | — (closed) |
| **C. Task 1.17 — Visual Polish After Manual Review** | Dashboard/foundation/outline UI tweaks from founder screenshots | **Deferred / Unverified** | No dedicated 1.17 closure doc; partial overlap in Sprint 3–4 UI | Dedicated checklist not verified as closed task | **Phase C** |
| **D. Sprint 1.5 — Legacy Audit + Problem Coverage Matrix** | Audit legacy VibeNovel; migration map; problem matrix (docs only) | **Done** | [`docs/23`](23-legacy-vibenovel-audit.md), [`docs/24`](24-feature-migration-map.md), [`docs/25`](25-problem-coverage-matrix.md) | Runtime features not in scope | — (closed) |
| **E. Sprint 2 — Data Model & Project Foundation** | Projects, canon tables, RLS, auth, API scaffold | **Done** | [`docs/29`](29-sprint-2-verification-report.md), [`docs/27`](27-sprint-2-data-model-implementation-plan.md) | Continued in later migrations | — (closed) |
| **F. Sprint 3 — Intake, Concept, Foundation Real Flow** | Real intake → concepts → foundation proposals → lock | **Done** | [`docs/31`](31-sprint-3-verification-report.md), [`docs/30`](30-sprint-3-story-foundation-flow-implementation-plan.md) | Foundation/concept AI production deferred | — (closed) |
| **G. Sprint 4 — Planning Engine + KBM Outline** | Outline generate/edit/approve/lock; KBM structure | **Done** | [`docs/33`](33-sprint-4-verification-report.md), [`docs/32`](32-sprint-4-outline-planning-engine-implementation-plan.md) | Open loop/reveal CRUD UI display-only | — (closed) |
| **H. Sprint 5 — Safe Beat Writer MVP** | Beat-level writing; context packet safety; no premature future leak | **Done** (as Safe Write Room + Context Packet) | [`docs/35`](35-sprint-5-verification-report.md), [`docs/34`](34-sprint-5-safe-write-room-context-packet-implementation-plan.md) | Prose AI deferred to Sprint 8 (now done) | — (closed) |
| **I. Sprint 6 — Validator, Repair, Chapter Delta** | Full validator suite + safe repair + chapter delta + approval | **Partial** | [`docs/38`](38-sprint-6-verification-report.md), [`docs/37`](37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md) | Instruction/Spoiler/Knowledge/Mobile/Retention validators + Safe Repair Agent **not** production-complete | **Phase D** |
| **I.1 Instruction Compliance Validator** | Beat goal, must-include, word target compliance | **Not started** | — | No production validator | **Phase D** |
| **I.2 Spoiler / Reveal Validator** | Forbidden reveal, secret leak, breadcrumb explicitness | **Partial** | Context packet safety, high-risk confirm API | No automated spoiler validator on prose output | **Phase D** |
| **I.3 Character Knowledge Validator** | POV knowledge, illegal dialogue, antagonist reaction | **Partial** | Canon facts in context packet (partial gate) | No automated character-knowledge validator | **Phase D** |
| **I.4 Mobile Readability Validator** | Short paragraphs, hooks, dialogue balance | **Not started** | — | No automated mobile readability check | **Phase D** |
| **I.5 Retention Validator** | Mini victory, filler risk, protagonist agency | **Not started** | — | No retention validator | **Phase D** |
| **I.6 Safe Repair Agent** | Canon-safe prose repair without plot change | **Partial** | Prose rewrite AI (Sprint 9) — different scope | Rewrite ≠ validator-triggered safe repair | **Phase D** |
| **I.7–8 Chapter Delta + Approval** | Delta extraction + user-approved canon update | **Done** | [`docs/38`](38-sprint-6-verification-report.md) | Summary/delta AI generation deferred | — (closed) |
| **J. Sprint 7 — Publish Package Production** | KBM publish fields from accepted chapter; store/copy/regenerate | **Done** | [`docs/40`](40-sprint-7-verification-report.md), [`docs/39`](39-sprint-7-publish-package-kbm-export-implementation-plan.md) | No auto-post KBM; Bab 1 default; regenerate UI optional | — (closed) |
| **K. Sprint 8 — Credit System & Cost Control** | Ledger, preflight, deduct/refund, auditable usage | **Done** (expanded: + AI prose generation) | [`docs/45`](45-sprint-8-verification-report.md), [`docs/44`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md) | Topup payment is Sprint 10; true RPC atomicity deferred | — (closed) |
| **L. Sprint 9 — Creator Mode & Advanced Story Control** | Story Bible, Locked Facts, Reveal Schedule, Open Loop editors | **Deferred / Not started** | — | Actual Sprint 9 = rewrite + credit UI + publish copy AI ([`docs/49`](49-sprint-9-verification-report.md)) | **Phase G** |
| **L.1 Story Bible editor** | Deep story structure editing | **Not started** | — | — | **Phase G** |
| **L.2 Locked Facts editor** | Manual locked-fact CRUD | **Not started** | — | Basic data views exist; not Creator Mode editors | **Phase G** |
| **L.3 Character Knowledge editor** | Per-character knowledge map editing | **Not started** | — | — | **Phase G** |
| **L.4 Reveal Schedule editor** | Reveal timing control | **Not started** | — | Outline display-only for reveals | **Phase G** |
| **L.5 Open Loop / Reader Promise editors** | Loop and promise tracking | **Not started** | — | Display-only on outline | **Phase G** |
| **M. Sprint 10 — Draft Import & Legacy Continuation** | Paste/upload draft; extract facts; conflict detection; continuation | **Deferred / Not started** | — | Actual Sprint 10 = payment/topup ([`docs/53`](53-sprint-10-verification-report.md)) | **Phase E** |
| **N. Sprint 11 — Voice Learning & Rewrite Tools** | Style profile, voice cards, canon-safe rewrite, voice drift | **Partial** | [`docs/49`](49-sprint-9-verification-report.md) (rewrite only) | No Voice DNA, style profile learning, drift detector; actual Sprint 11 = staging ([`docs/62`](62-staging-deploy-mode-a-report.md)) | **Phase F** |
| **O. Sprint 12 — Analytics & Growth Layer** | Funnel events, quality metrics, growth loops, series dashboard | **Partial** | `generation_attempts`, `estimated_cost_usd`, audit logs | No analytics dashboard, funnel, or growth tooling | **Phase H** |
| **P. MVP Acceptance Benchmark** | 20–30 ch KBM serial; reveal ~ch 20–25; safety + mobile + publish | **Partial** | Pipeline pieces exist (Sprints 5–7, 8–9 AI) | End-to-end 2030-chapter proof **not run**; validators incomplete | **Phase D** then ongoing |

---

## 6. Updated Roadmap Phases

### Phase A — Staging & Payment Proof

| Task | Scope | Status |
|---|---|---|
| **11.1** | Staging deploy Mode A (API + Pages shell) | ✅ [`docs/62`](62-staging-deploy-mode-a-report.md) |
| **11.2** | Hosted Supabase staging + staging smoke harness | ✅ **PARTIAL GO** — [`docs/64`](64-staging-smoke-harness-and-supabase-report.md); harness ready; Supabase operator gate pending |
| **11.3** | AWS staging readiness + EC2 separate instance plan | ✅ [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md) — plan only; no deploy |
| **11.2b** | Operator: Supabase secrets + web rebuild + full `smoke:staging` | ✅ **GO FULL** — hosted Supabase + fixed test user |
| **11.4** | AWS API staging adapter + Docker deploy prep | ✅ [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md) |
| **11.5** | AWS EC2 provision + deploy API staging | ✅ **PARTIAL GO** — [`docs/68`](68-aws-ec2-api-staging-deploy-report.md); HTTP `13.212.245.32`; smoke PASS |
| **11.6** | AWS HTTPS domain + web-to-AWS API | ✅ **COMPLETE / GO FULL** — [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md) |
| **10.13b** | Duitku Mode B AWS live sandbox | ✅ **GO** — [`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md) |
| **10.13c** | Duitku real callback HMAC fix + BCA VA | ✅ **GO** — [`docs/71`](71-duitku-real-callback-signature-debug-report.md) |
| **10.14** | Payment provider decision report | ✅ **GO** — [`docs/72`](72-payment-provider-decision-report.md): **Duitku MVP**; Mayar backlog |
| **10.8b** | Mayar sandbox live retry | **Backlog** — secondary provider |

### Phase B — Production Payment Readiness

| Item | Notes |
|---|---|
| **MVP provider (10.14)** | **Duitku POP, BCA VA-first** — [`docs/72`](72-payment-provider-decision-report.md) |
| **Production enable plan (10.15)** | ✅ **GO** (plan only) — [`docs/73`](73-duitku-production-payment-enable-plan.md); execution **gated** |
| Mayar | Secondary/backlog until live sandbox callback proof |
| Atomic grant DB RPC (10.16) | ✅ **GO** — [`docs/74`](74-atomic-grant-db-rpc-report.md) |
| Hosted staging migration 00010 (10.17) | ✅ **GO** — [`docs/75`](75-apply-migration-00010-hosted-staging-report.md) |
| Staging API RPC grant E2E (10.18) | ✅ **GO** — [`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md) |
| Production migration 00010 preflight (10.19) | ⛔ **BLOCKED** — [`docs/77`](77-production-payment-preflight-migration-approval-gate.md) — prod Supabase not linked; approval pending |
| Production environment foundation plan (10.20) | ✅ **GO** — [`docs/78`](78-production-environment-foundation-plan.md) — topology + checklists; execution gated |
| Production Supabase baseline (10.21) | ✅ **GO** — [`docs/79`](79-production-supabase-baseline-setup-report.md) — `00001`–`00009` on prod; `00010` excluded |
| Production API/web/DNS Mode A plan (10.22) | ✅ **GO** — [`docs/80`](80-production-api-web-dns-mode-a-preflight-report.md) |
| Production API/web Mode A deploy (10.23) | ✅ **GO** — [`docs/81`](81-production-api-web-mode-a-deploy-report.md) — superseded by 10.23b/10.23c |
| Production infra unblock (10.23a) | ✅ **GO** — [`docs/82`](82-production-infra-unblock-report.md) — domain split; completed 10.23b/10.23c |
| Production EC2/API deploy (10.23b) | ✅ **GO** — [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md) — HTTPS API Mode A live |
| Production app custom domain verify (10.23c) | ✅ **GO** — [`docs/84`](84-production-app-custom-domain-verify-report.md) — `app.narraza.web.id` live; Mode A path closed |
| Production homepage (10.24) | ✅ **GO** — [`docs/85`](85-production-homepage-placeholder-report.md) — `narraza.web.id` live |
| Private beta readiness audit (10.25) | ✅ **GO** — [`docs/86`](86-private-beta-launch-readiness-audit.md) — payment-off beta; `/login` deployed |
| Refund/chargeback SOP | Draft in docs/73 §10 — pending founder final approval |
| Admin payment inspect | Manual reconciliation SOP in docs/73 §9; dashboard deferred |
| Production enable execution | Founder-led per docs/73 §7 — **NOT STARTED** |

### Phase C — Product Roadmap Gap Closure

| Item | Notes |
|---|---|
| Task 1.17 visual polish revisit | Founder screenshot review |
| Mobile polish revisit | Beyond Stitch responsive parity |
| UX review from founder screenshots | Dashboard, foundation, outline gaps |

### Phase D — Full Validator + Safe Repair Suite

| Validator / tool | From original Sprint 6 |
|---|---|
| Instruction Compliance Validator | Beat goal, must-include, word target |
| Spoiler / Reveal Validator | Forbidden reveal, breadcrumb explicitness |
| Character Knowledge Validator | POV knowledge safety |
| Mobile Readability Validator | Paragraph length, hooks |
| Retention Validator | Mini victory, filler, agency |
| Safe Repair Agent | Validator-triggered canon-safe repair |

### Phase E — Draft Import / Legacy Continuation

| Capability | Notes |
|---|---|
| Paste/upload draft | User-provided manuscript |
| Draft analyzer | Extract characters, facts, timeline, style |
| Extracted facts as proposals | No auto-canon |
| Conflict detection | vs existing canon |
| Continuation options | Next outline generation |

### Phase F — Voice Learning / Voice DNA

| Capability | Notes |
|---|---|
| Accepted prose style profile | Learn from approved prose |
| Author voice profile | Persistent style fingerprint |
| Character voice cards | Per-character speech patterns |
| Voice-aware rewrite | Beyond generic rewrite modes |
| Voice drift detector | Alert when AI normalizes voice |

### Phase G — Creator Mode Advanced Control

| Editor | Notes |
|---|---|
| Story Bible editor | Deep structure |
| Locked Facts editor | Manual CRUD + audit |
| Character Knowledge editor | Per-character map |
| Reveal Schedule editor | Timing control |
| Open Loop editor | Loop lifecycle |
| Reader Promise tracker | Promise fulfillment |
| Manual override with warning/audit | Advanced opt-in |

### Phase H — Analytics / Growth Layer

| Capability | Notes |
|---|---|
| User funnel events | project_created → publish |
| Quality metrics | Validation pass/fail rates |
| Validation metrics | Per-validator stats |
| Credit/cost metrics | Usage and spend |
| Publish performance helpers | Teaser/caption effectiveness |
| Cover/title/caption/reader feedback loop | Optional later |

---

## 7. Execution Order

### Immediate (payment/staging gates)

| # | Task | Rationale |
|---|---|---|
| 1 | **Task 11.6** — AWS HTTPS + web-to-AWS | ✅ **COMPLETE / GO FULL** — [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md) |
| 1e | **Task 11.5** — EC2 + Docker deploy | ✅ PARTIAL → superseded by 11.6 HTTPS |
| 1d | **Task 11.4** — AWS API adapter + Docker prep | ✅ [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md) |
| 1b | **Task 11.2b** — Operator Supabase gate | ✅ **GO FULL** |
| 1a | **Task 11.2** — Portable smoke harness | ✅ GO — [`docs/64`](64-staging-smoke-harness-and-supabase-report.md) |
| 1c | **Task 11.3** — AWS readiness plan | ✅ [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md) |
| 2 | **Task 10.13b/10.13c** — Duitku sandbox live + HMAC fix | ✅ **GO** — BCA VA real callback verified |
| 3 | **Task 10.14** — Payment provider decision report | ✅ **GO** |
| 4 | **Task 10.15** — Production payment enable plan | ✅ **GO** (plan only) — [`docs/73`](73-duitku-production-payment-enable-plan.md) |
| 5 | **Task 10.16** — Atomic grant DB RPC | ✅ **GO** — [`docs/74`](74-atomic-grant-db-rpc-report.md) |
| 6 | Apply `00010` on hosted staging | ✅ **GO** — Task 10.17 |
| 7 | Apply `00010` on production Supabase | **BLOCKED** — Task 10.19 preflight; prod project not identified; approval not received ([`docs/77`](77-production-payment-preflight-migration-approval-gate.md)) |
| 8 | Production enable execution (docs/73 §7) | Founder approval required |
| 7 | Refund/chargeback SOP finalization | Draft exists; founder sign-off |

### Parallel / conditional

| Task | Condition |
|---|---|
| **Task 10.8b** — Mayar sandbox retry | Backlog — secondary provider if Mayar account active |
| ShopeePay/SP retest post-HMAC | Optional — not required for BCA VA-first MVP |

### After payment/staging stable

| # | Item | Phase |
|---|---|---|
| 7 | Task 1.17 / UX product polish revisit | C |
| 8 | Full Validator + Safe Repair Suite | D |
| 9 | Draft Import / Legacy Continuation | E |
| 10 | Voice Learning / Voice DNA | F |
| 11 | Creator Mode | G |
| 12 | Analytics / Growth Layer | H |

---

## 8. Do Not Do Yet

```txt
Do not start Draft Import before staging/payment stable
  unless founder explicitly reprioritizes.

Do not start Voice DNA before validator/repair is stronger.

Do not enable production payment before live provider proof + atomic grant.

Do not enable production payment/provider dashboards yet.

Do not treat narraza.web.id as final production domain — narraza.id later.

Do not let AI mutate canon directly — proposals + user approval only.

Do not expose raw provider/model names to normal users.

Do not let return URL grant payment — callback/webhook only.

Do not use docs/26 as execution queue — use README + docs/61 + docs/63.

Do not restart Task 1.17 or Sprint 2 Data Model as if unbuilt.

Do not claim production payment, full Voice DNA, Draft Import,
Creator Mode, or analytics dashboard as done without closure evidence.
```

---

## 9. Blocked / Deferred Register Snapshot

Compact snapshot as of Sprint 11 close. Full register: [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md).

### Blocked

| Item | Blocker |
|---|---|
| Roadmap reconciliation | ✅ **Done** (Task 11.0b — [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md)) |
| AWS HTTPS + web-to-AWS | ✅ **Done** — Task 11.6 GO FULL ([`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md)) |
| Mayar live sandbox | No live callback proof; **backlog** ([`docs/54`](54-mayar-staging-live-execution-report.md), [`docs/72`](72-payment-provider-decision-report.md)) |
| Production payment | **NOT ENABLED** — plan in [`docs/73`](73-duitku-production-payment-enable-plan.md); founder Go required |
| Production callback on `narraza.id` | Final domain not configured |
| Production Supabase migration `00010` | Pending — hosted staging done ([`docs/75`](75-apply-migration-00010-hosted-staging-report.md)) |
| Production deploy / migration push | Manual founder approval only |

### Deferred

| Item | Priority |
|---|---|
| Hosted migration `00010` apply | P1 — operator before production |
| Refund/chargeback SOP final approval | P2 — draft in docs/73 §10 |
| Admin payment dashboard | P2 — manual SOP docs/73 §9 |
| Production enable execution | Gated — docs/73 §7 |
| `GET /api/credits/topup/orders/:id` | P2 |
| CI / staging smoke automation | P1 (Task 11.2) |
| Live OpenRouter rewrite/publish spot checks on staging | P2 |
| Publish **Terapkan Semua** dedicated E2E | P2 |
| Summary/delta AI generation | P2 |
| Full foundation/concept/outline AI production | P2 |
| Draft import | Product backlog |
| Full voice DNA | Product backlog |
| Creator Mode | Product backlog |
| Analytics dashboard / growth | Product backlog |
| Full validator suite | Product backlog |
| Mobile topup entry | P2 |
| Mayar HMAC verification | P2 |
| Callback hardening (orphan pending orders) | P2 |
| ShopeePay/SP retest post-HMAC fix | P2 — optional/backlog |
| Mayar live sandbox (10.8b) | P2 — secondary/backlog |
| Task 1.17 visual polish | Product backlog |
| Siklusio → VibeNovel staging router replay | P1 |

---

## 10. MVP Acceptance Benchmark

The MVP is **not** "many features." It is this proof (from original roadmap, retained):

```txt
Can produce a 20–30 chapter KBM-style serial drama
with 1 major reveal around chapters 20–25,
without leaking the reveal before time,
without characters knowing facts they have not learned,
without the protagonist losing endlessly without mini victories,
with mobile-readable formatting,
and with Publish Package per chapter.
```

### Internal benchmark structure (unchanged)

```txt
Chapters 1–10:   light breadcrumbs, early conflict, clear reader promise.
Chapters 11–20:  suspicion increases, mini victories, open loops strengthen.
Chapters 21–24:  clues closer, confirmation still withheld.
Chapter 25:      major reveal explicit.
Chapters 26–30:  reveal consequence, emotional payoff, new conflict direction.
```

### Added conditions after Sprint 10–11 (monetization + staging)

MVP must also prove:

```txt
Credit-safe AI generation (debit/refund, no double charge).
Safe topup/payment path for credits (fixture-verified minimum;
  live provider proof before production).
Staging smoke and payment callback proof before production enable.
```

**Current gap:** Pipeline components exist; **end-to-end 2030-chapter serial proof** and **full validator suite** are not yet demonstrated. Payment is fixture-verified only; live provider **BLOCKED**.

---

## 11. Document Maintenance Rule

| Document | Role |
|---|---|
| **README.md** | Execution status — sprint table, next task |
| **docs/36** | Blocked / deferred register — append on new blockers |
| **docs/61** | Sprint numbering map — old vs actual |
| **docs/63** (this file) | Updated product roadmap — refresh on major milestone |
| **docs/26 + docs/17** | Historical vision only — do not rewrite execution status |
| **Sprint closure reports** | Evidence — authoritative per-sprint outcomes |

When closing a new implementation sprint:

1. Update **README.md** sprint table.
2. Add/update **closure report** in `docs/`.
3. Append **docs/36** if new deferred/blockers.
4. Update **§3–§4** of this doc if product coverage changes materially.
5. Do **not** remove historical banners from `docs/26`.

---

## Related documents

- [`README.md`](../README.md) — execution status
- [`docs/61-roadmap-and-sprint-number-reconciliation.md`](61-roadmap-and-sprint-number-reconciliation.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`docs/60-sprint-11-staging-deploy-and-public-callback-plan.md`](60-sprint-11-staging-deploy-and-public-callback-plan.md)
- [`docs/62-staging-deploy-mode-a-report.md`](62-staging-deploy-mode-a-report.md)
- [`docs/26-current-sprint-plan.md`](26-current-sprint-plan.md) — historical vision
- [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md) — historical MVP outline

---

*Authored Task 11.1c — 9 Juni 2026. Docs-only; no code changes.*