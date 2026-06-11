# 36 — Non-blocking Technical Debt & Deferred Items

**Status:** Living register (Task 5.8)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Related:** [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md), [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md), [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md), [`scripts/README.md`](../scripts/README.md)

Dokumen ini membedakan **blocker**, **non-blocking debt**, dan **deferred product scope**. Bukan sprint plan — gunakan sebagai checklist sebelum Sprint 6 dan sebelum AI/production deploy. **Updated product roadmap:** [`docs/63`](63-updated-product-roadmap-after-sprint-11.md) (Task 11.1c).

**Brand (2026-06-09):** Product-facing brand = **Narraza** (*Build long fiction without losing the plot.*). VibeNovel/Novory = historical/repo names only. Staging domain `narraza.web.id` = temporary MVP; production target `narraza.id`.

**Staging API (post 11.6):** `https://api-staging.narraza.web.id` — web `vibenovel-web-staging.pages.dev` points to AWS API.

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
| `smoke:api` = Sprint 2 only (17 steps) — Sprint 5+ separate aliases | P1 | **Addressed Task 5.8/8.6/9.9** — `smoke:all:local` now **13 phases** incl. Sprint 8/9 API baseline + Sprint 3–9 web mock |
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
| Write Room prose beat AI button (Task 8.5) | P1 | **Addressed Sprint 8** — `Tulis Beat dengan AI` API mode only |
| Sprint 8 full AI mock smoke (success/fail/unsafe) | P1 | **Addressed Task 8.6** — manual env restart; not in default `smoke:all:local` |
| WritePage AI success API-mode E2E | P1 | **Addressed Task 8.6** — `smoke:web:write-ai -IncludeApiMode` with AI enabled |
| ~~Write Room rewrite/fix AI CTAs disabled~~ | P2 | **Addressed Task 9.4** — `Perbaiki Teks dengan AI` on WritePage (API mode); mock/fallback disabled |
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
| No beat-level AI generation | P1 | **Addressed Sprint 8** — `POST /ai/generate-prose` + WritePage button |
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
| No OpenRouter / model router | P0 | **Addressed 8.2** — shell + mock; live endpoint Task 8.4 |
| No `chapter_generation_attempts` table | P1 | **Addressed 8.1** — `generation_attempts` table; service logic Task 8.3+ |
| No credit deduction on generation | P1 | Sprint 8 — service ✅ 8.3; wired to AI endpoint Task 8.4 |
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
12. **`smoke:all:local`** ✅ — **14 phases**: Sprint 2/5/6/7/8/9 API + Sprint 3–10 web mock (**7.8.4**, **8.6**, **9.9**, **10.6**). Full AI mock modes remain manual env restart. **`smoke:all:local:full`** API-mode local/manual only (not CI); orchestrator does not auto-switch env.
13. **Seed GoTrue login quirk** — smokes use ephemeral signup.

---

## F. Pre-AI Hardening Task Register (from `docs/41`)

| Task | Scope | Status |
|---|---|---|
| **7.8** | Hardening plan document | ✅ Plan complete (`docs/41`) |
| **7.8.1** | Audit action enum + coverage map | ✅ Design complete (`docs/42`) |
| **7.8.2** | Audit writers for canon/export P0 paths | ✅ Implemented (`00007`, P0+P1 writers) |
| **7.8.3** | Transaction wrapper + P0 workflows | ✅ Implemented (`transaction.ts`, P0 hardening, sprint6 smoke assertions) |
| **7.8.4** | `smoke:all:local` include Sprint 6/7 | ✅ Extended **8.6** / **9.9** — `smoke-all-local.ps1` **13 phases**; `:full` passes `-IncludeApiMode` to web 7–13 |
| **7.8.5** | CI E2E feasibility / optional nightly | Pending |
| **7.8.6** | Hardening verification report (`docs/43`) | ✅ Closed |
| **8.0** | AI/OpenRouter & credit-gated generation plan | ✅ [`docs/44`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md) |
| **8.1** | `generation_attempts` + `credit_ledger` migration | ✅ `00008` + shared types |
| **8.2** | Model router + OpenRouter shell + mock provider | ✅ Internal services only; no AI route yet |
| **8.3** | Credit debit/refund service | ✅ `credit-ledger.ts` + `ai-credit-policy.ts`; no public route |
| **8.4** | Prose beat generation API | ✅ `POST /ai/generate-prose`, `generation-attempt.ts`, `sprint8-smoke-api.ps1` |
| **8.5** | WritePage AI button | ✅ `Tulis Beat dengan AI`, `smoke:web:write-ai` |
| **8.6** | Safety + verification | ✅ Full mock matrix + E2E (Task 8.6) |
| **8.7** | Verification report | ✅ [`docs/45`](45-sprint-8-verification-report.md) |
| **8.8** | Live OpenRouter staging verification plan | ✅ [`docs/46`](46-live-openrouter-staging-verification-plan.md) |
| **8.9** | Live OpenRouter staging smoke execution | ✅ [`docs/47`](47-live-openrouter-staging-smoke-report.md) — Task 8.9 NO-GO (no key) |
| **8.9b** | Live OpenRouter staging with local key | ✅ [`docs/47`](47-live-openrouter-staging-smoke-report.md) — **GO** |

