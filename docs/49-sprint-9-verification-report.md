# 49 — Sprint 9 Verification Report

**Sprint:** Sprint 9 — AI Rewrite, Publish Copy & Credit UI  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md), [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md), [`docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`](48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md)

Dokumen ini adalah **laporan penutupan resmi Sprint 9** (Task 9.0–9.8). Mencakup deliverables AI rewrite, publish copy improvement, credit UI minimal, cost observability, smoke matrix, safety/canon boundary, dan keputusan gate. Bukan implementasi baru — hanya dokumentasi penutupan.

**Work logs:** `.agent-logs/sprint-9/task-9.0-ai-rewrite-publish-credit-ui-plan.md` … `task-9.8-sprint-9-verification-report.md`

---

## 1. Executive Summary

Sprint 9 **selesai dan terverifikasi**. Memperluas AI Sprint 8 ke:

- **Cost observability** — `estimated_cost_usd` pada `generation_attempts` (internal only)
- **Credit UI minimal** — saldo/biaya kredit di WritePage
- **Prose Rewrite API** — `POST /ai/rewrite-prose`
- **WritePage Rewrite UI** — mode picker + `Perbaiki Teks dengan AI`
- **Publish Copy AI API** — `POST /ai/improve-publish-copy` (suggestion-first)
- **PublishPage AI UI** — panel **Perbaiki Copy dengan AI** + apply via PATCH
- **Full safety regression** — API mock modes + web mock + API-mode E2E (Task 9.7)

### Closure decision

| Question | Answer |
|---|---|
| **Sprint 9 ready to close?** | **YES** |
| **Blockers?** | **None** |

AI **disabled by default** (`AI_GENERATION_ENABLED=false`). Sprint 9 verification menggunakan **mock provider**; live rewrite/publish copy tidak diuji (non-blocking).

---

## 2. Delivered Features

### A. Cost observability (Task 9.1)

| Item | Status |
|---|---|
| `apps/api/src/services/model-cost-map.ts` | ✅ |
| `google/gemini-2.5-flash` pricing in allowlist map | ✅ Verified Task 9.1 / docs/47 |
| `estimated_cost_usd` populated when token usage available | ✅ |
| Mock provider: `estimated_cost_usd=0`, `approximate=true` | ✅ sprint8/9 smokes |
| **Not used for billing** — fixed `credit_cost` remains authoritative | ✅ |

### B. Credit UI minimal (Task 9.2 + 9.2b)

| Item | Status |
|---|---|
| WritePage balance / action cost / estimated remaining | ✅ |
| Insufficient balance guard (button disabled when known balance too low) | ✅ |
| No topup / payment UI | ✅ |
| No credit ledger exposure in UI | ✅ |

### C. Prose Rewrite API (Task 9.3)

| Item | Status |
|---|---|
| `POST /api/projects/:id/ai/rewrite-prose` | ✅ |
| Modes: `improve_emotion`, `tighten_pacing`, `natural_dialogue`, `shorter`, `longer`, `custom` | ✅ |
| Credit policy: hemat **3** / seimbang **6** / terbaik **12** | ✅ |
| New `chapter_prose_versions` row (`source=ai_generated`, metadata `generationType=prose_rewrite`) | ✅ |
| No canon mutation | ✅ smoke |

### D. WritePage Rewrite UI (Task 9.4 + 9.4b)

| Item | Status |
|---|---|
| Mode selector + custom instruction | ✅ |
| Credit cost and balance display | ✅ |
| Editor updates on success (new prose version) | ✅ API-mode E2E |
| Mock/fallback: no fake rewrite success | ✅ |

### E. Publish Copy AI API (Task 9.5)

| Item | Status |
|---|---|
| `POST /api/projects/:id/ai/improve-publish-copy` | ✅ |
| Suggestion-first — suggestions in `generation_attempt.metadata.suggestions` | ✅ |
| Credit policy: hemat **3** / seimbang **6** / terbaik **12** | ✅ |
| No `publish_packages` mutation on improve | ✅ |
| Overclaim guard + leak guard | ✅ |

