# 47 — Live OpenRouter Staging Smoke Report

**Sprint:** Sprint 8 follow-up (Task 8.9 + **8.9b**)  
**Status:** **GO** (live provider verified 8.9b)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Plan:** [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)  
**Work logs:** `.agent-logs/sprint-8/task-8.9-live-openrouter-staging-smoke-execution.md`, `.agent-logs/sprint-8/task-8.9b-live-openrouter-staging-with-key.md`

---

## 1. Executive Summary

| Phase | Result |
|---|---|
| **Task 8.9** (no local key) | **NO-GO** — 0 live calls; see §2 |
| **Task 8.9b** (local key) | **GO** — 1 live success + idempotency; see §3–§13 |

### Task 8.9b final verdict: **GO**

Live OpenRouter prose beat generation verified end-to-end with local key. Staging model **`google/gemini-2.5-flash`** (hemat tier via `AI_MODEL_HEMAT`). Rollback and mock regression PASS.

| Area | Result |
|---|---|
| Preflight (no secret in git) | ✅ PASS |
| Live success (`qualityMode=hemat`) | ✅ PASS |
| Idempotency replay | ✅ PASS |
| Credit debit (5) | ✅ PASS |
| No canon mutation | ✅ PASS |
| Leak guard (forbidden fields) | ✅ PASS |
| Live failure + refund (wrong models) | ✅ OBSERVED (2 attempts, refunded) |
| Timeout observation | ⏭️ NOT RUN |
| Rollback | ✅ PASS |
| Mock regression | ✅ PASS (1st unsafe retry FAIL env line; 2nd PASS) |

---

## 2. Task 8.9 — Blocked Run (historical)

**NO-GO** — `OPENROUTER_API_KEY` not configured locally. Zero live provider calls. Pre-provider `AI_NOT_CONFIGURED` path verified (safe error + refund). Details preserved in git history of this doc and work log `task-8.9`.

---

## 3. Task 8.9b — Preflight

| Check | Result |
|---|---|
| `apps/api/.dev.vars` tracked | ❌ No — `.gitignore` |
| Key in repo/logs/docs | ❌ No |
| Health pre-live | `aiGenerationEnabled=true`, `aiProviderMock=false`, `hasOpenRouterApiKey=true` |
| Allowlist update | ✅ `google/gemini-flash-latest`, `google/gemini-2.0-flash-001`, `google/gemini-2.5-flash` added to `MODEL_ALLOWLIST` |

### Model resolution notes

| Model | OpenRouter availability (this account) |
|---|---|
| `google/gemini-flash-latest` | ❌ Not available on OpenRouter |
| `google/gemini-2.0-flash-001` | ❌ No endpoints (404) |
| `google/gemma-2-9b-it` | ❌ No endpoints (404) |
| **`google/gemini-2.5-flash`** | ✅ **200** — used for successful live smoke |

Env fix: removed erroneous `~` prefix on `AI_MODEL_HEMAT` (`~google/gemini-flash-latest` → invalid allowlist).

---

## 4. Staging Env (8.9b, no secrets)

| Variable | Live staging value | Rollback final |
|---|---|---|
| `AI_GENERATION_ENABLED` | `true` | `false` |
| `AI_PROVIDER_MOCK` | `false` | `true` |
| `OPENROUTER_API_KEY` | set locally (hidden) | set locally (hidden) |
| `AI_MODEL_HEMAT` | `google/gemini-2.5-flash` | unchanged |
| `AI_PROVIDER_MOCK_MODE` | n/a live | `success` |

---

## 5. Live Success Smoke

`POST /api/projects/:id/ai/generate-prose` — `qualityMode=hemat`

| Check | Result |
|---|---|
| HTTP 200 | ✅ |
| `generationAttempt.status` | `succeeded` |
| `provider` | `openrouter` |
| `model` | `google/gemini-2.5-flash` |
| `inputTokens` / `outputTokens` | `417` / `516` |
| `creditCost` | `5` |
| Balance | `50 → 45` |
| `version.source` | `ai_generated` |
| `outputEntityId` = version id | ✅ |
| No canon mutation | ✅ |
| No forbidden leak fields | ✅ (see §11) |

---

## 6. Idempotency Replay

Same `idempotencyKey` as §5:

