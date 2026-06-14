# Narraza Audit Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Narraza so a signed-in writer can reliably create a project, generate three story concepts, lock a real foundation, generate and lock a ten-chapter outline, open the write room, generate/accept prose, and later import drafts, validate outputs, and manage credits safely.

**Architecture:** Fix the product in dependency order: runtime auth/env and mock boundaries first, then real generation contracts, then write-room availability, then draft import, then safety/cost gates, then creator/retention/payment expansion. Keep AI output as proposals/drafts until explicitly accepted into canon. Each sprint must leave the app in a shippable state.

**Tech Stack:** React/Vite web app, Hono API, Supabase, OpenRouter model router, Playwright E2E, TypeScript, PowerShell smoke scripts.

---

## File Map

- `apps/web/src/lib/env.ts` - production/mock boundary.
- `apps/web/src/lib/api.ts` - token refresh/retry and session clearing.
- `apps/web/src/context/AuthContext.tsx` - client session lifecycle and logout.
- `apps/web/src/components/layout/AppShell.tsx` - protected route guard.
- `apps/api/src/middleware/auth.ts` - API bearer-token validation.
- `apps/api/src/env.ts` - env gates for Supabase, AI, payments, and health flags.
- `apps/api/src/services/model-router.ts` - model selection, type caps, OpenRouter invocation.
- `apps/api/src/services/concept.ts` - concept generation.
- `apps/api/src/services/foundation-proposal.ts` - foundation proposal generation.
- `apps/api/src/services/outline-generator.ts` - outline generation and reveal schedule drafting.
- `apps/api/src/services/outline.ts` - outline persistence and public redaction.
- `apps/api/src/services/foundation-readiness.ts` - readiness consistency.
- `apps/web/src/hooks/useConceptsData.ts` - concept UI API state.
- `apps/web/src/hooks/useFoundationFlow.ts` - foundation proposal/accept/lock UI state.
- `apps/web/src/hooks/useOutlineData.ts` - outline generate/approve/lock UI state.
- `apps/web/src/hooks/useWriteRoomData.ts` - write-room load/generate/accept UI state.
- `apps/web/src/hooks/useSettingsData.ts` - quality-mode persistence and usage display.
- `apps/web/src/pages/SettingsPage.tsx` - cost estimate display.
- `apps/web/src/routes/index.tsx` and `apps/web/src/routes/paths.ts` - add future import draft route.
- `apps/api/src/routes/index.ts` - register future draft import and validation routes.
- `supabase/migrations/*.sql` - add missing tables for draft import, validation reports, gates, and rate limits.
- `.github/workflows/ci.yml` - expand CI coverage beyond auth/settings.
- `apps/web/e2e/*.spec.ts` - story flow, settings, write room, import draft, and safety tests.
- `scripts/*.ps1` - production/staging smoke gates.
- `docs/audit/11-sprint-12-18-execution-checklist.md` - update only after verified completion.
- `docs/97-sprint-13-real-generation-report.md` through `docs/102-sprint-18-payment-enablement-report.md` - one report per completed sprint.

---

## Sprint 0: Stabilize Production Runtime and Auth

**Outcome:** No signed-in production flow shows `API tidak tersedia (Invalid or expired access token)` due to web/API Supabase mismatch, missing auth env, stale token retry failure, or accidental mock/demo fallback.

**Files:**
- Modify: `scripts/operator-production-api-web-deploy.ps1`
- Modify: `scripts/operator-production-supabase-baseline.ps1`
- Modify: `scripts/build-production-web.ps1`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/routes/health.ts`
- Modify: `apps/web/e2e/auth-settings-regression.spec.ts`
- Create: `docs/97a-sprint-0-runtime-auth-report.md`

### Tasks

- [ ] Add a production env audit output that confirms web and API use the same Supabase project ref without printing secrets.
- [ ] Make `/api/health` expose safe booleans only: Supabase URL present, anon key present, service role present, AI enabled, AI provider mock, OpenRouter key present, payment enabled, payment mock.
- [ ] Add a smoke command that logs in with a real founder account token and checks `/api/me`, `/api/credits/balance`, `/api/projects`, `/api/projects/:id/concepts`, `/foundation`, `/outline`.
- [ ] Extend Playwright auth regression to verify logout clears dashboard content and redirects from `/dashboard` to `/login`.
- [ ] Confirm production build always forces `VITE_USE_MOCKS=false` and blocks staging Supabase refs.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
npm run build:web:production
npm run build:api
```

