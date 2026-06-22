# Narraza Credit System v2 — Full Implementation Plan

**Status:** Planning only — no code, no migration, no pricing change, no model routing change, no balance change, no payment behavior change.
**Source of truth (product):** [docs/narraza-final-credit-system-agent-spec.md](narraza-final-credit-system-agent-spec.md)
**Baseline audit verdict:** `PARTIAL GO`
**Author role:** Senior full-stack engineer / product architect / billing-safety reviewer / technical planner
**Date context:** 2026-06-18

> This document is the execution blueprint that a coding agent (or human) follows phase-by-phase. Each phase is independently shippable, independently reversible, and ordered so that price changes never land before the safety scaffolding that protects them.

---

## 1. Executive Summary

Narraza already has a **structurally correct** action-based credit system: debit-before-call, refund-on-failure, idempotency, append-only `credit_ledger`, `generation_attempts` tracking, top-up products, and server-authoritative model/cost (no client override). The audit verdict `PARTIAL GO` means: **keep the architecture, fix the numbers and the fragmentation — incrementally.**

The plan splits the work into **11 phases (0–10)**. The guiding principle: **separate "where pricing lives" from "what the price is."** Phases 0–3 move and harden pricing **without changing any number**. Only after the snapshot/metadata and frontend-source-of-truth are in place do Phases 4–7 change actual prices. Phase 8 plans model routing (gated on OpenRouter verification). Phases 9–10 finish UX and launch gates.

Two **founder decisions are hard blockers**: (a) what to do with private-beta balances when the credit scale jumps ~100–400×, and (b) whether v2 pricing applies to all users at once. Neither is an engineering call.

The single biggest engineering risk being retired is **pricing fragmentation across 3 sources** (server policy table, a literal `1` in intake, and a hardcoded table in the web app). Phase 1 collapses that to one server source; Phase 3 makes the frontend consume it.

---

## 2. Current Repo Baseline

What already exists and is healthy (do **not** rebuild):

| Capability | Location | Notes |
|---|---|---|
| Action-based billing | [apps/api/src/services/ai-credit-policy.ts](../apps/api/src/services/ai-credit-policy.ts) | `getCreditCostForGeneration()` server-side |
| Debit / refund (idempotent) | [apps/api/src/services/credit-ledger.ts](../apps/api/src/services/credit-ledger.ts) | `debitCreditsForAttempt` (:239), `refundCreditsForAttempt` (:331), idempotent per `attemptId+reason+direction` |
| Generation attempt tracking | [apps/api/src/services/generation-attempt.ts](../apps/api/src/services/generation-attempt.ts) | stores provider/model/tokens/`estimated_cost_usd`/`credit_cost`/status |
| Append-only ledger | migration [00008](../supabase/migrations/00008_sprint8_ai_generation_credit.sql) | refund = new row, never mutate |
| Top-up products + orders | migration [00009](../supabase/migrations/00009_sprint10_payment_topup.sql), [credit-topup.ts](../apps/api/src/services/credit-topup.ts) | `creditsToGrant = credits + bonus_credits` |
| Model routing (separated from pricing) | [apps/api/src/services/model-router.ts](../apps/api/src/services/model-router.ts) | `MODEL_ALLOWLIST`, env override, no client model |
| Internal cost map (not billed) | [apps/api/src/services/model-cost-map.ts](../apps/api/src/services/model-cost-map.ts) | analytics only |
| Smoke harness | [apps/api/scripts/generation-contracts.test.mts](../apps/api/scripts/generation-contracts.test.mts) | existing test entry point |

Known problems carried from the audit:

1. **Pricing in 3 places:** `ai-credit-policy.ts` `CREDIT_COST_TABLE`; literal `1` in [intake.ts:551,567,640](../apps/api/src/services/intake.ts); hardcoded `PROSE_BEAT_CREDIT_COSTS` etc. in [apps/web/src/services/ai.ts:41-77](../apps/web/src/services/ai.ts).
2. **Intake = 1 credit** (literal), bypasses central policy.
3. **Concept/prose/publish still on old scale** (concept 3, prose 5/10/20, rewrite 3/6/12, publish 3/6/12).
4. **Frontend has its own price table** → can disagree with server.
5. **Top-up packages on old scale** (starter 100, creator 320, pro 750, studio 1650).
6. **Non-prose still accepts quality mode** — publish copy reads client `qualityMode`.
7. **Model routing names in spec are future/fictional** — not in `MODEL_ALLOWLIST`, some don't exist.
8. **Migration `00011` already used** (`00011_sprint13_generation_type_contracts.sql`) → spec's suggested filename collides. **Next available number = `00021`.**
9. **Private-beta balances** are in old units; cannot be auto-multiplied (spec §15).
10. **Ledger metadata lacks pricing snapshot/version** (`buildLedgerMetadata` only stores idempotencyKey/correlationId/generationType).

---

## 3. Final Target Architecture

```
                       ┌──────────────────────────────────────┐
                       │  credit-policy-v2.ts (SINGLE SOURCE)  │
                       │  FIXED_FEATURE_CREDIT_COSTS           │
                       │  PROSE_CREDIT_COSTS[mode]             │
                       │  CREDIT_PRICING_VERSION = "v2"        │
                       │  getCreditCost({feature, qualityMode})│
                       └───────────────┬──────────────────────┘
                                       │ (server only)
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
   intake / concept            prose / rewrite / ...          publish / continuity
   (fixed cost, no mode)       (mode applies)                 (fixed cost, no mode)
         │                             │                             │
         └────────────► generation_attempts (credit_cost, model, qualityMode, featureKey)
         │                             │                             │
         └────────────► credit_ledger (debit/refund) + metadata SNAPSHOT:
                        { featureKey, qualityMode, creditCost,
                          creditPricingVersion, modelRoutingVersion,
                          model, generationAttemptId, idempotencyKey }

   model-routing-v2.ts (SEPARATE)        credit_topup_products (DB, scale v2)
   FIXED_FEATURE_MODELS                  starter/creator/pro/studio (is_active)
   PROSE_MODELS[mode]                    old products → is_active=false
   verified against MODEL_ALLOWLIST

   Frontend: reads creditCost from API responses / estimate endpoint.
             NO local price table as source of truth (fallback display only).
```