### F. PublishPage AI UI (Task 9.6 + 9.6b)

| Item | Status |
|---|---|
| Field checkboxes (teaser, caption, etc.) | ✅ |
| Suggestions display after **Buat Saran Copy** | ✅ API-mode E2E |
| **Terapkan** / **Abaikan** / **Terapkan Semua** | ✅ UI present; single-field apply E2E verified |
| Apply via existing `PATCH .../publish/:packageId/fields` | ✅ |
| No auto-post KBM | ✅ |

### Task completion matrix

| Task | Deliverable | Status |
|---|---|---|
| **9.0** | Rencana (`docs/48`) | ✅ |
| **9.1** | `model-cost-map.ts`, `estimated_cost_usd` | ✅ |
| **9.2** | Credit UI minimal | ✅ |
| **9.2b** | Credit UI regression stabilization | ✅ |
| **9.3** | Prose rewrite API | ✅ |
| **9.4** | WritePage rewrite UI | ✅ |
| **9.4b** | Rewrite API-mode E2E | ✅ |
| **9.5** | Publish copy AI API | ✅ |
| **9.6** | PublishPage AI UI | ✅ |
| **9.6b** | Publish AI API-mode E2E | ✅ |
| **9.7** | Safety regression | ✅ |
| **9.8** | Laporan ini (`docs/49`) | ✅ |

---

## 3. Architecture Decisions Confirmed

| Decision | Policy |
|---|---|
| Prose beat + rewrite use **tiered model quality** (hemat/seimbang/terbaik → model router) | ✅ Sprint 8 + 9 |
| Backend core engines (foundation, outline, summary, publish package generator) remain **fixed/stub/deterministic** | ✅ No Sprint 9 change |
| Temperature/config variation for backend machines | **Later** — not broad model tiering for every engine |
| Publish copy **suggestion-first** | ✅ API returns suggestions; UI stores in hook state; PATCH on user apply |
| `estimated_cost_usd` is **observability only** | ✅ Fixed `credit_cost` remains billing |
| AI output is **draft/artifact** | ✅ `chapter_prose_versions` or suggestion metadata — never direct canon |

---

## 4. Smoke Test Summary

*Results cited from Task 9.7 (2026-06-08). No new tests run in Task 9.8.*

### API baseline (AI disabled default)

| Command | Result |
|---|---|
| `npm run smoke:api` | **17/17 PASS** |
| `npm run smoke:api:sprint5` | **49/49 PASS** |
| `npm run smoke:api:sprint6` | **68/68 PASS** |
| `npm run smoke:api:sprint7` | **53/53 PASS** |
| `npm run smoke:api:sprint8` | **8 PASS**, 5 NOT RUN (AI disabled by design) |
| `npm run smoke:api:sprint9` | **10 PASS**, 11 NOT RUN (AI disabled by design) |

### API mock modes (`AI_GENERATION_ENABLED=true`, restart `dev:api` per mode)

| Command | Result |
|---|---|
| `smoke:api:sprint8 -- -MockMode success` | **20 PASS**, 0 FAIL |
| `smoke:api:sprint8 -- -MockMode fail_provider` | **14 PASS**, 0 FAIL |
| `smoke:api:sprint8 -- -MockMode unsafe_output` | **14 PASS**, 0 FAIL |
| `smoke:api:sprint9 -- -MockMode success` | **46 PASS**, 0 FAIL |
| `smoke:api:sprint9 -- -MockMode fail_provider` | **31 PASS**, 0 FAIL |
| `smoke:api:sprint9 -- -MockMode unsafe_output` | **30 PASS**, 0 FAIL |

### Web mock (`VITE_USE_MOCKS=true`)

| Command | Result |
|---|---|
| `npm run smoke:web` | **PASS** |
| `npm run smoke:web:write` | **PASS** |
| `npm run smoke:web:write-ai` | **PASS** |
| `npm run smoke:web:credit-ui` | **PASS** |
| `npm run smoke:web:rewrite` | **PASS** |
| `npm run smoke:web:publish` | **PASS** |
| `npm run smoke:web:publish-ai` | **PASS** |
| `npm run smoke:web:sprint9` | **PASS** |

