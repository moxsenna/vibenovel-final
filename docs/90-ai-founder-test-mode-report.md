# 90 — AI Founder Test Mode (Task 10.28)

**Date:** 2026-06-10  
**Status:** **GO**  
**Brand:** **Narraza**  
**Related:** [`docs/89`](89-full-repo-audit-vs-sprint-plan.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md), [`docs/87`](87-real-private-beta-story-flow-report.md), [`.agent-logs/sprint-10/task-10.28-ai-founder-test-mode.md`](../.agent-logs/sprint-10/task-10.28-ai-founder-test-mode.md)

Founder-only AI test on production API. **Payment OFF.** **Migration `00010` NOT applied.** **Duitku production NOT setup.** **Not public AI launch.**

---

## Final summary

```txt
Task 10.28 — AI Founder Test Mode on Production API
Status: GO

Production API: aiGenerationEnabled=true, hasOpenRouterApiKey=true, payment mock/off
Founder moxsenna@gmail.com: 50 test credits seeded (admin_grant)
One live prose beat generation succeeded (google/gemini-2.5-flash via AI_MODEL_HEMAT)
Payment/security regression PASS; AI remains ON for founder testing
```

---

## Approval

```txt
APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY
```

Received in task scope. Gate satisfied.

---

## AI readiness

| Item | Value |
|---|---|
| **Endpoint tested** | `POST /api/projects/:id/ai/generate-prose` |
| **Other AI endpoints** | `rewrite-prose`, `improve-publish-copy` — not tested (higher cost / longer path) |
| **Concept/foundation/outline** | Deterministic stubs only — no OpenRouter path |
| **Provider** | OpenRouter live (`AI_PROVIDER_MOCK=false`) |
| **Model (hemat)** | `google/gemini-2.5-flash` via `AI_MODEL_HEMAT` (default `google/gemma-2-9b-it` returns OpenRouter 404) |
| **Credit requirement** | 5 credits (`hemat` prose beat) |
| **Gating** | Auth middleware + owned project + write-room gates (foundation locked, outline locked, workflow phase) — **no founder-only code flag**; any authed user with credits could call API if AI enabled |
| **Failed generation** | Debits then **refunds** on provider error (verified on first failed attempt) |
| **Persistence** | `chapter_prose_versions` row + `generation_attempts` succeeded + audit actions |
| **Safest test path chosen** | Prose beat `hemat` — only live LLM path in production |

---

## EC2 / API env

**Location:** `/opt/vibenovel/.env.production` on EC2 `13.251.228.117`

| Variable | Before (audit 10.27) | After (10.28) |
|---|---|---|
| `AI_GENERATION_ENABLED` | `false` | `true` |
| `AI_PROVIDER_MOCK` | `true` | `false` |
| `OPENROUTER_API_KEY` | unset on EC2 | set (not printed) |
| `OPENROUTER_BASE_URL` | unset | `https://openrouter.ai/api/v1` |
| `AI_MODEL_HEMAT` | unset | `google/gemini-2.5-flash` |
| `CREDIT_TOPUP_ENABLED` | `false` | `false` |
| `PAYMENT_PROVIDER` | `mock` | `mock` |
| `PAYMENT_PROVIDER_MOCK` | `true` | `true` |

**Deploy:** `scripts/operator-production-sync-env.ps1` — scp `.env.production` + `docker compose -f docker-compose.production.yml up -d --build`

---

## Health

**Before (10.27 audit):**

- `aiGenerationEnabled=false`
- `hasOpenRouterApiKey=false`
- `creditTopupEnabled=false`
- `paymentProvider=mock`

**After (2026-06-10):**

```json
{
  "appEnv": "production",
  "aiGenerationEnabled": true,
  "aiProviderMock": false,
  "hasOpenRouterApiKey": true,
  "creditTopupEnabled": false,
  "paymentProvider": "mock",
  "paymentProviderMock": true
}
```

---

## Credit seed

| Item | Value |
|---|---|
| **Founder email** | `moxsenna@gmail.com` |
| **User ID** | `abdc5016-ac92-4219-acea-85df829e4334` |
| **Method** | Supabase REST `credit_balances` upsert via service role (`source=admin_grant`) |
| **Amount** | 50 credits |
| **Payment used** | No |
| **Migration 00010** | Not required / not applied |

**Credit behavior on test:**

| Event | Balance |
|---|---|
| Start | 50 |
| First attempt (gemma default 404) | 45 → refunded → 50 |
| Successful generation | 50 → 45 (debit 5, no refund) |

---

## Generation test