**Invariants enforced end-to-end:**
- User message = 0 credits; charge only on successful AI output; refund on failure.
- Tokens/provider/model cost = internal only; never shown to normal users.
- Quality mode (`hemat`/`seimbang`/`terbaik`) affects **prose features only**.
- Credit pricing and model routing are **separate modules**.
- Ledger rows are **append-only**; refund uses the **original debited amount**.
- Client can never supply `model`, `provider`, or `creditCost`.

---

## 4. Global Rules and Non-Negotiables

1. **Never edit applied migrations** (00001–00020). Additive only.
2. **Next migration number = `00021`** and upward. Do not reuse `00011`.
3. **Never auto-multiply or rewrite `credit_balances`** without a written founder decision.
4. **Never rewrite historical `credit_ledger` rows.** New pricing = new rows with new `creditPricingVersion`.
5. **Refund uses the original debit amount**, not the current price.
6. **Do not raise any price before Phase 2 (snapshot) and Phase 3 (frontend SoT) are merged.**
7. **Do not put unverified/future model IDs into the production `MODEL_ALLOWLIST`.**
8. **Public paid payment stays OFF** until Phase 10 launch gates pass.
9. **Backward compatibility:** during transition, non-prose endpoints **accept but ignore** `qualityMode` — never hard-reject old clients mid-migration.
10. Each phase must be **independently revertable** (feature flag, env, or isolated migration).
11. Anything unverified is marked `UNCERTAIN` with a verification method.

---

## 5. Phase Overview Table

| Phase | Name | Changes prices? | Migration? | Founder gate? | Reversible by |
|---:|---|:---:|:---:|:---:|---|
| 0 | Audit Safety & Decision Lock | No | No | **Yes** | n/a (doc only) |
| 1 | Centralize Pricing (no price change) | No | No | No | revert PR |
| 2 | Pricing Snapshot & Ledger Metadata | No | Optional | No | revert PR (additive metadata) |
| 3 | Frontend Credit Display Source of Truth | No | No | No | revert PR |
| 4 | Credit Scale v2 Top-up Products | Package only | **Yes (00021)** | **Yes (balance)** | `is_active` toggle |
| 5 | Intake & Concept Billing Finalization | **Yes** | Maybe (enum) | depends on P0 | constant flip |
| 6 | Prose Mode Final Pricing | **Yes** | Maybe (enum) | depends on P0 | constant flip |
| 7 | Non-Prose Fixed Pricing & Mode Isolation | **Yes** | No | No | constant flip |
| 8 | Model Routing v2 Planning & Verification | No | No | **Yes (timing)** | env / allowlist |
| 9 | UI/UX Credit Transparency | No | No | No | revert PR |
| 10 | Smoke / Regression / Launch Gates | No | No | **Yes (go-live)** | keep payment off |

---

## 6. Phase 0 — Audit Safety and Decision Lock

### Goal
Lock the baseline and obtain founder decisions before any billing-affecting change.

### Why This Phase Exists
Price scale jumps ~100–400×. Without a decided balance strategy and a confirmed migration number, later phases could corrupt billing or collide with applied migrations.

### Current Repo Problem
Three price sources, undecided beta-balance strategy, spec's migration filename collides with `00011`, ledger snapshot insufficient.

### Proposed Technical Approach
- Produce a **decision log** (this doc + a tracking issue).
- Confirm current enum/values via `grep -rn "ADD VALUE" supabase/migrations`.
- Confirm next migration number = `00021`.
- Enumerate blockers and route each founder decision (see §18).
- No code, no migration.

### Files Likely to Change
- None (documentation only): this file, optionally a GitHub issue / `docs/audit/` note.

### Data/Migration Impact
None. Confirm `00021` is the next free slot.

### API Impact
None.

### Frontend Impact
None.

### Billing/Audit Impact
None (planning). Establishes the audit baseline snapshot.

### Backward Compatibility Rules
N/A.

### Risks
Skipping this phase = highest risk; all later risk derives from undecided balance strategy.

### What Must NOT Be Done in This Phase
No code, no migration, no balance edits, no pricing edits.

### Tests Required
None (doc). Optionally run existing suite to capture a green baseline: `npm run test` in `apps/api`.

### Smoke Checklist
- [ ] Current enum values recorded.
- [ ] Next migration number confirmed (`00021`).
- [ ] Founder decisions §18 answered and logged.

### Acceptance Criteria
Decision log complete; all §18 questions have a recorded answer or explicit "deferred".

### Rollback Plan
N/A (no changes).

### Output Report Expected After Implementation
A short "Phase 0 Decision Log" listing each founder answer, the confirmed migration number, and the blocker list.

---

## 7. Phase 1 — Centralize Pricing Without Changing Prices

### Goal
One server-side source of truth for AI action pricing. **Prices stay identical to today.**

### Why This Phase Exists
Eliminates the 3-source fragmentation so that future price changes touch exactly one place.

### Current Repo Problem
`ai-credit-policy.ts` table + literal `1` in intake + web table. Intake bypasses the policy.

### Proposed Technical Approach
- Introduce `credit-policy-v2.ts` (or extend `ai-credit-policy.ts`) exposing `getCreditCost({ feature, qualityMode })`.
- **Seed it with the CURRENT numbers** (intake 1, concept 3, prose 5/10/20, rewrite 3/6/12, publish 3/6/12) — a pure relocation, not a re-price.
- Route **intake** through the policy: replace literal `1` (intake.ts:551/567/640) with `getCreditCost(...)`.
- Keep `CREDIT_PRICING_VERSION` constant exported (value still represents current scale; bump in Phase 5/6).
- Web changes deferred to Phase 3 (this phase is server-only).