### API-mode web (`VITE_USE_MOCKS=false`, mock provider success)

| Scenario | Result |
|---|---|
| `smoke:web:write-ai -- -IncludeApiMode` (success) | **PASS** — prose in editor, credit notice |
| `smoke:web:write-ai -- -IncludeApiMode` (disabled) | **PASS** — safe AI disabled message |
| `smoke:web:rewrite -- -IncludeApiMode` (success) | **PASS** — rewrite updates editor |
| `smoke:web:rewrite -- -IncludeApiMode` (disabled) | **PASS** |
| `smoke:web:publish-ai -- -IncludeApiMode` (success) | **PASS** — suggestions, no pre-apply mutation, Terapkan |
| `smoke:web:publish-ai -- -IncludeApiMode` (disabled) | **PASS** |
| `smoke:web:sprint9 -- -IncludeApiMode` | **PASS** |

### Orchestrator

| Command | Result |
|---|---|
| `npm run smoke:all:local` | **11/11 PASS** (~1.0m) |
| `npm run smoke:all:local:full` | **NOT RUN** — `smoke-all-local.ps1` lacks Sprint 9 web/API phases; API-mode matrix verified explicitly in Task 9.7 with dedicated env switching; `:full` requires `VITE_USE_MOCKS=false` incompatible with safe mock default end state |

---

## 5. Safety Verification

Explicit assertions verified via Sprint 5/7/8/9 smoke scripts and Playwright leak patterns (Task 9.7):

| Assertion | Status |
|---|---|
| No raw prompt stored or returned | ✅ |
| No `packet_json` exposed (API response, audit, DOM) | ✅ |
| No `planningTruth` / `planning_truth` exposed | ✅ |
| No OpenRouter key exposed | ✅ |
| No raw provider body exposed | ✅ |
| No `estimated_cost_usd` in UI | ✅ |
| `credit_cost` fixed and unchanged by client | ✅ |
| Idempotency — no double debit on replay | ✅ |
| Refund on provider failure (`fail_provider`) | ✅ |
| Refund on unsafe output (`unsafe_output`) | ✅ |
| No canon mutation from prose beat / rewrite / publish copy | ✅ |
| Publish copy suggestions do not mutate package before apply | ✅ |
| Publish copy does not create `ai_proposals` | ✅ |
| No auto-post KBM | ✅ |

---

## 6. Canon Boundary

| AI surface | Allowed mutation | Forbidden |
|---|---|---|
| Prose beat AI (Sprint 8) | `chapter_prose_versions` only | facts, characters, speech_rules, proposals |
| Rewrite AI (Sprint 9) | `chapter_prose_versions` only (new version) | canon tables, source prose overwrite |
| Publish copy AI (Sprint 9) | Suggestions in attempt metadata + UI state until user **Terapkan** | `publish_packages` on improve; `ai_proposals` |
| Summary/delta AI | — | **Not Sprint 9** — still deferred |
| Proposal auto-accept | — | **Never** from AI output |
| Canon promotion from AI | — | **Never** direct |

---

## 7. Credit Boundary

| Generation type | hemat | seimbang | terbaik |
|---|---|---|---|
| `prose_beat` (Sprint 8) | 5 | 10 | 20 |
| `prose_rewrite` (Sprint 9) | 3 | 6 | 12 |
| `publish_copy` (Sprint 9) | 3 | 6 | 12 |

| Rule | Status |
|---|---|
| Debit before provider call | ✅ |
| Refund on fail / unsafe / parse failure (where applicable) | ✅ |
| `estimated_cost_usd` internal and approximate | ✅ |
| No topup / payment | ✅ |
| No subscription logic | ✅ |
| Client cannot override `creditCost` / `model` | ✅ |

---

## 8. Live Provider Status

