# AI Model Registry and Routing Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated model/provider configuration with one typed model registry and one typed routing policy, add explicit provider-per-engine routing with TokenRouter MiniMax M3 as a gated candidate, validate outputs before success, and expose safe per-call diagnostics in the admin dashboard.

**Architecture:** `ai-model-registry.ts` owns logical model definitions and provider deployments; `ai-routing-policy.ts` owns the primary/fallback provider-model target for every generation and embedding route. The router resolves those two sources, calls provider-specific adapters over a shared OpenAI-compatible transport, records one safe event per provider call, and only returns success after engine-specific validation. Credit pricing remains independent.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Node/tsx contract tests, Supabase/Postgres, React 18, React Router, existing Tailwind component system.

---

## Scope and execution order

This is one cohesive refactor with independently testable checkpoints.
Execute Tasks 1-3 and 5-14 in order with every production route kept on
verified OpenRouter deployments. `Optional Gate A` is deliberately skipped
until the durable refactor is complete and TokenRouter pricing is reverified
after the 22 June 2026 promotion.

The implementation must preserve unrelated user changes in the dirty worktree. At execution time, use an isolated worktree and port only this plan's commits.

## File responsibility map

### New authoritative runtime files

- `apps/api/src/services/ai-model-registry.ts`
  - Logical model keys, modality, capabilities, provider deployment IDs, context limits, pricing, verification evidence.
- `apps/api/src/services/ai-routing-policy.ts`
  - Primary/fallback provider + logical model for every generation type and embedding route.
- `apps/api/src/services/openai-compatible-client.ts`
  - Provider-neutral HTTP transport for chat completions and embeddings.
- `apps/api/src/services/ai-provider-adapters.ts`
  - OpenRouter, TokenRouter, and mock adapter selection; credentials and provider-specific headers.
- `apps/api/src/services/generation-provider-event.ts`
  - Safe persistence and mapping for one provider-call event.

### Existing files that become consumers

- `apps/api/src/services/model-router.ts`
  - Route resolution, preflight, retry, validation, explicit fallback, normalized result.
- `apps/api/src/services/model-cost-map.ts`
  - Deleted after all callers use registry deployment pricing.
- `apps/api/src/services/model-routing-v2.ts`
  - Deleted after all callers use `ai-routing-policy.ts`.
- `apps/api/src/services/openrouter-client.ts`
  - Deleted after transport/adapters reach parity.
- `apps/api/src/services/import/embedding.ts`
  - Uses registry/policy and shared transport; no local allowlist.
- `apps/api/src/services/generation-attempt.ts`
  - Stores final route summary.
- `apps/api/src/services/admin-ops.ts`
  - Returns attempt summary plus provider-event timeline.

### New schema

- `supabase/migrations/00022_ai_routing_provider_telemetry.sql`
  - Adds routing summary columns to `generation_attempts`.
  - Creates admin-only `generation_provider_events`.

### New/updated tests

- `apps/api/scripts/ai-model-registry-contracts.test.mts`
- `apps/api/scripts/ai-routing-policy-contracts.test.mts`
- `apps/api/scripts/openai-compatible-provider-contracts.test.mts`
- `apps/api/scripts/model-router-v3-contracts.test.mts`
- `apps/api/scripts/generation-provider-events-contracts.test.mts`
- `apps/api/scripts/ai-model-id-boundary.test.mts`
- `apps/web/scripts/admin-generation-attempts-ui-contracts.test.mts`

---

### Task 1: Establish the typed AI model registry

**Files:**
- Create: `apps/api/src/services/ai-model-registry.ts`
- Create: `apps/api/scripts/ai-model-registry-contracts.test.mts`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Restore: `docs/audit/20-credit-v2-model-verification-2026-06-19.md` from commit `2d0e717`

- [ ] **Step 1: Inspect the historical verification record without modifying the tree**

Run:

```powershell
git show 2d0e717:docs/audit/20-credit-v2-model-verification-2026-06-19.md
git show 2d0e717:apps/api/src/services/openrouter-model-verification.ts
```

Expected: the 19 June 2026 OpenRouter catalog snapshot is visible, including the accepted `anthropic/claude-opus-4.6` and `google/gemini-3.1-pro-preview` records.

- [ ] **Step 2: Write the failing registry contract**

Create `apps/api/scripts/ai-model-registry-contracts.test.mts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_MODEL_REGISTRY,
  getAiModel,
  getAiModelDeployment,
  getDeploymentCost,
  isAiLogicalModelKey,
} from "../src/services/ai-model-registry.ts";

assert.equal(isAiLogicalModelKey("minimax_text"), true);
assert.equal(isAiLogicalModelKey("minimax/minimax-m3"), false);
assert.equal(isAiLogicalModelKey("prose_premium"), false);

const minimax = getAiModel("minimax_text");
assert.equal(minimax.modality, "text");
assert.equal(minimax.capabilities.textGeneration, true);
assert.equal(minimax.capabilities.structuredJson, true);

const openRouterMinimax = getAiModelDeployment(
  "minimax_text",
  "openrouter",
);
assert.equal(openRouterMinimax.modelId, "minimax/minimax-m3");
assert.equal(openRouterMinimax.verificationStatus, "verified");

const tokenRouterMinimax = getAiModelDeployment(
  "minimax_text",
  "tokenrouter",
);
assert.equal(tokenRouterMinimax.modelId, "MiniMax-M3");
assert.equal(tokenRouterMinimax.verificationStatus, "documented");
assert.equal(tokenRouterMinimax.promotionEndsOn, "2026-06-22");

assert.deepEqual(getDeploymentCost("minimax_text", "openrouter"), {
  inputUsdPer1M: 0.3,
  outputUsdPer1M: 1.2,
});
assert.deepEqual(getDeploymentCost("minimax_text", "tokenrouter"), {
  inputUsdPer1M: 0,
  outputUsdPer1M: 0,
});

assert.equal(
  getAiModel("openai_embedding_small").embeddingDimensions,
  1536,
);

for (const [logicalModel, model] of Object.entries(AI_MODEL_REGISTRY)) {
  assert.ok(Object.keys(model.deployments).length > 0, `${logicalModel} needs a deployment`);
  for (const deployment of Object.values(model.deployments)) {
    assert.ok(deployment.modelId.length > 0);
    assert.ok(deployment.contextWindow > 0);
    assert.ok(Number.isFinite(Date.parse(deployment.verifiedAt)));
    assert.ok(deployment.verificationSource.length > 0);
    assert.ok(deployment.pricing.inputUsdPer1M >= 0);
    assert.ok(deployment.pricing.outputUsdPer1M >= 0);
  }
}

const audit = readFileSync(
  "../../docs/audit/20-credit-v2-model-verification-2026-06-19.md",
  "utf8",
);
const auditPrices = new Map<string, {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}>();
for (const line of audit.split(/\r?\n/)) {
  if (!line.startsWith("| `")) continue;
  const columns = line
    .split("|")
    .slice(1, -1)
    .map((column) => column.trim());
  if (columns[2] !== "VERIFIED") continue;
  auditPrices.set(columns[0].replaceAll("`", ""), {
    inputUsdPer1M: Number(columns[5].replace("$", "")),
    outputUsdPer1M: Number(columns[6].replace("$", "")),
  });
}

for (const model of Object.values(AI_MODEL_REGISTRY)) {
  const deployment = model.deployments.openrouter;
  if (!deployment || deployment.verificationStatus !== "verified") continue;
  if (
    deployment.verificationSource !==
    "https://openrouter.ai/api/v1/models"
  ) {
    continue;
  }
  assert.deepEqual(
    deployment.pricing,
    auditPrices.get(deployment.modelId),
    `${deployment.modelId} pricing must equal audit 20`,
  );
}

console.log("PASS AI model registry contracts");
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```powershell
npx tsx apps/api/scripts/ai-model-registry-contracts.test.mts
```

Expected: FAIL because `ai-model-registry.ts` does not exist.

- [ ] **Step 4: Implement registry types and the complete initial registry**

Create `apps/api/src/services/ai-model-registry.ts` with these public contracts:

```ts
import { AppError } from "../errors.js";

export type AiLiveProviderId = "openrouter" | "tokenrouter";
export type AiModality = "text" | "embedding";
export type AiVerificationStatus =
  | "verified"
  | "documented"
  | "missing"
  | "incompatible";

export interface AiModelCapabilities {
  textGeneration: boolean;
  structuredJson: boolean;
  reasoning: boolean;
  streaming: boolean;
  embedding: boolean;
}

export interface AiDeploymentPricing {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export interface AiModelDeployment {
  modelId: string;
  contextWindow: number;
  applicationContextLimit: number;
  pricing: AiDeploymentPricing;
  pricingKind: "catalog" | "temporary_promotion";
  promotionEndsOn?: string;
  verifiedAt: string;
  verificationSource: string;
  verificationStatus: AiVerificationStatus;
  supportedParameters: readonly string[];
  outputNormalization: {
    stripThinkTags: boolean;
  };
}

export interface AiModelDefinition {
  modality: AiModality;
  capabilities: AiModelCapabilities;
  embeddingDimensions?: number;
  deployments: Partial<Record<AiLiveProviderId, AiModelDeployment>>;
}
```

Define the registry with exactly these family-alias keys and provider IDs.
Copy every OpenRouter price from the restored audit 20 table; the contract
below is the source-of-truth diff and must fail if any number drifts:

```ts
export const AI_MODEL_REGISTRY = {
  gemini_flash_lite: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-3.1-flash-lite",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.25, outputUsdPer1M: 1.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  qwen_plus: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "qwen/qwen3.7-plus",
        contextWindow: 1_000_000,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.32, outputUsdPer1M: 1.28 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
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
      openrouter: {
        modelId: "minimax/minimax-m3",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.3, outputUsdPer1M: 1.2 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: true },
      },
      tokenrouter: {
        modelId: "MiniMax-M3",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0, outputUsdPer1M: 0 },
        pricingKind: "temporary_promotion",
        promotionEndsOn: "2026-06-22",
        verifiedAt: "2026-06-21T00:00:00.000Z",
        verificationSource: "TokenRouter MiniMax-M3 model page supplied by operator",
        verificationStatus: "documented",
        supportedParameters: ["max_tokens", "temperature"],
        outputNormalization: { stripThinkTags: true },
      },
    },
  },
  deepseek_flash: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "deepseek/deepseek-v4-flash",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.09, outputUsdPer1M: 0.18 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  gemini_flash: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-2.5-flash",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 0.3, outputUsdPer1M: 2.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  mistral_large: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: false,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "mistralai/mistral-large-2512",
        contextWindow: 262_144,
        applicationContextLimit: 120_000,
        pricing: { inputUsdPer1M: 0.5, outputUsdPer1M: 1.5 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  claude_opus: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "anthropic/claude-opus-4.6",
        contextWindow: 1_000_000,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 5, outputUsdPer1M: 25 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  gemini_pro: {
    modality: "text",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      reasoning: true,
      streaming: true,
      embedding: false,
    },
    deployments: {
      openrouter: {
        modelId: "google/gemini-3.1-pro-preview",
        contextWindow: 1_048_576,
        applicationContextLimit: 200_000,
        pricing: { inputUsdPer1M: 2, outputUsdPer1M: 12 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-19T10:32:39.680Z",
        verificationSource: "https://openrouter.ai/api/v1/models",
        verificationStatus: "verified",
        supportedParameters: [
          "max_tokens",
          "temperature",
          "response_format",
          "structured_outputs",
        ],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
  openai_embedding_small: {
    modality: "embedding",
    capabilities: {
      textGeneration: false,
      structuredJson: false,
      reasoning: false,
      streaming: false,
      embedding: true,
    },
    embeddingDimensions: 1536,
    deployments: {
      openrouter: {
        modelId: "openai/text-embedding-3-small",
        contextWindow: 8_191,
        applicationContextLimit: 8_000,
        pricing: { inputUsdPer1M: 0.02, outputUsdPer1M: 0 },
        pricingKind: "catalog",
        verifiedAt: "2026-06-21T00:00:00.000Z",
        verificationSource: "existing Sprint 18 production embedding contract",
        verificationStatus: "verified",
        supportedParameters: ["encoding_format"],
        outputNormalization: { stripThinkTags: false },
      },
    },
  },
} as const satisfies Record<string, AiModelDefinition>;

export type AiLogicalModelKey = keyof typeof AI_MODEL_REGISTRY;

export function isAiLogicalModelKey(value: unknown): value is AiLogicalModelKey {
  return typeof value === "string" && value in AI_MODEL_REGISTRY;
}

export function getAiModel(key: AiLogicalModelKey): AiModelDefinition {
  return AI_MODEL_REGISTRY[key];
}

export function getAiModelDeployment(
  key: AiLogicalModelKey,
  provider: AiLiveProviderId,
): AiModelDeployment {
  const deployment = AI_MODEL_REGISTRY[key].deployments[provider];
  if (!deployment) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `Model ${key} has no ${provider} deployment`,
      503,
    );
  }
  return deployment;
}

export function getDeploymentCost(
  key: AiLogicalModelKey,
  provider: AiLiveProviderId,
): AiDeploymentPricing {
  return getAiModelDeployment(key, provider).pricing;
}
```