**Sprint 8:** **Closed** (`docs/45`). MVP prose beat generation verified mock + live OpenRouter staging **GO** (Task 8.9b). **AI disabled by default** (`AI_GENERATION_ENABLED=false`).

**Sprint 8 smoke note:** `smoke:api:sprint8` baseline (AI disabled) in `smoke:all:local`. Live OpenRouter verified: [`docs/47`](47-live-openrouter-staging-smoke-report.md) — model `google/gemini-2.5-flash` (hemat).

**Remaining AI debt (non-blocking):** topup/payment, true RPC credit mutation, CI E2E, `AI_TIMEOUT_MS` wiring, production Worker secret rollout.

**Addressed Task 9.1:** `estimated_cost_usd` population via `model-cost-map.ts` (internal observability only; fixed `credit_cost` billing unchanged).

**Addressed Task 9.2:** WritePage credit UI minimal (saldo/biaya kredit read-only; server authoritative billing).

**Addressed Task 10.4:** Credit topup UI (`/credits/topup`, checkout redirect, mock return pending, Refresh Saldo). No frontend grant; mock mode disables checkout; topup default off (`CREDIT_TOPUP_ENABLED=false`).

**Addressed Task 10.5 (PARTIAL GO):** Mayar sandbox live smoke report [`docs/51`](51-mayar-sandbox-live-smoke-report.md). Parser: `data.id` is webhook row id (not invoice); live invoice/paid webhook capture deferred until operator adds sandbox key + staging tunnel. `smoke:api:sprint10:mayar-live`.

**Addressed Task 10.6:** Payment ops runbook [`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md). `smoke:all:local` **14 phases** (Sprint 10 web topup mock). Paid-but-no-credit SQL checklist docs-only. `GET /api/credits/topup/orders/:id` **deferred**. Production payment **NOT READY**.

**Sprint 10 closed (Task 10.7):** [`docs/53-sprint-10-verification-report.md`](53-sprint-10-verification-report.md) — payment/topup foundation verified mock + dual-app local; Mayar live **PARTIAL GO**; production payment blocked.

**Task 10.8 Mayar staging live execution:** [`docs/54-mayar-staging-live-execution-report.md`](54-mayar-staging-live-execution-report.md) — **BLOCKED** (`hasMayarApiKey=false`, no public webhook). Live invoice/webhook **NOT RUN**. Next: **Task 10.8b** (operator key + tunnel/staging) or **Task 11.0** (staging deploy plan).

**Task 10.9 Duitku provider spike:** [`docs/55`](55-duitku-provider-spike-and-migration-feasibility.md) — Duitku **POP** feasible; Mayar retained.

**Task 10.10 Duitku POP shell:** [`docs/56`](56-duitku-pop-provider-adapter-shell.md) — `PAYMENT_PROVIDER=duitku`, `duitku-pop-client.ts`, health flags, `smoke:api:sprint10:duitku`. Callback grant **deferred** 10.12. Production payment **NOT READY**.

**Task 10.11 Duitku checkout integration:** [`docs/57`](57-duitku-checkout-integration-report.md) — checkout path verified via provider abstraction; no-credential safe fail; optional `-LiveCreate`. Sandbox live checkout **NOT RUN** without credentials.

**Task 10.12 Duitku callback + grant:** [`docs/58`](58-duitku-callback-idempotent-grant-report.md) — `POST /api/payments/duitku/callback`, MD5 signature, `grantCreditsForPaymentSession`, fixture smoke matrix PASS. Live Duitku sandbox **NOT RUN**. Production payment **NOT READY**.

**Task 10.13 Duitku sandbox live smoke:** [`docs/59`](59-duitku-sandbox-live-smoke-report.md) — **BLOCKED** (`hasDuitkuMerchantCode=false`, `hasDuitkuCallbackUrl=false`, `PAYMENT_PROVIDER_MOCK=true`). LiveCreate/payment/callback **NOT RUN**. Fixture regression PASS 15/15. Next: **Task 11.1** deploy + **10.13b** live smoke.

**Task 11.0 Staging deploy plan:** [`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md) — architecture + env checklist.

