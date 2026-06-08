# Task 9.6 — PublishPage AI UI

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Wire PublishPage to `POST /api/projects/:id/ai/improve-publish-copy` with suggestion-first UI: field picker, **Buat Saran Copy**, display suggestions, user **Terapkan** via existing `PATCH .../publish/:packageId/fields`. No auto-apply, no new API endpoints, no mock fake success.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `.agent-logs/sprint-9/task-9.5-publish-copy-ai-api.md`
- `.agent-logs/sprint-9/task-9.4-write-page-rewrite-ui.md`
- `apps/api/README.md`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/publish-copy-ai-generation.ts`
- `apps/api/src/services/publish-copy-ai-prompt.ts`
- `apps/api/src/services/publish-package-update.ts`
- `apps/web/src/pages/PublishPage.tsx`
- `apps/web/src/hooks/usePublishData.ts`
- `apps/web/src/services/publish.ts`
- `apps/web/src/services/ai.ts`
- `apps/web/src/lib/publish-mappers.ts`
- `apps/web/src/components/publish/PublishWorkflowActions.tsx`
- `apps/web/src/components/publish/PublishEditableField.tsx`
- `apps/web/e2e/sprint7-publish-flow.spec.ts`
- `scripts/sprint7-smoke-web.ps1`
- `scripts/sprint9-smoke-web.ps1`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/web/src/services/ai.ts` | `improvePublishCopy`, publish copy costs/labels, error mapping, idempotency helper |
| `apps/web/src/hooks/usePublishData.ts` | AI copy state, credit balance, improve/apply/dismiss actions |
| `apps/web/src/components/publish/PublishAiCopyPanel.tsx` | **Created** — field checkboxes, instruction, suggestions cards, Terapkan/Abaikan |
| `apps/web/src/components/publish/index.ts` | Export panel |
| `apps/web/src/pages/PublishPage.tsx` | Wire `PublishAiCopyPanel` |
| `apps/web/e2e/sprint9-publish-ai-flow.spec.ts` | **Created** — mock hidden + API mode tests |
| `scripts/sprint9-smoke-web.ps1` | Publish AI mock + API mode blocks, `Bootstrap-ApprovedSummary`, `-PublishAiOnly` |
| `package.json` | `smoke:web:publish-ai` alias |
| `apps/web/.env.example` | Task 9.6 note |
| `README.md`, `docs/36`, `docs/48`, `scripts/README.md` | Task 9.6 documented |
| `.agent-logs/sprint-9/task-9.6-publish-page-ai-ui.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint9` | PASS (10 PASS, 11 NOT RUN — AI disabled default) |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS (68/68) |
| `npm run smoke:api:sprint7` | PASS (53/53) |
| `npm run smoke:api:sprint8` | PASS (8 PASS, 5 NOT RUN) |
| `npm run smoke:web:publish` | PASS (mock) |
| `npm run smoke:web:publish-ai` | PASS (mock) |
| `npm run smoke:web:rewrite` | PASS (mock) |
| `npm run smoke:web:credit-ui` | PASS (mock) |
| `npm run smoke:web:sprint9 -- -IncludeApiMode` | NOT RUN — requires `VITE_USE_MOCKS=false`, restart `dev:web`, optional `AI_GENERATION_ENABLED=true` for success path |

## Results

- PublishPage shows **Perbaiki Copy dengan AI** panel in API mode when package exists.
- Mock/fallback shows explanation only — no fake suggestions, no **Buat Saran Copy** button.
- Suggestions stored in hook state; package fields unchanged until **Terapkan** (PATCH fields).
- Credit cost 3/6/12 from project quality mode; insufficient known balance disables button.
- Sprint 7 publish mock smoke still PASS with new panel message.
- API-mode publish AI E2E (disabled + success) deferred to `-IncludeApiMode` (same pattern as rewrite 9.4b).

## Decisions

1. **Suggestion-first:** `improvePublishCopyWithAi` only updates `publishCopySuggestions` state; apply paths call existing `updatePublishPackageFields`.
2. **Apply single vs all:** Single field PATCH per Terapkan; Terapkan Semua merges patches into one PATCH.
3. **Exported lock:** Panel shows readonly message; improve/apply disabled.
4. **Credit:** Reuse `fetchCreditBalance` + project settings `qualityMode` (same as WritePage).
5. **Audit:** No UI exposure of `generationAttempt` internals — only cost/balance in notice.
6. **E2E:** `sprint9-publish-ai-flow.spec.ts` with mock + API branches; smoke script bootstraps approved summary for API publish tests.

## Limitations

- API-mode publish AI success E2E not run in this session (needs dual env + AI mock restart).
- No topup/payment UI.
- Quality mode read-only from settings (no picker on PublishPage).
- Suggestions cleared per-field on apply; dismiss removes without PATCH.

## Next recommended task

**Task 9.7** — Sprint 9 safety regression (full API + web smoke matrix, optional API-mode publish AI E2E verification).