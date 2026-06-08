# 47 — Live OpenRouter Staging Smoke Report

**Sprint:** Sprint 8 follow-up (Task 8.9)  
**Status:** Executed — **NO-GO** (live provider blocked)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Plan:** [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)  
**Work log:** `.agent-logs/sprint-8/task-8.9-live-openrouter-staging-smoke-execution.md`

Laporan eksekusi manual staging OpenRouter. **Tidak ada live provider call** karena `OPENROUTER_API_KEY` tidak tersedia di lingkungan lokal (`.dev.vars`, User/Machine/Process env). Tidak ada secret yang di-commit atau dicetak.

---

## 1. Executive Summary

| Area | Result |
|---|---|
| Preflight (no secret in git) | ✅ PASS |
| Staging env configured (no key) | ✅ OBSERVED |
| Live OpenRouter success | ❌ **BLOCKED** — no API key |
| Idempotency (live) | ⏭️ NOT RUN |
| Live provider failure/refund | ⏭️ NOT RUN (provider never called) |
| Pre-provider `AI_NOT_CONFIGURED` | ✅ PASS — safe error + refund |
| Timeout observation | ⏭️ NOT RUN — `AI_TIMEOUT_MS` not wired to active router timeout |
| Rollback | ✅ PASS |
| Mock regression | ✅ PASS (baseline + fail_provider + unsafe_output) |
| **Go/No-Go** | **NO-GO** |

**Decision:** Live OpenRouter staging **not cleared** for feature expansion. Operator must set `OPENROUTER_API_KEY` locally (gitignored) and re-run live checklist §4–§6 from `docs/46` before Go.

---

## 2. Preflight Safety

| Check | Result |
|---|---|
| `git status` working tree | Clean before task (post–Task 8.8 commit) |
| `apps/api/.dev.vars` tracked | ❌ No — `.gitignore` rule `**/.dev.vars` |
| Key printed in terminal/docs | ❌ No |
| Key in work log | ❌ No |

Verified: `OPENROUTER_API_KEY` absent from `.dev.vars`, User env, Machine env, and process env.

---

## 3. Staging Env Used (no secrets)

Local `apps/api/.dev.vars` edited for staging probe (then restored to rollback).

| Variable | Staging probe value | Rollback final value |
|---|---|---|
| `AI_GENERATION_ENABLED` | `true` | `false` |
| `AI_PROVIDER_MOCK` | `false` | `true` |
| `OPENROUTER_API_KEY` | **not set** | **not set** |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | (unchanged / optional) |
| `AI_MODEL_HEMAT` | `google/gemma-2-9b-it` | (retained if present) |
| `AI_TIMEOUT_MS` | `30000` | (retained if present) |
| `AI_MAX_RETRIES` | `1` | (retained if present) |
| `AI_PROVIDER_MOCK_MODE` | n/a during live probe | `success` |

**Model intended for live:** `google/gemma-2-9b-it` (hemat tier, allowlisted).

**Health (staging probe, after `dev:api` restart):**

```json
{
  "aiGenerationEnabled": true,
  "aiProviderMock": false,
  "hasOpenRouterApiKey": false
}
```

**Health (rollback final):**

```json
{
  "aiGenerationEnabled": false,
  "aiProviderMock": true,
  "hasOpenRouterApiKey": false
}
```

---

## 4. Live Single Success Smoke

| Step | Result | Detail |
|---|---|---|
| Seed credit + bootstrap | ⏭️ NOT RUN for live | Blocked before provider call |
| `POST .../ai/generate-prose` (live) | ❌ **BLOCKED** | `hasOpenRouterApiKey=false` |
| `provider=openrouter` | ⏭️ NOT RUN | — |
| Token counts from provider | ⏭️ NOT RUN | — |
| Credit debit (hemat = 5) on live success | ⏭️ NOT RUN | — |
| `source=ai_generated` | ⏭️ NOT RUN | — |
| No leak / no canon mutation (live) | ⏭️ NOT RUN | — |

**Live OpenRouter attempts:** **0**  
**Approximate provider cost:** **USD 0.00** (within daily cap by default)

---

## 5. Idempotency Replay (live)

⏭️ **NOT RUN** — requires at least one live success attempt.

---

## 6. Failure / Refund Smoke

### 6a. Pre-provider `AI_NOT_CONFIGURED` (no key, safe, no provider cost)

Executed with staging flags (`AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=false`, no key).

| Check | Result |
|---|---|
| HTTP error code | `AI_NOT_CONFIGURED` |
| Error body safe (no prompt/packet/key) | ✅ |
| `generation_attempt.status` | `failed` |
| Credit refund (balance restored) | ✅ before=50 after=50 |
| No prose version created | ✅ versions=0 |
| Canon unchanged | ✅ facts count stable |
| `generation_attempts.metadata` safe | ✅ no packet/prompt/key patterns |

### 6b. Live provider failure after debit

⏭️ **NOT RUN** — provider never invoked.

### 6c. Invalid model env forcing provider error

