# 12 — Public Beta Hardening Log

> Execution log for [`docs/112-public-beta-hardening-sprint-plan.md`](112-public-beta-hardening-sprint-plan.md).  
> **Not** [`docs/12-database-schema-and-data-model.md`](12-database-schema-and-data-model.md).

## 2026-06-16 — Sprint 12.0 baseline & stub guard (Fase C slice)

### Verified code-level state (static)

| Area | Status |
|------|--------|
| AI prose generation | Real (`prose-beat-generation`, OpenRouter) |
| Context packet | Real |
| Model router / credits | Real |
| Intake / concept / foundation / outline | Hybrid AI + deterministic stub when AI off or mock |
| **Beat generation** | Deterministic stub only; **blocked** when live AI on without `ALLOW_DETERMINISTIC_STORY_STUBS` |
| **Chapter summary** | `summary_stub_v1`; **blocked** when live AI on without allow flag / mock |
| Production mock guard (web) | `import.meta.env.PROD` in `apps/web/src/lib/env.ts` |

### Changes shipped

- `apps/api/src/env.ts`: `ALLOW_DETERMINISTIC_STORY_STUBS`, `allowDeterministicStoryStubs()`, `mayUseDeterministicStoryStub()`.
- `apps/api/src/services/chapter-beat.ts`: guard before `STUB_BEAT_TEMPLATES` insert.
- `apps/api/src/services/chapter-summary.ts`: guard before `generateChapterSummaryStub`.
- `scripts/smoke-no-production-stubs.mjs` + `npm run smoke:no-prod-stubs`.
- `apps/api/scripts/story-stub-policy.test.mts` + `npm run test:story-stub-policy -w @vibenovel/api`.

### Not claimed

- Runtime PASS against live Supabase for beat/summary HTTP routes (smokes use `.dev.vars` with stubs allowed when AI off or `ALLOW_DETERMINISTIC_STORY_STUBS=true`).
- Real AI beat/summary generators (Sprint 12.2–12.3 backlog).

### Verify

```bash
npm run smoke:no-prod-stubs
npm run test:story-stub-policy -w @vibenovel/api
npm run typecheck -w @vibenovel/api
```

## 2026-06-16 — Sprint 12.1–12.3 real AI beat & chapter summary

### Shipped

| Sprint | Scope |
|--------|--------|
| **12.1** | `00020_sprint12_story_generation_types.sql`; `GENERATION_TYPES` (`intake_assistant`, `beat_generation`, `chapter_summary_generation`, `continuity_delta`); model-router caps (3000 beat/summary); credit policy (3/6/12 hemat–terbaik); intake billing `intake_assistant`. |
| **12.2** | `beat-generation-snapshot.ts`, `beat-generation-prompt.ts`, `beat-generation-ai.ts`; `chapter-beat.ts` routing: AI → deterministic stub (if allowed) → `serviceUnavailable`; marker `beat_ai_generator`. |
| **12.3** | `chapter-summary-schema.ts`, `chapter-summary-ai.ts`; `chapter-summary.ts` routing + `factProposalDrafts` → `createLinkedProposals`; marker `summary_ai_generator`; mock JSON for beat/summary types. |

### Routing (live AI)

- **Beats:** `isAiGenerationEnabled && !isAiProviderMock` → `generateBeatsWithAiForSession` (`beat_generation`, 3 credits hemat).
- **Summary:** same gate → `generateChapterSummaryWithAi` (`chapter_summary_generation`, 3 credits hemat); `newFacts` with confidence ≥ 0.7 → `ai_proposals` only.
- **Stub fallback:** `allowDeterministicStoryStubs` / `mayUseDeterministicStoryStub` when AI off or mock; production-like env without allow flag → 503 (Fase C).

### Verify

```bash
npm run typecheck -w @vibenovel/api
npm run test:generation-contracts -w @vibenovel/api
npm run test:story-stub-policy -w @vibenovel/api
npm run smoke:no-prod-stubs
npm run check:docs-drift
```

### Remaining backlog

- Runtime HTTP smokes against live Supabase with AI on (no stub flag).
- Sprint 12.4+ (`continuity_delta` AI), full validator depth, competitive doc items beyond 12.x.

## 2026-06-16 — Sprint 12.4 generic proposal accept → canon

### Shipped

- `apps/api/src/services/ai-proposal.ts`: `acceptProposalForOwner` promotes via `proposal-canon-promotion.ts` for `fact`, `character_update`, `relationship_update`, `open_loop_update`, `reveal_status_update`, `character_state_update`, `character_knowledge_update`.
- Order: preflight → promote → `canon_promotion_applied` audit → status `accepted` + `result_fact_id` / `result_character_id`; compensate on status failure.
- Foundation flow types (`foundation`, `style`, `character`, `relationship_speech_rule`) → **409** with `use_foundation_proposal_accept`.
- Other types → **409** `unsupported_generic_accept` (no silent status-only accept).
- Route passes optional JSON body (`confirmHighRisk`) for reveal promotions.

### Already existed (unchanged paths)

- Summary-linked accept: `summary-proposal-review.ts`.
- Foundation review accept: `foundation-proposal-acceptance.ts`.
- Promotion engine: `proposal-canon-promotion.ts` (not new `canon-promotion.ts`).

### Verify

```bash
npm run typecheck -w @vibenovel/api
```

