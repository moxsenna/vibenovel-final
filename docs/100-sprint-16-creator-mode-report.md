# Sprint 16 Creator Mode Report

Run date: 2026-06-14T16:23:56+07:00
Branch: `codex/narraza-audit-recovery-sprint-0`

## Scope

Sprint 6 from `docs/superpowers/plans/2026-06-13-narraza-audit-recovery-sprint-plan.md` is implemented as Sprint 16 code. The goal was to make creator mode an explicit opt-in, persist it through project settings, keep simple mode unchanged, and reveal advanced outline controls only when advanced mode is active.

## Implemented

- Added shared `CREATOR_MODES` and `CreatorMode` type.
- Added `creatorMode` to shared `ProjectSettings`.
- Added migration `supabase/migrations/00014_sprint16_creator_mode.sql`.
  - Adds `project_settings.creator_mode`.
  - Default is `simple`.
  - Check constraint allows only `simple` or `advanced`.
- Updated API settings mapping and `project-settings` service.
  - `GET /api/projects/:id/settings` returns `creatorMode`.
  - `PUT /api/projects/:id/settings` accepts `creatorMode`.
  - Audit metadata includes `creatorMode` in changed fields when updated.
- Added API contract test `apps/api/scripts/sprint16-creator-mode-contracts.test.mts`.
- Added Settings UI section `CreatorModeSection`.
  - Simple is the default.
  - Advanced can be selected and saved with project settings.
- Added outline advanced controls.
  - Visible only when `creatorMode` is `advanced`.
  - Controls: chapter count, reveal density, retention intensity, prose style target.
  - Chapter count is passed to outline generation in advanced mode.
- Added Playwright spec `apps/web/e2e/sprint16-creator-mode.spec.ts`.

## Verification

Commands run on 2026-06-14:

```powershell
npm run test:creator-mode -w @vibenovel/api
```

Result: PASS `Sprint 16 creator mode contracts`.

```powershell
npm run typecheck
```

Result: PASS across shared, web, and API.

```powershell
npm run lint
```

Result: PASS with 36 existing warnings and 0 errors.

```powershell
cd apps/web
npx playwright test e2e/sprint16-creator-mode.spec.ts --retries=1
```

Result: PASS, 3 tests passed.

## Not Completed

- Migration `00014_sprint16_creator_mode.sql` has not been applied to production by this agent.
  - Reason: applying production migrations is an operator/founder deployment step.
- Reveal density, retention intensity, and prose style target are currently UI planning controls.
  - Reason: existing outline API only supports `targetChapterCount` as a first-class generation input. Additional generator semantics should be handled in a later Sprint 7 retention-intelligence pass.

## Founder Next Step

Apply `00014_sprint16_creator_mode.sql` to the target Supabase database before deploying this branch. After deploy, verify `/settings` can save Advanced mode and `/projects/:id/outline` shows advanced controls only for Advanced mode.
