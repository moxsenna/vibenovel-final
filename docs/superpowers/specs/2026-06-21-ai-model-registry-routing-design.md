# AI Model Registry and Routing Source-of-Truth Design

**Status:** Approved design
**Date:** 21 June 2026
**Scope:** Engine2 text generation, structured generation, prose routing, embedding/RAG, provider selection, fallback, cost telemetry, and admin diagnostics

## 1. Purpose

Engine2 currently repeats provider model IDs across routing, allowlists, cost maps, embedding configuration, tests, and environment overrides. This creates drift: changing one model may require edits in several files, and the runtime can accidentally use stale pricing, unsupported capabilities, or the wrong provider-specific model ID.

This design establishes two authoritative files:

1. `ai-model-registry.ts` answers: **What is this logical model, what can it do, and how is it deployed by each provider?**
2. `ai-routing-policy.ts` answers: **Which provider and logical model does each engine use as primary and fallback?**

All runtime routers, provider clients, cost calculations, verification scripts, embedding services, and admin diagnostics must derive their decisions from those two files.

## 2. Design Decisions

The following decisions are final for this scope:

- Use two centralized files rather than one monolithic configuration file.
- Use stable, versionless model-family keys such as `minimax_text`.
- Keep engine roles in routing policy; never encode roles such as `prose_premium`
  into registry keys.
- Keep provider-specific model IDs only in the model registry.
- Select provider and model explicitly per engine in the routing policy.
- Permit cross-provider fallback only when explicitly declared in the routing policy.
- Do not infer or automatically select a different provider.
- Do not support model or route overrides through environment variables.
- Keep `AI_GENERATION_ENABLED=false` as the emergency kill switch.
- Include embedding models in the same registry and routing policy.
- Validate route requirements against model capabilities before deployment and at runtime.
- Treat structured-output validation as part of generation success.
- Add per-provider-call telemetry and an admin-only diagnostic timeline.
- Preserve user credit pricing independently from provider/model routing and provider costs.

## 3. Existing Sources and Their Status

The initial routing policy will preserve the researched primary/fallback matrix in:

- `docs/narraza-final-credit-system-agent-spec.md`
- `apps/api/src/services/model-routing-v2.ts`

OpenRouter deployment verification performed on 19 June 2026 exists in git commit `2d0e717` and must be restored into the active branch as historical verification evidence:

- `docs/audit/20-credit-v2-model-verification-2026-06-19.md`

That verification covers catalog presence, canonical model ID, context length, pricing, and supported request parameters. It does not verify TokenRouter deployments. TokenRouter records require separate verification evidence.

The source-of-truth refactor must not silently change the researched primary/fallback choices. A route may change only when provider verification or live behavior shows that its deployment is unavailable or incompatible.

## 4. Architecture

```text
Generation type + optional prose quality mode
                         |
                         v
                ai-routing-policy.ts
          explicit primary and fallback targets
                         |
                         v
                ai-model-registry.ts
       capability + provider deployment resolution
                         |
                         v
                    model-router.ts
       credential check, retry, validation, fallback
                         |
                         v
          OpenAI-compatible provider transport
          /                         \
  OpenRouter deployment      TokenRouter deployment
                         |
                         v
       generation_attempts + generation_provider_events
                         |
                         v
                Admin diagnostic timeline
```

## 5. Model Registry

### 5.1 File responsibility

`apps/api/src/services/ai-model-registry.ts` is the only authoritative source for:

- logical model keys;
- model modality;
- capability declarations;
- context window;
- embedding dimensions where applicable;
- provider deployments;
- provider-specific model IDs;
- provider pricing snapshots;
- verification timestamps and sources;
- request compatibility flags.

It must not decide which engine uses a model.

### 5.2 Logical model definition

Representative shape:

```ts
export const AI_MODEL_REGISTRY = {
  minimax_text: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      tokenrouter: {
        modelId: "MiniMax-M3",
        contextWindow: 1_048_576,
        pricing: {
          inputUsdPer1M: 0,
          outputUsdPer1M: 0,
        },
        pricingKind: "temporary_promotion",
        promotionEndsOn: "2026-06-22",
        verifiedAt: "2026-06-21T00:00:00.000Z",
        verificationSource: "tokenrouter-model-page",
        verificationStatus: "documented",
      },
      openrouter: {
        modelId: "minimax/minimax-m3",
        contextWindow: 1_048_576,
        pricing: {
          inputUsdPer1M: 0.3,
          outputUsdPer1M: 1.2,
        },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource:
          "https://openrouter.ai/api/v1/models",
      },
    },
  },
} as const;
```