### Files Likely to Change
- `apps/api/src/services/ai-credit-policy.ts` (or new `credit-policy-v2.ts`)
- [apps/api/src/services/intake.ts](../apps/api/src/services/intake.ts) (remove literal `1`)
- Callers that already use `getCreditCostForGeneration`: [concept.ts](../apps/api/src/services/concept.ts), [prose-beat-generation.ts](../apps/api/src/services/prose-beat-generation.ts), [prose-rewrite-generation.ts](../apps/api/src/services/prose-rewrite-generation.ts), [publish-copy-ai-generation.ts](../apps/api/src/services/publish-copy-ai-generation.ts) (no value change)

### Function/Service Candidates
`getCreditCost()` / `getCreditCostForGeneration()`, `appendUserMessageForOwner` (intake debit/refund/attempt creditCost).

### Data/Migration Impact
None.

### API Impact
None (same numbers, same responses).

### Frontend Impact
None this phase.

### Billing/Audit Impact
Intake `credit_cost` now sourced from policy (still `1`). No behavioral change.

### Backward Compatibility Rules
Numbers must be byte-for-byte identical to current. Snapshot of pre/post `getCreditCost` outputs must match.

### Risks
Accidentally changing a number while relocating. Mitigate with a table-equality unit test.

### What Must NOT Be Done in This Phase
- Do **not** change intake 1→100.
- Do **not** change concept 3→1.000.
- Do **not** change prose 5/10/20→800/1500/7500.
- Do **not** touch top-up packages or model routing.

### Tests Required
- Unit: `getCreditCost(feature, mode)` returns exactly current values for every feature/mode.
- Contract: intake attempt `credit_cost === 1` still.

### Smoke Checklist
- [ ] Typecheck passes.
- [ ] Intake debit/refund still 1.
- [ ] All feature costs unchanged.

### Acceptance Criteria
Single function returns all prices; intake no longer holds a literal; values unchanged.

### Rollback Plan
Revert PR; old table/literal restored.

### Output Report Expected After Implementation
"Pricing centralized; values unchanged" diff summary + the price-equality test output.

---

## 8. Phase 2 — Pricing Snapshot and Ledger Metadata Hardening

### Goal
Every debit/refund ledger row stores a pricing snapshot; refunds use the **original** debited amount.

### Why This Phase Exists
Required before any price increase so historical rows remain auditable and refunds stay accurate across pricing versions (spec §13A.4–13A.6).

### Current Repo Problem
`buildLedgerMetadata` ([credit-ledger.ts:54](../apps/api/src/services/credit-ledger.ts)) stores only `idempotencyKey`, `correlationId`, `generationType`. No `creditCost`, `qualityMode`, or pricing version.

### Proposed Technical Approach
- Extend metadata written on debit and refund to include:
  `featureKey`, `qualityMode`, `creditCost`, `creditPricingVersion`, `modelRoutingVersion`, `generationAttemptId`, `idempotencyKey`.
- Make refund read the original debit row's `amount` (it already looks up `existingDebit` at credit-ledger.ts:351) and **refund that exact amount** rather than a recomputed price.
- Decide: **metadata JSON is sufficient for MVP** (spec §13A.7); no explicit columns now.

### Files Likely to Change
- [apps/api/src/services/credit-ledger.ts](../apps/api/src/services/credit-ledger.ts) (`buildLedgerMetadata`, `refundCreditsForAttempt`, `CreditMutationBaseInput`)
- Callers passing metadata: intake/concept/prose/publish services (add `featureKey`, `creditPricingVersion`)

### Function/Service Candidates
`debitCreditsForAttempt`, `refundCreditsForAttempt`, `buildLedgerMetadata`.

### Data/Migration Impact
None required (metadata is `jsonb`). **Optional later:** explicit columns — out of scope for MVP. Old rows keep their (smaller) metadata; do not backfill/rewrite.

### API Impact
None user-visible.

### Frontend Impact
None.

### Billing/Audit Impact
Significant positive: every new ledger row becomes self-describing. Refund correctness hardened.

### Backward Compatibility Rules
Old ledger rows are **not** rewritten. New code must tolerate rows missing the new metadata keys.

### Risks
Refund regression if amount sourcing changes incorrectly. Mitigate with an idempotent refund test that asserts refund amount == original debit amount.

### What Must NOT Be Done in This Phase
No price change. No ledger backfill/rewrite. No column migration.

### Tests Required
- Refund uses original debit amount even if policy value differs at refund time (simulate by passing a different current price).
- Debit metadata contains all required keys.
- Duplicate refund stays idempotent.

### Smoke Checklist
- [ ] New debit rows contain snapshot keys.
- [ ] Refund equals original debit.
- [ ] Old rows still readable.

### Acceptance Criteria
Snapshot present on new rows; refund amount provably from original debit; no historical rewrite.

### Rollback Plan
Revert PR; metadata reverts to minimal set. No data migration to undo.

### Output Report Expected After Implementation
Sample debit + refund ledger metadata JSON, and the refund-amount test output.

---

## 9. Phase 3 — Frontend Credit Display Source of Truth

### Goal
UI shows credit cost from the server, not from a local hardcoded table.

### Why This Phase Exists
Closes the last fragmentation source so server price changes can never make the UI lie.

### Current Repo Problem
[apps/web/src/services/ai.ts:41-77](../apps/web/src/services/ai.ts) hardcodes `PROSE_BEAT_CREDIT_COSTS` (5/10/20) etc.; `formatPublishCopyTierCostsLabel` even hardcodes `"3/6/12 kredit"`.

