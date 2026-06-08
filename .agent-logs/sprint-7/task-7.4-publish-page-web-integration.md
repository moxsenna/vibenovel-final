# Task 7.4 — PublishPage Web Integration

**Date:** 2026-06-08  
**Sprint:** sprint-7  
**Status:** completed

## Task goal

Menghubungkan `/projects/:id/publish` ke Sprint 7 publish API secara minimal dan aman: load/generate package, edit copy-ready fields, checklist toggle, mark-exported manual marker, mock fallback tetap tersedia. Tanpa auto-post KBM, OpenRouter, AI generation, atau Task 7.5.

## Files read

| Path | Purpose |
|---|---|
| `README.md` | Integration notes |
| `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` | Task 7.4 scope |
| `docs/38-sprint-6-verification-report.md` | Prior sprint patterns |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Deferred scope |
| `apps/api/README.md` | Publish API contracts |
| `apps/api/src/routes/publish.ts` | Endpoints |
| `apps/api/src/services/publish-package.ts` | Generate/read |
| `apps/api/src/services/publish-package-update.ts` | PATCH/mark-exported |
| `apps/api/src/services/publish-safety.ts` | Leak/overclaim guards |
| `apps/web/src/pages/PublishPage.tsx` | Sprint 1 layout |
| `apps/web/src/components/publish/*` | Reusable cards |
| `apps/web/src/mocks/publishPackage.ts` | Mock parity |
| `apps/web/src/lib/api.ts`, `env.ts`, `project-context.ts` | Client infra |
| `apps/web/src/hooks/useSummaryData.ts` | Hook pattern |
| `apps/web/src/services/summary.ts` | Service pattern |
| `apps/web/src/lib/summary-mappers.ts` | Mapper + safeText |
| `scripts/sprint7-smoke-api.ps1` | Regression |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/src/services/publish.ts` | **Created** — list/get/by-chapter/generate/PATCH/mark-exported |
| `apps/web/src/lib/publish-mappers.ts` | **Created** — API→UI map + safeText + field patch helpers |
| `apps/web/src/hooks/usePublishData.ts` | **Created** — mock/API/fallback orchestration |
| `apps/web/src/components/publish/PublishWorkflowActions.tsx` | **Created** — generate + mark-exported CTAs |
| `apps/web/src/components/publish/PublishEditableField.tsx` | **Created** — editable copy fields with save |
| `apps/web/src/components/publish/PublishChecklistPanel.tsx` | **Created** — interactive checklist |
| `apps/web/src/components/publish/PublishIntegrationNotice.tsx` | **Created** — thin wrapper over IntegrationNotice |
| `apps/web/src/components/publish/index.ts` | Export new components |
| `apps/web/src/pages/PublishPage.tsx` | Wired hook + API workflow |
| `apps/web/src/mocks/publishPackage.ts` | Comment update |
| `apps/web/.env.example` | Task 7.4 comment |
| `README.md` | Sprint 7 Task 7.4 integration note |
| `.agent-logs/sprint-7/task-7.4-publish-page-web-integration.md` | This log |

No migration. No backend behavior changes. No Task 7.5.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 59/59 |
| `npm run smoke:api:sprint7` | PASS 41/41 |
| `npm run smoke:web` | PASS 3/3 (1 NOT RUN API-mode) |
| `npm run smoke:web:summary` | PASS 3/3 (1 NOT RUN API-mode) |

## Results

- PublishPage API mode can load package by chapter, generate when missing, edit fields, toggle checklist, mark exported.
- Exported packages show readonly/locked UI; field/checklist save disabled client-side; API 409 surfaced safely.
- Mock fallback preserved for `VITE_USE_MOCKS=true`, no login, API down.
- `publish-mappers.ts` safeText filters leak markers before DOM render.
- Overclaim API rejection mapped to Indonesian user message.
- Copy buttons retained via `PublishCopyFieldCard` / `CopyButton` (clipboard local, no backend).
- No auto-post/KBM external call from frontend.

## Decisions

1. **Chapter resolution:** default Bab 1 from outline bundle (same as Summary hook); summary approval checked via `getSummaryByChapter` before generate CTA.
2. **Mapper:** UI field names unchanged (`blurb`, `commentBait`, `title`) mapped from API `shortSynopsis`, `readerQuestion`, `displayTitle`.
3. **Editable UX:** per-field explicit Simpan button (no debounce) to minimize accidental PATCH storms.
4. **Checklist:** full items array sent on toggle (API requires exactly 5 ids).
5. **Tags in API mode:** comma-separated editable field; read-only mode keeps `PublishTagsCard` badges.
6. **Notices:** reuse `IntegrationNotice` via `PublishIntegrationNotice` for parity with Summary/Write pages.

## Limitations

- No dedicated `smoke:web:publish` Playwright spec (deferred; mock page not in existing E2E suite).
- API-mode browser E2E (`-IncludeApiMode`) not run in this session.
- Single chapter (Bab 1 default) — no chapter picker UI.
- No regenerate CTA in UI (API supports `regenerate: true`; deferred).
- Genre shown as separate editable field only in API editable mode.
- Mobile preview excerpt editor shown above preview card (slight duplication).

## Next recommended task

**Task 7.5** — Sprint 7 final safety/E2E verification (optional `smoke:web:publish`, API-mode publish flow, leak guard DOM audit).