- [ ] Run impacted auth smoke:

```powershell
npm run operator:production:supabase:baseline
npm run operator:production:api-web:deploy
```

- [ ] Write `docs/97a-sprint-0-runtime-auth-report.md` with concrete dates, URLs tested, and pass/fail evidence.

**Exit Gate:** Signed-in founder can reload dashboard and settings without token errors; signed-out user cannot see dashboard; API health proves required bindings are present.

---

## Sprint 1: Finish Real Generation Contracts

**Outcome:** Concept, foundation, and outline generation have first-class generation types, correct billing/cost policy, sufficient token budgets, and no `publish_copy` alias leakage.

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `packages/shared/src/domain.ts`
- Modify: `apps/api/src/services/ai-credit-policy.ts`
- Modify: `apps/api/src/services/model-router.ts`
- Modify: `apps/api/src/services/concept.ts`
- Modify: `apps/api/src/services/foundation-proposal.ts`
- Modify: `apps/api/src/services/outline-generator.ts`
- Modify: `apps/api/src/services/generation-attempt.ts`
- Modify: `apps/web/src/services/ai.ts`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Test: `apps/web/e2e/sprint13-real-generation-flow.spec.ts`
- Create: `docs/97-sprint-13-real-generation-report.md`

### Tasks

- [ ] Add generation types: `concept_generation`, `foundation_proposal`, `outline_generation`.
- [ ] Add fixed credit costs for those generation types; recommended MVP costs:

```ts
concept_generation: { hemat: 3, seimbang: 6, terbaik: 12 }
foundation_proposal: { hemat: 3, seimbang: 6, terbaik: 12 }
outline_generation: { hemat: 5, seimbang: 10, terbaik: 20 }
```

- [ ] Update `model-router.ts` token caps:

```ts
concept_generation: 3000
foundation_proposal: 3000
outline_generation: 4000
publish_copy: 800
```

- [ ] Replace all `generationType: GENERATION_TYPES.publish_copy` aliases in `concept.ts`, `foundation-proposal.ts`, and `outline-generator.ts`.
- [ ] Remove `billingAlias: "publish_copy"` metadata from concept/foundation/outline attempts.
- [ ] Keep `actualGenerationType` only if useful for backwards analytics; otherwise remove it.
- [ ] Ensure failed JSON parse refunds credits and returns a safe 502 user message.
- [ ] Add prompt specificity checks: generated names and summaries must be derived from intake/concept/foundation, not template names like Nadira/Arman/Siska.
- [ ] Add Playwright E2E that covers: create project, intake messages, generate three concepts, select one, generate foundation proposals, accept enough proposals, lock foundation, generate ten-chapter outline, verify `planningTruthRedacted=true`.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
npm run build:shared
npm run build:api
npm run build:web
cd apps/web
npx playwright test e2e/sprint13-real-generation-flow.spec.ts --retries=1
```

- [ ] Write `docs/97-sprint-13-real-generation-report.md`.

**Exit Gate:** The original failing tests for three concepts and ten-chapter outline pass against API mode without token errors, without mock data, and without `publish_copy` billing aliases.

---

## Sprint 2: Write Room Reliability and Mobile Reading

**Outcome:** `/projects/:id/write` opens after `outline_locked`, creates/loads a writing session, generates beat prose, accepts AI prose as current source, and renders usable mobile layout.

**Files:**
- Modify: `apps/api/src/services/write-snapshot.ts`
- Modify: `apps/api/src/services/write-session.ts`
- Modify: `apps/api/src/services/prose-beat-generation.ts`
- Modify: `apps/api/src/services/prose-draft.ts`
- Modify: `apps/web/src/hooks/useWriteRoomData.ts`
- Modify: `apps/web/src/pages/WritePage.tsx`
- Modify: `apps/web/src/components/writer/WriterMobileLayout.tsx`
- Test: `apps/web/e2e/sprint14-write-room-flow.spec.ts`
- Create: `docs/98a-sprint-write-room-report.md`

### Tasks

- [ ] Make locked-state copy precise: missing foundation lock, missing outline lock, missing chapter outline, insufficient credit, AI disabled, or provider unavailable.
- [ ] Ensure `createOrLoadWritingSessionForOwner` advances workflow from `outline_locked` to `writing` only after session creation succeeds.
- [ ] Ensure `make-current` sets the accepted AI prose version as current and keeps previous versions readable.
- [ ] Add mobile viewport E2E for `375x812` and `430x932`.
- [ ] Verify mobile write room shows: chapter title, beat list, editor, AI assistant, credit cost, and no clipped/overlapping primary controls.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
cd apps/web
npx playwright test e2e/sprint14-write-room-flow.spec.ts --project=chromium --retries=1
```