Temporary free access must be represented as deployment-specific pricing evidence, not as a permanent property of the logical model. When the promotion ends, the TokenRouter deployment record must be reverified or disabled.

Logical keys identify a stable model family, not a provider deployment or a
specific release. Examples:

| Logical key | Current deployment family |
|---|---|
| `gemini_flash_lite` | Gemini Flash Lite |
| `qwen_plus` | Qwen Plus |
| `minimax_text` | MiniMax text/reasoning family |
| `deepseek_flash` | DeepSeek Flash |
| `gemini_flash` | Gemini Flash |
| `mistral_large` | Mistral Large |
| `claude_opus` | Claude Opus |
| `gemini_pro` | Gemini Pro |
| `openai_embedding_small` | OpenAI small embedding family |

Changing a version within the same family changes only the deployment
`modelId` and verification snapshot. Replacing the family itself is an explicit
routing-policy change.

### 5.3 Provider deployment contract

Each deployment must declare:

- `modelId`;
- `contextWindow`;
- input/output pricing or an explicit unavailable-price state;
- `pricingKind`;
- `verifiedAt`;
- `verificationSource`;
- supported parameters required by the shared client;
- optional provider quirks such as reasoning separation or unsupported temperature.

A logical model may exist on one provider only. The registry must not fabricate a deployment merely because another provider exposes the same underlying model family.

### 5.4 Embedding models

Embedding models use the same registry with:

- `modality: "embedding"`;
- `capabilities.embedding: true`;
- vector dimensions;
- provider deployment IDs;
- provider pricing and verification.

Text routes cannot reference embedding models. Embedding routes cannot reference text-only models.

## 6. Routing Policy

### 6.1 File responsibility

`apps/api/src/services/ai-routing-policy.ts` is the only authoritative source for:

- engine/feature route keys;
- prose quality-mode routes;
- embedding/RAG routes;
- required capabilities;
- primary provider and logical model;
- fallback provider and logical model;
- route-level timeout, retry, and output-token policy where needed;
- routing policy version.

It must never contain provider-specific raw model IDs or provider pricing.

### 6.2 Route target

```ts
export interface AiRouteTarget {
  provider: "openrouter" | "tokenrouter";
  model: AiLogicalModelKey;
}
```

Representative policy:

```ts
export const AI_ROUTING_POLICY = {
  intake_assistant: {
    requires: ["textGeneration", "structuredJson"],
    primary: {
      provider: "openrouter",
      model: "gemini_flash_lite",
    },
    fallback: {
      provider: "openrouter",
      model: "qwen_plus",
    },
  },
  foundation_proposal: {
    requires: ["textGeneration", "structuredJson"],
    primary: {
      provider: "openrouter",
      model: "minimax_text",
    },
    fallback: {
      provider: "openrouter",
      model: "qwen_plus",
    },
  },
  outline_generation: {
    requires: ["textGeneration", "structuredJson"],
    primary: {
      provider: "openrouter",
      model: "minimax_text",
    },
    fallback: {
      provider: "openrouter",
      model: "qwen_plus",
    },
  },
  embedding_import_rag: {
    requires: ["embedding"],
    primary: {
      provider: "openrouter",
      model: "openai_embedding_small",
    },
    fallback: null,
  },
} as const;
```

### 6.3 Route coverage

The policy must cover all existing engine2 generation paths:

- intake assistant;
- concept generation and refinement where routed separately;
- foundation proposal and normalization;
- draft import signal extraction;
- outline generation;
- chapter beat generation;
- chapter summary generation;
- continuity and summary delta;
- prose beat by quality mode;
- prose rewrite by quality mode;
- publish copy;
- import/RAG embedding.

No engine implementation may choose a provider or model directly.

### 6.4 Provider-per-engine rule

Different engines may use different providers. The choice must be explicit in the policy.

Cross-provider fallback is allowed only when both targets are written in the route:

```ts
primary: { provider: "tokenrouter", model: "minimax_text" },
fallback: { provider: "openrouter", model: "qwen_plus" },
```

This is a post-verification example, not the initial production policy.
TokenRouter must remain absent from active production targets until the optional
activation gate passes.

The router must never search other providers or deployments automatically.

`summary_delta` is a deprecated generation-type alias. While it remains in the
shared enum for compatibility, it must reference the same canonical route
object as `continuity_delta`; it must not duplicate the route configuration.

## 7. Configuration and Credentials

