# Sprint 14 Safety Hardening Report

Date: 2026-06-14
Branch: `codex/narraza-audit-recovery-sprint-0`
Status: implemented and verified with local API using `.env.production` Supabase credentials and mock AI provider

## Scope

Sprint 4 recovery from `docs/superpowers/plans/2026-06-13-narraza-audit-recovery-sprint-plan.md`:

- Validate AI output before prose or copy becomes usable.
- Persist validation reports for audit and repair workflows.
- Require explicit user action before safe repair.
- Gate future reveal leakage through the context packet preview and validator.
- Add per-user/per-project daily debit caps and cooldown checks before provider calls.
- Verify validator, cost guard, and cross-sprint smoke coverage.

## Changes

- Added `supabase/migrations/00012_sprint14_safety_validation.sql`.
  - The plan named `00011_sprint14_safety_validation.sql`, but `00011_sprint13_generation_type_contracts.sql` already exists. Sprint 4 therefore uses `00012`.
  - Adds `validation_reports` with project/user/generation attempt, severity, checks JSON, repair status, repair linkage, metadata, and timestamps.
  - Adds `ai_usage_daily_caps` for per-user/per-project generation caps.
  - Adds indexes, RLS policies, and authenticated/service-role grants.
- Added `apps/api/src/services/output-validator.ts`.
  - Checks empty output, future reveal leakage, raw prompt/context leakage, provider/model/source leakage, beat requirement coverage, and mobile prose length bounds.
  - Exposes `assertAiOutputUsable` so unsafe output fails before persistence as usable prose/copy.
  - Persists validation reports best-effort.
- Added `apps/api/src/services/safe-repair.ts`.
  - Requires `confirmation: "REPAIR_AI_OUTPUT"` before returning a repair instruction.
  - Does not silently rewrite output.
- Added `apps/api/src/services/ai-rate-limit.ts`.
  - Checks daily cap rows and same-day credit debits.
  - Blocks repeated failed generation attempts with a cooldown.
- Updated `apps/api/src/services/context-packet-safety.ts`.
  - Filters common Indonesian stopwords out of future-reveal forbidden concepts.
  - Prevents normal prose words like `dan`, `yang`, `belum`, and `bab` from blocking safe output.
- Updated `apps/api/src/services/mock-ai-provider.ts`.
  - Keeps mock success output neutral so it does not trip future-reveal gates.
- Wired safety checks into:
  - `apps/api/src/services/prose-beat-generation.ts`
  - `apps/api/src/services/prose-rewrite-generation.ts`
  - `apps/api/src/services/publish-copy-ai-generation.ts`
  - `apps/api/src/routes/ai.ts`
- Added API route:
  - `POST /api/projects/:id/ai/safe-repair`
- Added tests and smoke command:
  - `apps/api/scripts/sprint14-safety-contracts.test.mts`
  - `scripts/sprint14-safety-smoke-api.ps1`
  - `npm run test:sprint14-safety -w @vibenovel/api`
  - `npm run smoke:api:sprint14`
- Updated Sprint 8/9 API smoke scripts:
  - Read `SUPABASE_SERVICE_ROLE_KEY` from env before falling back to local Supabase CLI.
  - Fall back to service-role admin user creation when the target Supabase rejects public signup.

## Verification

PASS:

- Red test first: `npx tsx scripts/sprint14-safety-contracts.test.mts`
  - Initial failure was expected because `output-validator.ts` did not exist yet.
- `npm run test:sprint14-safety -w @vibenovel/api`
  - PASS `Sprint 14 safety contracts`
- `npm run typecheck:api`
- `npm run smoke:api:sprint14`
- `npm run typecheck`
- `npm run lint`
  - PASS with 0 errors and 36 warnings. Warnings are existing project warnings, not new Sprint 4 errors.
- `npm run build:api`
  - PASS dry-run. Wrangler emitted an update notice.
- `npm run smoke:api:sprint8` with local API `127.0.0.1:8787`, `.env.production` Supabase, `AI_PROVIDER_MOCK=true`
  - PASS: 20 pass, 0 fail, 3 skip/not run.
- `npm run smoke:api:sprint9` with local API `127.0.0.1:8787`, `.env.production` Supabase, `AI_PROVIDER_MOCK=true`
  - PASS: 47 pass, 0 fail, 8 skip/not run.

## Debug Notes

- Initial Sprint 8/9 smoke failure was an environment mismatch: smoke tokens came from local Supabase while API `8787` was using a different Supabase runtime.
- The founder noted `.env.production` already contains Supabase URL, anon key, and service-role key.
- API `8787` was restarted with `.env.production` Supabase bindings, `AI_GENERATION_ENABLED=true`, and `AI_PROVIDER_MOCK=true`.
- Target Supabase rejected public signup in smoke runs, so Sprint 8/9 smoke scripts now use service-role admin user creation as a fallback when signup/login fails.
- A later Sprint 8 failure found a real safety bug: future-reveal forbidden concepts included stopwords like `dan`, `yang`, and `belum`; the extractor now filters those terms.

## Sprint 4 Checklist

- Done: `validation_reports` migration.
- Done: per-user/per-project daily cap table and ledger query.
- Done: repeated failure cooldown check.
- Done: validator checks for future reveal leak, raw packet leakage, provider/model leakage, empty output, beat coverage, and mobile bounds.
- Done: explicit safe repair endpoint.
- Done: context packet reveal gate excludes/summarizes future reveal data and exposes meaningful forbidden concepts through `preview.mustNotInclude`; Sprint 4 validator enforces those concepts before saving generated prose.
- Done: validator/rate-limit contract smoke.
- Done: Sprint 8 and Sprint 9 cross-sprint smoke gates pass against a consistent Supabase/API runtime.

## Founder Next Actions

- Deploy the Sprint 4 API code and migration together.
- Keep AI provider mock enabled for smoke verification, then run one controlled real-provider spot check before broader non-founder AI enablement.
- Keep production payment disabled until the later payment sprint gate passes and founder gives explicit approval.