- [ ] Write `docs/98a-sprint-write-room-report.md`.

**Exit Gate:** The original failing write-room tests pass: route opens, prose generation works, generated prose can be accepted as current, and mobile editor is visible.

---

## Sprint 3: Retire Unsafe Mock Fallbacks From Authenticated API Mode

**Outcome:** Mock data remains available only for explicit demo/dev mode, never as silent fallback for authenticated API flows.

**Files:**
- Modify: `apps/web/src/lib/env.ts`
- Modify: `apps/web/src/lib/hook-fallback.ts`
- Modify: `apps/web/src/hooks/useConceptsData.ts`
- Modify: `apps/web/src/hooks/useFoundationData.ts`
- Modify: `apps/web/src/hooks/useFoundationFlow.ts`
- Modify: `apps/web/src/hooks/useOutlineData.ts`
- Modify: `apps/web/src/hooks/useWriteRoomData.ts`
- Modify: `apps/web/src/hooks/useDashboardData.ts`
- Modify: `apps/web/e2e/sprint10a-mock-boundary-regression.spec.ts`
- Optional later delete: `apps/web/src/mocks/*` after demo mode is moved to fixtures.

### Tasks

- [ ] Replace silent `allowMockFallback()` in authenticated API hooks with explicit `source="error"` and user-facing retry copy.
- [ ] Keep mock mode only behind `shouldUseMocks() === true` in development/test.
- [ ] Add regression tests that API 500/401 does not show demo project/concepts/foundation/write room.
- [ ] Remove `demo-project-*` IDs from any production navigation path.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
cd apps/web
npx playwright test e2e/sprint10a-mock-boundary-regression.spec.ts e2e/auth-settings-regression.spec.ts
```

**Exit Gate:** In API mode, failed API calls show honest errors and never populate demo content.

---

## Sprint 4: Safety Hardening and Cost Guard

**Outcome:** AI output is validated before becoming usable, repair is explicit, future knowledge is gated, and AI usage has rate/cost protection before any non-founder expansion.

**Files:**
- Create: `supabase/migrations/00011_sprint14_safety_validation.sql`
- Create: `apps/api/src/services/output-validator.ts`
- Create: `apps/api/src/services/safe-repair.ts`
- Create: `apps/api/src/services/ai-rate-limit.ts`
- Modify: `apps/api/src/services/prose-beat-generation.ts`
- Modify: `apps/api/src/services/prose-rewrite-generation.ts`
- Modify: `apps/api/src/services/publish-copy-ai-generation.ts`
- Modify: `apps/api/src/services/context-packet-builder.ts`
- Modify: `apps/api/src/routes/ai.ts`
- Test: API smoke script for validator and rate limits.
- Create: `docs/98-sprint-14-safety-hardening-report.md`

### Tasks

- [ ] Add `validation_reports` table with project, user, generation attempt, severity, checks JSON, repair status, and timestamps.
- [ ] Add per-user/per-project daily AI debit cap table or ledger query.
- [ ] Add cooldown check for repeated generation failures.
- [ ] Add validator checks:

```text
no future reveal leak
no raw prompt/context packet fields returned
no forbidden provider/model/source strings in user-facing text
no empty prose output
chapter beat requirement coverage
safe mobile prose length bounds
```

- [ ] Add Safe Repair endpoint only for explicit user action; do not silently rewrite.
- [ ] Add context-packet knowledge gate so future payoff/reveal data is summarized or excluded before the relevant chapter.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
npm run build:api
npm run smoke:api:sprint8
npm run smoke:api:sprint9
```

- [ ] Write `docs/98-sprint-14-safety-hardening-report.md`.

**Exit Gate:** AI can be safely enabled beyond founder only after validator, repair, leak gate, and cost guard all pass.

---

## Sprint 5: Draft Import and Continuation

**Outcome:** Writers with existing drafts can import text for analysis, receive genre/character/conflict/readership signals, and convert findings into proposals without mutating canon directly.

