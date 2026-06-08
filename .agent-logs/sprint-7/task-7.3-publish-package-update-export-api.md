# Task 7.3 — Publish Package Field Update / Checklist / Export Marker API

**Date:** 2026-06-08  
**Sprint:** sprint-7  
**Status:** completed

## Task goal

Menambahkan API PATCH fields, PATCH checklist, dan POST mark-exported untuk publish package. Tanpa PublishPage integration, KBM auto-post, atau OpenRouter.

## Files read

| Path | Purpose |
|---|---|
| `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` | Task 7.3 scope |
| `supabase/migrations/00006_sprint7_publish_package.sql` | Schema |
| `packages/shared/src/enums.ts`, `domain.ts` | Checklist ids |
| `apps/api/src/routes/publish.ts` | Route group |
| `apps/api/src/services/publish-package.ts` | Existing CRUD |
| `apps/api/src/services/publish-package-generator.ts` | Checklist labels |
| `apps/api/src/services/publish-safety.ts` | Safety helpers |
| `apps/api/src/lib/mappers.ts` | Checklist mapper |
| `apps/api/README.md` | Docs |
| `scripts/sprint7-smoke-api.ps1` | Smoke extension |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `apps/api/src/services/publish-package-update.ts` | **Created** — fields, checklist, mark-exported |
| `apps/api/src/services/publish-safety.ts` | `assertNoOverclaimCopy`, `assertPublishUserTextSafe` |
| `apps/api/src/routes/publish.ts` | 3 new endpoints |
| `packages/shared/src/domain.ts` | Optional `note` on `PublishChecklistItem` |
| `apps/api/src/lib/mappers.ts` | Pass through checklist `note` |
| `apps/api/README.md` | Task 7.3 section |
| `scripts/sprint7-smoke-api.ps1` | +18 tests (41 total) |
| `.agent-logs/sprint-7/task-7.3-publish-package-update-export-api.md` | This log |

No migration. No web/UI changes.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS (via `npm run typecheck`) |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api:sprint7` | PASS 41/41 |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 59/59 |

## Results

- PATCH fields, PATCH checklist, POST mark-exported implemented with auth + owner-only guards.
- Exported packages locked (`409 exported_package_locked`) for field/checklist edits.
- mark-exported: local marker only, idempotent, warnings for incomplete checklist.
- No canon mutation, no external network, no ai_proposals.
- All acceptance criteria met.

## Decisions

1. **User edits** use `assertPublishUserTextSafe` (leak + overclaim reject); stub generator keeps flag-only overclaim detection.
2. **mark-exported** allows `ready` and `draft`; warns `checklist_incomplete` without blocking MVP.
3. **Checklist PATCH** requires exactly 5 allowed ids; optional `note` stored in jsonb.
4. **metadata** on fields PATCH rejected; export metadata only via mark-exported.
5. **Exported regenerate** (Task 7.2 behavior preserved): exported row keeps `exported` status when superseded.

## Limitations

- No PublishPage integration (Task 7.4).
- Checklist incomplete does not block mark-exported (warning only).
- `safetyFlags` not user-editable via API.
- No audit log for export marker.

## Next recommended task

**Task 7.4 — PublishPage Web Integration**

- `usePublishData`, `publish.ts` service, `publish-mappers.ts`
- Wire `PublishPage.tsx` API mode + mock fallback