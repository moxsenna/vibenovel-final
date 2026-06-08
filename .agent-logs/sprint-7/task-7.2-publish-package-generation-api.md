# Task 7.2 — Publish Package Generation API

**Date:** 2026-06-08  
**Sprint:** sprint-7  
**Status:** completed

## Task goal

Membuat API generate dan read publish package dari approved chapter summary + summarized chapter state + safe prose excerpt. Deterministic stub `publish_stub_v1`. Tanpa PATCH/export, PublishPage, KBM auto-post, atau OpenRouter.

## Files read

| Path | Purpose |
|---|---|
| `README.md`, `docs/39`, `docs/38`, `docs/36` | Sprint 7 plan + handoff |
| `supabase/migrations/00006_sprint7_publish_package.sql` | Schema |
| `packages/shared/src/enums.ts`, `domain.ts` | Publish types |
| `apps/api/src/services/chapter-summary.ts` | Service/orchestration pattern |
| `apps/api/src/services/prose-draft.ts` | Leak markers reference |
| `apps/api/src/services/project.ts` | Ownership |
| `apps/api/src/lib/mappers.ts` | Row mappers |
| `apps/api/src/routes/index.ts`, `summary.ts` | Route registration pattern |
| `apps/api/README.md` | API docs |
| `scripts/sprint6-smoke-api.ps1` | Smoke flow reuse |
| `apps/web/src/mocks/publishPackage.ts` | Field parity |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `apps/api/src/services/publish-safety.ts` | **Created** — leak/overclaim guards |
| `apps/api/src/services/publish-snapshot.ts` | **Created** — gate + snapshot loader |
| `apps/api/src/services/publish-package-generator.ts` | **Created** — `publish_stub_v1` |
| `apps/api/src/services/publish-package.ts` | **Created** — CRUD + generate orchestration |
| `apps/api/src/routes/publish.ts` | **Created** — 4 endpoints |
| `apps/api/src/routes/index.ts` | Register publish routes |
| `apps/api/src/lib/mappers.ts` | `PublishPackageRow` + `mapPublishPackageRow` |
| `apps/api/README.md` | Publish API section |
| `scripts/sprint7-smoke-api.ps1` | **Created** — 23-step smoke |
| `package.json` | `smoke:api:sprint7` script |
| `.agent-logs/sprint-7/task-7.2-publish-package-generation-api.md` | This log |

No web/UI changes. No Task 7.3 PATCH/export endpoints.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS (after style_tags fix) |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint7` | PASS 23/23 |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 59/59 |
| `supabase db reset` | tidak dijalankan (00006 unchanged) |

## Results

- Four publish endpoints live with auth + owner-only guards.
- Generate gated on `summary approved` + `is_current` + `chapter summarized`.
- `publish_stub_v1` persists copy-ready fields + checklist + safety flags.
- Regenerate versioning: idempotent false path; true path supersedes (exported rows keep `exported` status).
- No canon mutation; no new `ai_proposals` from publish flow.
- Leak guards on responses (no prose_text, packet_json, planningTruth, delta_json).
- All acceptance criteria met.

## Decisions

1. **Regenerate + exported row:** prior `exported` package → `is_current=false`, status stays `exported` (not `superseded`).
2. **By-chapter empty:** `200 { publishPackage: null }` — missing outline → `404`.
3. **Initial package status:** `ready` after successful stub generation.
4. **Prose input:** first-sentence excerpts only (≤280 chars); prose version ids in metadata only.
5. **Next chapter teaser:** hook/ending_hook slice only — never N+1 full `summary`.
6. **Smoke proposals baseline:** count snapshot after summary approve, before publish generate.

## Limitations

- No PATCH fields/checklist, no `mark-exported` (Task 7.3).
- No PublishPage integration (Task 7.4).
- `assertPublishResponseSafe` not wired in routes — generator + field asserts cover MVP.
- `summaryProseMismatch` heuristic may false-positive (informational flag only).
- API dev server must be restarted manually to pick up new routes after deploy.

## Next recommended task

**Task 7.3 — Publish Package Field Update / Checklist / Export Marker API**

- PATCH `/publish/:packageId/fields`
- PATCH `/publish/:packageId/checklist`
- POST `/publish/:packageId/mark-exported`