### Proposed Technical Approach
- Ensure relevant API responses already include `creditCost` (attempt/preflight responses do); add a lightweight **estimate endpoint** if a pre-action value is needed without creating an attempt, e.g. `GET /api/credits/estimate?feature=prose_beat&qualityMode=hemat` returning `{ creditCost, creditPricingVersion }`.
- Refactor web helpers to consume server value; keep the local table **only as a last-resort offline fallback**, clearly labeled non-authoritative.
- Add cop-writing hooks for pre-action / post-success / failure-refund (full copy in Phase 9).

### Files Likely to Change
- [apps/web/src/services/ai.ts](../apps/web/src/services/ai.ts)
- Web hooks: [useWriteRoomData.ts](../apps/web/src/hooks/useWriteRoomData.ts), [useConceptsData.ts](../apps/web/src/hooks/useConceptsData.ts), [usePublishData.ts](../apps/web/src/hooks/usePublishData.ts)
- Possibly [apps/api/src/routes/credits.ts](../apps/api/src/routes/credits.ts) (estimate endpoint), `apps/api/src/routes/ai.ts`

### Function/Service Candidates
`getProseBeatCreditCost` (web), `listActiveCreditTopupProducts`, new `estimateCreditCost` handler.

### Data/Migration Impact
None.

### API Impact
Optional new read-only `GET /api/credits/estimate`. No mutation.

### Frontend Impact
Labels now reflect server price. Add graceful fallback when API is unavailable.

### Billing/Audit Impact
None (read-only display). Eliminates UI/server divergence risk.

### Backward Compatibility Rules
Fallback table must never silently override server value when server value is present.

### Risks
UI flicker / loading state on estimate fetch. Mitigate with cached product/cost fetch on page load.

### What Must NOT Be Done in This Phase
No price change. Do not delete the fallback entirely (offline resilience) — just demote it from "source of truth."

### Tests Required
- Web: label renders server value; fallback only when API errors.
- API: estimate endpoint returns correct `creditCost` per feature/mode.

### Smoke Checklist
- [ ] Prose/concept/publish labels match server.
- [ ] Estimate endpoint matches `getCreditCost`.
- [ ] API-down fallback renders without crash.

### Acceptance Criteria
No web component reads a hardcoded price as authoritative; server is the source.

### Rollback Plan
Revert PR; web reverts to local table.

### Output Report Expected After Implementation
Screenshot/markup of labels sourced from API + estimate endpoint contract.

---

## 10. Phase 4 — Credit Scale v2 Top-up Products

### Goal
Replace top-up packages with the final scale:

| Slug | Price IDR | Credits (base + bonus) | Total |
|---|---:|---|---:|
| starter | 49.000 | 20.000 + 0 | 20.000 |
| creator | 99.000 | 50.000 + 5.000 | 55.000 |
| pro | 199.000 | 120.000 + 10.000 | 130.000 |
| studio | 399.000 | 270.000 + 30.000 | 300.000 |

### Why This Phase Exists
Top-up scale must match AI action scale so deductions feel clean; bigger package = cheaper per credit (spec §2.2).

### Current Repo Problem
Old products (starter 100, creator 320, pro 750, studio 1650) with `proposalPricing` metadata.

### Proposed Technical Approach
- New migration **`00021_credit_scale_v2_topup_products.sql`** (NOT `00011`).
- `INSERT ... ON CONFLICT (slug) DO UPDATE` for the four v2 rows with `metadata.creditScaleVersion='v2'`.
- **Old products:** the four slugs are upserted in place; if any legacy slug is being retired instead of updated, set `is_active=false` — **never DELETE** (historical orders FK-reference `product_id`).
- Top-up grant path stays append-only ledger (unchanged).

### Files Likely to Change
- `supabase/migrations/00021_credit_scale_v2_topup_products.sql` (NEW)
- Possibly [packages/shared/src/enums.ts](../packages/shared/src/enums.ts) `CREDIT_TOPUP_PRODUCT_SLUGS` (unchanged if slugs identical)
- No change to [credit-topup.ts](../apps/api/src/services/credit-topup.ts) logic (`credits + bonus` already correct)

### Migration Candidate
`00021_credit_scale_v2_topup_products.sql` — additive upsert; idempotent; transaction-wrapped.

### Data/Migration Impact
Updates product catalog rows. Existing `credit_topup_orders` keep their snapshotted `amount_idr`/`credits_to_grant` (orders store their own values), so history stays intact.

### API Impact
`GET /api/credits/topup/products` returns v2 catalog. No checkout behavior change.

### Frontend Impact
Pricing page shows new packages (display only; payment stays off until Phase 10).

### Billing/Audit Impact
New purchases would grant v2 credits — but payment remains OFF, so no real grants yet.

### Backward Compatibility Rules
Old orders must remain readable and correctly mapped. Do not delete products. Do not alter past orders.

### Risks
- **P0 (balance):** v2 packages imply v2 action prices; releasing packages while users still hold old-scale balances is confusing. Gate on founder balance decision (§18 Q1).
- Showing v2 packages while payment is off may confuse testers — gate display (§18 Q7).

### What Must NOT Be Done in This Phase
- Do not auto-change any user's `credit_balances`.
- Do not enable public payment.
- Do not edit/delete migration 00009 or its rows destructively.

### Tests Required
- Migration applies cleanly on a fresh DB and on a DB with old products.
- `listActiveCreditTopupProducts` returns 4 v2 products with correct totals.
- Old order rows still join to their product.

### Smoke Checklist
- [ ] Products endpoint = starter 20.000 / creator 55.000 / pro 130.000 / studio 300.000.
- [ ] Old orders intact.
- [ ] Payment still off.

### Acceptance Criteria
v2 catalog live in DB and API; historical orders unaffected; payment disabled.

### Rollback Plan
Re-run an inverse upsert restoring old values, or toggle `is_active`. No destructive ops to undo.

### Output Report Expected After Implementation
Migration filename, products endpoint JSON, proof old orders still resolve.

---

## 11. Phase 5 — Intake and Concept Billing Finalization

### Goal
- intake reply = **100**
- concept refinement reply = **150** (only if the feature is built — see Q4)
- generate 3 concepts = **1.000**

