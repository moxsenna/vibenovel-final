# Task 9.2 — Credit UI Minimal

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Display credit balance and AI action cost minimally on WritePage (API mode). Read-only client guard; no topup/payment; no billing changes.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `.agent-logs/sprint-9/task-9.1-ai-cost-estimation-generation-attempt-metadata.md`
- `apps/web/src/pages/WritePage.tsx`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/services/ai.ts`
- `apps/web/src/services/credits.ts`
- `apps/web/src/components/writer/WriterAssistantPanel.tsx`
- `apps/web/src/components/writer/WriterEditorPanel.tsx`
- `apps/web/src/components/writer/WriterMobileLayout.tsx`
- `apps/web/src/components/settings/SettingsCreditCard.tsx`
- `apps/web/src/hooks/useSettingsData.ts`
- `apps/api/src/routes/credits.ts` (via grep — existing `GET /api/credits/balance`)
- `apps/api/src/services/ai-credit-policy.ts` (cost mirror reference)
- `scripts/sprint8-smoke-web.ps1`
- `apps/web/e2e/sprint8-write-ai-flow.spec.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/web/src/services/ai.ts` | `getProseRewriteCreditCost`, quality/cost label helpers |
| `apps/web/src/hooks/useWriteRoomData.ts` | Credit state, refresh, insufficient guard, success notice |
| `apps/web/src/components/writer/WriterAssistantPanel.tsx` | Saldo kredit card, cost/mode display |
| `apps/web/src/components/writer/WriterMobileLayout.tsx` | Mobile saldo/biaya caption, disable AI if insufficient |
| `apps/web/src/pages/WritePage.tsx` | Wire credit props |
| `apps/web/e2e/sprint8-write-ai-flow.spec.ts` | Credit UI + leak assertions (API mode tests) |
| `apps/web/e2e/sprint9-credit-ui.spec.ts` | **Created** — mock credit card hidden |
| `scripts/sprint9-smoke-web.ps1` | **Created** |
| `scripts/sprint8-smoke-web.ps1` | API-mode credit UI playwright step |
| `package.json` | `smoke:web:credit-ui` alias |
| `scripts/README.md` | Document new smoke |
| `README.md` | Task 9.2 ✅ |
| `docs/36`, `docs/48` | Task 9.2 addressed |
| `.agent-logs/sprint-9/task-9.2-credit-ui-minimal.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `git commit --amend -m "feat(api): populate estimated cost on ai generation success"` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:web:write` | PASS |
| `npm run smoke:web:write-ai` | PASS (mock) |
| `npm run smoke:web:credit-ui` | PASS |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 68/68 |
| `npm run smoke:api:sprint7` | FAIL 11/4 — API disconnected mid-run (env) |
| `npm run smoke:api:sprint7` (retry) | FAIL — Docker/Supabase not running |
| `npm run smoke:api:sprint8` (retry) | FAIL — Docker/Supabase not running |
| `npm run smoke:web:write-ai -- -IncludeApiMode` | NOT RUN — Docker down; mock path verified |
| Insufficient credit E2E | NOT RUN — deferred; client guard implemented |

## Results

- WritePage API mode shows **Saldo Kredit** card with balance, quality mode, action cost, estimated remaining.
- **Tulis Beat dengan AI** disabled when known balance &lt; cost; server remains authoritative on stale/null balance.
- Success notice: `Terpotong N kredit. Sisa: M.`
- Mock/fallback: no credit card (`showCreditUi` only when `source === "api"`).
- No topup button; copy: "Top up belum tersedia di versi ini."
- Rewrite disabled buttons show future cost label only.
- No `estimated_cost_usd`, ledger, provider, or prompt in UI.

## Decisions

1. **Reuse `fetchCreditBalance`** — no new endpoint.
2. **Client guard only when balance known** — fetch failure does not block AI; shows `Saldo kredit belum bisa dimuat.`
3. **Mock provider cost = 0** unchanged from 9.1; not shown in UI.
4. **Settings/Dashboard** — already wired via `useSettingsData`/`useDashboardData`; no scope expansion.
5. **Insufficient credit E2E** — manual/API smoke only; client precheck + server 402 path exists.

## Limitations

- API-mode Playwright credit UI test requires `-IncludeApiMode` + Docker + dual dev servers — not run this session.
- Sprint 7/8 API regression retry blocked when Docker Desktop stopped.
- `estimated_cost_usd` not exposed to user (by design).
- No topup/payment.

## Next recommended task

**Task 9.3** — Prose Rewrite API (`POST /api/projects/:id/ai/rewrite-prose`).