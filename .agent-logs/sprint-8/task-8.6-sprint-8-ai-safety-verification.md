# Task 8.6 — Sprint 8 Safety & Verification

**Date:** 8 Juni 2026  
**Status:** Complete

---

## Task goal

Close Sprint 8 AI prose generation verification: API smoke success/fail/unsafe, WritePage AI browser success + disabled paths, leak/credit/canon guards, regression Sprint 2/5/6/7, smoke consolidation, docs. No new product features.

---

## Files read

- `README.md`, `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `.agent-logs/sprint-8/task-8.4-prose-beat-generation-api.md`, `task-8.5-write-page-ai-button.md`
- `apps/api/README.md`, `apps/api/src/routes/ai.ts`, `prose-beat-generation.ts`, `generation-attempt.ts`, `credit-ledger.ts`, `model-router.ts`
- `apps/web/src/pages/WritePage.tsx`, `useWriteRoomData.ts`, `e2e/sprint8-write-ai-flow.spec.ts`
- `scripts/sprint8-smoke-api.ps1`, `sprint8-smoke-web.ps1`, `smoke-all-local.ps1`, `scripts/README.md`
- `.agents/rules/09-agent-work-logs.md`

---

## Files created/changed

| Path | Change |
|---|---|
| `scripts/smoke-all-local.ps1` | Added Sprint 8 API baseline (phase 5) + write-AI web mock (phase 11); 11 phases total |
| `README.md` | Sprint 8.6 status, smoke:all:local 11 phases |
| `scripts/README.md` | Phase table, Task 8.6 manual verification matrix |
| `apps/api/README.md` | Sprint 8 smoke mode table |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Sprint 8 verification + smoke-all-local debt addressed |
| `apps/api/.dev.vars` (gitignored) | Toggled during verification; restored to AI disabled default |

No application source changes — verification + docs only.

---

## Commands run

```bash
npm run typecheck
npm run build:shared
npm run build:web
npm run build:api
npm run smoke:api
npm run smoke:api:sprint5
npm run smoke:api:sprint6
npm run smoke:api:sprint7
# AI enabled + dev:api restart (success mode)
npm run smoke:api:sprint8
# AI_PROVIDER_MOCK_MODE=fail_provider + dev:api restart
npm run smoke:api:sprint8 -- -MockMode fail_provider
# AI_PROVIDER_MOCK_MODE=unsafe_output + dev:api restart
npm run smoke:api:sprint8 -- -MockMode unsafe_output
npm run smoke:web:write
npm run smoke:web:write-ai
# AI enabled + dev:api restart (success mode)
npm run smoke:web:write-ai -- -IncludeApiMode   # success E2E
# AI disabled + dev:api restart
npm run smoke:web:write-ai -- -IncludeApiMode   # disabled E2E
```

---

## Results

| Command | Result | Notes |
|---|---|---|
| typecheck | PASS | shared + web + api |
| build:shared / web / api | PASS | |
| smoke:api | PASS | 17/17 |
| smoke:api:sprint5 | PASS | 49/49 |
| smoke:api:sprint6 | PASS | 68/68 |
| smoke:api:sprint7 | PASS | 53/53 |
| smoke:api:sprint8 (success) | PASS | 18 PASS — debit, idempotency, leak, canon, audits |
| smoke:api:sprint8 fail_provider | PASS | 14 PASS — refund, no prose, canon |
| smoke:api:sprint8 unsafe_output | PASS | 14 PASS — refund, no prose, canon |
| smoke:web:write | PASS | mock |
| smoke:web:write-ai | PASS | mock — AI inactive |
| smoke:web:write-ai -IncludeApiMode (AI on) | PASS | mock prose in editor, credit notice, no DOM leak |
| smoke:web:write-ai -IncludeApiMode (AI off) | PASS | AI_DISABLED safe message, no leak |

---

## API smoke coverage

| Area | Verified |
|---|---|
| Auth gate | 401 no token |
| AI disabled | 503 AI_DISABLED (baseline with env off) |
| Insufficient credit | 402 before provider |
| Success | ai_generated prose, single debit (hemat=5), idempotent replay |
| fail_provider | AI_PROVIDER_ERROR, refund, no new prose version |
| unsafe_output | AI_OUTPUT_UNSAFE, refund, no prose |
| Leak guards | No packet_json/planningTruth/prompt in response or audit metadata |
| Canon | facts/characters/speech/open-loops/reveals/proposals unchanged |
| Client model reject | BAD_REQUEST |

---

## WritePage E2E coverage

| Mode | Result |
|---|---|
| Mock | Button disabled, explanation shown, no leak |
| API + AI enabled | Generate beats → click AI → mock prose in editor → success notice → no leak |
| API + AI disabled | Click AI → "AI generation belum aktif." → no leak |

Success path run with: `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success`, `VITE_USE_MOCKS=false`.

---

## Decisions

1. **smoke:all:local** — Sprint 8 API baseline + write-AI web mock only (stable with `AI_GENERATION_ENABLED=false`). Full mock success/fail/unsafe remain manual with env restart.
2. **Web E2E** — Success and disabled paths verified in separate runs (mutually exclusive by design in `sprint8-smoke-web.ps1`).
3. **No live OpenRouter** — All AI paths used mock provider only.

---

## Env final state (restored)

`apps/api/.dev.vars` (gitignored, not committed):

- `AI_GENERATION_ENABLED=false`
- `AI_PROVIDER_MOCK=true`
- `AI_PROVIDER_MOCK_MODE=success`

Confirmed via `GET /api/health`: `aiGenerationEnabled=false`.

---

## Limitations

- Live OpenRouter not tested (by design).
- `smoke:all:local:full` does not auto-enable AI for WritePage success E2E.
- Sprint 8 full mock matrix requires manual `dev:api` restart between modes.
- API-mode web E2E not in GitHub Actions.

---

## Next recommended task

**Task 8.7** — Sprint 8 verification report (`docs/45`) and sprint closure sign-off.