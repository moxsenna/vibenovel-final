# AI Model Registry & Routing — Verification

- Date: 21 June 2026
- Scope: Engine2 model registry + routing policy source-of-truth refactor
- Design: `docs/superpowers/specs/2026-06-21-ai-model-registry-routing-design.md`
- Plan: `docs/superpowers/plans/2026-06-21-ai-model-registry-routing-implementation-plan.md`

## Commits tested

```
801d920 feat(ai): add central model registry
da31d5f feat(ai): centralize engine routing policy
dd954cb feat(ai): add TokenRouter provider transport
9a018c0 feat(ai): add provider call telemetry schema
ad168b2 feat(ai): persist safe provider call events
cc3e492 feat(ai): route validated generations across providers
f29c92e refactor(ai): validate structured output inside router
dce49db refactor(ai): route prose through provider telemetry
1169bf5 refactor(ai): centralize embedding routing
244e29a feat(admin): expose AI provider call timeline
124ba1a feat(admin): add AI provider diagnostics timeline
ff2a7ef refactor(ai): remove duplicate model configuration
```

## Migration status

- `supabase/migrations/00022_ai_routing_provider_telemetry.sql` — additive.
  Adds `generation_attempts` route-summary columns and the admin-only
  `generation_provider_events` table (RLS enabled, `GRANT ALL` to
  `service_role` only). Not yet applied to a live database in this run
  (`supabase db reset` requires local infra — deferred to deploy).

## Route matrix summary

- Two authoritative files: `ai-model-registry.ts` (family-keyed logical models +
  provider deployments + verified pricing) and `ai-routing-policy.ts`
  (primary/fallback target per generation type + embedding).
- All production routes resolve to **OpenRouter** deployments. OpenRouter
  pricing is diffed against the restored 19 June 2026 snapshot (audit 20).
- TokenRouter MiniMax-M3 is a `DOCUMENTED`, **non-routed** candidate. No
  production route references it. Promotion ends 22 June 2026.

## TokenRouter probe status

- **DEFERRED.** `Optional Gate A` (live probe + promotion + one-engine
  activation) was intentionally not executed. The router supports
  cross-provider fallback (proven by injected-route contract), but TokenRouter
  remains inactive in production policy pending post-promotion price/probe
  verification.

## Test commands and results

| Command | Result |
|---|---|
| `npm run typecheck` (shared + web + api) | PASS |
| `npm run lint` | PASS |
| `npm run build:api` | PASS |
| `npm run build:web` | PASS |
| `npm run test:ai-routing` | PASS (registry, policy, transport, router v3, telemetry, id-boundary, credit-invariance) |
| `npm run test:api:contracts` | PASS |
| `npm run test:credit-v2` | PASS |
| `npm run test:admin-generation-attempts -w @vibenovel/api` | PASS |
| `npm run test:admin-generation-attempts-ui -w @vibenovel/web` | PASS |
| `npm run test:sprint18-import-rag -w @vibenovel/api` | PASS |
| `npm run test:draft-import -w @vibenovel/api` | PASS |
| `npm run test:sprint19-asisten-narra -w @vibenovel/api` | PASS |
| `git diff --check` | clean |

## No-secret / no-prompt evidence

- `generation_provider_events` schema and `buildSafeProviderEventInsert` carry
  only identifiers, normalized metrics, and sanitized error categories/codes —
  no prompt, output, reasoning, raw response body, or credentials
  (`generation-provider-events-contracts.test.mts`).
- Admin API detail and web detail page render only the safe timeline; UI
  contract asserts no `raw prompt | raw response | reasoning content`.
- Raw provider model IDs exist only in `ai-model-registry.ts`
  (`ai-model-id-boundary.test.mts`).

## Credit / refund / idempotency

- User credit prices are unchanged: `ai-routing-v3-credit-invariance.test.mts`
  pins prose (800/1500/7500) and publish (400) credit costs; provider cost is
  derived from registry deployment pricing, independent of user credit.
- Existing credit debit/refund and idempotency regressions remain green via
  `test:credit-v2` and `test:api:contracts`.

## Remaining blockers / deferred

- Apply migration `00022` and run `supabase db reset` + sprint8/9 smoke on a
  live local database before production deploy.
- `Optional Gate A` (TokenRouter activation) deferred until the promotion ends
  and current pricing is reverified.
- Shared embeddings transport (`callOpenAiCompatibleEmbeddings`) was not
  extracted; the existing OpenRouter embeddings transport is retained (model
  resolution is centralized through the registry).

## GO / NO-GO

- **GO** for the durable OpenRouter-parity refactor (registry, policy,
  transport, telemetry, validated routing, embedding, admin diagnostics,
  legacy removal): static verification and all contract suites pass.
- **NO-GO / deferred** for TokenRouter production activation pending
  `Optional Gate A`.