- [ ] **Step 5: Restore the OpenRouter audit report**

Restore the exact historical file contents from commit `2d0e717` into:

```text
docs/audit/20-credit-v2-model-verification-2026-06-19.md
```

Do not change the historical timestamp or rewrite rejected decisions.

- [ ] **Step 6: Add test scripts**

Add to `apps/api/package.json`:

```json
"test:ai-model-registry": "tsx scripts/ai-model-registry-contracts.test.mts"
```

Add to root `package.json`:

```json
"test:ai-routing": "npm run build:shared && npm run test:ai-model-registry -w @vibenovel/api"
```

- [ ] **Step 7: Run the registry contract**

Run:

```powershell
npm run test:ai-model-registry -w @vibenovel/api
```

Expected: `PASS AI model registry contracts`.

- [ ] **Step 8: Commit**

```powershell
git add apps/api/src/services/ai-model-registry.ts apps/api/scripts/ai-model-registry-contracts.test.mts apps/api/package.json package.json docs/audit/20-credit-v2-model-verification-2026-06-19.md
git commit -m "feat(ai): add central model registry"
```

---

### Task 2: Establish one routing policy for every engine

**Files:**
- Create: `apps/api/src/services/ai-routing-policy.ts`
- Create: `apps/api/scripts/ai-routing-policy-contracts.test.mts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write the failing routing policy contract**

Create `apps/api/scripts/ai-routing-policy-contracts.test.mts`:

```ts
import assert from "node:assert/strict";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
} from "@vibenovel/shared";
import {
  AI_GENERATION_ROUTING_POLICY,
  AI_ROUTING_POLICY_VERSION,
  getEmbeddingRoute,
  resolveGenerationRoute,
  validateAiRoutingPolicy,
} from "../src/services/ai-routing-policy.ts";

assert.equal(AI_ROUTING_POLICY_VERSION, "v3");
assert.deepEqual(validateAiRoutingPolicy(), []);

assert.deepEqual(
  resolveGenerationRoute(
    GENERATION_TYPES.intake_assistant,
    WRITER_QUALITY_MODES.terbaik,
  ).primary,
  { provider: "openrouter", model: "gemini_flash_lite" },
);

assert.deepEqual(
  resolveGenerationRoute(
    GENERATION_TYPES.prose_beat,
    WRITER_QUALITY_MODES.seimbang,
  ).primary,
  { provider: "openrouter", model: "gemini_flash" },
);

assert.equal(
  resolveGenerationRoute(
    GENERATION_TYPES.outline_generation,
    WRITER_QUALITY_MODES.hemat,
  ).maxOutputTokens,
  4000,
);

assert.deepEqual(getEmbeddingRoute("import_rag").primary, {
  provider: "openrouter",
  model: "openai_embedding_small",
});

assert.equal(
  AI_GENERATION_ROUTING_POLICY[GENERATION_TYPES.summary_delta],
  AI_GENERATION_ROUTING_POLICY[GENERATION_TYPES.continuity_delta],
  "legacy summary_delta must reference the canonical continuity route",
);

for (const generationType of Object.values(GENERATION_TYPES)) {
  for (const qualityMode of Object.values(WRITER_QUALITY_MODES)) {
    const route = resolveGenerationRoute(generationType, qualityMode);
    assert.equal(route.primary.provider, "openrouter");
    assert.notEqual(route.fallback?.provider, "tokenrouter");
  }
}

console.log("PASS AI routing policy contracts");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx tsx apps/api/scripts/ai-routing-policy-contracts.test.mts
```

Expected: FAIL because `ai-routing-policy.ts` does not exist.

- [ ] **Step 3: Implement policy types**

Create `apps/api/src/services/ai-routing-policy.ts` with:

```ts
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";
import {
  AI_MODEL_REGISTRY,
  getAiModelDeployment,
  type AiLiveProviderId,
  type AiLogicalModelKey,
  type AiModelCapabilities,
} from "./ai-model-registry.js";

export const AI_ROUTING_POLICY_VERSION = "v3";

export type AiCapabilityRequirement = keyof AiModelCapabilities;

export interface AiRouteTarget {
  provider: AiLiveProviderId;
  model: AiLogicalModelKey;
}

export interface ResolvedAiRoute {
  routeKey: GenerationType | "embedding_import_rag";
  requires: readonly AiCapabilityRequirement[];
  primary: AiRouteTarget;
  fallback: AiRouteTarget | null;
  maxOutputTokens: number;
  timeoutMs: number;
  primaryMaxRetries: number;
  temperature: number;
}

interface FixedGenerationRoute
  extends Omit<ResolvedAiRoute, "routeKey"> {
  kind: "fixed";
}

interface TieredGenerationRoute {
  kind: "tiered";
  requires: readonly AiCapabilityRequirement[];
  tiers: Record<
    WriterQualityMode,
    Omit<ResolvedAiRoute, "routeKey" | "requires">
  >;
}

type GenerationRouteDefinition =
  | FixedGenerationRoute
  | TieredGenerationRoute;
```

- [ ] **Step 4: Add the complete initial routing matrix**

Use OpenRouter for the complete durable parity rollout. TokenRouter remains a
non-routed `documented` candidate until `Optional Gate A` is executed after
Task 14:

```ts
const TEXT_JSON = ["textGeneration", "structuredJson"] as const;
const TEXT_ONLY = ["textGeneration"] as const;
const CONTINUITY_DELTA_ROUTE = {
  kind: "fixed",
  requires: TEXT_JSON,
  primary: { provider: "openrouter", model: "deepseek_flash" },
  fallback: { provider: "openrouter", model: "gemini_flash_lite" },
  maxOutputTokens: 1500,
  timeoutMs: 30_000,
  primaryMaxRetries: 1,
  temperature: 0.2,
} as const;