**Task 11.0b Roadmap reconciliation:** [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md) — `docs/26` is **historical product roadmap**, not execution tracker; old Sprint 8–11 numbering ≠ actual Sprints 8–11. Agents must use README + docs/61.

**Task 11.1c Updated product roadmap:** [`docs/63`](63-updated-product-roadmap-after-sprint-11.md) — merges `docs/26`/`docs/17` vision with actual state after Sprint 11; execution phases A–H; next task **11.2**.

**Task 11.1 Staging deploy Mode A:** [`docs/62`](62-staging-deploy-mode-a-report.md) — **GO** API `vibenovel-api-staging` + Pages `vibenovel-web-staging`; health/CORS/web shell PASS. Hosted Supabase secrets **not set** — auth/full smoke blocked.

**Task 11.2 Portable staging smoke harness:** [`docs/64`](64-staging-smoke-harness-and-supabase-report.md) — `npm run smoke:staging` cloud-agnostic (`-ApiBaseUrl`, `-WebBaseUrl`, `STAGING_SUPABASE_*`); phases A–C **PASS**; auth/API-mode **BLOCKED** (Worker Supabase pending). Next: **Task 11.2b** (operator) or **Task 11.4** (AWS adapter).

**Task 11.3 AWS staging readiness plan:** [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md) — separate EC2 from Hermes; recommend Docker Compose + Caddy; portability audit; env matrix; cost guard; **no AWS deploy**.

**Task 11.4 AWS API adapter + Docker prep:** [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md) — `createApp()` split, `node-server.ts`, Dockerfile, `docker-compose.staging.yml`; Node + Docker health **PASS**; CF Worker **PASS**.

**Task 11.2b Hosted Supabase operator gate:** [`docs/67`](67-hosted-supabase-staging-operator-gate-report.md) — superseded by operator session; Cloudflare staging **GO FULL** (`smoke:staging -IncludeApiMode` PASS, project `jdxyhrnibmmwlbtbokqo`).

**Task 11.5 AWS EC2 API staging deploy:** [`docs/68`](68-aws-ec2-api-staging-deploy-report.md) — **PARTIAL GO** — EC2 `13.212.245.32`, Docker+Caddy HTTP, smoke PASS.

**Task 11.6 AWS HTTPS + web-to-AWS:** [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md) — **COMPLETE / GO FULL** — `api-staging.narraza.web.id`; web rebuild → AWS API; full smoke PASS. Script fixes: Caddyfile space before `{`, preflight HTTPS/SSH fallback, TLS 1.2, 20s LE wait.

