# Task 8.5 — WritePage AI Button Integration

**Date:** 8 Juni 2026  
**Status:** Complete (pending verification run results below)

---

## Task goal

Connect WritePage to `POST /api/projects/:id/ai/generate-prose` with minimal UI: per-beat AI generate button, credit cost label, loading/error/success states, prose inserted into editor on success, safe mock/API fallback. No other AI features.

---

## Files read

- `README.md`, `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
- `.agent-logs/sprint-8/task-8.4-prose-beat-generation-api.md`
- `apps/api/README.md`, `apps/api/src/routes/ai.ts`, `prose-beat-generation.ts`, `ai-credit-policy.ts`, `credit-ledger.ts`, `generation-attempt.ts`
- `apps/web/src/pages/WritePage.tsx`, `useWriteRoomData.ts`, `services/write.ts`, `services/ai.ts`, `lib/api.ts`, `lib/env.ts`, `components/writer/*`
- `apps/web/e2e/sprint5-write-flow.spec.ts`, `scripts/sprint5-smoke-web.ps1`, `scripts/sprint8-smoke-api.ps1`
- `.agents/rules/09-agent-work-logs.md`

---

## Files created/changed

| Path | Change |
|---|---|
| `apps/web/src/services/ai.ts` | Web client for `generateBeatProse`, cost labels, idempotency, error mapping |
| `apps/web/src/hooks/useWriteRoomData.ts` | `generateAiForActiveBeat`, AI state, quality mode from settings, credit refresh |
| `apps/web/src/components/writer/WriterAssistantPanel.tsx` | Enabled AI button + cost/notice/error |
| `apps/web/src/components/writer/WriterMobileLayout.tsx` | Mobile FAB AI control |
| `apps/web/src/pages/WritePage.tsx` | Wire AI props to assistant + mobile |
| `apps/web/e2e/sprint8-write-ai-flow.spec.ts` | Mock + API E2E with leak guards |
| `scripts/sprint8-smoke-web.ps1` | Web smoke orchestrator |
| `package.json` | `smoke:web:write-ai` |
| `apps/web/package.json` | `test:e2e:sprint8` |
| `apps/web/.env.example` | Note on WritePage AI API mode |
| `README.md`, `scripts/README.md`, `docs/36` | Documentation updates |

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
npm run smoke:api:sprint8
npm run smoke:web:write
npm run smoke:web:write-ai
npm run smoke:web:write-ai -- -IncludeApiMode
```

---

## Results

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS (17/17) |
| `npm run smoke:api:sprint5` | PASS (49/49) |
| `npm run smoke:api:sprint6` | PASS (68/68) |
| `npm run smoke:api:sprint7` | PASS (53/53) |
| `npm run smoke:api:sprint8` | PASS baseline (8 PASS, 5 NOT RUN mock modes — `AI_GENERATION_ENABLED=false`) |
| `npm run smoke:web:write` | PASS mock (API mode NOT RUN without `-IncludeApiMode`) |
| `npm run smoke:web:write-ai` | PASS mock |
| `npm run smoke:web:write-ai -- -IncludeApiMode` | PASS — API disabled safe message E2E; AI mock success SKIP (`AI_GENERATION_ENABLED=false`) |

---

## Decisions

1. **API mode only** — `onGenerateAi` exposed only when `source === "api"`; mock/fallback show disabled button + Indonesian explanation (no fake AI).
2. **Quality mode** — loaded from `fetchProjectSettings`; defaults to `seimbang` if unavailable.
3. **Idempotency** — new key per click via `buildBeatProseIdempotencyKey`; button disabled while `aiGenerating`.
4. **Credit display** — no new WritePage balance widget; success `aiNotice` shows cost + remaining balance when API returns it.
5. **E2E split** — API disabled test runs by default; AI success test runs only when smoke script probes AI enabled (`SMOKE_AI_ENABLED=true`).

---

## Limitations

- Rewrite/fix/check AI CTAs remain disabled (out of scope).
- No topup/payment UI.
- API-mode AI success E2E requires manual `dev:api` restart with `AI_GENERATION_ENABLED=true` + `AI_PROVIDER_MOCK=true`.
- WritePage has no persistent credit balance chip (Settings page still primary).

---

## Next recommended task

**Task 8.6** — Sprint 8 verification report (`docs/45`) and smoke consolidation per `docs/44`.