export const AI_GENERATION_ROUTING_POLICY = {
  [GENERATION_TYPES.intake_assistant]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "gemini_flash_lite" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 1500,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.7,
  },
  [GENERATION_TYPES.concept_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "qwen_plus" },
    fallback: { provider: "openrouter", model: "minimax_text" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.foundation_proposal]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.draft_import_signal_extraction]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "gemini_flash_lite" },
    fallback: { provider: "openrouter", model: "deepseek_flash" },
    maxOutputTokens: 1800,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.1,
  },
  [GENERATION_TYPES.outline_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 4000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
  [GENERATION_TYPES.beat_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "minimax_text" },
    fallback: { provider: "openrouter", model: "qwen_plus" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.35,
  },
  [GENERATION_TYPES.chapter_summary_generation]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "deepseek_flash" },
    fallback: { provider: "openrouter", model: "gemini_flash_lite" },
    maxOutputTokens: 3000,
    timeoutMs: 60_000,
    primaryMaxRetries: 1,
    temperature: 0.35,
  },
  [GENERATION_TYPES.continuity_delta]: CONTINUITY_DELTA_ROUTE,
  [GENERATION_TYPES.summary_delta]: CONTINUITY_DELTA_ROUTE,
  [GENERATION_TYPES.prose_beat]: {
    kind: "tiered",
    requires: TEXT_ONLY,
    tiers: {
      [WRITER_QUALITY_MODES.hemat]: {
        primary: { provider: "openrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 800,
        timeoutMs: 30_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.seimbang]: {
        primary: { provider: "openrouter", model: "gemini_flash" },
        fallback: { provider: "openrouter", model: "mistral_large" },
        maxOutputTokens: 1200,
        timeoutMs: 45_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.terbaik]: {
        primary: { provider: "openrouter", model: "claude_opus" },
        fallback: { provider: "openrouter", model: "gemini_pro" },
        maxOutputTokens: 2000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
    },
  },
  [GENERATION_TYPES.prose_rewrite]: {
    kind: "tiered",
    requires: TEXT_ONLY,
    tiers: {
      [WRITER_QUALITY_MODES.hemat]: {
        primary: { provider: "openrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 800,
        timeoutMs: 30_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.seimbang]: {
        primary: { provider: "openrouter", model: "gemini_flash" },
        fallback: { provider: "openrouter", model: "mistral_large" },
        maxOutputTokens: 1200,
        timeoutMs: 45_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
      [WRITER_QUALITY_MODES.terbaik]: {
        primary: { provider: "openrouter", model: "claude_opus" },
        fallback: { provider: "openrouter", model: "gemini_pro" },
        maxOutputTokens: 2000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.7,
      },
    },
  },
  [GENERATION_TYPES.publish_copy]: {
    kind: "fixed",
    requires: TEXT_JSON,
    primary: { provider: "openrouter", model: "qwen_plus" },
    fallback: { provider: "openrouter", model: "gemini_flash_lite" },
    maxOutputTokens: 800,
    timeoutMs: 30_000,
    primaryMaxRetries: 1,
    temperature: 0.4,
  },
} as const satisfies Record<GenerationType, GenerationRouteDefinition>;

export const AI_EMBEDDING_ROUTING_POLICY = {
  import_rag: {
    routeKey: "embedding_import_rag",
    requires: ["embedding"] as const,
    primary: { provider: "openrouter", model: "openai_embedding_small" },
    fallback: null,
    maxOutputTokens: 0,
    timeoutMs: 45_000,
    primaryMaxRetries: 1,
    temperature: 0,
  },
} as const;
```

- [ ] **Step 5: Add resolvers and policy validation**

Add:

```ts
export function resolveGenerationRoute(
  generationType: GenerationType,
  qualityMode: WriterQualityMode,
): ResolvedAiRoute {
  const definition = AI_GENERATION_ROUTING_POLICY[generationType];
  if (!definition) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `No route for generation type ${generationType}`,
      503,
    );
  }
  if (definition.kind === "fixed") {
    const { kind: _kind, ...route } = definition;
    return { routeKey: generationType, ...route };
  }
  return {
    routeKey: generationType,
    requires: definition.requires,
    ...definition.tiers[qualityMode],
  };
}

export function getEmbeddingRoute(
  key: keyof typeof AI_EMBEDDING_ROUTING_POLICY,
): ResolvedAiRoute {
  return AI_EMBEDDING_ROUTING_POLICY[key];
}

function validateTarget(
  routeName: string,
  targetName: "primary" | "fallback",
  target: AiRouteTarget | null,
  requires: readonly AiCapabilityRequirement[],
): string[] {
  if (!target) return [];
  const model = AI_MODEL_REGISTRY[target.model];
  const deployment = getAiModelDeployment(target.model, target.provider);
  const errors: string[] = [];
  for (const capability of requires) {
    if (!model.capabilities[capability]) {
      errors.push(`${routeName}.${targetName} lacks ${capability}`);
    }
  }
  if (deployment.verificationStatus !== "verified") {
    errors.push(
      `${routeName}.${targetName} deployment is not verified: ${deployment.verificationStatus}`,
    );
  }
  if (
    model.modality === "text" &&
    !deployment.supportedParameters.includes("max_tokens")
  ) {
    errors.push(`${routeName}.${targetName} does not support max_tokens`);
  }
  return errors;
}

export function validateAiRoutingPolicy(): string[] {
  const errors: string[] = [];
  for (const generationType of Object.values(GENERATION_TYPES)) {
    const definition = AI_GENERATION_ROUTING_POLICY[generationType];
    if (!definition) {
      errors.push(`Missing route for ${generationType}`);
      continue;
    }
    const resolvedRoutes =
      definition.kind === "fixed"
        ? [resolveGenerationRoute(generationType, WRITER_QUALITY_MODES.hemat)]
        : Object.values(WRITER_QUALITY_MODES).map((qualityMode) =>
            resolveGenerationRoute(generationType, qualityMode),
          );
    for (const route of resolvedRoutes) {
      errors.push(
        ...validateTarget(
          String(route.routeKey),
          "primary",
          route.primary,
          route.requires,
        ),
      );
      errors.push(
        ...validateTarget(
          String(route.routeKey),
          "fallback",
          route.fallback,
          route.requires,
        ),
      );
      if (
        route.fallback &&
        route.primary.provider === route.fallback.provider &&
        route.primary.model === route.fallback.model
      ) {
        errors.push(`${route.routeKey} primary and fallback are identical`);
      }
    }
  }
  const embedding = getEmbeddingRoute("import_rag");
  errors.push(
    ...validateTarget(
      "embedding_import_rag",
      "primary",
      embedding.primary,
      embedding.requires,
    ),
  );
  return errors;
}
```

- [ ] **Step 6: Run the contract**

Run:

```powershell
npx tsx apps/api/scripts/ai-routing-policy-contracts.test.mts
```

Expected: `PASS AI routing policy contracts`.

- [ ] **Step 7: Wire the script**

Add to `apps/api/package.json`:

```json
"test:ai-routing-policy": "tsx scripts/ai-routing-policy-contracts.test.mts"
```

Change root `test:ai-routing` to:

```json
"test:ai-routing": "npm run build:shared && npm run test:ai-model-registry -w @vibenovel/api && npm run test:ai-routing-policy -w @vibenovel/api"
```

- [ ] **Step 8: Commit**

```powershell
git add apps/api/src/services/ai-routing-policy.ts apps/api/scripts/ai-routing-policy-contracts.test.mts apps/api/package.json package.json
git commit -m "feat(ai): centralize engine routing policy"
```

---

### Task 3: Add provider credentials and shared OpenAI-compatible transport

**Files:**
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/node-bindings.ts`
- Create: `apps/api/src/services/openai-compatible-client.ts`
- Create: `apps/api/src/services/ai-provider-adapters.ts`
- Create: `apps/api/scripts/openai-compatible-provider-contracts.test.mts`
- Modify: `apps/api/scripts/env-health-flags.test.mts`
- Modify: `apps/api/.dev.vars.example`
- Modify: `.env.production.example`
- Modify: `apps/api/wrangler.toml`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write failing env and transport tests**

Create `apps/api/scripts/openai-compatible-provider-contracts.test.mts`:

```ts
import assert from "node:assert/strict";
import type { AppBindings } from "../src/env.ts";
import {
  buildOpenAiCompatibleChatRequest,
  callOpenAiCompatibleChat,
} from "../src/services/openai-compatible-client.ts";
import {
  getProviderRuntime,
  hasProviderCredential,
} from "../src/services/ai-provider-adapters.ts";

const bindings: AppBindings = {
  OPENROUTER_API_KEY: "openrouter-secret",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  TOKENROUTER_API_KEY: "tokenrouter-secret",
  TOKENROUTER_BASE_URL: "https://api.tokenrouter.com/v1",
};

assert.equal(hasProviderCredential(bindings, "openrouter"), true);
assert.equal(hasProviderCredential(bindings, "tokenrouter"), true);
assert.equal(
  getProviderRuntime(bindings, "tokenrouter").baseUrl,
  "https://api.tokenrouter.com/v1",
);

assert.deepEqual(
  buildOpenAiCompatibleChatRequest({
    modelId: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    maxOutputTokens: 100,
    temperature: 0.2,
  }),
  {
    model: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    max_tokens: 100,
    temperature: 0.2,
    stream: false,
  },
);

let requestedUrl = "";
const result = await callOpenAiCompatibleChat(
  {
    provider: "tokenrouter",
    baseUrl: "https://api.tokenrouter.com/v1",
    apiKey: "tokenrouter-secret",
    modelId: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    maxOutputTokens: 100,
    temperature: 0.2,
    timeoutMs: 5000,
  },
  async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "{\"ok\":true}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
);

assert.equal(requestedUrl, "https://api.tokenrouter.com/v1/chat/completions");
assert.equal(result.text, "{\"ok\":true}");
assert.equal(result.inputTokens, 12);
assert.equal(result.outputTokens, 6);

console.log("PASS OpenAI-compatible provider contracts");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx tsx apps/api/scripts/openai-compatible-provider-contracts.test.mts
```

Expected: FAIL because the transport and adapter files do not exist.

- [ ] **Step 3: Add TokenRouter bindings and safe health flags**

In `AppBindings`, add:

```ts
TOKENROUTER_API_KEY?: string;
TOKENROUTER_BASE_URL?: string;
```

Add:

```ts
const DEFAULT_TOKENROUTER_BASE_URL = "https://api.tokenrouter.com/v1";

export function getTokenRouterApiKey(
  bindings: AppBindings,
): string | undefined {
  return bindings.TOKENROUTER_API_KEY?.trim() || undefined;
}

export function getTokenRouterBaseUrl(bindings: AppBindings): string {
  return (
    bindings.TOKENROUTER_BASE_URL?.trim() ||
    DEFAULT_TOKENROUTER_BASE_URL
  ).replace(/\/$/, "");
}

export function hasTokenRouterApiKey(bindings: AppBindings): boolean {
  return Boolean(getTokenRouterApiKey(bindings));
}
```

Add `hasTokenRouterApiKey: boolean` to `EnvPresenceFlags` and return it from `getEnvPresenceFlags`.

Add both binding names to `BINDING_ENV_KEYS` in `node-bindings.ts`.

- [ ] **Step 4: Implement the provider-neutral transport**

Create `openai-compatible-client.ts` with:

```ts
import { AppError } from "../errors.js";
import type {
  AiLiveProviderId,
} from "./ai-model-registry.js";
import type { PromptMessage } from "./ai-generation-types.js";

export interface OpenAiCompatibleChatInput {
  provider: AiLiveProviderId;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  messages: PromptMessage[];
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface OpenAiCompatibleChatResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  latencyMs: number;
}

export function buildOpenAiCompatibleChatRequest(input: {
  modelId: string;
  messages: PromptMessage[];
  maxOutputTokens: number;
  temperature: number;
}) {
  return {
    model: input.modelId,
    messages: input.messages,
    max_tokens: input.maxOutputTokens,
    temperature: input.temperature,
    stream: false,
  };
}

function providerError(
  code: string,
  message: string,
  status: 429 | 502 | 504,
  providerHttpStatus?: number,
): AppError {
  return new AppError(code, message, status, {
    providerHttpStatus: providerHttpStatus ?? null,
  });
}

export async function callOpenAiCompatibleChat(
  input: OpenAiCompatibleChatInput,
  fetcher: typeof fetch = fetch,
): Promise<OpenAiCompatibleChatResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetcher(
      `${input.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://narraza.web.id",
          "X-Title": "Narraza API",
        },
        body: JSON.stringify(
          buildOpenAiCompatibleChatRequest({
            modelId: input.modelId,
            messages: input.messages,
            maxOutputTokens: input.maxOutputTokens,
            temperature: input.temperature,
          }),
        ),
        signal: controller.signal,
      },
    );

    if (response.status === 429) {
      throw providerError(
        "AI_PROVIDER_RATE_LIMITED",
        "AI provider rate limit exceeded",
        429,
        response.status,
      );
    }
    if (!response.ok) {
      throw providerError(
        "AI_PROVIDER_ERROR",
        "AI provider rejected the request",
        502,
        response.status,
      );
    }

    const parsed = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      error?: unknown;
    };

    if (parsed.error) {
      throw providerError(
        "AI_PROVIDER_ERROR",
        "AI provider returned an error",
        502,
      );
    }
    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new AppError(
        "AI_OUTPUT_EMPTY",
        "AI provider returned empty output",
        422,
      );
    }
    return {
      text,
      inputTokens: parsed.usage?.prompt_tokens,
      outputTokens: parsed.usage?.completion_tokens,
      finishReason: parsed.choices?.[0]?.finish_reason,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw providerError(
        "AI_PROVIDER_TIMEOUT",
        "AI provider request timed out",
        504,
      );
    }
    if (error instanceof AppError) throw error;
    throw providerError(
      "AI_PROVIDER_ERROR",
      "AI provider request failed",
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 5: Implement credential-aware adapters**

Create `ai-provider-adapters.ts`:

```ts
import type { AppBindings } from "../env.js";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getTokenRouterApiKey,
  getTokenRouterBaseUrl,
} from "../env.js";
import { AppError } from "../errors.js";
import type { AiLiveProviderId } from "./ai-model-registry.js";
import {
  callOpenAiCompatibleChat,
  type OpenAiCompatibleChatInput,
  type OpenAiCompatibleChatResult,
} from "./openai-compatible-client.js";

export interface AiProviderRuntime {
  provider: AiLiveProviderId;
  baseUrl: string;
  apiKey?: string;
}

export function getProviderRuntime(
  bindings: AppBindings,
  provider: AiLiveProviderId,
): AiProviderRuntime {
  if (provider === "tokenrouter") {
    return {
      provider,
      baseUrl: getTokenRouterBaseUrl(bindings),
      apiKey: getTokenRouterApiKey(bindings),
    };
  }
  return {
    provider,
    baseUrl: getOpenRouterBaseUrl(bindings).replace(/\/$/, ""),
    apiKey: getOpenRouterApiKey(bindings),
  };
}

export function hasProviderCredential(
  bindings: AppBindings,
  provider: AiLiveProviderId,
): boolean {
  return Boolean(getProviderRuntime(bindings, provider).apiKey);
}

export async function callLiveProviderChat(
  bindings: AppBindings,
  input: Omit<
    OpenAiCompatibleChatInput,
    "baseUrl" | "apiKey"
  >,
  fetcher: typeof fetch = fetch,
): Promise<OpenAiCompatibleChatResult> {
  const runtime = getProviderRuntime(bindings, input.provider);
  if (!runtime.apiKey) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `${input.provider} API key is not configured`,
      503,
    );
  }
  return callOpenAiCompatibleChat(
    {
      ...input,
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
    },
    fetcher,
  );
}
```

- [ ] **Step 6: Update env examples and Worker configuration**

Add:

```env
TOKENROUTER_API_KEY=
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
```

Keep `OPENROUTER_*`. Do not remove legacy model overrides until Task 13.

Add to `[env.production.vars]`:

```toml
TOKENROUTER_BASE_URL = "https://api.tokenrouter.com/v1"
```

- [ ] **Step 7: Update and run health/transport contracts**

Update `env-health-flags.test.mts` to set `TOKENROUTER_API_KEY` and assert `hasTokenRouterApiKey`.

Run:

```powershell
npm run test:health-env-flags -w @vibenovel/api
npx tsx apps/api/scripts/openai-compatible-provider-contracts.test.mts
```

Expected:

```text
PASS env health flags expose safe deployment fields
PASS OpenAI-compatible provider contracts
```

- [ ] **Step 8: Add package script and commit**

Add:

```json
"test:ai-provider-transport": "tsx scripts/openai-compatible-provider-contracts.test.mts"
```

Commit:

```powershell
git add apps/api/src/env.ts apps/api/src/node-bindings.ts apps/api/src/services/openai-compatible-client.ts apps/api/src/services/ai-provider-adapters.ts apps/api/scripts/openai-compatible-provider-contracts.test.mts apps/api/scripts/env-health-flags.test.mts apps/api/.dev.vars.example .env.production.example apps/api/wrangler.toml apps/api/package.json
git commit -m "feat(ai): add TokenRouter provider transport"
```

---

### Optional Gate A: Reverify and activate TokenRouter after the durable rollout

Do not execute this gate between Tasks 3 and 5. Complete Tasks 5-14 first with
all production routes on verified OpenRouter deployments. Execute this gate only
after the 22 June 2026 promotion has ended and current TokenRouter pricing can
be verified.

**Files:**
- Create: `apps/api/scripts/tokenrouter-minimax-probe.mts`
- Create: `docs/audit/23-tokenrouter-minimax-m3-activation-verification.md`
- Modify after all checks pass: `apps/api/src/services/ai-model-registry.ts`
- Modify in a separate activation commit: `apps/api/src/services/ai-routing-policy.ts`
- Modify: `apps/api/scripts/ai-model-registry-contracts.test.mts`
- Modify: `apps/api/scripts/ai-routing-policy-contracts.test.mts`
- Modify: `apps/api/package.json`

- [ ] **Gate Step 1: Reverify current post-promotion pricing**

Record the current TokenRouter price source, retrieval timestamp, input price,
output price, and whether the model remains available as `MiniMax-M3`.
Do not carry forward the temporary zero price after 22 June 2026.

If pricing or model availability cannot be verified from a current source, stop
the gate. Keep `verificationStatus: "documented"` and keep TokenRouter absent
from production policy targets.

- [ ] **Gate Step 2: Create a safe, explicit live compatibility probe**

Create `tokenrouter-minimax-probe.mts`:

```ts
import { callOpenAiCompatibleChat } from "../src/services/openai-compatible-client.ts";

const live = process.argv.includes("--live");
if (!live) {
  console.error("BLOCKED: pass --live to authorize one TokenRouter request");
  process.exit(2);
}

const apiKey = process.env.TOKENROUTER_API_KEY?.trim();
const baseUrl =
  process.env.TOKENROUTER_BASE_URL?.trim() ||
  "https://api.tokenrouter.com/v1";

if (!apiKey) {
  console.error("BLOCKED: TOKENROUTER_API_KEY is missing");
  process.exit(2);
}

const started = Date.now();
const result = await callOpenAiCompatibleChat({
  provider: "tokenrouter",
  baseUrl,
  apiKey,
  modelId: "MiniMax-M3",
  messages: [
    {
      role: "system",
      content:
        "Return only compact JSON. Do not include markdown or explanation.",
    },
    {
      role: "user",
      content:
        'Return {"provider":"tokenrouter","model":"MiniMax-M3","items":[1,2,3]}.',
    },
  ],
  maxOutputTokens: 160,
  temperature: 0,
  timeoutMs: 30_000,
});

let parsed: unknown;
try {
  parsed = JSON.parse(
    result.text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(),
  );
} catch {
  console.error("FAIL: response was not clean JSON");
  process.exit(1);
}

const object = parsed as {
  provider?: unknown;
  model?: unknown;
  items?: unknown;
};
if (
  object.provider !== "tokenrouter" ||
  object.model !== "MiniMax-M3" ||
  !Array.isArray(object.items) ||
  object.items.length !== 3
) {
  console.error("FAIL: JSON schema mismatch");
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "VERIFIED",
    provider: "tokenrouter",
    modelId: "MiniMax-M3",
    maxTokensAccepted: true,
    structuredJson: true,
    inputTokens: result.inputTokens ?? null,
    outputTokens: result.outputTokens ?? null,
    latencyMs: Date.now() - started,
  }),
);
```

The shared transport maps `maxOutputTokens` to the request field `max_tokens`.
A PASS therefore explicitly verifies the required `max_tokens` capability. The
script must never print the key, prompt, raw response, or reasoning.

- [ ] **Gate Step 3: Add and run the authorized live probe**

```json
"verify:tokenrouter-minimax": "tsx --env-file=../../.env.production scripts/tokenrouter-minimax-probe.mts"
```

Run only after confirming the `.env.production` TokenRouter key belongs to this
project:

```powershell
npm run verify:tokenrouter-minimax -w @vibenovel/api -- --live
```

Expected: one JSON line with `status:"VERIFIED"` and
`maxTokensAccepted:true`, with no secret or raw model output. A 401, 404,
rejected `max_tokens`, malformed JSON, schema mismatch, or timeout blocks the
gate.

- [ ] **Gate Step 4: Record evidence and promote the candidate**

Create `docs/audit/23-tokenrouter-minimax-m3-activation-verification.md` with
the real execution date, endpoint, raw provider model ID, current pricing
source and values, `max_tokens` result, structured-output result, usage-field
presence, and safe GO/NO-GO decision.

Only after every gate check passes, update the deployment:

```ts
verificationStatus: "verified",
verifiedAt: "<actual ISO timestamp>",
verificationSource:
  "docs/audit/23-tokenrouter-minimax-m3-activation-verification.md",
supportedParameters: ["max_tokens", "temperature", "structured_json_probe"],
pricing: {
  inputUsdPer1M: <verified current input price>,
  outputUsdPer1M: <verified current output price>,
},
pricingKind: "catalog",
```

Update the registry contract to assert the verified values. If any check fails,
record the safe failure, leave status `documented`, and stop without editing
the production policy.

- [ ] **Gate Step 5: Commit verification separately**

```powershell
npm run test:ai-model-registry -w @vibenovel/api
git add apps/api/scripts/tokenrouter-minimax-probe.mts apps/api/src/services/ai-model-registry.ts apps/api/scripts/ai-model-registry-contracts.test.mts apps/api/package.json docs/audit/23-tokenrouter-minimax-m3-activation-verification.md
git commit -m "test(ai): verify TokenRouter MiniMax M3 activation"
```

- [ ] **Gate Step 6: Activate one low-risk engine in a separate policy commit**

Choose one compatible, low-risk engine from current quality evidence. Change
only that route's explicit primary target to:

```ts
{ provider: "tokenrouter", model: "minimax_text" }
```

Keep its explicit fallback on a verified OpenRouter deployment. Update the
policy contract to assert exactly the approved TokenRouter route count and
identity; do not activate a list of engines in bulk.

Run:

```powershell
npm run test:ai-routing
```

Commit the policy activation separately so rollback is one policy revert:

```powershell
git add apps/api/src/services/ai-routing-policy.ts apps/api/scripts/ai-routing-policy-contracts.test.mts
git commit -m "feat(ai): activate one TokenRouter route"
```

- [ ] **Gate Step 7: Run a controlled live engine smoke**

Use a non-user fixture. Verify the safe admin timeline shows TokenRouter as
primary, raw provider model ID `MiniMax-M3`, ordered sequence numbers, valid
output, and no prompt/output/reasoning fields. Do not expand to another engine
until this timeline and quality result are reviewed.

---

### Task 5: Add additive provider-call telemetry schema and shared types

**Files:**
- Create: `supabase/migrations/00022_ai_routing_provider_telemetry.sql`
- Modify: `packages/shared/src/domain.ts`
- Create: `apps/api/scripts/generation-provider-events-contracts.test.mts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write the failing schema/type contract**

Create `generation-provider-events-contracts.test.mts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  GenerationAttempt,
  GenerationProviderEvent,
} from "@vibenovel/shared";

