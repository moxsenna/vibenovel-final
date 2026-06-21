# Sprint 13 Real Generation Contracts Report

Date: 2026-06-14
Branch: `codex/narraza-audit-recovery-sprint-0`

## Scope

Sprint 1 recovery from `2026-06-13-narraza-audit-recovery-sprint-plan.md`:

- Make concept, foundation proposal, and outline generation first-class billing/generation types.
- Remove `publish_copy` alias leakage from concept/foundation/outline attempts.
- Give planning JSON enough model output budget.
- Reject AI planning output that still uses old template names (`Nadira`, `Arman`, `Siska`).
- Verify real API-mode concept/foundation/outline flow without token or mock fallback.

## Changes

- Added generation types:
  - `concept_generation`
  - `foundation_proposal`
  - `outline_generation`
- Added fixed credit policy:
  - concept/foundation: `hemat=3`, `seimbang=6`, `terbaik=12`
  - outline: `hemat=5`, `seimbang=10`, `terbaik=20`
- Added model-router planning caps:
  - concept: `3000`
  - foundation: `3000`
  - outline: `4000`
  - publish copy remains `800`
- Migrated `concept.ts`, `foundation-proposal.ts`, and `outline-generator.ts` away from `GENERATION_TYPES.publish_copy`.
- Removed `billingAlias` and `actualGenerationType` metadata from those three planning flows.
- Added `planning-output-specificity.ts` guard and wired it into parsed AI output before persistence.
- Added Supabase enum migration:
  - `supabase/migrations/00011_sprint13_generation_type_contracts.sql`
  - Applied to production via `supabase db query --linked --file ...`
  - Payment migration `00010` was not applied.
- Updated outline API-mode Playwright smoke so real-output tests do not require old template names.

## Verification

PASS:

- `npm run build:shared`
- `npm run test:generation-contracts -w @vibenovel/api`
- `npm run test:planning-output-specificity -w @vibenovel/api`
- `npm run typecheck`
- Static check: no `GENERATION_TYPES.publish_copy`, `billingAlias`, `actualGenerationType`, or planning `maxOutputTokensOverride` remains in:
  - `apps/api/src/services/concept.ts`
  - `apps/api/src/services/foundation-proposal.ts`
  - `apps/api/src/services/outline-generator.ts`

Fresh real API/browser smoke PASS:

- Local API: `http://127.0.0.1:8787`, production Supabase, AI real, provider mock false.
- Local web: `http://127.0.0.1:5177`, API mode, production Supabase public config.
- Disposable smoke user with seeded test credits.
- Created project `9dd31201-0fee-4576-9398-b445fa19192a`.
- Generated exactly 3 real AI concepts:
  - `Kutukan Kontrak Pasar`
  - `Bayangan Kontrak Kuno`
  - `Gema Pasar Malam`
- Generated foundation proposals, accepted enough proposals, and locked foundation.
- Playwright outline API-mode test passed:
  - generated 10-chapter outline
  - no `API tidak tersedia`
  - no mock fallback
  - no visible raw `planningTruth`
  - no template names
  - edited chapter 1
  - approved outline
  - locked outline

## Notes

- The first real smoke caught the production DB enum drift: code was correct but `generation_attempts.generation_type` rejected the new values. The new migration and production enum apply fixed that.
- The old outline E2E expected the deterministic `Siska/Arman` template. It now asserts real-output behavior instead.
- `00011` was applied by direct linked query, not by `db push`, specifically to avoid applying gated payment migration `00010`.
