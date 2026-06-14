# Sprint 14 Write Room Recovery Report

Date: 2026-06-14
Branch: `codex/narraza-audit-recovery-sprint-0`

## Scope

Sprint 2 recovery from `docs/superpowers/plans/2026-06-13-narraza-audit-recovery-sprint-plan.md`:

- Open `/projects/:id/write` only after foundation and outline are locked.
- Create or load a writing session from `outline_locked` without advancing workflow before session creation succeeds.
- Generate and accept AI prose while keeping older prose versions readable.
- Make mobile write room usable at common phone widths.
- Show precise blocked-state copy instead of generic API errors.

## Changes

- Added explicit write-room gate copy for missing foundation lock, missing outline lock, missing chapter outline, insufficient credit, disabled AI, and provider failures.
- Kept project workflow advancement to `writing` after writing session and writing state creation succeed.
- Verified `make-current` demotes only other versions for the same beat and does not delete older versions.
- Added mobile E2E coverage for `375x812` and `430x932`.
- Added API contract test coverage for write-room gates and `make-current` behavior.

## Verification Evidence

Command: `npm run test:write-room-contracts -w @vibenovel/api`

Result: PASS

Evidence: `PASS write room gates and make-current contracts are explicit`

Command: `npx playwright test e2e/sprint14-write-room-flow.spec.ts --project=chromium --retries=1`

Result: PASS

Evidence: 5 passed:

- missing outline lock copy
- missing foundation lock copy
- mobile layout at `375x812`
- mobile layout at `430x932`
- AI provider/credit error copy

Command: `npm run typecheck`

Result: PASS

Command: `npm run lint`

Result: PASS with warnings, 0 errors.

Command: `npm run build:shared`

Result: PASS

Command: `npm run build:web`

Result: PASS with Vite chunk-size warning.

Command: `npm run build:api`

Result: PASS dry-run with Wrangler version warning.

## Residual Risks

- This run used mocked Playwright API responses, not a live production write-room browser smoke.
- Later Sprint 4 safety validator and rate/cost guard are still required before broader non-founder AI rollout.

## Exit Gate Status

Pass for local recovery coverage.

Write room route gating, session creation contract, accepted-current prose behavior, AI error copy, and mobile layout regression coverage all pass locally.