const sql = readFileSync(
  "../../supabase/migrations/00022_ai_routing_provider_telemetry.sql",
  "utf8",
).toLowerCase();

for (const required of [
  "logical_model text",
  "routing_policy_version text",
  "fallback_used boolean",
  "retry_count integer",
  "provider_latency_ms integer",
  "create table public.generation_provider_events",
  "generation_attempt_id uuid",
  "sequence_number integer",
  "route_role text",
  "provider_model_id text",
  "provider_http_status integer",
  "estimated_cost_usd numeric",
  "enable row level security",
  "grant all on public.generation_provider_events to service_role",
]) {
  assert.match(sql, new RegExp(required.replace(/[()]/g, "\\$&")));
}

assert.doesNotMatch(sql, /grant select on public\.generation_provider_events to authenticated/);
assert.doesNotMatch(sql, /raw_prompt|raw_response|reasoning|generated_text/);

const attempt = null as unknown as GenerationAttempt;
const event = null as unknown as GenerationProviderEvent;
void attempt.logicalModel;
void attempt.routingPolicyVersion;
void attempt.fallbackUsed;
void event.providerModelId;
void event.outcome;

console.log("PASS generation provider telemetry schema contracts");
```

- [ ] **Step 2: Run and verify failure**

Run:

```powershell
npm run build:shared
npx tsx apps/api/scripts/generation-provider-events-contracts.test.mts
```

Expected: FAIL because migration and shared fields do not exist.

- [ ] **Step 3: Add migration `00022`**

Create:

```sql
ALTER TABLE public.generation_attempts
  ADD COLUMN IF NOT EXISTS logical_model text,
  ADD COLUMN IF NOT EXISTS routing_policy_version text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0
    CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS provider_latency_ms integer
    CHECK (provider_latency_ms IS NULL OR provider_latency_ms >= 0);

CREATE TABLE public.generation_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_attempt_id uuid NOT NULL
    REFERENCES public.generation_attempts (id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  route_role text NOT NULL CHECK (route_role IN ('primary', 'fallback')),
  provider text NOT NULL,
  logical_model text NOT NULL,
  provider_model_id text NOT NULL,
  retry_number integer NOT NULL DEFAULT 0 CHECK (retry_number >= 0),
  outcome text NOT NULL CHECK (
    outcome IN (
      'succeeded',
      'provider_error',
      'timeout',
      'rate_limited',
      'empty_output',
      'invalid_output',
      'unsafe_output',
      'credential_unavailable',
      'configuration_error'
    )
  ),
  error_category text,
  error_code_safe text,
  provider_http_status integer
    CHECK (
      provider_http_status IS NULL OR
      provider_http_status BETWEEN 100 AND 599
    ),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost_usd numeric
    CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generation_provider_events_attempt_sequence_unique
    UNIQUE (generation_attempt_id, sequence_number)
);

CREATE INDEX generation_provider_events_attempt_created_idx
  ON public.generation_provider_events
  (generation_attempt_id, sequence_number);

CREATE INDEX generation_provider_events_provider_created_idx
  ON public.generation_provider_events
  (provider, created_at DESC);

ALTER TABLE public.generation_provider_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.generation_provider_events TO service_role;

COMMENT ON TABLE public.generation_provider_events IS
  'Admin-only provider call diagnostics. Never store prompts, outputs, reasoning, raw response bodies, or credentials.';
```

- [ ] **Step 4: Extend shared domain types**

Add to `GenerationAttempt`:

```ts
logicalModel: string | null;
routingPolicyVersion: string | null;
fallbackUsed: boolean;
retryCount: number;
providerLatencyMs: number | null;
```

Add:

```ts
export type GenerationProviderEventRole = "primary" | "fallback";

export type GenerationProviderEventOutcome =
  | "succeeded"
  | "provider_error"
  | "timeout"
  | "rate_limited"
  | "empty_output"
  | "invalid_output"
  | "unsafe_output"
  | "credential_unavailable"
  | "configuration_error";

export interface GenerationProviderEvent {
  id: ID;
  generationAttemptId: ID;
  sequenceNumber: number;
  routeRole: GenerationProviderEventRole;
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: GenerationProviderEventOutcome;
  errorCategory: string | null;
  errorCodeSafe: string | null;
  providerHttpStatus: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: ISODateTime;
}
```

- [ ] **Step 5: Run schema/type contract**

Run:

```powershell
npm run build:shared
npx tsx apps/api/scripts/generation-provider-events-contracts.test.mts
```

Expected: `PASS generation provider telemetry schema contracts`.

- [ ] **Step 6: Add script and commit**

```json
"test:generation-provider-events": "npm run build -w @vibenovel/shared && tsx scripts/generation-provider-events-contracts.test.mts"
```

Commit:

```powershell
git add supabase/migrations/00022_ai_routing_provider_telemetry.sql packages/shared/src/domain.ts apps/api/scripts/generation-provider-events-contracts.test.mts apps/api/package.json
git commit -m "feat(ai): add provider call telemetry schema"
```

---

### Task 6: Implement provider-event persistence and attempt summaries

**Files:**
- Create: `apps/api/src/services/generation-provider-event.ts`
- Modify: `apps/api/src/services/generation-attempt.ts`
- Modify: `apps/api/scripts/generation-provider-events-contracts.test.mts`

- [ ] **Step 1: Extend the contract with sanitizer and mapper assertions**

Add:

```ts
import {
  buildSafeProviderEventInsert,
  createProviderEventSequence,
  nextProviderEventSequence,
  sanitizeProviderEventError,
} from "../src/services/generation-provider-event.ts";

assert.deepEqual(
  sanitizeProviderEventError({
    code: "AI_PROVIDER_ERROR",
    message: "Bearer sk-secret raw response: forbidden",
    providerHttpStatus: 502,
  }),
  {
    errorCategory: "provider_error",
    errorCodeSafe: "AI_PROVIDER_ERROR",
    providerHttpStatus: 502,
  },
);

const insert = buildSafeProviderEventInsert({
  generationAttemptId: "11111111-1111-1111-1111-111111111111",
  sequenceNumber: 1,
  routeRole: "primary",
  provider: "tokenrouter",
  logicalModel: "minimax_text",
  providerModelId: "MiniMax-M3",
  retryNumber: 0,
  outcome: "succeeded",
  latencyMs: 120,
  inputTokens: 10,
  outputTokens: 20,
  estimatedCostUsd: 0,
});

assert.equal(Object.hasOwn(insert, "prompt"), false);
assert.equal(Object.hasOwn(insert, "output"), false);
assert.equal(Object.hasOwn(insert, "raw_response"), false);