| Check | Result |
|---|---|
| `idempotentReplay` | `true` |
| Second debit | ❌ None (balance stayed 45) |
| Duplicate prose version | ❌ None (prose count 1) |
| Second attempt row | ❌ None (`generation_attempts` count = 1) |
| Response safe | ✅ |

---

## 7. Failure / Refund

### Live provider failures (wrong/unavailable models)

Two pre-success attempts (`AI_PROVIDER_ERROR`) when models had no OpenRouter endpoints:

| Check | Result |
|---|---|
| Safe error code | ✅ `AI_PROVIDER_ERROR` |
| No raw provider body in API | ✅ |
| `generation_attempt.status` | `failed` |
| Credit refund | ✅ debit 5 + refund 5 (ledger) |
| No prose version | ✅ |

### Deliberate post-success provider failure

⏭️ **NOT RUN** — avoided extra cost after success; refund path already observed on failed live attempts.

### Timeout

⏭️ **NOT RUN** — `AI_TIMEOUT_MS` env not wired to active router timeout (quality-tier hardcoded).

---

## 8. Cost Observation

| Metric | Value |
|---|---|
| Billable live success calls | **1** |
| Failed live calls (refunded) | 2 |
| Idempotency replay provider call | 0 (expected) |
| Model (success) | `google/gemini-2.5-flash` |
| Tokens (success) | 417 in / 516 out |
| `estimated_cost_usd` | **null** (column not populated on success) |
| Approximate OpenRouter USD | Low (within `docs/46` daily cap ≤ USD 2.00) — verify on dashboard manually |

---

## 9. Rollback

| Step | Result |
|---|---|
| `AI_GENERATION_ENABLED=false` | ✅ |
| `AI_PROVIDER_MOCK=true` | ✅ |
| `AI_PROVIDER_MOCK_MODE=success` | ✅ |
| `dev:api` restarted | ✅ |
| Health `aiGenerationEnabled=false` | ✅ |
| Health `aiProviderMock=true` | ✅ |

---

## 10. Regression After Rollback

| Command | Result |
|---|---|
| `npm run smoke:api:sprint8` (baseline) | ✅ PASS |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | ✅ PASS |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | ⚠️ FAIL then ✅ PASS on retry (missing `AI_PROVIDER_MOCK_MODE` line in `.dev.vars` first run) |
| `npm run smoke:api` | ⏭️ NOT RUN |
| `npm run smoke:api:sprint5/6/7` | ⏭️ NOT RUN |

---

## 11. Leak / Security Verification

Forbidden patterns checked: `packet_json`, `planningTruth`, raw prompt fields, API key patterns.

| Check | Result |
|---|---|
| `provider=openrouter` in safe summary | ✅ Expected (not a leak) |
| No raw prompt / packet / planningTruth | ✅ |
| No API key in response/attempt metadata | ✅ |
| No raw provider body | ✅ |

Note: `scripts/sprint8-smoke-api.ps1` flags substring `openrouter` as forbidden — overly strict for live responses where `generationAttempt.provider` is intentional.

---

## 12. Go / No-Go Decision

### GO criteria (8.9b)

| Criterion | Met? |
|---|---|
| ≥ 1 live success | ✅ |
| Idempotency | ✅ |
| Credit debit correct | ✅ |
| No actual leaks | ✅ |
| No canon mutation | ✅ |
| Rollback | ✅ |
| Refund on live failure | ✅ (wrong-model attempts) |

### Verdict: **GO**

Limited staging cleared for proceeding with Sprint 9+ AI expansion planning. Production shared deploy still requires separate env/ops checklist (not done here).

---

## 13. Known Limitations

- `google/gemini-flash-latest` not available on OpenRouter despite allowlist entry.
- Staging hemat model for this account: **`google/gemini-2.5-flash`** (operator should confirm pricing).
- `estimated_cost_usd` not populated on success path.
- `AI_TIMEOUT_MS` not applied in router.
- Timeout smoke not run.
- Sprint 5–7 API regression not re-run.

---

## 14. Recommended Next Task

**Sprint 9 planning** — AI rewrite / publish copy / credit UI (per `docs/45`), or production Worker secret rollout with same model allowlist discipline.

---

## Related documents

- [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)
- [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md)
- [`apps/api/src/services/model-router.ts`](../apps/api/src/services/model-router.ts)