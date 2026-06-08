# Task 9.4 — WritePage Rewrite UI

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Wire WritePage to `POST /api/projects/:id/ai/rewrite-prose` with mode picker, credit cost display, loading/error/success states, and editor update on success. No new API endpoints, migrations, publish AI, or topup.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `.agent-logs/sprint-9/task-9.3-prose-rewrite-api.md`
- `.agent-logs/sprint-9/task-9.2-credit-ui-minimal.md`
- `apps/api/README.md`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/prose-rewrite-generation.ts`
- `apps/api/src/services/prose-rewrite-prompt.ts`
- `apps/web/src/pages/WritePage.tsx`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/services/ai.ts`
- `apps/web/src/services/write.ts`
- `apps/web/src/components/writer/WriterAssistantPanel.tsx`
- `apps/web/src/components/writer/WriterEditorPanel.tsx`
- `apps/web/src/components/writer/WriterMobileLayout.tsx`
- `apps/web/e2e/sprint8-write-ai-flow.spec.ts`
- `scripts/sprint8-smoke-web.ps1`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/web/src/services/ai.ts` | `rewriteBeatProse`, rewrite modes/labels, error mapping, cost labels |
| `apps/web/src/hooks/useWriteRoomData.ts` | Rewrite state, `rewriteActiveBeatProse`, credit guards, prose version tracking |
| `apps/web/src/components/writer/WriterAssistantPanel.tsx` | Perbaiki Teks dengan AI section — mode select, custom instruction, cost, button |
| `apps/web/src/components/writer/WriterEditorPanel.tsx` | Rewrite status in editor header |
| `apps/web/src/components/writer/WriterMobileLayout.tsx` | Compact Perbaiki button + mode caption |
| `apps/web/src/pages/WritePage.tsx` | Wire rewrite props to panels |
| `apps/web/e2e/sprint9-rewrite-flow.spec.ts` | **Created** — mock hidden + API mode tests |
| `scripts/sprint9-smoke-web.ps1` | Extended — credit UI + rewrite mock + optional API mode |
| `package.json` | `smoke:web:rewrite`, `smoke:web:sprint9` aliases |
| `scripts/README.md` | Document rewrite smokes |
| `README.md` | Task 9.4 ✅ |
| `docs/36`, `docs/48` | Task 9.4 addressed |
| `apps/web/.env.example` | Rewrite UI note |
| `.agent-logs/sprint-9/task-9.4-write-page-rewrite-ui.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint9` | PASS (8 PASS, 10 NOT RUN — AI disabled default) |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS |
| `npm run smoke:api:sprint7` | PASS (53/53) |
| `npm run smoke:api:sprint8` | PASS (8 PASS, 5 NOT RUN) |
| `npm run smoke:web:write` | PASS |
| `npm run smoke:web:write-ai` | PASS (mock) |
| `npm run smoke:web:credit-ui` | PASS (mock credit + rewrite hidden) |
| `npm run smoke:web:rewrite` | PASS (same as credit-ui script) |
| `npm run smoke:web:sprint9` | not run separately (alias identical to rewrite) |
| API-mode rewrite E2E (`-IncludeApiMode`) | NOT RUN — requires `VITE_USE_MOCKS=false`, restart `dev:web`, optional `AI_GENERATION_ENABLED=true` |

## Results

- WritePage rewrite UI active in API mode; mock/fallback shows unavailable explanation only.
- Success updates editor with new `proseVersion.proseText` and credit notice.
- Rewrite costs 3/6/12 displayed via existing Task 9.2 helpers.
- No prompt/packet/provider/estimated_cost_usd leak in E2E assertions.
- Generate AI flow unchanged; all regression smokes PASS.

## Decisions

- Reuse `ai_generated` source from API (Task 9.3); no `ai_rewrite` migration.
- `rewriteCanRun` separate from `aiCanGenerate` for independent credit guards.
- Assistant panel shows rewrite section with unavailable reason in mock/fallback instead of fake success.
- Mobile uses shared `rewriteMode` from hook (default `improve_emotion`) with compact button.
- API-mode rewrite E2E deferred to `-IncludeApiMode` (same pattern as Sprint 8 write-ai).

## Addendum (Task 9.4b — 2026-06-08)

API-mode rewrite E2E verified — see `.agent-logs/sprint-9/task-9.4b-write-page-rewrite-api-mode-e2e.md`.

| Check | Result |
|---|---|
| `smoke:web:rewrite -- -IncludeApiMode` (AI enabled) | PASS — rewrite success + credit notice |
| `smoke:web:rewrite -- -IncludeApiMode` (AI disabled) | PASS — safe `AI generation belum aktif` |
| Web + API regressions | PASS |
| Env restored `AI_GENERATION_ENABLED=false` | PASS |

**Task 9.4 approval:** implementation + API-mode E2E complete.

## Limitations

- ~~API-mode rewrite success E2E not executed in this session (env switch not applied).~~ **Resolved Task 9.4b.**
- No topup/payment; insufficient balance disables client-side only until server `402`.
- Custom instruction max 500 chars enforced in UI; server also validates.
- `WriterEditorPanel` shows status text only — main controls remain in assistant panel.

## Next recommended task

**Task 9.5** — Publish copy AI API (`POST /ai/improve-publish-copy`).