const sequence = createProviderEventSequence();
assert.deepEqual(
  [
    nextProviderEventSequence(sequence),
    nextProviderEventSequence(sequence),
    nextProviderEventSequence(sequence),
  ],
  [1, 2, 3],
);
```

- [ ] **Step 2: Implement safe event service**

Create `generation-provider-event.ts` with:

```ts
import type {
  GenerationProviderEvent,
  GenerationProviderEventOutcome,
  GenerationProviderEventRole,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";

const EVENT_SELECT =
  "id, generation_attempt_id, sequence_number, route_role, provider, logical_model, provider_model_id, retry_number, outcome, error_category, error_code_safe, provider_http_status, latency_ms, input_tokens, output_tokens, estimated_cost_usd, created_at";

export interface ProviderEventInsertInput {
  generationAttemptId: string;
  sequenceNumber: number;
  routeRole: GenerationProviderEventRole;
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: GenerationProviderEventOutcome;
  errorCategory?: string | null;
  errorCodeSafe?: string | null;
  providerHttpStatus?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}

export interface ProviderEventSequence {
  current: number;
}

export function createProviderEventSequence(): ProviderEventSequence {
  return { current: 0 };
}

export function nextProviderEventSequence(
  sequence: ProviderEventSequence,
): number {
  sequence.current += 1;
  return sequence.current;
}

export function buildSafeProviderEventInsert(
  input: ProviderEventInsertInput,
): Record<string, unknown> {
  return {
    generation_attempt_id: input.generationAttemptId,
    sequence_number: input.sequenceNumber,
    route_role: input.routeRole,
    provider: input.provider,
    logical_model: input.logicalModel,
    provider_model_id: input.providerModelId,
    retry_number: input.retryNumber,
    outcome: input.outcome,
    error_category: input.errorCategory ?? null,
    error_code_safe: input.errorCodeSafe ?? null,
    provider_http_status: input.providerHttpStatus ?? null,
    latency_ms: input.latencyMs ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
  };
}

export function sanitizeProviderEventError(input: {
  code: string;
  message: string;
  providerHttpStatus?: number | null;
}) {
  const category =
    input.code === "AI_PROVIDER_TIMEOUT"
      ? "timeout"
      : input.code === "AI_PROVIDER_RATE_LIMITED"
        ? "rate_limited"
        : input.code === "AI_OUTPUT_EMPTY"
          ? "empty_output"
          : input.code === "AI_OUTPUT_UNSAFE"
            ? "unsafe_output"
            : input.code === "GENERATION_FAILED"
              ? "invalid_output"
              : "provider_error";
  return {
    errorCategory: category,
    errorCodeSafe: input.code,
    providerHttpStatus: input.providerHttpStatus ?? null,
  };
}
```

Also implement persistence with an explicit sequence number:

```ts
export async function createGenerationProviderEvent(
  bindings: AppBindings,
  input: ProviderEventInsertInput,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin
    .from("generation_provider_events")
    .insert(buildSafeProviderEventInsert(input));
  if (error) {
    console.error("generation provider event insert failed", error.code ?? "");
    throw AppError.internal("Failed to record provider event");
  }
}

export async function listGenerationProviderEvents(
  bindings: AppBindings,
  generationAttemptId: string,
): Promise<GenerationProviderEvent[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_provider_events")
    .select(EVENT_SELECT)
    .eq("generation_attempt_id", generationAttemptId)
    .order("sequence_number", { ascending: true });
  if (error) throw AppError.internal("Failed to load provider events");
  return (data ?? []).map((row) => ({
    id: row.id,
    generationAttemptId: row.generation_attempt_id,
    sequenceNumber: row.sequence_number,
    routeRole: row.route_role,
    provider: row.provider,
    logicalModel: row.logical_model,
    providerModelId: row.provider_model_id,
    retryNumber: row.retry_number,
    outcome: row.outcome,
    errorCategory: row.error_category,
    errorCodeSafe: row.error_code_safe,
    providerHttpStatus: row.provider_http_status,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd:
      row.estimated_cost_usd === null
        ? null
        : Number(row.estimated_cost_usd),
    createdAt: row.created_at,
  }));
}
```

There must be no database sequence allocator and no
`SELECT max(sequence_number)`. The caller owns the single in-memory sequence
for the complete generation attempt. The database unique constraint on
`(generation_attempt_id, sequence_number)` only catches programming errors.

- [ ] **Step 3: Extend generation-attempt mapping and success input**

Add the new columns to `ATTEMPT_SELECT`, `GenerationAttemptRow`, mapper, and safe summary.

Extend `markGenerationAttemptSucceeded` input:

```ts
logicalModel: string;
routingPolicyVersion: string;
fallbackUsed: boolean;
retryCount: number;
providerLatencyMs: number;
```

Write:

```ts
logical_model: input.logicalModel,
routing_policy_version: input.routingPolicyVersion,
fallback_used: input.fallbackUsed,
retry_count: input.retryCount,
provider_latency_ms: input.providerLatencyMs,
```

- [ ] **Step 4: Add a routing-summary updater for failed attempts**

Add:

```ts
export interface GenerationAttemptRoutingSummaryInput {
  attemptId: string;
  provider: string;
  providerModelId: string;
  logicalModel: string;
  routingPolicyVersion: string;
  fallbackUsed: boolean;
  retryCount: number;
  providerLatencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number | null;
}

export async function updateGenerationAttemptRoutingSummary(
  bindings: AppBindings,
  input: GenerationAttemptRoutingSummaryInput,
): Promise<GenerationAttempt> {
  return updateGenerationAttemptStatus(bindings, input.attemptId, {
    provider: input.provider,
    model: input.providerModelId,
    logical_model: input.logicalModel,
    routing_policy_version: input.routingPolicyVersion,
    fallback_used: input.fallbackUsed,
    retry_count: input.retryCount,
    provider_latency_ms: input.providerLatencyMs,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    estimated_cost_usd:
      typeof input.estimatedCostUsd === "number"
        ? input.estimatedCostUsd
        : null,
  });
}
```

The router calls this helper before it rethrows the final failure. The subsequent `markGenerationAttemptFailed` updates only status and safe error fields, preserving the route summary.

- [ ] **Step 5: Run contracts and typecheck**

```powershell
npm run test:generation-provider-events -w @vibenovel/api
npm run typecheck:api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/services/generation-provider-event.ts apps/api/src/services/generation-attempt.ts apps/api/scripts/generation-provider-events-contracts.test.mts
git commit -m "feat(ai): persist safe provider call events"
```

---

### Task 7: Refactor model router around policy, registry, validation, and explicit fallback

**Files:**
- Modify: `apps/api/src/services/ai-generation-types.ts`
- Replace: `apps/api/src/services/model-router.ts`
- Create: `apps/api/scripts/model-router-v3-contracts.test.mts`
- Modify: `apps/api/package.json`
- Modify after TokenRouter verification PASS: `apps/api/src/services/ai-routing-policy.ts`

- [ ] **Step 1: Write failing router behavior tests**

Create `model-router-v3-contracts.test.mts` with injected provider and event recorders:

```ts
import assert from "node:assert/strict";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
} from "@vibenovel/shared";
import { AppError } from "../src/errors.ts";
import {
  assertGenerationRouteCallable,
  generateWithModelRouter,
} from "../src/services/model-router.ts";
import {
  createProviderEventSequence,
} from "../src/services/generation-provider-event.ts";

const baseBindings = {
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
  OPENROUTER_API_KEY: "openrouter",
  TOKENROUTER_API_KEY: "tokenrouter",
};

const calls: Array<{ provider: string; modelId: string }> = [];
const events: Array<{
  outcome: string;
  routeRole: string;
  sequenceNumber: number;
}> = [];
const providerEventSequence = createProviderEventSequence();

const result = await generateWithModelRouter(
  baseBindings,
  {
    generationAttemptId: "11111111-1111-1111-1111-111111111111",
    providerEventSequence,
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "hash",
    promptMessages: [{ role: "user", content: "outline" }],
    validateOutput(text) {
      const parsed = JSON.parse(text) as { chapters: unknown[] };
      if (!Array.isArray(parsed.chapters)) {
        throw new AppError("GENERATION_FAILED", "Invalid outline", 502);
      }
      return parsed;
    },
  },
  {
    resolveRoute() {
      return {
        routeKey: GENERATION_TYPES.outline_generation,
        requires: ["textGeneration", "structuredJson"],
        primary: { provider: "tokenrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 4000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.4,
      };
    },
    async callProvider(input) {
      calls.push({ provider: input.provider, modelId: input.modelId });
      if (calls.length <= 2) {
        return {
          text: "not-json",
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 20,
        };
      }
      return {
        text: '{"chapters":[]}',
        inputTokens: 11,
        outputTokens: 6,
        latencyMs: 25,
      };
    },
    async recordEvent(input) {
      events.push({
        outcome: input.outcome,
        routeRole: input.routeRole,
        sequenceNumber: input.sequenceNumber,
      });
    },
    async sleep() {},
  },
);

assert.equal(result.fallbackUsed, true);
assert.equal(result.output.chapters.length, 0);
assert.equal(calls.filter((call) => call.provider === "tokenrouter").length, 2);
assert.equal(calls.filter((call) => call.provider === "openrouter").length, 1);
assert.equal(calls.length, 3);
assert.equal(calls[0].provider, "tokenrouter");
assert.equal(calls[0].modelId, "MiniMax-M3");
assert.equal(calls[2].provider, "openrouter");
assert.equal(calls[2].modelId, "qwen/qwen3.7-plus");
assert.deepEqual(events.map((event) => event.outcome), [
  "invalid_output",
  "invalid_output",
  "succeeded",
]);
assert.deepEqual(events.map((event) => event.sequenceNumber), [1, 2, 3]);

let unsafeFallbackCalls = 0;
await assert.rejects(
  generateWithModelRouter(
    baseBindings,
    {
      generationAttemptId: "22222222-2222-2222-2222-222222222222",
      providerEventSequence: createProviderEventSequence(),
      generationType: GENERATION_TYPES.foundation_proposal,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash: "hash",
      promptMessages: [{ role: "user", content: "foundation" }],
      validateOutput() {
        throw new AppError("AI_OUTPUT_UNSAFE", "Unsafe output", 422);
      },
    },
    {
      resolveRoute() {
        return {
          routeKey: GENERATION_TYPES.foundation_proposal,
          requires: ["textGeneration", "structuredJson"],
          primary: { provider: "tokenrouter", model: "minimax_text" },
          fallback: { provider: "openrouter", model: "qwen_plus" },
          maxOutputTokens: 3000,
          timeoutMs: 60_000,
          primaryMaxRetries: 1,
          temperature: 0.4,
        };
      },
      async callProvider() {
        unsafeFallbackCalls += 1;
        return { text: "unsafe", latencyMs: 1 };
      },
      async recordEvent() {},
      async sleep() {},
    },
  ),
  (error: unknown) =>
    error instanceof AppError && error.code === "AI_OUTPUT_UNSAFE",
);
assert.equal(unsafeFallbackCalls, 1);

let fallbackFailureCalls = 0;
await assert.rejects(
  generateWithModelRouter(
    baseBindings,
    {
      generationAttemptId: "33333333-3333-3333-3333-333333333333",
      providerEventSequence: createProviderEventSequence(),
      generationType: GENERATION_TYPES.outline_generation,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash: "hash",
      promptMessages: [{ role: "user", content: "outline" }],
      validateOutput(text) {
        return JSON.parse(text);
      },
    },
    {
      resolveRoute() {
        return {
          routeKey: GENERATION_TYPES.outline_generation,
          requires: ["textGeneration", "structuredJson"],
          primary: { provider: "tokenrouter", model: "minimax_text" },
          fallback: { provider: "openrouter", model: "qwen_plus" },
          maxOutputTokens: 4000,
          timeoutMs: 60_000,
          primaryMaxRetries: 1,
          temperature: 0.4,
        };
      },
      async callProvider() {
        fallbackFailureCalls += 1;
        throw new AppError("AI_PROVIDER_ERROR", "Provider failed", 502);
      },
      async recordEvent() {},
      async sleep() {},
    },
  ),
);
assert.equal(
  fallbackFailureCalls,
  3,
  "primary must run twice and fallback exactly once",
);

assert.doesNotThrow(() =>
  assertGenerationRouteCallable(baseBindings, {
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
  }),
);

console.log("PASS model router v3 contracts");
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
npx tsx apps/api/scripts/model-router-v3-contracts.test.mts
```

Expected: FAIL because the v3 router API is missing.

- [ ] **Step 3: Replace generation types with logical/provider distinctions**

Use:

```ts
import type {
  GenerationType,
  JsonObject,
  WriterQualityMode,
} from "@vibenovel/shared";
import type {
  AiLiveProviderId,
  AiLogicalModelKey,
} from "./ai-model-registry.js";
import type {
  ProviderEventSequence,
} from "./generation-provider-event.js";
import type { GenerationProviderEventOutcome } from "@vibenovel/shared";

export type AiProviderId = AiLiveProviderId | "mock";

export interface ResolvedModelConfig {
  provider: AiProviderId;
  logicalModel: AiLogicalModelKey;
  providerModelId: string;
  routeRole: "primary" | "fallback";
  maxOutputTokens: number;
  timeoutMs: number;
  temperature: number;
  primaryMaxRetries: number;
}

export interface ModelRouterGenerateInput<TOutput = string> {
  generationAttemptId: string;
  providerEventSequence: ProviderEventSequence;
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
  promptHash: string;
  promptMessages?: PromptMessage[];
  promptText?: string;
  maxOutputTokens?: number;
  maxOutputTokensOverride?: number;
  temperature?: number;
  metadata?: JsonObject;
  validateOutput?: (text: string) => TOutput;
}

export interface ModelRouterGenerateResult<TOutput = string> {
  text: string;
  output: TOutput;
  provider: AiProviderId;
  logicalModel: AiLogicalModelKey;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  finishReason?: string;
  promptHash: string;
  routingPolicyVersion: string;
  fallbackUsed: boolean;
  retryCount: number;
  estimatedCostUsd: number;
}

export interface ProviderEventRecorderInput {
  generationAttemptId: string;
  sequenceNumber: number;
  routeRole: "primary" | "fallback";
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: GenerationProviderEventOutcome;
  errorCategory?: string | null;
  errorCodeSafe?: string | null;
  providerHttpStatus?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}
```

- [ ] **Step 4: Implement route resolution and preflight**

`assertGenerationRouteCallable` must:

1. resolve policy;
2. validate registry capabilities;
3. check that at least primary or explicit fallback credential exists;
4. throw `AI_NOT_CONFIGURED` before debit when neither is callable.

Use:

```ts
export function assertGenerationRouteCallable(
  bindings: AppBindings,
  input: ModelRouterResolveInput,
): void {
  const route = resolveGenerationRoute(
    input.generationType,
    input.qualityMode,
  );
  const targets = [route.primary, route.fallback].filter(
    (target): target is AiRouteTarget => target !== null,
  );
  if (
    !isAiProviderMock(bindings) &&
    !targets.some((target) =>
      hasProviderCredential(bindings, target.provider),
    )
  ) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "No configured credential for the selected AI route",
      503,
    );
  }
}
```

- [ ] **Step 5: Implement retry/fallback execution**

The replacement router must:

- resolve raw provider ID only from registry;
- record `credential_unavailable` when a target cannot be called;
- retry timeout/rate-limit/provider-error/empty/invalid output;
- not retry or fallback unsafe output;
- calculate event cost using deployment pricing;
- return the validated output;
- support injected dependencies for tests.

It must read `route.primaryMaxRetries` for the primary loop. With the initial
value `1`, primary is called exactly twice at most: initial call plus one retry.
Fallback is outside that loop and is called at most once, with no retry.

Use these dependency defaults:

```ts
export interface ModelRouterDependencies {
  resolveRoute?: typeof resolveGenerationRoute;
  callProvider?: typeof callLiveProviderChat;
  recordEvent?: (
    input: ProviderEventRecorderInput,
  ) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}