**Task 10.13b Duitku Mode B AWS live sandbox:** [`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md) — **GO** — LiveCreate + signed AWS HTTPS callback grant/idempotency/negatives PASS; BCA VA real callback verified in 10.13c; rollback Mode A PASS (2026-06-10).

**Task 10.13c Duitku real callback signature debug:** [`docs/71`](71-duitku-real-callback-signature-debug-report.md) — **GO** — root cause: real Duitku uses 64-hex HMAC-SHA256 `HMAC_SHA256(merchantCode+amount+merchantOrderId, merchantKey)`; validator dual-supports 64-hex HMAC + 32-hex MD5 fixtures; BCA VA real callback + grant verified (order `b98dfc22-…`).

**Task 10.14 Payment provider decision report:** [`docs/72`](72-payment-provider-decision-report.md) — **GO** — **Duitku POP BCA VA-first** recommended for MVP; **Mayar secondary/backlog**; production payment **NOT ENABLED**.

**Task 10.15 Duitku production payment enable plan:** [`docs/73`](73-duitku-production-payment-enable-plan.md) — **GO** (plan only) — gated enable sequence, checklist, rollback, reconciliation/refund SOP drafts; production payment **still NOT ENABLED**; founder approval required before Phase 1+.

**Task 10.16 Atomic grant DB RPC:** [`docs/74`](74-atomic-grant-db-rpc-report.md) — **GO** — `grant_paid_credit_topup_atomic` (`00010`); API grant path uses RPC; local/fixture smoke PASS.

**Task 10.17 Apply migration 00010 hosted staging:** [`docs/75`](75-apply-migration-00010-hosted-staging-report.md) — **GO** — migration applied to `jdxyhrnibmmwlbtbokqo`; hosted RPC idempotency PASS; **production migration still pending**.

**Task 10.18 Redeploy staging API + RPC grant E2E:** [`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md) — **GO** — AWS API redeployed (`c505a82`); fixture callback grant via API → `grant_paid_credit_topup_atomic` PASS; duplicate/negatives PASS; Mode A restored.

**Task 10.19 Production preflight + migration 00010 gate:** [`docs/77`](77-production-payment-preflight-migration-approval-gate.md) — **BLOCKED** — migration file ready; production Supabase **not identified**; `api.narraza.id` / `narraza.id` not deployed; explicit approval **not received**; production migration **not applied**.

**Task 10.20 Production environment foundation plan:** [`docs/78`](78-production-environment-foundation-plan.md) — **GO** (plan only) — topology (Pages `narraza.id` + EC2 `api.narraza.id` + new Supabase); operator checklists; env matrix; Phases 0–9; **no production deployed**.

**Task 10.21 Production Supabase baseline setup:** [`docs/79`](79-production-supabase-baseline-setup-report.md) — **GO** — prod `qjmb…njct`; `00001`–`00009` applied; `00010` not applied; staging `jdxyhrnibmmwlbtbokqo` untouched.

**Task 10.22 Production API/web/DNS Mode A plan + preflight:** [`docs/80`](80-production-api-web-dns-mode-a-preflight-report.md) — **GO** — launch domain corrected to `narraza.web.id` / `api.narraza.web.id`.

**Task 10.23 Production API/web Mode A deploy:** [`docs/81`](81-production-api-web-mode-a-deploy-report.md) — **PARTIAL GO** — approval received; Pages `narraza-web-production` deployed; API EC2/DNS pending; payment OFF.

**Task 10.23a Production infra unblock:** [`docs/82`](82-production-infra-unblock-report.md) — **PARTIAL GO** — domain split (homepage / `app` / API); env corrected; AWS NoCredentials; EC2/DNS/API pending; payment OFF.

**Task 10.23b Production EC2/API Mode A deploy:** [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md) — **GO** — `https://api.narraza.web.id` HTTPS health Mode A PASS; staging PASS.

**Task 10.23c Production app custom domain verify:** [`docs/84`](84-production-app-custom-domain-verify-report.md) — **GO** — `https://app.narraza.web.id` HTTP 200; bundles load; production API wired; staging regression PASS; apex homepage pending.

**Task 10.24 Production homepage on narraza.web.id:** [`docs/85`](85-production-homepage-placeholder-report.md) — **GO** — `https://narraza.web.id` static landing live; app/API/staging PASS.

**Task 10.25 Private beta launch readiness audit:** [`docs/86`](86-private-beta-launch-readiness-audit.md) — **GO** — payment-off beta path; `/login` page added; founder auth smoke gate.

**Task 10.26 Real private-beta story flow:** [`docs/87`](87-real-private-beta-story-flow-report.md) — **GO** — founder verified create/intake persist.

**Task 10.26b Founder story smoke:** [`docs/88`](88-founder-private-beta-story-smoke-report.md) — **GO** — founder verified full flow. OpenRouter key in local `.env.production`; EC2 API redeploy pending for live AI.

