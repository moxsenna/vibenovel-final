# Task 9.5 — Publish Copy AI API

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Implement credit-gated `POST /api/projects/:id/ai/improve-publish-copy` — suggestion-first publish copy improvement (teaser/caption/readerQuestion/shortSynopsis/nextChapterTeaser). No `publish_packages` mutation, no canon mutation, no PublishPage UI.

## Files read

- `README.md`
- `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
- `.agent-logs/sprint-9/task-9.4-write-page-rewrite-ui.md`
- `.agent-logs/sprint-9/task-9.4b-write-page-rewrite-api-mode-e2e.md`
- `.agent-logs/sprint-9/task-9.3-prose-rewrite-api.md`
- `apps/api/README.md`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/prose-rewrite-generation.ts`
- `apps/api/src/services/prose-rewrite-prompt.ts`
- `apps/api/src/services/publish-package.ts`
- `apps/api/src/services/publish-package-update.ts`
- `apps/api/src/services/publish-package-generator.ts`
- `apps/api/src/services/publish-snapshot.ts`
- `apps/api/src/services/publish-safety.ts`
- `apps/api/src/services/model-router.ts`
- `apps/api/src/services/ai-credit-policy.ts`
- `apps/api/src/services/credit-ledger.ts`
- `apps/api/src/services/generation-attempt.ts`
- `apps/api/src/services/model-cost-map.ts`
- `apps/api/src/services/mock-ai-provider.ts`
- `apps/api/src/services/audit-snapshot.ts`
- `scripts/sprint9-smoke-api.ps1`
- `scripts/sprint7-smoke-api.ps1`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/publish-copy-ai-prompt.ts` | **Created** — field parsing, safe snapshot prompt, JSON-only system prompt, length limits |
| `apps/api/src/services/publish-copy-ai-generation.ts` | **Created** — orchestration: auth, package load, idempotency, debit/refund, parse, safety, metadata suggestions |
| `apps/api/src/routes/ai.ts` | Register `POST .../ai/improve-publish-copy` |
| `apps/api/src/services/generation-attempt.ts` | Optional context fields; `markGenerationAttemptSucceeded` supports `outputEntityType` + `additionalMetadata` |
| `apps/api/src/services/audit-snapshot.ts` | Allow publish copy suggestion keys inside `metadata.suggestions` |
| `apps/api/src/services/mock-ai-provider.ts` | `publish_copy` deterministic JSON suggestions; fail/unsafe modes |
| `scripts/sprint9-smoke-api.ps1` | Publish copy smoke block (validation, exported 409, mock success/fail/unsafe, leak/canon guards) |
| `apps/api/README.md` | Task 9.5 endpoint docs |
| `README.md` | Sprint 9 task table + publish copy summary |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 9.5 addressed |
| `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` | Status 9.1–9.5 complete |
| `scripts/README.md` | sprint9 smoke covers publish copy |
| `.agent-logs/sprint-9/task-9.5-publish-copy-ai-api.md` | This log |

**Not committed:** `apps/api/.dev.vars` (local env toggles only).

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint9` (baseline AI disabled) | PASS — 10 PASS, 11 NOT RUN |
| `npm run smoke:api:sprint9 -- -MockMode success` | PASS — 46 PASS (rewrite + publish copy) |
| `npm run smoke:api:sprint9 -- -MockMode fail_provider` | PASS — 31 PASS (refund paths) |
| `npm run smoke:api:sprint9 -- -MockMode unsafe_output` | PASS — 30 PASS (unsafe + refund) |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:api:sprint5` | PASS — 49/49 |
| `npm run smoke:api:sprint6` | PASS — 68/68 |
| `npm run smoke:api:sprint7` | PASS — 53/53 |
| `npm run smoke:api:sprint8` | PASS — 8 PASS, 5 NOT RUN |
| `npm run smoke:all:local` | PASS — 11/11 phases (~59s) |

## Results

- Endpoint `POST /api/projects/:id/ai/improve-publish-copy` returns safe `suggestions` for requested fields only.
- No `publish_packages` mutation verified (teaser/caption unchanged after success).
- Credit debit 6 (seimbang default); idempotency replay without second debit.
- Exported package → `409 CONFLICT`; fail_provider/unsafe_output → refund + no suggestions.
- Canon unchanged; no new `ai_proposals`; response/audit leak guards PASS.
- Smoke fix: exported-package test uses `regenerate=true` so primary package stays editable.
- `.dev.vars` restored to safe default (`AI_GENERATION_ENABLED=false`) after mock runs.
- Live OpenRouter publish copy: **not run** (mock only).

## Decisions

1. **Suggestion-first:** Endpoint returns `suggestions` only; no `publish_packages` PATCH. User apply deferred to Task 9.6 via existing `PATCH .../publish/:packageId/fields`.
2. **Persistence:** Sanitized suggestions stored in `generation_attempt.metadata.suggestions` (bounded). No new table, no migration.
3. **Audit `ai_output_persisted`:** Written with `entity=generation_attempt`, metadata `suggestedFields` + `packageId` only — not `publish_package_updated`.
4. **Exported package:** `409 CONFLICT` with `exported_package_locked` (same as Sprint 7 PATCH guard).
5. **Structured output:** Prompt requires JSON-only; conservative extraction on fenced/wrapped text; parse failure → refund + `AI_OUTPUT_UNSAFE` or `AI_PROVIDER_ERROR`.
6. **Safety:** Reuse `publish-safety.ts` (`assertPublishUserTextSafe`, `assertPublishResponseSafe`) for overclaim/leak on each suggestion field.
7. **Mock provider:** `publish_copy` returns deterministic safe JSON per requested fields; `unsafe_output` includes leak marker.

## Limitations

- No PublishPage UI (Task 9.6).
- No live OpenRouter publish copy smoke unless manually run with real key.
- Suggestions only replayable via idempotency while attempt metadata retained; no separate suggestion table.
- `qualityMode` defaults to `seimbang` (6 credits) when omitted.
- No auto-post KBM, no canon mutation, no `ai_proposals`.

## Next recommended task

**Task 9.6** — PublishPage AI UI: **Perbaiki Copy dengan AI** button, show suggestions, user **Terapkan** via existing `PATCH .../publish/:packageId/fields`.