```

Inside `generateWithModelRouter`, construct dependencies without module-global state:

```ts
const callProvider =
  dependencies.callProvider ?? callLiveProviderChat;
const resolveRoute =
  dependencies.resolveRoute ?? resolveGenerationRoute;
const recordEvent =
  dependencies.recordEvent ??
  (async (event: ProviderEventRecorderInput) => {
    await createGenerationProviderEvent(bindings, event);
  });
const sleep =
  dependencies.sleep ??
  (async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
```

For every skipped target or provider call, allocate the event number only from
the attempt-owned counter:

```ts
await recordEvent({
  ...event,
  sequenceNumber: nextProviderEventSequence(input.providerEventSequence),
});
```

Import `nextProviderEventSequence` from
`generation-provider-event.ts`. Never create a sequence inside
`generateWithModelRouter`; each orchestrator creates one after creating its
generation attempt and passes that same object to every router call associated
with the attempt.

Use one helper:

```ts
function isFallbackEligible(error: unknown): boolean {
  return (
    error instanceof AppError &&
    [
      "AI_PROVIDER_ERROR",
      "AI_PROVIDER_TIMEOUT",
      "AI_PROVIDER_RATE_LIMITED",
      "AI_OUTPUT_EMPTY",
      "GENERATION_FAILED",
    ].includes(error.code)
  );
}
```

Call `assertProviderOutputSafe(text)` before `validateOutput(text)`. Therefore `AI_OUTPUT_UNSAFE` exits immediately.

Normalize provider reasoning before safety and engine validation:

```ts
function normalizeProviderText(
  text: string,
  stripThinkTags: boolean,
): string {
  if (!stripThinkTags) return text.trim();
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}
```

Read `stripThinkTags` from the selected registry deployment. Never persist or log the removed reasoning text.

When `AI_PROVIDER_MOCK=true`, preserve the existing deterministic mock path:

```ts
const mockResult = await generateWithMockProvider(
  input,
  {
    provider: "mock",
    logicalModel: route.primary.model,
    providerModelId: `mock/${route.primary.model}`,
    routeRole: "primary",
    maxOutputTokens: route.maxOutputTokens,
    timeoutMs: route.timeoutMs,
    temperature: route.temperature,
    primaryMaxRetries: 0,
  },
  getAiProviderMockMode(bindings),
);
```

Validate mock output through the same `validateOutput` callback, but do not require live provider credentials.

Before throwing a final routing failure, persist the last safe routing summary with a new `updateGenerationAttemptRoutingSummary` helper from `generation-attempt.ts`. This ensures failed attempts retain final provider, logical model, provider model ID, routing version, fallback flag, retries, latency, tokens, and cost even though `markGenerationAttemptSucceeded` is never called.

- [ ] **Step 6: Lock the durable production policy to OpenRouter parity**

Assert in `ai-routing-policy-contracts.test.mts` that zero active production
targets use `tokenrouter` while its registry deployment remains `documented`.
The cross-provider router tests above use an injected route, so they verify the
capability without activating TokenRouter in production policy.

Do not modify production targets in this task. TokenRouter activation belongs
only to `Optional Gate A`, after Task 14, and must be a separate one-engine
policy commit.

- [ ] **Step 7: Run router and policy tests**

```powershell
npm run test:ai-routing-policy -w @vibenovel/api
npx tsx apps/api/scripts/model-router-v3-contracts.test.mts
```

Expected:

```text
PASS AI routing policy contracts
PASS model router v3 contracts
```

- [ ] **Step 8: Wire script and commit**

```json
"test:model-router-v3": "tsx scripts/model-router-v3-contracts.test.mts"
```

Commit:

```powershell
git add apps/api/src/services/ai-generation-types.ts apps/api/src/services/model-router.ts apps/api/src/services/ai-routing-policy.ts apps/api/scripts/model-router-v3-contracts.test.mts apps/api/package.json
git commit -m "feat(ai): route validated generations across providers"
```

---

### Task 8: Migrate structured generation engines to validated router output

**Files:**
- Modify: `apps/api/src/services/intake.ts`
- Modify: `apps/api/src/services/concept.ts`
- Modify: `apps/api/src/services/foundation-proposal.ts`
- Modify: `apps/api/src/services/asisten-narra-foundation-patch.ts`
- Modify: `apps/api/src/services/outline-generator.ts`
- Modify: `apps/api/src/services/beat-generation-ai.ts`
- Modify: `apps/api/src/services/chapter-summary-ai.ts`
- Modify: `apps/api/src/services/publish-copy-ai-generation.ts`
- Modify: `apps/api/src/services/import/signal-extraction-ai.ts`
- Modify: `apps/api/src/services/draft-import.ts`
- Modify: `apps/api/scripts/generation-contracts.test.mts`
- Modify: `apps/api/scripts/draft-import-contracts.test.mts`

- [ ] **Step 1: Add failing source contracts**

Update `generation-contracts.test.mts` to assert:

```ts
for (const file of [
  "src/services/intake.ts",
  "src/services/concept.ts",
  "src/services/foundation-proposal.ts",
  "src/services/asisten-narra-foundation-patch.ts",
  "src/services/outline-generator.ts",
  "src/services/beat-generation-ai.ts",
  "src/services/chapter-summary-ai.ts",
  "src/services/publish-copy-ai-generation.ts",
]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /assertGenerationRouteCallable/);
  assert.match(source, /generationAttemptId:\s*attempt\.id/);
  assert.match(source, /validateOutput:/);
}
```

Expected failure: current call sites do not pass attempt IDs or validators.

- [ ] **Step 2: Add route preflight before attempt creation**

In every paid structured engine, after `generationType` and `qualityMode` are known but before `createGenerationAttempt`, add:

```ts
assertGenerationRouteCallable(bindings, {
  generationType,
  qualityMode,
});
```

For `asisten-narra-foundation-patch.ts`, use `input.bindings`.

- [ ] **Step 3: Pass attempt ID and validator to the router**

Immediately after each generation attempt is created, create one event sequence:

```ts
const providerEventSequence = createProviderEventSequence();
```

Pass that same object to every router call belonging to the attempt. Use each
engine's existing parser as the validator.

Examples:

```ts
const routerResult = await generateWithModelRouter(bindings, {
  generationAttemptId: attempt.id,
  providerEventSequence,
  generationType,
  qualityMode,
  promptHash,
  promptMessages,
  temperature: 0.35,
  validateOutput: parseAndValidateBeatAiOutput,
});
const drafts = routerResult.output;
```

```ts
const routerResult = await generateWithModelRouter(bindings, {
  generationAttemptId: attempt.id,
  providerEventSequence,
  generationType,
  qualityMode,
  promptHash,
  promptMessages,
  temperature: 0.35,
  validateOutput: parseAndValidateChapterSummaryAiOutput,
});
const ai = routerResult.output;
```

For outline:

```ts
validateOutput(text) {
  const parsed = parseLenientJsonObject(text);
  if (!parsed) {
    throw new AppError(
      "GENERATION_FAILED",
      "AI mengembalikan format outline yang tidak valid. Coba lagi.",
      502,
    );
  }
  assertPlanningOutputSpecificToProject(parsed, "outline");
  return parsed;
}
```

For foundation, extract the current parse/shape validation into an exported `parseFoundationProposalAiOutput(text)` and pass it as `validateOutput`.

For concept, extract the current fence stripping, JSON parse, array-length, and concept shape checks into `parseConceptGenerationOutput(text)`.

For publish, pass the existing publish field parser that calls `extractJsonObject`.

For intake, return a normalized object:

```ts
validateOutput(text) {
  if (narraPhase === INTAKE_PHASES.foundation_refinement) {
    return { rawText: text, envelope: null };
  }
  const envelope = parseIntakeAiEnvelope(text);
  if (!envelope || envelope.parseStatus === "failed") {
    throw new AppError(
      "GENERATION_FAILED",
      "Narra returned an invalid intake envelope",
      502,
    );
  }
  return { rawText: text, envelope };
}
```

- [ ] **Step 4: Write final route summary on success**

Update every `markGenerationAttemptSucceeded` call:

```ts
provider: routerResult.provider,
model: routerResult.model,
logicalModel: routerResult.logicalModel,
routingPolicyVersion: routerResult.routingPolicyVersion,
fallbackUsed: routerResult.fallbackUsed,
retryCount: routerResult.retryCount,
providerLatencyMs: routerResult.latencyMs,
```

Use `routerResult.estimatedCostUsd` rather than raw-model cost lookup.

- [ ] **Step 5: Give draft-import AI extraction a zero-credit attempt**

In `extractDraftImportSignalsForOwner`:

1. build router input;
2. preflight;
3. create an attempt with `creditCost: 0`;
4. create one `providerEventSequence`;
5. mark it running;
6. pass `generationAttemptId` and `providerEventSequence`;
7. mark succeeded when AI signals parse;
8. mark failed when deterministic fallback is used.

Use:

```ts
const idempotencyKey =
  `draft-import-signals-${draftImportId}-${routerInput.promptHash}`;
