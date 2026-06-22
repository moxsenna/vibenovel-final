# Credit System v2 — Phase 0 Decision Log

**Date:** 2026-06-18  
**Source plan:** `docs/credit-system-v2-full-implementation-plan.md`  
**Status:** Implementation decisions locked; billing-affecting changes still gated by safety scaffolding.

## Verified baseline

- The current action-based billing architecture is retained: generation attempt, debit before provider call, append-only ledger, refund on failure, and idempotency.
- Existing API and web typechecks pass.
- `apps/api/scripts/generation-contracts.test.mts` passes on the current working tree.
- Applied migrations currently run from `00001` through `00020`.
- The next additive migration number is `00021`.
- `00011` is already used by `00011_sprint13_generation_type_contracts.sql`.
- `intake_assistant`, `concept_generation`, `foundation_proposal`, and `outline_generation` already exist in the database generation-type history.
- `prose_continue`, `prose_expand`, and `prose_polish_emotion_dialog` do not currently have dedicated API endpoints. They remain future priced-when-built features.
- The current production Wrangler configuration has `CREDIT_TOPUP_ENABLED = "true"`. This contradicts the v2 launch gate and must be changed to a safe-off default before the v2 rollout can be considered launch-safe.

## Founder decisions adopted for implementation

These decisions follow the recommendations in §18 of the implementation plan. They are deliberately conservative and reversible.

| ID | Decision |
|---|---|
| Q1 | Existing private-beta balances are never auto-multiplied or rewritten. Any transition assistance uses an explicit manual admin grant with an audit note and credit-scale metadata. |
| Q2 | v2 pricing is prepared as one server policy for all private-beta users. Activation remains gated until ledger snapshots and server-driven UI estimates are complete. |
| Q3 | Free onboarding AI replies are deferred. They are not part of the v2 launch-critical path. |
| Q4 | Concept refinement chat is deferred unless a real product endpoint is introduced. The 150-credit price remains reserved, not exposed as a shipped action. |
| Q5 | Model routing v2 must be verified before public payment is enabled. |
| Q6 | Premium `terbaik` routing is not promoted until model availability, provider pricing, output quality, and the expensive-action warning are verified. |
| Q7 | v2 top-up products may be returned by the catalog API for testing, but purchase controls stay hidden/disabled while top-up is off. |

## Non-negotiable rollout gates

1. Phase 1 centralizes pricing without changing any current value.
2. Phase 2 adds ledger pricing snapshots and makes refunds use the original debit amount.
3. Phase 3 makes server estimates authoritative in the frontend.
4. No v2 action price is activated before gates 1–3 pass.
5. Migration `00021_credit_scale_v2_topup_products.sql` is additive and must not alter historical orders or balances.
6. Public payment remains off until the Phase 10 launch checklist is green and a separate founder go-live action occurs.
7. Historical ledger rows and applied migrations are never rewritten.

## Current blockers and required remediation

- The working tree contains unrelated and overlapping uncommitted changes. Credit-system implementation must preserve them and be developed in an isolated workspace or with explicitly reviewed, narrow patches.
- Production top-up is currently configured on in `apps/api/wrangler.toml`; this must be corrected before any future production deployment.
- Ledger metadata lacks the v2 pricing snapshot.
- Refund logic currently accepts the caller-provided amount instead of enforcing the original debit amount.
- Intake still contains literal `1` values.
- The frontend still treats local price tables as authoritative.
- Model IDs in the product spec remain launch candidates until verified against OpenRouter.

## Phase 0 exit result

Phase 0 decisions are recorded. Engineering may proceed with Phases 1–3 without changing prices, balances, payment behavior, or model routing. Phases 4–10 remain subject to their explicit technical gates above.