**Task 10.27 Full repo audit vs sprint plan:** [`docs/89`](89-full-repo-audit-vs-sprint-plan.md) — **GO** — audit-only; stage = private beta without AI; next = 10.28 EC2 redeploy + gated AI test or 10.29 workflow E2E.

**Task 10.28 AI founder test mode:** [`docs/90`](90-ai-founder-test-mode-report.md) — **GO** — production API `aiGenerationEnabled=true`; founder prose beat live OpenRouter verified; payment OFF. **Debt:** default hemat model `google/gemma-2-9b-it` 404 on OpenRouter — use `AI_MODEL_HEMAT=google/gemini-2.5-flash`; outline lock → `workflow_phase` may desync (manual patch used).

**Task 10.29 Founder browser E2E:** [`docs/91-founder-browser-e2e`](91-founder-browser-e2e-story-workflow-report.md) — **GO** — Write Room UI triggers real AI prose; persistence + credit in assistant panel.

**Task 10.29 Remove misleading mock flow:** [`docs/91-mock-flow`](91-remove-misleading-mock-flow-report.md) — **GO** — `allowMockFallback()` guard; dashboard progress from `workflowPhase`; write/summary/publish locked states replace silent Sprint 1 fallback. **Debt:** shell `CreditIndicator` still mock 1.250; sidebar active project vs route project may diverge → **10.30**.

**Task 10.30a Remove initial mock hook states + CreditIndicator + routing:** [`docs/93`](docs/93-remove-initial-mock-hook-states-credit-route-report.md) — **GO** — Phase 0 audit fix; real credits wired; CTA routes aligned.

**Task 10.31a Real Intake Assistant and Concept Generator Pipeline:** [`docs/94`](docs/94-real-intake-assistant-concept-generator-report.md) — **GO** — OpenRouter intake chat & concept generator; credit balance authoritative debits; 7 signals progress tracked.

**Task 10.31a-hotfix Fix Failed to Create Generation Attempt in Intake Assistant:** [`docs/95`](docs/95-hotfix-generation-attempt-intake-assistant.md) — **GO** — Resolved foreign key constraint violation on chapter_outline_id by making it optional/nullable on attempt creation.

### Sprint 11 blocked (payment-related)

| Item | Blocker | Unblock path |
|---|---|---|
| Production payment | Ops gates not met ([`docs/73`](73-duitku-production-payment-enable-plan.md) §5–§7, [`docs/72`](72-payment-provider-decision-report.md)) | Complete checklist §5; founder Go/No-Go; production live test; **do not enable prod dashboards** without approval |
| Production callback on `narraza.id` | Final production domain not configured | Register production callback URL after domain ready |
| Mayar live sandbox | No `MAYAR_API_KEY` + no public webhook URL + no live callback proof | Task **10.8b** backlog; do not enable production |
| Domain `narraza.web.id` | Temporary staging/MVP | Migrate to `narraza.id` when product ready |

**Unblocked (2026-06-10):** Duitku staging BCA VA path — Tasks 10.13b/10.13c **GO**; staging rolled back to Mode A safe (`creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`).

### Sprint 11 deferred (fix later)

| Item | Priority | Notes |
|---|---|---|
| Mayar live sandbox retry (10.8b) | P2 | **Backlog** — secondary provider; no live proof on Narraza staging ([`docs/72`](72-payment-provider-decision-report.md)) |
| ShopeePay/SP retest post-HMAC fix | P2 | **Optional/backlog** — not required for MVP if BCA VA-first |
| True DB RPC atomic grant | P1 | Staging **done** (10.16–10.18); production `00010` **BLOCKED** — no prod Supabase linked ([`docs/77`](77-production-payment-preflight-migration-approval-gate.md)) |
| Refund/chargeback SOP | P2 | **Draft in docs/73 §10** — pending final founder approval |
| Admin payment dashboard / reconciliation | P2 | **Deferred** — manual SOP in [`docs/73`](73-duitku-production-payment-enable-plan.md) §9 |
| Production enable execution | P0 gate | **Gated** — docs/73 §7 Phases 0–11; founder approval only |
| `GET /api/credits/topup/orders/:id` | P2 | Return page uses balance refresh |
| CI E2E / automated staging smoke | P1 | Task 11.2 harness ✅; full staging blocked on Supabase |
| Live AI spot checks on staging | P2 | Separate task (Mode C) |
| Remote migration push / production deploy | Manual approval | Not Sprint 11 default |
| `[env.staging]` wrangler + `deploy:staging` scripts | P1 | Task 11.1 |
| Staging Supabase params in smoke scripts | P1 | ✅ Task 11.2 — `STAGING_SUPABASE_*`, `-StagingMode` |
| Mayar webhook HMAC verification | P2 | Deferred since 10.5 |
| Siklusio → VibeNovel staging router replay | P1 | Before prod router enable |