```

Change `DraftImportSignalAiFirstInput` to accept the already-created attempt:

```ts
export interface DraftImportSignalAiFirstInput {
  bindings: AppBindings;
  content: string;
  fallbackSignals: DraftImportSignalDraft[];
  generationAttemptId: string;
  routerInput: ModelRouterGenerateInput;
  generate?: (
    input: ModelRouterGenerateInput,
  ) => Promise<ModelRouterGenerateResult>;
}
```

The router input passed by the parent must include:

```ts
generationAttemptId: attempt.id,
providerEventSequence,
validateOutput(text) {
  const signals = parseDraftImportSignalExtractionOutput(text, {
    provider: "pending",
    model: "pending",
    promptHash: routerInput.promptHash,
  });
  if (signals.length === 0) {
    throw new AppError(
      "GENERATION_FAILED",
      "Draft import signal extraction returned no valid signals",
      502,
    );
  }
  return signals;
},
```

After the router returns, rebuild the signal metadata from the final `provider`, `model`, and `promptHash`; do not persist the temporary `"pending"` labels.

The deterministic import action may still succeed while the AI attempt is marked failed.

- [ ] **Step 6: Run focused contracts**

```powershell
npm run test:generation-contracts -w @vibenovel/api
npm run test:draft-import -w @vibenovel/api
npm run test:intake-extraction -w @vibenovel/api
npm run test:sprint19-asisten-narra -w @vibenovel/api
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/api/src/services/intake.ts apps/api/src/services/concept.ts apps/api/src/services/foundation-proposal.ts apps/api/src/services/asisten-narra-foundation-patch.ts apps/api/src/services/outline-generator.ts apps/api/src/services/beat-generation-ai.ts apps/api/src/services/chapter-summary-ai.ts apps/api/src/services/publish-copy-ai-generation.ts apps/api/src/services/import/signal-extraction-ai.ts apps/api/src/services/draft-import.ts apps/api/scripts/generation-contracts.test.mts apps/api/scripts/draft-import-contracts.test.mts
git commit -m "refactor(ai): validate structured output inside router"
```

---

### Task 9: Migrate prose generation and safe-repair loops

**Files:**
- Modify: `apps/api/src/services/prose-output-safe-repair.ts`
- Modify: `apps/api/src/services/prose-beat-generation.ts`
- Modify: `apps/api/src/services/prose-rewrite-generation.ts`
- Modify: `apps/api/scripts/prose-safe-repair-loop.test.mts`
- Modify: `apps/api/scripts/write-room-contracts.test.mts`

- [ ] **Step 1: Write failing prose route contracts**

Add assertions:

```ts
const source = readFileSync(
  "src/services/prose-output-safe-repair.ts",
  "utf8",
);
assert.match(source, /generationAttemptId:\s*persistContext\.generationAttemptId/);
assert.match(source, /logicalModel/);
assert.match(source, /routingPolicyVersion/);
assert.match(source, /fallbackUsed/);
```

- [ ] **Step 2: Add preflight before prose attempt creation**

In both prose orchestrators:

```ts
assertGenerationRouteCallable(bindings, {
  generationType: GENERATION_TYPES.prose_beat,
  qualityMode: body.qualityMode,
});
```

Use `prose_rewrite` in rewrite.

- [ ] **Step 3: Pass attempt ID through safe-repair**

Each prose orchestrator creates one `providerEventSequence` immediately after
creating the generation attempt and stores it in the safe-repair
`persistContext`. The safe-repair function must reuse that same object across
the initial generation and every repair pass; it must never reset the counter.

Inside `generateValidatedAiOutputWithSafeRepair`:

```ts
const providerResult = await generateWithModelRouter(bindings, {
  generationAttemptId: persistContext?.generationAttemptId ??
    (() => {
      throw new AppError(
        "AI_NOT_CONFIGURED",
        "Generation attempt ID is required for provider telemetry",
        503,
      );
    })(),
  providerEventSequence: persistContext.providerEventSequence,
  generationType: generationType as GenerationType,
  qualityMode: input.qualityMode,
  promptHash,
  promptMessages,
  metadata: input.metadata,
  temperature: input.temperature,
  validateOutput: (text) => text,
});
```

Extend `ValidatedAiProviderOutput` with:

```ts
logicalModel: string;
routingPolicyVersion: string;
fallbackUsed: boolean;
totalRetryCount: number;
totalProviderLatencyMs: number;
totalEstimatedCostUsd: number;
```

Aggregate these values across repair passes.

- [ ] **Step 4: Update attempt success writes**

Both prose orchestrators must write the aggregated values:

```ts
logicalModel: validated.logicalModel,
routingPolicyVersion: validated.routingPolicyVersion,
fallbackUsed: validated.fallbackUsed,
retryCount: validated.totalRetryCount,
providerLatencyMs: validated.totalProviderLatencyMs,
estimatedCostUsd: validated.totalEstimatedCostUsd,
```

- [ ] **Step 5: Run prose regressions**

```powershell
npm run test:prose-safe-repair-loop -w @vibenovel/api
npm run test:write-room-contracts -w @vibenovel/api
npm run test:prose-version-safe-response -w @vibenovel/api
```

Expected: all PASS, including unsafe-output no-fallback behavior.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/services/prose-output-safe-repair.ts apps/api/src/services/prose-beat-generation.ts apps/api/src/services/prose-rewrite-generation.ts apps/api/scripts/prose-safe-repair-loop.test.mts apps/api/scripts/write-room-contracts.test.mts
git commit -m "refactor(ai): route prose through provider telemetry"
```

---

### Task 10: Move embedding into the same registry and policy

**Files:**
- Modify: `apps/api/src/services/openai-compatible-client.ts`
- Modify: `apps/api/src/services/import/embedding.ts`
- Modify: `apps/api/src/services/import/pipeline-runner.ts`
- Modify: `apps/api/scripts/sprint18-import-rag-contracts.test.mts`

- [ ] **Step 1: Rewrite failing embedding expectations**

Replace the env-based contract with:

```ts
const embeddingConfig = resolveEmbeddingModel();
assert.equal(embeddingConfig.provider, "openrouter");
assert.equal(embeddingConfig.logicalModel, "openai_embedding_small");
assert.equal(embeddingConfig.model, "openai/text-embedding-3-small");
assert.equal(embeddingConfig.dimensions, 1536);
```

Remove assertions that `AI_EMBEDDING_MODEL` can choose a raw ID.

- [ ] **Step 2: Add generic embeddings transport**

Add `callOpenAiCompatibleEmbeddings` to the shared transport. It accepts:

```ts
export interface OpenAiCompatibleEmbeddingInput {
  provider: AiLiveProviderId;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  texts: string[];
  dimensions: number;
  timeoutMs: number;
}
```

It posts:

```ts
{
  model: input.modelId,
  input: input.texts,
  encoding_format: "float",
}
```

It preserves existing vector count, numeric value, and dimension validation.

- [ ] **Step 3: Replace embedding allowlist and env resolver**

`resolveEmbeddingModel()` must use:

```ts
const route = getEmbeddingRoute("import_rag");
const model = getAiModel(route.primary.model);
const deployment = getAiModelDeployment(
  route.primary.model,
  route.primary.provider,
);
return {
  provider: route.primary.provider,
  logicalModel: route.primary.model,
  model: deployment.modelId,
  dimensions: model.embeddingDimensions ?? 0,
  timeoutMs: route.timeoutMs,
};
```

Delete `DEFAULT_EMBEDDING_MODEL` and `EMBEDDING_MODEL_ALLOWLIST`.

- [ ] **Step 4: Preserve persisted provider/model snapshots**

Continue writing:

```ts
embedding_provider: input.embeddingResult.provider,
embedding_model: input.embeddingResult.model,
```

Also add `logicalModel` to embedding metadata:

```ts
logicalModel: input.embeddingResult.logicalModel,
```

- [ ] **Step 5: Run Sprint 18 contracts**

```powershell
npm run test:sprint18-import-rag -w @vibenovel/api
```

Expected: PASS and vector dimension remains 1536.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/services/openai-compatible-client.ts apps/api/src/services/import/embedding.ts apps/api/src/services/import/pipeline-runner.ts apps/api/scripts/sprint18-import-rag-contracts.test.mts
git commit -m "refactor(ai): centralize embedding routing"
```

---

### Task 11: Expose safe provider timelines through the admin API

**Files:**
- Modify: `apps/api/src/services/admin-ops.ts`
- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/services/generation-attempt.ts`
- Create: `apps/api/scripts/admin-generation-attempts-contracts.test.mts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Write failing admin response contracts**

Create a source/API contract that asserts:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminOps = readFileSync("src/services/admin-ops.ts", "utf8");
assert.match(adminOps, /listGenerationProviderEvents/);
assert.match(adminOps, /providerEvents/);
assert.match(adminOps, /logicalModel/);
assert.match(adminOps, /routingPolicyVersion/);
assert.match(adminOps, /fallbackUsed/);
assert.doesNotMatch(adminOps, /rawPrompt|rawResponse|reasoningText/);

const adminRoutes = readFileSync("src/routes/admin.ts", "utf8");
assert.match(adminRoutes, /generation-attempts\/:attemptId/);

console.log("PASS admin generation attempt diagnostics contracts");
```

- [ ] **Step 2: Extend list item fields**

The list response must include:

```ts
logicalModel: string | null;
routingPolicyVersion: string | null;
fallbackUsed: boolean;
retryCount: number;
providerLatencyMs: number | null;
inputTokens: number | null;
outputTokens: number | null;
estimatedCostUsd: number | null;
```

- [ ] **Step 3: Return provider timeline from detail**

Change detail response:

```ts
export interface AdminGenerationAttemptDetailResponse {
  attempt: AdminGenerationAttemptListItem;
  providerEvents: GenerationProviderEvent[];
  correlationId: string | null;
}
```

Load with:

```ts
const providerEvents = await listGenerationProviderEvents(
  bindings,
  attemptId,
);
const correlationId =
  typeof mapped.metadata.correlationId === "string"
    ? mapped.metadata.correlationId
    : null;
return {
  attempt: {
    ...summary,
    projectId: row.project_id,
    userId: row.user_id,
    ...labels,
  },
  providerEvents,
  correlationId,
};
```

- [ ] **Step 4: Run admin API and guard tests**

```powershell
npx tsx apps/api/scripts/admin-generation-attempts-contracts.test.mts
npm run test:admin-guard -w @vibenovel/api
npm run typecheck:api
```

Expected: all PASS.

- [ ] **Step 5: Add script and commit**

```json
"test:admin-generation-attempts": "tsx scripts/admin-generation-attempts-contracts.test.mts"
```

Commit:

```powershell
git add apps/api/src/services/admin-ops.ts apps/api/src/routes/admin.ts apps/api/src/services/generation-attempt.ts apps/api/scripts/admin-generation-attempts-contracts.test.mts apps/api/package.json
git commit -m "feat(admin): expose AI provider call timeline"
```

---

### Task 12: Add admin attempt detail UI and richer list diagnostics

**Files:**
- Modify: `apps/web/src/services/admin.ts`
- Modify: `apps/web/src/pages/admin/AdminGenerationAttemptsPage.tsx`
- Create: `apps/web/src/pages/admin/AdminGenerationAttemptDetailPage.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Create: `apps/web/scripts/admin-generation-attempts-ui-contracts.test.mts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing UI contract**

Create:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const list = readFileSync(
  "src/pages/admin/AdminGenerationAttemptsPage.tsx",
  "utf8",
);
const detail = readFileSync(
  "src/pages/admin/AdminGenerationAttemptDetailPage.tsx",
  "utf8",
);
const routes = readFileSync("src/routes/index.tsx", "utf8");

for (const label of [
  "Provider",
  "Logical model",
  "Fallback",
  "Latensi",
  "Biaya",
]) {
  assert.match(list, new RegExp(label, "i"));
}

for (const label of [
  "Timeline provider",
  "Primary",
  "Fallback",
  "HTTP",
  "Retry",
  "Token",
  "Correlation",
]) {
  assert.match(detail, new RegExp(label, "i"));
}

assert.match(routes, /generation-attempts\/:attemptId/);
assert.doesNotMatch(detail, /raw prompt|raw response|reasoning content/i);