Environment variables configure provider access, not routing:

```env
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
TOKENROUTER_API_KEY=...
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
AI_GENERATION_ENABLED=true
```

The following route/model override variables are removed:

- `DEFAULT_AI_MODEL`;
- `AI_MODEL_HEMAT`;
- `AI_MODEL_SEIMBANG`;
- `AI_MODEL_TERBAIK`;
- `AI_EMBEDDING_MODEL`.

There is no per-engine or global model override. Production routing must match the committed policy. Emergency shutdown uses `AI_GENERATION_ENABLED=false`.

Legacy override variables must cause configuration validation to fail while they remain set. They must not be silently ignored.

## 8. Provider Transport

OpenRouter and TokenRouter both use OpenAI-compatible endpoints. They should share a focused transport implementation for:

- bearer authentication;
- base URL normalization;
- `/chat/completions`;
- `/embeddings`;
- timeout and abort handling;
- response parsing;
- safe HTTP error mapping;
- token usage extraction.

Provider adapters remain responsible for:

- selecting the correct credential and base URL;
- adding provider-specific safe headers;
- translating provider-specific response quirks;
- supplying the raw provider model ID resolved from the registry;
- returning a normalized result.

The transport must not decide routing or inspect the registry directly.

## 9. Generation Flow and Output Validation

### 9.1 Success boundary

A provider HTTP 200 response is not automatically a successful generation. The engine-specific output must pass validation before the call is marked successful.

The router call accepts an output validator:

```ts
generateWithModelRouter({
  route: "outline_generation",
  validateOutput: validateOutlineJson,
});
```

The validator returns normalized output or a safe validation failure. Raw output is not stored in provider telemetry.

### 9.2 Retry and fallback sequence

For each route:

1. Resolve and validate the primary target.
2. Check provider credential availability.
3. Call primary.
4. Validate provider output.
5. Retry primary according to `route.primaryMaxRetries`.
6. If still failing, resolve the explicitly declared fallback.
7. Call and validate fallback.
8. Return success or fail the generation attempt and refund according to existing credit orchestration.

The initial policy sets `primaryMaxRetries: 1`, so primary is called at most
twice: the initial call plus one retry. Fallback is called at most once and is
not retried. This asymmetry is intentional: fallback is the final bounded
recovery attempt, not a second retry loop.

Retryable/fallback-eligible failures:

- timeout;
- rate limit;
- provider/network/server error;
- empty output;
- malformed structured output;
- schema-invalid structured output.

Non-fallback failures:

- unsafe output;
- detected prompt/context/data leak;
- invalid routing policy;
- incompatible capability declaration;
- corrupted registry record.

Unsafe output stops immediately, triggers the existing safe failure/refund behavior, and is recorded as an admin-visible incident category without storing the unsafe text.

### 9.3 Missing credentials

If the primary provider credential is unavailable:

- do not call the primary;
- record a safe `credential_unavailable` provider event;
- use the explicit fallback when its credential is available;
- mark the attempt as degraded/fallback-used.

If neither primary nor fallback can be called, fail before credit debit wherever the existing orchestration can perform preflight. Any post-debit failure must preserve the existing refund guarantee.

## 10. Capability Validation

Each route declares required capabilities. Each logical model declares capabilities. Each provider deployment declares request compatibility.

Contracts must reject:

- unknown logical model keys;
- missing provider deployments;
- text engines mapped to embedding models;
- embedding routes mapped to text-only models;
- structured engines mapped to models without structured-output support;
- embedding dimensions incompatible with storage schema;
- primary and fallback targets that are identical;
- deployments missing verification evidence;
- deployments missing required request parameters;
- raw provider model IDs outside the registry.

Validation runs in contract tests and in a fail-fast configuration check used during startup/deployment.

Only deployments referenced by the active routing policy must have status
`VERIFIED`. A well-formed candidate deployment may remain `DOCUMENTED` in the
registry without failing policy validation, provided no production route
references it.

## 11. Cost and Credit Separation

User credit pricing remains controlled by the existing credit policy. Changing provider, model, or provider price must not automatically change user credit cost.

Provider cost telemetry is derived from the deployment used for each provider call:

```text
logical model + provider
→ registry deployment
→ deployment-specific token pricing
→ estimated provider cost
```

Temporary TokenRouter free pricing applies only to the TokenRouter MiniMax M3
candidate deployment and expires on 22 June 2026. No production route may use
that candidate until a post-promotion price/capability verification and live
probe pass. The OpenRouter deployment retains its own catalog pricing.