**Addressed Task 9.3:** Prose rewrite API (`POST /ai/rewrite-prose`) — draft-only new prose version; `source=ai_generated` + metadata `generationType=prose_rewrite`.

**Addressed Task 9.4:** WritePage rewrite UI — mode picker + `Perbaiki Teks` calls rewrite API; biaya 3/6/12 kredit; mock/fallback tidak fake rewrite; `smoke:web:rewrite` / `smoke:web:sprint9`.

**Addressed Task 9.5:** Publish copy AI API (`POST /ai/improve-publish-copy`) — suggestion-first (no `publish_packages` mutation); suggestions in `generation_attempt.metadata.suggestions`; biaya 3/6/12 kredit; overclaim guard; `smoke:api:sprint9` publish-copy block.

**Addressed Task 9.6:** PublishPage AI UI — panel **Perbaiki Copy dengan AI**; suggestions displayed; user **Terapkan** via existing `PATCH .../publish/:packageId/fields`; mock/fallback no fake AI; `smoke:web:publish-ai` / `smoke:web:sprint9`.

**Addressed Task 9.7:** Sprint 9 safety regression — full API baseline (Sprint 2/5/6/7/8/9), Sprint 8/9 mock modes (success/fail_provider/unsafe_output), web mock matrix, API-mode write/rewrite/publish AI success + disabled E2E; env restored safe default.

**Addressed Task 9.9:** `smoke:all:local` extended to **13/13 PASS** (~1.9m, exit 0) — Sprint 9 API baseline (phase 6) + web mock (phase 13); `-LiveSpotCheck` hook in `sprint9-smoke-api.ps1`; `:full` playbook documented (NOT RUN in 9.9 — API-mode already verified in 9.7).

**Sprint 9 closed (Task 9.8):** [`docs/49-sprint-9-verification-report.md`](49-sprint-9-verification-report.md) — rewrite API/UI, publish copy AI (suggestion-first), credit UI, cost observability; mock + API-mode E2E verified; live rewrite/publish NOT RUN.

### Sprint 9 post-close deferred (non-blocking)

| Item | Priority | Timing |
|---|---|---|
| `smoke:all:local:full` automated env switch / CI | P1 | Before production or dedicated runner |
| CI API-mode E2E (write/rewrite/publish AI) | P1 | Before production |
| Live rewrite / publish copy spot check (`google/gemini-2.5-flash`) | P2 | Optional manual (`-LiveSpotCheck`) |
| Publish **Terapkan Semua** dedicated E2E | P2 | Nice-to-have |
| Topup / payment / admin credit dashboard | P2 | **Sprint 10** — schema [`00009`](../../supabase/migrations/00009_sprint10_payment_topup.sql) Task 10.1 ✅; checkout 10.2 ✅; webhook/grant 10.3 ✅; topup UI 10.4 ✅; admin dashboard **deferred** |
| Mayar webhook signature verification | P2 | Deferred — verify with Mayar docs/sandbox (Task 10.5) |
| True DB RPC topup grant atomicity | P1 | Before production — compensation runner in 10.3 is interim |
| Mayar multi-app webhook router (Siklusio + VibeNovel) | P1 | Task 10.3c ✅ forwarder; Task 10.3d ✅ local dual-app smoke PASS — enable `MAYAR_MULTI_APP_ROUTER_ENABLED` in **staging/prod** after ops Go/No-Go; Mayar dashboard stays on Siklusio |
| Siklusio checkout `extraData.app` / `extraData.flow` tags | P2 | Task 10.3c ✅ — `app=siklusio`, `flow=membership_purchase|ai_credit_topup` on invoice create |
| VibeNovel forward-token validation (`X-VibeNovel-Forward-Token`) | P2 | **Deferred** — VibeNovel webhook does not validate Siklusio forward token yet (10.3d documented) |
| Siklusio → VibeNovel staging/prod replay smoke | P1 | Local E2E ✅ (10.3d); staging replay still required before prod router enable |
| True DB RPC credit + attempt atomicity | P1 | Before production deploy |
| Summary / delta AI | P2 | After validator mature |
| Foundation / concept / outline AI | P2 | Post-MVP |