| Item | Value |
|---|---|
| **Path** | Write room → prose beat AI (`qualityMode=hemat`) |
| **Project** | `c5a9f0fb-7f45-4c9f-b37f-4a2981adeba9` — *Perbaikan Cerita* (founder project from 10.26b) |
| **Session / beat** | `3fbf57a5-9937-4abb-a28c-77291a4c5251` / `6fbfff03-c9f0-4474-b189-928b5644a123` |
| **Result** | HTTP 201 — `generationAttempt.status=succeeded` |
| **Stub or real** | **Real LLM** — Indonesian prose about character Nadira (kitchen scene); not deterministic stub |
| **Version ID** | `9b1ef146-4b96-4747-b947-88ff89fa5f98` |
| **Prose length** | 1831 chars |
| **Persistence** | `source=ai_generated` version persisted |
| **Credit behavior** | 5 debited once; balance 45 after success |

**Operator note:** Project `workflow_phase` was `foundation` while outline plan was already `locked` (partial bootstrap from failed first run). Patched to `outline_locked` via service-role REST before write session. Follow-up: fix outline lock → workflow_phase transaction ([`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)).

---

## Payment / security

| Check | Result |
|---|---|
| Payment OFF | **PASS** — `creditTopupEnabled=false`, `paymentProvider=mock` |
| Migration 00010 prod | **NOT applied** |
| Duitku production vars | **Inactive** — health flags false |
| OpenRouter key in frontend | **None** |
| Service role exposed | **No** |
| `.env.production` committed | **No** |
| Staging API in prod bundle | **No hits** (dist check) |
| Staging API health | **PASS** Mode A |

---

## Regression

| Check | Result |
|---|---|
| `https://narraza.web.id` | **200** |
| `https://app.narraza.web.id` | **200** |
| `https://app.narraza.web.id/login` | **200** |
| Production API health | **PASS** |
| Staging API health | **PASS** |

---

## Rollback state

**AI remains ON** for founder testing after this task.

Rollback procedure (if needed):

```env
AI_GENERATION_ENABLED=false
AI_PROVIDER_MOCK=true
```

Then: `npm run operator:production:sync-env` or EC2 `docker compose -f docker-compose.production.yml up -d --build`

Verify: `GET https://api.narraza.web.id/api/health` → `aiGenerationEnabled=false`

Payment stays OFF regardless.

---

## Root cause — first failure

Default hemat model `google/gemma-2-9b-it` returns OpenRouter **404** (`No endpoints found`). Fixed by setting `AI_MODEL_HEMAT=google/gemini-2.5-flash` on EC2 (matches staging smoke [`docs/47`](47-live-openrouter-staging-smoke-report.md)).

---

## Files changed

| Path | Note |
|---|---|
| `.env.production.example` | Document `AI_MODEL_HEMAT` override |
| `scripts/task-10.28-founder-ai-test.ps1` | Operator founder credit seed + AI smoke |
| `scripts/task-10.28-openrouter-probe.ps1` | Model probe (no secrets printed) |
| `scripts/task-10.28-check-credits.ps1` | Credit/ledger verification |
| `scripts/task-10.28-check-project.ps1` | Project workflow diagnostic |
| `scripts/task-10.28-fix-workflow.ps1` | One-off workflow_phase repair |
| `docs/90-ai-founder-test-mode-report.md` | This report |
| `.agent-logs/sprint-10/task-10.28-ai-founder-test-mode.md` | Agent work log |

**Not committed:** `.env.production` (gitignored; synced to EC2 only)

---

## Docs updated

- `docs/90-ai-founder-test-mode-report.md` (this file)
- `README.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/63-updated-product-roadmap-after-sprint-11.md`
- `docs/87-real-private-beta-story-flow-report.md`
- `docs/88-founder-private-beta-story-smoke-report.md`
- `docs/89-full-repo-audit-vs-sprint-plan.md`
- `scripts/README.md`

---

## Remaining blockers

| Blocker | Severity |
|---|---|
| No founder-only AI gate in code — any authed user with credits can generate while AI ON | Medium — keep AI ON only for founder test window or add gate before public beta |
| Default `google/gemma-2-9b-it` broken on OpenRouter | Low — mitigated by `AI_MODEL_HEMAT` on EC2; code default should change in follow-up |
| Outline lock may not update `workflow_phase` atomically | Low — documented in docs/36 |
| Founder UI write-room AI button not re-smoked in browser | Low — API path verified |

---

## Next recommended task

1. ~~**10.29** — Founder browser E2E~~ — **DONE GO** [`docs/91-founder-browser-e2e`](91-founder-browser-e2e-story-workflow-report.md)
2. ~~**10.29** — Remove misleading mock flow~~ — **DONE GO** [`docs/91-mock-flow`](91-remove-misleading-mock-flow-report.md) — production authed flow uses locked/error states, not Sprint 1 fallback
2. **10.30** — Shell `CreditIndicator` → real API balance
3. Code change: update default hemat model to `google/gemini-2.5-flash` in `model-router.ts`
4. **Do not proceed** to payment / migration `00010` / Duitku production without separate founder approval