Historical generation records must retain the pricing and routing snapshot used at execution time. Reverification must not rewrite historical costs.

OpenRouter registry pricing must be generated or contract-checked against the
restored 19 June 2026 verification snapshot. Manual copying without an automated
diff is not sufficient.

## 12. Telemetry Data Model

### 12.1 Generation attempt summary

`generation_attempts` remains one row per user-visible/idempotent AI action. It stores the final summary:

- generation type;
- final status;
- final provider;
- logical model key;
- provider model ID;
- routing policy version;
- fallback-used flag;
- total retry count;
- total provider latency;
- total input/output tokens;
- total estimated provider cost;
- final safe error code and message;
- existing credit and output references.

The existing `model` field may remain the provider model ID for compatibility, while `logical_model` is added explicitly. This distinction must be visible in admin diagnostics.

### 12.2 Provider-call events

Add an admin-only table named `generation_provider_events`, with one row per attempted provider call or skipped unavailable target:

- `id`;
- `generation_attempt_id`;
- `sequence_number`;
- `route_role`: `primary` or `fallback`;
- `provider`;
- `logical_model`;
- `provider_model_id`;
- `retry_number`;
- `outcome`;
- `error_category`;
- `error_code_safe`;
- `provider_http_status`;
- `latency_ms`;
- `input_tokens`;
- `output_tokens`;
- `estimated_cost_usd`;
- `created_at`.

`sequence_number` is assigned by one in-memory counter owned by the complete
generation attempt. Repair loops and repeated router calls for the same attempt
must share that counter. The database unique constraint
`(generation_attempt_id, sequence_number)` is a guard, not the sequence source;
the persistence layer must not issue a `SELECT max(sequence_number)`.

Allowed outcomes include:

- `succeeded`;
- `provider_error`;
- `timeout`;
- `rate_limited`;
- `empty_output`;
- `invalid_output`;
- `unsafe_output`;
- `credential_unavailable`;
- `configuration_error`.

### 12.3 Sensitive-data prohibition

Neither table may contain:

- API keys or authorization headers;
- raw prompts;
- context or canon packets;
- raw provider response bodies;
- model reasoning or `<think>` content;
- generated novel prose;
- unsafe output excerpts.

Only hashes, identifiers, normalized metrics, and sanitized error categories/messages are allowed.

## 13. Admin Diagnostics

### 13.1 Attempt list

The admin attempt list shows:

- engine/generation type;
- status;
- final provider;
- logical model;
- provider model ID;
- fallback-used indicator;
- total latency;
- token usage;
- estimated provider cost;
- safe error category/code;
- user and timestamp.

### 13.2 Attempt detail

Each attempt links to a detail page with:

- routing policy version;
- primary and fallback targets;
- credential availability state;
- provider-call timeline;
- retry numbers;
- HTTP status where safe;
- validation outcome;
- per-call latency, tokens, and cost;
- final refund/success summary;
- correlation ID for server-log lookup.

The page must not expose prompts, output, provider response bodies, or credentials.

## 14. Verification Evidence

Provider deployments require provider-specific verification:

- OpenRouter: restore and evolve the existing catalog verifier and audit report.
- TokenRouter: add a read-only model availability/metadata verifier where the API exposes it; otherwise record documented model-page evidence plus an explicitly authorized live smoke.

Verification records must include:

- provider;
- requested model ID;
- exact/canonical match where available;
- context window;
- pricing;
- supported parameters/capabilities;
- verification timestamp;
- source URL or evidence type;
- status: `VERIFIED`, `MISSING`, or `INCOMPATIBLE`.

No verification process may change routing automatically.

The TokenRouter deployment remains a non-routed candidate until all of these
are true:

- current post-promotion pricing is recorded;
- `max_tokens` is accepted by the endpoint;
- the structured-output live probe passes;
- the deployment status is promoted to `VERIFIED`;
- a separate routing-policy commit explicitly assigns it to an engine.

## 15. Migration Strategy

### Phase 1: Establish central sources

- Add `ai-model-registry.ts`.
- Add `ai-routing-policy.ts`.
- Populate them from the current researched and verified configuration.
- Add contracts proving complete route and deployment coverage.
- Keep runtime behavior unchanged.

### Phase 2: Provider abstraction

- Add TokenRouter bindings and safe presence flags.
- Introduce shared OpenAI-compatible transport.
- Retain focused OpenRouter and TokenRouter provider adapters.
- Add MiniMax M3 TokenRouter deployment.