---

## Related documents

- [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md)
- [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md)
- [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)
- [`docs/42-audit-action-enum-and-coverage-plan.md`](42-audit-action-enum-and-coverage-plan.md)
- [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md)
- [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)
- [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md)
- [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)
- [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md)
- [`scripts/README.md`](../scripts/README.md)
- [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md)
- [`docs/26-current-sprint-plan.md`](26-current-sprint-plan.md) — historical product roadmap (not execution tracker)
- [`docs/61-roadmap-and-sprint-number-reconciliation.md`](61-roadmap-and-sprint-number-reconciliation.md) — old vs actual sprint map
- [`docs/63-updated-product-roadmap-after-sprint-11.md`](63-updated-product-roadmap-after-sprint-11.md) — updated product + execution roadmap (Task 11.1c)
- [`docs/72-payment-provider-decision-report.md`](72-payment-provider-decision-report.md) — Task 10.14 MVP provider decision (Duitku BCA VA-first)
- [`docs/73-duitku-production-payment-enable-plan.md`](73-duitku-production-payment-enable-plan.md) — Task 10.15 gated production enable plan
- [`docs/74-atomic-grant-db-rpc-report.md`](74-atomic-grant-db-rpc-report.md) — Task 10.16 atomic grant RPC
- [`docs/75-apply-migration-00010-hosted-staging-report.md`](75-apply-migration-00010-hosted-staging-report.md) — Task 10.17 hosted staging migration apply
- [`docs/76-redeploy-staging-api-rpc-grant-integration-report.md`](76-redeploy-staging-api-rpc-grant-integration-report.md) — Task 10.18 staging API redeploy + RPC E2E
- [`docs/77-production-payment-preflight-migration-approval-gate.md`](77-production-payment-preflight-migration-approval-gate.md) — Task 10.19 production migration approval gate (BLOCKED)
- [`docs/78-production-environment-foundation-plan.md`](78-production-environment-foundation-plan.md) — Task 10.20 production infra foundation plan
- [`docs/79-production-supabase-baseline-setup-report.md`](79-production-supabase-baseline-setup-report.md) — Task 10.21 production Supabase baseline (GO)
- [`docs/80-production-api-web-dns-mode-a-preflight-report.md`](80-production-api-web-dns-mode-a-preflight-report.md) — Task 10.22 production API/web/DNS Mode A plan (GO)
- [`docs/81-production-api-web-mode-a-deploy-report.md`](81-production-api-web-mode-a-deploy-report.md) — Task 10.23 production API/web Mode A deploy (GO — superseded by 10.23b/10.23c)
- [`docs/84-production-app-custom-domain-verify-report.md`](84-production-app-custom-domain-verify-report.md) — Task 10.23c production app custom domain verify (GO)
- [`docs/85-production-homepage-placeholder-report.md`](85-production-homepage-placeholder-report.md) — Task 10.24 production homepage (GO)
- [`docs/86-private-beta-launch-readiness-audit.md`](86-private-beta-launch-readiness-audit.md) — Task 10.25 private beta readiness (GO)
- [`docs/92-structural-repo-audit-mock-real-boundary.md`](92-structural-repo-audit-mock-real-boundary.md) — Task 10.30 structural audit
- [`docs/93-remove-initial-mock-hook-states-credit-route-report.md`](93-remove-initial-mock-hook-states-credit-route-report.md) — Task 10.30a Phase 0 audit fix
- [`docs/94-real-intake-assistant-concept-generator-report.md`](94-real-intake-assistant-concept-generator-report.md) — Task 10.31a real intake & concepts pipeline
- [`docs/95-hotfix-generation-attempt-intake-assistant.md`](95-hotfix-generation-attempt-intake-assistant.md) — Task 10.31a-hotfix generation attempt fix