### Why This Phase Exists
First real price increase; only safe after Phases 1–3 (central price, snapshot, frontend SoT).

### Current Repo Problem
Intake 1 (literal, now via policy after P1), concept generate 3.

### Proposed Technical Approach
- Update `credit-policy-v2.ts` values for `intake_chat_reply`=100, `concept_generate_3`=1000, `concept_chat_reply`=150.
- Bump `CREDIT_PRICING_VERSION` to `v2` and stamp ledger snapshot accordingly.
- Keep debit-before-call + refund-on-failure + idempotency (already present in intake.ts/concept.ts).
- Use metadata alias strategy (spec §8.1): `actualGenerationType`, `featureKey`, `billingAlias` — intake already does this; extend to concept.
- `concept_chat_reply` endpoint: **build only if Q4 = yes**; otherwise defer and document.

### Files Likely to Change
- `credit-policy-v2.ts`
- [apps/api/src/services/intake.ts](../apps/api/src/services/intake.ts)
- [apps/api/src/services/concept.ts](../apps/api/src/services/concept.ts)
- Possibly new route/service for concept refinement chat (deferred per Q4)

### Function/Service Candidates
`appendUserMessageForOwner`, `generateConceptsForOwner`, (new) concept refinement reply handler.

### Data/Migration Impact
Enum: `intake_assistant` and `concept_generation` already exist. `concept_chat_reply` **not** an enum value → use **metadata alias**, do not force enum migration now.

### API Impact
Same endpoints, higher `creditCost` in responses.

### Frontend Impact
Labels auto-update (Phase 3 made them server-driven).

### Billing/Audit Impact
Real price increase; ledger snapshot records `creditPricingVersion: v2`.

### Backward Compatibility Rules
User message still free; failure still refunds full amount; idempotent retries don't double charge.

### Risks
- **P1:** balance exhaustion for beta users at new scale (ties to Q1).
- Concept refinement endpoint scope creep (mitigate via Q4 defer).

### What Must NOT Be Done in This Phase
Don't introduce enum values without a safe separate migration. Don't change prose/publish here. Don't enable payment.

### Tests Required
- Intake success debit 100 / failure refund 100.
- Concept generate-3 debit 1.000.
- (If built) concept reply debit 150.
- User message alone: no charge.
- Duplicate idempotency: no double charge.

### Smoke Checklist
- [ ] intake 100 / refund 100
- [ ] concept 1.000
- [ ] metadata `featureKey` + `creditPricingVersion=v2`

### Acceptance Criteria
Intake/concept on v2 prices with correct refund/idempotency and snapshot.

### Rollback Plan
Flip policy values back (and version) — single-file change; ledger history preserved under its version.

### Output Report Expected After Implementation
Debit/refund ledger samples at v2 + smoke results.

---

## 12. Phase 6 — Prose Mode Final Pricing

### Goal
Quality mode applies **only** to prose. Final prices:

| Feature | Hemat | Seimbang | Terbaik |
|---|---:|---:|---:|
| prose_beat | 800 | 1.500 | 7.500 |
| prose_rewrite | 500 | 900 | 4.500 |
| prose_continue | 500 | 900 | 4.500 |
| prose_expand | 600 | 1.100 | 5.000 |
| prose_polish_emotion_dialog | 400 | 700 | 3.500 |

### Why This Phase Exists
Prose is the volume cost driver; pricing must reflect model tiers, especially premium Terbaik.

### Current Repo Problem
prose_beat 5/10/20, prose_rewrite 3/6/12. `prose_continue`, `prose_expand`, `prose_polish_emotion_dialog` features may not exist yet.

### Proposed Technical Approach
- Set `PROSE_CREDIT_COSTS` in `credit-policy-v2.ts` to the table above.
- **Inventory existing prose features first:** `prose_beat` and `prose_rewrite` exist; `continue/expand/polish` — **UNCERTAIN** whether endpoints exist (verify: `grep -rn "prose_continue\|prose_expand\|polish" apps/api/src`). Price only what exists; document the rest as "future, priced-when-built."
- Terbaik UI warning handled in Phase 9.

### Files Likely to Change
- `credit-policy-v2.ts`
- [apps/api/src/services/prose-beat-generation.ts](../apps/api/src/services/prose-beat-generation.ts)
- [apps/api/src/services/prose-rewrite-generation.ts](../apps/api/src/services/prose-rewrite-generation.ts)
- New prose feature services only if those features already exist.

### Function/Service Candidates
`getCreditCost({feature:'prose_beat', qualityMode})`, prose generation orchestrators.

### Data/Migration Impact
No new enum forced. If a future prose feature needs a distinct `generation_type`, use metadata alias until a safe enum migration is scheduled.

### API Impact
Higher prose `creditCost` per mode.

### Frontend Impact
Mode selector prices update from server.

### Billing/Audit Impact
Real increase; snapshot records mode + version.

