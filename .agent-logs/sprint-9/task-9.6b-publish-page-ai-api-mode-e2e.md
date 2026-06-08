# Task 9.6b — PublishPage AI API-mode E2E Verification

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Close the verification gap from Task 9.6: run API-mode PublishPage AI E2E to prove **Perbaiki Copy dengan AI** calls `POST /api/projects/:id/ai/improve-publish-copy`, shows suggestions without auto-apply, and applies via existing `PATCH .../publish/:packageId/fields`. No new features.

## Files read

- `.agent-logs/sprint-9/task-9.6-publish-page-ai-ui.md`
- `apps/web/e2e/sprint9-publish-ai-flow.spec.ts`
- `scripts/sprint9-smoke-web.ps1`
- `apps/web/src/hooks/usePublishData.ts`
- `apps/web/src/services/ai.ts`
- `apps/web/src/components/publish/PublishAiCopyPanel.tsx`
- `apps/web/src/pages/PublishPage.tsx`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/publish-copy-ai-generation.ts`
- `scripts/sprint9-smoke-api.ps1`
- `README.md`
- `scripts/README.md`

## Files created/changed

| Path | Change |
|---|---|
| `.agent-logs/sprint-9/task-9.6b-publish-page-ai-api-mode-e2e.md` | **Created** — this log |
| `.agent-logs/sprint-9/task-9.6-publish-page-ai-ui.md` | Addendum — API-mode E2E verified |
| `apps/api/.dev.vars` | Toggled locally only (`true` → `false`); **not committed** |

No product code, scripts, or docs changed — existing E2E and smoke scripts were sufficient.

## Environment used (no secrets)

| Component | Setting |
|---|---|
| Supabase local | `supabase start` (running) |
| API | `AI_GENERATION_ENABLED=true` then `false` for disabled path |
| API | `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success` |
| Web | `VITE_USE_MOCKS=false` in `apps/web/.env.local` |
| Dev servers | `npm run dev:api`, `npm run dev:web` |

## Commands run

| Command | Result |
|---|---|
| `GET /api/health` (AI enabled) | PASS — `aiGenerationEnabled=true`, `aiProviderMock=true` |
| `npm run smoke:web:publish-ai -- -IncludeApiMode` (AI enabled) | PASS — 14 PASS, 0 FAIL |
| `GET /api/health` (AI disabled) | PASS — `aiGenerationEnabled=false`, `aiProviderMock=true` |
| `npm run smoke:web:publish-ai -- -IncludeApiMode` (AI disabled) | PASS — 14 PASS, 0 FAIL |
| `npm run smoke:web:publish` | PASS — 3 PASS |
| `npm run smoke:web:publish-ai` (mock only) | PASS — 3 PASS |
| `npm run smoke:web:rewrite` | PASS — 5 PASS |
| `npm run smoke:web:credit-ui` | PASS — 5 PASS |
| `npm run smoke:api:sprint9` | PASS — 10 PASS, 11 NOT RUN (AI disabled default) |
| `npm run smoke:api:sprint8` | PASS — 8 PASS, 5 NOT RUN |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:api:sprint6` | PASS — 68/68 |
| `npm run smoke:api:sprint7` | PASS — 53/53 |
| Final `GET /api/health` | PASS — `aiGenerationEnabled=false`, `aiProviderMock=true` |

## API-mode publish AI success verification

**Smoke:** `npm run smoke:web:publish-ai -- -IncludeApiMode` with `AI_GENERATION_ENABLED=true`

| Step | Result |
|---|---|
| Bootstrap approved summary + publish package | PASS |
| PublishPage API mode renders package | PASS |
| AI copy panel visible (`publish-ai-copy-panel`) | PASS |
| Select teaser field + **Buat Saran Copy** | PASS |
| Suggestions appear (`publish-ai-suggestion-teaser`, `[mock-publish:…]` marker) | PASS |
| Teaser textarea unchanged before **Terapkan** | PASS |
| **Terapkan** updates teaser via PATCH (value contains mock marker) | PASS |
| No DOM leak (prompt/context/provider/model/cost) | PASS |

Playwright test: `creates suggestions without mutating package until apply`

## API-mode publish AI disabled verification

**Smoke:** same command with `AI_GENERATION_ENABLED=false`

| Step | Result |
|---|---|
| Panel still visible and safe | PASS |
| **Buat Saran Copy** shows "AI generation belum aktif" | PASS |
| No suggestions rendered | PASS |
| Package fields unchanged | PASS |
| No DOM leak | PASS |

Playwright test: `AI disabled shows safe message on Buat Saran Copy click`

## Suggestion-first / apply verification summary

- Suggestions stored in UI state only after `improve-publish-copy` success.
- Package field values identical before and after suggestion generation (teaser checked).
- Single-field **Terapkan** triggers existing PATCH fields endpoint; UI reflects new value.
- **Terapkan Semua** not separately exercised in E2E (single-field apply sufficient for acceptance).
- No auto-post, no auto-apply.

## Web regression summary

All mock-mode smokes PASS after API-mode runs:

- `smoke:web:publish` — PASS
- `smoke:web:publish-ai` — PASS
- `smoke:web:rewrite` — PASS
- `smoke:web:credit-ui` — PASS

## API regression summary

All requested smokes PASS with safe default env (`AI_GENERATION_ENABLED=false`):

- `smoke:api:sprint9` — 10 PASS (AI-enabled success paths NOT RUN by design)
- `smoke:api:sprint8` — 8 PASS
- `smoke:api` — 17 PASS
- `smoke:api:sprint5` — 49 PASS
- `smoke:api:sprint6` — 68 PASS
- `smoke:api:sprint7` — 53 PASS

## Rollback / env final

- `apps/api/.dev.vars` restored: `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`, `AI_PROVIDER_MOCK_MODE=success`
- `dev:api` restarted; health confirms safe flags
- `.dev.vars` not committed

## Final approval status for Task 9.6

**APPROVED** — Task 9.6 implementation verified end-to-end in API mode. All acceptance criteria for 9.6b met.

## Known limitations

- **Terapkan Semua** not covered by dedicated E2E assertion (single-field apply verified).
- API-mode publish AI E2E not in GitHub Actions CI (local dual-env requirement).
- Sprint 9 API smoke AI success paths still NOT RUN at default safe env (unchanged from 9.5/9.6).
- Multiple stale `dev:api` processes were observed earlier; single listener on :8787 required for correct health flags.

## Next recommended task

**Task 9.7** — Sprint 9 safety regression (full smoke matrix before sprint close).