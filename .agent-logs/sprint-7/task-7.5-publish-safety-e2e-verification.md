# Task 7.5 — Publish Safety & E2E Verification

**Date:** 2026-06-08  
**Sprint:** sprint-7  
**Status:** completed

## Task goal

Menambahkan dan memperkuat safety/regression tests untuk Publish Package flow: API generation/update/export, PublishPage mock/API-mode E2E, DOM leak guard, no auto-post, no canon mutation. Tanpa fitur produk baru, Task 7.6, atau verification report final.

## Files read

| Path | Purpose |
|---|---|
| `README.md` | Verification checklist |
| `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` | Task 7.5 scope |
| `docs/38-sprint-6-verification-report.md` | Prior E2E patterns |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Deferred scope |
| `apps/api/README.md` | Publish API contracts |
| `scripts/sprint7-smoke-api.ps1` | Extend API safety |
| `scripts/sprint6-smoke-api.ps1` | Canon baseline patterns |
| `scripts/sprint6-smoke-web.ps1` | Web smoke orchestration pattern |
| `apps/web/src/pages/PublishPage.tsx` | E2E targets |
| `apps/web/src/hooks/usePublishData.ts` | API/mock behavior |
| `apps/web/src/services/publish.ts` | Endpoints |
| `apps/web/src/lib/publish-mappers.ts` | Leak guard |
| `apps/web/src/components/publish/*` | UI selectors |
| `apps/api/src/services/publish-*.ts`, `publish-safety.ts`, `routes/publish.ts` | Safety semantics |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `scripts/sprint7-smoke-api.ps1` | Extended safety: canon/summaries baseline, overclaim variants, duplicate checklist, manual marker, static no-autopost check (+9 steps → 50 total) |
| `apps/web/e2e/sprint7-publish-flow.spec.ts` | **Created** — mock + API-mode publish E2E |
| `scripts/sprint7-smoke-web.ps1` | **Created** — Playwright orchestrator |
| `package.json` | `smoke:web:publish` |
| `apps/web/package.json` | `test:e2e:sprint7` |
| `scripts/README.md` | smoke index entries |
| `README.md` | Verification checklist + sprint7 API smoke |
| `.agent-logs/sprint-7/task-7.5-publish-safety-e2e-verification.md` | This log |

No migration. No new product features. No backend behavior changes (test script baseline fix only).

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
| `npm run smoke:api:sprint7` | PASS 50/50 |
| `npm run smoke:web` | PASS 3/3 (1 NOT RUN API-mode) |
| `npm run smoke:web:summary` | PASS 3/3 (1 NOT RUN API-mode) |
| `npm run smoke:web:publish` | PASS 3/3 mock (1 NOT RUN API-mode default) |
| `npm run smoke:web:publish -- -IncludeApiMode` | PASS 11/11 (mock + API full flow) |

## Results

- Sprint 7 API smoke covers generation/update/export safety, leak guards, overclaim rejection, checklist validation, exported lock, cross-user 404, no canon/ai_proposals mutation.
- Publish mock E2E PASS with DOM leak + overclaim guards + copy buttons.
- Publish API-mode E2E PASS when run with `-IncludeApiMode` (local `VITE_USE_MOCKS=false` + dev servers).
- Sprint 2/5/6 regression smokes remain PASS.

## Decisions

1. **Summaries baseline** captured after summary approve, before publish generate (fixes false FAIL when baseline was pre-summary).
2. **Mock E2E manual-copy assertion** accepts `siap salin` (Sprint 1 mock subtitle); API mode still requires stronger manual-marker copy.
3. **No KBM autopost** verified via static `publish.ts` scan + mark-exported metadata `kbm_manual_copy`.
4. **API-mode E2E** optional via `-IncludeApiMode` (same pattern as summary/write smokes).

## Limitations

- API-mode publish E2E not in default `smoke:web:publish` (NOT RUN unless `-IncludeApiMode`).
- CI/GitHub Actions still typecheck+build only; browser smokes local-only.
- Clipboard content not asserted (copy button presence only).
- No chapter picker E2E (Bab 1 default only).

## Next recommended task

**Sprint 7 closure** — user-approved verification report (`docs/40` or sprint closure doc) if desired; otherwise **Sprint 8** planning per roadmap. Task 7.6 not started per scope.