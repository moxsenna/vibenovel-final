# Task 9.0 — AI Rewrite, Publish Copy & Credit UI Plan

**Date:** 2026-06-08
**Sprint:** sprint-9
**Status:** completed

## Task goal

Create Sprint 9 implementation plan (`docs/48`) after Sprint 8 live OpenRouter staging GO. Plan covers prose rewrite, publish copy AI, credit UI minimal, and cost observability. Docs-only — no coding, migration, endpoints, or UI.

## Files read

- `README.md`
- `docs/45-sprint-8-verification-report.md`
- `docs/46-live-openrouter-staging-verification-plan.md`
- `docs/47-live-openrouter-staging-smoke-report.md`
- `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `apps/api/README.md`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/prose-beat-generation.ts` (partial)
- `apps/api/src/services/prose-draft.ts` (partial — `saveAiGeneratedProseVersionForOwner`, `CHAPTER_PROSE_SOURCES`)
- `apps/api/src/services/model-router.ts`
- `apps/api/src/services/openrouter-client.ts` (partial)
- `apps/api/src/services/ai-credit-policy.ts`
- `apps/api/src/services/credit-ledger.ts` (referenced via prose-beat-generation imports)
- `apps/api/src/services/generation-attempt.ts` (partial — `markGenerationAttemptSucceeded`, no `estimated_cost_usd` write)
- `apps/web/src/pages/WritePage.tsx` (partial)
- `apps/web/src/hooks/useWriteRoomData.ts` (grep — AI generate, credit balance)
- `apps/web/src/pages/PublishPage.tsx` (grep — no AI yet)
- `apps/web/src/hooks/usePublishData.ts` (grep — overclaim handling)
- `apps/web/src/components/writer/WriterAssistantPanel.tsx` (partial — disabled Perbaiki Teks)
- `apps/web/src/services/ai.ts` (grep)
- `scripts/sprint8-smoke-api.ps1` (referenced)
- `scripts/sprint8-smoke-web.ps1` (referenced)
- `scripts/smoke-all-local.ps1` (partial)
- `.agent-logs/sprint-8/` (task list referenced)
- `.agents/rules/09-agent-work-logs.md`
- `packages/shared/src/enums.ts` (partial — `CHAPTER_PROSE_SOURCES`, `GENERATION_TYPES`)

## Files created/changed

| Path | Change |
|---|---|
| `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` | **Created** — 18-section Sprint 9 plan |
| `README.md` | Sprint 9 plan section + doc navigation entry |
| `.agent-logs/sprint-9/task-9.0-ai-rewrite-publish-credit-ui-plan.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only task |
| `npm run build` | tidak dijalankan — docs-only task |
| Smoke scripts | tidak dijalankan — no new tests claimed |

## Results

- `docs/48` created with all required sections (goal, current state, scope A–D, out of scope, architecture, schema, cost plan, credit UI, rewrite API, publish copy API, temperature config, safety tests, audit, task breakdown 9.1–9.8, acceptance, risks, first coding task, 9.0 verification).
- Prerequisite gate documented: live OpenRouter **GO** (`docs/47`, `google/gemini-2.5-flash`).
- Known gap `estimated_cost_usd` null confirmed in code — `markGenerationAttemptSucceeded` does not set field.
- Rewrite UI placeholders confirmed disabled in `WriterAssistantPanel`.
- `CHAPTER_PROSE_SOURCES` has no `ai_rewrite` — plan documents Option A (reuse `ai_generated`) vs Option B (`00009`).
- Publish copy MVP decision: suggestion-first with user apply via existing PATCH.

## Decisions

1. **Task 9.1 first** — cost estimation before new AI surfaces (low risk, closes 8.9b gap).
2. **Suggestion-first publish copy** — safer than auto-patch; fallback documented.
3. **Reuse `prose-beat-generation` orchestration** for rewrite — same debit/refund/idempotency pattern.
4. **Avoid migration if possible** — `estimated_cost_usd` uses existing column; `ai_rewrite` enum optional.
5. **Temperature per generationType** in implementation tasks — not changing router tier mapping in 9.1.
6. **Fixed credit billing unchanged** — `estimated_cost_usd` internal only.
7. **Model pricing verified at implementation** — not hardcoded from memory in plan.
8. **No secrets in docs** — OpenRouter key referenced by env name only.

## Limitations

- No code, migration, API routes, UI, or smoke scripts in Task 9.0.
- Endpoint proposals in `docs/48` are **plans for Tasks 9.3/9.5** — not implemented.
- True Postgres RPC for credit atomicity still deferred.
- Live rewrite smoke optional — operator discipline.
- Sprint 9 verification report (`docs/49`) reserved for Task 9.8.

## Next recommended task

**Task 9.1** — AI Cost Estimation + Generation Attempt Cost Metadata (`model-cost-map.ts`, populate `estimated_cost_usd` on success path).