**Files:**
- Create: `supabase/migrations/00012_sprint15_draft_import.sql`
- Create: `apps/api/src/services/draft-import.ts`
- Create: `apps/api/src/routes/draft-import.ts`
- Modify: `apps/api/src/routes/index.ts`
- Create: `apps/web/src/pages/DraftImportPage.tsx`
- Create: `apps/web/src/hooks/useDraftImportData.ts`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/paths.ts`
- Modify: `apps/web/src/config/startProjectOptions.ts`
- Test: `apps/web/e2e/sprint15-draft-import-flow.spec.ts`
- Create: `docs/99-sprint-15-draft-import-report.md`

### Tasks

- [ ] Add `draft_imports` table: project_id, owner_id, content_hash, excerpt_preview, word_count, status, metadata, created_at.
- [ ] Add `draft_import_signals` or reuse intake signal/proposal tables with source `imported_draft`.
- [ ] Add API:

```text
POST /api/projects/:id/draft-imports
GET /api/projects/:id/draft-imports/:draftImportId
POST /api/projects/:id/draft-imports/:draftImportId/extract-signals
```

- [ ] Reuse `extractSignalsFromText` from intake service, then expand it for long draft text.
- [ ] UI route: `/projects/:id/import-draft`.
- [ ] Start option `has_draft` must route to draft import, not normal intake.
- [ ] Detection panels must show concrete extracted genre, characters, conflict, target reader, continuity warnings, and proposal CTA.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
cd apps/web
npx playwright test e2e/sprint15-draft-import-flow.spec.ts --retries=1
```

- [ ] Write `docs/99-sprint-15-draft-import-report.md`.

**Exit Gate:** Original draft import E2E passes without 401 and detection panels no longer stay empty.

---

## Sprint 6: Creator Mode and Advanced Controls

**Outcome:** Advanced creator mode is an explicit opt-in that persists, exposes stronger planning controls, and never breaks the default simple mode.

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `apps/api/src/services/project-settings.ts`
- Modify: `apps/web/src/hooks/useSettingsData.ts`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Create: `apps/web/src/components/settings/CreatorModeSection.tsx`
- Modify: `apps/web/src/hooks/useOutlineData.ts`
- Modify: `apps/web/src/pages/OutlinePage.tsx`
- Test: `apps/web/e2e/sprint16-creator-mode.spec.ts`
- Create: `docs/100-sprint-16-creator-mode-report.md`

### Tasks

