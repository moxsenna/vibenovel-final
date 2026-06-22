# Task 2026-06-14 - Sprint 4 Safety Hardening

**Date:** 2026-06-14
**Sprint:** sprint-audit / Sprint 4
**Status:** implementation complete; Sprint 4 smoke gates passed

## Task goal

Continue Sprint 4 from `docs/superpowers/plans/2026-06-13-narraza-audit-recovery-sprint-plan.md`: add safety validation, explicit repair, reveal leakage checks, and AI cost/rate guards before any non-founder expansion.

## Files created/changed

- `apps/api/scripts/sprint14-safety-contracts.test.mts`
- `apps/api/src/services/output-validator.ts`
- `apps/api/src/services/safe-repair.ts`
- `apps/api/src/services/ai-rate-limit.ts`
- `apps/api/src/services/context-packet-safety.ts`
- `apps/api/src/services/mock-ai-provider.ts`
- `apps/api/src/routes/ai.ts`
- `apps/api/src/services/prose-beat-generation.ts`
- `apps/api/src/services/prose-rewrite-generation.ts`
- `apps/api/src/services/publish-copy-ai-generation.ts`
- `apps/api/package.json`
- `package.json`
- `scripts/sprint14-safety-smoke-api.ps1`
- `scripts/sprint8-smoke-api.ps1`
- `scripts/sprint9-smoke-api.ps1`
- `supabase/migrations/00012_sprint14_safety_validation.sql`
- `docs/98-sprint-14-safety-hardening-report.md`
- `.agent-logs/sprint-audit/task-2026-06-14-sprint-4-safety-hardening.md`

## Commands run

| Command | Result |
|---|---|
| `npx tsx scripts/sprint14-safety-contracts.test.mts` | RED first, missing `output-validator.ts` |
| `npm run test:sprint14-safety -w @vibenovel/api` | PASS |
| `npm run typecheck:api` | PASS after strict-null fix in `ai-rate-limit.ts` |
| `npm run smoke:api:sprint14` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errors, 36 warnings |
| `npm run build:api` | PASS dry-run |
| `npm run smoke:api:sprint8` with `.env.production` Supabase and mock AI | PASS, 20 pass, 0 fail |
| `npm run smoke:api:sprint9` with `.env.production` Supabase and mock AI | PASS, 47 pass, 0 fail |
| `npm run build:api` | PASS dry-run |
| `npm run lint` | PASS, 0 errors, 36 warnings |

## Results

- Added validator, validation report persistence, and fail-before-save enforcement for prose beat, prose rewrite, and publish copy output.
- Added explicit safe repair route requiring `confirmation: "REPAIR_AI_OUTPUT"`.
- Added daily cap and cooldown guard before provider calls.
- Added Sprint 14 contract and smoke command.
- Fixed reveal-gate forbidden concept extraction so stopwords do not cause false AI output blocks.
- Fixed Sprint 8/9 smoke scripts to read service-role key from env and admin-create smoke users when public signup is blocked.
- Verified typecheck, lint, API build, Sprint 14 safety smoke, Sprint 8 smoke, and Sprint 9 smoke.

## Resolved blocker

Sprint 8 and Sprint 9 initially created auth tokens against local Supabase while API `8787` was using another Supabase runtime. The founder pointed to `.env.production`; restarting API with those bindings and passing the same Supabase URL/anon key into smoke resolved `/api/me` 401. Production Supabase public signup also returned 400/429 in places, so smoke now falls back to service-role admin user creation.

## Next recommended task

Proceed to Sprint 5 draft import, while keeping broader AI rollout behind a deployment plus controlled real-provider spot check.