| Surface | Live OpenRouter | Notes |
|---|---|---|
| Prose beat (Sprint 8) | **GO** | Task 8.9b — `google/gemini-2.5-flash` ([`docs/47`](47-live-openrouter-staging-smoke-report.md)) |
| Prose rewrite (Sprint 9) | **NOT RUN** | Mock provider only in 9.7 |
| Publish copy (Sprint 9) | **NOT RUN** | Mock provider only in 9.7 |
| Final default env | `AI_GENERATION_ENABLED=false` | Safe local default restored |

---

## 9. Known Limitations

| Limitation | Impact |
|---|---|
| `smoke:all:local` excludes Sprint 9 API/web scripts | Sprint 9 verified separately (Task 9.7) |
| `smoke:all:local:full` not run | See §4 orchestrator note |
| API-mode E2E local-only, not CI | Manual dual-env discipline |
| **Terapkan Semua** not dedicated E2E | Single-field apply verified (9.6b, 9.7) |
| Live rewrite / publish copy not run | Non-blocking; mock matrix PASS |
| Rewrite `source` still `ai_generated` | Differentiated by metadata `generationType=prose_rewrite` |
| Failed idempotency key requires new key | By design |
| Superseded publish package can be improved; exported package locked (409) | By design |
| No topup / payment | Deferred |
| No admin credit dashboard | Deferred |
| No summary/delta AI | Deferred |
| No remote deploy / migration push | Not done |
| Single `dev:api` listener on :8787 needed | Avoid health flag skew from stale workers |

---

## 10. Blockers

**No blockers for Sprint 9 closure.**

---

## 11. Non-blocking / Deferred Items

Updated summary for [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md):

| Item | Priority | Timing |
|---|---|---|
| CI API-mode E2E (write/rewrite/publish AI) | P1 | Before production or dedicated CI runner |
| `smoke:all:local` include Sprint 9 phases | P1 | Task 9.9 candidate |
| Live rewrite / publish copy spot check | P2 | Optional post-close |
| Topup / payment | P2 | Sprint 10+ |
| Admin credit dashboard | P2 | Sprint 10+ |
| True DB RPC for credit + attempt atomicity | P1 | Before production deploy |
| Summary / delta AI | P2 | After validator mature |
| Foundation / concept / outline AI | P2 | Post-MVP |
| Publish **Terapkan Semua** dedicated E2E | P2 | Nice-to-have |

---

## 12. Next Recommended Task

### Recommendation: **Task 9.9 — Sprint 9 Smoke Orchestrator Consolidation + Optional Live Rewrite/Publish Spot Check**

**Why not Sprint 10.0 yet:** Sprint 9 baru ditutup; orchestrator belum mencakup Sprint 9; live rewrite/publish belum diuji; CI API-mode E2E masih deferred. Konsolidasi smoke + optional live spot check menutup gap operasional tanpa membuka scope monetization/production deploy.

**Task 9.9 scope (suggested):**

1. Extend `scripts/smoke-all-local.ps1` — Sprint 9 API baseline + web mock (`sprint9-smoke-api.ps1` disabled default, `sprint9-smoke-web.ps1` mock)
2. Document `:full` env-switching playbook or split orchestrator phases
3. Optional: one live rewrite OR publish copy call with `google/gemini-2.5-flash` — verify `estimated_cost_usd`, immediate rollback
4. Small CI planning note (what blocks GitHub Actions API-mode E2E)

**Alternative (later):** Task 10.0 — Production Readiness / Monetization Plan — after 9.9 hygiene and true RPC credit hardening discussion.

---

## 13. Related Documents

| Doc | Role |
|---|---|
| [`docs/48`](48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md) | Sprint 9 implementation plan |
| [`docs/45`](45-sprint-8-verification-report.md) | Sprint 8 closure |
| [`docs/47`](47-live-openrouter-staging-smoke-report.md) | Live prose beat GO |
| [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md) | Debt register |
| [`scripts/README.md`](../scripts/README.md) | Smoke commands + Task 9.7 matrix |

---

*Sprint 9 closed 8 Juni 2026. AI generation remains disabled by default in local dev.*