The TokenRouter deployment is added as a `DOCUMENTED` candidate. Durable
registry/policy, transport, telemetry, embedding, and admin work proceeds with
all production routes on verified OpenRouter deployments.

### Phase 3: Router migration

- Resolve routes through logical keys.
- Add capability and credential preflight.
- Integrate engine-specific output validation into the router success boundary.
- Implement explicit retry/fallback behavior.

### Phase 4: Telemetry and admin

- Add database migration for generation summary fields and provider events.
- Persist one event per call.
- Add admin list columns and attempt detail timeline.
- Add sanitization and access-control contracts.

### Phase 5: Embedding migration

- Move embedding model configuration into registry and policy.
- Replace the embedding-specific allowlist.
- Preserve vector-dimension validation and stored provider/model snapshots.

### Phase 6: Remove legacy sources

- Remove `MODEL_ALLOWLIST`.
- Remove `MODEL_COST_MAP`.
- Remove `FIXED_FEATURE_MODELS` and `PROSE_MODELS`.
- Remove model override environment bindings.
- Update tests, examples, deployment scripts, and documentation.
- Add a repository contract preventing raw provider model IDs outside approved locations.

### Optional Phase 7: TokenRouter activation gate

- Reverify TokenRouter pricing after the 22 June 2026 promotion ends.
- Run the explicit `MiniMax-M3` compatibility probe.
- Promote the candidate deployment to `VERIFIED` only after the probe passes.
- Activate one low-risk engine in a separate routing-policy commit.
- Expand to other compatible engines only after admin telemetry is reviewed.

## 16. Production Rollout

1. Deploy additive telemetry schema.
2. Deploy registry/policy and provider abstraction with current OpenRouter routes preserved.
3. Verify the durable OpenRouter parity routes and admin telemetry.
4. Remove legacy configuration after parity and rollback checks pass.
5. Keep TokenRouter unassigned while its deployment is only `DOCUMENTED`.
6. After post-promotion verification, activate TokenRouter for one low-risk
   compatible engine in a separate commit.
7. Run an explicitly authorized live smoke and inspect the admin timeline.
8. Expand to foundation, outline, chapter beats, or prose hemat incrementally
   only when their quality evidence supports it.
9. Keep unsuitable engines on their researched provider/model routes.
10. Monitor invalid-output rate, fallback rate, latency, provider cost, and refund rate.

## 17. Testing Requirements

The implementation plan must include:

- registry type and lookup contracts;
- routing coverage contracts;
- capability compatibility contracts;
- provider/model ID translation tests;
- TokenRouter and OpenRouter request/response parser tests;
- missing-credential preflight tests;
- retry and explicit cross-provider fallback tests;
- unsafe-output no-fallback tests;
- structured-output validation and fallback tests;
- embedding modality and dimension tests;
- provider-cost calculation tests;
- an automated diff between OpenRouter registry prices and the restored audit
  snapshot;
- generation-provider-event sanitization tests;
- admin list/detail API tests;
- admin UI timeline tests;
- credit debit/refund and idempotency regressions;
- startup/deployment validation tests;
- repository scan prohibiting raw provider model IDs outside:
  - `ai-model-registry.ts`;
  - provider verification fixtures/scripts;
  - historical audit documentation.

## 18. Rollback

Rollback is configuration-by-code, not environment override:

- revert the routing-policy commit for an affected engine;
- redeploy;
- use `AI_GENERATION_ENABLED=false` for immediate global shutdown;
- preserve provider events and generation attempts as audit evidence;
- never delete or rewrite historical provider/cost records.

During phased migration, each phase must remain independently revertible. Additive database columns/tables may remain unused after a code rollback.

## 19. Acceptance Criteria

The design is successfully implemented when:

1. Every engine and embedding route resolves through `ai-routing-policy.ts`.
2. Every logical model and provider deployment resolves through `ai-model-registry.ts`.
3. No engine contains raw provider model IDs.
4. Provider-specific IDs, pricing, capability, and verification are not duplicated.
5. Zero production engines use TokenRouter while its deployment is only
   `DOCUMENTED`; activation requires the optional verification gate.
6. Cross-provider fallback occurs only when declared in policy.
7. Structured invalid output triggers retry/fallback before success is recorded.
8. Unsafe output never triggers fallback.
9. Admin diagnostics show a safe per-call timeline.
10. User credit pricing remains independent of provider routing.
11. Legacy model override environment variables and duplicate allowlists/maps are removed.
12. Existing generation, refund, idempotency, safety, and embedding tests remain green.