- [ ] Add setting `creatorMode: "simple" | "advanced"`.
- [ ] Persist creator mode in project settings API.
- [ ] Settings page must reload selected mode correctly.
- [ ] Advanced mode reveals optional outline controls: chapter count, reveal density, retention intensity, and prose style target.
- [ ] Keep simple mode defaults unchanged.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
cd apps/web
npx playwright test e2e/sprint16-creator-mode.spec.ts
```

- [ ] Write `docs/100-sprint-16-creator-mode-report.md`.

**Exit Gate:** User can switch to advanced creator mode, reload, and see advanced controls without regressing simple flow.

---

## Sprint 7: Retention Intelligence for Serial Novel Quality

**Outcome:** Narraza helps generate serial fiction with hook, payoff, mini-victory, agency, suffering balance, and mobile readability scoring across outline and prose.

**Files:**
- Create: `apps/api/src/services/retention-intelligence.ts`
- Modify: `apps/api/src/services/outline-generator.ts`
- Modify: `apps/api/src/services/prose-beat-generation.ts`
- Modify: `apps/web/src/components/outline/OutlineTrackingPanels.tsx`
- Modify: `apps/web/src/components/writer/WriterAssistantPanel.tsx`
- Test: `apps/web/e2e/sprint17-retention-intelligence.spec.ts`
- Create: `docs/101-sprint-17-retention-report.md`

### Tasks

- [ ] Add scoring dimensions: hook strength, open loop clarity, payoff distance, mini victory cadence, protagonist agency, suffering balance, cliffhanger quality, mobile paragraph readability.
- [ ] Generate retention recommendations as advisory metadata, not hard canon.
- [ ] Display warnings in outline and write room.
- [ ] Add tests for low-agency and no-hook cases.
- [ ] Run:

```powershell
npm run typecheck
npm run lint
cd apps/web
npx playwright test e2e/sprint17-retention-intelligence.spec.ts
```

- [ ] Write `docs/101-sprint-17-retention-report.md`.

**Exit Gate:** Writer gets concrete retention guidance before publishing or continuing the next chapter.

---

## Sprint 8: Payment Enablement and Credit Production Gate

**Outcome:** Credit topup can be enabled only after atomic grants, webhook validation, duplicate protection, and founder approval are verified.

**Files:**
- Modify: `scripts/operator-production-infra-unblock.ps1`
- Modify: `scripts/operator-production-api-web-deploy.ps1`
- Modify: `apps/api/src/services/credit-topup.ts`
- Modify: `apps/api/src/services/credit-topup-grant.ts`
- Modify: `apps/api/src/routes/payment-webhooks.ts`
- Modify: `apps/web/src/pages/CreditTopupPage.tsx`
- Test: `scripts/sprint10-duitku-smoke-api.ps1`
- Create: `docs/102-sprint-18-payment-enablement-report.md`

### Tasks

- [ ] Verify `00010_atomic_grant_credit_topup_rpc.sql` is applied in production.
- [ ] Run Duitku sandbox callback matrix with duplicate, foreign app, malformed signature, and paid callback cases.
- [ ] Ensure credit grant is webhook-only and return page never marks payment paid.
- [ ] Enable `CREDIT_TOPUP_ENABLED=true` only after founder approval.
- [ ] Keep `PAYMENT_PROVIDER_MOCK=false` only when real provider keys and callback URL are public.
- [ ] Run:

```powershell
npm run test:duitku-signature
npm run test:atomic-grant
npm run smoke:api:sprint10:duitku
```

- [ ] Write `docs/102-sprint-18-payment-enablement-report.md`.

**Exit Gate:** Payment can be enabled without risking double-grant, fake grant, cross-app grant, or secret leakage.

---

## Cross-Sprint Rules

- [ ] Do not mark a checklist item done until code, migration, tests, and report are complete.
- [ ] Do not enable AI for non-founder before Sprint 4 passes.
- [ ] Do not enable production payment before Sprint 8 passes and founder gives explicit Go.
- [ ] Do not use mock data as authenticated API fallback.
- [ ] Do not mutate canon directly from AI or draft import; use proposals/drafts first.
- [ ] Keep reports factual: command, date, environment, result, known residual risks.

## Recommended Execution Order

1. Sprint 0 - runtime/auth.
2. Sprint 1 - generation contracts.
3. Sprint 2 - write room.
4. Sprint 3 - mock fallback retirement.
5. Sprint 4 - safety/cost gate.
6. Sprint 5 - draft import.
7. Sprint 6 - creator mode.
8. Sprint 7 - retention intelligence.
9. Sprint 8 - payment enablement.

## Minimum Product Done Definition

Narraza is considered functional for the original novel-generation plan when these flows pass in API mode:

- Sign in, reload dashboard, and log out cleanly.
- Create project from no idea or rough idea.
- Generate exactly three real concepts and select one.
- Generate foundation proposals from concept and intake.
- Accept enough proposals and lock foundation.
- Generate ten-chapter outline from locked foundation.
- Lock outline.
- Open write room on desktop and mobile.
- Generate beat prose.
- Accept generated prose as current source.
- Show numeric credit costs and updated balance behavior.
- Never silently fall back to demo content in authenticated API mode.

## Verification Bundle

Run this after Sprint 2, then again after every later sprint:

```powershell
npm run typecheck
npm run lint
npm run build:shared
npm run build:api
npm run build:web
cd apps/web
npx playwright test e2e/auth-settings-regression.spec.ts --retries=1
npx playwright test e2e/sprint13-real-generation-flow.spec.ts --retries=1
npx playwright test e2e/sprint14-write-room-flow.spec.ts --retries=1
```

Production verification after deploy:

```powershell
npm run operator:production:supabase:baseline
npm run operator:production:api-web:deploy
npm run deploy:web:production
```

## Self-Review

- Audit auth/session failures are covered by Sprint 0.
- Concept/foundation/outline failures are covered by Sprint 1.
- Write room and mobile failures are covered by Sprint 2.
- Mock/default/demo leakage is covered by Sprint 3.
- Safety, validator, future knowledge, and cost risks are covered by Sprint 4.
- Draft import is covered by Sprint 5.
- Advanced creator mode is covered by Sprint 6.
- Retention planning is covered by Sprint 7.
- Payment enablement is covered by Sprint 8.
- No sprint depends on payment to make novel generation functional.