console.log("PASS admin generation attempts UI contracts");
```

- [ ] **Step 2: Extend web service types and detail fetch**

Add fields matching the admin API and:

```ts
export interface AdminGenerationProviderEvent {
  id: string;
  sequenceNumber: number;
  routeRole: "primary" | "fallback";
  provider: string;
  logicalModel: string;
  providerModelId: string;
  retryNumber: number;
  outcome: string;
  errorCategory: string | null;
  errorCodeSafe: string | null;
  providerHttpStatus: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

export interface AdminGenerationAttemptDetailResponse {
  attempt: AdminGenerationAttemptListItem;
  providerEvents: AdminGenerationProviderEvent[];
  correlationId: string | null;
}

export async function fetchAdminGenerationAttempt(
  attemptId: string,
  token?: string | null,
): Promise<AdminGenerationAttemptDetailResponse> {
  return apiRequest<AdminGenerationAttemptDetailResponse>(
    `/api/admin/generation-attempts/${attemptId}`,
    { token },
  );
}
```

- [ ] **Step 3: Upgrade list table**

Make every row link to `ROUTES.admin.generationAttemptDetail(a.id)`.

Columns:

```text
Engine | Status | Provider | Logical model | Provider model | Fallback | Latency | Biaya | Error | User
```

Render fallback as `Ya`/`Tidak`, latency as milliseconds, and cost as `$0.000000` precision when non-null.

- [ ] **Step 4: Implement detail page**

The page must:

- load by `attemptId`;
- show attempt summary cards;
- render provider events ordered by sequence;
- label `primary` and `fallback`;
- display safe HTTP status, retry, tokens, latency, cost, outcome;
- show correlation ID only when included in the safe attempt response;
- never render prompt/output/reasoning fields.

- [ ] **Step 5: Register route**

Add:

```tsx
{
  path: "generation-attempts/:attemptId",
  element: <AdminGenerationAttemptDetailPage />,
},
```

- [ ] **Step 6: Run UI contracts and typecheck**

```powershell
npx tsx apps/web/scripts/admin-generation-attempts-ui-contracts.test.mts
npm run typecheck:web
```

Expected: PASS.

- [ ] **Step 7: Add script and commit**

```json
"test:admin-generation-attempts-ui": "tsx scripts/admin-generation-attempts-ui-contracts.test.mts"
```

Commit:

```powershell
git add apps/web/src/services/admin.ts apps/web/src/pages/admin/AdminGenerationAttemptsPage.tsx apps/web/src/pages/admin/AdminGenerationAttemptDetailPage.tsx apps/web/src/routes/index.tsx apps/web/scripts/admin-generation-attempts-ui-contracts.test.mts apps/web/package.json
git commit -m "feat(admin): add AI provider diagnostics timeline"
```

---

### Task 13: Remove legacy model sources and enforce the boundary

**Files:**
- Delete: `apps/api/src/services/model-routing-v2.ts`
- Delete: `apps/api/src/services/model-cost-map.ts`
- Delete: `apps/api/src/services/openrouter-client.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/node-bindings.ts`
- Modify: `apps/api/src/services/model-router.ts`
- Modify: `apps/api/scripts/model-routing-v2-contracts.test.mts`
- Modify: `apps/api/scripts/generation-contracts.test.mts`
- Create: `apps/api/scripts/ai-model-id-boundary.test.mts`
- Modify: `apps/api/.dev.vars.example`
- Modify: `.env.production.example`
- Modify: `apps/api/wrangler.toml`
- Modify: `scripts/operator-production-worker-secrets.ps1`
- Modify: `scripts/operator-staging-worker-secrets.ps1`
- Modify: `apps/api/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write the raw model ID boundary test**

Create:

```ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { AI_MODEL_REGISTRY } from "../src/services/ai-model-registry.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const allowed = new Set([
  "src/services/ai-model-registry.ts",
]);

const rawIds = Object.values(AI_MODEL_REGISTRY).flatMap((model) =>
  Object.values(model.deployments)
    .filter(Boolean)
    .map((deployment) => deployment.modelId),
);

for (const file of walk("src").filter((file) => file.endsWith(".ts"))) {
  const normalized = relative(".", file).replaceAll("\\", "/");
  if (allowed.has(normalized)) continue;
  const source = readFileSync(file, "utf8");
  for (const rawId of rawIds) {
    assert.equal(
      source.includes(rawId),
      false,
      `${rawId} must only exist in ai-model-registry.ts; found in ${normalized}`,
    );
  }
}

console.log("PASS raw provider model IDs stay inside registry");
```

- [ ] **Step 2: Verify the boundary test fails before cleanup**

```powershell
npx tsx apps/api/scripts/ai-model-id-boundary.test.mts
```

Expected: FAIL and list remaining runtime duplicates.

- [ ] **Step 3: Remove all legacy model env bindings**

Delete from `AppBindings`, `BINDING_ENV_KEYS`, examples, and Worker vars:

```text
DEFAULT_AI_MODEL
AI_MODEL_HEMAT
AI_MODEL_SEIMBANG
AI_MODEL_TERBAIK
AI_EMBEDDING_MODEL
```

Add startup validation:

```ts
const LEGACY_AI_MODEL_ENV_KEYS = [
  "DEFAULT_AI_MODEL",
  "AI_MODEL_HEMAT",
  "AI_MODEL_SEIMBANG",
  "AI_MODEL_TERBAIK",
  "AI_EMBEDDING_MODEL",
] as const;

export function assertNoLegacyAiModelEnv(
  source: Record<string, string | undefined>,
): void {
  const active = LEGACY_AI_MODEL_ENV_KEYS.filter(
    (key) => source[key]?.trim(),
  );
  if (active.length > 0) {
    throw new Error(
      `Legacy AI model env is forbidden: ${active.join(", ")}`,
    );
  }
}
```

Call this from Node binding load and Worker startup health/config validation.

- [ ] **Step 4: Replace cost callers with registry pricing**

Delete `model-cost-map.ts`. Any remaining cost call must use:

```ts
getDeploymentCost(result.logicalModel, result.provider)
```

Mock results return zero cost without querying a live deployment.

- [ ] **Step 5: Delete legacy routing and client files**

Delete:

```text
apps/api/src/services/model-routing-v2.ts
apps/api/src/services/model-cost-map.ts
apps/api/src/services/openrouter-client.ts
```

Update `model-routing-v2-contracts.test.mts` into a compatibility regression that imports registry/policy and verifies credit prices remain unchanged. Rename it to `ai-routing-v3-credit-invariance.test.mts`.

- [ ] **Step 6: Update deployment operator scripts**

Production script must require both keys when active routes require both providers:

```powershell
$missing += Add-Missing @("OPENROUTER_API_KEY", "TOKENROUTER_API_KEY")
```

Upload both secrets and print only `[set]`/`[not set]`.

Staging script accepts optional `TOKENROUTER_API_KEY` and `OPENROUTER_API_KEY` from `.env.staging`, but never logs values.

- [ ] **Step 7: Run boundary and configuration tests**

```powershell
npx tsx apps/api/scripts/ai-model-id-boundary.test.mts
npm run test:health-env-flags -w @vibenovel/api
npm run test:ai-routing
```

Expected: all PASS.

- [ ] **Step 8: Wire scripts**

Add:

```json
"test:ai-model-id-boundary": "tsx scripts/ai-model-id-boundary.test.mts",
"test:ai-routing-v3-credit-invariance": "tsx scripts/ai-routing-v3-credit-invariance.test.mts"
```

Expand root:

```json
"test:ai-routing": "npm run build:shared && npm run test:ai-model-registry -w @vibenovel/api && npm run test:ai-routing-policy -w @vibenovel/api && npm run test:ai-provider-transport -w @vibenovel/api && npm run test:model-router-v3 -w @vibenovel/api && npm run test:generation-provider-events -w @vibenovel/api && npm run test:ai-model-id-boundary -w @vibenovel/api && npm run test:ai-routing-v3-credit-invariance -w @vibenovel/api"
```

- [ ] **Step 9: Commit**

```powershell
git add -A apps/api/src/services apps/api/src/env.ts apps/api/src/node-bindings.ts apps/api/scripts apps/api/.dev.vars.example .env.production.example apps/api/wrangler.toml scripts/operator-production-worker-secrets.ps1 scripts/operator-staging-worker-secrets.ps1 apps/api/package.json package.json
git commit -m "refactor(ai): remove duplicate model configuration"
```

---

### Task 14: Full verification, documentation, and controlled rollout

**Files:**
- Modify: `apps/api/README.md`
- Modify: `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- Create: `docs/audit/24-ai-model-registry-routing-verification-2026-06-21.md`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add CI gates**

Add these commands to the API contract job:

```yaml
- run: npm run test:ai-routing
- run: npm run test:admin-generation-attempts -w @vibenovel/api
- run: npm run test:admin-generation-attempts-ui -w @vibenovel/web
```

- [ ] **Step 2: Run focused suites**

```powershell
npm run test:ai-routing
npm run test:generation-contracts -w @vibenovel/api
npm run test:prose-safe-repair-loop -w @vibenovel/api
npm run test:sprint18-import-rag -w @vibenovel/api
npm run test:sprint19-asisten-narra -w @vibenovel/api
npm run test:admin-generation-attempts -w @vibenovel/api
npm run test:admin-generation-attempts-ui -w @vibenovel/web
```

Expected: all PASS.

- [ ] **Step 3: Run full static verification**

```powershell
npm run typecheck
npm run lint
npm run build:api
npm run build:web
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Apply migration locally and run smoke regressions**

```powershell
supabase db reset
npm run smoke:api:sprint8 -- -MockMode success
npm run smoke:api:sprint8 -- -MockMode fail_provider
npm run smoke:api:sprint9 -- -MockMode success
npm run smoke:api:sprint9 -- -MockMode fail_provider
```

Expected:

- success paths persist final route summary;
- failure paths refund;
- idempotency does not duplicate provider calls;
- mock mode requires no live credentials.

- [ ] **Step 5: Run one controlled live TokenRouter engine smoke**

Use a non-user production fixture or local Supabase fixture. Start with foundation or outline, not every engine.

Verify in the admin detail response:

```text
primary provider = tokenrouter
logical model = minimax_text
provider model = MiniMax-M3
fallback used = false
provider event outcome = succeeded
prompt/output/reasoning absent
```

Then run one controlled primary failure using a test dependency or temporary local invalid TokenRouter credential and verify explicit OpenRouter Qwen fallback plus refund safety. Do not alter production credentials for this test.

- [ ] **Step 6: Document exact verification results**

Create `docs/audit/24-ai-model-registry-routing-verification-2026-06-21.md` with:

- commits tested;
- migration status;
- route matrix summary;
- TokenRouter probe status;
- test commands and PASS/FAIL;
- live smoke provider timeline;
- fallback smoke timeline;
- no-secret/no-prompt evidence;
- credit/refund/idempotency results;
- remaining blockers;
- GO/NO-GO.

- [ ] **Step 7: Update operator documentation**

Document:

- model changes happen only in `ai-routing-policy.ts`;
- provider IDs/pricing/capabilities happen only in `ai-model-registry.ts`;
- provider keys/base URLs remain env-only;
- no model env overrides exist;
- emergency shutdown is `AI_GENERATION_ENABLED=false`;
- TokenRouter promotion ends 22 June 2026 and requires immediate pricing reverification afterward.

- [ ] **Step 8: Commit verification/docs**

```powershell
git add .github/workflows/ci.yml apps/api/README.md docs/36-non-blocking-technical-debt-and-deferred-items.md docs/audit/24-ai-model-registry-routing-verification-2026-06-21.md
git commit -m "docs(ai): verify centralized model routing rollout"
```

- [ ] **Step 9: Production rollout checkpoint**

Deploy in this order:

```text
1. Supabase migration 00022
2. API with registry/policy and both provider secrets
3. Health verification
4. One TokenRouter engine
5. Admin timeline inspection
6. Foundation
7. Outline
8. Chapter beats
9. Prose hemat
```

If TokenRouter becomes unavailable or promotion pricing changes, edit only `ai-routing-policy.ts` to move affected primaries back to verified OpenRouter targets, deploy, and preserve all telemetry.

---

## Final acceptance checklist

- [ ] Every generation type resolves through `ai-routing-policy.ts`.
- [ ] Every provider model ID resolves through `ai-model-registry.ts`.
- [ ] MiniMax M3 uses `MiniMax-M3` on TokenRouter and `minimax/minimax-m3` on OpenRouter.
- [ ] TokenRouter is assigned only to explicitly approved engines.
- [ ] Cross-provider fallback occurs only when written in policy.
- [ ] Invalid structured output is retried/fallbacked before success.
- [ ] Unsafe output never falls back.
- [ ] Missing all route credentials fails before debit.
- [ ] Every live provider call produces one safe provider event.
- [ ] Admin detail shows primary/retry/fallback timeline.
- [ ] No prompt, output, reasoning, raw response, or credential is persisted.
- [ ] Embedding uses the same registry/policy and remains 1536 dimensions.
- [ ] User credit prices remain unchanged.
- [ ] Legacy model env overrides, allowlist, cost map, and routing matrix are removed.
- [ ] Raw provider model ID boundary test passes.
- [ ] Full typecheck, lint, builds, API contracts, and smoke regressions pass.