### Backward Compatibility Rules
Prose features keep `qualityMode` (it's valid here). No change to refund/idempotency contracts.

### Risks
- **P1:** Terbaik 7.500 is ~15× Seimbang; without a clear UI warning, accidental spend complaints. Mitigate in Phase 9.

### What Must NOT Be Done in This Phase
Don't price features that don't exist as if they ship. Don't add enum values unsafely. Don't touch non-prose.

### Tests Required
- prose_beat debit 800 / 1.500 / 7.500 per mode.
- prose_rewrite debit 500 / 900 / 4.500.
- Refund returns exact debited amount per mode.

### Smoke Checklist
- [ ] All existing prose modes debit correct v2 amounts.
- [ ] Refund matches debit.

### Acceptance Criteria
Existing prose features on v2 pricing; non-existent ones documented, not stubbed-with-price.

### Rollback Plan
Revert policy values (single file).

### Output Report Expected After Implementation
Per-mode debit table + feature inventory (exists vs future).

---

## 13. Phase 7 — Non-Prose Fixed Pricing and Quality Mode Isolation

### Goal
Non-prose features use fixed prices and ignore quality mode:
- publish_package = **400**
- continuity_check_standalone = **500**
- summary_delta = **500**
- foundation_setup = **2.000**
- outline_10_chapters = **2.500**

### Why This Phase Exists
Quality mode must not affect non-prose; publish currently reads client `qualityMode`.

### Current Repo Problem
publish_copy 3/6/12 reads client `qualityMode` ([publish-copy-ai-generation.ts:505](../apps/api/src/services/publish-copy-ai-generation.ts)); foundation/outline are mode-priced.

### Proposed Technical Approach
- In `credit-policy-v2.ts`, non-prose features resolve a **fixed** cost regardless of any `qualityMode` passed.
- Endpoints **accept but ignore** `qualityMode` during transition (do not reject old clients).
- Map current `generation_type`s: `publish_copy`→publish_package price, `outline_generation`→2.500, `foundation_proposal`→2.000, `continuity_delta`/`summary_delta`→500. Use metadata `featureKey` to record the intended v2 key.

### Files Likely to Change
- `credit-policy-v2.ts`
- [apps/api/src/services/publish-copy-ai-generation.ts](../apps/api/src/services/publish-copy-ai-generation.ts) (ignore mode)
- foundation/outline/summary services as applicable

### Function/Service Candidates
`getCreditCost` (fixed branch), publish/foundation/outline/summary orchestrators.

### Data/Migration Impact
No forced enum. `publish_package`, `continuity_check_standalone`, `foundation_setup`, `outline_10_chapters` are spec keys → metadata alias for now.

### API Impact
Non-prose `creditCost` becomes fixed; `qualityMode` no longer affects price/model.

### Frontend Impact
Remove/hide quality-mode selectors on non-prose surfaces (publish especially); labels show fixed price.

### Billing/Audit Impact
Fixed pricing recorded with snapshot; clearer reporting.

### Backward Compatibility Rules
**Accept-but-ignore** `qualityMode` on non-prose endpoints — never 400 an old client for sending it.

### Risks
- **P2:** UI still sends `qualityMode` for publish; ensure ignore path is solid.

### What Must NOT Be Done in This Phase
Don't hard-reject `qualityMode`. Don't change prose. Don't wire final models yet (Phase 8).

### Tests Required
- Non-prose ignores `qualityMode` (same price for hemat/seimbang/terbaik).
- publish debit 400; foundation 2.000; outline 2.500; continuity/summary 500.

### Smoke Checklist
- [ ] publish fixed 400 regardless of mode.
- [ ] non-prose price invariant under mode.

### Acceptance Criteria
All non-prose features fixed-priced and mode-insensitive; old clients still work.

### Rollback Plan
Revert policy + restore mode handling (single-file-ish).

### Output Report Expected After Implementation
Mode-invariance test output + fixed price table.

---

## 14. Phase 8 — Model Routing v2 Planning and Verification

### Goal
Prepare final model routing **without** hardcoding unverified model IDs.

### Why This Phase Exists
Spec model names are launch candidates/future IDs; using them now breaks generation.

### Current Repo Problem
`MODEL_ALLOWLIST` ([model-router.ts:31](../apps/api/src/services/model-router.ts)) holds real, older models (gemma-2, claude-3-haiku, claude-3.5-sonnet). Spec lists `claude-opus-4.8`, `gpt-5.2`, `gemini-3.1`, `qwen3.7`, `minimax-m3`, `deepseek-v4` — none in allowlist; availability `UNCERTAIN`.

### Proposed Technical Approach
- Author `model-routing-v2.ts` as a **planning module / matrix** separate from pricing:
  - `FIXED_FEATURE_MODELS` (non-prose, no mode)
  - `PROSE_MODELS[mode]` (prose only)
- **Verification step:** confirm each model on OpenRouter (availability + price + behavior) before adding to `MODEL_ALLOWLIST`.
- Keep env override (`AI_MODEL_HEMAT/SEIMBANG/TERBAIK`) as the live control; only promote verified IDs.
- Pricing and routing stay decoupled: changing a model must not change `creditCost`.

### Files Likely to Change
- New `apps/api/src/services/model-routing-v2.ts`
- [apps/api/src/services/model-router.ts](../apps/api/src/services/model-router.ts) (`MODEL_ALLOWLIST`, per-feature resolution) — only after verification
- [apps/api/src/services/model-cost-map.ts](../apps/api/src/services/model-cost-map.ts) (add verified models' costs)

### Function/Service Candidates
`resolveModelForGeneration`, `pickAllowlistedModel`, new per-feature resolver.

### Data/Migration Impact
None.

### API Impact
None until verified models are promoted.

### Frontend Impact
None (model never shown to users by default).

### Billing/Audit Impact
`modelRoutingVersion` recorded in snapshot; model changes don't alter credit cost.

### Backward Compatibility Rules
Until verified, keep current allowlist/models. No behavior change.

### Risks
- **P1:** promoting unverified/non-existent models → `AI_NOT_CONFIGURED`/503. Mitigate with verification gate (§18 Q5/Q6).

### What Must NOT Be Done in This Phase
Do not insert future/fictional model IDs into the production allowlist. Do not change model behavior before smoke (Phase 10).

### Tests Required
- Every feature resolves to an allowlisted model.
- Non-prose ignores mode in routing; prose uses mode.
- Verification checklist documented per model.

### Smoke Checklist
- [ ] Routing matrix references only verified, allowlisted models.
- [ ] Pricing unchanged by model swap.

### Acceptance Criteria
A verified routing matrix exists; production allowlist contains only confirmed models.

### Rollback Plan
Env override / revert allowlist entry — instant.

### Output Report Expected After Implementation
OpenRouter verification table (model, available?, price, decision) + routing matrix.

---

## 15. Phase 9 — UI/UX Credit Transparency

### Goal
Users understand what credits buy, never see tokens, never feel "credit-choked."

### Why This Phase Exists
Clear pre/post/failure messaging builds trust and reduces billing complaints.

### Current Repo Problem
Labels existed but were hardcoded (fixed in Phase 3); no consistent Terbaik warning; no standardized refund copy.

### Proposed Technical Approach
- Pre-action estimate (server-driven): `AI reply ini memakai 100 kredit.`
- Post-success: `Berhasil. 800 kredit digunakan. Sisa kredit: 18.750.`
- Failure/refund: `AI gagal membalas. Kredit kamu tidak terpakai.` / `...dikembalikan otomatis.`
- Simple tooltip per feature; **Terbaik** carries a "premium, mahal — untuk adegan kunci" warning.
- Never display token count, provider cost, OpenRouter price, model name, or stack traces.

### Files Likely to Change
- [apps/web/src/services/ai.ts](../apps/web/src/services/ai.ts) (copy helpers)
- Write room / concept / publish components & hooks
- [apps/web/src/pages/PublishPage.tsx](../apps/web/src/pages/PublishPage.tsx)

### Function/Service Candidates
Credit label formatters, balance display, post-action toasts.

### Data/Migration Impact
None.

### API Impact
Consumes estimate endpoint + balance; no new mutation.

### Frontend Impact
Consistent copy across intake/concept/prose/publish + failure states.

### Billing/Audit Impact
None (display).

### Backward Compatibility Rules
Graceful when estimate/balance unavailable.

### Risks
- **P2:** Terbaik cost shock without warning. Mitigate with explicit confirm + warning copy.

### What Must NOT Be Done in This Phase
Don't expose token/provider/model details. Don't change prices.

### Tests Required
- Copy renders correct credit + remaining balance on success.
- Failure shows no-charge/refund message.
- Terbaik shows warning before spend.

### Smoke Checklist
- [ ] pre/post/failure copy correct.
- [ ] no token/model leakage in default UI.

### Acceptance Criteria
All AI actions show clear credit messaging without technical jargon.

### Rollback Plan
Revert PR.

### Output Report Expected After Implementation
Screens/markup of the three states + Terbaik warning.

---

## 16. Phase 10 — Smoke Tests, Regression Tests, and Launch Gates

### Goal
Prove the system is safe before enabling public payment.

### Why This Phase Exists
Spec §15: do not launch public paid payment before smoke tests pass.

### Current Repo Problem
Existing `generation-contracts.test.mts` covers generation, but billing-scale smoke for v2 must be added/confirmed (`UNCERTAIN` whether all §10 cases are covered today).

### Proposed Technical Approach
Add/extend a billing smoke suite asserting the full matrix below, then run launch-gate checklist.

**Billing smoke matrix:**
- intake success debit 100 / failure refund 100
- concept generate debit 1.000
- prose Hemat 800 / Seimbang 1.500 / Terbaik 7.500
- publish fixed 400
- non-prose ignores `qualityMode`
- user message alone → no charge
- duplicate idempotency → no double charge
- client-supplied `model`/`provider`/`creditCost` → rejected/ignored
- ledger metadata snapshot present (featureKey, creditCost, creditPricingVersion)
- top-up products v2 appear correctly
- old orders remain intact

**Launch gates:**
- typecheck pass (`tsc`)
- API smoke pass
- web smoke pass
- payment remains OFF until explicitly enabled by founder
- production migration checklist reviewed (00021 applied, idempotent)
- rollback checklist verified

### Files Likely to Change
- `apps/api/scripts/credit-system-v2-contracts.test.mts` (NEW) or extend [generation-contracts.test.mts](../apps/api/scripts/generation-contracts.test.mts)
- CI config [.github/workflows/ci.yml](../.github/workflows/ci.yml)

### Function/Service Candidates
All billing orchestrators (debit/refund/attempt), products endpoint.

### Data/Migration Impact
None (tests). Confirms 00021 applies cleanly.

### API Impact
None (verification only).

### Frontend Impact
Web smoke (manual or scripted) of credit labels + flows.

### Billing/Audit Impact
Verifies billing integrity end-to-end.

### Backward Compatibility Rules
Tests must include old-order-intact and old-client-mode-ignored cases.

### Risks
- **P0:** enabling payment before gates pass. Mitigate by keeping payment flag off until sign-off.

### What Must NOT Be Done in This Phase
Don't flip payment on inside this phase; that's a separate founder go-live action.

### Tests Required
The full matrix above.

### Smoke Checklist
- [ ] Entire billing matrix green.
- [ ] typecheck/API/web smoke green.
- [ ] payment still off.

### Acceptance Criteria
All gates green; documented go/no-go.

### Rollback Plan
Keep payment off; revert offending phase PR.

### Output Report Expected After Implementation
Test run output + signed launch-gate checklist.

---

## 17. Rollback Strategy

| Layer | Rollback mechanism | Notes |
|---|---|---|
| Pricing values | Revert single policy file; flip `CREDIT_PRICING_VERSION` | Ledger history stays under its own version |
| Ledger metadata | Revert PR; old rows untouched | Additive; no backfill to undo |
| Frontend SoT | Revert PR; fallback table resumes | Display only |
| Top-up products (00021) | Inverse upsert / `is_active=false` | Never DELETE; orders safe |
| Model routing | Env override / revert allowlist entry | Instant; decoupled from price |
| UI copy | Revert PR | Display only |
| Payment | Keep flag OFF | Go-live is a deliberate separate switch |

**Global rule:** because pricing is centralized (Phase 1) and snapshotted (Phase 2), any price rollback is a one-file change and never corrupts historical ledger or refunds.

---

## 18. Founder Decisions Required

| # | Decision | Options | Blocks | Recommendation |
|---:|---|---|---|---|
| Q1 | Private-beta balance strategy | (a) reset to 0, (b) manual grant + `creditScaleVersion`, (c) leave as-is | Phase 4/5/6 go-live | **(b)** manual grant with audit note; never auto-multiply |
| Q2 | v2 pricing applies to all users at once? | all-at-once / cohort flag | Phase 5–7 | All-at-once for private beta (small N), with comms |
| Q3 | Free onboarding allowance? | none / first 3–5 AI replies free | Phase 5/9 | Optional; defer to post-launch unless cheap to add |
| Q4 | Build concept refinement chat (150) now? | build now / defer | Phase 5 scope | **Defer** unless UI needs it; price reserved |
| Q5 | Model routing v2 before or after payment on? | before / after | Phase 8/10 timing | **Before** payment, **after** OpenRouter verification |
| Q6 | Terbaik uses premium model now? | now / defer | Phase 6/8 | Defer premium until verified + UI warning shipped |
| Q7 | Show v2 top-up packages while payment off? | show / hide | Phase 4/9 | Hide or label "segera" to avoid tester confusion |

No engineering phase that changes price or balance may proceed past Phase 4 until Q1 and Q2 are answered.

---

## 19. Files Likely to Change Per Phase

| Phase | API | Web | Migration | Shared/Tests |
|---:|---|---|---|---|
| 0 | — | — | — | docs only |
| 1 | ai-credit-policy.ts / credit-policy-v2.ts, intake.ts | — | — | price-equality test |
| 2 | credit-ledger.ts, intake/concept/prose/publish services | — | — | refund/metadata tests |
| 3 | routes/credits.ts (estimate), routes/ai.ts | services/ai.ts, useWriteRoomData/useConceptsData/usePublishData | — | web + estimate tests |
| 4 | (credit-topup.ts unchanged) | pricing page | **00021_credit_scale_v2_topup_products.sql** | products test |
| 5 | credit-policy-v2.ts, intake.ts, concept.ts | — | maybe enum (deferred) | intake/concept smoke |
| 6 | credit-policy-v2.ts, prose-beat/prose-rewrite | mode selector | maybe enum (deferred) | prose smoke |
| 7 | credit-policy-v2.ts, publish/foundation/outline/summary | hide non-prose mode selectors | — | mode-invariance test |
| 8 | model-routing-v2.ts (new), model-router.ts, model-cost-map.ts | — | — | routing tests |
| 9 | (estimate endpoint) | services/ai.ts, write/concept/publish components, PublishPage.tsx | — | copy tests |
| 10 | scripts/credit-system-v2-contracts.test.mts (new) | web smoke | — | CI: ci.yml |

---

## 20. Implementation Order Recommendation

```txt
Phase 0  → decisions locked (Q1,Q2 mandatory; Q3–Q7 logged)
Phase 1  → centralize pricing (no price change)        [must precede 5/6/7]
Phase 2  → snapshot + ledger metadata                  [must precede ANY price increase]
Phase 3  → frontend source of truth                    [must precede price increases for honest UI]
Phase 4  → top-up v2 (gated on Q1 balance decision)
Phase 5  → intake/concept v2 prices
Phase 6  → prose v2 prices
Phase 7  → non-prose fixed + mode isolation
Phase 8  → model routing v2 (gated on OpenRouter verification; before payment)
Phase 9  → UI/UX transparency
Phase 10 → smoke/regression/launch gates               [must pass before public payment]
```

**Dependency map:**
```txt
Phase 1 must complete before Phase 5, 6, 7.
Phase 2 must complete before any price increase (5, 6, 7).
Phase 3 must complete before price increases go user-visible.
Phase 4 must wait for founder balance decision (Q1) and Q2.
Phase 8 must wait for OpenRouter verification (Q5/Q6) and stays before payment-on.
Phase 10 must pass before public payment is enabled.
Payment go-live is a separate founder switch AFTER Phase 10.
```

---

## 21. Final Acceptance Criteria

The v2 program is complete when:

1. All AI action prices resolve through **one** server function (`getCreditCost`); no authoritative price lives in the frontend or in a feature handler literal.
2. Every new ledger debit/refund row carries a pricing snapshot (`featureKey`, `qualityMode`, `creditCost`, `creditPricingVersion`, `modelRoutingVersion`, `generationAttemptId`, `idempotencyKey`); historical rows are untouched.
3. Refunds use the **original** debited amount.
4. Top-up packages are v2 (20.000 / 55.000 / 130.000 / 300.000); old products retained (`is_active=false` if retired); historical orders intact.
5. Intake 100, concept generate 1.000 (refinement 150 if built); user message free; refund-on-failure; idempotent.
6. Prose mode pricing 800/1.500/7.500 (beat) etc.; quality mode affects **prose only**.
7. Non-prose fixed-priced and **ignores** `qualityMode`; old clients not rejected.
8. Model routing v2 documented and verified; production allowlist contains only confirmed models; routing decoupled from pricing.
9. UI shows pre/post/failure credit messaging; no tokens/provider/model exposed; Terbaik warned.
10. Full billing smoke matrix green; typecheck/API/web smoke pass; **public payment remains off until founder go-live**.
11. Every phase has a verified rollback; no applied migration was edited; `00021` (and up) used for new migrations.

---

> Correction note for the spec: §6.3 suggests migration filename `00011_credit_scale_v2_topup_products.sql`, but `00011` is already applied (`00011_sprint13_generation_type_contracts.sql`). Use **`00021_...`**. Also, §4 model IDs are launch candidates/placeholders and must be OpenRouter-verified before entering `MODEL_ALLOWLIST`.

**UNCERTAIN items to verify during implementation:**
- Existence of `prose_continue` / `prose_expand` / `prose_polish_emotion_dialog` endpoints (`grep -rn "prose_continue\|prose_expand\|polish" apps/api/src`).
- Whether `generation-contracts.test.mts` already asserts any billing debit amounts (extend vs new file).
- Exact migration that added `concept_generation`/`foundation_proposal`/`outline_generation` to the live enum vs `enums.ts` (confirmed present in `00002` and `00011`).