⏭️ **NOT RUN** — invalid `AI_MODEL_HEMAT` is ignored by router; falls back to allowlisted default (code behavior per `model-router.ts`).

---

## 7. Timeout Observation

⏭️ **NOT RUN**

**Reason:** Active timeout is quality-tier hardcoded in `model-router.ts` (hemat 30s). `AI_TIMEOUT_MS` env is defined in `env.ts` but not applied to `ResolvedModelConfig.timeoutMs` in current code. Forcing `AI_TIMEOUT_MS=50` would not reliably trigger `AI_PROVIDER_TIMEOUT` without code change (out of scope Task 8.9).

---

## 8. Rollback

| Step | Result |
|---|---|
| `AI_GENERATION_ENABLED=false` | ✅ |
| `AI_PROVIDER_MOCK=true` | ✅ |
| `AI_PROVIDER_MOCK_MODE=success` | ✅ |
| `dev:api` restarted | ✅ |
| Health `aiGenerationEnabled=false` | ✅ |

---

## 9. Regression After Rollback

| Command | Result |
|---|---|
| `npm run smoke:api:sprint8` (baseline, AI disabled) | ✅ PASS (8/8 executed steps) |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | ✅ PASS (14/14, 4 skip) |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | ✅ PASS (14/14, 4 skip) |
| `npm run smoke:api` | ⏭️ NOT RUN |
| `npm run smoke:api:sprint5` | ⏭️ NOT RUN |
| `npm run smoke:api:sprint6` | ⏭️ NOT RUN |
| `npm run smoke:api:sprint7` | ⏭️ NOT RUN |

---

## 10. Cost Observation

| Metric | Value |
|---|---|
| Live OpenRouter calls | 0 |
| Approximate OpenRouter USD | 0.00 |
| Within `docs/46` daily cap (≤ USD 2.00) | ✅ N/A |
| `input_tokens` / `output_tokens` (live) | N/A |
| `estimated_cost_usd` on success | N/A — column not populated on success path (known gap) |
| App token tracking vs provider | N/A — no live usage |

---

## 11. Leak / Security Verification

| Check | Live | Pre-provider failure |
|---|---|---|
| No raw prompt in attempt metadata | N/A | ✅ |
| No `packet_json` | N/A | ✅ |
| No `planningTruth` | N/A | ✅ |
| No OpenRouter API key in response/logs | ✅ (health boolean only) | ✅ |
| No raw provider body | N/A | ✅ |
| Audit metadata safe | N/A | ✅ (attempt row only; no audit dump in this path) |

---

## 12. Canon Verification

| Table / area | Live | Pre-provider failure |
|---|---|---|
| facts | N/A | ✅ unchanged |
| characters | N/A | ✅ unchanged |
| relationship_speech_rules | N/A | ✅ unchanged |
| open_loops | N/A | ✅ unchanged |
| planned_reveals | N/A | ✅ unchanged |
| ai_proposals | N/A | ✅ unchanged |

---

## 13. Go / No-Go Decision

### Criteria from `docs/46`

| Go criterion | Met? |
|---|---|
| ≥ 1 live success | ❌ |
| No leaks | ✅ (limited paths tested) |
| Credit debit correct (live) | ❌ N/A |
| No double debit (live replay) | ❌ N/A |
| Rollback works | ✅ |
| Cost sane | ✅ (zero spend) |
| No canon mutation | ✅ (tested paths) |

### Verdict: **NO-GO**

Live OpenRouter provider behavior remains **unverified**. Mock regression and pre-provider guard paths remain healthy.

**Partial credit:** `AI_NOT_CONFIGURED` path demonstrates safe error + refund + no prose + no canon mutation when key missing — but this is **not** a substitute for live provider verification.

### Unblock checklist (operator)

1. Set `OPENROUTER_API_KEY` in `apps/api/.dev.vars` only (never commit).
2. Apply staging vars from `docs/46` §3.
3. Restart `dev:api`.
4. Confirm health: `hasOpenRouterApiKey=true`, `aiProviderMock=false`.
5. Run live checklist §6B–§6C (success + idempotency + one controlled failure).
6. Update this report or create Task 8.9b follow-up with results.

---

## 14. Known Limitations

- No live OpenRouter call — primary Task 8.9 objective blocked by missing local key.
- `estimated_cost_usd` not populated on success (observability gap).
- `AI_TIMEOUT_MS` env not wired to router timeout (timeout smoke not meaningful without code change).
- Invalid model env override does not force provider error (non-allowlisted env values ignored).
- Sprint 5–7 API regression not re-run (time scope).
- `.dev.vars` modified locally only; not in git.

---

## 15. Recommended Next Task

**Task 8.9b — Live OpenRouter Staging Smoke Re-run** (operator sets key locally, executes `docs/46` §6 live sections, updates Go/No-Go).

Until **Go:** defer Sprint 9 AI expansion (rewrite, publish copy, summary/delta, credit UI).

---

## Related documents

- [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)
- [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)