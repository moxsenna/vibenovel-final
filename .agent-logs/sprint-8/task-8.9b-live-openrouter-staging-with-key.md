# Task 8.9b — Live OpenRouter Staging Smoke Execution (with Local Key)

**Date:** 8 Juni 2026  
**Status:** Complete — **GO**

---

## Task goal

Re-run `docs/46` live staging with local `OPENROUTER_API_KEY`. Verify live generate-prose, idempotency, credit debit, safety, rollback, regression. Update `docs/47`.

---

## Files read

- `docs/46`, `docs/47`, `docs/45`, `README.md`, `apps/api/README.md`
- `apps/api/src/services/model-router.ts`, `openrouter-client.ts`, `prose-beat-generation.ts`
- `scripts/sprint8-smoke-api.ps1`

---

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/model-router.ts` | Allowlist: `gemini-flash-latest`, `gemini-2.0-flash-001`, `gemini-2.5-flash` |
| `apps/api/.dev.vars.example` | Comment examples for new hemat models |
| `docs/47-live-openrouter-staging-smoke-report.md` | Updated — Task 8.9b **GO** |
| `.agent-logs/sprint-8/task-8.9b-live-openrouter-staging-with-key.md` | This log |
| `README.md`, `docs/36`, `docs/45` | Status updates |
| `apps/api/.dev.vars` | Local only — model fix, live/rollback (gitignored) |

---

## Commands run

```powershell
git status
git check-ignore -v apps/api/.dev.vars
Invoke-RestMethod http://127.0.0.1:8787/api/health
# Live smoke manual PowerShell (bootstrap + generate-prose + idempotency)
# OpenRouter direct model probe (no key printed)
npm run smoke:api:sprint8
npm run smoke:api:sprint8 -- -MockMode fail_provider
npm run smoke:api:sprint8 -- -MockMode unsafe_output  # FAIL then PASS retry
# NOT RUN: smoke:api, sprint5/6/7
```

---

## Results

| Deliverable | Result |
|---|---|
| Live success openrouter | ✅ `google/gemini-2.5-flash` |
| Idempotency | ✅ |
| Credit debit 5 | ✅ 50→45 |
| Failed model attempts + refund | ✅ (2 pre-success) |
| Canon unchanged | ✅ |
| Leak guard (forbidden fields) | ✅ |
| Rollback health | ✅ aiEnabled=false mock=true |
| Regression sprint8 ×3 | ✅ (unsafe 1st fail env line) |
| Go/No-Go | **GO** |

---

## Decisions

1. `google/gemini-flash-latest` unavailable on OpenRouter — kept in allowlist but staging uses `gemini-2.5-flash`.
2. Removed `~` prefix from `AI_MODEL_HEMAT` in local `.dev.vars`.
3. No secrets committed or logged.

---

## Limitations

Timeout not tested; `estimated_cost_usd` null; sprint5–7 not run.

---

## Next recommended task

Sprint 9 AI feature planning (rewrite / publish copy / credit UI).