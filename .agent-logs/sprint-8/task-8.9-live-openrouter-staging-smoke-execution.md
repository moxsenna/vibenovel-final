# Task 8.9 — Live OpenRouter Staging Smoke Execution

**Date:** 8 Juni 2026  
**Status:** Complete — **NO-GO** (live provider blocked)

---

## Task goal

Execute `docs/46` live staging plan manually: live generate-prose, credit/attempt lifecycle, idempotency, failure/refund, rollback, regression. Document results in `docs/47`. No secrets in repo/logs.

---

## Files read

- `README.md`, `docs/46`, `docs/45`, `docs/44`, `docs/36`
- `apps/api/README.md`, `apps/api/.dev.vars.example`
- `apps/api/src/services/model-router.ts`, `openrouter-client.ts`, `prose-beat-generation.ts`, `credit-ledger.ts`, `generation-attempt.ts`
- `scripts/sprint8-smoke-api.ps1`
- `.agents/rules/09-agent-work-logs.md`

---

## Files created/changed

| Path | Change |
|---|---|
| `docs/47-live-openrouter-staging-smoke-report.md` | **Created** — execution report, NO-GO |
| `.agent-logs/sprint-8/task-8.9-live-openrouter-staging-smoke-execution.md` | **Created** — this log |
| `README.md` | Task 8.9 status + link docs/47 |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Live OpenRouter execution status |
| `docs/45-sprint-8-verification-report.md` | Link docs/47 |
| `apps/api/.dev.vars` | **Local only** — staging probe + rollback (gitignored, not committed) |

---

## Commands run

```powershell
# Preflight
git status
git check-ignore -v apps/api/.dev.vars

# Staging health (no OPENROUTER_API_KEY)
# dev:api restart + GET /api/health

# Pre-provider AI_NOT_CONFIGURED manual sequence (PowerShell, no secrets in output)

# Rollback dev.vars + dev:api restart + health

npm run smoke:api:sprint8                                    # PASS baseline (post-rollback)
npm run smoke:api:sprint8 -- -MockMode fail_provider         # PASS
npm run smoke:api:sprint8 -- -MockMode unsafe_output         # PASS

# NOT RUN
npm run smoke:api
npm run smoke:api:sprint5
npm run smoke:api:sprint6
npm run smoke:api:sprint7
```

---

## Results

| Deliverable | Result |
|---|---|
| Preflight — `.dev.vars` not tracked | ✅ |
| No key in output/docs | ✅ |
| Live OpenRouter success | ❌ BLOCKED — no local key |
| Staging health flags (no key) | ✅ aiEnabled=true mock=false hasKey=false |
| AI_NOT_CONFIGURED + refund | ✅ safe error, balance 50→50, attempt failed, no prose |
| Idempotency live | ⏭️ NOT RUN |
| Live provider failure/refund | ⏭️ NOT RUN |
| Timeout smoke | ⏭️ NOT RUN (env not wired) |
| Rollback health | ✅ aiEnabled=false mock=true |
| Regression sprint8 ×3 | ✅ PASS |
| `docs/47` created | ✅ |
| Go/No-Go | **NO-GO** |

---

## Decisions

1. **NO-GO** — cannot claim live OpenRouter verified without key.
2. Documented **AI_NOT_CONFIGURED** pre-provider path as partial safety evidence only.
3. Did not commit `.dev.vars` or write API key anywhere.
4. Recommended **Task 8.9b** re-run after operator sets key locally.

---

## Limitations

- Zero live provider calls; zero OpenRouter spend.
- Sprint 5–7 API smokes not re-run.
- No code changes (router/credit/UI untouched).

---

## Next recommended task

**Task 8.9b** — Re-run live staging smoke after `OPENROUTER_API_KEY` set locally; update Go/No-Go in `docs/47` or successor report.