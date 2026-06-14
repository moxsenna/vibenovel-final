# Sprint 15 Draft Import Report

Run date: 2026-06-14T15:14:32+07:00
Branch: `codex/narraza-audit-recovery-sprint-0`

## Scope

Sprint 5 from `docs/superpowers/plans/2026-06-13-narraza-audit-recovery-sprint-plan.md` is implemented as Sprint 15 code. The goal was to let signed-in writers import existing draft text, extract genre/character/conflict/readership/continuity signals, and move those findings toward concept proposals without mutating canon.

## Implemented

- Added `supabase/migrations/00013_sprint15_draft_import.sql`.
  - The plan named `00012_sprint15_draft_import.sql`, but `00012_sprint14_safety_validation.sql` already exists. `00013` avoids migration ordering conflict.
  - Adds `draft_imports` and `draft_import_signals` with project/owner ownership, RLS, indexes, grants, and status tracking.
- Added API draft import contracts and implementation.
  - `POST /api/projects/:id/draft-imports`
  - `GET /api/projects/:id/draft-imports/:draftImportId`
  - `POST /api/projects/:id/draft-imports/:draftImportId/extract-signals`
- Added deterministic draft signal extraction for imported long text.
  - Produces `genre`, `protagonist`, `core_conflict`, `reader_promise`, `target_reader`, and `continuity_warning`.
  - Marks signal metadata source as `imported_draft`.
- Added audit enum support for draft import actions.
- Added web import flow.
  - Route: `/projects/:id/import-draft`
  - Start option `has_draft` now routes to draft import, not intake.
  - Page supports draft paste, import, signal extraction, status panel, detection panels, and CTA to concepts.
- Added Playwright coverage for:
  - has-draft start option routing
  - draft import + signal extraction panels

## Verification

Commands run on 2026-06-14:

```powershell
npm run test:draft-import -w @vibenovel/api
```

Result: PASS `Sprint 15 draft import contracts`.

```powershell
npm run typecheck
```

Result: PASS across shared, web, and API.

```powershell
npm run lint
```

Result: PASS with 36 warnings. These are existing repository warnings outside the new Sprint 15 file after cleanup.

```powershell
cd apps/web
npx playwright test e2e/sprint15-draft-import-flow.spec.ts --retries=1
```

Result: PASS, 2 tests passed.

## Not Completed

- Production deploy was not run in this sprint turn.
  - Reason: sprint plan only required local typecheck/lint/E2E for Sprint 5, and production deploy should wait for founder release timing.
- Real Supabase migration application was not run.
  - Reason: code migration is committed, but applying it to production/staging requires operator decision and environment target confirmation.
- Draft import does not yet automatically create story concept proposals.
  - Reason: Sprint 5 asks for a proposal CTA and non-canon extracted signals. Actual proposal materialization can be tied to Sprint 6+ controls or a follow-up API.

## Founder Next Step

Review the import draft page locally at `http://127.0.0.1:5173/projects/project-draft-import-123/import-draft` or through the start page with API-mode mocks in the E2E. Before production release, apply `00013_sprint15_draft_import.sql` to the target Supabase database and then deploy API/web together.
