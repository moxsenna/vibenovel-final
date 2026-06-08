# Task 8.8 — Live OpenRouter Staging Verification Plan

**Date:** 8 Juni 2026  
**Status:** Complete (plan only — live OpenRouter **not** executed)

---

## Task goal

Docs-only staging verification plan for real OpenRouter provider before new AI features. Cover key handling, budget cap, model allowlist, timeout/retry observation, token/cost observation, limited live smoke design, rollback, and Go/No-Go criteria. No code changes, no live calls, no secrets in repo.

---

## Files read

- `README.md`
- `docs/45-sprint-8-verification-report.md`
- `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `apps/api/src/services/model-router.ts`
- `apps/api/src/services/openrouter-client.ts`
- `apps/api/src/services/mock-ai-provider.ts`
- `apps/api/src/services/prose-beat-generation.ts`
- `apps/api/src/services/generation-attempt.ts`
- `apps/api/src/services/ai-credit-policy.ts`
- `apps/api/src/env.ts`
- `apps/api/.dev.vars.example`
- `scripts/sprint8-smoke-api.ps1`
- `scripts/sprint8-smoke-web.ps1`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-8/task-8.0` … `task-8.7`

---

## Files created/changed

| Path | Change |
|---|---|
| `docs/46-live-openrouter-staging-verification-plan.md` | **Created** — full staging verification plan (13 sections) |
| `.agent-logs/sprint-8/task-8.8-live-openrouter-staging-verification-plan.md` | **Created** — this work log |
| `README.md` | Task 8.8 row + link docs/46; next task 8.9 |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Plan complete; next execution 8.9 |
| `docs/45-sprint-8-verification-report.md` | §14 link to docs/46 |

---

## Commands run

Task 8.8 is docs-only. No build, no smoke, no live OpenRouter:

```powershell
# tidak dijalankan — tidak ada perubahan kode; README/docs only
```

---

## Results

| Deliverable | Result |
|---|---|
| `docs/46` created with 13 required sections | ✅ |
| Work log created | ✅ |
| README updated (8.8 + docs/46 + next 8.9) | ✅ |
| docs/36 updated | ✅ |
| docs/45 §14 next-link to docs/46 | ✅ |
| Live OpenRouter tested | ❌ **Not run** (by design) |
| Secrets committed | ❌ None |

---

## Decisions

1. **Staging first tier:** Recommend `hemat` / `google/gemma-2-9b-it` for initial live calls (lowest cost).
2. **Model final:** Placeholder + manual operator checklist before Task 8.9 (per user requirement).
3. **`estimated_cost_usd`:** Documented as currently **not populated** on success — compare OpenRouter dashboard manually in 8.9.
4. **`AI_TIMEOUT_MS` env:** Documented as defined but quality-tier timeouts in `model-router.ts` are what apply today — observe, do not change router in 8.8.
5. **No automated live smoke script** in this task — execution deferred to Task 8.9.
6. **Daily budget cap:** USD 2.00 suggested for local staging session.

---

## Limitations

- Plan only; no empirical latency/cost/retry data.
- `sprint8-smoke-api.ps1` remains mock-only; live steps are manual checklist in docs/46 §11.
- No Worker secret setup documented for remote staging (out of scope: no remote deploy).
- Rewrite/publish/summary AI, topup, router/credit code changes explicitly excluded.

---

## Next recommended task

**Task 8.9** — Live OpenRouter Staging Smoke Execution: run manual checklist, record results, apply Go/No-Go.