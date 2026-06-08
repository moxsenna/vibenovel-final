# Task 9.4b — WritePage Rewrite API-mode E2E Verification

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Close Task 9.4 verification gap by running API-mode rewrite E2E (success + disabled paths), web/API regressions, and restoring safe default API env.

## Files read

- `.agent-logs/sprint-9/task-9.4-write-page-rewrite-ui.md`
- `apps/web/e2e/sprint9-rewrite-flow.spec.ts`
- `scripts/sprint9-smoke-web.ps1`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/services/ai.ts`
- `apps/web/src/components/writer/WriterAssistantPanel.tsx`
- `apps/web/src/components/writer/WriterEditorPanel.tsx`
- `apps/api/src/routes/ai.ts`
- `scripts/sprint9-smoke-api.ps1`
- `README.md`
- `scripts/README.md`

## Files created/changed

| Path | Change |
|---|---|
| `scripts/sprint9-smoke-web.ps1` | Health step logs `aiGenerationEnabled` / `aiProviderMock` flags |
| `.agent-logs/sprint-9/task-9.4b-write-page-rewrite-api-mode-e2e.md` | This log |
| `.agent-logs/sprint-9/task-9.4-write-page-rewrite-ui.md` | Addendum — API-mode E2E verified |

**Not committed:** `apps/api/.dev.vars` (toggled locally only; restored to safe default).

## Environment used (no secrets)

| Phase | API | Web |
|---|---|---|
| Success E2E | `AI_GENERATION_ENABLED=true`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` | `VITE_USE_MOCKS=false` |
| Disabled E2E | `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` | `VITE_USE_MOCKS=false` |
| Final restore | `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` | unchanged (`VITE_USE_MOCKS=false`) |

Health after success run: `aiGenerationEnabled=true`, `aiProviderMock=true`.  
Health after restore: `aiGenerationEnabled=false`, `aiProviderMock=true`.

`dev:api` restarted after each env change. `dev:web` already running with `VITE_USE_MOCKS=false`.

## Commands run

| Command | Result |
|---|---|
| `npm run smoke:web:rewrite -- -IncludeApiMode` (AI enabled) | PASS — controls + rewrite mock success |
| `npm run smoke:web:rewrite -- -IncludeApiMode` (AI disabled) | PASS — controls + AI disabled safe message |
| `npm run smoke:web:write` | PASS |
| `npm run smoke:web:write-ai` | PASS |
| `npm run smoke:web:credit-ui` | PASS |
| `npm run smoke:web:rewrite` (mock only) | PASS |
| `npm run smoke:api:sprint9` | PASS (8 PASS, 10 NOT RUN — AI disabled) |
| `npm run smoke:api:sprint8` | PASS (8 PASS, 5 NOT RUN) |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS |
| `npm run smoke:api:sprint7` | PASS (53/53) |

## Results

### API-mode rewrite success (AI enabled)

- Bootstrap write room via smoke script: foundation locked → outline locked → credits seeded.
- Generate AI prose → editor contains mock beat prose (`Dia menahan napas`).
- Click **Perbaiki Teks** → editor updates to mock rewrite (`Versi yang lebih jernih`, `[mock-rewrite:…]`).
- Success notice: `Teks berhasil diperbaiki`, `Terpotong N kredit`, `Sisa: Y`.
- No DOM leak (prompt/packet/provider/estimated_cost_usd/generationAttempt).

### API-mode rewrite disabled (AI off)

- Rewrite controls visible with cost label.
- Save user prose → click **Perbaiki Teks** → safe message `AI generation belum aktif.`
- No DOM leak.

### Regressions

- Web mock smokes: all PASS.
- API sprint2/5/6/7/8/9: all PASS (AI success API steps NOT RUN at disabled default — expected).

## Decisions

- No product/UI changes required — existing E2E and smoke script sufficient.
- Script health step extended to surface AI flags for clearer success vs disabled runs.
- `.dev.vars` restored to safe default after verification; not staged for commit.

## Limitations

- API-mode E2E still requires local dual-env setup (`VITE_USE_MOCKS=false`, restart servers); not in CI.
- API sprint9 full mock-success API steps not re-run with AI enabled in this task (web E2E covered rewrite success).

## Next recommended task

**Task 9.5** — Publish copy AI API (`POST /ai/improve-publish-copy`).